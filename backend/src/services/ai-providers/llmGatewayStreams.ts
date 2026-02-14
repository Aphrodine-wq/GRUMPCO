/**
 * @fileoverview LLM Gateway - Cloud/API Provider Stream Generators
 *
 * Contains the generic OpenAI-compatible stream handler, thin provider wrappers,
 * and the native Anthropic stream handler.
 *
 * @module services/ai-providers/llmGatewayStreams
 */

import logger from '../../middleware/logger.js';
import { addNimSpanAttributes } from '../../middleware/tracing.js';
import type {
  LLMProvider,
  StreamParams,
  StreamEvent,
  MultimodalContentPart,
} from './llmGatewayTypes.js';
import { PROVIDER_CONFIGS, getTimeoutMs } from './llmGatewayTypes.js';

// ── HANG-PROOF: Per-chunk idle timeout ─────────────────────────────────────
// If a provider's HTTP connection stays open but stops sending chunks,
// this helper throws after STREAM_CHUNK_TIMEOUT_MS so the stream doesn't hang.
const STREAM_CHUNK_TIMEOUT_MS = Number(process.env.STREAM_CHUNK_TIMEOUT_MS ?? 45_000);

async function readWithChunkTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs = STREAM_CHUNK_TIMEOUT_MS
): Promise<{ done: boolean; value: Uint8Array | undefined }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Provider stream stalled — no data received for ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  try {
    return await Promise.race([reader.read(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
import { getApiKeyForProviderAsync, getApiKeyForProvider } from './llmGateway.js';

// =============================================================================
// Generic OpenAI-Compatible Stream
// =============================================================================

/**
 * Generic OpenAI-compatible stream generator.
 * Works for NIM, OpenRouter, Google, and GitHub Copilot.
 */
export async function* streamOpenAICompatible(
  params: StreamParams,
  provider: Exclude<LLMProvider, 'mock' | 'ollama' | 'anthropic'>
): AsyncGenerator<StreamEvent> {
  const config = PROVIDER_CONFIGS[provider];
  const apiKey =
    (await getApiKeyForProviderAsync(provider, params.userId)) ?? getApiKeyForProvider(provider);

  if (!apiKey) {
    logger.warn({ provider }, `${provider} not configured - API key missing`);
    yield {
      type: 'content_block_delta' as const,
      delta: {
        type: 'text_delta' as const,
        text: `[${provider} not configured - set ${config.apiKeyEnvVar} environment variable]`,
      },
    };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || config.defaultModel;
  logger.debug({ model, provider }, `[${provider}] Starting stream request`);

  const body: Record<string, unknown> = {
    model,
    max_tokens: params.max_tokens,
    stream: true,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      ...params.messages.map((m) => {
        // Tool result messages (role="tool")
        if (m.role === 'tool' && m.tool_call_id) {
          return {
            role: 'tool' as const,
            tool_call_id: m.tool_call_id,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          };
        }
        // Assistant messages with tool_calls
        if (m.role === 'assistant' && m.tool_calls?.length) {
          return {
            role: 'assistant' as const,
            content: typeof m.content === 'string' ? m.content || null : null,
            tool_calls: m.tool_calls,
          };
        }
        // Regular user/assistant messages
        return {
          role: m.role as 'user' | 'assistant',
          content:
            typeof m.content === 'string'
              ? m.content
              : (m.content as MultimodalContentPart[]).map((p) =>
                  p.type === 'text'
                    ? { type: 'text' as const, text: p.text ?? '' }
                    : { type: 'image_url' as const, image_url: p.image_url }
                ),
        };
      }),
    ],
  };

  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.top_p !== undefined) body.top_p = params.top_p;

  // Add tools if provided and supported
  if (params.tools && params.tools.length > 0 && config.supportsTools) {
    body.tools = params.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters: t.input_schema ?? { type: 'object', properties: {} },
      },
    }));
  }

  const timeoutMs = getTimeoutMs(provider, params.max_tokens);
  addNimSpanAttributes(provider, model, {
    endpoint: config.baseUrl,
    timeout_ms: timeoutMs,
    max_tokens: params.max_tokens,
    message_count: (body.messages as unknown[])?.length ?? 0,
    has_tools: Boolean(body.tools),
  });

  let chunkCount = 0;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...config.headers,
    };

    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        ...headers,
        Connection: 'keep-alive',
      },
      body: JSON.stringify(body),
      signal: params.signal
        ? AbortSignal.any([params.signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
      keepalive: true,
    });

    if (!res.ok) {
      const t = await res.text();
      logger.warn({ status: res.status, body: t.slice(0, 500), model, provider }, 'API error');
      throw new Error(`${provider} API error: ${res.status} ${t.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error(`${provider}: no response body`);

    const dec = new TextDecoder();
    let buf = '';
    // chunkCount initiated above

    // Track streamed tool calls and emit only after finish_reason=tool_calls
    // so we don't execute tools with partial/incomplete arguments.
    const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();

    // Helper function to emit pending tool calls
    function* emitPendingToolCalls(
      calls: Map<number, { id: string; name: string; args: string }>
    ): Generator<StreamEvent> {
      for (const [, acc] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
        if (!acc.id || !acc.name) continue;
        let input: Record<string, unknown> = {};
        try {
          if (acc.args.trim()) {
            input = JSON.parse(acc.args) as Record<string, unknown>;
          }
        } catch {
          input = { raw: acc.args };
        }
        yield {
          type: 'content_block_start' as const,
          content_block: {
            type: 'tool_use' as const,
            id: acc.id,
            name: acc.name,
            input,
          },
        };
      }
      calls.clear();
    }

    while (true) {
      const { done, value } = await readWithChunkTimeout(reader);
      if (done) break;
      chunkCount++;
      const decoded = dec.decode(value, { stream: true });
      buf += decoded;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') {
          yield* emitPendingToolCalls(toolCalls);
          yield { type: 'message_stop' as const };
          return;
        }

        try {
          const j = JSON.parse(dataStr) as {
            choices?: Array<{
              delta?: {
                content?: string;
                tool_calls?: Array<{
                  index: number;
                  id?: string;
                  type?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
              finish_reason?: string | null;
            }>;
          };

          const choice = j.choices?.[0];
          const delta = choice?.delta;
          const finishReason = choice?.finish_reason;

          // Text content
          if (delta?.content) {
            yield {
              type: 'content_block_delta' as const,
              delta: { type: 'text_delta' as const, text: delta.content },
            };
          }

          // Tool calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id ?? '', name: '', args: '' });
              }
              const acc = toolCalls.get(idx)!;
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name = tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;
            }
          }

          if (finishReason === 'tool_calls' && toolCalls.size > 0) {
            yield* emitPendingToolCalls(toolCalls);
          }
        } catch {
          // skip malformed chunk
        }
      }
    }

    if (toolCalls.size > 0) {
      yield* emitPendingToolCalls(toolCalls);
    }
  } catch (error) {
    logger.warn({ error, model, provider }, `${provider} request failed`);
    yield {
      type: 'content_block_delta' as const,
      delta: {
        type: 'text_delta' as const,
        text: `[${provider} connection failed - ${error instanceof Error ? error.message : 'Unknown error'}]`,
      },
    };
  }
  logger.debug({ chunkCount, model, provider }, `[${provider}] Stream complete`);
  yield { type: 'message_stop' as const };
}

// =============================================================================
// Thin Provider Wrappers (OpenAI-Compatible)
// =============================================================================

/** Stream from NVIDIA NIM (OpenAI-compatible API). */
export async function* streamNim(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'nim');
}

/** Stream from OpenRouter (OpenAI-compatible API). */
export async function* streamOpenRouter(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'openrouter');
}

/** Stream from Google AI / Gemini (OpenAI-compatible API). */
export async function* streamGoogle(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'google');
}

/** Stream from GitHub Copilot (OpenAI-compatible API, OAuth token from user store). */
export async function* streamGithubCopilot(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'github_copilot');
}

// =============================================================================
// Anthropic Stream (Native API)
// =============================================================================

/** Stream from Anthropic (native API). */
export async function* streamAnthropic(params: StreamParams): AsyncGenerator<StreamEvent> {
  const config = PROVIDER_CONFIGS.anthropic;
  const apiKey =
    (await getApiKeyForProviderAsync('anthropic', params.userId)) ??
    getApiKeyForProvider('anthropic');

  if (!apiKey) {
    logger.warn(
      { provider: 'anthropic', userId: params.userId },
      'Anthropic not configured - API key missing'
    );
    yield {
      type: 'content_block_delta' as const,
      delta: {
        type: 'text_delta' as const,
        text: `[Anthropic not configured — add your API key in the Onboarding Wizard or set ${config.apiKeyEnvVar} environment variable]`,
      },
    };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || config.defaultModel;
  logger.debug({ model, provider: 'anthropic' }, '[Anthropic] Starting stream request');

  const body: Record<string, unknown> = {
    model,
    max_tokens: params.max_tokens,
    stream: true,
    messages: params.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    })),
  };

  if (params.system) body.system = params.system;
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.top_p !== undefined) body.top_p = params.top_p;

  // Add tools if provided
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.input_schema ?? { type: 'object', properties: {} },
    }));
  }

  const timeoutMs = getTimeoutMs('anthropic', params.max_tokens);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...config.headers,
    };

    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: { ...headers, Connection: 'keep-alive' },
      body: JSON.stringify(body),
      signal: params.signal
        ? AbortSignal.any([params.signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
      keepalive: true,
    });

    if (!res.ok) {
      const t = await res.text();
      logger.warn({ status: res.status, body: t.slice(0, 500), model }, 'Anthropic API error');
      throw new Error(`Anthropic API error: ${res.status} ${t.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Anthropic: no response body');

    const dec = new TextDecoder();
    let buf = '';
    let chunkCount = 0;

    // ── Anthropic tool-use accumulation ──────────────────────────────
    // Anthropic streams tool arguments incrementally:
    //   content_block_start  → { type: "tool_use", id, name, input: {} }
    //   content_block_delta  → { type: "input_json_delta", partial_json: "..." }
    //   content_block_stop   → (signals completion — parse accumulated JSON)
    // We must buffer the partial JSON and emit the complete tool_use event
    // only when content_block_stop arrives.
    const pendingToolBlocks: Map<number, { id: string; name: string; jsonBuf: string }> = new Map();
    let currentBlockIndex = -1;

    while (true) {
      const { done, value } = await readWithChunkTimeout(reader);
      if (done) break;
      chunkCount++;
      const decoded = dec.decode(value, { stream: true });
      buf += decoded;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        const dataStr = line.slice(6);

        try {
          const j = JSON.parse(dataStr) as {
            type?: string;
            index?: number;
            delta?: { type?: string; text?: string; partial_json?: string };
            content_block?: {
              type?: string;
              id?: string;
              name?: string;
              input?: Record<string, unknown>;
            };
          };

          // ── Text deltas ──────────────────────────────────────
          if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta' && j.delta.text) {
            yield {
              type: 'content_block_delta' as const,
              delta: { type: 'text_delta' as const, text: j.delta.text },
            };
          }

          // ── Tool use: start (record id/name, begin JSON buffer) ─
          if (j.type === 'content_block_start' && j.content_block?.type === 'tool_use') {
            currentBlockIndex = j.index ?? currentBlockIndex + 1;
            pendingToolBlocks.set(currentBlockIndex, {
              id: j.content_block.id ?? '',
              name: j.content_block.name ?? '',
              jsonBuf: '',
            });
          }

          // ── Tool use: accumulate input_json_delta fragments ──
          if (
            j.type === 'content_block_delta' &&
            j.delta?.type === 'input_json_delta' &&
            j.delta.partial_json !== undefined
          ) {
            const idx = j.index ?? currentBlockIndex;
            const pending = pendingToolBlocks.get(idx);
            if (pending) {
              pending.jsonBuf += j.delta.partial_json;
            }
          }

          // ── Tool use: stop (parse accumulated JSON, emit) ────
          if (j.type === 'content_block_stop') {
            const idx = j.index ?? currentBlockIndex;
            const pending = pendingToolBlocks.get(idx);
            if (pending) {
              let input: Record<string, unknown> = {};
              try {
                if (pending.jsonBuf.trim()) {
                  input = JSON.parse(pending.jsonBuf) as Record<string, unknown>;
                }
              } catch (parseErr) {
                logger.warn(
                  { toolName: pending.name, rawArgs: pending.jsonBuf.slice(0, 500) },
                  'Anthropic: failed to parse tool arguments JSON'
                );
                input = { _raw: pending.jsonBuf };
              }
              yield {
                type: 'content_block_start' as const,
                content_block: {
                  type: 'tool_use' as const,
                  id: pending.id,
                  name: pending.name,
                  input,
                },
              };
              pendingToolBlocks.delete(idx);
            }
          }

          if (j.type === 'message_stop') {
            // Emit any remaining tool blocks (shouldn't happen, but safety net)
            for (const [, pending] of pendingToolBlocks) {
              let input: Record<string, unknown> = {};
              try {
                if (pending.jsonBuf.trim())
                  input = JSON.parse(pending.jsonBuf) as Record<string, unknown>;
              } catch {
                input = { _raw: pending.jsonBuf };
              }
              yield {
                type: 'content_block_start' as const,
                content_block: {
                  type: 'tool_use' as const,
                  id: pending.id,
                  name: pending.name,
                  input,
                },
              };
            }
            pendingToolBlocks.clear();
            yield { type: 'message_stop' as const };
            return;
          }
        } catch {
          // skip malformed chunk
        }
      }
    }

    // Emit any remaining tool blocks at end of stream
    for (const [, pending] of pendingToolBlocks) {
      let input: Record<string, unknown> = {};
      try {
        if (pending.jsonBuf.trim()) input = JSON.parse(pending.jsonBuf) as Record<string, unknown>;
      } catch {
        input = { _raw: pending.jsonBuf };
      }
      yield {
        type: 'content_block_start' as const,
        content_block: {
          type: 'tool_use' as const,
          id: pending.id,
          name: pending.name,
          input,
        },
      };
    }
    pendingToolBlocks.clear();

    logger.debug({ chunkCount, model }, '[Anthropic] Stream complete');
    yield { type: 'message_stop' as const };
  } catch (error) {
    logger.warn({ error, model }, 'Anthropic request failed');
    yield {
      type: 'content_block_delta' as const,
      delta: {
        type: 'text_delta' as const,
        text: `[Anthropic connection failed - ${error instanceof Error ? error.message : 'Unknown error'}]`,
      },
    };
    yield { type: 'message_stop' as const };
  }
}

/**
 * LLM Gateway – unified streaming client for Anthropic and Zhipu (GLM).
 * Returns an async iterable of events compatible with Anthropic stream shape
 * so existing chat loop can consume either provider.
 * Uses @grump/ai-core provider registry when an adapter is registered.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getStreamProvider, registerStreamProvider } from '@grump/ai-core';
import logger from '../middleware/logger.js';
import { recordLlmStreamMetrics } from '../middleware/metrics.js';

export type LLMProvider = 'anthropic' | 'zhipu' | 'copilot' | 'openrouter' | 'nim';

export type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface StreamParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | MultimodalContentPart[];
  }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  }>;
}

/** Event shape that our chat loop expects (Anthropic-like) */
export type StreamEvent =
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } }
  | { type: 'content_block_start'; content_block: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } }
  | { type: 'message_stop' }
  | { type: 'error'; error?: unknown };

const ANTHROPIC_DEFAULT = 'claude-sonnet-4-20250514';
const ZHIPU_DEFAULT = 'glm-4';
/** Sub-models from Copilot (Codex-style); used when provider is copilot. */
export const COPILOT_SUB_MODELS = ['copilot-codex', 'copilot-codebase'] as const;
const COPILOT_DEFAULT = 'copilot-codex';
const OPENROUTER_DEFAULT = 'anthropic/claude-3.5-sonnet';
const NIM_DEFAULT = 'moonshotai/kimi-k2.5';

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Stream from Anthropic – pass-through, same event shape.
 */
async function* streamAnthropic(params: StreamParams): AsyncGenerator<StreamEvent> {
  const stream = await anthropicClient.messages.stream({
    model: params.model || ANTHROPIC_DEFAULT,
    max_tokens: params.max_tokens,
    system: params.system ?? '',
    messages: params.messages ?? [],
    tools: params.tools,
  } as Parameters<typeof anthropicClient.messages.stream>[0]);

  for await (const event of stream) {
    const ev = event as { type: string; delta?: { type?: string; text?: string }; content_block?: { type?: string; id?: string; name?: string; input?: Record<string, unknown> } };
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
      yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: (ev.delta as { text?: string }).text ?? '' } };
    } else if (ev.type === 'content_block_start') {
      const blk = ev.content_block;
      if (blk?.type === 'tool_use') {
        yield { type: 'content_block_start' as const, content_block: { type: 'tool_use' as const, id: blk.id ?? '', name: blk.name ?? '', input: blk.input ?? {} } };
      }
    } else if (ev.type === 'message_stop') {
      yield { type: 'message_stop' as const };
    }
  }
}

/**
 * Stream from Zhipu (GLM-4) via REST SSE. Tools not mapped in this stub; text only.
 */
async function* streamZhipu(params: StreamParams): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY is not set');
  }

  const model = params.model || ZHIPU_DEFAULT;
  const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

  const body = {
    model,
    max_tokens: params.max_tokens,
    stream: true,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Zhipu API error');
    throw new Error(`Zhipu API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Zhipu: no response body');

  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const text = j.choices?.[0]?.delta?.content;
          if (typeof text === 'string' && text.length > 0) {
            yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text } };
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
  yield { type: 'message_stop' as const };
}

/**
 * Stream from Copilot/Codex-style API when COPILOT_API_URL and COPILOT_API_KEY are set.
 * Expects OpenAI-compatible chat completions SSE (data: {"choices":[{"delta":{"content":"..."}}]}).
 */
async function* streamCopilot(params: StreamParams): AsyncGenerator<StreamEvent> {
  const url = process.env.COPILOT_API_URL;
  const apiKey = process.env.COPILOT_API_KEY;
  if (!url || !apiKey) {
    logger.warn({}, 'Copilot provider skipped: COPILOT_API_URL or COPILOT_API_KEY not set');
    yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: '[Copilot not configured. Set COPILOT_API_URL and COPILOT_API_KEY.]' } };
    yield { type: 'message_stop' as const };
    return;
  }

  const body = {
    model: params.model || COPILOT_DEFAULT,
    max_tokens: params.max_tokens,
    stream: true,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Copilot API error');
    throw new Error(`Copilot API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Copilot: no response body');

  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const text = j.choices?.[0]?.delta?.content;
          if (typeof text === 'string' && text.length > 0) {
            yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text } };
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
  yield { type: 'message_stop' as const };
}

/**
 * Stream from OpenRouter (OpenAI-compatible). Uses OPENROUTER_API_KEY.
 * Model pass-through (e.g. anthropic/claude-3.5-sonnet, openai/gpt-4o). Text-only; tools not mapped.
 */
async function* streamOpenRouter(params: StreamParams): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.warn({}, 'OpenRouter provider skipped: OPENROUTER_API_KEY not set');
    yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: '[OpenRouter not configured. Set OPENROUTER_API_KEY.]' } };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || OPENROUTER_DEFAULT;
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const body = {
    model,
    max_tokens: params.max_tokens,
    stream: true,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'OpenRouter API error');
    throw new Error(`OpenRouter API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('OpenRouter: no response body');

  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith(':')) continue; // SSE comment (e.g. ": OPENROUTER PROCESSING")
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          error?: { message?: string };
        };
        if (j.error) {
          logger.warn({ error: j.error.message }, 'OpenRouter stream error');
          yield { type: 'message_stop' as const };
          return;
        }
        const text = j.choices?.[0]?.delta?.content;
        if (typeof text === 'string' && text.length > 0) {
          yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text } };
        }
      } catch {
        // skip malformed chunk
      }
    }
  }
  yield { type: 'message_stop' as const };
}

/**
 * Stream from NVIDIA NIM (OpenAI-compatible). Uses NVIDIA_NIM_API_KEY.
 * Models: moonshotai/kimi-k2.5, nvidia/nemotron-* etc. Supports tools when NIM supports tool_calls in stream.
 */
async function* streamNim(params: StreamParams): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    logger.warn({}, 'NIM provider skipped: NVIDIA_NIM_API_KEY not set');
    yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: '[NVIDIA NIM not configured. Set NVIDIA_NIM_API_KEY.]' } };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || NIM_DEFAULT;
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  const body: Record<string, unknown> = {
    model,
    max_tokens: params.max_tokens,
    stream: true,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      ...params.messages.map((m) => ({
        role: m.role,
        content:
          typeof m.content === 'string'
            ? m.content
            : (m.content as MultimodalContentPart[]).map((p) =>
                p.type === 'text' ? { type: 'text' as const, text: p.text ?? '' } : { type: 'image_url' as const, image_url: p.image_url }
              ),
      })),
    ],
  };
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters: t.input_schema ?? { type: 'object', properties: {} },
      },
    }));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'NIM API error');
    throw new Error(`NIM API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('NIM: no response body');

  const dec = new TextDecoder();
  let buf = '';
  type ToolCallAccum = { id: string; name: string; args: string };
  const toolCallsAccum: ToolCallAccum[] = [];
  const emittedToolIndices = new Set<number>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith(':')) continue;
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{ index?: number; id?: string; name?: string; arguments?: string }>;
            };
            finish_reason?: string;
          }>;
          error?: { message?: string };
        };
        if (j.error) {
          logger.warn({ error: j.error?.message }, 'NIM stream error');
          yield { type: 'message_stop' as const };
          return;
        }
        const choice = j.choices?.[0];
        const delta = choice?.delta;
        if (!delta) continue;

        if (typeof delta.content === 'string' && delta.content.length > 0) {
          yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: delta.content } };
        }

        const toolCalls = delta.tool_calls;
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const idx = tc.index ?? 0;
            while (toolCallsAccum.length <= idx) {
              toolCallsAccum.push({ id: '', name: '', args: '' });
            }
            const acc = toolCallsAccum[idx]!;
            if (tc.id) acc.id = tc.id;
            if (tc.name) acc.name = tc.name;
            if (tc.arguments) acc.args += tc.arguments;
          }
          for (let i = 0; i < toolCallsAccum.length; i++) {
            if (emittedToolIndices.has(i)) continue;
            const acc = toolCallsAccum[i]!;
            if (acc.id && acc.name) {
              emittedToolIndices.add(i);
              let input: Record<string, unknown> = {};
              try {
                if (acc.args.trim()) input = JSON.parse(acc.args) as Record<string, unknown>;
              } catch {
                input = { raw: acc.args };
              }
              yield {
                type: 'content_block_start' as const,
                content_block: { type: 'tool_use' as const, id: acc.id, name: acc.name, input },
              };
            }
          }
        }
      } catch {
        // skip malformed chunk
      }
    }
  }
  yield { type: 'message_stop' as const };
}

/**
 * Wraps an async iterable of StreamEvent to record duration (and optional tokens) on message_stop.
 */
async function* withStreamMetrics(
  source: AsyncIterable<StreamEvent>,
  provider: string,
  modelId: string
): AsyncGenerator<StreamEvent> {
  let startTime: number | null = null;
  for await (const event of source) {
    if (startTime === null) startTime = Date.now();
    yield event;
    if (event.type === 'message_stop') {
      const durationSeconds = (Date.now() - startTime) / 1000;
      recordLlmStreamMetrics(provider, modelId, durationSeconds);
    }
  }
}

/**
 * Returns an async iterable of stream events for the given provider and params.
 * Uses provider registry from @grump/ai-core when an adapter is registered; otherwise built-in streams.
 * Instrumented with llm_stream_duration_seconds and optional llm_tokens_total.
 */
export function getStream(
  params: StreamParams,
  options: { provider?: LLMProvider; modelId?: string } = {}
): AsyncIterable<StreamEvent> {
  const provider = options.provider ?? 'anthropic';
  const modelId =
    options.modelId ??
    (provider === 'zhipu'
      ? ZHIPU_DEFAULT
      : provider === 'copilot'
        ? COPILOT_DEFAULT
        : provider === 'openrouter'
          ? OPENROUTER_DEFAULT
          : provider === 'nim'
            ? NIM_DEFAULT
            : ANTHROPIC_DEFAULT);
  const merged = { ...params, model: modelId };

  const adapter = getStreamProvider(provider);
  const source: AsyncIterable<StreamEvent> = adapter
    ? adapter.stream(merged)
    : provider === 'zhipu'
      ? streamZhipu(merged)
      : provider === 'copilot'
        ? streamCopilot(merged)
        : provider === 'openrouter'
          ? streamOpenRouter(merged)
          : provider === 'nim'
            ? streamNim(merged)
            : streamAnthropic(merged);
  return withStreamMetrics(source, provider, modelId);
}

// Register built-in providers so getStreamProvider() can resolve them (optional; getStream falls back to built-in if not registered)
try {
  registerStreamProvider('anthropic', { name: 'anthropic', supportsTools: true, stream: streamAnthropic });
  registerStreamProvider('nim', { name: 'nim', supportsTools: true, stream: streamNim });
  registerStreamProvider('zhipu', { name: 'zhipu', supportsTools: false, stream: streamZhipu });
  registerStreamProvider('copilot', { name: 'copilot', supportsTools: false, stream: streamCopilot });
  registerStreamProvider('openrouter', { name: 'openrouter', supportsTools: false, stream: streamOpenRouter });
} catch {
  // ai-core may not be available in all environments
}

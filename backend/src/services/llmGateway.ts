/**
 * LLM Gateway – unified streaming client for multiple LLM providers (NIM, Zhipu, Copilot, OpenRouter).
 * Returns an async iterable of events compatible with Anthropic stream shape
 * so existing chat loop can consume any provider.
 * Uses @grump/ai-core provider registry when an adapter is registered.
 */

import { getStreamProvider, registerStreamProvider } from '@grump/ai-core';
import logger from '../middleware/logger.js';
import { recordLlmStreamMetrics } from '../middleware/metrics.js';
import { getNimChatUrl } from '../config/nim.js';

export type LLMProvider = 'nim' | 'zhipu' | 'copilot' | 'openrouter' | 'groq' | 'together' | 'ollama' | 'openai' | 'anthropic' | 'gemini';

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

const ZHIPU_DEFAULT = 'glm-4';
/** Sub-models from Copilot (Codex-style); used when provider is copilot. */
export const COPILOT_SUB_MODELS = ['copilot-codex', 'copilot-codebase'] as const;
const COPILOT_DEFAULT = 'copilot-codex';
const OPENROUTER_DEFAULT = 'openrouter/moonshotai/kimi-k2.5';
const NIM_DEFAULT = 'moonshotai/kimi-k2.5';
const GROQ_DEFAULT = 'llama-3.1-70b-versatile';
const TOGETHER_DEFAULT = 'togethercomputer/llama-3-70b';
const OLLAMA_DEFAULT = 'llama3.1';
const OPENAI_DEFAULT = 'gpt-4o';
const ANTHROPIC_DEFAULT = 'claude-sonnet-4-20250514';
const GEMINI_DEFAULT = 'gemini-2.0-flash';

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
 * Model pass-through (e.g. moonshotai/kimi-k2.5, openai/gpt-4o). Text-only; tools not mapped.
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
  const url = getNimChatUrl();
  logger.debug({ model }, '[NIM] Starting stream request');

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

  logger.debug({ messageCount: (body.messages as unknown[])?.length, hasTools: !!body.tools }, '[NIM] Sending request');
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

  let chunkCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunkCount++;
    const decoded = dec.decode(value, { stream: true });
    buf += decoded;
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
              reasoning_content?: string;
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

        // Kimi K2.5 sends content in 'content' field (primary response)
        // and chain-of-thought reasoning in 'reasoning_content' field
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: delta.content } };
        }
        // Kimi K2.5 reasoning_content is chain-of-thought, not yielded to user

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
  logger.debug({ chunkCount }, '[NIM] Stream complete');
  yield { type: 'message_stop' as const };
}

/**
 * Stream from Groq (fast inference provider). Uses GROQ_API_KEY.
 * Model: llama-3.1-70b-versatile (default). OpenAI-compatible API.
 */
async function* streamGroq(params: StreamParams): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.warn({}, 'Groq provider skipped: GROQ_API_KEY not set');
    yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: '[Groq not configured. Set GROQ_API_KEY.]' } };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || GROQ_DEFAULT;
  const url = 'https://api.groq.com/openai/v1/chat/completions';

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
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Groq API error');
    throw new Error(`Groq API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Groq: no response body');

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
 * Stream from Together AI (open source model provider). Uses TOGETHER_API_KEY.
 * Model: togethercomputer/llama-3-70b (default). OpenAI-compatible API.
 */
async function* streamTogether(params: StreamParams): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    logger.warn({}, 'Together AI provider skipped: TOGETHER_API_KEY not set');
    yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: '[Together AI not configured. Set TOGETHER_API_KEY.]' } };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || TOGETHER_DEFAULT;
  const url = 'https://api.together.xyz/v1/chat/completions';

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
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Together AI API error');
    throw new Error(`Together AI API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Together AI: no response body');

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
 * Stream from Ollama (local model runner). Uses OLLAMA_HOST (defaults to localhost:11434).
 * Model: llama3.1 (default). No API key required for local instances.
 */
async function* streamOllama(params: StreamParams): AsyncGenerator<StreamEvent> {
  const ollamaHost = process.env.OLLAMA_HOST || 'localhost:11434';
  const url = `http://${ollamaHost}/api/chat`;

  const model = params.model || OLLAMA_DEFAULT;

  const body = {
    model,
    stream: true,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    options: {
      num_predict: params.max_tokens,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const t = await res.text();
      logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Ollama API error');
      throw new Error(`Ollama API error: ${res.status} ${t.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Ollama: no response body');

    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          if (j.done) continue;
          const text = j.message?.content;
          if (typeof text === 'string' && text.length > 0) {
            yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text } };
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch failed')) {
      logger.warn({ ollamaHost }, 'Ollama connection failed - ensure Ollama is running');
      yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: `[Ollama connection failed. Ensure Ollama is running at ${ollamaHost}]` } };
      yield { type: 'message_stop' as const };
      return;
    }
    throw error;
  }
  yield { type: 'message_stop' as const };
}

/**
 * Stream from OpenAI (GPT-4o, o1, etc). Uses OPENAI_API_KEY.
 * Model: gpt-4o (default). Supports tools via function calling.
 */
async function* streamOpenAI(params: StreamParams): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn({}, 'OpenAI provider skipped: OPENAI_API_KEY not set');
    yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: '[OpenAI not configured. Set OPENAI_API_KEY.]' } };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || OPENAI_DEFAULT;
  const url = 'https://api.openai.com/v1/chat/completions';

  const body: Record<string, unknown> = {
    model,
    max_tokens: params.max_tokens,
    stream: true,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  // Add tools if provided (OpenAI function calling format)
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
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'OpenAI API error');
    throw new Error(`OpenAI API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('OpenAI: no response body');

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
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
            };
            finish_reason?: string;
          }>;
          error?: { message?: string };
        };
        if (j.error) {
          logger.warn({ error: j.error.message }, 'OpenAI stream error');
          yield { type: 'message_stop' as const };
          return;
        }
        const delta = j.choices?.[0]?.delta;
        if (!delta) continue;

        // Text content
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: delta.content } };
        }

        // Tool calls (function calling)
        const toolCalls = delta.tool_calls;
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const idx = tc.index ?? 0;
            while (toolCallsAccum.length <= idx) {
              toolCallsAccum.push({ id: '', name: '', args: '' });
            }
            const acc = toolCallsAccum[idx]!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
          }
          // Emit tool calls when we have id and name
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
 * Stream from Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, etc). Uses ANTHROPIC_API_KEY.
 * Model: claude-sonnet-4-20250514 (default). Native Anthropic streaming format.
 */
async function* streamAnthropic(params: StreamParams): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn({}, 'Anthropic provider skipped: ANTHROPIC_API_KEY not set');
    yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: '[Anthropic not configured. Set ANTHROPIC_API_KEY.]' } };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || ANTHROPIC_DEFAULT;
  const url = 'https://api.anthropic.com/v1/messages';

  // Anthropic uses a different format - system is separate, not in messages
  const body: Record<string, unknown> = {
    model,
    max_tokens: params.max_tokens,
    stream: true,
    system: params.system || '',
    messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
  };

  // Add tools if provided (Anthropic native tool format)
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.input_schema ?? { type: 'object', properties: {} },
    }));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Anthropic API error');
    throw new Error(`Anthropic API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Anthropic: no response body');

  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const event = JSON.parse(data) as {
          type: string;
          delta?: { type?: string; text?: string };
          content_block?: { type?: string; id?: string; name?: string; input?: Record<string, unknown> };
          error?: { message?: string };
        };

        // Anthropic events are already in the format we need
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: event.delta.text ?? '' } };
        } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          yield {
            type: 'content_block_start' as const,
            content_block: {
              type: 'tool_use' as const,
              id: event.content_block.id ?? '',
              name: event.content_block.name ?? '',
              input: event.content_block.input ?? {},
            },
          };
        } else if (event.type === 'message_stop') {
          yield { type: 'message_stop' as const };
          return;
        } else if (event.type === 'error') {
          logger.warn({ error: event.error?.message }, 'Anthropic stream error');
          yield { type: 'error' as const, error: event.error };
          yield { type: 'message_stop' as const };
          return;
        }
      } catch {
        // skip malformed chunk
      }
    }
  }
  yield { type: 'message_stop' as const };
}

/**
 * Stream from Google Gemini (Gemini 2.0 Flash, Pro, etc). Uses GOOGLE_API_KEY.
 * Model: gemini-2.0-flash (default). Uses Gemini's generateContent streaming endpoint.
 */
async function* streamGemini(params: StreamParams): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn({}, 'Gemini provider skipped: GOOGLE_API_KEY or GEMINI_API_KEY not set');
    yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: '[Gemini not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY.]' } };
    yield { type: 'message_stop' as const };
    return;
  }

  const model = params.model || GEMINI_DEFAULT;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  // Convert messages to Gemini format
  // Gemini uses 'user' and 'model' roles, and 'parts' instead of 'content'
  const contents = params.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: params.max_tokens,
    },
  };

  // Add system instruction if provided
  if (params.system) {
    body.systemInstruction = { parts: [{ text: params.system }] };
  }

  // Add tools if provided (Gemini function calling format)
  if (params.tools && params.tools.length > 0) {
    body.tools = [{
      functionDeclarations: params.tools.map((t) => ({
        name: t.name,
        description: t.description ?? '',
        parameters: t.input_schema ?? { type: 'object', properties: {} },
      })),
    }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Gemini API error');
    throw new Error(`Gemini API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Gemini: no response body');

  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const j = JSON.parse(data) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                text?: string;
                functionCall?: { name: string; args: Record<string, unknown> };
              }>;
            };
            finishReason?: string;
          }>;
          error?: { message?: string };
        };

        if (j.error) {
          logger.warn({ error: j.error.message }, 'Gemini stream error');
          yield { type: 'message_stop' as const };
          return;
        }

        const parts = j.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            // Text content
            if (typeof part.text === 'string' && part.text.length > 0) {
              yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: part.text } };
            }
            // Function call (tool use)
            if (part.functionCall) {
              yield {
                type: 'content_block_start' as const,
                content_block: {
                  type: 'tool_use' as const,
                  id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                  name: part.functionCall.name,
                  input: part.functionCall.args ?? {},
                },
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
  const provider = options.provider ?? 'nim';
  const modelId =
    options.modelId ??
    (provider === 'zhipu'
      ? ZHIPU_DEFAULT
      : provider === 'copilot'
        ? COPILOT_DEFAULT
        : provider === 'openrouter'
          ? OPENROUTER_DEFAULT
          : provider === 'groq'
            ? GROQ_DEFAULT
            : provider === 'together'
              ? TOGETHER_DEFAULT
              : provider === 'ollama'
                ? OLLAMA_DEFAULT
                : provider === 'openai'
                  ? OPENAI_DEFAULT
                  : provider === 'anthropic'
                    ? ANTHROPIC_DEFAULT
                    : provider === 'gemini'
                      ? GEMINI_DEFAULT
                      : NIM_DEFAULT);
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
          : provider === 'groq'
            ? streamGroq(merged)
            : provider === 'together'
              ? streamTogether(merged)
              : provider === 'ollama'
                ? streamOllama(merged)
                : provider === 'openai'
                  ? streamOpenAI(merged)
                  : provider === 'anthropic'
                    ? streamAnthropic(merged)
                    : provider === 'gemini'
                      ? streamGemini(merged)
                      : streamNim(merged);
  return withStreamMetrics(source, provider, modelId);
}

// Register built-in providers so getStreamProvider() can resolve them (optional; getStream falls back to built-in if not registered)
try {
  registerStreamProvider('nim', { name: 'nim', supportsTools: true, stream: streamNim });
  registerStreamProvider('zhipu', { name: 'zhipu', supportsTools: false, stream: streamZhipu });
  registerStreamProvider('copilot', { name: 'copilot', supportsTools: false, stream: streamCopilot });
  registerStreamProvider('openrouter', { name: 'openrouter', supportsTools: false, stream: streamOpenRouter });
  registerStreamProvider('groq', { name: 'groq', supportsTools: false, stream: streamGroq });
  registerStreamProvider('together', { name: 'together', supportsTools: false, stream: streamTogether });
  registerStreamProvider('ollama', { name: 'ollama', supportsTools: false, stream: streamOllama });
  registerStreamProvider('openai', { name: 'openai', supportsTools: true, stream: streamOpenAI });
  registerStreamProvider('anthropic', { name: 'anthropic', supportsTools: true, stream: streamAnthropic });
  registerStreamProvider('gemini', { name: 'gemini', supportsTools: true, stream: streamGemini });
} catch {
  // ai-core may not be available in all environments
}

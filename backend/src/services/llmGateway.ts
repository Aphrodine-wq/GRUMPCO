/**
 * @fileoverview Unified LLM Gateway - Multi-Provider AI Router
 *
 * Enterprise-grade AI inference with intelligent provider routing.
 * Supports: NVIDIA NIM, OpenRouter, Groq, Together AI, and Ollama.
 *
 * ## Supported Providers
 *
 * | Provider | Best For | Models |
 * |----------|----------|--------|
 * | Groq | Fast inference, simple queries | Llama 3.1/3.2, Mixtral |
 * | NVIDIA NIM | Primary, reliable | Llama 3.1 70B/405B, Nemotron |
 * | OpenRouter | Best model selection | Claude, GPT-4, Llama, etc. |
 * | Together AI | Open source, coding | Codestral, Llama, Mixtral |
 * | Ollama | Local/self-hosted | Various local models |
 *
 * ## Event Stream Format
 *
 * All streams emit events in a unified format:
 * - `content_block_delta` - Text content chunks
 * - `content_block_start` - Tool use invocations
 * - `message_stop` - End of stream
 * - `error` - Stream errors
 *
 * @module services/llmGateway
 */

import { getStreamProvider, registerStreamProvider } from '@grump/ai-core';
import logger from '../middleware/logger.js';
import { recordLlmStreamMetrics } from '../middleware/metrics.js';
import { addNimSpanAttributes } from '../middleware/tracing.js';
import { getNimChatUrl } from '../config/nim.js';
import { env, getApiKey, type ApiProvider } from '../config/env.js';

/** Supported LLM provider identifiers */
export type LLMProvider = 'nim' | 'openrouter' | 'groq' | 'together' | 'ollama' | 'mock';

/**
 * Multimodal content part for vision-capable models.
 * Supports text and image URL content in messages.
 */
export type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * Parameters for LLM streaming requests.
 * Unified format for all providers.
 */
export interface StreamParams {
  /** Model identifier (provider-specific model ID) */
  model: string;
  /** Maximum tokens to generate */
  max_tokens: number;
  /** System prompt/instructions */
  system: string;
  /** Conversation messages */
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | MultimodalContentPart[];
  }>;
  /** Optional tool definitions for function calling */
  tools?: Array<{
    name: string;
    description: string;
    input_schema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  }>;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Top-p sampling */
  top_p?: number;
}

/**
 * Unified stream event format.
 * All providers emit these event types for consistent consumption.
 */
export type StreamEvent =
  /** Text content chunk */
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } }
  /** Tool invocation start */
  | {
      type: 'content_block_start';
      content_block: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
    }
  /** End of message stream */
  | { type: 'message_stop' }
  /** Stream error */
  | { type: 'error'; error?: unknown };

// =============================================================================
// Provider Configuration
// =============================================================================

/** Provider configuration interface */
export interface ProviderConfig {
  name: LLMProvider;
  baseUrl: string;
  apiKeyEnvVar: string;
  models: string[];
  capabilities: ('streaming' | 'vision' | 'json_mode' | 'function_calling')[];
  costPer1kTokens: number;
  speedRank: number; // Lower is faster
  qualityRank: number; // Lower is better quality
  defaultModel: string;
  supportsTools: boolean;
  headers?: Record<string, string>;
}

/** Provider configurations */
export const PROVIDER_CONFIGS: Record<Exclude<LLMProvider, 'mock'>, ProviderConfig> = {
  groq: {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKeyEnvVar: 'GROQ_API_KEY',
    models: [
      'llama-3.1-8b-instant',
      'llama-3.1-70b-versatile',
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    capabilities: ['streaming', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.0001,
    speedRank: 1, // Fastest
    qualityRank: 3,
    defaultModel: 'llama-3.1-70b-versatile',
    supportsTools: true,
  },
  nim: {
    name: 'nim',
    baseUrl: getNimChatUrl(),
    apiKeyEnvVar: 'NVIDIA_NIM_API_KEY',
    models: [
      'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      'meta/llama-3.1-405b-instruct',
      'meta/llama-3.1-70b-instruct',
      'mistralai/mistral-large-2-instruct',
      'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      'mistralai/codestral-22b-instruct-v0.1',
    ],
    capabilities: ['streaming', 'vision', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.0002,
    speedRank: 2,
    qualityRank: 2,
    defaultModel: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    supportsTools: true,
  },
  openrouter: {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    models: [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-opus',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.1-405b-instruct',
      'meta-llama/llama-3.1-70b-instruct',
      'google/gemini-pro-1.5',
    ],
    capabilities: ['streaming', 'vision', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.003, // Variable, using Claude as reference
    speedRank: 3,
    qualityRank: 1, // Best quality
    defaultModel: 'anthropic/claude-3.5-sonnet',
    supportsTools: true,
    headers: {
      'HTTP-Referer': env.PUBLIC_BASE_URL || 'https://g-rump.com',
      'X-Title': 'G-Rump AI',
    },
  },
  together: {
    name: 'together',
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    apiKeyEnvVar: 'TOGETHER_API_KEY',
    models: [
      'mistralai/Codestral-22B-v0.1',
      'meta-llama/Llama-3.1-70B-Instruct-Turbo',
      'meta-llama/Llama-3.1-405B-Instruct-Turbo',
      'mistralai/Mixtral-8x22B-Instruct-v0.1',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
    ],
    capabilities: ['streaming', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.00015,
    speedRank: 4,
    qualityRank: 3,
    defaultModel: 'mistralai/Codestral-22B-v0.1',
    supportsTools: true,
  },
  ollama: {
    name: 'ollama',
    baseUrl: `${env.OLLAMA_BASE_URL}/api/chat`,
    apiKeyEnvVar: '',
    models: ['llama3.1', 'llama3.2', 'mistral', 'codellama', 'qwen2.5-coder', 'deepseek-coder'],
    capabilities: ['streaming'],
    costPer1kTokens: 0, // Local = free
    speedRank: 5,
    qualityRank: 4,
    defaultModel: 'llama3.1',
    supportsTools: false,
  },
};

// =============================================================================
// Timeout Configuration
// =============================================================================

const TIMEOUT_DEFAULT_MS = Number(process.env.LLM_TIMEOUT_DEFAULT_MS ?? 120_000);
const TIMEOUT_FAST_MS = Number(process.env.LLM_TIMEOUT_FAST_MS ?? 30_000);
const TIMEOUT_SLOW_MS = Number(process.env.LLM_TIMEOUT_SLOW_MS ?? 180_000);

function getTimeoutMs(provider: LLMProvider, maxTokens?: number): number {
  // Groq is consistently fast
  if (provider === 'groq') return TIMEOUT_FAST_MS;

  // Ollama depends on local hardware
  if (provider === 'ollama') return TIMEOUT_SLOW_MS;

  // Large token requests need more time
  if (typeof maxTokens === 'number' && maxTokens > 4096) {
    return Math.max(TIMEOUT_DEFAULT_MS, 150_000);
  }

  return TIMEOUT_DEFAULT_MS;
}

// =============================================================================
// Stream Generators for Each Provider
// =============================================================================

/**
 * Generic OpenAI-compatible stream generator.
 * Works for Groq, Together, and OpenRouter.
 */
async function* streamOpenAICompatible(
  params: StreamParams,
  provider: Exclude<LLMProvider, 'mock' | 'ollama'>
): AsyncGenerator<StreamEvent> {
  const config = PROVIDER_CONFIGS[provider];
  const apiKey = getApiKeyForProvider(provider);

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
      ...params.messages.map((m) => ({
        role: m.role,
        content:
          typeof m.content === 'string'
            ? m.content
            : (m.content as MultimodalContentPart[]).map((p) =>
                p.type === 'text'
                  ? { type: 'text' as const, text: p.text ?? '' }
                  : { type: 'image_url' as const, image_url: p.image_url }
              ),
      })),
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
    tool_count: Array.isArray(body.tools) ? body.tools.length : 0,
    stream: true,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...config.headers,
  };

  const res = await fetch(config.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn(
      { status: res.status, body: t.slice(0, 500), model, provider },
      `${provider} API error`
    );
    throw new Error(`${provider} API error: ${res.status} ${t.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error(`${provider}: no response body`);

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
              tool_calls?: Array<{
                index?: number;
                id?: string;
                name?: string;
                arguments?: string;
              }>;
            };
            finish_reason?: string;
          }>;
          error?: { message?: string };
        };
        if (j.error) {
          logger.warn({ error: j.error?.message, provider }, `${provider} stream error`);
          yield { type: 'message_stop' as const };
          return;
        }
        const choice = j.choices?.[0];
        const delta = choice?.delta;
        if (!delta) continue;

        // Content streaming
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          yield {
            type: 'content_block_delta' as const,
            delta: { type: 'text_delta' as const, text: delta.content },
          };
        }

        // Tool calls streaming
        const toolCalls = delta.tool_calls;
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const idx = tc.index ?? 0;
            while (toolCallsAccum.length <= idx) {
              toolCallsAccum.push({ id: '', name: '', args: '' });
            }
            const acc = toolCallsAccum[idx];
            if (acc && tc.id) acc.id = tc.id;
            if (acc && tc.name) acc.name = tc.name;
            if (acc && tc.arguments) acc.args += tc.arguments;
          }
          for (let i = 0; i < toolCallsAccum.length; i++) {
            if (emittedToolIndices.has(i)) continue;
            const acc = toolCallsAccum[i];
            if (acc && acc.id && acc.name) {
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
  logger.debug({ chunkCount, model, provider }, `[${provider}] Stream complete`);
  yield { type: 'message_stop' as const };
}

/**
 * Stream from NVIDIA NIM (OpenAI-compatible API).
 */
async function* streamNim(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'nim');
}

/**
 * Stream from Groq (OpenAI-compatible API).
 */
async function* streamGroq(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'groq');
}

/**
 * Stream from OpenRouter (OpenAI-compatible API).
 */
async function* streamOpenRouter(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'openrouter');
}

/**
 * Stream from Together AI (OpenAI-compatible API).
 */
async function* streamTogether(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'together');
}

/**
 * Stream from Ollama (native API).
 */
async function* streamOllama(params: StreamParams): AsyncGenerator<StreamEvent> {
  const config = PROVIDER_CONFIGS.ollama;
  const model = params.model || config.defaultModel;

  logger.debug({ model, provider: 'ollama' }, '[Ollama] Starting stream request');

  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      ...params.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : 'Image content not supported',
      })),
    ],
    stream: true,
    options: {
      num_predict: params.max_tokens,
      temperature: params.temperature ?? 0.7,
      top_p: params.top_p ?? 0.9,
    },
  };

  const timeoutMs = getTimeoutMs('ollama', params.max_tokens);

  try {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const t = await res.text();
      logger.warn({ status: res.status, body: t.slice(0, 500), model }, 'Ollama API error');
      throw new Error(`Ollama API error: ${res.status} ${t.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Ollama: no response body');

    const dec = new TextDecoder();
    let buf = '';
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
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            error?: string;
          };

          if (j.error) {
            logger.warn({ error: j.error }, 'Ollama stream error');
            yield { type: 'message_stop' as const };
            return;
          }

          if (j.message?.content) {
            yield {
              type: 'content_block_delta' as const,
              delta: { type: 'text_delta' as const, text: j.message.content },
            };
          }

          if (j.done) {
            yield { type: 'message_stop' as const };
            return;
          }
        } catch {
          // skip malformed chunk
        }
      }
    }

    logger.debug({ chunkCount, model }, '[Ollama] Stream complete');
    yield { type: 'message_stop' as const };
  } catch (error) {
    logger.warn({ error, model }, 'Ollama request failed');
    yield {
      type: 'content_block_delta' as const,
      delta: {
        type: 'text_delta' as const,
        text: `[Ollama connection failed - ensure Ollama is running at ${env.OLLAMA_BASE_URL}]`,
      },
    };
    yield { type: 'message_stop' as const };
  }
}

// =============================================================================
// Metrics Wrapper
// =============================================================================

/**
 * Wraps an async iterable of StreamEvent to record metrics on completion.
 */
async function* withStreamMetrics(
  source: AsyncIterable<StreamEvent>,
  provider: string,
  modelId: string
): AsyncGenerator<StreamEvent> {
  let startTime: number | null = null;
  let ttfbRecorded = false;
  let ttfbSeconds: number | undefined;
  let outputChars = 0;
  addNimSpanAttributes(provider, modelId);
  for await (const event of source) {
    if (startTime === null) startTime = Date.now();
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      typeof event.delta.text === 'string'
    ) {
      if (!ttfbRecorded) {
        ttfbRecorded = true;
        ttfbSeconds = (Date.now() - startTime) / 1000;
      }
      outputChars += event.delta.text.length;
    }
    yield event;
    if (event.type === 'message_stop') {
      const durationSeconds = (Date.now() - startTime) / 1000;
      const outputTokensEst = Math.round(outputChars / 4);
      const genDuration = durationSeconds - (ttfbSeconds ?? 0);
      const tokensPerSecond =
        outputTokensEst > 0 && genDuration > 0.1 ? outputTokensEst / genDuration : undefined;
      recordLlmStreamMetrics(
        provider,
        modelId,
        durationSeconds,
        undefined,
        outputTokensEst || undefined,
        ttfbSeconds,
        tokensPerSecond
      );
    }
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Returns an async iterable of stream events from the specified provider.
 *
 * @param params - Request parameters (model, messages, system prompt, tools)
 * @param options - Provider selection and model override
 * @returns Async iterable of stream events
 *
 * @example
 * ```typescript
 * // Using Groq for fast inference
 * const stream = getStream({
 *   model: 'llama-3.1-70b-versatile',
 *   max_tokens: 1024,
 *   system: 'You are a helpful assistant',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * }, { provider: 'groq' });
 *
 * // Using OpenRouter for best quality
 * const stream = getStream({
 *   model: 'anthropic/claude-3.5-sonnet',
 *   max_tokens: 2048,
 *   system: 'You are an expert software architect',
 *   messages: [{ role: 'user', content: 'Design a microservices architecture' }]
 * }, { provider: 'openrouter' });
 * ```
 */
export async function* getStream(
  params: StreamParams,
  options: { provider?: LLMProvider; modelId?: string } = {}
): AsyncGenerator<StreamEvent> {
  const provider = options.provider ?? 'nim';

  if (provider === 'mock') {
    throw new Error(
      'Mock provider is handled by mockAI service; do not call getStream with provider "mock"'
    );
  }

  const config = PROVIDER_CONFIGS[provider as Exclude<LLMProvider, 'mock'>];
  const modelId = options.modelId ?? config?.defaultModel ?? PROVIDER_CONFIGS.nim.defaultModel;
  const merged = { ...params, model: modelId };

  // Select the appropriate stream function
  let streamFn: (params: StreamParams) => AsyncGenerator<StreamEvent>;
  switch (provider) {
    case 'groq':
      streamFn = streamGroq;
      break;
    case 'openrouter':
      streamFn = streamOpenRouter;
      break;
    case 'together':
      streamFn = streamTogether;
      break;
    case 'ollama':
      streamFn = streamOllama;
      break;
    case 'nim':
    default:
      streamFn = streamNim;
      break;
  }

  const retryEnabled = process.env.LLM_RETRY_ENABLED !== 'false';

  // Lazy load streamWithRetry to avoid circular dependency
  let source: AsyncIterable<StreamEvent>;
  if (retryEnabled) {
    const { streamWithRetry } = await import('./smartRetry.js');
    source = streamWithRetry(provider, merged, async function* (p, prm) {
      for await (const event of streamFn(prm)) {
        yield event;
      }
    });
  } else {
    source = streamFn(merged);
  }

  yield* withStreamMetrics(source, provider, modelId);
}

// =============================================================================
// Provider Registration
// =============================================================================

// Register all providers with ai-core if available
try {
  registerStreamProvider('nim', { name: 'nvidia-nim', supportsTools: true, stream: streamNim });
  registerStreamProvider('groq', { name: 'groq', supportsTools: true, stream: streamGroq });
  registerStreamProvider('openrouter', {
    name: 'openrouter',
    supportsTools: true,
    stream: streamOpenRouter,
  });
  registerStreamProvider('together', {
    name: 'together',
    supportsTools: true,
    stream: streamTogether,
  });
  registerStreamProvider('ollama', { name: 'ollama', supportsTools: false, stream: streamOllama });
} catch {
  // ai-core may not be available in all environments
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Map LLM provider to env API provider key.
 */
export function toApiProvider(provider: LLMProvider): ApiProvider | null {
  switch (provider) {
    case 'nim':
      return 'nvidia_nim';
    case 'openrouter':
      return 'openrouter';
    case 'groq':
      return 'groq';
    case 'together':
      return 'together';
    case 'ollama':
      return 'ollama';
    default:
      return null;
  }
}

/**
 * Get API key for LLM provider.
 */
export function getApiKeyForProvider(provider: LLMProvider): string | undefined {
  const apiProvider = toApiProvider(provider);
  return apiProvider ? getApiKey(apiProvider) : undefined;
}

/**
 * Check if a provider is properly configured.
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  if (provider === 'mock') return true;
  if (provider === 'ollama') return Boolean(env.OLLAMA_BASE_URL);
  return Boolean(getApiKeyForProvider(provider));
}

/**
 * Get the current default model ID for a provider.
 */
export function getDefaultModelId(provider: LLMProvider = 'nim'): string {
  if (provider === 'mock') return 'mock-model';
  return (
    PROVIDER_CONFIGS[provider as Exclude<LLMProvider, 'mock'>]?.defaultModel ??
    PROVIDER_CONFIGS.nim.defaultModel
  );
}

/**
 * Get all configured providers.
 */
export function getConfiguredProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];
  if (isProviderConfigured('nim')) providers.push('nim');
  if (isProviderConfigured('groq')) providers.push('groq');
  if (isProviderConfigured('openrouter')) providers.push('openrouter');
  if (isProviderConfigured('together')) providers.push('together');
  if (isProviderConfigured('ollama')) providers.push('ollama');
  return providers;
}

/**
 * Get provider configuration.
 */
export function getProviderConfig(provider: LLMProvider): ProviderConfig | undefined {
  if (provider === 'mock') return undefined;
  return PROVIDER_CONFIGS[provider as Exclude<LLMProvider, 'mock'>];
}

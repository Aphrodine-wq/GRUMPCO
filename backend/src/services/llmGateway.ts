/**
 * @fileoverview Unified LLM Gateway - Multi-Provider AI Router
 *
 * Enterprise-grade AI inference with intelligent provider routing.
 * Supports: NVIDIA NIM, GitHub Copilot, and local development (mock).
 *
 * ## Supported Providers
 *
 * | Provider | Best For | Models |
 * |----------|----------|--------|
 * | NVIDIA NIM | Primary, reliable | Llama 3.1 70B/405B, Nemotron |
 * | GitHub Copilot | Code generation, completions | GPT-4, GPT-3.5 |
 * | Mock | Demo/exploration | Zero-config testing |
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
export type LLMProvider = 'nim' | 'github-copilot' | 'mock';

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
    speedRank: 1,
    qualityRank: 1,
    defaultModel: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    supportsTools: true,
  },
  'github-copilot': {
    name: 'github-copilot',
    baseUrl: 'https://api.githubcopilot.com/chat/completions',
    apiKeyEnvVar: 'GITHUB_COPILOT_TOKEN',
    models: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'claude-3.5-sonnet',
    ],
    capabilities: ['streaming', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.0003,
    speedRank: 2,
    qualityRank: 1,
    defaultModel: 'gpt-4',
    supportsTools: true,
    headers: {
      'Editor-Version': 'vscode/1.85.0',
      'Editor-Plugin-Version': 'copilot/1.150.0',
    },
  },
};

// =============================================================================
// Timeout Configuration
// =============================================================================

const TIMEOUT_DEFAULT_MS = Number(process.env.LLM_TIMEOUT_DEFAULT_MS ?? 120_000);
const TIMEOUT_FAST_MS = Number(process.env.LLM_TIMEOUT_FAST_MS ?? 30_000);
const TIMEOUT_SLOW_MS = Number(process.env.LLM_TIMEOUT_SLOW_MS ?? 180_000);

function getTimeoutMs(provider: LLMProvider, maxTokens?: number): number {
  // GitHub Copilot is consistently fast
  if (provider === 'github-copilot') return TIMEOUT_FAST_MS;

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
 * Works for NIM and GitHub Copilot.
 */
async function* streamOpenAICompatible(
  params: StreamParams,
  provider: Exclude<LLMProvider, 'mock'>
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
    has_tools: Boolean(body.tools),
  });

  try {
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
      logger.warn({ status: res.status, body: t.slice(0, 500), model, provider }, 'API error');
      throw new Error(`${provider} API error: ${res.status} ${t.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error(`${provider}: no response body`);

    const dec = new TextDecoder();
    let buf = '';
    let chunkCount = 0;

    // Track tool calls
    const toolCalls: Map<
      number,
      { id: string; name: string; args: string }
    > = new Map();
    const emittedToolIndices = new Set<number>();

    while (true) {
      const { done, value } = await reader.read();
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

          const delta = j.choices?.[0]?.delta;
          if (!delta) continue;

          // Text content
          if (delta.content) {
            yield {
              type: 'content_block_delta' as const,
              delta: { type: 'text_delta' as const, text: delta.content },
            };
          }

          // Tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id ?? '', name: '', args: '' });
              }
              const acc = toolCalls.get(idx)!;
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name = tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;

              // Emit once we have id + name
              if (acc.id && acc.name && !emittedToolIndices.has(idx)) {
                emittedToolIndices.add(idx);
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

/**
 * Stream from NVIDIA NIM (OpenAI-compatible API).
 */
async function* streamNim(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'nim');
}

/**
 * Stream from GitHub Copilot (OpenAI-compatible API).
 */
async function* streamGitHubCopilot(params: StreamParams): AsyncGenerator<StreamEvent> {
  yield* streamOpenAICompatible(params, 'github-copilot');
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
 * // Using NVIDIA NIM for primary inference
 * const stream = getStream({
 *   model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
 *   max_tokens: 1024,
 *   system: 'You are a helpful assistant',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * }, { provider: 'nim' });
 *
 * // Using GitHub Copilot for code generation
 * const stream = getStream({
 *   model: 'gpt-4',
 *   max_tokens: 2048,
 *   system: 'You are an expert software architect',
 *   messages: [{ role: 'user', content: 'Write a REST API in TypeScript' }]
 * }, { provider: 'github-copilot' });
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
    case 'github-copilot':
      streamFn = streamGitHubCopilot;
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
  registerStreamProvider('github-copilot', {
    name: 'github-copilot',
    supportsTools: true,
    stream: streamGitHubCopilot,
  });
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
    case 'github-copilot':
      return 'github_copilot';
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
  if (isProviderConfigured('github-copilot')) providers.push('github-copilot');
  return providers;
}

/**
 * Get provider configuration.
 */
export function getProviderConfig(provider: LLMProvider): ProviderConfig | undefined {
  if (provider === 'mock') return undefined;
  return PROVIDER_CONFIGS[provider as Exclude<LLMProvider, 'mock'>];
}

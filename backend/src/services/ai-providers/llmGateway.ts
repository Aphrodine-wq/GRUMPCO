/**
 * @fileoverview Unified LLM Gateway - Multi-Provider AI Router
 *
 * Enterprise-grade AI inference with intelligent provider routing.
 * This is the main entry point that re-exports types from sub-modules
 * and provides the dispatcher, G-CompN1 router, metrics, and utilities.
 *
 * ## Supported Providers
 *
 * | Provider | Best For | Models |
 * |----------|----------|--------|
 * | NVIDIA NIM | Primary, reliable | Llama 3.1 70B/405B, Nemotron, Kimi K2.5 |
 * | Anthropic | Claude models | Claude 3.5 Sonnet, Opus 4.6 |
 * | OpenRouter | Best model selection | Claude, GPT-4, Llama, etc. |
 * | Ollama | Local/self-hosted | Various local models |
 *
 * @module services/ai-providers/llmGateway
 */

import { providerRacing } from './providerRacing.js';
import { registerStreamProvider } from '@grump/ai-core';
import logger from '../../middleware/logger.js';
import { recordLlmStreamMetrics } from '../../middleware/metrics.js';
import { addNimSpanAttributes } from '../../middleware/tracing.js';
import { getApiKey, type ApiProvider } from '../../config/env.js';
import { env } from '../../config/env.js';
import { getApiKey as getStoredApiKey } from '../security/secretsService.js';
import type { IntegrationProviderId } from '../../types/integrations.js';

// Re-export all types for backward compatibility — no consumer import changes needed
export type {
  LLMProvider,
  MultimodalContentPart,
  StreamParams,
  StreamEvent,
  ProviderConfig,
} from './llmGatewayTypes.js';
export { PROVIDER_CONFIGS, getTimeoutMs } from './llmGatewayTypes.js';
import type { LLMProvider, StreamParams, StreamEvent } from './llmGatewayTypes.js';
import { PROVIDER_CONFIGS } from './llmGatewayTypes.js';

// Import stream generators from sub-modules
import {
  streamNim,
  streamOpenRouter,
  streamGoogle,
  streamGithubCopilot,
  streamAnthropic,
} from './llmGatewayStreams.js';
import { streamOllama } from './llmGatewayLocal.js';

// =============================================================================
// Ollama Reachability Cache
// =============================================================================

/** Cached Ollama reachability. Updated by models.ts and ollama.ts live probes. */
let _ollamaReachable: boolean | null = null;
let _ollamaReachableAt = 0;
const OLLAMA_CACHE_TTL = 30_000; // 30 seconds

/**
 * Set Ollama reachability from a live probe result.
 * Called by models route and ollama status route after pinging Ollama.
 */
export function setOllamaReachable(reachable: boolean): void {
  _ollamaReachable = reachable;
  _ollamaReachableAt = Date.now();
}

// =============================================================================
// G-CompN1 (G-Rump Model Mix) Smart Router
// =============================================================================

/**
 * Classify query complexity for G-CompN1 routing.
 * Returns: "quality" (→ Opus 4.6), "fast" (→ Flash/Nemotron), or "balanced" (→ Sonnet 4.5).
 *
 * SPEED BIAS: Defaults to "balanced" which uses fast agentic models.
 * Only truly complex queries use the slow quality tier.
 */
function classifyGrumpQuery(params: StreamParams): 'quality' | 'fast' | 'balanced' {
  // Check explicit model preference
  const model = params.model || 'g-compn1-auto';
  if (model === 'g-compn1-quality') return 'quality';
  if (model === 'g-compn1-fast') return 'fast';
  if (model === 'g-compn1-balanced') return 'balanced';

  // Auto-classify based on content analysis
  const lastMsg = params.messages[params.messages.length - 1];
  const content =
    typeof lastMsg?.content === 'string'
      ? lastMsg.content
      : Array.isArray(lastMsg?.content)
        ? (lastMsg.content as Array<{ type: string; text?: string }>)
            .filter((p) => p.type === 'text')
            .map((p) => p.text ?? '')
            .join(' ')
        : '';

  const wordCount = content.split(/\s+/).length;
  const hasCode = /```|function\s|class\s|import\s|const\s|let\s|var\s|def\s|async\s/.test(content);
  const hasComplexReasoning =
    /explain|analyze|why|how does|compare|evaluate|design|architect|refactor|debug|optimize/i.test(
      content
    );
  // SPEED: Widened "fast" threshold to 60 words — most simple queries/follow-ups route here
  const isSimpleQuery = wordCount < 60 && !hasCode && !hasComplexReasoning;
  // SPEED: Raised "quality" bar — only massive complex requests use the heavy model
  const isComplexQuery =
    (wordCount > 200 && hasComplexReasoning && hasCode) ||
    (params.tools?.length && params.tools.length > 5);

  // Route based on complexity — bias toward speed
  if (isComplexQuery) return 'quality'; // Opus 4.6 for genuinely hard problems only
  if (isSimpleQuery) return 'fast'; // Flash/Nemotron for cheap, quick answers
  return 'balanced'; // Sonnet 4.5 for everything else
}

/**
 * G-CompN1 Model Mix: Smart routing between Opus 4.6 and Kimi K2.5.
 * Optimizes for cost while maintaining high quality.
 */
async function* streamGrumpMix(params: StreamParams): AsyncGenerator<StreamEvent> {
  const tier = classifyGrumpQuery(params);

  logger.info({ tier, model: params.model }, '[G-CompN1] Routing query');

  // Route to sub-provider based on classification
  let subProvider: LLMProvider;
  let subModel: string;

  switch (tier) {
    case 'quality':
      // Anthropic Opus 4.6 — best reasoning, highest quality
      if (isProviderConfigured('anthropic')) {
        subProvider = 'anthropic';
        subModel = 'claude-opus-4-6-20260206';
      } else if (isProviderConfigured('openrouter')) {
        subProvider = 'openrouter';
        subModel = 'anthropic/claude-sonnet-4.5';
      } else {
        subProvider = 'nim';
        subModel = 'nvidia/llama-3.1-nemotron-ultra-253b-v1';
      }
      break;

    case 'fast':
      // Gemini 2.5 Flash — fast reasoning with thinking budgets
      if (isProviderConfigured('google')) {
        subProvider = 'google';
        subModel = 'gemini-2.5-flash';
      } else if (isProviderConfigured('nim')) {
        subProvider = 'nim';
        subModel = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
      } else {
        subProvider = 'anthropic';
        subModel = 'claude-3-haiku-20240307';
      }
      break;

    case 'balanced':
    default:
      // Claude Sonnet 4.5 — best agentic coding model, balanced cost/quality
      if (isProviderConfigured('anthropic')) {
        subProvider = 'anthropic';
        subModel = 'claude-sonnet-4-5-20250929';
      } else if (isProviderConfigured('google')) {
        subProvider = 'google';
        subModel = 'gemini-2.5-pro';
      } else if (isProviderConfigured('openrouter')) {
        subProvider = 'openrouter';
        subModel = 'anthropic/claude-sonnet-4.5';
      } else if (isProviderConfigured('nim')) {
        subProvider = 'nim';
        subModel = 'moonshotai/kimi-k2.5';
      } else {
        subProvider = 'openrouter';
        subModel = 'anthropic/claude-sonnet-4.5';
      }
      break;
  }

  logger.info({ tier, subProvider, subModel }, '[G-CompN1] Dispatching to sub-provider');

  // Emit routing context event
  yield {
    type: 'content_block_delta' as const,
    delta: { type: 'text_delta' as const, text: '' }, // Empty delta to signal start
  };

  // Delegate to the resolved sub-provider
  const subParams = { ...params, model: subModel };
  const subStream = getStream(subParams, { provider: subProvider, modelId: subModel });
  yield* withStreamMetrics(subStream, `grump:${subProvider}`, subModel);
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

/** Cached smartRetry module to avoid per-request dynamic import overhead */
let _smartRetryModule: typeof import('./smartRetry.js') | null = null;

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
 * // Using Anthropic for code generation
 * const stream = getStream({
 *   model: 'claude-sonnet-4-20250514',
 *   max_tokens: 2048,
 *   system: 'You are an expert software architect',
 *   messages: [{ role: 'user', content: 'Write a REST API in TypeScript' }]
 * }, { provider: 'anthropic' });
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
    case 'openrouter':
      streamFn = streamOpenRouter;
      break;
    case 'ollama':
      streamFn = streamOllama;
      break;
    case 'google':
      streamFn = streamGoogle;
      break;
    case 'github_copilot':
      streamFn = streamGithubCopilot;
      break;
    case 'anthropic':
      streamFn = streamAnthropic;
      break;

    case 'grump':
      // G-CompN1 meta-provider: route to sub-provider based on complexity
      yield* streamGrumpMix(merged);
      return;
    case 'nim':
    default:
      streamFn = streamNim;
      break;
  }

  const retryEnabled = process.env.LLM_RETRY_ENABLED !== 'false';

  // Use cached smartRetry module to avoid per-request dynamic import overhead
  let source: AsyncIterable<StreamEvent>;
  if (retryEnabled) {
    if (!_smartRetryModule) {
      _smartRetryModule = await import('./smartRetry.js');
    }
    source = _smartRetryModule.streamWithRetry(provider, merged, async function* (p, prm) {
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
  registerStreamProvider('nim', {
    name: 'nvidia-nim',
    supportsTools: true,
    stream: streamNim as any,
  });
  registerStreamProvider('openrouter', {
    name: 'openrouter',
    supportsTools: true,
    stream: streamOpenRouter as any,
  });
  registerStreamProvider('ollama', {
    name: 'ollama',
    supportsTools: true,
    stream: streamOllama as any,
  });
  registerStreamProvider('anthropic', {
    name: 'anthropic',
    supportsTools: true,
    stream: streamAnthropic as any,
  });
  registerStreamProvider('google', {
    name: 'google',
    supportsTools: true,
    stream: streamGoogle as any,
  });
  registerStreamProvider('github_copilot', {
    name: 'github_copilot',
    supportsTools: true,
    stream: streamGithubCopilot as any,
  });

  registerStreamProvider('grump', {
    name: 'grump',
    supportsTools: true,
    stream: async function* (params: any) {
      yield* streamGrumpMix(params);
    },
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
    case 'openrouter':
      return 'openrouter';
    case 'ollama':
      return 'ollama';
    case 'anthropic':
      return 'anthropic';
    case 'google':
    case 'github_copilot':
      return null; // Removed as standalone ApiProviders in v2.1
    case 'grump':
      return null; // meta-provider, no direct API key
    default:
      return null;
  }
}

/** LLM providers that can have user-stored keys (same id as IntegrationProviderId). */
const USER_STORED_PROVIDERS: readonly LLMProvider[] = [
  'anthropic',
  'openrouter',
  'google',
] as const;

/**
 * In-memory cache of providers confirmed to have user-stored API keys.
 * Populated by getApiKeyForProviderAsync when a key is found, and by
 * refreshProviderCache at startup. Allows the sync isProviderConfigured()
 * to detect user-stored keys without an async call.
 */
const _cachedUserProviders: Set<string> = new Set();

/**
 * Get API key for LLM provider. When userId is provided, checks user-stored key first, then env.
 */
export async function getApiKeyForProviderAsync(
  provider: LLMProvider,
  userId?: string
): Promise<string | undefined> {
  if (userId && USER_STORED_PROVIDERS.includes(provider)) {
    try {
      const key = await getStoredApiKey(userId, provider as IntegrationProviderId);
      if (key) {
        _cachedUserProviders.add(provider);
        return key;
      }
    } catch {
      // fall through to env
    }
  }
  const apiProvider = toApiProvider(provider);
  return apiProvider ? getApiKey(apiProvider) : undefined;
}

/**
 * Prime the user-stored provider cache by checking all USER_STORED_PROVIDERS.
 * Call during server startup (or after a key is stored via the API) so that
 * the sync isProviderConfigured() returns correct results without waiting
 * for the first stream request.
 */
export async function refreshProviderCache(userId: string = 'default'): Promise<void> {
  for (const provider of USER_STORED_PROVIDERS) {
    try {
      const key = await getStoredApiKey(userId, provider as IntegrationProviderId);
      if (key) {
        _cachedUserProviders.add(provider);
      }
    } catch {
      // skip
    }
  }
  logger.info({ cached: [..._cachedUserProviders] }, 'User-stored provider cache refreshed');
}

/**
 * Notify the cache that a provider has a user-stored key (call after storeApiKey).
 */
export function markProviderConfigured(provider: string): void {
  _cachedUserProviders.add(provider);
}

/**
 * Get API key for LLM provider (sync; env only). Use getApiKeyForProviderAsync when userId is available.
 */
export function getApiKeyForProvider(provider: LLMProvider, userId?: string): string | undefined {
  const apiProvider = toApiProvider(provider);
  return apiProvider ? getApiKey(apiProvider) : undefined;
}

/**
 * Check if a provider is properly configured.
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  if (provider === 'mock') return true;
  if (provider === 'ollama') {
    // Use cached probe result if fresh (within TTL)
    if (_ollamaReachable !== null && Date.now() - _ollamaReachableAt < OLLAMA_CACHE_TTL) {
      return _ollamaReachable;
    }
    // Fall back to env check (defaults to http://localhost:11434)
    return Boolean(env.OLLAMA_BASE_URL);
  }
  if (provider === 'grump') {
    // G-CompN1 is configured if at least one sub-provider is configured
    return (
      isProviderConfigured('anthropic') ||
      isProviderConfigured('nim') ||
      isProviderConfigured('google')
    );
  }
  // Check env var first, then fall back to user-stored key cache
  return Boolean(getApiKeyForProvider(provider)) || _cachedUserProviders.has(provider);
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
  if (isProviderConfigured('grump')) providers.push('grump'); // G-CompN1 first
  if (isProviderConfigured('nim')) providers.push('nim');
  if (isProviderConfigured('anthropic')) providers.push('anthropic');
  if (isProviderConfigured('google')) providers.push('google');
  if (isProviderConfigured('openrouter')) providers.push('openrouter');
  if (isProviderConfigured('ollama')) providers.push('ollama');
  if (isProviderConfigured('github_copilot')) providers.push('github_copilot');
  return providers;
}

/**
 * Get provider configuration.
 */
export function getProviderConfig(
  provider: LLMProvider
): import('./llmGatewayTypes.js').ProviderConfig | undefined {
  if (provider === 'mock') return undefined;
  return PROVIDER_CONFIGS[provider as Exclude<LLMProvider, 'mock'>];
}

/**
 * Get the raw stream generator for a provider (no metrics/retries wrapper)
 */
export function getStreamForProvider(
  provider: LLMProvider,
  params: StreamParams
): AsyncGenerator<StreamEvent> {
  switch (provider) {
    case 'openrouter':
      return streamOpenRouter(params);
    case 'ollama':
      return streamOllama(params);
    case 'google':
      return streamGoogle(params);
    case 'github_copilot':
      return streamGithubCopilot(params);
    case 'anthropic':
      return streamAnthropic(params);

    case 'grump':
      return streamGrumpMix(params);
    case 'nim':
    default:
      return streamNim(params);
  }
}

/**
 * Race multiple providers for the fastest response
 */
export async function* raceStream(
  candidates: LLMProvider[],
  params: StreamParams
): AsyncGenerator<StreamEvent> {
  // Use the racing service
  const raceResult = await providerRacing.race(candidates, params, (provider, p) =>
    getStreamForProvider(provider, p)
  );

  // Yield from the winning stream
  yield* raceResult.stream;
}

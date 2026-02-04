/**
 * @fileoverview Intelligent Model Router
 *
 * Routes requests to the optimal AI provider based on:
 * - Request type (fast inference vs quality)
 * - Cost optimization
 * - Fallback chain
 * - User preference
 *
 * Provider Priority:
 * 1. Groq - Fastest, cheapest for simple tasks
 * 2. NIM - Primary, reliable
 * 3. OpenRouter - Best model selection
 * 4. Together - Open source models, coding
 * 5. Ollama - Local/self-hosted (enterprise)
 *
 * @module services/modelRouter
 */

import logger from '../middleware/logger.js';
import { env } from '../config/env.js';
import {
  type LLMProvider,
  type StreamParams,
  type StreamEvent,
  getStream,
  getConfiguredProviders,
  getProviderConfig,
  PROVIDER_CONFIGS,
} from './llmGateway.js';

// =============================================================================
// Types & Interfaces
// =============================================================================

/** Request type classification */
export type RequestType = 'simple' | 'complex' | 'coding' | 'vision' | 'creative' | 'default';

/** Routing decision result */
export interface RoutingDecision {
  provider: LLMProvider;
  model: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: 'fast' | 'medium' | 'slow';
  fallbackChain: LLMProvider[];
}

/** Router options */
export interface RouterOptions {
  /** Force a specific provider */
  provider?: LLMProvider;
  /** Force a specific model */
  model?: string;
  /** Prefer speed over quality */
  preferSpeed?: boolean;
  /** Prefer quality over cost */
  preferQuality?: boolean;
  /** Request type hint */
  requestType?: RequestType;
  /** Maximum budget in dollars (per 1k tokens) */
  maxBudget?: number;
  /** Whether function calling is required */
  requiresTools?: boolean;
  /** Whether vision/multimodal is required */
  requiresVision?: boolean;
  /** User preference from settings */
  userPreference?: LLMProvider;
}

/** Provider ranking for different criteria */
interface ProviderRanking {
  speed: LLMProvider[];
  quality: LLMProvider[];
  cost: LLMProvider[];
  coding: LLMProvider[];
}

// =============================================================================
// Provider Rankings
// =============================================================================

/** Provider rankings by different criteria (only configured providers) */
const PROVIDER_RANKINGS: ProviderRanking = {
  speed: ['groq', 'nim', 'together', 'openrouter', 'ollama'],
  quality: ['openrouter', 'nim', 'together', 'groq', 'ollama'],
  cost: ['ollama', 'groq', 'together', 'nim', 'openrouter'],
  coding: ['together', 'nim', 'groq', 'openrouter', 'ollama'],
};

/** Default model mappings by request type */
const DEFAULT_MODELS: Record<RequestType, Record<LLMProvider, string>> = {
  simple: {
    groq: 'llama-3.1-8b-instant',
    nim: 'meta/llama-3.1-70b-instruct',
    openrouter: 'meta-llama/llama-3.1-70b-instruct',
    together: 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
    ollama: 'llama3.1',
    mock: 'mock-model',
  },
  complex: {
    groq: 'llama-3.1-70b-versatile',
    nim: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    openrouter: 'anthropic/claude-3.5-sonnet',
    together: 'meta-llama/Llama-3.1-405B-Instruct-Turbo',
    ollama: 'llama3.1',
    mock: 'mock-model',
  },
  coding: {
    groq: 'llama-3.1-70b-versatile',
    nim: 'mistralai/codestral-22b-instruct-v0.1',
    openrouter: 'anthropic/claude-3.5-sonnet',
    together: 'mistralai/Codestral-22B-v0.1',
    ollama: 'codellama',
    mock: 'mock-model',
  },
  vision: {
    groq: 'llama-3.2-90b-vision-preview',
    nim: 'meta/llama-3.1-70b-instruct',
    openrouter: 'openai/gpt-4o',
    together: 'meta-llama/Llama-3.2-90B-Vision-Instruct',
    ollama: 'llava',
    mock: 'mock-model',
  },
  creative: {
    groq: 'llama-3.1-70b-versatile',
    nim: 'meta/llama-3.1-405b-instruct',
    openrouter: 'anthropic/claude-3-opus',
    together: 'meta-llama/Llama-3.1-405B-Instruct-Turbo',
    ollama: 'llama3.1',
    mock: 'mock-model',
  },
  default: {
    groq: 'llama-3.1-70b-versatile',
    nim: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    openrouter: 'anthropic/claude-3.5-sonnet',
    together: 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
    ollama: 'llama3.1',
    mock: 'mock-model',
  },
};

// =============================================================================
// Request Classification
// =============================================================================

/**
 * Classify a request based on its content and parameters.
 */
export function classifyRequest(params: StreamParams): RequestType {
  const content = params.messages
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join(' ')
    .toLowerCase();

  // Check for vision content
  const hasImages = params.messages.some(
    (m) => typeof m.content !== 'string' && m.content.some((p) => p.type === 'image_url')
  );
  if (hasImages) return 'vision';

  // Check for coding tasks
  const codingKeywords = [
    'code',
    'function',
    'implement',
    'program',
    'script',
    'algorithm',
    'bug',
    'debug',
    'refactor',
    'typescript',
    'javascript',
    'python',
    'rust',
    'go',
    'java',
    'class',
    'interface',
    'api',
    'endpoint',
    'database',
    'sql',
    'query',
  ];
  const isCoding = codingKeywords.some((kw) => content.includes(kw));

  // Check for simple queries (short, straightforward questions)
  const isShort = content.length < 200;
  const isQuestion = content.includes('?') && isShort;
  const simpleKeywords = ['what', 'who', 'when', 'where', 'how', 'is', 'are', 'can', 'does'];
  const isSimple = isQuestion && simpleKeywords.some((kw) => content.includes(kw));

  // Check for creative writing
  const creativeKeywords = ['write', 'story', 'poem', 'creative', 'imagine', 'fiction', 'novel'];
  const isCreative = creativeKeywords.some((kw) => content.includes(kw));

  // Check for complex tasks
  const complexKeywords = [
    'architecture',
    'design',
    'analyze',
    'compare',
    'evaluate',
    'recommend',
    'strategy',
    'plan',
    'review',
  ];
  const isComplex = complexKeywords.some((kw) => content.includes(kw)) || content.length > 1000;

  if (isCoding) return 'coding';
  if (isCreative) return 'creative';
  if (isComplex) return 'complex';
  if (isSimple) return 'simple';
  return 'default';
}

// =============================================================================
// Routing Logic
// =============================================================================

/**
 * Get filtered rankings based on configured providers.
 */
function getFilteredRankings(): ProviderRanking {
  const configured = new Set(getConfiguredProviders());

  return {
    speed: PROVIDER_RANKINGS.speed.filter((p) => configured.has(p)),
    quality: PROVIDER_RANKINGS.quality.filter((p) => configured.has(p)),
    cost: PROVIDER_RANKINGS.cost.filter((p) => configured.has(p)),
    coding: PROVIDER_RANKINGS.coding.filter((p) => configured.has(p)),
  };
}

/**
 * Select the best provider based on routing criteria.
 */
function selectProvider(
  rankings: ProviderRanking,
  options: RouterOptions,
  requestType: RequestType
): { provider: LLMProvider; reason: string } {
  // If user explicitly requested a provider, respect it
  if (options.provider) {
    return { provider: options.provider, reason: 'User-specified provider' };
  }

  // If user has a preference, respect it
  if (options.userPreference) {
    return { provider: options.userPreference, reason: 'User preference from settings' };
  }

  // Route based on request type and preferences
  let candidates: LLMProvider[] = [];

  switch (requestType) {
    case 'simple':
      // Simple queries -> fastest provider
      candidates = options.preferQuality ? rankings.quality : rankings.speed;
      return {
        provider: candidates[0] ?? 'nim',
        reason: 'Simple query routed to fast provider',
      };

    case 'coding':
      // Coding tasks -> Together (Codestral) or user's preference
      candidates = options.preferSpeed ? rankings.speed : rankings.coding;
      return {
        provider: candidates[0] ?? 'together',
        reason: 'Coding task routed to coding-optimized provider',
      };

    case 'complex':
      // Complex tasks -> OpenRouter (Claude) or NIM
      candidates = options.preferQuality ? rankings.quality : rankings.speed;
      return {
        provider: candidates[0] ?? 'openrouter',
        reason: 'Complex task routed to high-quality provider',
      };

    case 'vision':
      // Vision tasks -> need vision-capable provider
      candidates = ['groq', 'openrouter', 'together', 'nim'].filter((p) =>
        rankings.quality.includes(p as LLMProvider)
      ) as LLMProvider[];
      return {
        provider: candidates[0] ?? 'openrouter',
        reason: 'Vision task routed to vision-capable provider',
      };

    case 'creative':
      // Creative tasks -> quality provider
      candidates = options.preferQuality ? rankings.quality : rankings.speed;
      return {
        provider: candidates[0] ?? 'openrouter',
        reason: 'Creative task routed to quality provider',
      };

    case 'default':
    default:
      // Default -> balance of speed and quality
      if (options.preferSpeed) {
        return { provider: rankings.speed[0] ?? 'nim', reason: 'Speed preference' };
      }
      if (options.preferQuality) {
        return { provider: rankings.quality[0] ?? 'openrouter', reason: 'Quality preference' };
      }
      // Use NIM as balanced default
      return { provider: 'nim', reason: 'Balanced default provider' };
  }
}

/**
 * Build fallback chain for a primary provider.
 */
function buildFallbackChain(
  primary: LLMProvider,
  rankings: ProviderRanking,
  requestType: RequestType
): LLMProvider[] {
  let candidates: LLMProvider[] = [];

  switch (requestType) {
    case 'simple':
      candidates = rankings.speed;
      break;
    case 'coding':
      candidates = rankings.coding;
      break;
    case 'complex':
    case 'creative':
      candidates = rankings.quality;
      break;
    default:
      candidates = [...rankings.speed, ...rankings.quality];
  }

  // Remove primary and deduplicate
  const chain = candidates.filter((p, i, arr) => p !== primary && arr.indexOf(p) === i);
  return chain.slice(0, 3); // Max 3 fallbacks
}

// =============================================================================
// Main Router
// =============================================================================

/**
 * Make a routing decision for a request.
 */
export function makeRoutingDecision(
  params: StreamParams,
  options: RouterOptions = {}
): RoutingDecision {
  const rankings = getFilteredRankings();
  const requestType = options.requestType ?? classifyRequest(params);

  const { provider, reason } = selectProvider(rankings, options, requestType);
  const model = options.model ?? DEFAULT_MODELS[requestType][provider];
  const config = getProviderConfig(provider);

  const fallbackChain = buildFallbackChain(provider, rankings, requestType);

  // Estimate cost and latency
  const estimatedCost = config?.costPer1kTokens ?? 0.0002;
  const estimatedLatency: 'fast' | 'medium' | 'slow' =
    provider === 'groq' ? 'fast' : provider === 'ollama' ? 'slow' : 'medium';

  return {
    provider,
    model,
    reason,
    estimatedCost,
    estimatedLatency,
    fallbackChain,
  };
}

/**
 * Stream with intelligent routing.
 *
 * @param params - Request parameters
 * @param options - Routing options
 * @returns Async iterable of stream events
 *
 * @example
 * ```typescript
 * // Simple query -> routed to Groq
 * const stream = routeAndStream({
 *   messages: [{ role: 'user', content: 'What is 2+2?' }],
 *   max_tokens: 100,
 *   system: 'Be concise'
 * });
 *
 * // Coding task -> routed to Together (Codestral)
 * const stream = routeAndStream({
 *   messages: [{ role: 'user', content: 'Write a sorting function' }],
 *   max_tokens: 500,
 *   system: 'You are a coding assistant'
 * });
 * ```
 */
export async function* routeAndStream(
  params: StreamParams,
  options: RouterOptions = {}
): AsyncGenerator<StreamEvent> {
  // Check if multi-provider routing is enabled
  if (!env.MULTI_PROVIDER_ROUTING) {
    // Fall back to NIM-only mode
    logger.debug('Multi-provider routing disabled, using NIM');
    yield* getStream(params, { provider: 'nim', modelId: options.model });
    return;
  }

  const decision = makeRoutingDecision(params, options);

  logger.info(
    {
      provider: decision.provider,
      model: decision.model,
      reason: decision.reason,
      requestType: options.requestType ?? classifyRequest(params),
      estimatedCost: decision.estimatedCost,
      estimatedLatency: decision.estimatedLatency,
    },
    'Routing decision made'
  );

  let currentProvider = decision.provider;
  const attemptedProviders: LLMProvider[] = [];

  while (currentProvider) {
    attemptedProviders.push(currentProvider);

    try {
      logger.debug({ provider: currentProvider }, 'Attempting stream');
      const stream = getStream(params, { provider: currentProvider, modelId: decision.model });

      for await (const event of stream) {
        yield event;
      }

      logger.info({ provider: currentProvider }, 'Stream completed successfully');
      return;
    } catch (error) {
      logger.warn(
        {
          provider: currentProvider,
          error: (error as Error).message,
          attempted: attemptedProviders,
        },
        'Provider failed, trying fallback'
      );

      // Find next fallback
      const nextFallback = decision.fallbackChain.find((p) => !attemptedProviders.includes(p));

      if (!nextFallback) {
        // No more fallbacks
        yield {
          type: 'error',
          error: `All providers failed. Attempted: ${attemptedProviders.join(', ')}`,
        };
        yield { type: 'message_stop' };
        return;
      }

      currentProvider = nextFallback;

      // Add a small delay before fallback
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/**
 * Get routing statistics and health.
 */
export function getRouterStatus(): {
  configured: LLMProvider[];
  enabled: boolean;
  rankings: ProviderRanking;
} {
  return {
    configured: getConfiguredProviders(),
    enabled: env.MULTI_PROVIDER_ROUTING,
    rankings: getFilteredRankings(),
  };
}

/**
 * Pre-warm the router by checking provider connectivity.
 */
/**
 * Simple route function for basic routing
 * Returns the routing decision with provider and modelId
 */
export function route(params: {
  messages?: StreamParams['messages'];
  model?: string;
  max_tokens?: number;
  system?: string;
  messageCount?: number;
  messageChars?: number;
  mode?: string;
  toolsRequested?: boolean;
  multimodal?: boolean;
  preferNim?: boolean;
  maxLatencyMs?: number;
  sessionType?: string;
  modelPreference?: { source?: 'cloud' | 'auto'; provider?: string; modelId?: string };
}): { provider: LLMProvider; modelId: string } {
  const decision = makeRoutingDecision(params as StreamParams);
  return {
    provider: decision.provider,
    modelId: decision.model,
  };
}

/**
 * Get the best model for RAG operations
 */
export function getRAGModel(): string {
  // Default to a fast, capable embedding model
  const config = getProviderConfig('nim');
  return config?.models.find((m) => m.includes('embed')) || 'nvidia/nv-embedqa-e5-v5';
}

export async function warmRouter(): Promise<void> {
  const providers = getConfiguredProviders();
  logger.info({ providers }, 'Warming router');

  // Quick connectivity check (non-blocking)
  for (const provider of providers) {
    const config = getProviderConfig(provider);
    if (!config) continue;

    try {
      // Simple health check - just verify we can reach the endpoint
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      await fetch(config.baseUrl.replace('/chat/completions', '/models'), {
        method: 'GET',
        headers: config.apiKeyEnvVar
          ? { Authorization: `Bearer ${process.env[config.apiKeyEnvVar]}` }
          : {},
        signal: controller.signal,
      }).catch(() => {
        // Non-fatal, just log
      });

      clearTimeout(timeout);
    } catch {
      // Ignore errors during warming
    }
  }

  logger.info('Router warming complete');
}

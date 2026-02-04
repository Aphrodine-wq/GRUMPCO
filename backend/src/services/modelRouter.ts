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
 * 1. NIM - Primary, reliable, high performance
 * 2. GitHub Copilot - Code generation specialist
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
  speed: ['nim', 'github-copilot'],
  quality: ['nim', 'github-copilot'],
  cost: ['nim', 'github-copilot'],
  coding: ['github-copilot', 'nim'],
};

/** Default model mappings by request type */
const DEFAULT_MODELS: Record<RequestType, Record<LLMProvider, string>> = {
  simple: {
    nim: 'meta/llama-3.1-70b-instruct',
    'github-copilot': 'gpt-3.5-turbo',
    mock: 'mock-model',
  },
  complex: {
    nim: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    'github-copilot': 'gpt-4',
    mock: 'mock-model',
  },
  coding: {
    nim: 'mistralai/codestral-22b-instruct-v0.1',
    'github-copilot': 'gpt-4',
    mock: 'mock-model',
  },
  vision: {
    nim: 'meta/llama-3.1-70b-instruct',
    'github-copilot': 'gpt-4',
    mock: 'mock-model',
  },
  creative: {
    nim: 'meta/llama-3.1-405b-instruct',
    'github-copilot': 'gpt-4',
    mock: 'mock-model',
  },
  default: {
    nim: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    'github-copilot': 'gpt-4',
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
  const content = JSON.stringify(params.messages).toLowerCase();

  // Vision requests
  if (params.messages.some((m) => Array.isArray(m.content))) {
    return 'vision';
  }

  // Coding requests
  if (
    content.includes('code') ||
    content.includes('function') ||
    content.includes('implement') ||
    content.includes('debug') ||
    content.includes('refactor') ||
    content.includes('typescript') ||
    content.includes('javascript') ||
    content.includes('python')
  ) {
    return 'coding';
  }

  // Creative requests
  if (
    content.includes('creative') ||
    content.includes('story') ||
    content.includes('poem') ||
    content.includes('imagine')
  ) {
    return 'creative';
  }

  // Complex requests (long prompts, tool use)
  if (content.length > 2000 || params.tools) {
    return 'complex';
  }

  // Simple requests
  if (content.length < 500) {
    return 'simple';
  }

  return 'default';
}

// =============================================================================
// Provider Selection
// =============================================================================

/**
 * Select the best provider based on request type and options.
 */
export function selectProvider(
  requestType: RequestType,
  options: RouterOptions = {}
): RoutingDecision {
  // Force provider if specified
  if (options.provider) {
    const config = getProviderConfig(options.provider);
    const model = options.model || DEFAULT_MODELS[requestType][options.provider];
    return {
      provider: options.provider,
      model,
      reason: 'User-specified provider',
      estimatedCost: config?.costPer1kTokens ?? 0,
      estimatedLatency: options.provider === 'nim' ? 'fast' : 'medium',
      fallbackChain: [options.provider],
    };
  }

  // User preference
  if (options.userPreference) {
    const config = getProviderConfig(options.userPreference);
    const model = options.model || DEFAULT_MODELS[requestType][options.userPreference];
    return {
      provider: options.userPreference,
      model,
      reason: 'User preference from settings',
      estimatedCost: config?.costPer1kTokens ?? 0,
      estimatedLatency: options.userPreference === 'nim' ? 'fast' : 'medium',
      fallbackChain: [options.userPreference, 'nim'],
    };
  }

  // Coding requests prefer GitHub Copilot
  if (requestType === 'coding' && !options.preferSpeed) {
    const provider: LLMProvider = 'github-copilot';
    const model = options.model || DEFAULT_MODELS.coding[provider];
    return {
      provider,
      model,
      reason: 'GitHub Copilot optimized for code generation',
      estimatedCost: PROVIDER_CONFIGS[provider].costPer1kTokens,
      estimatedLatency: 'medium',
      fallbackChain: ['github-copilot', 'nim'],
    };
  }

  // Default to NIM for all other cases
  const provider: LLMProvider = 'nim';
  const model = options.model || DEFAULT_MODELS[requestType][provider];
  return {
    provider,
    model,
    reason: 'NVIDIA NIM - Primary provider for balanced performance',
    estimatedCost: PROVIDER_CONFIGS[provider].costPer1kTokens,
    estimatedLatency: 'fast',
    fallbackChain: ['nim', 'github-copilot'],
  };
}

// =============================================================================
// Main Router Function
// =============================================================================

/**
 * Route a request to the optimal provider and return a stream.
 *
 * @param params - Stream parameters
 * @param options - Router options
 * @returns Async generator of stream events
 *
 * @example
 * ```typescript
 * // Simple query -> routed to NIM
 * const stream = routeStream({
 *   model: '',
 *   max_tokens: 1024,
 *   system: 'You are helpful',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 *
 * // Coding query -> routed to GitHub Copilot
 * const stream = routeStream({
 *   model: '',
 *   max_tokens: 2048,
 *   system: 'You are a coding assistant',
 *   messages: [{ role: 'user', content: 'Write a TypeScript function' }]
 * }, { requestType: 'coding' });
 * ```
 */
export async function* routeStream(
  params: StreamParams,
  options: RouterOptions = {}
): AsyncGenerator<StreamEvent> {
  const requestType = options.requestType ?? classifyRequest(params);
  const decision = selectProvider(requestType, options);

  logger.info(
    {
      provider: decision.provider,
      model: decision.model,
      requestType,
      reason: decision.reason,
    },
    'Routing request'
  );

  yield* getStream(params, {
    provider: decision.provider,
    modelId: decision.model,
  });
}

/**
 * Get routing decision without executing the stream.
 */
export function getRoutingDecision(
  params: StreamParams,
  options: RouterOptions = {}
): RoutingDecision {
  const requestType = options.requestType ?? classifyRequest(params);
  return selectProvider(requestType, options);
}

/**
 * Get available providers for a specific request type.
 */
export function getAvailableProviders(requestType: RequestType): LLMProvider[] {
  const configured = getConfiguredProviders();
  return configured.filter((p) => p !== 'mock');
}

/**
 * Estimate cost for a request.
 */
export function estimateCost(
  provider: LLMProvider,
  inputTokens: number,
  outputTokens: number
): number {
  const config = getProviderConfig(provider);
  if (!config) return 0;
  return ((inputTokens + outputTokens) / 1000) * config.costPer1kTokens;
}

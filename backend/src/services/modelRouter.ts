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
 * 2. Anthropic - Best quality (Claude)
 * 3. OpenRouter - Best model selection
 * 4. GitHub Copilot - Code generation specialist
 * 5. Mistral AI - European, multilingual
 * 6. Kimi K2.5 - Long context specialist
 * 7. Ollama - Local/self-hosted (enterprise)
 *
 * @module services/modelRouter
 */

import logger from "../middleware/logger.js";
import { env } from "../config/env.js";
import {
  type LLMProvider,
  type StreamParams,
  type StreamEvent,
  getStream,
  getConfiguredProviders,
  getProviderConfig,
  PROVIDER_CONFIGS,
} from "./llmGateway.js";

// =============================================================================
// Types & Interfaces
// =============================================================================

/** Request type classification */
export type RequestType =
  | "simple"
  | "complex"
  | "coding"
  | "vision"
  | "creative"
  | "long-context"
  | "default";

/** Routing decision result */
export interface RoutingDecision {
  provider: LLMProvider;
  model: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: "fast" | "medium" | "slow";
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
  longContext: LLMProvider[];
}

// =============================================================================
// Provider Rankings
// =============================================================================

/** Provider rankings by different criteria (only configured providers) */
const PROVIDER_RANKINGS: ProviderRanking = {
  speed: [
    "nim",
    "kimi",
    "github-copilot",
    "mistral",
    "anthropic",
    "openrouter",
    "ollama",
  ],
  quality: [
    "anthropic",
    "openrouter",
    "nim",
    "mistral",
    "github-copilot",
    "kimi",
    "ollama",
  ],
  cost: [
    "ollama",
    "nim",
    "kimi",
    "mistral",
    "github-copilot",
    "openrouter",
    "anthropic",
  ],
  coding: [
    "github-copilot",
    "mistral",
    "anthropic",
    "nim",
    "openrouter",
    "kimi",
    "ollama",
  ],
  longContext: [
    "kimi",
    "anthropic",
    "nim",
    "openrouter",
    "mistral",
    "github-copilot",
    "ollama",
  ],
};

/** Default model mappings by request type */
const DEFAULT_MODELS: Record<RequestType, Record<LLMProvider, string>> = {
  simple: {
    nim: "meta/llama-3.1-70b-instruct",
    openrouter: "meta-llama/llama-3.1-70b-instruct",
    ollama: "llama3.1",
    "github-copilot": "gpt-3.5-turbo",
    kimi: "moonshot-v1-8k",
    anthropic: "claude-3-haiku-20240307",
    mistral: "mistral-small-latest",
    groq: "llama-3.1-70b-versatile",
    mock: "mock-model",
  },
  complex: {
    nim: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    openrouter: "anthropic/claude-3.5-sonnet",
    ollama: "llama3.1",
    "github-copilot": "gpt-4",
    kimi: "moonshot-v1-32k",
    anthropic: "claude-3-5-sonnet-20241022",
    mistral: "mistral-large-latest",
    groq: "llama-3.1-70b-versatile",
    mock: "mock-model",
  },
  coding: {
    nim: "mistralai/codestral-22b-instruct-v0.1",
    openrouter: "anthropic/claude-3.5-sonnet",
    ollama: "codellama",
    "github-copilot": "gpt-4",
    kimi: "moonshot-v1-32k",
    anthropic: "claude-3-5-sonnet-20241022",
    mistral: "codestral-latest",
    groq: "llama-3.1-70b-versatile",
    mock: "mock-model",
  },
  vision: {
    nim: "meta/llama-3.1-70b-instruct",
    openrouter: "openai/gpt-4o",
    ollama: "llava",
    "github-copilot": "gpt-4",
    kimi: "moonshot-v1-32k",
    anthropic: "claude-3-5-sonnet-20241022",
    mistral: "mistral-large-latest",
    groq: "llama-3.2-90b-vision-preview",
    mock: "mock-model",
  },
  creative: {
    nim: "meta/llama-3.1-405b-instruct",
    openrouter: "anthropic/claude-3-opus",
    ollama: "llama3.1",
    "github-copilot": "gpt-4",
    kimi: "moonshot-v1-128k",
    anthropic: "claude-3-opus-20240229",
    mistral: "mistral-large-latest",
    groq: "llama-3.1-70b-versatile",
    mock: "mock-model",
  },
  "long-context": {
    nim: "meta/llama-3.1-405b-instruct",
    openrouter: "anthropic/claude-3.5-sonnet",
    ollama: "llama3.1",
    "github-copilot": "gpt-4",
    kimi: "moonshot-v1-128k",
    anthropic: "claude-3-5-sonnet-20241022",
    mistral: "mistral-large-latest",
    groq: "llama-3.1-70b-versatile",
    mock: "mock-model",
  },
  default: {
    nim: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    openrouter: "anthropic/claude-3.5-sonnet",
    ollama: "llama3.1",
    "github-copilot": "gpt-4",
    kimi: "moonshot-v1-32k",
    anthropic: "claude-3-5-sonnet-20241022",
    mistral: "mistral-large-latest",
    groq: "llama-3.1-70b-versatile",
    mock: "mock-model",
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
    return "vision";
  }

  // Long context requests (very long prompts)
  if (content.length > 10000) {
    return "long-context";
  }

  // Coding requests
  if (
    content.includes("code") ||
    content.includes("function") ||
    content.includes("implement") ||
    content.includes("debug") ||
    content.includes("refactor") ||
    content.includes("typescript") ||
    content.includes("javascript") ||
    content.includes("python") ||
    content.includes("api") ||
    content.includes("class")
  ) {
    return "coding";
  }

  // Creative requests
  if (
    content.includes("creative") ||
    content.includes("story") ||
    content.includes("poem") ||
    content.includes("imagine") ||
    content.includes("write")
  ) {
    return "creative";
  }

  // Complex requests (long prompts, tool use)
  if (content.length > 2000 || params.tools) {
    return "complex";
  }

  // Simple requests
  if (content.length < 500) {
    return "simple";
  }

  return "default";
}

// =============================================================================
// Provider Selection
// =============================================================================

/**
 * Select the best provider based on request type and options.
 */
export function selectProvider(
  requestType: RequestType,
  options: RouterOptions = {},
): RoutingDecision {
  // Force provider if specified
  if (options.provider) {
    const config = getProviderConfig(options.provider);
    const model =
      options.model || DEFAULT_MODELS[requestType][options.provider];
    return {
      provider: options.provider,
      model,
      reason: "User-specified provider",
      estimatedCost: config?.costPer1kTokens ?? 0,
      estimatedLatency: getLatencyEstimate(options.provider),
      fallbackChain: [options.provider],
    };
  }

  // User preference
  if (options.userPreference) {
    const config = getProviderConfig(options.userPreference);
    const model =
      options.model || DEFAULT_MODELS[requestType][options.userPreference];
    return {
      provider: options.userPreference,
      model,
      reason: "User preference from settings",
      estimatedCost: config?.costPer1kTokens ?? 0,
      estimatedLatency: getLatencyEstimate(options.userPreference),
      fallbackChain: [options.userPreference, "nim", "openrouter"],
    };
  }

  // Coding requests prefer GitHub Copilot or Mistral
  if (requestType === "coding") {
    const provider: LLMProvider = "github-copilot";
    const model = options.model || DEFAULT_MODELS.coding[provider];
    return {
      provider,
      model,
      reason: "GitHub Copilot optimized for code generation",
      estimatedCost: PROVIDER_CONFIGS[provider].costPer1kTokens,
      estimatedLatency: "fast",
      fallbackChain: ["github-copilot", "mistral", "anthropic", "nim"],
    };
  }

  // Long context requests prefer Kimi
  if (requestType === "long-context") {
    const provider: LLMProvider = "kimi";
    const model = options.model || DEFAULT_MODELS["long-context"][provider];
    return {
      provider,
      model,
      reason: "Kimi K2.5 optimized for long context (128k tokens)",
      estimatedCost: PROVIDER_CONFIGS[provider].costPer1kTokens,
      estimatedLatency: "medium",
      fallbackChain: ["kimi", "anthropic", "nim", "openrouter"],
    };
  }

  // Quality-focused requests prefer Anthropic
  if (options.preferQuality || requestType === "creative") {
    const provider: LLMProvider = "anthropic";
    const model = options.model || DEFAULT_MODELS[requestType][provider];
    return {
      provider,
      model,
      reason: "Anthropic Claude - Best quality and reasoning",
      estimatedCost: PROVIDER_CONFIGS[provider].costPer1kTokens,
      estimatedLatency: "medium",
      fallbackChain: ["anthropic", "openrouter", "nim", "mistral"],
    };
  }

  // Speed-focused requests prefer NIM
  if (options.preferSpeed) {
    const provider: LLMProvider = "nim";
    const model = options.model || DEFAULT_MODELS[requestType][provider];
    return {
      provider,
      model,
      reason: "NVIDIA NIM - Fastest inference",
      estimatedCost: PROVIDER_CONFIGS[provider].costPer1kTokens,
      estimatedLatency: "fast",
      fallbackChain: ["nim", "kimi", "mistral", "openrouter"],
    };
  }

  // Default to NIM for balanced performance
  const provider: LLMProvider = "nim";
  const model = options.model || DEFAULT_MODELS[requestType][provider];
  return {
    provider,
    model,
    reason: "NVIDIA NIM - Primary provider for balanced performance",
    estimatedCost: PROVIDER_CONFIGS[provider].costPer1kTokens,
    estimatedLatency: "fast",
    fallbackChain: ["nim", "anthropic", "openrouter", "mistral"],
  };
}

/**
 * Get estimated latency for a provider.
 */
function getLatencyEstimate(provider: LLMProvider): "fast" | "medium" | "slow" {
  const config = getProviderConfig(provider);
  if (!config) return "medium";

  if (config.speedRank <= 2) return "fast";
  if (config.speedRank <= 4) return "medium";
  return "slow";
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
 *
 * // Long document -> routed to Kimi
 * const stream = routeStream({
 *   model: '',
 *   max_tokens: 4096,
 *   system: 'Analyze this document',
 *   messages: [{ role: 'user', content: veryLongDocument }]
 * }, { requestType: 'long-context' });
 * ```
 */
export async function* routeStream(
  params: StreamParams,
  options: RouterOptions = {},
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
    "Routing request",
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
  options: RouterOptions = {},
): RoutingDecision {
  const requestType = options.requestType ?? classifyRequest(params);
  return selectProvider(requestType, options);
}

/**
 * Get available providers for a specific request type.
 */
export function getAvailableProviders(requestType: RequestType): LLMProvider[] {
  const configured = getConfiguredProviders();
  return configured.filter((p) => p !== "mock");
}

/**
 * Estimate cost for a request.
 */
export function estimateCost(
  provider: LLMProvider,
  inputTokens: number,
  outputTokens: number,
): number {
  const config = getProviderConfig(provider);
  if (!config) return 0;
  return ((inputTokens + outputTokens) / 1000) * config.costPer1kTokens;
}

/**
 * Get recommended provider for a specific use case.
 */
export function getRecommendedProvider(
  useCase: "speed" | "quality" | "cost" | "coding" | "long-context",
): LLMProvider {
  const configured = getConfiguredProviders();

  switch (useCase) {
    case "speed":
      return (
        configured.find((p) => PROVIDER_RANKINGS.speed.includes(p)) ?? "nim"
      );
    case "quality":
      return (
        configured.find((p) => PROVIDER_RANKINGS.quality.includes(p)) ??
        "anthropic"
      );
    case "cost":
      return (
        configured.find((p) => PROVIDER_RANKINGS.cost.includes(p)) ?? "ollama"
      );
    case "coding":
      return (
        configured.find((p) => PROVIDER_RANKINGS.coding.includes(p)) ??
        "github-copilot"
      );
    case "long-context":
      return (
        configured.find((p) => PROVIDER_RANKINGS.longContext.includes(p)) ??
        "kimi"
      );
    default:
      return "nim";
  }
}

// =============================================================================
// Backward Compatibility / Legacy
// =============================================================================

/**
 * Route request using legacy parameters (used by chat.ts).
 */
export function route(params: {
  messageChars: number;
  messageCount: number;
  mode: string;
  toolsRequested: boolean;
  multimodal?: boolean;
  preferNim?: boolean;
  maxLatencyMs?: number;
  sessionType?: string;
  modelPreference?: { source?: "cloud" | "auto"; provider?: string; modelId?: string };
}): { provider: string; modelId: string; reason?: string } {
  // Map legacy params to new RouterOptions
  const options: RouterOptions = {
    preferSpeed: params.mode === 'simple', // rough mapping
    requiresTools: params.toolsRequested,
    requiresVision: params.multimodal || false,
    userPreference: params.modelPreference?.provider as LLMProvider | undefined,
    model: params.modelPreference?.modelId,
  };

  if (params.preferNim) {
    options.provider = 'nim';
  }

  // Determine request type based on mode/params if possible
  let requestType: RequestType = 'default';
  if (params.multimodal) requestType = 'vision';
  else if (params.mode === 'coding') requestType = 'coding';
  else if (params.messageChars > 10000) requestType = 'long-context';
  else if (params.mode === 'complex') requestType = 'complex';
  else if (params.mode === 'simple') requestType = 'simple';

  const decision = selectProvider(requestType, options);

  return {
    provider: decision.provider,
    modelId: decision.model,
    reason: decision.reason
  };
}

/**
 * Get the best RAG model (used by ragService.ts).
 */
export function getRAGModel(): { provider: LLMProvider; modelId: string } {
  // Favor long-context providers for RAG
  const provider = getRecommendedProvider("long-context");
  const model = DEFAULT_MODELS["long-context"][provider];
  return { provider, modelId: model };
}

/**
 * Model Registry – Multi-Provider
 * 
 * Registry of AI models across all supported providers:
 * NVIDIA NIM, Anthropic, Google, GitHub Copilot, OpenRouter, Ollama.
 * 
 * All models listed here support function/tool calling.
 * Models without tool-call support have been removed to prevent
 * API errors.
 * 
 * @see https://build.nvidia.com - NVIDIA NIM
 * @see https://docs.anthropic.com - Anthropic
 * @see https://aistudio.google.com - Google AI
 */

export type LLMProvider = 'nim' | 'anthropic' | 'google' | 'openrouter' | 'github_copilot' | 'ollama' | 'mock';

export type ModelCapability =
  | 'code'
  | 'vision'
  | 'voice'
  | 'agent'
  | 'long-context'
  | 'tools'
  | 'embedding'
  | 'multilingual'
  | 'reasoning'
  | 'multimodal'
  | 'agentic'
  | 'function-calling';

/** Provider display metadata for UI (icons, labels) */
export interface ProviderMetadata {
  displayName: string;
  icon: string;
  description?: string;
}

export const PROVIDER_METADATA: Record<LLMProvider, ProviderMetadata> = {
  nim: {
    displayName: 'NVIDIA NIM',
    icon: '/icons/providers/nvidia.svg',
    description: 'Powered by NVIDIA NIM - Enterprise AI inference',
  },
  anthropic: {
    displayName: 'Anthropic',
    icon: '/icons/providers/anthropic.svg',
    description: 'Claude models - Best-in-class reasoning',
  },
  google: {
    displayName: 'Google AI',
    icon: '/icons/providers/google.svg',
    description: 'Gemini models - Balanced cost/quality',
  },
  openrouter: {
    displayName: 'OpenRouter',
    icon: '/icons/providers/openrouter.svg',
    description: 'Multi-model gateway - Access any model',
  },
  github_copilot: {
    displayName: 'GitHub Copilot',
    icon: '/icons/providers/github.svg',
    description: 'GitHub Copilot - OAuth-based AI assistant',
  },
  ollama: {
    displayName: 'Ollama',
    icon: '/icons/providers/ollama.svg',
    description: 'Local/self-hosted models',
  },
  mock: {
    displayName: 'Demo Mode',
    icon: '/icons/providers/mock.svg',
    description: 'Zero-config exploration mode',
  },
};

export interface ModelConfig {
  id: string;
  provider: LLMProvider;
  capabilities: ModelCapability[];
  contextWindow: number;
  costPerMillionInput?: number;
  costPerMillionOutput?: number;
  description?: string;
  publisher?: string;
  parameters?: string;
  featured?: boolean;
}

// Primary model: Nemotron Super 49B - NVIDIA flagship for demos and agentic use
export const DEFAULT_MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
export const DEFAULT_PROVIDER: LLMProvider = 'nim';

export const MODEL_REGISTRY: ModelConfig[] = [
  // =============================================================================
  // MOCK: Demo/Exploration Mode (zero-config, no API keys)
  // =============================================================================
  {
    id: 'mock-ai',
    provider: 'mock',
    capabilities: [
      'code',
      'vision',
      'agent',
      'long-context',
      'multilingual',
      'reasoning',
      'multimodal',
      'agentic',
      'function-calling',
    ],
    contextWindow: 128_000,
    costPerMillionInput: 0,
    costPerMillionOutput: 0,
    description: 'Demo mode for zero-config exploration - no API keys required',
    publisher: 'G-Rump',
    parameters: 'Demo',
  },

  // =============================================================================
  // NVIDIA NIM - Powered by NVIDIA AI Infrastructure
  // =============================================================================

  // FLAGSHIP: Llama 3.1 405B Instruct
  {
    id: 'meta/llama-3.1-405b-instruct',
    provider: 'nim',
    capabilities: [
      'code',
      'agent',
      'long-context',
      'multilingual',
      'reasoning',
      'agentic',
      'function-calling',
    ],
    contextWindow: 128_000,
    costPerMillionInput: 5.0,
    costPerMillionOutput: 15.0,
    description: 'Flagship 405B parameter model - Best-in-class reasoning and code generation',
    publisher: 'Meta',
    parameters: '405B',
    featured: true,
  },

  // BALANCED: Llama 3.1 70B Instruct
  {
    id: 'meta/llama-3.1-70b-instruct',
    provider: 'nim',
    capabilities: [
      'code',
      'agent',
      'long-context',
      'multilingual',
      'reasoning',
      'agentic',
      'function-calling',
    ],
    contextWindow: 128_000,
    costPerMillionInput: 0.35,
    costPerMillionOutput: 0.40,
    description: 'Excellent balance of performance and cost - Recommended for most tasks',
    publisher: 'Meta',
    parameters: '70B',
    featured: true,
  },

  // MISTRAL: Large 2 (Multilingual Excellence)
  {
    id: 'mistralai/mistral-large-2-instruct',
    provider: 'nim',
    capabilities: [
      'code',
      'agent',
      'long-context',
      'multilingual',
      'reasoning',
      'agentic',
      'function-calling',
    ],
    contextWindow: 128_000,
    costPerMillionInput: 2.0,
    costPerMillionOutput: 6.0,
    description: 'Mistral Large 2 - Superior multilingual and code capabilities',
    publisher: 'Mistral AI',
    parameters: '123B',
    featured: true,
  },

  // MIXTRAL 8x22B removed — does not support tool calling on NVIDIA NIM
  // (NIM returns error 400: "auto" tool choice requires --enable-auto-tool-choice)

  // NEMOTRON: Ultra 253B (Scientific Reasoning)
  {
    id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    provider: 'nim',
    capabilities: [
      'code',
      'reasoning',
      'function-calling',
      'agentic',
      'long-context',
    ],
    contextWindow: 128_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
    description: 'NVIDIA Nemotron Ultra - Superior scientific and complex reasoning',
    publisher: 'NVIDIA',
    parameters: '253B',
    featured: true,
  },

  // NEMOTRON: 70B (Reasoning Optimized)
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    provider: 'nim',
    capabilities: [
      'code',
      'reasoning',
      'function-calling',
      'agentic',
    ],
    contextWindow: 128_000,
    costPerMillionInput: 0.35,
    costPerMillionOutput: 0.40,
    description: 'NVIDIA Nemotron 70B - Optimized for reasoning tasks',
    publisher: 'NVIDIA',
    parameters: '70B',
  },

  // NEMOTRON: 3 Nano 30B A3B (1M context, RAG / long-context)
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    provider: 'nim',
    capabilities: [
      'code',
      'reasoning',
      'function-calling',
      'long-context',
      'agentic',
    ],
    contextWindow: 1_000_000,
    costPerMillionInput: 0.25,
    costPerMillionOutput: 0.25,
    description: 'Nemotron 3 Nano - 1M context for RAG and long documents',
    publisher: 'NVIDIA',
    parameters: '30B (A3B active)',
    featured: true,
  },

  // NEMOTRON: Super 49B v1.5 (Agentic / default chat)
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    provider: 'nim',
    capabilities: [
      'code',
      'reasoning',
      'function-calling',
      'agentic',
      'long-context',
    ],
    contextWindow: 128_000,
    costPerMillionInput: 0.20,
    costPerMillionOutput: 0.20,
    description: 'Nemotron Super 49B - Agentic workflows and balanced performance',
    publisher: 'NVIDIA',
    parameters: '49B',
    featured: true,
  },

  // NEMOTRON Nano 12B v2 VL removed — vision-only model, does not support tool calling on NIM

  // CODESTRAL: Code Generation Specialist
  {
    id: 'mistralai/codestral-22b-instruct-v0.1',
    provider: 'nim',
    capabilities: [
      'code',
      'function-calling',
    ],
    contextWindow: 32_768,
    costPerMillionInput: 0.2,
    costPerMillionOutput: 0.6,
    description: 'Codestral - Specialized for code generation and completion',
    publisher: 'Mistral AI',
    parameters: '22B',
  },

  // LLAMA 3.3 70B (Latest)
  {
    id: 'meta/llama-3.3-70b-instruct',
    provider: 'nim',
    capabilities: [
      'code',
      'agent',
      'long-context',
      'multilingual',
      'reasoning',
      'agentic',
      'function-calling',
    ],
    contextWindow: 128_000,
    costPerMillionInput: 0.35,
    costPerMillionOutput: 0.40,
    description: 'Latest Llama 3.3 70B - Improved instruction following',
    publisher: 'Meta',
    parameters: '70B',
  },
];

// =============================================================================
// ANTHROPIC - Claude Models
// =============================================================================

const ANTHROPIC_MODELS: ModelConfig[] = [
  {
    id: 'claude-opus-4-6-20260206',
    provider: 'anthropic',
    capabilities: ['code', 'reasoning', 'agent', 'long-context', 'agentic', 'function-calling', 'vision'],
    contextWindow: 1_000_000,
    costPerMillionInput: 15.0,
    costPerMillionOutput: 75.0,
    description: 'Claude Opus 4.6 - State-of-the-art reasoning, 1M context (beta)',
    publisher: 'Anthropic',
    parameters: 'Opus',
    featured: true,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    capabilities: ['code', 'vision', 'reasoning', 'agent', 'long-context', 'agentic', 'function-calling'],
    contextWindow: 200_000,
    costPerMillionInput: 3.0,
    costPerMillionOutput: 15.0,
    description: 'Claude Sonnet 4.5 - Best agentic coding model, 64K output',
    publisher: 'Anthropic',
    parameters: 'Sonnet 4.5',
    featured: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    capabilities: ['code', 'vision', 'reasoning', 'agent', 'long-context', 'function-calling'],
    contextWindow: 200_000,
    costPerMillionInput: 3.0,
    costPerMillionOutput: 15.0,
    description: 'Claude 3.5 Sonnet - Proven, reliable general purpose model',
    publisher: 'Anthropic',
    parameters: 'Sonnet 3.5',
  },
  {
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    capabilities: ['code', 'vision', 'function-calling'],
    contextWindow: 200_000,
    costPerMillionInput: 0.25,
    costPerMillionOutput: 1.25,
    description: 'Claude 3 Haiku - Fast and cost-effective',
    publisher: 'Anthropic',
    parameters: 'Haiku',
  },
];

// =============================================================================
// GOOGLE AI - Gemini Models
// =============================================================================

const GOOGLE_MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    capabilities: ['code', 'vision', 'reasoning', 'long-context', 'function-calling', 'multimodal', 'agentic'],
    contextWindow: 10_000_000,
    costPerMillionInput: 1.25,
    costPerMillionOutput: 10.0,
    description: 'Gemini 2.5 Pro - Best Gemini reasoning model, 10M+ context',
    publisher: 'Google',
    parameters: '2.5 Pro',
    featured: true,
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    capabilities: ['code', 'vision', 'reasoning', 'long-context', 'function-calling', 'multimodal', 'agentic'],
    contextWindow: 1_000_000,
    costPerMillionInput: 0.075,
    costPerMillionOutput: 0.30,
    description: 'Gemini 2.5 Flash - Fast reasoning with thinking budgets',
    publisher: 'Google',
    parameters: '2.5 Flash',
    featured: true,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'google',
    capabilities: ['code', 'vision', 'reasoning', 'long-context', 'function-calling', 'multimodal'],
    contextWindow: 1_000_000,
    costPerMillionInput: 0.075,
    costPerMillionOutput: 0.30,
    description: 'Gemini 2.0 Flash - Fast, cost-effective multimodal',
    publisher: 'Google',
    parameters: '2.0 Flash',
  },
];

// =============================================================================
// OPENROUTER - Multi-Model Gateway (latest frontier models)
// =============================================================================

const OPENROUTER_MODELS: ModelConfig[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    provider: 'openrouter',
    capabilities: ['code', 'vision', 'reasoning', 'agent', 'long-context', 'agentic', 'function-calling'],
    contextWindow: 200_000,
    costPerMillionInput: 3.0,
    costPerMillionOutput: 15.0,
    description: 'Claude Sonnet 4.5 via OpenRouter - Best agentic coding model',
    publisher: 'Anthropic',
    parameters: 'Sonnet 4.5',
    featured: true,
  },
  {
    id: 'openai/gpt-5',
    provider: 'openrouter',
    capabilities: ['code', 'vision', 'reasoning', 'agent', 'long-context', 'agentic', 'function-calling', 'multimodal'],
    contextWindow: 400_000,
    costPerMillionInput: 5.0,
    costPerMillionOutput: 15.0,
    description: 'GPT-5 via OpenRouter - Advanced reasoning and agentic tasks',
    publisher: 'OpenAI',
    parameters: 'GPT-5',
    featured: true,
  },
  {
    id: 'google/gemini-2.5-pro',
    provider: 'openrouter',
    capabilities: ['code', 'vision', 'reasoning', 'long-context', 'function-calling', 'multimodal', 'agentic'],
    contextWindow: 10_000_000,
    costPerMillionInput: 1.25,
    costPerMillionOutput: 10.0,
    description: 'Gemini 2.5 Pro via OpenRouter - 10M+ context window',
    publisher: 'Google',
    parameters: '2.5 Pro',
  },
];

// =============================================================================
// GITHUB COPILOT - OAuth-Based Models
// =============================================================================

const GITHUB_COPILOT_MODELS: ModelConfig[] = [
  {
    id: 'claude-sonnet-4.5',
    provider: 'github_copilot',
    capabilities: ['code', 'vision', 'reasoning', 'agent', 'agentic', 'function-calling'],
    contextWindow: 200_000,
    costPerMillionInput: 0,
    costPerMillionOutput: 0,
    description: 'Claude Sonnet 4.5 via GitHub Copilot',
    publisher: 'Anthropic',
    parameters: 'Sonnet 4.5',
    featured: true,
  },
  {
    id: 'gpt-5',
    provider: 'github_copilot',
    capabilities: ['code', 'vision', 'reasoning', 'agent', 'agentic', 'function-calling'],
    contextWindow: 400_000,
    costPerMillionInput: 0,
    costPerMillionOutput: 0,
    description: 'GPT-5 via GitHub Copilot',
    publisher: 'OpenAI',
    parameters: 'GPT-5',
    featured: true,
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'github_copilot',
    capabilities: ['code', 'vision', 'reasoning', 'long-context', 'function-calling'],
    contextWindow: 10_000_000,
    costPerMillionInput: 0,
    costPerMillionOutput: 0,
    description: 'Gemini 2.5 Pro via GitHub Copilot',
    publisher: 'Google',
    parameters: '2.5 Pro',
  },
];

// Combine all model registries
export const FULL_MODEL_REGISTRY: ModelConfig[] = [
  ...MODEL_REGISTRY,
  ...ANTHROPIC_MODELS,
  ...GOOGLE_MODELS,
  ...OPENROUTER_MODELS,
  ...GITHUB_COPILOT_MODELS,
];

// =============================================================================
// Model Lookup Functions
// =============================================================================

export function getModelById(id: string): ModelConfig | undefined {
  return FULL_MODEL_REGISTRY.find((m) => m.id === id);
}

export function getDefaultModel(): ModelConfig {
  return getModelById(DEFAULT_MODEL) || MODEL_REGISTRY[1]; // Fallback to first NIM model
}

export function getModelsByCapability(cap: ModelCapability): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.capabilities.includes(cap));
}

export function getModelsByProvider(provider: LLMProvider): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.provider === provider);
}

export function getFeaturedModels(): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.featured === true);
}

export function getMultilingualModels(): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.capabilities.includes('multilingual'));
}

export function getCheapestModel(): ModelConfig {
  const nimModels = MODEL_REGISTRY.filter((m) => m.provider === 'nim');
  return nimModels.reduce((cheapest, model) => {
    const modelCost = (model.costPerMillionInput || 0) + (model.costPerMillionOutput || 0);
    const cheapestCost = (cheapest.costPerMillionInput || 0) + (cheapest.costPerMillionOutput || 0);
    return modelCost < cheapestCost ? model : cheapest;
  });
}

export function getLargestContextModel(): ModelConfig {
  return FULL_MODEL_REGISTRY.reduce((largest, model) =>
    model.contextWindow > largest.contextWindow ? model : largest
  );
}

export function getNvidiaModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.provider === 'nim');
}

export function getCodeModels(): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.capabilities.includes('code'));
}

export function getReasoningModels(): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.capabilities.includes('reasoning'));
}

export function getAgenticModels(): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.capabilities.includes('agentic'));
}

export function getVisionModels(): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter(
    (m) => m.capabilities.includes('vision') || m.capabilities.includes('multimodal')
  );
}

export function getLongContextModels(minContext: number = 100_000): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.contextWindow >= minContext);
}

export function getModelsByPublisher(publisher: string): ModelConfig[] {
  return FULL_MODEL_REGISTRY.filter((m) => m.publisher?.toLowerCase() === publisher.toLowerCase());
}

export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): { usd: number; breakdown: string } {
  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found in registry`);
  }

  const inputCost = inputTokens * ((model.costPerMillionInput || 0) / 1_000_000);
  const outputCost = outputTokens * ((model.costPerMillionOutput || 0) / 1_000_000);
  const total = inputCost + outputCost;

  return {
    usd: total,
    breakdown: `${model.id}: ${inputTokens} input + ${outputTokens} output tokens`,
  };
}

// =============================================================================
// NVIDIA NIM Specific Helpers
// =============================================================================

/**
 * Get the recommended model for a specific use case.
 * All models are powered by NVIDIA NIM.
 */
export function getRecommendedModel(
  useCase: 'general' | 'code' | 'reasoning' | 'cost-optimized' | 'multilingual'
): ModelConfig {
  switch (useCase) {
    case 'general':
      return getModelById('claude-sonnet-4-5-20250929') || getModelById('meta/llama-3.1-405b-instruct') || getDefaultModel();
    case 'code':
      return getModelById('claude-sonnet-4-5-20250929') || getModelById('mistralai/codestral-22b-instruct-v0.1') || getDefaultModel();
    case 'reasoning':
      return getModelById('claude-opus-4-6-20260206') || getModelById('nvidia/llama-3.1-nemotron-ultra-253b-v1') || getDefaultModel();
    case 'cost-optimized':
      return getModelById('nvidia/llama-3.3-nemotron-super-49b-v1.5') || getCheapestModel();
    case 'multilingual':
      return getModelById('mistralai/mistral-large-2-instruct') || getDefaultModel();
    default:
      return getDefaultModel();
  }
}

/**
 * Check if NVIDIA NIM is the only provider (no longer true — multi-provider supported).
 */
export function isNvidiaExclusive(): boolean {
  return false;
}

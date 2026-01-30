/**
 * Model registry – capability and cost metadata for LLM models.
 * 
 * Kimi K2.5 is the primary model, with alternatives available via
 * various providers (NIM, OpenRouter, Zhipu, Copilot).
 */

export type LLMProvider = 'nim' | 'zhipu' | 'copilot' | 'openrouter';

export type ModelCapability = 'code' | 'vision' | 'voice' | 'agent' | 'long-context' | 'tools' | 'embedding' | 'multilingual';

export interface ModelConfig {
  id: string;
  provider: LLMProvider;
  capabilities: ModelCapability[];
  contextWindow: number;
  costPerMillionInput?: number;
  costPerMillionOutput?: number;
  description?: string;
}

export const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';
export const DEFAULT_PROVIDER: LLMProvider = 'nim';

export const MODEL_REGISTRY: ModelConfig[] = [
  // PRIMARY: Kimi K2.5 (NVIDIA NIM)
  {
    id: 'moonshotai/kimi-k2.5',
    provider: 'nim',
    capabilities: ['code', 'vision', 'agent', 'long-context', 'embedding', 'multilingual'],
    contextWindow: 256_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
    description: 'Primary model - 256K context, multilingual, cost-effective',
  },
  
  // ALTERNATIVES via OpenRouter
  {
    id: 'openrouter/moonshotai/kimi-k2.5',
    provider: 'openrouter',
    capabilities: ['code', 'vision', 'agent', 'long-context', 'multilingual'],
    contextWindow: 256_000,
    description: 'Kimi K2.5 via OpenRouter',
  },
  {
    id: 'openrouter/google/gemini-2.5-pro',
    provider: 'openrouter',
    capabilities: ['code', 'vision', 'agent', 'long-context', 'multilingual'],
    contextWindow: 1_000_000,
    description: 'Google Gemini 2.5 Pro - 1M context',
  },
  {
    id: 'openrouter/meta-llama/llama-3.1-405b',
    provider: 'openrouter',
    capabilities: ['code', 'agent', 'long-context'],
    contextWindow: 128_000,
    description: 'Meta Llama 3.1 405B',
  },
  
  // ALTERNATIVES via Zhipu (GLM)
  {
    id: 'glm-4',
    provider: 'zhipu',
    capabilities: ['code', 'agent', 'multilingual'],
    contextWindow: 128_000,
    description: 'Zhipu GLM-4 - Strong Chinese support',
  },
  {
    id: 'glm-4-plus',
    provider: 'zhipu',
    capabilities: ['code', 'agent', 'long-context', 'multilingual'],
    contextWindow: 128_000,
    description: 'Zhipu GLM-4 Plus - Enhanced capabilities',
  },
  
  // ALTERNATIVES via Copilot
  {
    id: 'copilot-codex',
    provider: 'copilot',
    capabilities: ['code'],
    contextWindow: 32_000,
    description: 'GitHub Copilot Codex',
  },
  

];

export function getModelById(id: string): ModelConfig | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function getDefaultModel(): ModelConfig {
  return getModelById(DEFAULT_MODEL) || MODEL_REGISTRY[0];
}

export function getModelsByCapability(cap: ModelCapability): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes(cap));
}

export function getModelsByProvider(provider: LLMProvider): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider);
}

export function getMultilingualModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes('multilingual'));
}

export function getCheapestModel(): ModelConfig {
  return MODEL_REGISTRY.reduce((cheapest, model) => {
    const modelCost = (model.costPerMillionInput || 0) + (model.costPerMillionOutput || 0);
    const cheapestCost = (cheapest.costPerMillionInput || 0) + (cheapest.costPerMillionOutput || 0);
    return modelCost < cheapestCost ? model : cheapest;
  });
}

export function getLargestContextModel(): ModelConfig {
  return MODEL_REGISTRY.reduce((largest, model) => 
    model.contextWindow > largest.contextWindow ? model : largest
  );
}

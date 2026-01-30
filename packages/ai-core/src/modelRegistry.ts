/**
 * Model registry – capability and cost metadata for LLM models.
 */

export type LLMProvider = 'anthropic' | 'zhipu' | 'copilot' | 'openrouter' | 'nim';

export type ModelCapability = 'code' | 'vision' | 'voice' | 'agent' | 'long-context' | 'tools' | 'embedding';

export interface ModelConfig {
  id: string;
  provider: LLMProvider;
  capabilities: ModelCapability[];
  contextWindow: number;
  costPerMillionInput?: number;
  costPerMillionOutput?: number;
}

export const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: 'moonshotai/kimi-k2.5',
    provider: 'nim',
    capabilities: ['code', 'vision', 'agent', 'long-context', 'embedding'],
    contextWindow: 256_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
  },
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    capabilities: ['code', 'agent', 'tools'],
    contextWindow: 200_000,
    costPerMillionInput: 3.0,
    costPerMillionOutput: 15.0,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    capabilities: ['code', 'agent', 'tools'],
    contextWindow: 200_000,
    costPerMillionInput: 3.0,
    costPerMillionOutput: 15.0,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    provider: 'openrouter',
    capabilities: ['code', 'agent', 'tools'],
    contextWindow: 200_000,
  },
  {
    id: 'glm-4',
    provider: 'zhipu',
    capabilities: ['code', 'agent'],
    contextWindow: 128_000,
  },
  {
    id: 'copilot-codex',
    provider: 'copilot',
    capabilities: ['code'],
    contextWindow: 32_000,
  },
];

export function getModelById(id: string): ModelConfig | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function getModelsByCapability(cap: ModelCapability): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes(cap));
}

export function getModelsByProvider(provider: LLMProvider): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider);
}

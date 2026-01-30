/**
 * Model registry – capability and cost metadata for LLM models.
 * 
 * Kimi K2.5 is the primary model, with alternatives available via
 * various providers (NIM, OpenRouter, Zhipu, Copilot).
 */

export type LLMProvider = 'nim' | 'zhipu' | 'copilot' | 'openrouter';

export type ModelCapability = 'code' | 'vision' | 'voice' | 'agent' | 'long-context' | 'tools' | 'embedding' | 'multilingual' | 'reasoning' | 'multimodal' | 'agentic' | 'function-calling';

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
}

export const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';
export const DEFAULT_PROVIDER: LLMProvider = 'nim';

export const MODEL_REGISTRY: ModelConfig[] = [
  // PRIMARY: Kimi K2.5 (NVIDIA NIM)
  {
    id: 'moonshotai/kimi-k2.5',
    provider: 'nim',
    capabilities: ['code', 'vision', 'agent', 'long-context', 'embedding', 'multilingual', 'reasoning', 'multimodal', 'agentic', 'function-calling'],
    contextWindow: 256_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
    description: 'Primary model - 256K context, multilingual, cost-effective',
    publisher: 'Moonshot AI',
    parameters: '1T (MoE)',
  },
  
  // ==================== NVIDIA NIM: LLAMA MODELS ====================
  {
    id: 'meta/llama-4-maverick-17b-128e-instruct',
    provider: 'nim',
    capabilities: ['vision', 'multimodal', 'agentic', 'function-calling', 'long-context'],
    contextWindow: 256_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
    description: 'General purpose multimodal, multilingual 128 MoE model with 17B active parameters',
    publisher: 'Meta',
    parameters: '17B active (128 experts)',
  },
  {
    id: 'meta/llama-4-scout-17b-16e-instruct',
    provider: 'nim',
    capabilities: ['vision', 'multimodal', 'agentic', 'long-context'],
    contextWindow: 128_000,
    costPerMillionInput: 0.1,
    costPerMillionOutput: 0.1,
    description: 'Multimodal, multilingual 16 MoE model with 17B parameters',
    publisher: 'Meta',
    parameters: '17B (16 experts)',
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    provider: 'nim',
    capabilities: ['code', 'function-calling'],
    contextWindow: 128_000,
    costPerMillionInput: 0.02,
    costPerMillionOutput: 0.02,
    description: 'Lightweight, efficient model for edge and mobile deployment',
    publisher: 'Meta',
    parameters: '8B',
  },
  {
    id: 'meta/llama-3.1-70b-instruct',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'function-calling', 'long-context'],
    contextWindow: 128_000,
    costPerMillionInput: 0.35,
    costPerMillionOutput: 0.35,
    description: 'High-performance model for complex tasks and reasoning',
    publisher: 'Meta',
    parameters: '70B',
  },
  {
    id: 'meta/llama-3.1-405b-instruct',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'function-calling', 'long-context'],
    contextWindow: 128_000,
    costPerMillionInput: 3.0,
    costPerMillionOutput: 3.0,
    description: 'Flagship Llama model with 405B parameters for maximum performance',
    publisher: 'Meta',
    parameters: '405B',
  },
  
  // ==================== NVIDIA NIM: CODELLAMA MODELS ====================
  {
    id: 'meta/codellama-7b-instruct',
    provider: 'nim',
    capabilities: ['code', 'function-calling'],
    contextWindow: 16_000,
    costPerMillionInput: 0.02,
    costPerMillionOutput: 0.02,
    description: 'Lightweight code generation model for fast inference and edge deployment',
    publisher: 'Meta',
    parameters: '7B',
  },
  {
    id: 'meta/codellama-13b-instruct',
    provider: 'nim',
    capabilities: ['code', 'function-calling'],
    contextWindow: 16_000,
    costPerMillionInput: 0.06,
    costPerMillionOutput: 0.06,
    description: 'Balanced code generation model with improved accuracy over 7B',
    publisher: 'Meta',
    parameters: '13B',
  },
  {
    id: 'meta/codellama-34b-instruct',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'function-calling'],
    contextWindow: 16_000,
    costPerMillionInput: 0.15,
    costPerMillionOutput: 0.15,
    description: 'High-performance code model with strong reasoning for complex programming tasks',
    publisher: 'Meta',
    parameters: '34B',
  },
  {
    id: 'meta/codellama-70b-instruct',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'function-calling', 'long-context'],
    contextWindow: 100_000,
    costPerMillionInput: 0.35,
    costPerMillionOutput: 0.35,
    description: 'Flagship CodeLlama model with 100K context for large codebase understanding',
    publisher: 'Meta',
    parameters: '70B',
  },
  
  // ==================== NVIDIA NIM: MISTRAL MODELS ====================
  {
    id: 'mistralai/mistral-large-3-675b-instruct-2512',
    provider: 'nim',
    capabilities: ['vision', 'multimodal', 'agentic', 'function-calling', 'long-context'],
    contextWindow: 256_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
    description: 'State-of-the-art general purpose MoE VLM ideal for chat, agentic and instruction-based use cases',
    publisher: 'Mistral AI',
    parameters: '675B',
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct-v0.1',
    provider: 'nim',
    capabilities: ['code', 'reasoning'],
    contextWindow: 32_000,
    costPerMillionInput: 0.15,
    costPerMillionOutput: 0.15,
    description: 'Efficient MoE LLM that follows instructions and completes requests',
    publisher: 'Mistral AI',
    parameters: '8x7B MoE',
  },
  {
    id: 'mistralai/mixtral-8x22b-instruct-v0.1',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'long-context'],
    contextWindow: 65_000,
    costPerMillionInput: 0.4,
    costPerMillionOutput: 0.4,
    description: 'Large MoE LLM with 8x22B experts for complex tasks',
    publisher: 'Mistral AI',
    parameters: '8x22B MoE',
  },
  {
    id: 'mistralai/mistral-small-24b-instruct',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'agentic', 'multilingual'],
    contextWindow: 128_000,
    costPerMillionInput: 0.1,
    costPerMillionOutput: 0.1,
    description: 'Latency-optimized language model excelling in code, math, general knowledge',
    publisher: 'Mistral AI',
    parameters: '24B',
  },
  
  // ==================== NVIDIA NIM: NEMOTRON MODELS ====================
  {
    id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'function-calling', 'agentic'],
    contextWindow: 128_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
    description: 'Superior inference efficiency with highest accuracy for scientific and complex reasoning',
    publisher: 'NVIDIA',
    parameters: '253B',
  },
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'function-calling', 'agentic'],
    contextWindow: 128_000,
    costPerMillionInput: 0.2,
    costPerMillionOutput: 0.2,
    description: 'High efficiency model with leading accuracy for reasoning and tool calling',
    publisher: 'NVIDIA',
    parameters: '49B',
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'function-calling', 'long-context'],
    contextWindow: 1_000_000,
    costPerMillionInput: 0.25,
    costPerMillionOutput: 0.25,
    description: 'Open, efficient MoE model with 1M context - coding, reasoning, tool calling',
    publisher: 'NVIDIA',
    parameters: '30B (A3B active)',
  },
  {
    id: 'meta/llama-3.1-nemotron-nano-8b-v1',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'agentic', 'function-calling'],
    contextWindow: 128_000,
    costPerMillionInput: 0.015,
    costPerMillionOutput: 0.015,
    description: 'Leading reasoning and agentic AI model for PC and edge deployment',
    publisher: 'NVIDIA',
    parameters: '8B',
  },
  
  // ==================== NVIDIA NIM: DEEPSEEK MODELS ====================
  {
    id: 'deepseek-ai/deepseek-v3.2',
    provider: 'nim',
    capabilities: ['reasoning', 'long-context', 'function-calling', 'agentic'],
    contextWindow: 128_000,
    costPerMillionInput: 0.45,
    costPerMillionOutput: 0.45,
    description: '685B reasoning LLM with sparse attention and integrated agentic tools',
    publisher: 'DeepSeek AI',
    parameters: '685B',
  },
  
  // ==================== NVIDIA NIM: QWEN MODELS ====================
  {
    id: 'qwen/qwen3-coder-480b-a35b-instruct',
    provider: 'nim',
    capabilities: ['code', 'agentic', 'long-context'],
    contextWindow: 256_000,
    costPerMillionInput: 0.8,
    costPerMillionOutput: 0.8,
    description: 'Excels in agentic coding and browser use with 256K context',
    publisher: 'Qwen',
    parameters: '480B (35B active)',
  },
  {
    id: 'qwen/qwen2.5-coder-32b-instruct',
    provider: 'nim',
    capabilities: ['code'],
    contextWindow: 128_000,
    costPerMillionInput: 0.15,
    costPerMillionOutput: 0.15,
    description: 'Advanced LLM for code generation and fixing across popular languages',
    publisher: 'Qwen',
    parameters: '32B',
  },
  
  // ==================== NVIDIA NIM: KIMI MODELS ====================
  {
    id: 'moonshotai/kimi-k2-thinking',
    provider: 'nim',
    capabilities: ['reasoning', 'function-calling', 'long-context', 'agentic'],
    contextWindow: 256_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
    description: 'Open reasoning model with 256K context and enhanced tool use',
    publisher: 'Moonshot AI',
    parameters: '1T (MoE)',
  },
  {
    id: 'moonshotai/kimi-k2-instruct',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'agentic', 'function-calling'],
    contextWindow: 256_000,
    costPerMillionInput: 0.6,
    costPerMillionOutput: 0.6,
    description: 'State-of-the-art open MoE model with strong reasoning and coding',
    publisher: 'Moonshot AI',
    parameters: '1T (MoE)',
  },
  {
    id: 'moonshotai/kimi-k2-instruct-0905',
    provider: 'nim',
    capabilities: ['code', 'reasoning', 'agentic', 'long-context', 'function-calling'],
    contextWindow: 512_000,
    costPerMillionInput: 0.7,
    costPerMillionOutput: 0.7,
    description: 'Enhanced version with longer context and advanced reasoning',
    publisher: 'Moonshot AI',
    parameters: '1T (MoE)',
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

export function getNvidiaModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.provider === 'nim');
}

export function getCodeModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes('code'));
}

export function getReasoningModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes('reasoning'));
}

export function getAgenticModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes('agentic'));
}

export function getVisionModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.includes('vision') || m.capabilities.includes('multimodal'));
}

export function getLongContextModels(minContext: number = 100_000): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.contextWindow >= minContext);
}

export function getModelsByPublisher(publisher: string): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.publisher?.toLowerCase() === publisher.toLowerCase());
}

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): { usd: number; breakdown: string } {
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

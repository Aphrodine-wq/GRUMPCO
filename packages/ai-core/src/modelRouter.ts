/**
 * Model Router – Multi-Provider Aware
 * 
 * Intelligent routing for AI models based on task requirements.
 * Primary routing uses NVIDIA NIM models with tool/function calling support.
 * G-CompN1 meta-routing (in llmGateway.ts) handles cross-provider routing.
 * 
 * Routing Strategy (NIM-hosted models support tool/function calling):
 * - Complex/Flagship: Llama 3.1 405B
 * - Balanced: Llama 3.1 70B (default)
 * - Code Generation: Codestral or Llama 405B
 * - Reasoning: Nemotron Ultra 253B
 * - Multilingual: Mistral Large 2
 * - Cost-Optimized: Nemotron Super 49B
 */

import { getModelById, type ModelCapability } from './modelRegistry.js';
import type { LLMProvider } from './modelRegistry.js';

export type TaskType =
  | 'chat'
  | 'rag'
  | 'embedding'
  | 'codegen'
  | 'reasoning'
  | 'vision'
  | 'agent'
  | 'safety';

export interface ModelPreference {
  source?: 'cloud' | 'auto';
  provider?: string;
  modelId?: string;
}

export interface RouterContext {
  messageChars?: number;
  messageCount?: number;
  mode?: string;
  toolsRequested?: boolean;
  multimodal?: boolean;
  preferCapability?: ModelCapability;
  costOptimization?: boolean;
  maxCostPerRequest?: number;
  preferNim?: boolean;
  maxLatencyMs?: number;
  taskType?: TaskType;
  requiredContext?: number;
  preferCost?: boolean;
  preferCapabilityOverCost?: boolean;
  sessionType?: 'chat' | 'gAgent' | 'freeAgent';
  sessionSubType?: 'swarm' | 'codegen';
  modelPreference?: ModelPreference;
}

export interface RouterResult {
  provider: LLMProvider;
  modelId: string;
  estimatedCost?: number;
  reasoning?: string;
}

// =============================================================================
// NVIDIA NIM Model IDs
// =============================================================================

const LLAMA_405B = 'meta/llama-3.1-405b-instruct';
const LLAMA_70B = 'meta/llama-3.1-70b-instruct';
const LLAMA_33_70B = 'meta/llama-3.3-70b-instruct';
const MISTRAL_LARGE = 'mistralai/mistral-large-2-instruct';
// MIXTRAL_8X22B removed — does not support tool calling on NIM
const NEMOTRON_ULTRA = 'nvidia/llama-3.1-nemotron-ultra-253b-v1';
const NEMOTRON_70B = 'nvidia/llama-3.1-nemotron-70b-instruct';
const NEMOTRON_SUPER = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
const NEMOTRON_3_NANO = 'nvidia/nemotron-3-nano-30b-a3b';
// NEMOTRON_VISION removed — vision-only model, no tool calling support on NIM
const CODESTRAL = 'mistralai/codestral-22b-instruct-v0.1';

// Default model for general use (Nemotron Super for demos and agentic use)
const DEFAULT_MODEL = NEMOTRON_SUPER;

// =============================================================================
// Provider Configuration Checks
// =============================================================================

function isNimConfigured(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  return Boolean(process.env.NVIDIA_NIM_API_KEY);
}

function isMockModeEnabled(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  return process.env.MOCK_AI_MODE === 'true';
}

// =============================================================================
// Complexity Scoring
// =============================================================================

function calculateComplexity(context: RouterContext): number {
  let score = 0;
  const chars = context.messageChars || 0;

  // Message length scoring
  if (chars < 500) score += 10;
  else if (chars < 2000) score += 30;
  else if (chars < 5000) score += 50;
  else if (chars < 20000) score += 70;
  else score += 90;

  // Conversation depth
  if (context.messageCount && context.messageCount > 10) score += 15;
  if (context.messageCount && context.messageCount > 30) score += 10;

  // Mode complexity
  if (context.mode === 'ship' || context.mode === 'codegen') score += 25;
  if (context.mode === 'architecture' || context.mode === 'spec') score += 20;
  if (context.mode === 'plan') score += 15;

  // Feature complexity
  if (context.toolsRequested) score += 15;
  if (context.multimodal) score += 10;

  return Math.min(100, score);
}

// =============================================================================
// Long Context Routing Helper
// =============================================================================

function routeForLongContext(messageChars: number, requiredContext?: number): RouterResult | null {
  const useNemotron3Rag = process.env.USE_NEMOTRON_3_FOR_RAG !== 'false';
  if (!useNemotron3Rag) return null;

  // Check for very long context (100K+)
  if (messageChars > 100_000) {
    const model = getModelById(NEMOTRON_3_NANO);
    return {
      provider: 'nim',
      modelId: NEMOTRON_3_NANO,
      estimatedCost: estimateCost(model, messageChars),
      reasoning: 'Very long context - Nemotron 3 Nano 30B A3B (1M)',
    };
  }

  // Check for required context preference
  if (requiredContext && requiredContext > 100_000) {
    return {
      provider: 'nim',
      modelId: NEMOTRON_3_NANO,
      reasoning: 'Long context (1M) - Nemotron 3 Nano 30B A3B',
    };
  }

  return null;
}

// =============================================================================
// Cost Estimation
// =============================================================================

function estimateCost(
  model: { costPerMillionInput?: number; costPerMillionOutput?: number } | undefined,
  messageChars: number
): number {
  if (!model) return 0;
  const estimatedTokens = Math.ceil(messageChars / 4);
  const inputCost = ((model.costPerMillionInput || 0) * estimatedTokens) / 1_000_000;
  const outputTokens = Math.ceil(estimatedTokens * 0.5);
  const outputCost = ((model.costPerMillionOutput || 0) * outputTokens) / 1_000_000;
  return inputCost + outputCost;
}

// =============================================================================
// Task Type Routing (Primary: NVIDIA NIM, cross-provider via G-CompN1)
// =============================================================================

const TASK_TYPE_MODELS: Record<TaskType, { primary: string; fallback: string }> = {
  chat: { primary: NEMOTRON_SUPER, fallback: LLAMA_70B },
  rag: { primary: LLAMA_70B, fallback: NEMOTRON_3_NANO },
  embedding: { primary: LLAMA_70B, fallback: LLAMA_70B },
  codegen: { primary: LLAMA_405B, fallback: CODESTRAL },
  reasoning: { primary: NEMOTRON_ULTRA, fallback: LLAMA_405B },
  vision: { primary: LLAMA_70B, fallback: LLAMA_33_70B },
  agent: { primary: NEMOTRON_SUPER, fallback: NEMOTRON_70B },
  safety: { primary: NEMOTRON_ULTRA, fallback: LLAMA_70B },
};

// =============================================================================
// G-Agent Routing
// =============================================================================

function routeForGAgent(context: RouterContext): RouterResult {
  const prefs = context.modelPreference;

  // User preference override
  if (prefs?.modelId) {
    const model = getModelById(prefs.modelId);
    if (model && model.provider === 'nim') {
      return {
        provider: 'nim',
        modelId: model.id,
        reasoning: 'User model preference (NVIDIA NIM)',
      };
    }
  }

  const isCodegen = context.sessionSubType === 'codegen';

  if (!isNimConfigured()) {
    return {
      provider: 'nim',
      modelId: DEFAULT_MODEL,
      reasoning: 'NVIDIA NIM not configured - set NVIDIA_NIM_API_KEY',
    };
  }

  // Codegen uses flagship model for best results
  if (isCodegen) {
    return {
      provider: 'nim',
      modelId: LLAMA_405B,
      reasoning: 'Llama 3.1 405B for code generation (NVIDIA NIM)',
    };
  }

  // Swarm/General uses balanced model
  return {
    provider: 'nim',
    modelId: LLAMA_70B,
    reasoning: 'Llama 3.1 70B for general tasks (NVIDIA NIM)',
  };
}

// =============================================================================
// Main Router
// =============================================================================

export function route(context: RouterContext): RouterResult {
  // Mock mode for demo
  if (isMockModeEnabled()) {
    return {
      provider: 'mock',
      modelId: 'mock-ai',
      estimatedCost: 0,
      reasoning: 'Demo mode - no API keys required',
    };
  }

  // G-Agent routing
  if (context.sessionType === 'gAgent' || context.sessionType === 'freeAgent') {
    return routeForGAgent(context);
  }

  const { messageChars = 0, costOptimization = true, maxLatencyMs } = context;
  const complexity = calculateComplexity(context);
  const preferLowLatency = typeof maxLatencyMs === 'number' && maxLatencyMs > 0 && maxLatencyMs < 5000;

  // Very long context (100K+): Nemotron 3 Nano 1M when USE_NEMOTRON_3_FOR_RAG !== 'false'
  const longContextRoute = routeForLongContext(messageChars, context.requiredContext);
  if (longContextRoute) {
    return longContextRoute;
  }

  // Not configured - return default with warning
  if (!isNimConfigured()) {
    return {
      provider: 'nim',
      modelId: DEFAULT_MODEL,
      reasoning: 'NVIDIA NIM not configured - set NVIDIA_NIM_API_KEY',
    };
  }

  // Cost optimization routing
  if (costOptimization) {
    // Simple tasks: use cost-effective model with tool support
    if (complexity < 25) {
      const model = getModelById(NEMOTRON_SUPER);
      return {
        provider: 'nim',
        modelId: NEMOTRON_SUPER,
        estimatedCost: estimateCost(model, messageChars),
        reasoning: 'Simple task - Nemotron Super 49B (cost-effective with tool support)',
      };
    }

    // Medium complexity: balanced model
    if (complexity < 60 || preferLowLatency) {
      const model = getModelById(LLAMA_70B);
      return {
        provider: 'nim',
        modelId: LLAMA_70B,
        estimatedCost: estimateCost(model, messageChars),
        reasoning: 'Balanced task - Llama 3.1 70B',
      };
    }

    // Complex tasks with tools: flagship model
    if (context.toolsRequested) {
      const model = getModelById(LLAMA_405B);
      return {
        provider: 'nim',
        modelId: LLAMA_405B,
        estimatedCost: estimateCost(model, messageChars),
        reasoning: 'Complex task with tools - Llama 3.1 405B',
      };
    }

    // High complexity: use reasoning model
    if (complexity >= 80) {
      const model = getModelById(NEMOTRON_ULTRA);
      return {
        provider: 'nim',
        modelId: NEMOTRON_ULTRA,
        estimatedCost: estimateCost(model, messageChars),
        reasoning: 'High complexity - Nemotron Ultra 253B',
      };
    }
  }

  // Capability-based routing
  if (context.preferCapability === 'multilingual') {
    return { provider: 'nim', modelId: MISTRAL_LARGE, reasoning: 'Multilingual - Mistral Large 2' };
  }

  // Very long context (100K+): Nemotron 3 Nano 1M when USE_NEMOTRON_3_FOR_RAG !== 'false'
  const longContextRouteCost = routeForLongContext(messageChars, context.requiredContext);
  if (longContextRouteCost) {
    return longContextRouteCost;
  }
  if (context.preferCapability === 'long-context' || messageChars > 50_000) {
    return { provider: 'nim', modelId: LLAMA_405B, reasoning: 'Long context - Llama 3.1 405B' };
  }

  if (context.preferCapability === 'reasoning') {
    return { provider: 'nim', modelId: NEMOTRON_ULTRA, reasoning: 'Reasoning - Nemotron Ultra' };
  }

  // Default: Nemotron Super (NVIDIA flagship for chat/agentic)
  return {
    provider: 'nim',
    modelId: DEFAULT_MODEL,
    reasoning: 'Default - Nemotron Super 49B',
  };
}

// =============================================================================
// Task Type Routing
// =============================================================================

export function routeByTaskType(taskType: TaskType, context?: RouterContext): RouterResult {
  if (isMockModeEnabled()) {
    return { provider: 'mock', modelId: 'mock-ai', reasoning: 'Demo mode' };
  }

  const mapping = TASK_TYPE_MODELS[taskType];
  const primary = getModelById(mapping.primary);
  const fallback = getModelById(mapping.fallback);

  if (isNimConfigured()) {
    if (primary) {
      return {
        provider: 'nim',
        modelId: primary.id,
        estimatedCost: estimateCost(primary, context?.messageChars || 0),
        reasoning: `${taskType} - ${primary.publisher} via NVIDIA NIM`,
      };
    }
    if (fallback) {
      return {
        provider: 'nim',
        modelId: fallback.id,
        estimatedCost: estimateCost(fallback, context?.messageChars || 0),
        reasoning: `${taskType} fallback - ${fallback.publisher} via NVIDIA NIM`,
      };
    }
  }

  return { provider: 'nim', modelId: DEFAULT_MODEL, reasoning: 'Default NVIDIA NIM model' };
}

// =============================================================================
// Specialized Routers
// =============================================================================

export function getRAGModel(contextSize: number): RouterResult {
  // Very large RAG context: Nemotron 3 Nano 1M when USE_NEMOTRON_3_FOR_RAG !== 'false'
  if (contextSize > 100_000 && process.env.USE_NEMOTRON_3_FOR_RAG !== 'false') {
    return {
      provider: 'nim',
      modelId: NEMOTRON_3_NANO,
      reasoning: 'Large RAG context - Nemotron 3 Nano 30B A3B (1M)',
    };
  }
  return { provider: 'nim', modelId: LLAMA_70B, reasoning: 'RAG - Llama 3.1 70B' };
}

export function getCodeModel(complexity: 'simple' | 'moderate' | 'complex'): RouterResult {
  switch (complexity) {
    case 'simple':
      return { provider: 'nim', modelId: CODESTRAL, reasoning: 'Simple code - Codestral' };
    case 'moderate':
      return { provider: 'nim', modelId: LLAMA_70B, reasoning: 'Moderate code - Llama 70B' };
    case 'complex':
      return { provider: 'nim', modelId: LLAMA_405B, reasoning: 'Complex code - Llama 405B' };
  }
}

export function getReasoningModel(requiresTools: boolean): RouterResult {
  if (requiresTools) {
    return { provider: 'nim', modelId: LLAMA_405B, reasoning: 'Reasoning with tools - Llama 405B' };
  }
  return { provider: 'nim', modelId: NEMOTRON_ULTRA, reasoning: 'Deep reasoning - Nemotron Ultra' };
}

export function getVisionModel(): RouterResult {
  return {
    provider: 'nim',
    modelId: LLAMA_70B,
    reasoning: 'Vision - Llama 3.1 70B (tool-call compatible)',
  };
}

export function getMultilingualModel(): RouterResult {
  return { provider: 'nim', modelId: MISTRAL_LARGE, reasoning: 'Multilingual - Mistral Large 2' };
}

export function getCostOptimizedModel(): RouterResult {
  return { provider: 'nim', modelId: NEMOTRON_SUPER, reasoning: 'Cost-optimized - Nemotron Super 49B' };
}

// =============================================================================
// Enhanced Router (Full Context)
// =============================================================================

export function routeEnhanced(context: RouterContext): RouterResult {
  if (context.taskType) {
    return routeByTaskType(context.taskType, context);
  }

  if (context.mode) {
    const modeToTask: Record<string, TaskType> = {
      chat: 'chat',
      ship: 'codegen',
      codegen: 'codegen',
      architecture: 'reasoning',
      spec: 'reasoning',
      plan: 'reasoning',
      rag: 'rag',
      agent: 'agent',
    };
    const inferredTask = modeToTask[context.mode];
    if (inferredTask) {
      return routeByTaskType(inferredTask, context);
    }
  }

  if (context.multimodal) {
    return routeByTaskType('vision', context);
  }

  if (context.requiredContext && context.requiredContext > 100_000) {
    return getRAGModel(context.requiredContext);
  }

  return route(context);
}

/**
 * Model router – selects provider and model by request context.
 * Enhanced with cost optimization
 */

import { MODEL_REGISTRY, getModelById, type ModelCapability } from './modelRegistry.js';
import type { LLMProvider } from './modelRegistry.js';

export interface RouterContext {
  messageChars?: number;
  messageCount?: number;
  mode?: string;
  toolsRequested?: boolean;
  multimodal?: boolean;
  preferCapability?: ModelCapability;
  costOptimization?: boolean; // Enable cost-aware routing
  maxCostPerRequest?: number;
  /** Prefer NVIDIA NIM (Kimi) when configured; bias to NIM for complexity up to 70. */
  preferNim?: boolean;
  /** Latency budget in ms; when set, NIM is preferred for latency-sensitive requests (v1: no dynamic lookup). */
  maxLatencyMs?: number;
}

export interface RouterResult {
  provider: LLMProvider;
  modelId: string;
  estimatedCost?: number;
  reasoning?: string;
}

const KIMI_ID = 'moonshotai/kimi-k2.5';
const COMPLEX_TASK_MODEL_ID = 'openrouter/google/gemini-2.5-pro';

function isNimConfigured(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  return Boolean(process.env.NVIDIA_NIM_API_KEY);
}

/**
 * Calculate task complexity score (0-100)
 */
function calculateComplexity(context: RouterContext): number {
  let score = 0;
  
  // Message length factor
  const chars = context.messageChars || 0;
  if (chars < 500) score += 10;
  else if (chars < 2000) score += 30;
  else if (chars < 5000) score += 50;
  else score += 70;
  
  // Context size factor
  if (context.messageCount && context.messageCount > 10) score += 15;
  
  // Mode complexity
  if (context.mode === 'ship' || context.mode === 'codegen') score += 20;
  if (context.mode === 'architecture' || context.mode === 'spec') score += 15;
  
  // Tools and multimodal
  if (context.toolsRequested) score += 10;
  if (context.multimodal) score += 10;
  
  return Math.min(100, score);
}

export function route(context: RouterContext): RouterResult {
  const { messageChars = 0, multimodal = false, preferCapability, costOptimization = true, preferNim, maxLatencyMs } = context;

  const kimi = getModelById(KIMI_ID);
  const complexModel = getModelById(COMPLEX_TASK_MODEL_ID);
  const useKimi = kimi && isNimConfigured();
  const preferNimEffective = preferNim === true || (typeof maxLatencyMs === 'number' && maxLatencyMs > 0);
  const complexityThresholdNim = preferNimEffective ? 70 : 60;

  // Cost-aware routing
  if (costOptimization) {
    let complexity = calculateComplexity(context);
    if (context.mode === 'plan') {
      complexity = Math.min(complexity, 25);
    }
    // Simple tasks (< 25): Use Kimi if available (5x cheaper)
    if (complexity < 25 && useKimi) {
      return {
        provider: 'nim',
        modelId: KIMI_ID,
        estimatedCost: estimateCost(kimi, messageChars),
        reasoning: 'Simple task, using cost-effective model',
      };
    }
    
    // Medium tasks (25–threshold): Prefer Kimi unless tools required
    if (complexity < complexityThresholdNim && useKimi && !context.toolsRequested) {
      return {
        provider: 'nim',
        modelId: KIMI_ID,
        estimatedCost: estimateCost(kimi, messageChars),
        reasoning: preferNimEffective ? 'Prefer NIM (latency/cost)' : 'Medium complexity, balanced cost-performance',
      };
    }
    
    // Complex tasks (> threshold) or tools required: Use Gemini via OpenRouter for best results
    if (complexModel) {
      return {
        provider: 'openrouter',
        modelId: COMPLEX_TASK_MODEL_ID,
        estimatedCost: estimateCost(complexModel, messageChars),
        reasoning: 'Complex task requiring high-capability model',
      };
    }
  }

  // Legacy routing logic (non-cost-optimized)
  if (multimodal && useKimi && kimi.capabilities.includes('vision')) {
    return { provider: 'nim', modelId: KIMI_ID };
  }
  if (preferCapability === 'long-context' || preferCapability === 'agent') {
    if (useKimi && kimi.capabilities.includes(preferCapability)) {
      return { provider: 'nim', modelId: KIMI_ID };
    }
  }
  if (messageChars > 50_000 && useKimi && kimi.capabilities.includes('long-context')) {
    return { provider: 'nim', modelId: KIMI_ID };
  }
  if (useKimi) {
    return { provider: 'nim', modelId: KIMI_ID };
  }
  if (complexModel) {
    return { provider: 'openrouter', modelId: COMPLEX_TASK_MODEL_ID };
  }
  const first = MODEL_REGISTRY[0];
  if (first) {
    return { provider: first.provider, modelId: first.id };
  }
  return { provider: 'nim', modelId: KIMI_ID };
}

/**
 * Estimate cost for a request
 */
function estimateCost(model: { costPerMillionInput?: number; costPerMillionOutput?: number } | undefined, messageChars: number): number {
  if (!model) return 0;
  
  const estimatedTokens = Math.ceil(messageChars / 4);
  const inputCost = ((model.costPerMillionInput || 0) * estimatedTokens) / 1_000_000;
  const outputTokens = Math.ceil(estimatedTokens * 0.5);
  const outputCost = ((model.costPerMillionOutput || 0) * outputTokens) / 1_000_000;
  
  return inputCost + outputCost;
}

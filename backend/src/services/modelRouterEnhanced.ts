/**
 * Enhanced Model Router with Kimi K2.5 Optimizations
 *
 * This router extends the base model router with intelligent
 * Kimi K2.5 routing based on content analysis, cost optimization,
 * and context window utilization.
 */

import {
  MODEL_REGISTRY,
  getModelById,
  type ModelConfig,
  type ModelCapability,
} from "../config/modelRegistry.js";
import {
  shouldRouteToKimi,
  calculateKimiContextRetention,
  estimateKimiSavings as _estimateKimiSavings,
  KIMI_K25_CONFIG,
} from "./kimiOptimizer.js";
import logger from "../middleware/logger.js";

export interface EnhancedRouterContext {
  messageChars?: number;
  messageCount?: number;
  mode?: string;
  toolsRequested?: boolean;
  multimodal?: boolean;
  preferNim?: boolean;
  maxLatencyMs?: number;
  costOptimization?: boolean;
  // Kimi-specific additions
  isCodeGeneration?: boolean;
  hasNonEnglishContent?: boolean;
  contextTokenCount?: number;
  userTier?: "free" | "pro" | "team" | "enterprise";
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

export interface RoutingDecision {
  modelId: string;
  provider: string;
  confidence: number;
  reasoning: string[];
  estimatedCost: {
    usd: number;
    vsClaudeSavings?: number;
    savingsPercent?: number;
  };
  optimizations: {
    contextRetention?: number;
    promptOptimized?: boolean;
    temperature?: number;
  };
}

/**
 * Calculate task complexity score (0-100)
 */
function calculateComplexity(context: EnhancedRouterContext): number {
  let score = 0;
  const factors: string[] = [];

  // Message length factor
  const chars = context.messageChars || 0;
  if (chars > 10000) {
    score += 25;
    factors.push("Long context (>10K chars)");
  } else if (chars > 5000) {
    score += 15;
    factors.push("Medium context (5-10K chars)");
  } else {
    score += 5;
  }

  // Message count (conversation depth)
  const msgCount = context.messageCount || 1;
  if (msgCount > 20) {
    score += 20;
    factors.push("Deep conversation (>20 messages)");
  } else if (msgCount > 10) {
    score += 10;
    factors.push("Active conversation (10-20 messages)");
  }

  // Tools requested (increases complexity)
  if (context.toolsRequested) {
    score += 20;
    factors.push("Tool use required");
  }

  // Multimodal (vision increases complexity)
  if (context.multimodal) {
    score += 10;
    factors.push("Multimodal (vision)");
  }

  // Mode-specific adjustments
  switch (context.mode) {
    case "ship":
      score += 25;
      factors.push("SHIP mode (complex workflow)");
      break;
    case "codegen":
      score += 20;
      factors.push("Code generation");
      break;
    case "architecture":
      score += 20;
      factors.push("Architecture analysis");
      break;
    case "plan":
      score += 15;
      factors.push("Planning mode");
      break;
    case "spec":
      score += 10;
      factors.push("Specification mode");
      break;
    default:
      break;
  }

  // Code generation flag
  if (context.isCodeGeneration) {
    score += 10;
    factors.push("Code generation flag");
  }

  const finalScore = Math.min(score, 100);

  logger.debug(
    {
      score: finalScore,
      factors,
      context: {
        chars,
        msgCount,
        mode: context.mode,
        tools: context.toolsRequested,
      },
    },
    "Task complexity calculated",
  );

  return finalScore;
}

/**
 * Enhanced model router with Kimi K2.5 optimizations
 */
export function selectModelEnhanced(
  context: EnhancedRouterContext,
): RoutingDecision {
  const complexity = calculateComplexity(context);
  const reasoning: string[] = [];

  // Default to Claude for high complexity or tools
  const claudeModel = getModelById("claude-sonnet-4-20250514");
  if (!claudeModel) {
    throw new Error("Claude model not found in registry");
  }
  let selectedModel = claudeModel;
  let confidence = 0.7;

  // Check if Kimi is appropriate
  const kimiDecision = shouldRouteToKimi({
    content: "x".repeat(context.messageChars || 1000),
    requiresTools: context.toolsRequested || false,
    isComplex: complexity > 60,
    hasImage: context.multimodal || false,
    isCodeGeneration: context.isCodeGeneration || false,
  });

  // Advanced routing logic
  if (context.preferNim || kimiDecision.useKimi) {
    const kimiModel = getModelById(KIMI_K25_CONFIG.modelId);
    if (kimiModel) {
      // Check capabilities match
      const canUseKimi = !context.toolsRequested || complexity < 60;

      if (canUseKimi) {
        selectedModel = kimiModel;
        confidence = kimiDecision.confidence;
        reasoning.push(...kimiDecision.reasons);
        reasoning.push(`Complexity score: ${complexity}/100`);
      } else {
        reasoning.push(
          "Complex task or tools required - using Claude for best results",
        );
      }
    }
  } else if (complexity < 30 && !context.toolsRequested) {
    // Simple task - use Kimi for cost savings
    const kimiModel = getModelById(KIMI_K25_CONFIG.modelId);
    if (kimiModel && context.costOptimization !== false) {
      selectedModel = kimiModel;
      confidence = 0.8;
      reasoning.push("Simple task - optimized for cost with Kimi K2.5");
      reasoning.push(`Complexity score: ${complexity}/100`);
    }
  } else {
    reasoning.push(
      `Complex task (${complexity}/100) or requires tools - using Claude`,
    );
  }

  // Calculate cost estimate
  const inputTokens =
    context.estimatedInputTokens ||
    Math.ceil((context.messageChars || 1000) * 0.25);
  const outputTokens =
    context.estimatedOutputTokens || Math.ceil(inputTokens * 0.5);

  const costEstimate = estimateCost(selectedModel, inputTokens, outputTokens);
  let vsClaudeSavings: number | undefined;
  let savingsPercent: number | undefined;

  if (selectedModel.id.includes("kimi")) {
    const claudeModelForCost = getModelById("claude-sonnet-4-20250514");
    if (!claudeModelForCost) {
      throw new Error("Claude model not found in registry");
    }
    const claudeCost = estimateCost(
      claudeModelForCost,
      inputTokens,
      outputTokens,
    );
    vsClaudeSavings = claudeCost.usd - costEstimate.usd;
    savingsPercent = (vsClaudeSavings / claudeCost.usd) * 100;
  }

  // Calculate optimizations
  const contextRetention = context.contextTokenCount
    ? calculateKimiContextRetention(context.contextTokenCount)
    : undefined;

  return {
    modelId: selectedModel.id,
    provider: selectedModel.provider,
    confidence,
    reasoning,
    estimatedCost: {
      usd: costEstimate.usd,
      vsClaudeSavings,
      savingsPercent,
    },
    optimizations: {
      contextRetention: contextRetention?.retainTokens,
      promptOptimized: selectedModel.id.includes("kimi"),
      temperature: selectedModel.id.includes("kimi")
        ? KIMI_K25_CONFIG.temperature.default
        : undefined,
    },
  };
}

/**
 * Estimate cost for a model
 */
function estimateCost(
  model: ModelConfig,
  inputTokens: number,
  outputTokens: number,
): { usd: number; breakdown: string } {
  const inputCost =
    (inputTokens / 1_000_000) * (model.costPerMillionInput || 0);
  const outputCost =
    (outputTokens / 1_000_000) * (model.costPerMillionOutput || 0);
  const total = inputCost + outputCost;

  return {
    usd: total,
    breakdown: `${model.id}: ${inputTokens} input + ${outputTokens} output tokens`,
  };
}

/**
 * Get the best model for a specific capability with Kimi optimization
 */
export function getBestModelForCapabilityEnhanced(
  capability: ModelCapability,
  context: EnhancedRouterContext,
): RoutingDecision {
  // Filter models by capability
  const candidates = MODEL_REGISTRY.filter((m) =>
    m.capabilities.includes(capability),
  );

  if (candidates.length === 0) {
    throw new Error(`No models found with capability: ${capability}`);
  }

  // If Kimi supports this capability and it's a good fit, prefer it
  const kimiModel = candidates.find((m) => m.id === KIMI_K25_CONFIG.modelId);

  if (kimiModel) {
    const kimiDecision = shouldRouteToKimi({
      content: "x".repeat(context.messageChars || 1000),
      requiresTools: context.toolsRequested || false,
      isComplex: calculateComplexity(context) > 60,
      hasImage: context.multimodal || false,
      isCodeGeneration: context.isCodeGeneration || false,
    });

    if (kimiDecision.useKimi) {
      const inputTokens =
        context.estimatedInputTokens ||
        Math.ceil((context.messageChars || 1000) * 0.25);
      const outputTokens =
        context.estimatedOutputTokens || Math.ceil(inputTokens * 0.5);
      const costEstimate = estimateCost(kimiModel, inputTokens, outputTokens);
      const claudeModelForCost = getModelById("claude-sonnet-4-20250514");
      if (!claudeModelForCost) {
        throw new Error("Claude model not found in registry");
      }
      const claudeCost = estimateCost(
        claudeModelForCost,
        inputTokens,
        outputTokens,
      );

      return {
        modelId: kimiModel.id,
        provider: kimiModel.provider,
        confidence: kimiDecision.confidence,
        reasoning: [
          ...kimiDecision.reasons,
          "Selected for capability with cost optimization",
        ],
        estimatedCost: {
          usd: costEstimate.usd,
          vsClaudeSavings: claudeCost.usd - costEstimate.usd,
          savingsPercent:
            ((claudeCost.usd - costEstimate.usd) / claudeCost.usd) * 100,
        },
        optimizations: {
          promptOptimized: true,
          temperature: KIMI_K25_CONFIG.temperature.default,
        },
      };
    }
  }

  // Fall back to standard selection
  return selectModelEnhanced(context);
}

/**
 * Batch routing for multiple requests
 * Optimizes cost across the batch
 */
export function batchRoute(requests: EnhancedRouterContext[]): {
  decisions: RoutingDecision[];
  totalCost: number;
  totalSavings: number;
  kimiUsagePercent: number;
} {
  const decisions = requests.map((ctx) => selectModelEnhanced(ctx));

  const totalCost = decisions.reduce((sum, d) => sum + d.estimatedCost.usd, 0);
  const totalSavings = decisions.reduce(
    (sum, d) => sum + (d.estimatedCost.vsClaudeSavings || 0),
    0,
  );
  const kimiUsage = decisions.filter((d) => d.modelId.includes("kimi")).length;
  const kimiUsagePercent = (kimiUsage / decisions.length) * 100;

  logger.info(
    {
      totalRequests: requests.length,
      totalCost: `$${totalCost.toFixed(4)}`,
      totalSavings: `$${totalSavings.toFixed(4)}`,
      kimiUsagePercent: `${kimiUsagePercent.toFixed(1)}%`,
    },
    "Batch routing completed",
  );

  return {
    decisions,
    totalCost,
    totalSavings,
    kimiUsagePercent,
  };
}

/**
 * Re-export base router functions for compatibility
 */
export { calculateComplexity as estimateTaskComplexity };

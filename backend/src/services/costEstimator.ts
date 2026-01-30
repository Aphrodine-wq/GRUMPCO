/**
 * Cost Estimator
 * Pre-flight cost estimation for LLM requests
 */

import { MODEL_REGISTRY, type ModelConfig } from '@grump/ai-core';
import logger from '../middleware/logger.js';

export interface CostEstimate {
  estimatedCost: number;
  breakdown: {
    inputCost: number;
    outputCost: number;
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface EstimationOptions {
  model?: string;
  provider?: string;
  includeSystemPrompt?: boolean;
  expectedOutputRatio?: number; // Output tokens as ratio of input (default: 0.5)
}

export class CostEstimator {
  /**
   * Estimate tokens from text (rough approximation)
   * 1 token ≈ 4 characters for English text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost for a chat request
   */
  public estimateChatCost(
    messages: Array<{ role: string; content: string }>,
    options: EstimationOptions = {}
  ): CostEstimate {
    // Calculate input tokens
    const inputText = messages.map((m) => m.content).join(' ');
    const inputTokens = this.estimateTokens(inputText);

    // Estimate output tokens (default: 50% of input)
    const outputRatio = options.expectedOutputRatio ?? 0.5;
    const outputTokens = Math.ceil(inputTokens * outputRatio);

    // Find model config
    const modelId = options.model || 'claude-3-5-sonnet-20241022';
    const modelConfig = MODEL_REGISTRY.find((m) => m.id === modelId);

    if (!modelConfig) {
      logger.warn({ model: modelId }, 'Model not found in registry');
      return {
        estimatedCost: 0,
        breakdown: {
          inputCost: 0,
          outputCost: 0,
          inputTokens,
          outputTokens,
        },
        model: modelId,
        confidence: 'low',
      };
    }

    // Calculate costs
    const inputCost = (inputTokens / 1_000_000) * (modelConfig.costPerMillionInput || 0);
    const outputCost = (outputTokens / 1_000_000) * (modelConfig.costPerMillionOutput || 0);
    const estimatedCost = inputCost + outputCost;

    // Determine confidence based on message complexity
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (messages.length === 1 && inputTokens < 1000) {
      confidence = 'high'; // Simple, single message
    } else if (messages.length > 10 || inputTokens > 10000) {
      confidence = 'low'; // Complex conversation
    }

    logger.debug(
      {
        model: modelId,
        inputTokens,
        outputTokens,
        estimatedCost,
        confidence,
      },
      'Cost estimated'
    );

    return {
      estimatedCost,
      breakdown: {
        inputCost,
        outputCost,
        inputTokens,
        outputTokens,
      },
      model: modelId,
      confidence,
    };
  }

  /**
   * Estimate cost for code generation
   */
  public estimateCodeGenCost(
    description: string,
    complexity: 'simple' | 'medium' | 'complex' = 'medium'
  ): CostEstimate {
    const baseTokens = this.estimateTokens(description);

    // Code generation typically has higher output
    const outputMultipliers = {
      simple: 2, // 2x input
      medium: 5, // 5x input
      complex: 10, // 10x input
    };

    const outputRatio = outputMultipliers[complexity];
    const outputTokens = baseTokens * outputRatio;

    // Use a code-optimized model
    const model = 'claude-3-5-sonnet-20241022';
    const modelConfig = MODEL_REGISTRY.find((m) => m.id === model);

    if (!modelConfig) {
      return {
        estimatedCost: 0,
        breakdown: {
          inputCost: 0,
          outputCost: 0,
          inputTokens: baseTokens,
          outputTokens,
        },
        model,
        confidence: 'low',
      };
    }

    const inputCost = (baseTokens / 1_000_000) * (modelConfig.costPerMillionInput || 0);
    const outputCost = (outputTokens / 1_000_000) * (modelConfig.costPerMillionOutput || 0);

    return {
      estimatedCost: inputCost + outputCost,
      breakdown: {
        inputCost,
        outputCost,
        inputTokens: baseTokens,
        outputTokens,
      },
      model,
      confidence: 'medium',
    };
  }

  /**
   * Compare costs across different models
   */
  public compareModels(
    messages: Array<{ role: string; content: string }>,
    models: string[]
  ): Array<CostEstimate & { modelName: string }> {
    return models.map((modelId) => {
      const estimate = this.estimateChatCost(messages, { model: modelId });
      const modelConfig = MODEL_REGISTRY.find((m) => m.id === modelId);
      
      return {
        ...estimate,
        modelName: modelConfig?.name || modelId,
      };
    }).sort((a, b) => a.estimatedCost - b.estimatedCost);
  }

  /**
   * Get cost-saving recommendations
   */
  public getRecommendations(
    currentCost: number,
    monthlyBudget: number
  ): Array<{ type: string; message: string; potentialSavings: number }> {
    const recommendations: Array<{ type: string; message: string; potentialSavings: number }> = [];
    const projectedMonthlyCost = currentCost * 30; // Rough projection

    if (projectedMonthlyCost > monthlyBudget) {
      const overage = projectedMonthlyCost - monthlyBudget;
      recommendations.push({
        type: 'budget',
        message: `Projected monthly cost ($${projectedMonthlyCost.toFixed(2)}) exceeds budget ($${monthlyBudget.toFixed(2)})`,
        potentialSavings: overage,
      });
    }

    // Recommend cheaper models
    recommendations.push({
      type: 'model',
      message: 'Switch to Claude Haiku for simple tasks to save 40-60%',
      potentialSavings: currentCost * 0.5,
    });

    // Recommend caching
    recommendations.push({
      type: 'caching',
      message: 'Enable prompt caching to reduce costs by 30-40%',
      potentialSavings: currentCost * 0.35,
    });

    // Recommend batching
    recommendations.push({
      type: 'batching',
      message: 'Batch similar requests together to reduce overhead',
      potentialSavings: currentCost * 0.15,
    });

    return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }
}

// Singleton instance
let costEstimator: CostEstimator | null = null;

/**
 * Get or create the global cost estimator
 */
export function getCostEstimator(): CostEstimator {
  if (!costEstimator) {
    costEstimator = new CostEstimator();
  }
  return costEstimator;
}

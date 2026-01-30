/**
 * Cost Optimizer
 * Intelligent model routing based on task complexity and cost
 */

import { MODEL_REGISTRY, type ModelConfig, type LLMProvider } from '@grump/ai-core';
import logger from '../middleware/logger.js';

export interface TaskComplexity {
  score: number; // 0-100
  factors: {
    messageLength: number;
    contextSize: number;
    requiresReasoning: boolean;
    requiresCreativity: boolean;
    requiresAccuracy: boolean;
    hasCodeGeneration: boolean;
    hasMultiStep: boolean;
  };
}

export interface ModelSelection {
  provider: LLMProvider;
  modelId: string;
  estimatedCost: number;
  reasoning: string;
}

export interface CostOptimizationOptions {
  maxCostPerRequest?: number;
  preferCheaper?: boolean;
  requireCapability?: string[];
  allowedProviders?: LLMProvider[];
}

export class CostOptimizer {
  private costSavings = {
    totalRequests: 0,
    cheapModelUsed: 0,
    estimatedSavings: 0,
  };

  /**
   * Analyze task complexity from message content
   */
  public analyzeComplexity(
    messages: Array<{ role: string; content: string }>,
    mode?: string
  ): TaskComplexity {
    const fullText = messages.map((m) => m.content).join(' ');
    const messageLength = fullText.length;
    const contextSize = messages.length;

    // Detect complexity indicators
    const requiresReasoning =
      /\b(analyze|evaluate|compare|explain why|reasoning|logic|deduce)\b/i.test(fullText);
    
    const requiresCreativity =
      /\b(creative|innovative|unique|original|brainstorm|imagine)\b/i.test(fullText);
    
    const requiresAccuracy =
      /\b(precise|exact|accurate|correct|verify|validate)\b/i.test(fullText) ||
      mode === 'spec' ||
      mode === 'architecture';
    
    const hasCodeGeneration =
      /\b(code|function|class|implement|build|develop|program)\b/i.test(fullText) ||
      mode === 'ship' ||
      mode === 'codegen';
    
    const hasMultiStep =
      /\b(first|then|next|finally|step|phase|stage)\b/i.test(fullText) ||
      contextSize > 5;

    // Calculate complexity score (0-100)
    let score = 0;
    
    // Base score from message length
    if (messageLength < 500) score += 10;
    else if (messageLength < 2000) score += 30;
    else if (messageLength < 5000) score += 50;
    else score += 70;

    // Add complexity factors
    if (requiresReasoning) score += 15;
    if (requiresCreativity) score += 10;
    if (requiresAccuracy) score += 15;
    if (hasCodeGeneration) score += 20;
    if (hasMultiStep) score += 10;
    if (contextSize > 10) score += 10;

    // Cap at 100
    score = Math.min(100, score);

    return {
      score,
      factors: {
        messageLength,
        contextSize,
        requiresReasoning,
        requiresCreativity,
        requiresAccuracy,
        hasCodeGeneration,
        hasMultiStep,
      },
    };
  }

  /**
   * Select optimal model based on complexity and cost
   */
  public selectModel(
    complexity: TaskComplexity,
    options: CostOptimizationOptions = {}
  ): ModelSelection {
    this.costSavings.totalRequests++;

    const allowedModels = MODEL_REGISTRY.filter((model) => {
      // Filter by allowed providers
      if (options.allowedProviders && !options.allowedProviders.includes(model.provider)) {
        return false;
      }

      // Filter by required capabilities
      if (options.requireCapability) {
        const hasAllCapabilities = options.requireCapability.every((cap) =>
          model.capabilities.includes(cap as any)
        );
        if (!hasAllCapabilities) return false;
      }

      return true;
    });

    if (allowedModels.length === 0) {
      throw new Error('No models available with required capabilities');
    }

    // Sort by cost (cheaper first)
    const sortedModels = allowedModels.sort((a, b) => {
      const costA = (a.costPerMillionInput || 0) + (a.costPerMillionOutput || 0);
      const costB = (b.costPerMillionInput || 0) + (b.costPerMillionOutput || 0);
      return costA - costB;
    });

    // Decision logic
    let selectedModel: ModelConfig;
    let reasoning: string;

    if (complexity.score < 30 && !complexity.factors.requiresAccuracy) {
      // Simple task: use cheapest model
      selectedModel = sortedModels[0];
      reasoning = 'Simple task, using most cost-effective model';
      this.costSavings.cheapModelUsed++;
    } else if (complexity.score < 60 && !complexity.factors.hasCodeGeneration) {
      // Medium complexity: use mid-tier model if available
      const midTierModels = sortedModels.filter((m) => {
        const cost = (m.costPerMillionInput || 0) + (m.costPerMillionOutput || 0);
        return cost > 1 && cost < 10;
      });
      
      selectedModel = midTierModels.length > 0 ? midTierModels[0] : sortedModels[0];
      reasoning = 'Medium complexity, using balanced model';
      
      if (selectedModel === sortedModels[0]) {
        this.costSavings.cheapModelUsed++;
      }
    } else {
      // Complex task: use best model
      selectedModel = sortedModels[sortedModels.length - 1];
      reasoning = 'Complex task requiring high-capability model';
    }

    // Check cost limit
    if (options.maxCostPerRequest) {
      const maxCost = options.maxCostPerRequest;
      const estimatedCost = this.estimateCost(selectedModel, complexity.factors.messageLength);
      if (estimatedCost > maxCost) {
        // Find cheaper alternative
        const cheaperModel = sortedModels.find((m) => {
          const cost = this.estimateCost(m, complexity.factors.messageLength);
          return cost <= maxCost;
        });

        if (cheaperModel) {
          selectedModel = cheaperModel;
          reasoning = 'Cost limit enforced, using cheaper alternative';
          this.costSavings.cheapModelUsed++;
        } else {
          logger.warn(
            { maxCost: options.maxCostPerRequest, estimatedCost },
            'No model within cost limit'
          );
        }
      }
    }

    const estimatedCost = this.estimateCost(selectedModel, complexity.factors.messageLength);

    // Track savings
    const expensiveModelCost = this.estimateCost(
      sortedModels[sortedModels.length - 1],
      complexity.factors.messageLength
    );
    this.costSavings.estimatedSavings += expensiveModelCost - estimatedCost;

    logger.debug(
      {
        complexity: complexity.score,
        model: selectedModel.id,
        estimatedCost,
        reasoning,
      },
      'Model selected'
    );

    return {
      provider: selectedModel.provider,
      modelId: selectedModel.id,
      estimatedCost,
      reasoning,
    };
  }

  /**
   * Estimate cost for a request
   */
  private estimateCost(model: ModelConfig, messageLength: number): number {
    // Rough estimation: 1 char ≈ 0.25 tokens
    const estimatedTokens = Math.ceil(messageLength / 4);
    const inputCost = ((model.costPerMillionInput || 0) * estimatedTokens) / 1_000_000;
    
    // Assume output is 50% of input length
    const outputTokens = Math.ceil(estimatedTokens * 0.5);
    const outputCost = ((model.costPerMillionOutput || 0) * outputTokens) / 1_000_000;

    return inputCost + outputCost;
  }

  /**
   * Get cost savings statistics
   */
  public getSavings(): {
    totalRequests: number;
    cheapModelUsed: number;
    cheapModelPercentage: number;
    estimatedSavings: number;
  } {
    return {
      ...this.costSavings,
      cheapModelPercentage:
        this.costSavings.totalRequests > 0
          ? (this.costSavings.cheapModelUsed / this.costSavings.totalRequests) * 100
          : 0,
    };
  }

  /**
   * Reset savings statistics
   */
  public resetSavings(): void {
    this.costSavings = {
      totalRequests: 0,
      cheapModelUsed: 0,
      estimatedSavings: 0,
    };
  }

  /**
   * Get model recommendations for a task
   */
  public getRecommendations(
    complexity: TaskComplexity
  ): Array<{ model: ModelConfig; suitability: number; reason: string }> {
    const recommendations = MODEL_REGISTRY.map((model) => {
      let suitability = 50; // Base score

      // Adjust based on complexity
      if (complexity.score < 30) {
        // Simple tasks: prefer cheaper models
        const cost = (model.costPerMillionInput || 0) + (model.costPerMillionOutput || 0);
        suitability += cost < 1 ? 30 : cost < 5 ? 10 : -20;
      } else if (complexity.score > 70) {
        // Complex tasks: prefer capable models
        suitability += model.capabilities.length * 5;
      }

      // Adjust based on capabilities
      if (complexity.factors.hasCodeGeneration && model.capabilities.includes('code')) {
        suitability += 20;
      }
      if (complexity.factors.requiresReasoning && model.capabilities.includes('agent')) {
        suitability += 15;
      }
      if (complexity.factors.messageLength > 50000 && model.capabilities.includes('long-context')) {
        suitability += 25;
      }

      const reason = this.generateRecommendationReason(model, complexity);

      return { model, suitability, reason };
    });

    return recommendations.sort((a, b) => b.suitability - a.suitability);
  }

  private generateRecommendationReason(model: ModelConfig, complexity: TaskComplexity): string {
    const reasons: string[] = [];

    if (complexity.score < 30) {
      reasons.push('Cost-effective for simple tasks');
    } else if (complexity.score > 70) {
      reasons.push('High capability for complex tasks');
    }

    if (complexity.factors.hasCodeGeneration && model.capabilities.includes('code')) {
      reasons.push('Optimized for code generation');
    }

    if (model.capabilities.includes('long-context') && complexity.factors.messageLength > 50000) {
      reasons.push('Supports large context windows');
    }

    const cost = (model.costPerMillionInput || 0) + (model.costPerMillionOutput || 0);
    if (cost < 1) {
      reasons.push('Very low cost');
    } else if (cost > 10) {
      reasons.push('Premium model with advanced capabilities');
    }

    return reasons.join('; ') || 'General purpose model';
  }
}

// Singleton instance
let costOptimizer: CostOptimizer | null = null;

/**
 * Get or create the global cost optimizer
 */
export function getCostOptimizer(): CostOptimizer {
  if (!costOptimizer) {
    costOptimizer = new CostOptimizer();
  }
  return costOptimizer;
}

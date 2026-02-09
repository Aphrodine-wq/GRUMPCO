/**
 * Strategy Selector
 *
 * Selects the best execution strategy based on task complexity,
 * risk level, cost, pattern availability, and time constraints.
 *
 * @fileoverview Extracted from powerExpansion.ts
 * @module gAgent/strategySelector
 */

import type { RiskLevel } from "./systemPrompt.js";
import type { Strategy, StrategySelection } from "./powerExpansion.types.js";
import { STRATEGIES } from "./powerExpansion.types.js";

// ============================================================================
// STRATEGY SELECTOR
// ============================================================================

/**
 * Selects the best execution strategy based on context
 */
export class StrategySelector {
    /**
     * Select best strategy for a task
     */
    select(params: {
        taskDescription: string;
        complexity: number;
        estimatedCost: number;
        riskLevel: RiskLevel;
        hasPattern: boolean;
        timeConstraint?: "relaxed" | "normal" | "urgent";
        userPreference?: Strategy;
    }): StrategySelection {
        const alternatives: Array<{ strategy: Strategy; confidence: number }> = [];
        let bestStrategy: Strategy = STRATEGIES.DIRECT;
        let bestConfidence = 0;

        // Calculate confidence for each strategy
        const strategies: Array<{ strategy: Strategy; baseScore: number }> = [
            { strategy: STRATEGIES.DIRECT, baseScore: 0.7 },
            { strategy: STRATEGIES.DECOMPOSE, baseScore: 0.6 },
            { strategy: STRATEGIES.ITERATIVE, baseScore: 0.65 },
            { strategy: STRATEGIES.PARALLEL, baseScore: 0.5 },
            { strategy: STRATEGIES.CONSERVATIVE, baseScore: 0.6 },
            { strategy: STRATEGIES.AGGRESSIVE, baseScore: 0.4 },
        ];

        for (const { strategy, baseScore } of strategies) {
            let confidence = baseScore;

            // Adjust based on complexity
            if (strategy === STRATEGIES.DIRECT && params.complexity > 0.7) {
                confidence -= 0.3;
            }
            if (strategy === STRATEGIES.DECOMPOSE && params.complexity > 0.5) {
                confidence += 0.2;
            }

            // Adjust based on risk
            if (
                strategy === STRATEGIES.AGGRESSIVE &&
                params.riskLevel !== "minimal"
            ) {
                confidence -= 0.2;
            }
            if (strategy === STRATEGIES.CONSERVATIVE && params.riskLevel === "high") {
                confidence += 0.2;
            }

            // Adjust based on pattern availability
            if (strategy === STRATEGIES.DIRECT && params.hasPattern) {
                confidence += 0.2;
            }

            // Adjust based on time constraint
            if (params.timeConstraint === "urgent") {
                if (
                    strategy === STRATEGIES.DIRECT ||
                    strategy === STRATEGIES.AGGRESSIVE
                ) {
                    confidence += 0.1;
                }
                if (
                    strategy === STRATEGIES.ITERATIVE ||
                    strategy === STRATEGIES.CONSERVATIVE
                ) {
                    confidence -= 0.1;
                }
            }

            // User preference bonus
            if (params.userPreference === strategy) {
                confidence += 0.15;
            }

            confidence = Math.max(0, Math.min(1, confidence));
            alternatives.push({ strategy, confidence });

            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestStrategy = strategy;
            }
        }

        // Sort alternatives by confidence
        alternatives.sort((a, b) => b.confidence - a.confidence);

        // Generate reasoning
        let reasoning = `Selected ${bestStrategy} strategy with ${Math.round(bestConfidence * 100)}% confidence. `;
        if (params.complexity > 0.7) {
            reasoning += "Task complexity is high. ";
        }
        if (params.riskLevel !== "minimal" && params.riskLevel !== "low") {
            reasoning += `Risk level is ${params.riskLevel}. `;
        }
        if (params.hasPattern) {
            reasoning += "Matching pattern found. ";
        }

        return {
            strategy: bestStrategy,
            confidence: bestConfidence,
            reasoning,
            alternatives: alternatives.slice(1),
        };
    }
}

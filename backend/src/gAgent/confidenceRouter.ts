/**
 * Confidence Router
 *
 * Routes decisions based on confidence analysis, determining whether
 * to auto-execute, suggest and wait, ask explicitly, decompose, or decline.
 *
 * @fileoverview Extracted from powerExpansion.ts
 * @module gAgent/confidenceRouter
 */

import {
    DEFAULT_CONFIDENCE_THRESHOLDS,
    RISK_FACTORS,
    type ConfidenceThresholds,
} from "./systemPrompt.js";
import type { ConfidenceAnalysis, ConfidenceAction, ConfidenceFactor } from "./powerExpansion.types.js";

// ============================================================================
// CONFIDENCE ROUTER
// ============================================================================

/**
 * Routes decisions based on confidence analysis
 */
export class ConfidenceRouter {
    private thresholds: ConfidenceThresholds;

    constructor(
        thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS,
    ) {
        this.thresholds = thresholds;
    }

    /**
     * Analyze confidence for an operation
     */
    analyze(params: {
        taskDescription: string;
        previousSuccess?: boolean;
        similarPatternFound?: boolean;
        estimatedCost: number;
        riskFactors: string[];
        contextQuality: number; // 0-1, how clear is the user's intent
        historyAvailable: boolean;
    }): ConfidenceAnalysis {
        const factors: ConfidenceFactor[] = [];

        // Factor 1: Context clarity
        const contextFactor: ConfidenceFactor = {
            name: "context_clarity",
            weight: 0.25,
            score: params.contextQuality,
            contribution: 0.25 * params.contextQuality,
        };
        factors.push(contextFactor);

        // Factor 2: Previous success with similar tasks
        const historyScore = params.previousSuccess
            ? 0.9
            : params.historyAvailable
                ? 0.5
                : 0.4;
        const historyFactor: ConfidenceFactor = {
            name: "history",
            weight: 0.2,
            score: historyScore,
            contribution: 0.2 * historyScore,
        };
        factors.push(historyFactor);

        // Factor 3: Pattern match
        const patternScore = params.similarPatternFound ? 0.95 : 0.3;
        const patternFactor: ConfidenceFactor = {
            name: "pattern_match",
            weight: 0.2,
            score: patternScore,
            contribution: 0.2 * patternScore,
        };
        factors.push(patternFactor);

        // Factor 4: Risk assessment (inverse - higher risk = lower confidence)
        const totalRisk = params.riskFactors.reduce((sum, factor) => {
            return sum + (RISK_FACTORS[factor] || 0);
        }, 0);
        const normalizedRisk = Math.min(totalRisk / 100, 1);
        const riskScore = 1 - normalizedRisk;
        const riskFactor: ConfidenceFactor = {
            name: "risk_level",
            weight: 0.2,
            score: riskScore,
            contribution: 0.2 * riskScore,
        };
        factors.push(riskFactor);

        // Factor 5: Cost consideration (lower cost = higher confidence)
        const costScore =
            params.estimatedCost < 10
                ? 0.95
                : params.estimatedCost < 50
                    ? 0.8
                    : params.estimatedCost < 100
                        ? 0.6
                        : params.estimatedCost < 500
                            ? 0.4
                            : 0.2;
        const costFactor: ConfidenceFactor = {
            name: "cost",
            weight: 0.15,
            score: costScore,
            contribution: 0.15 * costScore,
        };
        factors.push(costFactor);

        // Calculate total confidence
        const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);

        // Determine action
        let action: ConfidenceAction;
        let reason: string;

        if (totalScore >= this.thresholds.autoExecute) {
            action = "auto_execute";
            reason = "High confidence - proceeding automatically";
        } else if (totalScore >= this.thresholds.suggestAndWait) {
            action = "suggest_and_wait";
            reason = "Good confidence - suggesting plan, awaiting brief confirmation";
        } else if (totalScore >= this.thresholds.askExplicitly) {
            // Check if complexity is the main issue
            if (params.contextQuality < 0.5) {
                action = "decompose";
                reason = "Request is complex or unclear - breaking down for clarity";
            } else {
                action = "ask_explicitly";
                reason = "Moderate confidence - requesting explicit confirmation";
            }
        } else if (totalScore >= this.thresholds.decline) {
            action = "ask_explicitly";
            reason = "Low confidence - cannot proceed without explicit confirmation";
        } else {
            action = "decline";
            reason =
                "Very low confidence - declining to proceed. Please clarify or simplify the request.";
        }

        return {
            score: totalScore,
            factors,
            action,
            reason,
        };
    }

    /**
     * Update thresholds
     */
    setThresholds(thresholds: Partial<ConfidenceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }
}

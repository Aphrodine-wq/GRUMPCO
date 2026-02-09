/**
 * Power Expansion Types & Constants
 *
 * Shared type definitions and constants for the Power Expansion module.
 *
 * @fileoverview Type definitions extracted from powerExpansion.ts
 * @module gAgent/powerExpansion.types
 */

import type { Pattern } from "./types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum retry attempts for self-healing
 */
export const MAX_HEALING_RETRIES = 3;

/**
 * Strategy types for different approaches
 */
export const STRATEGIES = {
    DIRECT: "direct", // Direct approach
    DECOMPOSE: "decompose", // Break into smaller tasks
    ITERATIVE: "iterative", // Step-by-step with feedback
    PARALLEL: "parallel", // Multi-agent parallel execution
    CONSERVATIVE: "conservative", // Safe, slower approach
    AGGRESSIVE: "aggressive", // Fast, higher risk approach
} as const;

export type Strategy = (typeof STRATEGIES)[keyof typeof STRATEGIES];

// ============================================================================
// TYPES
// ============================================================================

export interface ConfidenceAnalysis {
    score: number; // 0-1
    factors: ConfidenceFactor[];
    action: ConfidenceAction;
    reason: string;
}

export interface ConfidenceFactor {
    name: string;
    weight: number;
    score: number;
    contribution: number;
}

export type ConfidenceAction =
    | "auto_execute" // High confidence, just do it
    | "suggest_and_wait" // Suggest plan, wait for brief period
    | "ask_explicitly" // Ask for explicit confirmation
    | "decline" // Too risky/uncertain, decline
    | "decompose"; // Too complex, break down first

export interface HealingAttempt {
    id: string;
    originalError: string;
    errorType: ErrorType;
    strategy: string;
    adjustments: string[];
    timestamp: string;
    success: boolean;
    resultError?: string;
}

export type ErrorType =
    | "parsing_error"
    | "timeout_error"
    | "resource_error"
    | "validation_error"
    | "api_error"
    | "permission_error"
    | "unknown_error";

export interface SelfHealingContext {
    taskId: string;
    goalId?: string;
    attempts: HealingAttempt[];
    currentStrategy: Strategy;
    originalRequest: string;
    adjustedRequest?: string;
}

export interface TaskDecomposition {
    original: string;
    subtasks: DecomposedTask[];
    dependencies: Map<string, string[]>;
    estimatedComplexity: number;
    parallelizable: boolean;
}

export interface DecomposedTask {
    id: string;
    description: string;
    suggestedAgent: import("./types.js").AgentType;
    estimatedTokens: number;
    riskLevel: import("./systemPrompt.js").RiskLevel;
    dependsOn: string[];
}

export interface StrategySelection {
    strategy: Strategy;
    confidence: number;
    reasoning: string;
    alternatives: Array<{ strategy: Strategy; confidence: number }>;
}

export interface LearningRecord {
    id: string;
    patternId?: string;
    taskDescription: string;
    strategy: Strategy;
    success: boolean;
    durationMs: number;
    tokensUsed: number;
    adjustments: string[];
    timestamp: string;
}

export type PowerEvent =
    | { type: "confidence_analyzed"; analysis: ConfidenceAnalysis }
    | { type: "healing_attempted"; attempt: HealingAttempt }
    | { type: "healing_succeeded"; context: SelfHealingContext }
    | { type: "healing_exhausted"; context: SelfHealingContext }
    | { type: "task_decomposed"; decomposition: TaskDecomposition }
    | { type: "strategy_selected"; selection: StrategySelection }
    | { type: "pattern_matched"; pattern: Pattern; confidence: number }
    | { type: "pattern_learned"; patternId: string };

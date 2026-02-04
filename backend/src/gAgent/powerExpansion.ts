/**
 * G-Agent Power Expansion
 *
 * Advanced capabilities that make G-Agent SUPERIOR to competitors.
 * This module provides:
 * - Self-healing loops: On failure, analyze → adjust strategy → retry
 * - Confidence routing: High confidence = auto-execute, Low = ask human
 * - Pattern learning: Remember and apply successful approaches
 * - Task decomposition: Auto-break complex tasks into smaller steps
 * - Adaptive strategy selection: Choose best approach based on context
 *
 * @module gAgent/powerExpansion
 */

import { EventEmitter } from "events";
import { messageBus } from "./messageBus.js";
import {
  DEFAULT_CONFIDENCE_THRESHOLDS,
  calculateRiskLevel,
  RISK_FACTORS,
  type ConfidenceThresholds,
  type RiskLevel,
} from "./systemPrompt.js";
import type { AgentType, Task, Plan, Pattern, PatternTask } from "./types.js";

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
  suggestedAgent: AgentType;
  estimatedTokens: number;
  riskLevel: RiskLevel;
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

// ============================================================================
// SELF-HEALING ENGINE
// ============================================================================

/**
 * Self-healing engine that recovers from failures
 */
export class SelfHealingEngine extends EventEmitter {
  private contexts: Map<string, SelfHealingContext> = new Map();

  /**
   * Classify an error type
   */
  classifyError(error: Error | string): ErrorType {
    const errorStr = typeof error === "string" ? error : error.message;
    const lowerError = errorStr.toLowerCase();

    if (
      lowerError.includes("parse") ||
      lowerError.includes("json") ||
      lowerError.includes("syntax")
    ) {
      return "parsing_error";
    }
    if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
      return "timeout_error";
    }
    if (
      lowerError.includes("memory") ||
      lowerError.includes("resource") ||
      lowerError.includes("quota")
    ) {
      return "resource_error";
    }
    if (
      lowerError.includes("valid") ||
      lowerError.includes("schema") ||
      lowerError.includes("required")
    ) {
      return "validation_error";
    }
    if (
      lowerError.includes("api") ||
      lowerError.includes("rate limit") ||
      lowerError.includes("429")
    ) {
      return "api_error";
    }
    if (
      lowerError.includes("permission") ||
      lowerError.includes("denied") ||
      lowerError.includes("403")
    ) {
      return "permission_error";
    }

    return "unknown_error";
  }

  /**
   * Generate healing strategy based on error type
   */
  generateHealingStrategy(
    errorType: ErrorType,
    attemptNumber: number,
  ): { strategy: string; adjustments: string[] } {
    const strategies: Record<
      ErrorType,
      Array<{ strategy: string; adjustments: string[] }>
    > = {
      parsing_error: [
        {
          strategy: "simplify_output",
          adjustments: [
            "Request simpler output format",
            "Add explicit formatting instructions",
          ],
        },
        {
          strategy: "step_by_step",
          adjustments: [
            "Break into smaller steps",
            "Validate each step output",
          ],
        },
        {
          strategy: "fallback_parser",
          adjustments: ["Use lenient parsing", "Extract partial results"],
        },
      ],
      timeout_error: [
        {
          strategy: "reduce_scope",
          adjustments: ["Process fewer items", "Use smaller context window"],
        },
        {
          strategy: "batch_processing",
          adjustments: ["Split into batches", "Process incrementally"],
        },
        {
          strategy: "increase_timeout",
          adjustments: ["Extend timeout", "Add progress checkpoints"],
        },
      ],
      resource_error: [
        {
          strategy: "reduce_complexity",
          adjustments: ["Use smaller model", "Reduce context size"],
        },
        {
          strategy: "cleanup_resources",
          adjustments: ["Release unused resources", "Wait for resources"],
        },
        {
          strategy: "prioritize",
          adjustments: ["Focus on essential parts", "Skip non-critical tasks"],
        },
      ],
      validation_error: [
        {
          strategy: "fix_input",
          adjustments: ["Sanitize input", "Add missing fields"],
        },
        {
          strategy: "use_defaults",
          adjustments: ["Apply default values", "Relax constraints"],
        },
        {
          strategy: "request_correction",
          adjustments: ["Ask user for corrections", "Provide examples"],
        },
      ],
      api_error: [
        {
          strategy: "retry_with_backoff",
          adjustments: ["Wait before retry", "Exponential backoff"],
        },
        {
          strategy: "fallback_provider",
          adjustments: ["Try alternative model", "Use cached results"],
        },
        {
          strategy: "queue_for_later",
          adjustments: ["Schedule retry", "Notify when available"],
        },
      ],
      permission_error: [
        {
          strategy: "request_access",
          adjustments: ["Ask for permissions", "Explain requirements"],
        },
        {
          strategy: "workaround",
          adjustments: [
            "Use alternative approach",
            "Skip restricted operations",
          ],
        },
        {
          strategy: "escalate",
          adjustments: ["Escalate to admin", "Request manual intervention"],
        },
      ],
      unknown_error: [
        {
          strategy: "simplify",
          adjustments: ["Simplify request", "Remove complex parts"],
        },
        {
          strategy: "isolate",
          adjustments: ["Test individual components", "Identify failure point"],
        },
        {
          strategy: "human_assistance",
          adjustments: ["Request human review", "Provide error details"],
        },
      ],
    };

    const errorStrategies = strategies[errorType];
    const strategyIndex = Math.min(attemptNumber, errorStrategies.length - 1);
    return errorStrategies[strategyIndex];
  }

  /**
   * Start a healing context for a failed task
   */
  startHealing(
    taskId: string,
    originalRequest: string,
    originalError: string,
    goalId?: string,
  ): SelfHealingContext {
    const context: SelfHealingContext = {
      taskId,
      goalId,
      attempts: [],
      currentStrategy: STRATEGIES.DIRECT,
      originalRequest,
    };

    this.contexts.set(taskId, context);
    return context;
  }

  /**
   * Attempt to heal from a failure
   */
  async attemptHealing(
    taskId: string,
    currentError: string,
    executeAdjusted: (
      adjustedRequest: string,
      adjustments: string[],
    ) => Promise<boolean>,
  ): Promise<boolean> {
    const context = this.contexts.get(taskId);
    if (!context) {
      console.warn(`[SelfHealing] No context for task: ${taskId}`);
      return false;
    }

    if (context.attempts.length >= MAX_HEALING_RETRIES) {
      console.log(`[SelfHealing] Max retries exhausted for task: ${taskId}`);
      this.emit("power", { type: "healing_exhausted", context });
      return false;
    }

    const errorType = this.classifyError(currentError);
    const attemptNumber = context.attempts.length;
    const { strategy, adjustments } = this.generateHealingStrategy(
      errorType,
      attemptNumber,
    );

    console.log(
      `[SelfHealing] Attempt ${attemptNumber + 1}/${MAX_HEALING_RETRIES} for ${taskId}`,
    );
    console.log(
      `[SelfHealing] Strategy: ${strategy}, Adjustments: ${adjustments.join(", ")}`,
    );

    // Create attempt record
    const attempt: HealingAttempt = {
      id: crypto.randomUUID(),
      originalError: currentError,
      errorType,
      strategy,
      adjustments,
      timestamp: new Date().toISOString(),
      success: false,
    };

    context.attempts.push(attempt);

    // Adjust the request based on strategy
    const adjustedRequest = this.adjustRequest(
      context.originalRequest,
      strategy,
      adjustments,
    );
    context.adjustedRequest = adjustedRequest;

    this.emit("power", { type: "healing_attempted", attempt });

    try {
      const success = await executeAdjusted(adjustedRequest, adjustments);
      attempt.success = success;

      if (success) {
        console.log(`[SelfHealing] Healing succeeded for task: ${taskId}`);
        this.emit("power", { type: "healing_succeeded", context });
      }

      return success;
    } catch (err) {
      attempt.resultError = (err as Error).message;
      console.log(
        `[SelfHealing] Healing attempt failed: ${attempt.resultError}`,
      );
      return false;
    }
  }

  /**
   * Adjust request based on strategy
   */
  private adjustRequest(
    originalRequest: string,
    strategy: string,
    _adjustments: string[],
  ): string {
    // In production, this would use more sophisticated request modification
    // For now, we add hints to the request
    let adjusted = originalRequest;

    switch (strategy) {
      case "simplify_output":
        adjusted +=
          "\n\nNote: Please provide a simple, well-formatted response.";
        break;
      case "step_by_step":
        adjusted +=
          "\n\nNote: Please break this down into clear, numbered steps.";
        break;
      case "reduce_scope":
        adjusted +=
          "\n\nNote: Please focus on the most essential aspects only.";
        break;
      case "simplify":
        adjusted +=
          "\n\nNote: Please provide a simplified approach to this task.";
        break;
      default:
        adjusted += `\n\nNote: Adjusted approach using ${strategy} strategy.`;
    }

    return adjusted;
  }

  /**
   * Get healing context
   */
  getContext(taskId: string): SelfHealingContext | undefined {
    return this.contexts.get(taskId);
  }

  /**
   * Clear completed healing context
   */
  clearContext(taskId: string): void {
    this.contexts.delete(taskId);
  }
}

// ============================================================================
// TASK DECOMPOSER
// ============================================================================

/**
 * Decomposes complex tasks into manageable subtasks
 */
export class TaskDecomposer {
  /**
   * Analyze task complexity
   */
  analyzeComplexity(taskDescription: string): number {
    const indicators = {
      length: taskDescription.length / 500, // Longer = more complex
      andCount: (taskDescription.match(/\band\b/gi) || []).length * 0.1,
      orCount: (taskDescription.match(/\bor\b/gi) || []).length * 0.1,
      conditionals:
        (taskDescription.match(/\bif\b|\bwhen\b|\bunless\b/gi) || []).length *
        0.15,
      lists: (taskDescription.match(/\d+\.\s|\*\s|-\s/g) || []).length * 0.05,
      techTerms: this.countTechTerms(taskDescription) * 0.1,
    };

    const total = Object.values(indicators).reduce((sum, val) => sum + val, 0);
    return Math.min(total, 1);
  }

  private countTechTerms(text: string): number {
    const techTerms = [
      "api",
      "database",
      "authentication",
      "authorization",
      "deployment",
      "microservice",
      "container",
      "kubernetes",
      "docker",
      "ci/cd",
      "webhook",
      "websocket",
      "graphql",
      "rest",
      "grpc",
      "component",
      "module",
      "service",
      "controller",
      "middleware",
    ];
    const lowerText = text.toLowerCase();
    return techTerms.filter((term) => lowerText.includes(term)).length;
  }

  /**
   * Decompose a complex task into subtasks
   */
  decompose(
    taskDescription: string,
    context?: { projectType?: string; techStack?: string[] },
  ): TaskDecomposition {
    const complexity = this.analyzeComplexity(taskDescription);
    const subtasks: DecomposedTask[] = [];
    const dependencies = new Map<string, string[]>();

    // Parse natural breakpoints in the description
    const segments = this.parseSegments(taskDescription);

    // Create subtasks from segments
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const subtaskId = `subtask_${i + 1}`;

      // Determine agent type based on segment content
      const agent = this.suggestAgent(segment, context);

      // Calculate risk
      const riskScore = this.calculateSegmentRisk(segment);

      subtasks.push({
        id: subtaskId,
        description: segment,
        suggestedAgent: agent,
        estimatedTokens: Math.ceil(segment.length * 10), // Rough estimate
        riskLevel: calculateRiskLevel(riskScore),
        dependsOn: i > 0 ? [`subtask_${i}`] : [], // Sequential by default
      });

      if (i > 0) {
        dependencies.set(subtaskId, [`subtask_${i}`]);
      }
    }

    // Check if tasks can be parallelized
    const parallelizable = this.canParallelize(subtasks);

    return {
      original: taskDescription,
      subtasks,
      dependencies,
      estimatedComplexity: complexity,
      parallelizable,
    };
  }

  private parseSegments(description: string): string[] {
    // Look for natural breaks: numbered lists, bullet points, semicolons, "then", "and then"
    let segments: string[] = [];

    // First, try numbered or bulleted lists
    const listMatch = description.match(/(?:\d+\.\s|\*\s|-\s)([^\n]+)/g);
    if (listMatch && listMatch.length > 1) {
      segments = listMatch.map((s) =>
        s.replace(/^\d+\.\s|\*\s|-\s/, "").trim(),
      );
    } else {
      // Try splitting by sentence with "then" or sequential markers
      const sequenceMarkers =
        /[.;]\s*(?:then|next|after that|finally|first|second|third|lastly)/gi;
      if (sequenceMarkers.test(description)) {
        segments = description
          .split(sequenceMarkers)
          .map((s) => s.trim())
          .filter((s) => s.length > 10);
      }
    }

    // If no segments found, treat as single task
    if (segments.length === 0) {
      segments = [description];
    }

    // Limit to reasonable number of subtasks
    if (segments.length > 10) {
      segments = segments.slice(0, 10);
    }

    return segments;
  }

  private suggestAgent(
    segment: string,
    context?: { projectType?: string; techStack?: string[] },
  ): AgentType {
    const lower = segment.toLowerCase();

    // Architecture/design related
    if (
      lower.includes("architect") ||
      lower.includes("design") ||
      lower.includes("structure")
    ) {
      return "architect";
    }
    // Frontend related
    if (
      lower.includes("ui") ||
      lower.includes("frontend") ||
      lower.includes("component") ||
      lower.includes("react") ||
      lower.includes("svelte") ||
      lower.includes("vue")
    ) {
      return "frontend";
    }
    // Backend related
    if (
      lower.includes("api") ||
      lower.includes("backend") ||
      lower.includes("server") ||
      lower.includes("database") ||
      lower.includes("endpoint")
    ) {
      return "backend";
    }
    // DevOps related
    if (
      lower.includes("deploy") ||
      lower.includes("docker") ||
      lower.includes("ci") ||
      lower.includes("kubernetes") ||
      lower.includes("infrastructure")
    ) {
      return "devops";
    }
    // Testing related
    if (
      lower.includes("test") ||
      lower.includes("spec") ||
      lower.includes("coverage")
    ) {
      return "test";
    }
    // Security related
    if (
      lower.includes("security") ||
      lower.includes("auth") ||
      lower.includes("permission")
    ) {
      return "security";
    }
    // Documentation related
    if (
      lower.includes("document") ||
      lower.includes("readme") ||
      lower.includes("guide")
    ) {
      return "docs";
    }

    // Default based on project context
    if (context?.projectType?.includes("frontend")) return "frontend";
    if (context?.projectType?.includes("backend")) return "backend";

    return "executor";
  }

  private calculateSegmentRisk(segment: string): number {
    const lower = segment.toLowerCase();
    let risk = 0;

    if (lower.includes("delete") || lower.includes("remove"))
      risk += RISK_FACTORS.file_delete;
    if (lower.includes("execute") || lower.includes("run"))
      risk += RISK_FACTORS.code_execute;
    if (lower.includes("database")) risk += RISK_FACTORS.database_write;
    if (lower.includes("deploy") || lower.includes("production"))
      risk += RISK_FACTORS.shell_command;

    return risk;
  }

  private canParallelize(subtasks: DecomposedTask[]): boolean {
    // Check if any tasks can run in parallel (no dependencies between them)
    // For now, simple heuristic: different agent types can often parallelize
    const agentTypes = new Set(subtasks.map((t) => t.suggestedAgent));
    return agentTypes.size > 1 && subtasks.length >= 2;
  }
}

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
        confidence -= 0.3; // Not suitable for complex tasks
      }
      if (strategy === STRATEGIES.DECOMPOSE && params.complexity > 0.5) {
        confidence += 0.2; // Good for complex tasks
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
        confidence += 0.2; // Pattern makes direct approach more viable
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
      alternatives: alternatives.slice(1), // Exclude the selected one
    };
  }
}

// ============================================================================
// PATTERN MATCHER
// ============================================================================

/**
 * Matches tasks to known successful patterns
 */
export class PatternMatcher extends EventEmitter {
  private patterns: Map<string, Pattern> = new Map();

  /**
   * Add a pattern to the matcher
   */
  addPattern(pattern: Pattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Find matching pattern for a task
   */
  findMatch(
    taskDescription: string,
  ): { pattern: Pattern; confidence: number } | null {
    let bestMatch: { pattern: Pattern; confidence: number } | null = null;

    for (const pattern of this.patterns.values()) {
      const confidence = this.calculateMatchConfidence(
        taskDescription,
        pattern,
      );

      if (
        confidence > 0.6 &&
        (!bestMatch || confidence > bestMatch.confidence)
      ) {
        bestMatch = { pattern, confidence };
      }
    }

    if (bestMatch) {
      this.emit("power", {
        type: "pattern_matched",
        pattern: bestMatch.pattern,
        confidence: bestMatch.confidence,
      });
    }

    return bestMatch;
  }

  private calculateMatchConfidence(
    taskDescription: string,
    pattern: Pattern,
  ): number {
    const taskLower = taskDescription.toLowerCase();
    const patternLower = pattern.goal.toLowerCase();

    // Word overlap
    const taskWords = new Set(
      taskLower.split(/\W+/).filter((w) => w.length > 3),
    );
    const patternWords = new Set(
      patternLower.split(/\W+/).filter((w) => w.length > 3),
    );

    let overlap = 0;
    for (const word of taskWords) {
      if (patternWords.has(word)) overlap++;
    }

    const overlapScore = overlap / Math.max(taskWords.size, patternWords.size);

    // Boost for high success rate patterns
    const successRate =
      pattern.successCount / (pattern.successCount + pattern.failureCount);
    const successBoost = successRate * 0.2;

    // Confidence boost
    const confidenceBoost = pattern.confidence * 0.1;

    return Math.min(1, overlapScore + successBoost + confidenceBoost);
  }

  /**
   * Record pattern execution result
   */
  recordResult(patternId: string, success: boolean, durationMs: number): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    if (success) {
      pattern.successCount++;
    } else {
      pattern.failureCount++;
    }

    // Update average duration
    const totalRuns = pattern.successCount + pattern.failureCount;
    pattern.avgDurationMs = Math.round(
      (pattern.avgDurationMs * (totalRuns - 1) + durationMs) / totalRuns,
    );

    // Update confidence based on success rate
    const successRate = pattern.successCount / totalRuns;
    pattern.confidence = successRate * 0.8 + 0.2; // Minimum 0.2 confidence

    pattern.updatedAt = new Date().toISOString();
  }

  /**
   * Create a pattern from a successful execution
   */
  createPattern(params: {
    name: string;
    description: string;
    goal: string;
    tasks: PatternTask[];
    tools: string[];
  }): Pattern {
    const pattern: Pattern = {
      id: crypto.randomUUID(),
      name: params.name,
      description: params.description,
      goal: params.goal,
      tasks: params.tasks,
      tools: params.tools,
      successCount: 1,
      failureCount: 0,
      avgDurationMs: 0,
      confidence: 0.5, // Initial confidence
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.patterns.set(pattern.id, pattern);
    this.emit("power", { type: "pattern_learned", patternId: pattern.id });

    return pattern;
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get top patterns by success
   */
  getTopPatterns(limit: number = 10): Pattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => {
        const aRate = a.successCount / (a.successCount + a.failureCount);
        const bRate = b.successCount / (b.successCount + b.failureCount);
        return bRate - aRate;
      })
      .slice(0, limit);
  }
}

// ============================================================================
// POWER EXPANSION ENGINE (MAIN CLASS)
// ============================================================================

/**
 * Main Power Expansion engine that coordinates all advanced capabilities
 */
export class PowerExpansion extends EventEmitter {
  readonly confidenceRouter: ConfidenceRouter;
  readonly selfHealing: SelfHealingEngine;
  readonly taskDecomposer: TaskDecomposer;
  readonly strategySelector: StrategySelector;
  readonly patternMatcher: PatternMatcher;

  constructor() {
    super();
    this.confidenceRouter = new ConfidenceRouter();
    this.selfHealing = new SelfHealingEngine();
    this.taskDecomposer = new TaskDecomposer();
    this.strategySelector = new StrategySelector();
    this.patternMatcher = new PatternMatcher();

    // Forward events from sub-engines
    this.selfHealing.on("power", (event) => this.emit("power", event));
    this.patternMatcher.on("power", (event) => this.emit("power", event));
  }

  /**
   * Full analysis for a task - routes to appropriate action
   */
  analyzeTask(params: {
    taskDescription: string;
    estimatedCost: number;
    context?: { projectType?: string; techStack?: string[] };
    previousMessages?: Array<{ role: string; content: string }>;
  }): {
    confidence: ConfidenceAnalysis;
    decomposition?: TaskDecomposition;
    strategy: StrategySelection;
    matchedPattern?: { pattern: Pattern; confidence: number };
  } {
    // Check for matching pattern
    const matchedPattern = this.patternMatcher.findMatch(
      params.taskDescription,
    );

    // Analyze task complexity
    const complexity = this.taskDecomposer.analyzeComplexity(
      params.taskDescription,
    );

    // Calculate context quality from message history
    const contextQuality = params.previousMessages
      ? Math.min(1, params.previousMessages.length * 0.2)
      : 0.4;

    // Analyze confidence
    const confidence = this.confidenceRouter.analyze({
      taskDescription: params.taskDescription,
      previousSuccess: false,
      similarPatternFound: !!matchedPattern,
      estimatedCost: params.estimatedCost,
      riskFactors: [], // Could be extracted from task
      contextQuality,
      historyAvailable: (params.previousMessages?.length ?? 0) > 0,
    });

    this.emit("power", { type: "confidence_analyzed", analysis: confidence });

    // Decompose if needed
    let decomposition: TaskDecomposition | undefined;
    if (complexity > 0.6 || confidence.action === "decompose") {
      decomposition = this.taskDecomposer.decompose(
        params.taskDescription,
        params.context,
      );
      this.emit("power", { type: "task_decomposed", decomposition });
    }

    // Select strategy
    const strategy = this.strategySelector.select({
      taskDescription: params.taskDescription,
      complexity,
      estimatedCost: params.estimatedCost,
      riskLevel: calculateRiskLevel(complexity * 50),
      hasPattern: !!matchedPattern,
    });

    this.emit("power", { type: "strategy_selected", selection: strategy });

    return {
      confidence,
      decomposition,
      strategy,
      matchedPattern: matchedPattern || undefined,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const powerExpansion = new PowerExpansion();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export default powerExpansion;

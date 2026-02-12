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

import { EventEmitter } from 'events';
import { calculateRiskLevel } from './systemPrompt.js';
import type { Pattern } from './types.js';

// Re-export constants and types
export { MAX_HEALING_RETRIES, STRATEGIES } from './powerExpansion.types.js';
export type {
  Strategy,
  ConfidenceAnalysis,
  ConfidenceAction,
  ConfidenceFactor,
  HealingAttempt,
  ErrorType,
  SelfHealingContext,
  TaskDecomposition,
  DecomposedTask,
  StrategySelection,
  LearningRecord,
  PowerEvent,
} from './powerExpansion.types.js';

// Re-export extracted classes
export { ConfidenceRouter } from './confidenceRouter.js';
export { SelfHealingEngine } from './selfHealingEngine.js';
export { TaskDecomposer } from './taskDecomposer.js';
export { StrategySelector } from './strategySelector.js';
export { PatternMatcher } from './patternMatcher.js';

// Import classes for facade
import { ConfidenceRouter } from './confidenceRouter.js';
import { SelfHealingEngine } from './selfHealingEngine.js';
import { TaskDecomposer } from './taskDecomposer.js';
import { StrategySelector } from './strategySelector.js';
import { PatternMatcher } from './patternMatcher.js';
import type {
  ConfidenceAnalysis,
  TaskDecomposition,
  StrategySelection,
} from './powerExpansion.types.js';

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
    this.selfHealing.on('power', (event) => this.emit('power', event));
    this.patternMatcher.on('power', (event) => this.emit('power', event));
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
    const matchedPattern = this.patternMatcher.findMatch(params.taskDescription);

    // Analyze task complexity
    const complexity = this.taskDecomposer.analyzeComplexity(params.taskDescription);

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
      riskFactors: [],
      contextQuality,
      historyAvailable: (params.previousMessages?.length ?? 0) > 0,
    });

    this.emit('power', { type: 'confidence_analyzed', analysis: confidence });

    // Decompose if needed
    let decomposition: TaskDecomposition | undefined;
    if (complexity > 0.6 || confidence.action === 'decompose') {
      decomposition = this.taskDecomposer.decompose(params.taskDescription, params.context);
      this.emit('power', { type: 'task_decomposed', decomposition });
    }

    // Select strategy
    const strategy = this.strategySelector.select({
      taskDescription: params.taskDescription,
      complexity,
      estimatedCost: params.estimatedCost,
      riskLevel: calculateRiskLevel(complexity * 50),
      hasPattern: !!matchedPattern,
    });

    this.emit('power', { type: 'strategy_selected', selection: strategy });

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

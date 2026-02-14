/**
 * Self-Healing Engine
 *
 * Recovers from failures by classifying errors, generating healing
 * strategies, and retrying with adjusted parameters.
 *
 * @fileoverview Extracted from powerExpansion.ts
 * @module gAgent/selfHealingEngine
 */

import { EventEmitter } from 'events';
import logger from '../middleware/logger.js';
import type { ErrorType, HealingAttempt, SelfHealingContext } from './powerExpansion.types.js';
import { MAX_HEALING_RETRIES, STRATEGIES } from './powerExpansion.types.js';
import type { Strategy } from './powerExpansion.types.js';

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
    const errorStr = typeof error === 'string' ? error : error.message;
    const lowerError = errorStr.toLowerCase();

    if (
      lowerError.includes('parse') ||
      lowerError.includes('json') ||
      lowerError.includes('syntax')
    ) {
      return 'parsing_error';
    }
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return 'timeout_error';
    }
    if (
      lowerError.includes('memory') ||
      lowerError.includes('resource') ||
      lowerError.includes('quota')
    ) {
      return 'resource_error';
    }
    if (
      lowerError.includes('valid') ||
      lowerError.includes('schema') ||
      lowerError.includes('required')
    ) {
      return 'validation_error';
    }
    if (
      lowerError.includes('api') ||
      lowerError.includes('rate limit') ||
      lowerError.includes('429')
    ) {
      return 'api_error';
    }
    if (
      lowerError.includes('permission') ||
      lowerError.includes('denied') ||
      lowerError.includes('403')
    ) {
      return 'permission_error';
    }

    return 'unknown_error';
  }

  /**
   * Generate healing strategy based on error type
   */
  generateHealingStrategy(
    errorType: ErrorType,
    attemptNumber: number
  ): { strategy: string; adjustments: string[] } {
    const strategies: Record<ErrorType, Array<{ strategy: string; adjustments: string[] }>> = {
      parsing_error: [
        {
          strategy: 'simplify_output',
          adjustments: ['Request simpler output format', 'Add explicit formatting instructions'],
        },
        {
          strategy: 'step_by_step',
          adjustments: ['Break into smaller steps', 'Validate each step output'],
        },
        {
          strategy: 'fallback_parser',
          adjustments: ['Use lenient parsing', 'Extract partial results'],
        },
      ],
      timeout_error: [
        {
          strategy: 'reduce_scope',
          adjustments: ['Process fewer items', 'Use smaller context window'],
        },
        {
          strategy: 'batch_processing',
          adjustments: ['Split into batches', 'Process incrementally'],
        },
        {
          strategy: 'increase_timeout',
          adjustments: ['Extend timeout', 'Add progress checkpoints'],
        },
      ],
      resource_error: [
        {
          strategy: 'reduce_complexity',
          adjustments: ['Use smaller model', 'Reduce context size'],
        },
        {
          strategy: 'cleanup_resources',
          adjustments: ['Release unused resources', 'Wait for resources'],
        },
        {
          strategy: 'prioritize',
          adjustments: ['Focus on essential parts', 'Skip non-critical tasks'],
        },
      ],
      validation_error: [
        {
          strategy: 'fix_input',
          adjustments: ['Sanitize input', 'Add missing fields'],
        },
        {
          strategy: 'use_defaults',
          adjustments: ['Apply default values', 'Relax constraints'],
        },
        {
          strategy: 'request_correction',
          adjustments: ['Ask user for corrections', 'Provide examples'],
        },
      ],
      api_error: [
        {
          strategy: 'retry_with_backoff',
          adjustments: ['Wait before retry', 'Exponential backoff'],
        },
        {
          strategy: 'fallback_provider',
          adjustments: ['Try alternative model', 'Use cached results'],
        },
        {
          strategy: 'queue_for_later',
          adjustments: ['Schedule retry', 'Notify when available'],
        },
      ],
      permission_error: [
        {
          strategy: 'request_access',
          adjustments: ['Ask for permissions', 'Explain requirements'],
        },
        {
          strategy: 'workaround',
          adjustments: ['Use alternative approach', 'Skip restricted operations'],
        },
        {
          strategy: 'escalate',
          adjustments: ['Escalate to admin', 'Request manual intervention'],
        },
      ],
      unknown_error: [
        {
          strategy: 'simplify',
          adjustments: ['Simplify request', 'Remove complex parts'],
        },
        {
          strategy: 'isolate',
          adjustments: ['Test individual components', 'Identify failure point'],
        },
        {
          strategy: 'human_assistance',
          adjustments: ['Request human review', 'Provide error details'],
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
    goalId?: string
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
    executeAdjusted: (adjustedRequest: string, adjustments: string[]) => Promise<boolean>
  ): Promise<boolean> {
    const context = this.contexts.get(taskId);
    if (!context) {
      logger.warn({ taskId }, '[SelfHealing] No context for task');
      return false;
    }

    if (context.attempts.length >= MAX_HEALING_RETRIES) {
      logger.info({ taskId }, '[SelfHealing] Max retries exhausted');
      this.emit('power', { type: 'healing_exhausted', context });
      return false;
    }

    const errorType = this.classifyError(currentError);
    const attemptNumber = context.attempts.length;
    const { strategy, adjustments } = this.generateHealingStrategy(errorType, attemptNumber);

    logger.info(
      {
        attempt: attemptNumber + 1,
        maxRetries: MAX_HEALING_RETRIES,
        taskId,
        strategy,
        adjustments,
      },
      '[SelfHealing] Attempting healing'
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
    const adjustedRequest = this.adjustRequest(context.originalRequest, strategy, adjustments);
    context.adjustedRequest = adjustedRequest;

    this.emit('power', { type: 'healing_attempted', attempt });

    try {
      const success = await executeAdjusted(adjustedRequest, adjustments);
      attempt.success = success;

      if (success) {
        logger.info({ taskId }, '[SelfHealing] Healing succeeded');
        this.emit('power', { type: 'healing_succeeded', context });
      }

      return success;
    } catch (err) {
      attempt.resultError = (err as Error).message;
      logger.info({ err: attempt.resultError }, '[SelfHealing] Healing attempt failed');
      return false;
    }
  }

  /**
   * Adjust request based on strategy
   */
  private adjustRequest(originalRequest: string, strategy: string, _adjustments: string[]): string {
    let adjusted = originalRequest;

    switch (strategy) {
      case 'simplify_output':
        adjusted += '\n\nNote: Please provide a simple, well-formatted response.';
        break;
      case 'step_by_step':
        adjusted += '\n\nNote: Please break this down into clear, numbered steps.';
        break;
      case 'reduce_scope':
        adjusted += '\n\nNote: Please focus on the most essential aspects only.';
        break;
      case 'simplify':
        adjusted += '\n\nNote: Please provide a simplified approach to this task.';
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

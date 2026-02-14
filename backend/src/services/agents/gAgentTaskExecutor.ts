/**
 * G-Agent Task Executor
 *
 * Executes tasks from a plan and streams progress via SSE events.
 * Integrates with the LLM and tool execution system.
 */

import logger from '../../middleware/logger.js';
import { ClaudeServiceWithTools } from '../ai-providers/claudeServiceWithTools.js';
import { runWithConcurrency } from '../../utils/concurrency.js';
import { gAgentMemoryService } from './gAgentMemoryService.js';
import { gAgentSelfImprovement } from './gAgentSelfImprovement.js';
import type { Plan, Task, TaskStatus } from '../intent/intentCliRunner.js';
import { configManager } from '../../gAgent/config.js';

// ============================================================================
// SSE EVENT TYPES
// ============================================================================

export type TaskExecutionEvent =
  | { type: 'plan_started'; planId: string; goal: string; taskCount: number }
  | {
      type: 'batch_started';
      batchIndex: number;
      batchSize: number;
      taskIds: string[];
    }
  | {
      type: 'task_started';
      taskId: string;
      description: string;
      tools: string[];
    }
  | { type: 'task_progress'; taskId: string; percent: number; message: string }
  | {
      type: 'task_tool_call';
      taskId: string;
      toolName: string;
      toolInput: Record<string, unknown>;
    }
  | {
      type: 'task_tool_result';
      taskId: string;
      toolName: string;
      success: boolean;
      output: string;
    }
  | {
      type: 'task_completed';
      taskId: string;
      output: string;
      durationMs: number;
    }
  | { type: 'task_failed'; taskId: string; error: string; durationMs: number }
  | { type: 'task_skipped'; taskId: string; reason: string }
  | {
      type: 'batch_completed';
      batchIndex: number;
      completedCount: number;
      failedCount: number;
    }
  | {
      type: 'plan_completed';
      planId: string;
      status: 'completed' | 'failed' | 'cancelled';
      durationMs: number;
    }
  | { type: 'error'; message: string; planId?: string; taskId?: string }
  | { type: 'done' };

// ============================================================================
// TASK EXECUTOR STATE
// ============================================================================

interface ExecutionState {
  planId: string;
  plan: Plan;
  taskStatuses: Map<string, TaskStatus>;
  taskOutputs: Map<string, string>;
  taskErrors: Map<string, string>;
  currentBatchIndex: number;
  startTime: number;
  cancelled: boolean;
}

// ============================================================================
// G-AGENT TASK EXECUTOR
// ============================================================================

/**
 * Executes a G-Agent plan task by task, batch by batch, streaming progress
 */
export class GAgentTaskExecutor {
  private activeExecutions: Map<string, ExecutionState> = new Map();

  constructor() {}
  /**
   * Execute a plan and yield progress events
   * @param plan The plan to execute
   * @param workspaceRoot The workspace root for tool execution
   * @param abortSignal Optional signal to cancel execution
   */
  async *executePlan(
    plan: Plan,
    workspaceRoot?: string,
    abortSignal?: AbortSignal
  ): AsyncGenerator<TaskExecutionEvent> {
    const planId = plan.id;
    const startTime = Date.now();

    logger.info({ planId, taskCount: plan.tasks.length }, 'G-Agent: Starting plan execution');

    // Initialize execution state
    const state: ExecutionState = {
      planId,
      plan,
      taskStatuses: new Map(plan.tasks.map((t) => [t.id, 'pending' as TaskStatus])),
      taskOutputs: new Map(),
      taskErrors: new Map(),
      currentBatchIndex: 0,
      startTime,
      cancelled: false,
    };
    this.activeExecutions.set(planId, state);

    // Handle abort signal
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        state.cancelled = true;
      });
    }

    try {
      yield {
        type: 'plan_started',
        planId,
        goal: plan.goal,
        taskCount: plan.tasks.length,
      };

      // Execute batches sequentially
      for (let batchIndex = 0; batchIndex < plan.parallel_batches.length; batchIndex++) {
        if (state.cancelled) {
          yield { type: 'error', message: 'Execution cancelled', planId };
          break;
        }

        const batch = plan.parallel_batches[batchIndex];
        state.currentBatchIndex = batchIndex;

        yield {
          type: 'batch_started',
          batchIndex,
          batchSize: batch.length,
          taskIds: batch,
        };

        // Execute tasks in the batch (can be parallel or sequential based on batch size)
        const batchResults = await this.executeBatch(
          state,
          batch,
          workspaceRoot,
          abortSignal,
          (_event) => {
            // This callback is not used in generator pattern, but kept for potential future use
          }
        );

        // Yield results for each task
        for (const result of batchResults) {
          yield result;
        }

        // Count completed and failed
        const completedCount = batch.filter(
          (id) => state.taskStatuses.get(id) === 'completed'
        ).length;
        const failedCount = batch.filter((id) => state.taskStatuses.get(id) === 'failed').length;

        yield {
          type: 'batch_completed',
          batchIndex,
          completedCount,
          failedCount,
        };

        // If any task failed, stop execution (can be configurable later)
        if (failedCount > 0) {
          logger.warn(
            { planId, batchIndex, failedCount },
            'G-Agent: Batch had failures, stopping execution'
          );
          break;
        }
      }

      // Determine final status
      const allCompleted = plan.tasks.every((t) => state.taskStatuses.get(t.id) === 'completed');
      const anyFailed = plan.tasks.some((t) => state.taskStatuses.get(t.id) === 'failed');
      const status = state.cancelled
        ? 'cancelled'
        : anyFailed
          ? 'failed'
          : allCompleted
            ? 'completed'
            : 'failed';
      const durationMs = Date.now() - startTime;

      yield { type: 'plan_completed', planId, status, durationMs };
      yield { type: 'done' };

      logger.info({ planId, status, durationMs }, 'G-Agent: Plan execution finished');

      // Learn from this execution - store pattern in memory
      const success = status === 'completed';
      try {
        const pattern = await gAgentMemoryService.learnPattern(
          plan.goal,
          plan.tasks,
          durationMs,
          success
        );
        if (pattern) {
          logger.info(
            { patternId: pattern.id, confidence: pattern.confidence },
            'G-Agent: Pattern learned from execution'
          );
        }
      } catch (memErr) {
        logger.warn({ error: (memErr as Error).message }, 'G-Agent: Failed to learn pattern');
      }

      // Run self-improvement cycle on successful completion
      if (success) {
        try {
          // Use a default userId for now - can be enhanced to track actual user
          const userId = 'system';
          const improvementResult = await gAgentSelfImprovement.runSelfImprovementCycle(
            userId,
            plan
          );

          if (
            improvementResult.skillsLearned.length > 0 ||
            improvementResult.termsLearned.length > 0
          ) {
            logger.info(
              {
                planId,
                skillsLearned: improvementResult.skillsLearned.length,
                termsLearned: improvementResult.termsLearned.length,
                suggestions: improvementResult.suggestions.length,
              },
              'G-Agent: Self-improvement cycle completed'
            );
          }
        } catch (improveErr) {
          logger.warn(
            { error: (improveErr as Error).message },
            'G-Agent: Self-improvement cycle failed'
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ planId, error: message }, 'G-Agent: Plan execution error');
      yield { type: 'error', message, planId };
      yield {
        type: 'plan_completed',
        planId,
        status: 'failed',
        durationMs: Date.now() - startTime,
      };
      yield { type: 'done' };
    } finally {
      this.activeExecutions.delete(planId);
    }
  }

  /**
   * Execute a batch of tasks, potentially in parallel
   */
  private async executeBatch(
    state: ExecutionState,
    taskIds: string[],
    workspaceRoot?: string,
    abortSignal?: AbortSignal,
    _onEvent?: (event: TaskExecutionEvent) => void
  ): Promise<TaskExecutionEvent[]> {
    const events: TaskExecutionEvent[] = [];
    const tasks = taskIds
      .map((id) => state.plan.tasks.find((t) => t.id === id))
      .filter(Boolean) as Task[];
    // Run with concurrency limit (default 20) to balance performance and resources
    const concurrencyLimit =
      parseInt(process.env.G_AGENT_TASK_CONCURRENCY || '', 10) ||
      configManager.getConfig().performance.maxConcurrentTasks ||
      20;
    parseInt(process.env.G_AGENT_TASK_CONCURRENCY || '', 10) || 20;

    const results = await runWithConcurrency(tasks, concurrencyLimit, async (task) => {
      if (state.cancelled) return [];
      return this.executeTask(state, task, workspaceRoot, abortSignal);
    });

    // Flatten results into events array
    for (const taskEvents of results) {
      if (taskEvents) {
        events.push(...taskEvents);
      }
    }

    return events;
  }
  private async executeTask(
    state: ExecutionState,
    task: Task,
    workspaceRoot?: string,
    abortSignal?: AbortSignal
  ): Promise<TaskExecutionEvent[]> {
    const events: TaskExecutionEvent[] = [];
    const taskStartTime = Date.now();

    logger.debug({ planId: state.planId, taskId: task.id }, 'G-Agent: Executing task');

    // Mark as in progress
    state.taskStatuses.set(task.id, 'in_progress');
    events.push({
      type: 'task_started',
      taskId: task.id,
      description: task.description,
      tools: task.tools,
    });

    try {
      // Build prompt for LLM to execute this specific task
      const taskPrompt = this.buildTaskPrompt(task, state.plan);

      // Stream chat for this task
      const messages = [{ role: 'user' as const, content: taskPrompt }];

      // Accumulate output from text events
      let output = '';

      // Create a fresh service instance for each task to ensure thread safety
      // during parallel execution (ClaudeServiceWithTools is stateful)
      const claudeService = new ClaudeServiceWithTools();

      // Use the Claude service to execute the task
      for await (const event of claudeService.generateChatStream(
        messages,
        abortSignal,
        workspaceRoot,
        'normal', // mode
        undefined, // agentProfile
        undefined, // planId
        undefined, // specSessionId
        undefined, // provider
        undefined, // modelId
        undefined, // guardRailOptions
        undefined, // tierOverride
        true, // autonomous (yolo mode for task execution)
        'gAgent', // sessionType
        undefined, // gAgentCapabilities
        undefined, // gAgentExternalAllowlist
        false, // includeRagContext
        task.tools // toolAllowlist - only allow tools specified for this task
      )) {
        if (state.cancelled) {
          throw new Error('Execution cancelled');
        }

        switch (event.type) {
          case 'text':
            output += event.text;
            break;
          case 'tool_call':
            events.push({
              type: 'task_tool_call',
              taskId: task.id,
              toolName: event.name,
              toolInput: event.input,
            });
            break;
          case 'tool_result':
            events.push({
              type: 'task_tool_result',
              taskId: task.id,
              toolName: event.toolName,
              success: event.success,
              output: event.output.slice(0, 500), // Truncate for SSE
            });
            break;
          case 'error':
            throw new Error(event.message);
        }
      }

      // Task completed successfully
      const durationMs = Date.now() - taskStartTime;
      state.taskStatuses.set(task.id, 'completed');
      state.taskOutputs.set(task.id, output);

      events.push({
        type: 'task_completed',
        taskId: task.id,
        output: output.slice(0, 1000), // Truncate for SSE
        durationMs,
      });

      logger.debug(
        { planId: state.planId, taskId: task.id, durationMs },
        'G-Agent: Task completed'
      );
    } catch (error) {
      const durationMs = Date.now() - taskStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      state.taskStatuses.set(task.id, 'failed');
      state.taskErrors.set(task.id, errorMessage);

      events.push({
        type: 'task_failed',
        taskId: task.id,
        error: errorMessage,
        durationMs,
      });

      logger.error(
        { planId: state.planId, taskId: task.id, error: errorMessage },
        'G-Agent: Task failed'
      );
    }

    return events;
  }

  /**
   * Build a prompt for the LLM to execute a specific task
   */
  private buildTaskPrompt(task: Task, plan: Plan): string {
    const prompt = `You are executing a specific task as part of a larger plan.

## Plan Goal
${plan.goal}

## Your Task
**ID:** ${task.id}
**Description:** ${task.description}
**Feature:** ${task.feature}
**Action:** ${task.action}

## Available Tools
You have access to: ${task.tools.join(', ')}

## Dependencies
${
  task.depends_on.length > 0
    ? `This task depends on: ${task.depends_on.join(', ')} (already completed)`
    : 'This task has no dependencies.'
}

## Instructions
1. Complete this specific task using the available tools
2. Be efficient and focused - do only what's needed for this task
3. Provide a clear summary of what you accomplished

Begin executing the task now.`;

    return prompt;
  }

  /**
   * Cancel an active execution
   */
  cancelExecution(planId: string): boolean {
    const state = this.activeExecutions.get(planId);
    if (state) {
      state.cancelled = true;
      logger.info({ planId }, 'G-Agent: Execution cancelled');
      return true;
    }
    return false;
  }

  /**
   * Get execution status for a plan
   */
  getExecutionStatus(planId: string): {
    isRunning: boolean;
    currentBatch: number;
    completedTasks: number;
    failedTasks: number;
  } | null {
    const state = this.activeExecutions.get(planId);
    if (!state) return null;

    const completedTasks = Array.from(state.taskStatuses.values()).filter(
      (s) => s === 'completed'
    ).length;
    const failedTasks = Array.from(state.taskStatuses.values()).filter(
      (s) => s === 'failed'
    ).length;

    return {
      isRunning: !state.cancelled,
      currentBatch: state.currentBatchIndex,
      completedTasks,
      failedTasks,
    };
  }
}

// Singleton instance
export const gAgentTaskExecutor = new GAgentTaskExecutor();

export default gAgentTaskExecutor;

/**
 * G-Agent Goal Queue Service
 *
 * Manages a persistent queue of goals for G-Agent to accomplish.
 * Goals can be:
 * - Immediate (execute now)
 * - Scheduled (execute at specific time)
 * - Triggered (execute when condition is met)
 * - Recurring (execute on a schedule, like cron)
 *
 * This enables true 24/7 autonomous operation where G-Agent can:
 * - Accept goals from users
 * - Accept goals from webhooks
 * - Create its own follow-up goals
 * - Schedule future tasks for itself
 *
 * UPDATED: Now uses database persistence via goalRepository
 */

import logger from '../middleware/logger.js';
import { writeAuditLog } from './auditLogService.js';
import { runPlanCli, type Plan } from './intentCliRunner.js';
import { gAgentTaskExecutor } from './gAgentTaskExecutor.js';
import { gAgentMemoryService } from './gAgentMemoryService.js';
import { dispatchWebhook } from './webhookService.js';
import {
  goalRepository,
  type GoalCreateInput as RepoCreateInput,
} from '../gAgent/goalRepository.js';
import { messageBus } from '../gAgent/messageBus.js';
import { supervisor } from '../gAgent/supervisor.js';
import type { Goal, GoalStatus, GoalPriority, GoalTrigger } from '../gAgent/types.js';
import {
  sanitizeGoalDescription,
  sanitizePath,
  sanitizeTags,
  checkGAgentSuspiciousPatterns,
  GAGENT_MAX_DESCRIPTION_LENGTH,
} from '../gAgent/security.js';

// ============================================================================
// TYPES (re-export from gAgent types for backward compatibility)
// ============================================================================

export type { GoalStatus, GoalPriority } from '../gAgent/types.js';
export type GoalTriggerType = GoalTrigger; // Alias for backward compatibility

// Re-export Goal type
export type { Goal } from '../gAgent/types.js';

export interface GoalCreateInput {
  userId: string;
  description: string;
  priority?: GoalPriority;
  triggerType?: GoalTriggerType;
  scheduledAt?: string;
  cronExpression?: string;
  workspaceRoot?: string;
  parentGoalId?: string;
  tags?: string[];
  maxRetries?: number;
}

export interface GoalQueueStats {
  pending: number;
  scheduled: number;
  planning: number;
  executing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  avgExecutionTimeMs: number;
}

// ============================================================================
// RUNTIME STATE (processing intervals - cannot be persisted)
// ============================================================================

const processingIntervals = new Map<string, NodeJS.Timeout>();
const executionTimes: number[] = []; // Track execution times for avg calculation

// ============================================================================
// GOAL MANAGEMENT
// ============================================================================

/**
 * Creates a new goal and adds it to the persistent queue for G-Agent execution.
 *
 * Defense-in-depth: Sanitizes input even though routes should have already validated.
 * This protects against internal callers that bypass the API layer.
 *
 * @param input - Goal creation parameters
 * @param input.userId - The ID of the user creating the goal
 * @param input.description - Human-readable description of what the goal should accomplish
 * @param input.priority - Priority level: 'low' | 'normal' | 'high' | 'urgent' (default: 'normal')
 * @param input.triggerType - When to execute: 'immediate' | 'scheduled' | 'cron' | 'self_scheduled'
 * @param input.scheduledAt - ISO 8601 timestamp for scheduled execution
 * @param input.cronExpression - Cron expression for recurring goals
 * @param input.workspaceRoot - Filesystem path to the workspace for file operations
 * @param input.parentGoalId - ID of parent goal for follow-up/sub-goals
 * @param input.tags - Optional tags for categorization (e.g., ['codegen', 'frontend'])
 * @param input.maxRetries - Maximum retry attempts on failure (default: 3)
 * @returns The created Goal with generated ID, timestamps, and initial 'pending' status
 * @throws {Error} If description is empty, exceeds max length, or contains blocked patterns
 *
 * @example
 * ```typescript
 * const goal = await createGoal({
 *   userId: 'user-123',
 *   description: 'Create a React component for user authentication',
 *   priority: 'high',
 *   workspaceRoot: '/projects/my-app',
 *   tags: ['codegen', 'frontend'],
 * });
 * ```
 */
export async function createGoal(input: GoalCreateInput): Promise<Goal> {
  // Defense-in-depth: Sanitize description even if already validated at route level
  const sanitizedDescription = sanitizeGoalDescription(input.description);

  // Validate description length
  if (!sanitizedDescription || sanitizedDescription.length === 0) {
    throw new Error('Goal description is required');
  }
  if (sanitizedDescription.length > GAGENT_MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Goal description exceeds maximum length of ${GAGENT_MAX_DESCRIPTION_LENGTH}`);
  }

  // Check for suspicious patterns (log only at this layer, blocking happens at route)
  const suspiciousMatches = checkGAgentSuspiciousPatterns(input.description);
  if (suspiciousMatches.length > 0) {
    logger.warn(
      {
        userId: input.userId,
        patterns: suspiciousMatches,
        preview: input.description.substring(0, 100),
        source: 'gAgentGoalQueue',
      },
      'G-Agent: Suspicious patterns detected in goal description (internal check)'
    );

    // Block if env var is set (defense in depth - route should have caught this)
    if (process.env.BLOCK_SUSPICIOUS_PROMPTS === 'true') {
      throw new Error('Goal description contains blocked patterns');
    }
  }

  // Sanitize other fields
  const sanitizedWorkspaceRoot = input.workspaceRoot
    ? sanitizePath(input.workspaceRoot)
    : undefined;
  const sanitizedTags = input.tags ? sanitizeTags(input.tags) : undefined;

  // Convert to repository input format
  const repoInput: RepoCreateInput = {
    userId: input.userId,
    description: sanitizedDescription,
    priority: input.priority,
    trigger: input.triggerType as GoalTrigger | undefined,
    scheduledAt: input.scheduledAt,
    cronExpression: input.cronExpression,
    workspaceRoot: sanitizedWorkspaceRoot,
    parentGoalId: input.parentGoalId,
    tags: sanitizedTags,
    maxRetries: input.maxRetries,
  };

  const goal = await goalRepository.create(repoInput);

  // If parent goal exists, add this as a child
  if (input.parentGoalId) {
    await goalRepository.addChildGoal(input.parentGoalId, goal.id);
  }

  logger.info(
    { goalId: goal.id, userId: input.userId, description: sanitizedDescription.slice(0, 50) },
    'G-Agent: Goal created'
  );

  // Publish to MessageBus for unified tracking
  messageBus.goalCreated(goal);

  await writeAuditLog({
    userId: input.userId,
    action: 'gagent.goal.created',
    category: 'agent',
    target: goal.id,
    metadata: { description: sanitizedDescription.slice(0, 100), priority: goal.priority },
  });

  // If immediate and no processing is running, start processing
  if (goal.status === 'pending' && !processingIntervals.has(input.userId)) {
    processNextGoal(input.userId);
  }

  return goal;
}

/**
 * Retrieves a goal by its unique identifier.
 *
 * @param goalId - The unique ID of the goal to retrieve
 * @returns The Goal object if found, null otherwise
 *
 * @example
 * ```typescript
 * const goal = await getGoal('goal-abc123');
 * if (goal) {
 *   console.log(`Goal status: ${goal.status}`);
 * }
 * ```
 */
export async function getGoal(goalId: string): Promise<Goal | null> {
  return goalRepository.getById(goalId);
}

/**
 * Retrieves all goals for a specific user with optional filtering.
 *
 * @param userId - The user's unique identifier
 * @param options - Optional filtering and pagination options
 * @param options.status - Filter by goal status(es)
 * @param options.limit - Maximum number of goals to return
 * @returns Array of Goal objects sorted by priority (ascending)
 *
 * @example
 * ```typescript
 * // Get all pending and executing goals
 * const activeGoals = await getUserGoals('user-123', {
 *   status: ['pending', 'executing'],
 *   limit: 10,
 * });
 * ```
 */
export async function getUserGoals(
  userId: string,
  options?: {
    status?: GoalStatus[];
    limit?: number;
  }
): Promise<Goal[]> {
  return goalRepository.list({
    userId,
    status: options?.status,
    limit: options?.limit,
    orderBy: 'priority',
    orderDir: 'asc',
  });
}

/**
 * Cancels a goal and stops any in-progress execution.
 *
 * If the goal is currently executing, the execution will be interrupted.
 * The goal's status will be set to 'cancelled' and completedAt timestamp added.
 *
 * @param goalId - The unique ID of the goal to cancel
 * @returns The updated Goal object if found and cancelled, null if goal not found
 *
 * @example
 * ```typescript
 * const cancelled = await cancelGoal('goal-abc123');
 * if (cancelled) {
 *   console.log('Goal cancelled successfully');
 * }
 * ```
 */
export async function cancelGoal(goalId: string): Promise<Goal | null> {
  const goal = await goalRepository.getById(goalId);
  if (!goal) return null;

  if (goal.status === 'executing') {
    // Try to cancel execution
    gAgentTaskExecutor.cancelExecution(goal.planId || goalId);
  }

  const updated = await goalRepository.update(goalId, {
    status: 'cancelled',
    completedAt: new Date().toISOString(),
  });

  logger.info({ goalId, userId: goal.userId }, 'G-Agent: Goal cancelled');

  return updated;
}

/**
 * Retries a failed goal by resetting its status and incrementing retry count.
 *
 * Only works on goals with status 'failed'. The goal will be reset to 'pending'
 * and queued for re-execution. Previous error and timing data will be cleared.
 *
 * @param goalId - The unique ID of the failed goal to retry
 * @returns The updated Goal object if retryable, null if goal not found or not failed
 *
 * @example
 * ```typescript
 * const goal = await getGoal('goal-abc123');
 * if (goal?.status === 'failed' && goal.retryCount < goal.maxRetries) {
 *   await retryGoal('goal-abc123');
 * }
 * ```
 */
export async function retryGoal(goalId: string): Promise<Goal | null> {
  const goal = await goalRepository.getById(goalId);
  if (!goal || goal.status !== 'failed') return null;

  const updated = await goalRepository.update(goalId, {
    status: 'pending',
    retryCount: goal.retryCount + 1,
    error: undefined,
    startedAt: undefined,
    completedAt: undefined,
  });

  logger.info({ goalId, retryCount: goal.retryCount + 1 }, 'G-Agent: Goal queued for retry');

  // Trigger processing
  if (updated) {
    processNextGoal(updated.userId);
  }

  return updated;
}

// ============================================================================
// GOAL PROCESSING
// ============================================================================

/**
 * Execute a code generation goal via Agent Lightning
 *
 * This routes the goal to the Agent Lightning bridge for full code generation.
 */
async function executeCodeGenGoal(goal: Goal, startTime: number): Promise<void> {
  const { generateCodeFromGoal } = await import('../gAgent/agentLightningBridge.js');

  await goalRepository.update(goal.id, {
    status: 'executing',
    startedAt: new Date().toISOString(),
  });

  messageBus.goalUpdated(goal.id, { status: 'executing' });

  logger.info(
    { goalId: goal.id, description: goal.description.slice(0, 50) },
    'G-Agent: Routing goal to Agent Lightning for code generation'
  );

  try {
    const result = await generateCodeFromGoal(goal.description, {
      goalId: goal.id,
      userId: goal.userId,
      userTier: 'pro', // Default tier for goal queue
      workspaceRoot: goal.workspaceRoot,
      autonomous: true, // Goals are autonomous by default
      onProgress: (event) => {
        // Update goal checkpoints based on progress
        if (event.progress !== undefined) {
          goalRepository.addCheckpoint(goal.id, {
            phase: event.phase || 'codegen',
            progress: event.progress,
            state: {
              type: event.type,
              agent: event.agent,
              message: event.message,
            },
          });
        }
      },
    });

    const executionTime = Date.now() - startTime;
    executionTimes.push(executionTime);

    if (result.success) {
      await goalRepository.update(goal.id, {
        status: 'completed',
        result: result.summary,
        completedAt: new Date().toISOString(),
      });

      messageBus.goalCompleted(goal.id, result.summary);

      logger.info(
        {
          goalId: goal.id,
          files: result.files.length,
          agents: result.agents.length,
          durationMs: executionTime,
        },
        'G-Agent: Agent Lightning code generation completed'
      );

      // Dispatch webhook
      await dispatchWebhook('ship.completed', {
        type: 'codegen-goal',
        goalId: goal.id,
        projectName: result.projectName,
        filesGenerated: result.files.length,
        executionTimeMs: executionTime,
        summary: result.summary,
      });
    } else {
      await goalRepository.update(goal.id, {
        status: 'failed',
        error: result.error,
        result: result.summary,
        completedAt: new Date().toISOString(),
      });

      messageBus.goalUpdated(goal.id, {
        status: 'failed',
        error: result.error,
      });

      logger.error(
        {
          goalId: goal.id,
          error: result.error,
        },
        'G-Agent: Agent Lightning code generation failed'
      );
    }

    await writeAuditLog({
      userId: goal.userId,
      action: result.success ? 'gagent.codegen.completed' : 'gagent.codegen.failed',
      category: 'agent',
      target: goal.id,
      metadata: {
        projectName: result.projectName,
        filesGenerated: result.files.length,
        executionTimeMs: executionTime,
      },
    });
  } catch (err) {
    const errorMsg = (err as Error).message;

    await goalRepository.update(goal.id, {
      status: 'failed',
      error: errorMsg,
      completedAt: new Date().toISOString(),
    });

    messageBus.goalUpdated(goal.id, { status: 'failed', error: errorMsg });

    throw err; // Re-throw for retry handling
  }
}

/**
 * Process the next pending goal for a user
 */
async function processNextGoal(userId: string): Promise<void> {
  // Get next pending goal
  let goal = await goalRepository.getNextPendingGoal(userId);

  if (!goal) {
    // Check for scheduled goals that are due
    const dueGoals = await goalRepository.getDueGoals(1);
    const userDueGoal = dueGoals.find((g) => g.userId === userId);

    if (userDueGoal) {
      // Convert scheduled goal to pending
      await goalRepository.update(userDueGoal.id, { status: 'pending' });
      goal = await goalRepository.getById(userDueGoal.id);
    }

    if (!goal) {
      return; // Nothing to process
    }
  }

  try {
    await executeGoal(goal);
  } catch (err) {
    await goalRepository.update(goal.id, {
      status: 'failed',
      error: (err as Error).message,
      completedAt: new Date().toISOString(),
    });

    logger.error(
      { goalId: goal.id, error: (err as Error).message },
      'G-Agent: Goal execution failed'
    );

    // Retry if within limits
    if (goal.retryCount < goal.maxRetries) {
      setTimeout(() => retryGoal(goal!.id), 5000);
    }
  }

  // Check for more goals
  setTimeout(() => processNextGoal(userId), 1000);
}

/**
 * Execute a single goal
 * Integrates with Supervisor for agent tracking and MessageBus for events
 *
 * Routes to Agent Lightning for codegen-tagged goals.
 */
async function executeGoal(goal: Goal): Promise<void> {
  const startTime = Date.now();

  // Check if this is a code generation goal - route to Agent Lightning
  const isCodeGenGoal =
    goal.tags?.includes('codegen') ||
    goal.tags?.includes('agent-lightning') ||
    /\b(generate|create|build|implement)\b.*\b(app|application|project|api|frontend|backend)\b/i.test(
      goal.description
    );

  if (isCodeGenGoal) {
    await executeCodeGenGoal(goal, startTime);
    return;
  }

  await goalRepository.update(goal.id, {
    status: 'planning',
    startedAt: new Date().toISOString(),
  });

  // Publish planning status to MessageBus
  messageBus.goalUpdated(goal.id, { status: 'planning' });

  logger.info(
    { goalId: goal.id, description: goal.description.slice(0, 50) },
    'G-Agent: Starting goal execution'
  );

  // Spawn a planner agent via Supervisor for tracking
  let plannerInstanceId: string | undefined;
  try {
    const plannerInstance = await supervisor.spawn('planner', {
      taskId: `plan_${goal.id}`,
      goalId: goal.id,
      priority:
        goal.priority === 'urgent' ? 'urgent' : goal.priority === 'high' ? 'high' : 'normal',
      context: { description: goal.description, workspaceRoot: goal.workspaceRoot },
    });
    plannerInstanceId = plannerInstance.id;
    supervisor.updateInstanceStatus(plannerInstanceId, 'running');
  } catch (err) {
    // Non-fatal - continue without tracking
    logger.debug(
      { goalId: goal.id, error: (err as Error).message },
      'Planner agent spawn failed, continuing without tracking'
    );
  }

  // Check for matching patterns in memory first
  let plan: Plan;
  try {
    const patterns = await gAgentMemoryService.findPatterns(goal.description, 1);
    if (patterns.length > 0 && patterns[0].confidence >= 0.8) {
      logger.info(
        { goalId: goal.id, patternId: patterns[0].id },
        'G-Agent: Reusing pattern from memory'
      );
      // Convert pattern to plan (simplified)
      plan = await runPlanCli(goal.description);
    } else {
      plan = await runPlanCli(goal.description);
    }

    // Mark planner as completed
    if (plannerInstanceId) {
      supervisor.updateInstanceStatus(plannerInstanceId, 'completed', {
        progress: 100,
        result: {
          success: true,
          output: `Generated plan with ${plan.tasks.length} tasks`,
          durationMs: Date.now() - startTime,
        },
      });
    }
  } catch (planErr) {
    // Mark planner as failed
    if (plannerInstanceId) {
      supervisor.updateInstanceStatus(plannerInstanceId, 'failed', {
        result: {
          success: false,
          output: '',
          error: (planErr as Error).message,
          durationMs: Date.now() - startTime,
        },
      });
    }
    throw new Error(`Plan generation failed: ${(planErr as Error).message}`);
  }

  await goalRepository.update(goal.id, {
    planId: plan.id,
    status: 'executing',
  });

  // Publish executing status to MessageBus
  messageBus.goalUpdated(goal.id, { status: 'executing', planId: plan.id });

  logger.info(
    { goalId: goal.id, planId: plan.id, taskCount: plan.tasks.length },
    'G-Agent: Plan generated, starting execution'
  );

  // Spawn an executor agent via Supervisor for tracking
  let executorInstanceId: string | undefined;
  try {
    const executorInstance = await supervisor.spawn('executor', {
      taskId: `exec_${goal.id}`,
      goalId: goal.id,
      priority:
        goal.priority === 'urgent' ? 'urgent' : goal.priority === 'high' ? 'high' : 'normal',
      context: { planId: plan.id, taskCount: plan.tasks.length },
    });
    executorInstanceId = executorInstance.id;
    supervisor.updateInstanceStatus(executorInstanceId, 'running');
  } catch (err) {
    // Non-fatal - continue without tracking
    logger.debug(
      { goalId: goal.id, error: (err as Error).message },
      'Executor agent spawn failed, continuing without tracking'
    );
  }

  // Execute the plan
  let finalStatus: 'completed' | 'failed' = 'completed';
  let resultOutput = '';

  let taskIndex = 0;
  const totalTasks = plan.tasks.length;

  try {
    for await (const event of gAgentTaskExecutor.executePlan(plan, goal.workspaceRoot)) {
      switch (event.type) {
        case 'task_completed':
          taskIndex++;
          resultOutput += `\n[${event.taskId}] Completed: ${event.output?.slice(0, 200) ?? ''}`;

          // Update executor progress
          if (executorInstanceId) {
            supervisor.addCheckpoint(
              executorInstanceId,
              `task_${taskIndex}`,
              Math.round((taskIndex / totalTasks) * 100),
              { taskId: event.taskId }
            );
          }

          // Publish task progress to MessageBus
          messageBus.updateTaskProgress(
            `exec_${goal.id}`,
            executorInstanceId || goal.id,
            Math.round((taskIndex / totalTasks) * 100),
            `Completed task ${taskIndex}/${totalTasks}`
          );

          // Save checkpoint
          await goalRepository.addCheckpoint(goal.id, {
            phase: 'task_completed',
            progress: Math.round((taskIndex / totalTasks) * 100),
            state: { taskId: event.taskId, output: event.output?.slice(0, 500) },
          });
          break;
        case 'task_failed':
          resultOutput += `\n[${event.taskId}] Failed: ${event.error}`;
          break;
        case 'plan_completed':
          finalStatus = event.status === 'completed' ? 'completed' : 'failed';
          break;
      }
    }

    // Mark executor as completed
    if (executorInstanceId) {
      supervisor.updateInstanceStatus(
        executorInstanceId,
        finalStatus === 'completed' ? 'completed' : 'failed',
        {
          progress: 100,
          result: {
            success: finalStatus === 'completed',
            output: resultOutput.slice(0, 1000),
            durationMs: Date.now() - startTime,
            error: finalStatus === 'failed' ? 'One or more tasks failed' : undefined,
          },
        }
      );
    }
  } catch (execErr) {
    // Mark executor as failed
    if (executorInstanceId) {
      supervisor.updateInstanceStatus(executorInstanceId, 'failed', {
        result: {
          success: false,
          output: '',
          error: (execErr as Error).message,
          durationMs: Date.now() - startTime,
        },
      });
    }
    throw new Error(`Execution failed: ${(execErr as Error).message}`);
  }

  const executionTime = Date.now() - startTime;
  executionTimes.push(executionTime);

  // For recurring goals, schedule next run
  if (goal.cronExpression && finalStatus === 'completed') {
    await goalRepository.update(goal.id, {
      status: 'scheduled',
      result: resultOutput.trim(),
      nextRunAt: calculateNextCronRun(goal.cronExpression),
      startedAt: undefined,
      completedAt: undefined,
    });

    // Publish rescheduled status to MessageBus
    messageBus.goalUpdated(goal.id, {
      status: 'scheduled',
      result: resultOutput.trim(),
    });

    logger.info({ goalId: goal.id }, 'G-Agent: Recurring goal rescheduled');
  } else {
    await goalRepository.update(goal.id, {
      status: finalStatus,
      result: resultOutput.trim(),
      completedAt: new Date().toISOString(),
    });

    // Publish final status to MessageBus
    if (finalStatus === 'completed') {
      messageBus.goalCompleted(goal.id, resultOutput.trim());
    } else {
      messageBus.goalUpdated(goal.id, {
        status: 'failed',
        error: 'One or more tasks failed',
      });
    }
  }

  // Notify completion
  await dispatchWebhook(finalStatus === 'completed' ? 'ship.completed' : 'ship.failed', {
    type: 'goal',
    goalId: goal.id,
    description: goal.description,
    status: finalStatus,
    executionTimeMs: executionTime,
    result: resultOutput.slice(0, 500),
  });

  logger.info(
    { goalId: goal.id, status: finalStatus, executionTimeMs: executionTime },
    'G-Agent: Goal execution finished'
  );

  await writeAuditLog({
    userId: goal.userId,
    action: `gagent.goal.${finalStatus}`,
    category: 'agent',
    target: goal.id,
    metadata: { executionTimeMs: executionTime, taskCount: plan.tasks.length },
  });
}

// ============================================================================
// SELF-SCHEDULING: Allow G-Agent to create its own goals
// ============================================================================

/**
 * Creates a follow-up goal linked to a parent goal.
 *
 * Used by G-Agent to schedule self-generated tasks after completing a goal.
 * This enables the autonomous self-improvement loop where the agent can
 * identify and queue additional work items.
 *
 * Defense-in-depth: Sanitizes input even for internal callers to prevent
 * prompt injection through self-scheduled goals.
 *
 * @param parentGoalId - The ID of the completed parent goal
 * @param description - Description of the follow-up task
 * @param options - Optional scheduling and priority settings
 * @param options.scheduledAt - ISO 8601 timestamp for delayed execution
 * @param options.priority - Priority level (inherits parent context)
 * @param options.tags - Additional tags (parent tags are automatically included)
 * @returns The created follow-up Goal, or null if parent goal not found
 * @throws {Error} If description contains blocked patterns (security check)
 *
 * @example
 * ```typescript
 * // G-Agent creates a follow-up after completing a feature
 * await createFollowUpGoal(
 *   'goal-abc123',
 *   'Write unit tests for the authentication component',
 *   { priority: 'normal', tags: ['testing'] }
 * );
 * ```
 */
export async function createFollowUpGoal(
  parentGoalId: string,
  description: string,
  options?: {
    scheduledAt?: string;
    priority?: GoalPriority;
    tags?: string[];
  }
): Promise<Goal | null> {
  const parentGoal = await goalRepository.getById(parentGoalId);
  if (!parentGoal) return null;

  // Sanitize description (especially important for self-scheduled goals)
  const sanitizedDescription = sanitizeGoalDescription(description);

  // Check for suspicious patterns in self-scheduled goals (could be prompt injection)
  const suspiciousMatches = checkGAgentSuspiciousPatterns(description);
  if (suspiciousMatches.length > 0) {
    logger.warn(
      {
        parentGoalId,
        patterns: suspiciousMatches,
        preview: description.substring(0, 100),
        source: 'gAgentGoalQueue.createFollowUpGoal',
      },
      'G-Agent: Suspicious patterns detected in follow-up goal (self-scheduled)'
    );

    if (process.env.BLOCK_SUSPICIOUS_PROMPTS === 'true') {
      throw new Error('Follow-up goal description contains blocked patterns');
    }
  }

  const goal = await createGoal({
    userId: parentGoal.userId,
    description: sanitizedDescription,
    priority: options?.priority ?? 'normal',
    triggerType: options?.scheduledAt ? 'scheduled' : 'self_scheduled',
    scheduledAt: options?.scheduledAt,
    workspaceRoot: parentGoal.workspaceRoot,
    parentGoalId,
    tags: [...(parentGoal.tags || []), ...(options?.tags || []), 'self-scheduled'],
  });

  logger.info(
    { goalId: goal.id, parentGoalId, description: sanitizedDescription.slice(0, 50) },
    'G-Agent: Follow-up goal created'
  );

  return goal;
}

/**
 * Schedules a recurring goal using cron expression syntax.
 *
 * Creates a goal that will automatically re-queue itself after each completion
 * based on the provided cron schedule. Useful for maintenance tasks, backups,
 * or periodic health checks.
 *
 * Defense-in-depth: Sanitizes input descriptions.
 *
 * @param userId - The user's unique identifier
 * @param description - Description of the recurring task
 * @param cronExpression - Standard cron expression (e.g., '0 0 * * *' for daily at midnight)
 * @param options - Optional settings
 * @param options.workspaceRoot - Filesystem path for file operations
 * @param options.priority - Priority level for each execution
 * @param options.tags - Tags for categorization
 * @returns The created recurring Goal with 'cron' trigger type
 *
 * @example
 * ```typescript
 * // Run database backup every night at 2 AM
 * await scheduleRecurringGoal(
 *   'user-123',
 *   'Backup database and verify integrity',
 *   '0 2 * * *',
 *   { priority: 'high', tags: ['maintenance', 'backup'] }
 * );
 * ```
 */
export async function scheduleRecurringGoal(
  userId: string,
  description: string,
  cronExpression: string,
  options?: {
    workspaceRoot?: string;
    priority?: GoalPriority;
    tags?: string[];
  }
): Promise<Goal> {
  // Sanitize description
  const sanitizedDescription = sanitizeGoalDescription(description);

  return createGoal({
    userId,
    description: sanitizedDescription,
    priority: options?.priority ?? 'normal',
    triggerType: 'cron',
    cronExpression,
    workspaceRoot: options?.workspaceRoot,
    tags: [...(options?.tags || []), 'recurring'],
  });
}

// ============================================================================
// GOAL QUEUE MANAGEMENT
// ============================================================================

/**
 * Starts the goal queue processor for a specific user.
 *
 * Initiates a background interval that checks for pending and due goals
 * every 30 seconds and processes them in priority order. Only one processor
 * can run per user at a time.
 *
 * @param userId - The user's unique identifier
 *
 * @example
 * ```typescript
 * // Start processing when user logs in
 * startGoalQueue('user-123');
 *
 * // Later, stop when user logs out
 * stopGoalQueue('user-123');
 * ```
 */
export function startGoalQueue(userId: string): void {
  if (processingIntervals.has(userId)) return;

  // Check for pending/due goals every 30 seconds
  const interval = setInterval(() => {
    processNextGoal(userId);
  }, 30_000);

  processingIntervals.set(userId, interval);

  // Process immediately
  processNextGoal(userId);

  logger.info({ userId }, 'G-Agent: Goal queue started');
}

/**
 * Stops the goal queue processor for a specific user.
 *
 * Clears the processing interval. In-flight goal executions will continue
 * to completion, but no new goals will be picked up.
 *
 * @param userId - The user's unique identifier
 */
export function stopGoalQueue(userId: string): void {
  const interval = processingIntervals.get(userId);
  if (interval) {
    clearInterval(interval);
    processingIntervals.delete(userId);
  }

  logger.info({ userId }, 'G-Agent: Goal queue stopped');
}

/**
 * Retrieves statistics about the goal queue.
 *
 * Returns counts by status, total processed goals, and average execution time.
 * Can be scoped to a specific user or return global stats.
 *
 * @param userId - Optional user ID to scope stats; omit for global stats
 * @returns Queue statistics including counts by status and performance metrics
 *
 * @example
 * ```typescript
 * const stats = await getQueueStats('user-123');
 * console.log(`Pending: ${stats.pending}, Avg time: ${stats.avgExecutionTimeMs}ms`);
 * ```
 */
export async function getQueueStats(userId?: string): Promise<GoalQueueStats> {
  const dbStats = await goalRepository.getStats(userId);

  const stats: GoalQueueStats = {
    pending: dbStats.pending,
    scheduled: dbStats.scheduled,
    planning: dbStats.planning,
    executing: dbStats.executing,
    completed: dbStats.completed,
    failed: dbStats.failed,
    totalProcessed: dbStats.completed + dbStats.failed,
    avgExecutionTimeMs:
      executionTimes.length > 0
        ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
        : 0,
  };

  return stats;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateNextCronRun(_cronExpression: string): string {
  // Simple next-minute calculation for demo
  // In production, use a proper cron parser like 'cron-parser'
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  now.setSeconds(0);
  now.setMilliseconds(0);
  return now.toISOString();
}

// ============================================================================
// EXPORTS
// ============================================================================

export const gAgentGoalQueue = {
  createGoal,
  getGoal,
  getUserGoals,
  cancelGoal,
  retryGoal,
  createFollowUpGoal,
  scheduleRecurringGoal,
  startGoalQueue,
  stopGoalQueue,
  getQueueStats,
};

export default gAgentGoalQueue;

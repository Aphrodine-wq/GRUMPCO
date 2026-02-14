/**
 * G-Agent Supervisor
 *
 * The Supervisor is responsible for:
 * - Spawning agents dynamically based on task requirements
 * - Monitoring agent health and status
 * - Coordinating multi-agent workflows
 * - Handling failures and retries
 * - Managing agent concurrency limits
 */

import { EventEmitter } from 'events';
import { agentRegistry } from './registry.js';
import { messageBus, CHANNELS, type BusMessage } from './messageBus.js';
import type {
  AgentType,
  AgentTier,
  AgentStatus,
  AgentInstance,
  AgentResult,
  AgentCheckpoint,
  Plan,
  Task,
  AgentEvent,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SpawnOptions {
  taskId: string;
  goalId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  userTier?: AgentTier;
  context?: Record<string, unknown>;
  parentAgentId?: string;
}

export interface WorkflowOptions {
  goalId?: string;
  userTier: AgentTier;
  workspaceRoot?: string;
  autonomous?: boolean;
  onEvent?: (event: AgentEvent) => void;
}

interface AgentExecution {
  instance: AgentInstance;
  promise: Promise<AgentResult>;
  abortController: AbortController;
}

// ============================================================================
// SUPERVISOR CLASS
// ============================================================================

export class Supervisor {
  private instances: Map<string, AgentInstance>;
  private executions: Map<string, AgentExecution>;
  private concurrencyCount: Map<AgentType, number>;
  private eventEmitter: EventEmitter;
  private subscriptions: string[];
  private static instance: Supervisor;

  private constructor() {
    this.instances = new Map();
    this.executions = new Map();
    this.concurrencyCount = new Map();
    this.eventEmitter = new EventEmitter();
    this.subscriptions = [];

    this.setupMessageBusListeners();
  }

  static getInstance(): Supervisor {
    if (!Supervisor.instance) {
      Supervisor.instance = new Supervisor();
    }
    return Supervisor.instance;
  }

  // ============================================================================
  // MESSAGE BUS INTEGRATION
  // ============================================================================

  private setupMessageBusListeners(): void {
    // Listen for spawn requests
    const spawnSub = messageBus.onAgentSpawnRequest(async (msg) => {
      try {
        await this.spawn(msg.agentType, {
          taskId: msg.taskId,
          goalId: msg.goalId,
          priority: msg.priority,
          context: msg.context,
        });
      } catch (err) {
        messageBus.systemError(
          `Failed to spawn agent ${msg.agentType}: ${(err as Error).message}`,
          'SPAWN_FAILED',
          'supervisor'
        );
      }
    });
    this.subscriptions.push(spawnSub);

    // Listen for task completions to update agent status
    const completeSub = messageBus.onTaskComplete((msg) => {
      const instance = this.findInstanceByTaskId(msg.taskId);
      if (instance) {
        this.updateInstanceStatus(instance.id, 'completed', {
          result: {
            success: true,
            output: msg.output,
            artifacts: msg.artifacts as Array<{
              type: 'file' | 'code' | 'diagram' | 'report';
              path?: string;
              content: string;
              language?: string;
            }>,
            durationMs: msg.durationMs,
          },
        });
      }
    });
    this.subscriptions.push(completeSub);

    // Listen for task failures
    const failSub = messageBus.onTaskFailed((msg) => {
      const instance = this.findInstanceByTaskId(msg.taskId);
      if (instance) {
        this.updateInstanceStatus(instance.id, 'failed', {
          result: {
            success: false,
            output: '',
            error: msg.error,
            durationMs: 0,
          },
        });
      }
    });
    this.subscriptions.push(failSub);
  }

  private findInstanceByTaskId(taskId: string): AgentInstance | undefined {
    for (const instance of this.instances.values()) {
      if (instance.taskId === taskId) {
        return instance;
      }
    }
    return undefined;
  }

  // ============================================================================
  // AGENT SPAWNING
  // ============================================================================

  /**
   * Spawn a new agent instance
   */
  async spawn(agentType: AgentType, options: SpawnOptions): Promise<AgentInstance> {
    const definition = agentRegistry.getByType(agentType);
    if (!definition) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    // Check tier access
    if (options.userTier && !agentRegistry.isAvailable(definition.id, options.userTier)) {
      throw new Error(`Agent ${agentType} requires higher tier than ${options.userTier}`);
    }

    // Check concurrency limits
    const currentCount = this.concurrencyCount.get(agentType) || 0;
    if (currentCount >= definition.maxConcurrency) {
      throw new Error(`Agent ${agentType} at max concurrency (${definition.maxConcurrency})`);
    }

    // Create instance
    const instanceId = `agent_${agentType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const instance: AgentInstance = {
      id: instanceId,
      definitionId: definition.id,
      type: agentType,
      status: 'starting',
      taskId: options.taskId,
      goalId: options.goalId,
      startedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      checkpoints: [],
    };

    this.instances.set(instanceId, instance);
    this.concurrencyCount.set(agentType, currentCount + 1);

    // Emit spawn event
    this.emitEvent({
      type: 'agent_spawned',
      agentId: instanceId,
      agentType,
    });

    messageBus.updateAgentStatus(instanceId, agentType, 'starting', {
      taskId: options.taskId,
    });

    return instance;
  }

  /**
   * Spawn multiple agents for a workflow
   */
  async spawnWorkflow(agentTypes: AgentType[], options: WorkflowOptions): Promise<AgentInstance[]> {
    // Get execution order (respects dependencies)
    const batches = agentRegistry.getExecutionOrder(agentTypes);
    const instances: AgentInstance[] = [];

    for (const batch of batches) {
      // Spawn batch in parallel
      const batchPromises = batch.map(async (agentType) => {
        const taskId = `task_${agentType}_${Date.now()}`;
        const instance = await this.spawn(agentType, {
          taskId,
          goalId: options.goalId,
          userTier: options.userTier,
          context: { workspaceRoot: options.workspaceRoot },
        });
        return instance;
      });

      const batchInstances = await Promise.all(batchPromises);
      instances.push(...batchInstances);
    }

    return instances;
  }

  // ============================================================================
  // AGENT STATUS MANAGEMENT
  // ============================================================================

  /**
   * Update an agent instance's status
   */
  updateInstanceStatus(
    instanceId: string,
    status: AgentStatus,
    updates?: {
      progress?: number;
      message?: string;
      result?: AgentResult;
    }
  ): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    const previousStatus = instance.status;
    instance.status = status;
    instance.lastHeartbeat = new Date().toISOString();

    if (updates?.result) {
      instance.result = updates.result;
    }

    // Update concurrency count on completion
    if (
      (status === 'completed' || status === 'failed' || status === 'cancelled') &&
      previousStatus !== 'completed' &&
      previousStatus !== 'failed' &&
      previousStatus !== 'cancelled'
    ) {
      const count = this.concurrencyCount.get(instance.type) || 0;
      this.concurrencyCount.set(instance.type, Math.max(0, count - 1));
    }

    // Emit status update
    messageBus.updateAgentStatus(instanceId, instance.type, status, {
      taskId: instance.taskId,
      progress: updates?.progress,
      message: updates?.message,
    });

    if (status === 'completed' && instance.result) {
      this.emitEvent({
        type: 'agent_completed',
        agentId: instanceId,
        result: instance.result,
      });
    }
  }

  /**
   * Add a checkpoint to an agent instance
   */
  addCheckpoint(
    instanceId: string,
    phase: string,
    progress: number,
    data?: Record<string, unknown>
  ): AgentCheckpoint | undefined {
    const instance = this.instances.get(instanceId);
    if (!instance) return undefined;

    const checkpoint: AgentCheckpoint = {
      id: `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      progress,
      message: phase,
      data,
    };

    instance.checkpoints.push(checkpoint);
    instance.lastHeartbeat = new Date().toISOString();

    return checkpoint;
  }

  /**
   * Send heartbeat for an agent
   */
  heartbeat(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.lastHeartbeat = new Date().toISOString();
    }
  }

  // ============================================================================
  // PLAN EXECUTION
  // ============================================================================

  /**
   * Execute a plan using appropriate agents
   * Returns an async generator that yields AgentEvents
   */
  executePlan(plan: Plan, options: WorkflowOptions): AsyncGenerator<AgentEvent> {
    const executeTaskAndCollect = this.executeTaskAndCollect.bind(this);

    return (async function* (): AsyncGenerator<AgentEvent> {
      yield {
        type: 'plan_started',
        planId: plan.id,
      };

      const taskResults = new Map<string, AgentResult>();
      let hasFailure = false;

      // Process parallel batches sequentially (batches are parallel, execution order is sequential)
      for (const batch of plan.parallelBatches) {
        if (hasFailure && !options.autonomous) {
          break;
        }

        // Get tasks for this batch
        const batchTasks = plan.tasks.filter((t) => batch.includes(t.id));

        // Execute each task and collect events (can't yield from inside map callback)
        const taskEventPromises = batchTasks.map((task) =>
          executeTaskAndCollect(task, options, taskResults)
        );

        // Wait for all tasks in batch to complete
        const allTaskEvents = await Promise.all(taskEventPromises);

        // Yield all collected events
        for (const taskEvents of allTaskEvents) {
          for (const event of taskEvents.events) {
            yield event;
          }
          if (!taskEvents.success) {
            hasFailure = true;
          }
        }
      }

      yield {
        type: 'plan_completed',
        planId: plan.id,
        status: hasFailure ? 'failed' : 'completed',
      };
    })();
  }

  /**
   * Execute a single task and collect all events (instead of yielding)
   */
  private async executeTaskAndCollect(
    task: Task,
    options: WorkflowOptions,
    _previousResults: Map<string, AgentResult>
  ): Promise<{ events: AgentEvent[]; success: boolean }> {
    const events: AgentEvent[] = [];
    let success = true;

    // Determine best agent for this task
    const agentTypes = agentRegistry.selectAgentsForTask(task.description, options.userTier);
    const agentType = agentTypes[0] || 'executor';

    events.push({
      type: 'task_started',
      taskId: task.id,
      description: task.description,
    });

    try {
      // Spawn agent for this task
      const instance = await this.spawn(agentType, {
        taskId: task.id,
        goalId: options.goalId,
        userTier: options.userTier,
        context: {
          workspaceRoot: options.workspaceRoot,
          task,
        },
      });

      events.push({
        type: 'agent_spawned',
        agentId: instance.id,
        agentType,
      });

      // Update to running
      this.updateInstanceStatus(instance.id, 'running');

      events.push({
        type: 'agent_started',
        agentId: instance.id,
      });

      // Wait for task completion via message bus
      const result = await messageBus.waitForTask(task.id);

      if (result.type === 'task_complete') {
        events.push({
          type: 'task_completed',
          taskId: task.id,
          output: result.output,
          durationMs: result.durationMs,
        });
      } else {
        success = false;
        events.push({
          type: 'task_failed',
          taskId: task.id,
          error: (result as { error: string }).error,
        });
      }
    } catch (err) {
      success = false;
      events.push({
        type: 'task_failed',
        taskId: task.id,
        error: (err as Error).message,
      });
    }

    return { events, success };
  }

  // ============================================================================
  // AGENT MANAGEMENT
  // ============================================================================

  /**
   * Get an agent instance by ID
   */
  getInstance(instanceId: string): AgentInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Get all agent instances
   */
  getAllInstances(options?: {
    status?: AgentStatus[];
    type?: AgentType;
    goalId?: string;
  }): AgentInstance[] {
    let instances = Array.from(this.instances.values());

    if (options?.status) {
      instances = instances.filter((i) => options.status!.includes(i.status));
    }

    if (options?.type) {
      instances = instances.filter((i) => i.type === options.type);
    }

    if (options?.goalId) {
      instances = instances.filter((i) => i.goalId === options.goalId);
    }

    return instances;
  }

  /**
   * Get running instances count per agent type
   */
  getConcurrencyStatus(): Record<AgentType, { running: number; max: number }> {
    const status: Record<string, { running: number; max: number }> = {};

    for (const definition of agentRegistry.getAll()) {
      status[definition.type] = {
        running: this.concurrencyCount.get(definition.type) || 0,
        max: definition.maxConcurrency,
      };
    }

    return status as Record<AgentType, { running: number; max: number }>;
  }

  /**
   * Cancel an agent instance
   */
  cancel(instanceId: string): boolean {
    const execution = this.executions.get(instanceId);
    if (execution) {
      execution.abortController.abort();
    }

    const instance = this.instances.get(instanceId);
    if (instance && instance.status !== 'completed' && instance.status !== 'failed') {
      this.updateInstanceStatus(instanceId, 'cancelled');
      return true;
    }

    return false;
  }

  /**
   * Cancel all agents for a goal
   */
  cancelGoal(goalId: string): number {
    let cancelled = 0;

    for (const instance of this.instances.values()) {
      if (instance.goalId === goalId) {
        if (this.cancel(instance.id)) {
          cancelled++;
        }
      }
    }

    return cancelled;
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  /**
   * Check for stale agents (no heartbeat for too long)
   */
  checkHealth(maxStaleMs: number = 60_000): AgentInstance[] {
    const stale: AgentInstance[] = [];
    const now = Date.now();

    for (const instance of this.instances.values()) {
      if (
        instance.status === 'running' ||
        instance.status === 'waiting' ||
        instance.status === 'starting'
      ) {
        const lastBeat = new Date(instance.lastHeartbeat).getTime();
        if (now - lastBeat > maxStaleMs) {
          stale.push(instance);
        }
      }
    }

    return stale;
  }

  /**
   * Kill stale agents
   */
  killStale(maxStaleMs: number = 60_000): number {
    const stale = this.checkHealth(maxStaleMs);
    let killed = 0;

    for (const instance of stale) {
      this.updateInstanceStatus(instance.id, 'failed', {
        result: {
          success: false,
          output: '',
          error: 'Agent became unresponsive (no heartbeat)',
          durationMs: Date.now() - new Date(instance.startedAt).getTime(),
        },
      });
      killed++;
    }

    return killed;
  }

  /**
   * Cleanup completed/failed instances older than specified age
   */
  cleanup(maxAgeMs: number = 3600_000): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [id, instance] of this.instances) {
      if (
        instance.status === 'completed' ||
        instance.status === 'failed' ||
        instance.status === 'cancelled'
      ) {
        const age = now - new Date(instance.startedAt).getTime();
        if (age > maxAgeMs) {
          this.instances.delete(id);
          this.executions.delete(id);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  private emitEvent(event: AgentEvent): void {
    this.eventEmitter.emit('event', event);
  }

  /**
   * Subscribe to supervisor events
   */
  onEvent(handler: (event: AgentEvent) => void): () => void {
    this.eventEmitter.on('event', handler);
    return () => this.eventEmitter.off('event', handler);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalInstances: number;
    byStatus: Record<AgentStatus, number>;
    byType: Record<AgentType, number>;
  } {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const instance of this.instances.values()) {
      byStatus[instance.status] = (byStatus[instance.status] || 0) + 1;
      byType[instance.type] = (byType[instance.type] || 0) + 1;
    }

    return {
      totalInstances: this.instances.size,
      byStatus: byStatus as Record<AgentStatus, number>,
      byType: byType as Record<AgentType, number>,
    };
  }

  // ============================================================================
  // SHUTDOWN
  // ============================================================================

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Unsubscribe from message bus
    for (const subId of this.subscriptions) {
      messageBus.unsubscribe(subId);
    }
    this.subscriptions = [];

    // Cancel all running agents
    for (const instance of this.instances.values()) {
      if (
        instance.status === 'running' ||
        instance.status === 'starting' ||
        instance.status === 'waiting'
      ) {
        this.cancel(instance.id);
      }
    }

    // Wait a bit for cancellations to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Clear all state
    this.instances.clear();
    this.executions.clear();
    this.concurrencyCount.clear();
  }
}

// Export singleton instance
export const supervisor = Supervisor.getInstance();

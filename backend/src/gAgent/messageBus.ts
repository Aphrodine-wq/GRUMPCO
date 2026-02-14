/**
 * G-Agent Message Bus
 *
 * Provides inter-agent communication through a pub/sub event system.
 * This enables agents to:
 * - Broadcast messages to all agents
 * - Send targeted messages to specific agents
 * - Subscribe to events from other agents
 * - Coordinate multi-agent workflows
 */

import { EventEmitter } from 'events';
import type {
  AgentType,
  AgentStatus,
  AgentResult,
  Goal,
  MessageBusEvent,
  MessageBusSubscription,
} from './types.js';

// ============================================================================
// CHANNEL CONSTANTS
// ============================================================================

export const CHANNELS = {
  // Agent lifecycle
  AGENT_SPAWN: 'agent:spawn',
  AGENT_STATUS: 'agent:status',
  AGENT_MESSAGE: 'agent:message',
  AGENT_RESULT: 'agent:result',

  // Task coordination
  TASK_ASSIGN: 'task:assign',
  TASK_PROGRESS: 'task:progress',
  TASK_COMPLETE: 'task:complete',
  TASK_FAILED: 'task:failed',

  // Goal updates
  GOAL_CREATED: 'goal:created',
  GOAL_UPDATED: 'goal:updated',
  GOAL_COMPLETED: 'goal:completed',

  // System events
  SYSTEM_ERROR: 'system:error',
  SYSTEM_SHUTDOWN: 'system:shutdown',

  // Broadcast
  BROADCAST: 'broadcast',
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface AgentSpawnMessage {
  type: 'agent_spawn_request';
  agentType: AgentType;
  taskId: string;
  goalId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  context?: Record<string, unknown>;
}

export interface AgentStatusMessage {
  type: 'agent_status_update';
  agentId: string;
  agentType: AgentType;
  status: AgentStatus;
  taskId?: string;
  progress?: number;
  message?: string;
}

export interface AgentResultMessage {
  type: 'agent_result';
  agentId: string;
  agentType: AgentType;
  taskId: string;
  result: AgentResult;
}

export interface TaskAssignMessage {
  type: 'task_assign';
  taskId: string;
  agentType: AgentType;
  description: string;
  tools: string[];
  dependsOn: string[];
  context?: Record<string, unknown>;
}

export interface TaskProgressMessage {
  type: 'task_progress';
  taskId: string;
  agentId: string;
  progress: number;
  message?: string;
}

export interface TaskCompleteMessage {
  type: 'task_complete';
  taskId: string;
  agentId: string;
  output: string;
  artifacts?: Array<{ type: string; path?: string; content: string }>;
  durationMs: number;
}

export interface TaskFailedMessage {
  type: 'task_failed';
  taskId: string;
  agentId: string;
  error: string;
  retryable: boolean;
}

export interface GoalCreatedMessage {
  type: 'goal_created';
  goal: Goal;
}

export interface GoalUpdatedMessage {
  type: 'goal_updated';
  goalId: string;
  update: Partial<Goal>;
}

export interface GoalCompletedMessage {
  type: 'goal_completed';
  goalId: string;
  result: string;
  artifacts?: Array<{ type: string; path?: string; content: string }>;
}

export interface BroadcastMessage {
  type: 'broadcast';
  channel: string;
  data: unknown;
  source?: string;
}

export interface SystemErrorMessage {
  type: 'system_error';
  error: string;
  code?: string;
  source?: string;
}

export type BusMessage =
  | AgentSpawnMessage
  | AgentStatusMessage
  | AgentResultMessage
  | TaskAssignMessage
  | TaskProgressMessage
  | TaskCompleteMessage
  | TaskFailedMessage
  | GoalCreatedMessage
  | GoalUpdatedMessage
  | GoalCompletedMessage
  | BroadcastMessage
  | SystemErrorMessage;

// ============================================================================
// MESSAGE BUS CLASS
// ============================================================================

type MessageHandler<T = BusMessage> = (message: T) => void | Promise<void>;

interface Subscription {
  id: string;
  channel: string;
  handler: MessageHandler;
  filter?: (message: BusMessage) => boolean;
}

export class MessageBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, Subscription>;
  private messageHistory: Array<{
    channel: string;
    message: BusMessage;
    timestamp: string;
  }>;
  private maxHistory: number;
  private static instance: MessageBus;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Allow many agent listeners
    this.subscriptions = new Map();
    this.messageHistory = [];
    this.maxHistory = 1000;
  }

  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  // ============================================================================
  // PUBLISHING
  // ============================================================================

  /**
   * Publish a message to a channel
   */
  publish(channel: Channel, message: BusMessage): void {
    const entry = {
      channel,
      message,
      timestamp: new Date().toISOString(),
    };

    // Store in history
    this.messageHistory.push(entry);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }

    // Emit to channel subscribers
    this.emitter.emit(channel, message);

    // Also emit to wildcard subscribers
    this.emitter.emit('*', { channel, message });
  }

  /**
   * Publish agent spawn request
   */
  requestAgentSpawn(
    agentType: AgentType,
    taskId: string,
    options?: {
      goalId?: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      context?: Record<string, unknown>;
    }
  ): void {
    this.publish(CHANNELS.AGENT_SPAWN, {
      type: 'agent_spawn_request',
      agentType,
      taskId,
      ...options,
    });
  }

  /**
   * Publish agent status update
   */
  updateAgentStatus(
    agentId: string,
    agentType: AgentType,
    status: AgentStatus,
    options?: {
      taskId?: string;
      progress?: number;
      message?: string;
    }
  ): void {
    this.publish(CHANNELS.AGENT_STATUS, {
      type: 'agent_status_update',
      agentId,
      agentType,
      status,
      ...options,
    });
  }

  /**
   * Publish agent result
   */
  publishAgentResult(
    agentId: string,
    agentType: AgentType,
    taskId: string,
    result: AgentResult
  ): void {
    this.publish(CHANNELS.AGENT_RESULT, {
      type: 'agent_result',
      agentId,
      agentType,
      taskId,
      result,
    });
  }

  /**
   * Publish task assignment
   */
  assignTask(
    taskId: string,
    agentType: AgentType,
    description: string,
    tools: string[],
    dependsOn: string[],
    context?: Record<string, unknown>
  ): void {
    this.publish(CHANNELS.TASK_ASSIGN, {
      type: 'task_assign',
      taskId,
      agentType,
      description,
      tools,
      dependsOn,
      context,
    });
  }

  /**
   * Publish task progress
   */
  updateTaskProgress(taskId: string, agentId: string, progress: number, message?: string): void {
    this.publish(CHANNELS.TASK_PROGRESS, {
      type: 'task_progress',
      taskId,
      agentId,
      progress,
      message,
    });
  }

  /**
   * Publish task completion
   */
  completeTask(
    taskId: string,
    agentId: string,
    output: string,
    durationMs: number,
    artifacts?: Array<{ type: string; path?: string; content: string }>
  ): void {
    this.publish(CHANNELS.TASK_COMPLETE, {
      type: 'task_complete',
      taskId,
      agentId,
      output,
      durationMs,
      artifacts,
    });
  }

  /**
   * Publish task failure
   */
  failTask(taskId: string, agentId: string, error: string, retryable: boolean): void {
    this.publish(CHANNELS.TASK_FAILED, {
      type: 'task_failed',
      taskId,
      agentId,
      error,
      retryable,
    });
  }

  /**
   * Publish goal created
   */
  goalCreated(goal: Goal): void {
    this.publish(CHANNELS.GOAL_CREATED, {
      type: 'goal_created',
      goal,
    });
  }

  /**
   * Publish goal update
   */
  goalUpdated(goalId: string, update: Partial<Goal>): void {
    this.publish(CHANNELS.GOAL_UPDATED, {
      type: 'goal_updated',
      goalId,
      update,
    });
  }

  /**
   * Publish goal completed
   */
  goalCompleted(
    goalId: string,
    result: string,
    artifacts?: Array<{ type: string; path?: string; content: string }>
  ): void {
    this.publish(CHANNELS.GOAL_COMPLETED, {
      type: 'goal_completed',
      goalId,
      result,
      artifacts,
    });
  }

  /**
   * Broadcast to all listeners
   */
  broadcast(channel: string, data: unknown, source?: string): void {
    this.publish(CHANNELS.BROADCAST, {
      type: 'broadcast',
      channel,
      data,
      source,
    });
  }

  /**
   * Publish system error
   */
  systemError(error: string, code?: string, source?: string): void {
    this.publish(CHANNELS.SYSTEM_ERROR, {
      type: 'system_error',
      error,
      code,
      source,
    });
  }

  // ============================================================================
  // SUBSCRIBING
  // ============================================================================

  /**
   * Subscribe to a channel
   */
  subscribe<T extends BusMessage = BusMessage>(
    channel: Channel | '*',
    handler: MessageHandler<T>,
    filter?: (message: BusMessage) => boolean
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const wrappedHandler: MessageHandler = (message: BusMessage) => {
      if (filter && !filter(message)) return;
      handler(message as T);
    };

    const subscription: Subscription = {
      id: subscriptionId,
      channel,
      handler: wrappedHandler,
      filter,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.emitter.on(channel, wrappedHandler);

    return subscriptionId;
  }

  /**
   * Subscribe to agent spawn requests
   */
  onAgentSpawnRequest(handler: MessageHandler<AgentSpawnMessage>): string {
    return this.subscribe(CHANNELS.AGENT_SPAWN, handler);
  }

  /**
   * Subscribe to agent status updates
   */
  onAgentStatusUpdate(handler: MessageHandler<AgentStatusMessage>, agentId?: string): string {
    return this.subscribe(
      CHANNELS.AGENT_STATUS,
      handler,
      agentId ? (m) => (m as AgentStatusMessage).agentId === agentId : undefined
    );
  }

  /**
   * Subscribe to agent results
   */
  onAgentResult(handler: MessageHandler<AgentResultMessage>, agentId?: string): string {
    return this.subscribe(
      CHANNELS.AGENT_RESULT,
      handler,
      agentId ? (m) => (m as AgentResultMessage).agentId === agentId : undefined
    );
  }

  /**
   * Subscribe to task completions
   */
  onTaskComplete(handler: MessageHandler<TaskCompleteMessage>, taskId?: string): string {
    return this.subscribe(
      CHANNELS.TASK_COMPLETE,
      handler,
      taskId ? (m) => (m as TaskCompleteMessage).taskId === taskId : undefined
    );
  }

  /**
   * Subscribe to task failures
   */
  onTaskFailed(handler: MessageHandler<TaskFailedMessage>, taskId?: string): string {
    return this.subscribe(
      CHANNELS.TASK_FAILED,
      handler,
      taskId ? (m) => (m as TaskFailedMessage).taskId === taskId : undefined
    );
  }

  /**
   * Subscribe to goal updates
   */
  onGoalUpdated(handler: MessageHandler<GoalUpdatedMessage>, goalId?: string): string {
    return this.subscribe(
      CHANNELS.GOAL_UPDATED,
      handler,
      goalId ? (m) => (m as GoalUpdatedMessage).goalId === goalId : undefined
    );
  }

  /**
   * Subscribe to all events (wildcard)
   */
  onAny(handler: (event: { channel: string; message: BusMessage }) => void): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Wrapper to match MessageHandler signature for internal tracking
    const wrappedHandler: MessageHandler = () => {
      // This is just for tracking - actual handler uses emitter directly
    };

    const subscription: Subscription = {
      id: subscriptionId,
      channel: '*',
      handler: wrappedHandler,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.emitter.on('*', handler);

    return subscriptionId;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    this.emitter.off(subscription.channel, subscription.handler);
    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Unsubscribe all handlers for a channel
   */
  unsubscribeAll(channel?: Channel): void {
    if (channel) {
      this.emitter.removeAllListeners(channel);
      for (const [id, sub] of this.subscriptions) {
        if (sub.channel === channel) {
          this.subscriptions.delete(id);
        }
      }
    } else {
      this.emitter.removeAllListeners();
      this.subscriptions.clear();
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Wait for a specific event (one-time)
   */
  once<T extends BusMessage = BusMessage>(
    channel: Channel,
    filter?: (message: BusMessage) => boolean,
    timeoutMs?: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const handler: MessageHandler = (message: BusMessage) => {
        if (filter && !filter(message)) return;

        if (timeoutId) clearTimeout(timeoutId);
        this.emitter.off(channel, handler);
        resolve(message as T);
      };

      this.emitter.on(channel, handler);

      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          this.emitter.off(channel, handler);
          reject(new Error(`Timeout waiting for event on channel: ${channel}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Wait for task completion (success or failure)
   */
  async waitForTask(
    taskId: string,
    timeoutMs: number = 300_000
  ): Promise<TaskCompleteMessage | TaskFailedMessage> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;
      let completeSubId: string | undefined;
      let failedSubId: string | undefined;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (completeSubId) this.unsubscribe(completeSubId);
        if (failedSubId) this.unsubscribe(failedSubId);
      };

      completeSubId = this.onTaskComplete((msg) => {
        if (msg.taskId === taskId) {
          cleanup();
          resolve(msg);
        }
      });

      failedSubId = this.onTaskFailed((msg) => {
        if (msg.taskId === taskId) {
          cleanup();
          resolve(msg);
        }
      });

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for task: ${taskId}`));
      }, timeoutMs);
    });
  }

  /**
   * Get message history
   */
  getHistory(options?: {
    channel?: Channel;
    limit?: number;
    since?: string;
  }): Array<{ channel: string; message: BusMessage; timestamp: string }> {
    let history = [...this.messageHistory];

    if (options?.channel) {
      history = history.filter((h) => h.channel === options.channel);
    }

    if (options?.since) {
      const sinceDate = new Date(options.since);
      history = history.filter((h) => new Date(h.timestamp) >= sinceDate);
    }

    if (options?.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(channel?: Channel): number {
    if (channel) {
      return Array.from(this.subscriptions.values()).filter((s) => s.channel === channel).length;
    }
    return this.subscriptions.size;
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Shutdown the message bus
   */
  shutdown(): void {
    this.publish(CHANNELS.SYSTEM_SHUTDOWN, {
      type: 'broadcast',
      channel: 'shutdown',
      data: { reason: 'Message bus shutting down' },
    });

    this.unsubscribeAll();
    this.clearHistory();
  }
}

// Export singleton instance
export const messageBus = MessageBus.getInstance();

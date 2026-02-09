/**
 * Agent Store
 *
 * Main store for Agent state management including:
 * - Goal queue management
 * - Agent status tracking
 * - SSE event streaming
 * - Kill switch control
 */

import { writable, derived, get } from 'svelte/store';
import { fetchApi, getApiBase } from '../lib/api.js';

// ============================================================================
// TYPES
// ============================================================================

export type GoalStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type GoalPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TriggerType = 'immediate' | 'scheduled' | 'recurring';

export interface Goal {
  id: string;
  userId: string;
  description: string;
  status: GoalStatus;
  priority: GoalPriority;
  triggerType: TriggerType;
  scheduledAt?: string;
  cronExpression?: string;
  workspaceRoot?: string;
  tags?: string[];
  maxRetries: number;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  error?: string;
}

export interface QueueStats {
  pending: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

export interface GlobalStopInfo {
  active: boolean;
  reason?: string;
  stoppedAt?: string;
  stoppedBy?: string;
}

export interface agentStatus {
  status: 'operational' | 'stopped' | 'error';
  timestamp: string;
  queue: QueueStats;
  control: GlobalStopInfo & { globalStopActive: boolean };
  capabilities: Record<string, boolean>;
}

// SSE Event types
export type agentSSEEvent =
  | { type: 'connected'; sessionId: string; userId: string; timestamp: string }
  | { type: 'goal_created'; goal: Goal }
  | { type: 'goal_updated'; goalId: string; update: Partial<Goal> }
  | { type: 'goal_completed'; goalId: string; result: string }
  | { type: 'agent_spawned'; agentType: string; taskId: string; goalId?: string }
  | { type: 'agent_status'; agentId: string; status: string; progress?: number }
  | { type: 'agent_result'; agentId: string; taskId: string; result: unknown }
  | { type: 'task_progress'; taskId: string; progress: number; message?: string }
  | { type: 'task_complete'; taskId: string; output: string }
  | { type: 'task_failed'; taskId: string; error: string }
  | { type: 'budget_warning'; status: unknown; message: string }
  | { type: 'budget_critical'; status: unknown; message: string }
  | { type: 'approval_required'; request: unknown }
  | { type: 'emergency_stop'; reason: string; initiatedBy: string }
  | { type: 'operations_resumed'; initiatedBy: string }
  | { type: 'system_error'; error: string; code?: string }
  | { type: 'broadcast'; channel: string; data: unknown };

// Store state
interface agentStoreState {
  goals: Goal[];
  queueStats: QueueStats | null;
  globalStopInfo: GlobalStopInfo;
  status: agentStatus | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastEvent: agentSSEEvent | null;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

const initialState: agentStoreState = {
  goals: [],
  queueStats: null,
  globalStopInfo: { active: false },
  status: null,
  isLoading: false,
  isConnected: false,
  error: null,
  lastEvent: null,
};

const store = writable<agentStoreState>(initialState);

// SSE connection management
let eventSource: EventSource | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

// Event listeners for forwarding SSE events
type SSEEventListener = (event: agentSSEEvent) => void;
let sseEventListeners: SSEEventListener[] = [];

// ============================================================================
// DERIVED STORES
// ============================================================================

export const goals = derived(store, ($s) => $s.goals);
export const queueStats = derived(store, ($s) => $s.queueStats);
export const globalStopInfo = derived(store, ($s) => $s.globalStopInfo);
export const isGlobalStopActive = derived(store, ($s) => $s.globalStopInfo.active);
export const agentStatus = derived(store, ($s) => $s.status);
export const isLoading = derived(store, ($s) => $s.isLoading);
export const isConnected = derived(store, ($s) => $s.isConnected);
export const agentError = derived(store, ($s) => $s.error);
export const lastEvent = derived(store, ($s) => $s.lastEvent);

export const pendingGoals = derived(store, ($s) =>
  $s.goals.filter((g) => g.status === 'pending' || g.status === 'queued')
);

export const activeGoals = derived(store, ($s) => $s.goals.filter((g) => g.status === 'running'));

export const completedGoals = derived(store, ($s) =>
  $s.goals.filter((g) => g.status === 'completed')
);

// ============================================================================
// STORE ACTIONS
// ============================================================================

export const agentStore = {
  subscribe: store.subscribe,

  // ==========================================================================
  // SSE EVENT HANDLING
  // ==========================================================================

  /**
   * Subscribe to SSE events
   */
  onSSEEvent(listener: SSEEventListener): () => void {
    sseEventListeners.push(listener);
    return () => {
      sseEventListeners = sseEventListeners.filter((l) => l !== listener);
    };
  },

  /**
   * Emit SSE event to all listeners
   */
  emitSSEEvent(event: agentSSEEvent): void {
    store.update((s) => ({ ...s, lastEvent: event }));
    for (const listener of sseEventListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('SSE event listener error:', e);
      }
    }
  },

  /**
   * Connect to SSE stream
   */
  connect(sessionId: string = 'default'): void {
    // Disconnect existing connection
    this.disconnect();

    const url = `${getApiBase()}/api/agent/stream?sessionId=${encodeURIComponent(sessionId)}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      store.update((s) => ({ ...s, isConnected: true, error: null }));
      // Connection established successfully
    };

    eventSource.onerror = (error) => {
      console.error('[Agent] SSE error:', error);
      store.update((s) => ({ ...s, isConnected: false }));

      // Attempt reconnection after 5 seconds
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          this.connect(sessionId);
        }, 5000);
      }
    };

    // Handle specific event types
    const eventTypes = [
      'connected',
      'goal_created',
      'goal_updated',
      'goal_completed',
      'agent_spawned',
      'agent_status',
      'agent_result',
      'task_progress',
      'task_complete',
      'task_failed',
      'budget_warning',
      'budget_critical',
      'approval_required',
      'emergency_stop',
      'operations_resumed',
      'system_error',
      'broadcast',
    ];

    for (const eventType of eventTypes) {
      eventSource.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const event: agentSSEEvent = { type: eventType as agentSSEEvent['type'], ...data };
          this.handleSSEEvent(event);
          this.emitSSEEvent(event);
        } catch (err) {
          console.warn(`[Agent] Failed to parse ${eventType} event:`, err);
        }
      });
    }
  },

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    store.update((s) => ({ ...s, isConnected: false }));
  },

  /**
   * Handle incoming SSE event
   */
  handleSSEEvent(event: agentSSEEvent): void {
    switch (event.type) {
      case 'goal_created':
        store.update((s) => ({
          ...s,
          goals: [...s.goals, event.goal],
        }));
        break;

      case 'goal_updated':
        store.update((s) => ({
          ...s,
          goals: s.goals.map((g) => (g.id === event.goalId ? { ...g, ...event.update } : g)),
        }));
        break;

      case 'goal_completed':
        store.update((s) => ({
          ...s,
          goals: s.goals.map((g) =>
            g.id === event.goalId
              ? { ...g, status: 'completed' as GoalStatus, result: event.result }
              : g
          ),
        }));
        break;

      case 'emergency_stop':
        store.update((s) => ({
          ...s,
          globalStopInfo: {
            active: true,
            reason: event.reason,
            stoppedBy: event.initiatedBy,
            stoppedAt: new Date().toISOString(),
          },
        }));
        break;

      case 'operations_resumed':
        store.update((s) => ({
          ...s,
          globalStopInfo: { active: false },
        }));
        break;

      case 'system_error':
        store.update((s) => ({
          ...s,
          error: event.error,
        }));
        break;
    }
  },

  // ==========================================================================
  // GOAL MANAGEMENT
  // ==========================================================================

  /**
   * Fetch goals from API
   */
  async fetchGoals(statusFilter?: GoalStatus[]): Promise<Goal[]> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const params = statusFilter ? `?status=${statusFilter.join(',')}` : '';
      const response = await fetchApi(`/api/agent/goals${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch goals: ${response.status}`);
      }

      const data = await response.json();
      const goals = data.goals as Goal[];

      store.update((s) => ({ ...s, goals, isLoading: false }));
      return goals;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch goals';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      throw error;
    }
  },

  /**
   * Create a new goal
   */
  async createGoal(goal: {
    description: string;
    priority?: GoalPriority;
    triggerType?: TriggerType;
    scheduledAt?: string;
    cronExpression?: string;
    workspaceRoot?: string;
    tags?: string[];
  }): Promise<Goal> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi('/api/agent/goals', {
        method: 'POST',
        body: JSON.stringify(goal),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create goal: ${response.status}`);
      }

      const data = await response.json();
      const newGoal = data.goal as Goal;

      store.update((s) => ({
        ...s,
        goals: [...s.goals, newGoal],
        isLoading: false,
      }));

      return newGoal;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create goal';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      throw error;
    }
  },

  /**
   * Cancel a goal
   */
  async cancelGoal(goalId: string): Promise<Goal> {
    try {
      const response = await fetchApi(`/api/agent/goals/${goalId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel goal: ${response.status}`);
      }

      const data = await response.json();
      const goal = data.goal as Goal;

      store.update((s) => ({
        ...s,
        goals: s.goals.map((g) => (g.id === goalId ? goal : g)),
      }));

      return goal;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel goal';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  /**
   * Retry a failed goal
   */
  async retryGoal(goalId: string): Promise<Goal> {
    try {
      const response = await fetchApi(`/api/agent/goals/${goalId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to retry goal: ${response.status}`);
      }

      const data = await response.json();
      const goal = data.goal as Goal;

      store.update((s) => ({
        ...s,
        goals: s.goals.map((g) => (g.id === goalId ? goal : g)),
      }));

      return goal;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retry goal';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  // ==========================================================================
  // QUEUE MANAGEMENT
  // ==========================================================================

  /**
   * Fetch queue stats
   */
  async fetchQueueStats(): Promise<QueueStats> {
    try {
      const response = await fetchApi('/api/agent/queue/stats');

      if (!response.ok) {
        throw new Error(`Failed to fetch queue stats: ${response.status}`);
      }

      const stats = (await response.json()) as QueueStats;
      store.update((s) => ({ ...s, queueStats: stats }));
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch queue stats';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  /**
   * Start queue processing
   */
  async startQueue(): Promise<void> {
    try {
      const response = await fetchApi('/api/agent/queue/start', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to start queue: ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start queue';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  /**
   * Stop queue processing
   */
  async stopQueue(): Promise<void> {
    try {
      const response = await fetchApi('/api/agent/queue/stop', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to stop queue: ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop queue';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  // ==========================================================================
  // KILL SWITCH / CONTROL
  // ==========================================================================

  /**
   * Emergency stop all operations
   */
  async emergencyStop(reason?: string): Promise<void> {
    try {
      const response = await fetchApi('/api/agent/control/stop', {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger emergency stop: ${response.status}`);
      }

      store.update((s) => ({
        ...s,
        globalStopInfo: {
          active: true,
          reason: reason || 'user_requested',
          stoppedAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to trigger emergency stop';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  /**
   * Stop a specific goal
   */
  async stopGoal(goalId: string, reason?: string): Promise<void> {
    try {
      const response = await fetchApi(`/api/agent/control/stop/goal/${goalId}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stop goal: ${response.status}`);
      }

      store.update((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === goalId ? { ...g, status: 'cancelled' as GoalStatus } : g
        ),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop goal';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  /**
   * Resume operations after a stop
   */
  async resumeOperations(): Promise<void> {
    try {
      const response = await fetchApi('/api/agent/control/resume', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to resume operations: ${response.status}`);
      }

      store.update((s) => ({
        ...s,
        globalStopInfo: { active: false },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resume operations';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  /**
   * Fetch control status
   */
  async fetchControlStatus(): Promise<void> {
    try {
      const response = await fetchApi('/api/agent/control/status');

      if (!response.ok) {
        throw new Error(`Failed to fetch control status: ${response.status}`);
      }

      const data = await response.json();
      store.update((s) => ({
        ...s,
        globalStopInfo: data.globalStop,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch control status';
      store.update((s) => ({ ...s, error: message }));
      throw error;
    }
  },

  // ==========================================================================
  // STATUS
  // ==========================================================================

  /**
   * Fetch comprehensive Agent status
   */
  async fetchStatus(sessionId?: string): Promise<agentStatus> {
    store.update((s) => ({ ...s, isLoading: true }));

    try {
      const params = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      const response = await fetchApi(`/api/agent/status${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const status = (await response.json()) as agentStatus;

      store.update((s) => ({
        ...s,
        status,
        queueStats: status.queue,
        globalStopInfo: status.control,
        isLoading: false,
      }));

      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch status';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      throw error;
    }
  },

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Clear error
   */
  clearError(): void {
    store.update((s) => ({ ...s, error: null }));
  },

  /**
   * Reset store to initial state
   */
  reset(): void {
    this.disconnect();
    store.set(initialState);
  },

  /**
   * Get current state
   */
  getState(): agentStoreState {
    return get(store);
  },
};

export default agentStore;

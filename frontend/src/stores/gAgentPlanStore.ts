/**
 * Agent Plan Store
 * Manages execution plans and their state, including SSE-based real-time execution
 */

import { writable, derived, get } from 'svelte/store';
import { fetchApi, getApiBase } from '../lib/api.js';

// Types matching Rust planner output
export type RiskLevel = 'safe' | 'moderate' | 'risky';
export type PlanStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type TaskStatus =
  | 'pending'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

// SSE Event Types (from backend)
export type TaskExecutionEvent =
  | { type: 'plan_started'; planId: string; goal: string; taskCount: number }
  | { type: 'batch_started'; batchIndex: number; batchSize: number; taskIds: string[] }
  | { type: 'task_started'; taskId: string; description: string; tools: string[] }
  | { type: 'task_progress'; taskId: string; percent: number; message: string }
  | { type: 'task_tool_call'; taskId: string; toolName: string; toolInput: Record<string, unknown> }
  | { type: 'task_tool_result'; taskId: string; toolName: string; success: boolean; output: string }
  | { type: 'task_completed'; taskId: string; output: string; durationMs: number }
  | { type: 'task_failed'; taskId: string; error: string; durationMs: number }
  | { type: 'task_skipped'; taskId: string; reason: string }
  | { type: 'batch_completed'; batchIndex: number; completedCount: number; failedCount: number }
  | {
    type: 'plan_completed';
    planId: string;
    status: 'completed' | 'failed' | 'cancelled';
    durationMs: number;
  }
  | { type: 'error'; message: string; planId?: string; taskId?: string }
  | { type: 'done' };

export interface Task {
  id: string;
  description: string;
  feature: string;
  action: string;
  tools: string[];
  risk: RiskLevel;
  depends_on: string[];
  blocks: string[];
  estimated_seconds: number;
  priority: number;
  parallelizable: boolean;
  // Runtime state
  status?: TaskStatus;
  started_at?: string;
  completed_at?: string;
  output?: string;
  error?: string;
}

export interface PlanRiskAssessment {
  level: RiskLevel;
  safe_count: number;
  moderate_count: number;
  risky_count: number;
  risk_factors: string[];
  auto_approvable: boolean;
}

export interface Plan {
  id: string;
  goal: string;
  tasks: Task[];
  execution_order: string[];
  parallel_batches: string[][];
  status: PlanStatus;
  risk: PlanRiskAssessment;
  confidence: number;
  estimated_duration: number;
  project_type: string;
  architecture_pattern: string;
  tech_stack: string[];
  // Runtime state
  started_at?: string;
  completed_at?: string;
  current_batch?: number;
}

// Store state
interface PlanStoreState {
  currentPlan: Plan | null;
  planHistory: Plan[];
  isGenerating: boolean;
  isExecuting: boolean;
  executionAbortController: AbortController | null;
  error: string | null;
}

// Event listeners for forwarding SSE events to UI components
type ExecutionEventListener = (event: TaskExecutionEvent) => void;
let executionEventListeners: ExecutionEventListener[] = [];

const initialState: PlanStoreState = {
  currentPlan: null,
  planHistory: [],
  isGenerating: false,
  isExecuting: false,
  executionAbortController: null,
  error: null,
};

const planStore = writable<PlanStoreState>(initialState);

// Derived stores
export const currentPlan = derived(planStore, ($s) => $s.currentPlan);
export const isGenerating = derived(planStore, ($s) => $s.isGenerating);
export const isExecuting = derived(planStore, ($s) => $s.isExecuting);
export const planError = derived(planStore, ($s) => $s.error);

export const currentTasks = derived(planStore, ($s) => $s.currentPlan?.tasks ?? []);

export const readyTasks = derived(planStore, ($s) => {
  if (!$s.currentPlan) return [];
  const completed = $s.currentPlan.tasks.filter((t) => t.status === 'completed').map((t) => t.id);
  return $s.currentPlan.tasks.filter(
    (t) => t.status === 'pending' && t.depends_on.every((dep) => completed.includes(dep))
  );
});

export const executionProgress = derived(planStore, ($s) => {
  if (!$s.currentPlan) return { completed: 0, total: 0, percent: 0 };
  const total = $s.currentPlan.tasks.length;
  const completed = $s.currentPlan.tasks.filter((t) => t.status === 'completed').length;
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
});

// Actions
export const gAgentPlanStore = {
  subscribe: planStore.subscribe,

  /**
   * Subscribe to execution events (for LiveOutput component)
   */
  onExecutionEvent(listener: ExecutionEventListener): () => void {
    executionEventListeners.push(listener);
    return () => {
      executionEventListeners = executionEventListeners.filter((l) => l !== listener);
    };
  },

  /**
   * Emit an execution event to all listeners
   */
  emitExecutionEvent(event: TaskExecutionEvent): void {
    for (const listener of executionEventListeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Execution event listener error:', e);
      }
    }
  },

  /**
   * Set a new plan (from backend or local generation)
   */
  setPlan(plan: Plan) {
    // Initialize task statuses if not set
    const tasksWithStatus = plan.tasks.map((t) => ({
      ...t,
      status: t.status ?? ('pending' as TaskStatus),
    }));
    planStore.update((s) => ({
      ...s,
      currentPlan: { ...plan, tasks: tasksWithStatus },
      error: null,
    }));
  },

  /**
   * Start plan generation
   */
  startGenerating() {
    planStore.update((s) => ({ ...s, isGenerating: true, error: null }));
  },

  /**
   * Finish plan generation
   */
  finishGenerating(plan?: Plan, error?: string) {
    planStore.update((s) => ({
      ...s,
      isGenerating: false,
      currentPlan: plan ?? s.currentPlan,
      error: error ?? null,
    }));
  },

  /**
   * Approve the current plan for execution
   */
  approvePlan() {
    planStore.update((s) => {
      if (!s.currentPlan) return s;
      const tasks = s.currentPlan.tasks.map((t) => ({
        ...t,
        status: t.depends_on.length === 0 ? ('approved' as TaskStatus) : t.status,
      }));
      return {
        ...s,
        currentPlan: {
          ...s.currentPlan,
          status: 'approved',
          tasks,
        },
      };
    });
  },

  /**
   * Start executing the plan
   */
  startExecution() {
    planStore.update((s) => {
      if (!s.currentPlan) return s;
      return {
        ...s,
        currentPlan: {
          ...s.currentPlan,
          status: 'executing',
          started_at: new Date().toISOString(),
          current_batch: 0,
        },
      };
    });
  },

  /**
   * Update a task's status
   */
  updateTaskStatus(taskId: string, status: TaskStatus, output?: string, error?: string) {
    planStore.update((s) => {
      if (!s.currentPlan) return s;
      const tasks = s.currentPlan.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          status,
          output,
          error,
          started_at: status === 'in_progress' ? new Date().toISOString() : t.started_at,
          completed_at: ['completed', 'failed', 'skipped'].includes(status)
            ? new Date().toISOString()
            : t.completed_at,
        };
      });

      // Check if all tasks complete
      const allComplete = tasks.every((t) =>
        ['completed', 'failed', 'skipped'].includes(t.status ?? 'pending')
      );
      const anyFailed = tasks.some((t) => t.status === 'failed');

      return {
        ...s,
        currentPlan: {
          ...s.currentPlan,
          tasks,
          status: allComplete ? (anyFailed ? 'failed' : 'completed') : s.currentPlan.status,
          completed_at: allComplete ? new Date().toISOString() : s.currentPlan.completed_at,
        },
      };
    });
  },

  /**
   * Mark tasks as ready (after dependencies complete)
   */
  updateReadyTasks() {
    planStore.update((s) => {
      if (!s.currentPlan) return s;
      const completed = s.currentPlan.tasks
        .filter((t) => t.status === 'completed')
        .map((t) => t.id);

      const tasks = s.currentPlan.tasks.map((t) => {
        if (t.status !== 'pending') return t;
        const allDepsComplete = t.depends_on.every((dep) => completed.includes(dep));
        if (allDepsComplete) {
          return { ...t, status: 'approved' as TaskStatus };
        }
        return t;
      });

      return { ...s, currentPlan: { ...s.currentPlan, tasks } };
    });
  },

  /**
   * Cancel the current plan
   */
  cancelPlan() {
    planStore.update((s) => {
      if (!s.currentPlan) return s;
      const tasks = s.currentPlan.tasks.map((t) => ({
        ...t,
        status: ['pending', 'approved', 'in_progress'].includes(t.status ?? 'pending')
          ? ('skipped' as TaskStatus)
          : t.status,
      }));
      return {
        ...s,
        currentPlan: {
          ...s.currentPlan,
          status: 'cancelled',
          tasks,
          completed_at: new Date().toISOString(),
        },
      };
    });
  },

  /**
   * Clear the current plan
   */
  clearPlan() {
    planStore.update((s) => {
      const history = s.currentPlan ? [...s.planHistory, s.currentPlan].slice(-10) : s.planHistory;
      return { ...s, currentPlan: null, planHistory: history };
    });
  },

  /**
   * Get the current plan
   */
  getPlan(): Plan | null {
    return get(planStore).currentPlan;
  },

  /**
   * Generate a new plan from a goal via the Rust Task Engine
   */
  async generatePlan(goal: string): Promise<Plan> {
    this.startGenerating();
    try {
      const response = await fetchApi('/api/plan/generate-rust', {
        method: 'POST',
        body: JSON.stringify({ goal }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Plan generation failed' }));
        throw new Error(error.message || `Plan generation failed (${response.status})`);
      }

      const data = await response.json();
      const plan = data.plan as Plan;

      // Initialize task statuses
      plan.tasks = plan.tasks.map((t) => ({
        ...t,
        status: t.status ?? ('pending' as TaskStatus),
      }));

      this.finishGenerating(plan);
      return plan;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.finishGenerating(undefined, message);
      throw error;
    }
  },

  /**
   * Execute the current plan via SSE streaming
   * Returns an async generator that yields execution events
   */
  async executeCurrentPlan(workspaceRoot?: string): Promise<void> {
    const plan = get(planStore).currentPlan;
    if (!plan) {
      throw new Error('No plan to execute');
    }

    // Start execution
    this.startExecution();

    // Create abort controller for cancellation
    const abortController = new AbortController();
    planStore.update((s) => ({ ...s, executionAbortController: abortController }));

    try {
      // Use fetch with streaming for SSE
      const response = await fetch(`${getApiBase()}/api/plan/execute-rust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ plan, workspaceRoot }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr) as TaskExecutionEvent;
              this.handleExecutionEvent(event);

              if (event.type === 'done') {
                return;
              }
            } catch (_e) {
              console.warn('Failed to parse SSE event:', jsonStr);
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Execution was cancelled
        this.cancelPlan();
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        planStore.update((s) => ({
          ...s,
          isExecuting: false,
          error: message,
          currentPlan: s.currentPlan ? { ...s.currentPlan, status: 'failed' } : null,
        }));
      }
    } finally {
      planStore.update((s) => ({ ...s, isExecuting: false, executionAbortController: null }));
    }
  },

  /**
   * Handle an SSE execution event
   */
  handleExecutionEvent(event: TaskExecutionEvent): void {
    // Forward to all listeners (e.g., GAgentLiveOutput)
    this.emitExecutionEvent(event);

    switch (event.type) {
      case 'plan_started':
        planStore.update((s) => ({
          ...s,
          currentPlan: s.currentPlan
            ? {
              ...s.currentPlan,
              status: 'executing',
              started_at: new Date().toISOString(),
            }
            : null,
        }));
        break;

      case 'batch_started':
        planStore.update((s) => ({
          ...s,
          currentPlan: s.currentPlan
            ? {
              ...s.currentPlan,
              current_batch: event.batchIndex,
            }
            : null,
        }));
        break;

      case 'task_started':
        this.updateTaskStatus(event.taskId, 'in_progress');
        break;

      case 'task_completed':
        this.updateTaskStatus(event.taskId, 'completed', event.output);
        this.updateReadyTasks();
        break;

      case 'task_failed':
        this.updateTaskStatus(event.taskId, 'failed', undefined, event.error);
        break;

      case 'task_skipped':
        this.updateTaskStatus(event.taskId, 'skipped');
        break;

      case 'plan_completed':
        planStore.update((s) => ({
          ...s,
          isExecuting: false,
          currentPlan: s.currentPlan
            ? {
              ...s.currentPlan,
              status: event.status,
              completed_at: new Date().toISOString(),
            }
            : null,
        }));
        break;

      case 'error':
        planStore.update((s) => ({
          ...s,
          error: event.message,
        }));
        break;
    }
  },

  /**
   * Cancel the current execution
   */
  async cancelExecution(): Promise<void> {
    const state = get(planStore);

    // Abort the SSE connection
    if (state.executionAbortController) {
      state.executionAbortController.abort();
    }

    // Also notify backend
    if (state.currentPlan) {
      try {
        await fetchApi(`/api/plan/${state.currentPlan.id}/cancel-execution`, {
          method: 'POST',
        });
      } catch (_e) {
        // Ignore errors - we've already aborted locally
      }
    }

    this.cancelPlan();
  },
};

export default gAgentPlanStore;

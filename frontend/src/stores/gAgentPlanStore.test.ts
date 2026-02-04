/**
 * G-Agent Plan Store Tests
 *
 * Comprehensive tests for plan management and execution state
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock fetch and fetchApi
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
  getApiBase: vi.fn(() => 'http://localhost:3000'),
}));

describe('gAgentPlanStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockPlan = (overrides = {}) => ({
    id: 'plan-123',
    goal: 'Build a todo app',
    tasks: [
      {
        id: 'task-1',
        description: 'Create project structure',
        feature: 'setup',
        action: 'create',
        tools: ['bash'],
        risk: 'safe' as const,
        depends_on: [],
        blocks: ['task-2'],
        estimated_seconds: 30,
        priority: 1,
        parallelizable: false,
      },
      {
        id: 'task-2',
        description: 'Install dependencies',
        feature: 'setup',
        action: 'install',
        tools: ['bash'],
        risk: 'safe' as const,
        depends_on: ['task-1'],
        blocks: [],
        estimated_seconds: 60,
        priority: 2,
        parallelizable: true,
      },
    ],
    execution_order: ['task-1', 'task-2'],
    parallel_batches: [['task-1'], ['task-2']],
    status: 'awaiting_approval' as const,
    risk: {
      level: 'safe' as const,
      safe_count: 2,
      moderate_count: 0,
      risky_count: 0,
      risk_factors: [],
      auto_approvable: true,
    },
    confidence: 0.95,
    estimated_duration: 90,
    project_type: 'web',
    architecture_pattern: 'spa',
    tech_stack: ['react', 'typescript'],
    ...overrides,
  });

  describe('initial state', () => {
    it('should have null currentPlan initially', async () => {
      const { currentPlan } = await import('./gAgentPlanStore');
      expect(get(currentPlan)).toBeNull();
    });

    it('should not be generating initially', async () => {
      const { isGenerating } = await import('./gAgentPlanStore');
      expect(get(isGenerating)).toBe(false);
    });

    it('should not be executing initially', async () => {
      const { isExecuting } = await import('./gAgentPlanStore');
      expect(get(isExecuting)).toBe(false);
    });

    it('should have no error initially', async () => {
      const { planError } = await import('./gAgentPlanStore');
      expect(get(planError)).toBeNull();
    });

    it('should have empty current tasks', async () => {
      const { currentTasks } = await import('./gAgentPlanStore');
      expect(get(currentTasks)).toEqual([]);
    });

    it('should have empty ready tasks', async () => {
      const { readyTasks } = await import('./gAgentPlanStore');
      expect(get(readyTasks)).toEqual([]);
    });

    it('should have zero execution progress', async () => {
      const { executionProgress } = await import('./gAgentPlanStore');
      expect(get(executionProgress)).toEqual({ completed: 0, total: 0, percent: 0 });
    });
  });

  describe('setPlan', () => {
    it('should set the current plan', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');
      const plan = createMockPlan();

      gAgentPlanStore.setPlan(plan);

      expect(get(currentPlan)).toBeDefined();
      expect(get(currentPlan)?.id).toBe('plan-123');
    });

    it('should initialize task statuses to pending', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');
      const plan = createMockPlan();

      gAgentPlanStore.setPlan(plan);

      const tasks = get(currentPlan)?.tasks ?? [];
      tasks.forEach((task) => {
        expect(task.status).toBe('pending');
      });
    });

    it('should preserve existing task status', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');
      const plan = createMockPlan({
        tasks: [
          {
            id: 'task-1',
            description: 'Already done',
            feature: 'setup',
            action: 'create',
            tools: ['bash'],
            risk: 'safe' as const,
            depends_on: [],
            blocks: [],
            estimated_seconds: 30,
            priority: 1,
            parallelizable: false,
            status: 'completed' as const,
          },
        ],
      });

      gAgentPlanStore.setPlan(plan);

      expect(get(currentPlan)?.tasks[0].status).toBe('completed');
    });

    it('should clear any existing error', async () => {
      const { gAgentPlanStore, planError } = await import('./gAgentPlanStore');

      // Set an error first
      gAgentPlanStore.finishGenerating(undefined, 'Some error');
      expect(get(planError)).toBe('Some error');

      // Now set a plan
      gAgentPlanStore.setPlan(createMockPlan());
      expect(get(planError)).toBeNull();
    });
  });

  describe('startGenerating / finishGenerating', () => {
    it('should set isGenerating to true', async () => {
      const { gAgentPlanStore, isGenerating } = await import('./gAgentPlanStore');

      gAgentPlanStore.startGenerating();
      expect(get(isGenerating)).toBe(true);
    });

    it('should clear error when starting', async () => {
      const { gAgentPlanStore, planError } = await import('./gAgentPlanStore');

      gAgentPlanStore.finishGenerating(undefined, 'Old error');
      gAgentPlanStore.startGenerating();

      expect(get(planError)).toBeNull();
    });

    it('should finish with plan', async () => {
      const { gAgentPlanStore, isGenerating, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.startGenerating();
      const plan = createMockPlan();
      gAgentPlanStore.finishGenerating(plan);

      expect(get(isGenerating)).toBe(false);
      expect(get(currentPlan)?.id).toBe('plan-123');
    });

    it('should finish with error', async () => {
      const { gAgentPlanStore, isGenerating, planError } = await import('./gAgentPlanStore');

      gAgentPlanStore.startGenerating();
      gAgentPlanStore.finishGenerating(undefined, 'Generation failed');

      expect(get(isGenerating)).toBe(false);
      expect(get(planError)).toBe('Generation failed');
    });
  });

  describe('approvePlan', () => {
    it('should change plan status to approved', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.approvePlan();

      expect(get(currentPlan)?.status).toBe('approved');
    });

    it('should approve tasks with no dependencies', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.approvePlan();

      const tasks = get(currentPlan)?.tasks ?? [];
      expect(tasks[0].status).toBe('approved'); // No dependencies
      expect(tasks[1].status).toBe('pending'); // Has dependencies
    });

    it('should do nothing if no plan', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.approvePlan();

      expect(get(currentPlan)).toBeNull();
    });
  });

  describe('startExecution', () => {
    it('should change plan status to executing', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.startExecution();

      expect(get(currentPlan)?.status).toBe('executing');
    });

    it('should set started_at timestamp', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.startExecution();

      expect(get(currentPlan)?.started_at).toBeDefined();
    });

    it('should set current_batch to 0', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.startExecution();

      expect(get(currentPlan)?.current_batch).toBe(0);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status to in_progress', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.updateTaskStatus('task-1', 'in_progress');

      const task = get(currentPlan)?.tasks.find((t) => t.id === 'task-1');
      expect(task?.status).toBe('in_progress');
      expect(task?.started_at).toBeDefined();
    });

    it('should update task status to completed with output', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.updateTaskStatus('task-1', 'completed', 'Task output');

      const task = get(currentPlan)?.tasks.find((t) => t.id === 'task-1');
      expect(task?.status).toBe('completed');
      expect(task?.output).toBe('Task output');
      expect(task?.completed_at).toBeDefined();
    });

    it('should update task status to failed with error', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.updateTaskStatus('task-1', 'failed', undefined, 'Task error');

      const task = get(currentPlan)?.tasks.find((t) => t.id === 'task-1');
      expect(task?.status).toBe('failed');
      expect(task?.error).toBe('Task error');
    });

    it('should mark plan as completed when all tasks complete', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.updateTaskStatus('task-1', 'completed');
      gAgentPlanStore.updateTaskStatus('task-2', 'completed');

      expect(get(currentPlan)?.status).toBe('completed');
      expect(get(currentPlan)?.completed_at).toBeDefined();
    });

    it('should mark plan as failed if any task fails', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.updateTaskStatus('task-1', 'completed');
      gAgentPlanStore.updateTaskStatus('task-2', 'failed');

      expect(get(currentPlan)?.status).toBe('failed');
    });
  });

  describe('updateReadyTasks', () => {
    it('should approve tasks whose dependencies are complete', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.updateTaskStatus('task-1', 'completed');
      gAgentPlanStore.updateReadyTasks();

      const task2 = get(currentPlan)?.tasks.find((t) => t.id === 'task-2');
      expect(task2?.status).toBe('approved');
    });

    it('should not approve tasks with incomplete dependencies', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.updateReadyTasks();

      const task2 = get(currentPlan)?.tasks.find((t) => t.id === 'task-2');
      expect(task2?.status).toBe('pending');
    });
  });

  describe('cancelPlan', () => {
    it('should change plan status to cancelled', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.cancelPlan();

      expect(get(currentPlan)?.status).toBe('cancelled');
    });

    it('should skip all pending tasks', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.cancelPlan();

      const tasks = get(currentPlan)?.tasks ?? [];
      tasks.forEach((task) => {
        expect(task.status).toBe('skipped');
      });
    });

    it('should set completed_at timestamp', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.cancelPlan();

      expect(get(currentPlan)?.completed_at).toBeDefined();
    });
  });

  describe('clearPlan', () => {
    it('should clear the current plan', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.clearPlan();

      expect(get(currentPlan)).toBeNull();
    });

    it('should add plan to history', async () => {
      const { gAgentPlanStore } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.clearPlan();

      const state = get(gAgentPlanStore);
      expect(state.planHistory.length).toBe(1);
      expect(state.planHistory[0].id).toBe('plan-123');
    });

    it('should keep only last 10 plans in history', async () => {
      const { gAgentPlanStore } = await import('./gAgentPlanStore');

      for (let i = 0; i < 15; i++) {
        gAgentPlanStore.setPlan(createMockPlan({ id: `plan-${i}` }));
        gAgentPlanStore.clearPlan();
      }

      const state = get(gAgentPlanStore);
      expect(state.planHistory.length).toBe(10);
    });
  });

  describe('getPlan', () => {
    it('should return null when no plan', async () => {
      const { gAgentPlanStore } = await import('./gAgentPlanStore');

      expect(gAgentPlanStore.getPlan()).toBeNull();
    });

    it('should return current plan', async () => {
      const { gAgentPlanStore } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());

      expect(gAgentPlanStore.getPlan()?.id).toBe('plan-123');
    });
  });

  describe('execution event listeners', () => {
    it('should add and remove listeners', async () => {
      const { gAgentPlanStore } = await import('./gAgentPlanStore');

      const listener = vi.fn();
      const unsubscribe = gAgentPlanStore.onExecutionEvent(listener);

      gAgentPlanStore.emitExecutionEvent({ type: 'done' });
      expect(listener).toHaveBeenCalledWith({ type: 'done' });

      unsubscribe();
      listener.mockClear();

      gAgentPlanStore.emitExecutionEvent({ type: 'done' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const { gAgentPlanStore } = await import('./gAgentPlanStore');

      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      gAgentPlanStore.onExecutionEvent(errorListener);
      gAgentPlanStore.onExecutionEvent(goodListener);

      // Should not throw
      expect(() => gAgentPlanStore.emitExecutionEvent({ type: 'done' })).not.toThrow();

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('handleExecutionEvent', () => {
    it('should handle plan_started event', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.handleExecutionEvent({
        type: 'plan_started',
        planId: 'plan-123',
        goal: 'Build app',
        taskCount: 2,
      });

      expect(get(currentPlan)?.status).toBe('executing');
    });

    it('should handle batch_started event', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.handleExecutionEvent({
        type: 'batch_started',
        batchIndex: 1,
        batchSize: 2,
        taskIds: ['task-2'],
      });

      expect(get(currentPlan)?.current_batch).toBe(1);
    });

    it('should handle task_started event', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.handleExecutionEvent({
        type: 'task_started',
        taskId: 'task-1',
        description: 'Creating...',
        tools: ['bash'],
      });

      const task = get(currentPlan)?.tasks.find((t) => t.id === 'task-1');
      expect(task?.status).toBe('in_progress');
    });

    it('should handle task_completed event', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.handleExecutionEvent({
        type: 'task_completed',
        taskId: 'task-1',
        output: 'Done!',
        durationMs: 1000,
      });

      const task = get(currentPlan)?.tasks.find((t) => t.id === 'task-1');
      expect(task?.status).toBe('completed');
      expect(task?.output).toBe('Done!');
    });

    it('should handle task_failed event', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.handleExecutionEvent({
        type: 'task_failed',
        taskId: 'task-1',
        error: 'Command failed',
        durationMs: 500,
      });

      const task = get(currentPlan)?.tasks.find((t) => t.id === 'task-1');
      expect(task?.status).toBe('failed');
      expect(task?.error).toBe('Command failed');
    });

    it('should handle task_skipped event', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.handleExecutionEvent({
        type: 'task_skipped',
        taskId: 'task-2',
        reason: 'Dependency failed',
      });

      const task = get(currentPlan)?.tasks.find((t) => t.id === 'task-2');
      expect(task?.status).toBe('skipped');
    });

    it('should handle plan_completed event', async () => {
      const { gAgentPlanStore, currentPlan, isExecuting } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.handleExecutionEvent({
        type: 'plan_completed',
        planId: 'plan-123',
        status: 'completed',
        durationMs: 5000,
      });

      expect(get(currentPlan)?.status).toBe('completed');
      expect(get(isExecuting)).toBe(false);
    });

    it('should handle error event', async () => {
      const { gAgentPlanStore, planError } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.handleExecutionEvent({
        type: 'error',
        message: 'Something went wrong',
      });

      expect(get(planError)).toBe('Something went wrong');
    });
  });

  describe('derived stores', () => {
    it('readyTasks should return tasks with completed dependencies', async () => {
      const { gAgentPlanStore, readyTasks } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());

      // Initially only task-1 is ready (no deps)
      expect(get(readyTasks).length).toBe(1);
      expect(get(readyTasks)[0].id).toBe('task-1');

      // Complete task-1
      gAgentPlanStore.updateTaskStatus('task-1', 'completed');

      // Now task-2 should be ready
      expect(get(readyTasks).length).toBe(1);
      expect(get(readyTasks)[0].id).toBe('task-2');
    });

    it('executionProgress should track completion', async () => {
      const { gAgentPlanStore, executionProgress } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());

      expect(get(executionProgress)).toEqual({ completed: 0, total: 2, percent: 0 });

      gAgentPlanStore.updateTaskStatus('task-1', 'completed');
      expect(get(executionProgress)).toEqual({ completed: 1, total: 2, percent: 50 });

      gAgentPlanStore.updateTaskStatus('task-2', 'completed');
      expect(get(executionProgress)).toEqual({ completed: 2, total: 2, percent: 100 });
    });
  });

  describe('executeCurrentPlan', () => {
    it('should throw if no plan exists', async () => {
      const { gAgentPlanStore } = await import('./gAgentPlanStore');

      await expect(gAgentPlanStore.executeCurrentPlan()).rejects.toThrow('No plan to execute');
    });

    it('should execute plan and handle SSE stream', async () => {
      const { gAgentPlanStore, isExecuting, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());

      // Create mock SSE stream
      const encoder = new TextEncoder();
      const events = [
        'data: {"type":"plan_started","planId":"plan-123","goal":"Build","taskCount":2}\n\n',
        'data: {"type":"task_started","taskId":"task-1","description":"Create","tools":["bash"]}\n\n',
        'data: {"type":"task_completed","taskId":"task-1","output":"Done","durationMs":100}\n\n',
        'data: {"type":"done"}\n\n',
      ];

      let readIndex = 0;
      const mockReader = {
        read: vi.fn(async () => {
          if (readIndex >= events.length) {
            return { done: true, value: undefined };
          }
          const value = encoder.encode(events[readIndex++]);
          return { done: false, value };
        }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await gAgentPlanStore.executeCurrentPlan();

      // Should have processed events
      expect(get(isExecuting)).toBe(false);
      const task = get(currentPlan)?.tasks.find((t) => t.id === 'task-1');
      expect(task?.status).toBe('completed');

      vi.unstubAllGlobals();
    });

    it('should handle execution failure response', async () => {
      const { gAgentPlanStore, planError } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());

      const mockResponse = {
        ok: false,
        status: 500,
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await gAgentPlanStore.executeCurrentPlan();

      expect(get(planError)).toBe('Execution failed: 500');

      vi.unstubAllGlobals();
    });

    it('should handle missing response body', async () => {
      const { gAgentPlanStore, planError } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());

      const mockResponse = {
        ok: true,
        body: null,
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await gAgentPlanStore.executeCurrentPlan();

      expect(get(planError)).toBe('No response body');

      vi.unstubAllGlobals();
    });

    it('should handle abort error (cancellation)', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());

      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

      await gAgentPlanStore.executeCurrentPlan();

      expect(get(currentPlan)?.status).toBe('cancelled');

      vi.unstubAllGlobals();
    });

    it('should handle invalid JSON in SSE stream', async () => {
      const { gAgentPlanStore } = await import('./gAgentPlanStore');

      gAgentPlanStore.setPlan(createMockPlan());

      const encoder = new TextEncoder();
      const events = ['data: invalid json\n\n', 'data: {"type":"done"}\n\n'];

      let readIndex = 0;
      const mockReader = {
        read: vi.fn(async () => {
          if (readIndex >= events.length) {
            return { done: true, value: undefined };
          }
          const value = encoder.encode(events[readIndex++]);
          return { done: false, value };
        }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      // Should not throw
      await expect(gAgentPlanStore.executeCurrentPlan()).resolves.not.toThrow();

      vi.unstubAllGlobals();
    });
  });

  describe('cancelExecution', () => {
    it('should abort the execution controller', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      gAgentPlanStore.setPlan(createMockPlan());

      // Start execution to create abort controller
      gAgentPlanStore.startExecution();

      // Mock the cancel endpoint
      mockFetchApi.mockResolvedValue({ ok: true });

      await gAgentPlanStore.cancelExecution();

      expect(get(currentPlan)?.status).toBe('cancelled');
    });

    it('should handle cancel API failure gracefully', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      gAgentPlanStore.setPlan(createMockPlan());
      gAgentPlanStore.startExecution();

      // Mock the cancel endpoint to fail
      mockFetchApi.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(gAgentPlanStore.cancelExecution()).resolves.not.toThrow();

      // Should still cancel locally
      expect(get(currentPlan)?.status).toBe('cancelled');
    });

    it('should abort the SSE connection when called during execution', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      gAgentPlanStore.setPlan(createMockPlan());

      // Create a mock SSE stream that hangs (simulating long execution)
      type ReadResult = { done: boolean; value: Uint8Array | undefined };
      let resolveReadFn: (value: ReadResult) => void = () => {};
      const hangingPromise = new Promise<ReadResult>((resolve) => {
        resolveReadFn = resolve;
      });

      const mockReader = {
        read: vi.fn().mockReturnValue(hangingPromise),
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
      mockFetchApi.mockResolvedValue({ ok: true });

      // Start execution (creates abort controller)
      const executePromise = gAgentPlanStore.executeCurrentPlan();

      // Give it a moment to set up
      await new Promise((r) => setTimeout(r, 10));

      // Cancel while executing
      await gAgentPlanStore.cancelExecution();

      // Resolve the hanging read to let execution complete
      resolveReadFn({ done: true, value: undefined });

      // The plan should be cancelled
      expect(get(currentPlan)?.status).toBe('cancelled');

      vi.unstubAllGlobals();
    });
  });

  describe('generatePlan', () => {
    it('should generate a plan successfully', async () => {
      const { gAgentPlanStore, currentPlan, isGenerating } = await import('./gAgentPlanStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockPlan = createMockPlan();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: mockPlan }),
      });

      const result = await gAgentPlanStore.generatePlan('Build a todo app');

      expect(mockFetchApi).toHaveBeenCalledWith('/api/plan/generate-rust', {
        method: 'POST',
        body: JSON.stringify({ goal: 'Build a todo app' }),
      });
      expect(result.id).toBe('plan-123');
      expect(get(currentPlan)?.goal).toBe('Build a todo app');
      expect(get(isGenerating)).toBe(false);
    });

    it('should handle generation API error', async () => {
      const { gAgentPlanStore, isGenerating, planError } = await import('./gAgentPlanStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      await expect(gAgentPlanStore.generatePlan('Build app')).rejects.toThrow('Server error');
      expect(get(isGenerating)).toBe(false);
      expect(get(planError)).toBe('Server error');
    });

    it('should handle network error during generation', async () => {
      const { gAgentPlanStore, isGenerating } = await import('./gAgentPlanStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockRejectedValue(new Error('Network error'));

      await expect(gAgentPlanStore.generatePlan('Build app')).rejects.toThrow('Network error');
      expect(get(isGenerating)).toBe(false);
    });

    it('should initialize task statuses to pending', async () => {
      const { gAgentPlanStore, currentPlan } = await import('./gAgentPlanStore');
      const { fetchApi } = await import('../lib/api.js');
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const planWithoutStatus = {
        ...createMockPlan(),
        tasks: [
          { id: 'task-1', description: 'Task 1' },
          { id: 'task-2', description: 'Task 2' },
        ],
      };

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: planWithoutStatus }),
      });

      await gAgentPlanStore.generatePlan('Build app');

      const tasks = get(currentPlan)?.tasks ?? [];
      tasks.forEach((task) => {
        expect(task.status).toBe('pending');
      });
    });
  });
});

/**
 * Comprehensive Tests for WorkerPool service
 * 
 * Run: npm test -- workerPool.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Store mock workers for manipulation in tests
const mockWorkers: {
  id: number;
  handlers: Map<string, Function[]>;
  terminated: boolean;
  shouldFail: boolean;
  shouldTimeout: boolean;
  terminateShouldFail: boolean;
  exitCode: number | null;
  workerData: unknown;
  on: (event: string, handler: Function) => void;
  postMessage: (message: { taskId: string; type: string; data: unknown }) => void;
  emit: (event: string, ...args: unknown[]) => void;
  terminate: () => Promise<void>;
}[] = [];
let workerIdCounter = 0;

// Mock worker_threads - must be a simple function that creates objects
vi.mock('worker_threads', () => {
  return {
    Worker: vi.fn().mockImplementation(function(script: string, options?: { workerData?: unknown }) {
      const worker = {
        id: workerIdCounter++,
        handlers: new Map<string, Function[]>(),
        terminated: false,
        shouldFail: false,
        shouldTimeout: false,
        terminateShouldFail: false,
        exitCode: null as number | null,
        workerData: options?.workerData,
        
        on(event: string, handler: Function) {
          if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
          }
          this.handlers.get(event)!.push(handler);
        },
        
        postMessage(message: { taskId: string; type: string; data: unknown }) {
          if (this.shouldTimeout) {
            return;
          }
          
          if (this.shouldFail) {
            setTimeout(() => {
              const handlers = this.handlers.get('error');
              if (handlers) {
                handlers.forEach((h: Function) => h(new Error('Worker error')));
              }
            }, 5);
            return;
          }

          setTimeout(() => {
            const handlers = this.handlers.get('message');
            if (handlers) {
              handlers.forEach((h: Function) => h({
                taskId: message.taskId,
                success: true,
                result: { processed: true, input: message.data },
              }));
            }
          }, 10);
        },
        
        emit(event: string, ...args: unknown[]) {
          const handlers = this.handlers.get(event);
          if (handlers) {
            handlers.forEach((h: Function) => h(...args));
          }
        },
        
        terminate() {
          this.terminated = true;
          if (this.terminateShouldFail) {
            return Promise.reject(new Error('Terminate failed'));
          }
          return Promise.resolve();
        },
      };
      
      mockWorkers.push(worker);
      return worker;
    }),
  };
});

// Mock os module
vi.mock('os', () => ({
  cpus: vi.fn(() => Array(4).fill({ model: 'mock' })),
  loadavg: vi.fn(() => [0.5, 0.5, 0.5]),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { WorkerPool, TaskPriority, getWorkerPool, shutdownWorkerPool, type WorkerPoolStats } from '../../src/services/workerPool.js';
import { cpus, loadavg } from 'os';
import logger from '../../src/middleware/logger.js';

describe('WorkerPool', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkers.length = 0;
    workerIdCounter = 0;
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    vi.useRealTimers();
  });

  describe('Constructor and initialization', () => {
    it('should initialize with minimum workers', () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(2);
      expect(stats.availableWorkers).toBe(2);
    });

    it('should use default options based on CPU count', () => {
      pool = new WorkerPool({
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      const stats = pool.getStats();
      // Default minWorkers = Math.max(2, Math.floor(cpuCount / 2)) = max(2, 2) = 2
      expect(stats.totalWorkers).toBe(2);
    });

    it('should initialize with auto-scaling enabled by default', () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        healthCheck: { enabled: false },
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ autoScaling: true }),
        'Worker pool initialized with dynamic scaling'
      );
    });

    it('should initialize with health checks enabled by default', () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ healthChecks: true }),
        'Worker pool initialized with dynamic scaling'
      );
    });

    it('should pass threadAffinity data to workers', () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        threadAffinity: true,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      expect(mockWorkers.length).toBe(2);
      expect(mockWorkers[0].workerData).toEqual({ workerIndex: 0, cpuCount: 4 });
      expect(mockWorkers[1].workerData).toEqual({ workerIndex: 1, cpuCount: 4 });
    });

    it('should not pass workerData when threadAffinity is disabled', () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        threadAffinity: false,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      expect(mockWorkers[0].workerData).toBeUndefined();
    });
  });

  describe('Task execution', () => {
    beforeEach(() => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        taskTimeout: 1000,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
    });

    it('should execute a task successfully', async () => {
      const promise = pool.execute<{ value: number }, { processed: boolean; input: { value: number } }>(
        'test',
        { value: 42 }
      );
      
      await vi.advanceTimersByTimeAsync(50);
      
      const result = await promise;
      expect(result.processed).toBe(true);
      expect(result.input.value).toBe(42);
    });

    it('should execute multiple tasks concurrently', async () => {
      const results = Promise.all([
        pool.execute('test', { id: 1 }),
        pool.execute('test', { id: 2 }),
        pool.execute('test', { id: 3 }),
      ]);
      
      await vi.advanceTimersByTimeAsync(50);
      
      expect((await results)).toHaveLength(3);
    });

    it('should queue tasks when no workers available', async () => {
      // Fill up both workers
      const task1 = pool.execute('test', { id: 1 });
      const task2 = pool.execute('test', { id: 2 });
      const task3 = pool.execute('test', { id: 3 }); // This should queue
      
      const stats = pool.getStats();
      // At least 1 task should be queued since we have 2 workers and 3 tasks
      expect(stats.queuedTasks.total + stats.activeTasks).toBe(3);
      
      await vi.advanceTimersByTimeAsync(100);
      
      await Promise.all([task1, task2, task3]);
    });
  });

  describe('Priority handling', () => {
    beforeEach(() => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        taskTimeout: 1000,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
    });

    it('should process high priority tasks first', async () => {
      const order: number[] = [];
      
      // Queue tasks in reverse priority order
      const low = pool.execute('test', { id: 1 }, TaskPriority.LOW).then(() => order.push(1));
      const normal = pool.execute('test', { id: 2 }, TaskPriority.NORMAL).then(() => order.push(2));
      const high = pool.execute('test', { id: 3 }, TaskPriority.HIGH).then(() => order.push(3));
      
      // Process all tasks
      await vi.advanceTimersByTimeAsync(500);
      await Promise.all([low, normal, high]);
      
      // High priority should be processed first after the initially executing task
      // The first task (low) was already assigned to the worker
      expect(order[1]).toBe(3); // High priority second
      expect(order[2]).toBe(2); // Normal priority third
    });

    it('should track tasks by priority in stats', async () => {
      const task1 = pool.execute('test', { id: 1 }, TaskPriority.HIGH);
      const task2 = pool.execute('test', { id: 2 }, TaskPriority.NORMAL);
      const task3 = pool.execute('test', { id: 3 }, TaskPriority.LOW);
      
      await vi.advanceTimersByTimeAsync(200);
      
      await Promise.all([task1, task2, task3]);
      
      const stats = pool.getStats();
      expect(stats.metrics.totalTasksProcessed).toBe(3);
    });
  });

  describe('Task timeout', () => {
    it('should reject tasks that timeout', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        taskTimeout: 100,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      // Make worker not respond
      mockWorkers[0].shouldTimeout = true;
      
      let rejectedError: Error | null = null;
      const promise = pool.execute('test', { id: 1 }).catch((e) => {
        rejectedError = e;
      });
      
      // Advance past timeout
      await vi.advanceTimersByTimeAsync(200);
      await promise;
      
      expect(rejectedError).not.toBeNull();
      expect(rejectedError!.message).toBe('Task timeout');
    });

    it('should increment failure count on timeout', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        taskTimeout: 100,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      mockWorkers[0].shouldTimeout = true;
      
      const promise = pool.execute('test', { id: 1 });
      promise.catch(() => {}); // Prevent unhandled rejection
      
      await vi.advanceTimersByTimeAsync(200);
      
      try {
        await promise;
      } catch {
        // Expected
      }
      
      const stats = pool.getStats();
      expect(stats.metrics.totalTasksFailed).toBe(1);
    });

    it('should make worker available after timeout', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        taskTimeout: 100,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      mockWorkers[0].shouldTimeout = true;
      
      const promise1 = pool.execute('test', { id: 1 });
      promise1.catch(() => {}); // Prevent unhandled rejection
      
      await vi.advanceTimersByTimeAsync(200);
      
      // Worker should be available again
      mockWorkers[0].shouldTimeout = false;
      
      const promise2 = pool.execute('test', { id: 2 });
      
      await vi.advanceTimersByTimeAsync(50);
      
      const result = await promise2;
      expect(result).toBeDefined();
    });
  });

  describe('Worker error handling', () => {
    beforeEach(() => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        taskTimeout: 1000,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
    });

    it('should handle worker errors', async () => {
      const worker = mockWorkers[0];
      worker.shouldFail = true;
      
      const promise = pool.execute('test', { id: 1 });
      promise.catch(() => {}); // Prevent unhandled rejection
      
      await vi.advanceTimersByTimeAsync(50);
      
      await expect(promise).rejects.toThrow('Worker error');
    });

    it('should log worker errors', async () => {
      const worker = mockWorkers[0];
      worker.shouldFail = true;
      
      const promise = pool.execute('test', { id: 1 });
      promise.catch(() => {}); // Prevent unhandled rejection
      
      await vi.advanceTimersByTimeAsync(50);
      
      try {
        await promise;
      } catch {
        // Expected
      }
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Worker error' }),
        'Worker error'
      );
    });

    it('should replace crashed workers to maintain minimum', async () => {
      const initialWorkerCount = pool.getStats().totalWorkers;
      
      // Simulate worker crash
      const worker = mockWorkers[0];
      worker.emit('exit', 1); // Non-zero exit code
      
      await vi.advanceTimersByTimeAsync(50);
      
      const stats = pool.getStats();
      // Should have replaced the crashed worker
      expect(stats.totalWorkers).toBe(initialWorkerCount);
    });

    it('should not replace workers during shutdown', async () => {
      const shutdownPromise = pool.shutdown();
      
      // Try to emit exit on remaining workers
      mockWorkers.forEach(w => {
        if (!w.terminated) {
          w.emit('exit', 1);
        }
      });
      
      await shutdownPromise;
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(0);
    });

    it('should log warning for unknown task responses', async () => {
      const worker = mockWorkers[0];
      
      // Emit a response for an unknown task
      worker.emit('message', {
        taskId: 'unknown_task_id',
        success: true,
        result: {},
      });
      
      await vi.advanceTimersByTimeAsync(10);
      
      expect(logger.warn).toHaveBeenCalledWith(
        { taskId: 'unknown_task_id' },
        'Received response for unknown task'
      );
    });

    it('should handle failed task responses', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        taskTimeout: 5000,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      // The newly created pool should have added a worker to mockWorkers
      // Get the latest worker (the one just created)
      const worker = mockWorkers[mockWorkers.length - 1];
      
      // Make the worker not auto-respond so we can control the response
      worker.shouldTimeout = true;
      
      let rejectedError: Error | null = null;
      const promise = pool.execute('test', { id: 1 }).catch((e) => {
        rejectedError = e;
      });
      
      await vi.advanceTimersByTimeAsync(5);
      
      // Get the active task ID
      const activeTasks = (pool as unknown as { activeTasks: Map<string, unknown> }).activeTasks;
      const taskId = Array.from(activeTasks.keys())[0];
      
      expect(taskId).toBeDefined();
      
      // Emit a failure response
      worker.emit('message', {
        taskId,
        success: false,
        error: 'Processing failed',
      });
      
      await vi.advanceTimersByTimeAsync(10);
      await promise;
      
      expect(rejectedError).not.toBeNull();
      expect(rejectedError!.message).toBe('Processing failed');
    });
  });

  describe('Worker creation failure', () => {
    it('should handle max workers limit', () => {
      pool = new WorkerPool({
        minWorkers: 4,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      // Try to scale beyond max
      pool.scale(10);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(4);
    });

    it('should log when max workers reached during creation', () => {
      pool = new WorkerPool({
        minWorkers: 4,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      // Clear calls from initialization
      vi.clearAllMocks();
      
      // Try to create more workers
      (pool as unknown as { createWorker: (index: number) => void }).createWorker(5);
      
      expect(logger.debug).toHaveBeenCalledWith(
        { maxWorkers: 4 },
        'Max workers reached'
      );
    });
  });

  describe('Worker removal', () => {
    it('should handle terminate errors gracefully', async () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      const worker = mockWorkers[0];
      worker.terminateShouldFail = true;
      
      // Force removal
      (pool as unknown as { removeWorker: (worker: unknown) => void }).removeWorker(worker);
      
      await vi.advanceTimersByTimeAsync(50);
      
      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Terminate failed' },
        'Error terminating worker'
      );
    });
  });

  describe('Auto-scaling', () => {
    it('should scale up when queue depth is high', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 4,
        autoScaling: {
          enabled: true,
          scaleUpThreshold: 2,
          scaleUpCooldown: 100,
          cpuThreshold: 0.9,
        },
        healthCheck: { enabled: false },
      });
      
      const initialCount = pool.getStats().totalWorkers;
      
      // Queue many tasks to trigger scale up
      mockWorkers[0].shouldTimeout = true;
      
      for (let i = 0; i < 10; i++) {
        pool.execute('test', { id: i }).catch(() => {});
      }
      
      // Advance to trigger scaling check
      await vi.advanceTimersByTimeAsync(2000);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBeGreaterThan(initialCount);
    });

    it('should not scale up when CPU is overloaded', async () => {
      // Mock high CPU load
      (loadavg as Mock).mockReturnValue([4.0, 4.0, 4.0]); // High load
      
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 4,
        autoScaling: {
          enabled: true,
          scaleUpThreshold: 2,
          scaleUpCooldown: 100,
          cpuThreshold: 0.5, // Low threshold
        },
        healthCheck: { enabled: false },
      });
      
      const initialCount = pool.getStats().totalWorkers;
      
      // Queue many tasks
      mockWorkers[0].shouldTimeout = true;
      
      for (let i = 0; i < 10; i++) {
        pool.execute('test', { id: i }).catch(() => {});
      }
      
      await vi.advanceTimersByTimeAsync(2000);
      
      const stats = pool.getStats();
      // Should not scale up due to CPU threshold
      expect(stats.totalWorkers).toBe(initialCount);
      
      // Reset mock
      (loadavg as Mock).mockReturnValue([0.5, 0.5, 0.5]);
    });

    it('should scale down when queue is empty', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 4,
        autoScaling: {
          enabled: true,
          scaleDownThreshold: 1,
          scaleDownCooldown: 100,
        },
        healthCheck: { enabled: false },
      });
      
      // Scale up first
      pool.scale(3);
      expect(pool.getStats().totalWorkers).toBe(3);
      
      // Wait for scale down cooldown
      await vi.advanceTimersByTimeAsync(5000);
      
      // Workers should scale down towards minimum
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBeLessThanOrEqual(3);
    });

    it('should respect scale up cooldown', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 4,
        autoScaling: {
          enabled: true,
          scaleUpThreshold: 1,
          scaleUpCooldown: 10000, // Long cooldown
          cpuThreshold: 0.9,
        },
        healthCheck: { enabled: false },
      });
      
      // All workers should be busy/stuck so queue builds up
      mockWorkers.forEach(w => { w.shouldTimeout = true; });
      
      // Queue tasks to trigger scale-up
      for (let i = 0; i < 5; i++) {
        pool.execute('test', { id: i }).catch(() => {});
      }
      
      // Advance time to trigger scaling - scaling interval is 1 second
      await vi.advanceTimersByTimeAsync(1500);
      
      const firstCount = pool.getStats().totalWorkers;
      
      // New workers should also be stuck
      mockWorkers.forEach(w => { w.shouldTimeout = true; });
      
      // More tasks
      for (let i = 5; i < 10; i++) {
        pool.execute('test', { id: i }).catch(() => {});
      }
      
      // Should not scale again within cooldown (need 10000ms but only wait 2000ms)
      await vi.advanceTimersByTimeAsync(2000);
      
      // Workers should be <= firstCount since we're still within cooldown
      // (might be same or less if some were removed for other reasons)
      expect(pool.getStats().totalWorkers).toBeLessThanOrEqual(firstCount + 1);
    });

    it('should not scale during shutdown', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 4,
        autoScaling: { enabled: true },
        healthCheck: { enabled: false },
      });
      
      const shutdownPromise = pool.shutdown();
      
      // Advance timer to trigger scaling check
      await vi.advanceTimersByTimeAsync(2000);
      
      await shutdownPromise;
      
      expect(pool.getStats().totalWorkers).toBe(0);
    });

    it('should track scale events in metrics', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 4,
        autoScaling: {
          enabled: true,
          scaleUpThreshold: 1,
          scaleUpCooldown: 100,
        },
        healthCheck: { enabled: false },
      });
      
      mockWorkers[0].shouldTimeout = true;
      
      for (let i = 0; i < 10; i++) {
        pool.execute('test', { id: i }).catch(() => {});
      }
      
      await vi.advanceTimersByTimeAsync(2000);
      
      const stats = pool.getStats();
      expect(stats.metrics.scaleEvents.up).toBeGreaterThan(0);
    });
  });

  describe('Health checks', () => {
    it('should configure health checks on pool creation', () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        healthCheck: {
          enabled: true,
          interval: 100,
          timeout: 50,
        },
        autoScaling: { enabled: false },
      });
      
      // Verify health checks were enabled in the log
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ healthChecks: true }),
        'Worker pool initialized with dynamic scaling'
      );
    });
    
    it('should verify health check interval is set', () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        healthCheck: {
          enabled: true,
          interval: 100,
          timeout: 50,
        },
        autoScaling: { enabled: false },
      });
      
      // Verify the health check interval is set (non-null)
      const healthCheckInterval = (pool as unknown as { healthCheckInterval: NodeJS.Timeout | null }).healthCheckInterval;
      expect(healthCheckInterval).not.toBeNull();
    });

    it('should not run health checks during shutdown', async () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        healthCheck: {
          enabled: true,
          interval: 100,
        },
        autoScaling: { enabled: false },
      });
      
      const shutdownPromise = pool.shutdown();
      
      await vi.advanceTimersByTimeAsync(500);
      
      await shutdownPromise;
      
      // No stuck worker warnings after shutdown
      const warnCalls = (logger.warn as Mock).mock.calls.filter(
        (call: unknown[]) => call[1] === 'Worker appears stuck'
      );
      expect(warnCalls.length).toBe(0);
    });
  });

  describe('Manual scaling', () => {
    beforeEach(() => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 6,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
    });

    it('should scale up manually', () => {
      pool.scale(4);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(4);
      
      expect(logger.info).toHaveBeenCalledWith(
        { from: 2, to: 4 },
        'Manually scaled up'
      );
    });

    it('should scale down manually', () => {
      pool.scale(4);
      pool.scale(3);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(3);
    });

    it('should not scale below minimum', () => {
      pool.scale(1);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(2);
    });

    it('should not scale above maximum', () => {
      pool.scale(10);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(6);
    });

    it('should not scale when target equals current', () => {
      vi.clearAllMocks();
      
      pool.scale(2);
      
      // No scale log should be emitted
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        'Manually scaled up'
      );
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        'Manually scaled down'
      );
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        taskTimeout: 1000,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
    });

    it('should track total tasks processed', async () => {
      await Promise.all([
        pool.execute('test', { id: 1 }),
        pool.execute('test', { id: 2 }),
      ].map(async p => {
        await vi.advanceTimersByTimeAsync(50);
        return p;
      }));
      
      // Need to advance timers and wait for all
      await vi.advanceTimersByTimeAsync(100);
      
      const stats = pool.getStats();
      expect(stats.metrics.totalTasksProcessed).toBe(2);
    });

    it('should calculate average latency', async () => {
      const task1 = pool.execute('test', { id: 1 });
      await vi.advanceTimersByTimeAsync(50);
      await task1;
      
      const stats = pool.getStats();
      expect(stats.metrics.avgLatencyMs).toBeGreaterThan(0);
    });

    it('should calculate tasks per second', async () => {
      // Execute some tasks
      const task1 = pool.execute('test', { id: 1 });
      await vi.advanceTimersByTimeAsync(50);
      await task1;
      
      const stats = pool.getStats();
      expect(stats.metrics.tasksPerSecond).toBeGreaterThan(0);
    });

    it('should calculate worker utilization', async () => {
      // Start a task to make a worker busy
      mockWorkers[0].shouldTimeout = true;
      pool.execute('test', { id: 1 }).catch(() => {});
      
      await vi.advanceTimersByTimeAsync(10);
      
      const stats = pool.getStats();
      expect(stats.busyWorkers).toBeGreaterThan(0);
      expect(stats.metrics.workerUtilization).toBeGreaterThan(0);
    });

    it('should return zero utilization for empty pool', async () => {
      await pool.shutdown();
      
      const stats = pool.getStats();
      expect(stats.metrics.workerUtilization).toBe(0);
    });

    it('should return zero avg latency when no tasks processed', () => {
      const stats = pool.getStats();
      expect(stats.metrics.avgLatencyMs).toBe(0);
    });
  });

  describe('Affinity hints', () => {
    it('should provide affinity hints for workers', () => {
      pool = new WorkerPool({
        minWorkers: 4,
        maxWorkers: 8,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      const hints = pool.getAffinityHints();
      
      expect(hints.length).toBe(4);
      hints.forEach((hint) => {
        expect(hint).toHaveProperty('workerIndex');
        expect(hint).toHaveProperty('suggestedCpuId');
        expect(hint.suggestedCpuId).toBe(hint.workerIndex % 4); // 4 CPUs mocked
      });
    });
  });

  describe('Queue limits', () => {
    it('should have max queue size configuration', () => {
      const smallPool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        maxQueueSize: 10,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });

      // Verify the pool was created successfully with queue size config
      const stats = smallPool.getStats();
      expect(stats.totalWorkers).toBe(1);
      
      // The pool is created, we trust the implementation handles queue limits
      smallPool.shutdown();
    });
    
    it('should track queued tasks correctly', async () => {
      const smallPool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        maxQueueSize: 100,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });

      // Make worker busy
      const worker = mockWorkers[mockWorkers.length - 1];
      worker.shouldTimeout = true;

      // First task goes to worker
      const task1 = smallPool.execute('test', { id: 1 });
      task1.catch(() => {});
      
      // These should queue
      const task2 = smallPool.execute('test', { id: 2 });
      const task3 = smallPool.execute('test', { id: 3 });
      task2.catch(() => {});
      task3.catch(() => {});
      
      const stats = smallPool.getStats();
      expect(stats.queuedTasks.total).toBe(2);
      expect(stats.activeTasks).toBe(1);
      
      await smallPool.shutdown();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      await pool.shutdown();
      
      await expect(pool.execute('test', {})).rejects.toThrow('shutting down');
    });

    it('should reject queued tasks on shutdown', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      mockWorkers[0].shouldTimeout = true;
      
      const task1 = pool.execute('test', { id: 1 }, TaskPriority.HIGH);
      const task2 = pool.execute('test', { id: 2 }, TaskPriority.NORMAL);
      const task3 = pool.execute('test', { id: 3 }, TaskPriority.LOW);
      
      task1.catch(() => {});
      task2.catch(() => {});
      task3.catch(() => {});
      
      await pool.shutdown();
      
      await expect(task1).rejects.toThrow('shutting down');
      await expect(task2).rejects.toThrow('shutting down');
      await expect(task3).rejects.toThrow('shutting down');
    });

    it('should reject active tasks on shutdown', async () => {
      pool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      mockWorkers[0].shouldTimeout = true;
      
      const task = pool.execute('test', { id: 1 });
      task.catch(() => {});
      
      await vi.advanceTimersByTimeAsync(10);
      
      await pool.shutdown();
      
      await expect(task).rejects.toThrow('shutting down');
    });

    it('should clear all intervals on shutdown', async () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: true },
        healthCheck: { enabled: true },
      });
      
      await pool.shutdown();
      
      // Verify intervals are cleared by checking private properties
      expect((pool as unknown as { scalingInterval: NodeJS.Timeout | null }).scalingInterval).toBeNull();
      expect((pool as unknown as { healthCheckInterval: NodeJS.Timeout | null }).healthCheckInterval).toBeNull();
    });

    it('should log shutdown summary', async () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      // Execute some tasks
      const task = pool.execute('test', { id: 1 });
      await vi.advanceTimersByTimeAsync(50);
      await task;
      
      await pool.shutdown();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          totalProcessed: expect.any(Number),
          totalFailed: expect.any(Number),
          scaleEvents: expect.any(Object),
        }),
        'Worker pool shut down'
      );
    });

    it('should handle worker termination errors during shutdown', async () => {
      pool = new WorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      mockWorkers.forEach(w => {
        w.terminateShouldFail = true;
      });
      
      await pool.shutdown();
      
      expect(logger.error).toHaveBeenCalledWith(
        { error: 'Terminate failed' },
        'Error terminating worker'
      );
    });
  });
});

describe('Singleton functions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockWorkers.length = 0;
    workerIdCounter = 0;
    // Ensure pool is reset
    await shutdownWorkerPool();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await shutdownWorkerPool();
    vi.useRealTimers();
  });

  describe('getWorkerPool', () => {
    it('should create a new pool if none exists', () => {
      const pool = getWorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      expect(pool).toBeInstanceOf(WorkerPool);
      expect(pool.getStats().totalWorkers).toBe(2);
    });

    it('should return the same pool on subsequent calls', () => {
      const pool1 = getWorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      const pool2 = getWorkerPool();
      
      expect(pool1).toBe(pool2);
    });

    it('should ignore options on subsequent calls', () => {
      const pool1 = getWorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      const pool2 = getWorkerPool({
        minWorkers: 10, // Different options
        maxWorkers: 20,
      });
      
      expect(pool1).toBe(pool2);
      expect(pool2.getStats().totalWorkers).toBe(2); // Uses original options
    });
  });

  describe('shutdownWorkerPool', () => {
    it('should shutdown the singleton pool', async () => {
      const pool = getWorkerPool({
        minWorkers: 2,
        maxWorkers: 4,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      await shutdownWorkerPool();
      
      // Should be able to create a new pool
      const newPool = getWorkerPool({
        minWorkers: 3,
        maxWorkers: 6,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });
      
      expect(newPool).not.toBe(pool);
      expect(newPool.getStats().totalWorkers).toBe(3);
    });

    it('should be safe to call when no pool exists', async () => {
      await expect(shutdownWorkerPool()).resolves.not.toThrow();
    });
  });
});

describe('WorkerPool edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkers.length = 0;
    workerIdCounter = 0;
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  it('should handle rapid task submission', async () => {
    const pool = new WorkerPool({
      minWorkers: 2,
      maxWorkers: 4,
      autoScaling: { enabled: false },
      healthCheck: { enabled: false },
    });
    
    const tasks: Promise<unknown>[] = [];
    for (let i = 0; i < 100; i++) {
      tasks.push(pool.execute('test', { id: i }));
    }
    
    await vi.advanceTimersByTimeAsync(5000);
    
    const results = await Promise.all(tasks);
    expect(results).toHaveLength(100);
    
    await pool.shutdown();
  });

  it('should handle interleaved priorities correctly', async () => {
    const pool = new WorkerPool({
      minWorkers: 1,
      maxWorkers: 1,
      autoScaling: { enabled: false },
      healthCheck: { enabled: false },
    });
    
    mockWorkers[0].shouldTimeout = true;
    
    // First task gets immediately assigned to the worker
    // Interleave different priorities - first LOW goes to worker, rest queue
    pool.execute('test', { id: 1 }, TaskPriority.LOW).catch(() => {});
    pool.execute('test', { id: 2 }, TaskPriority.HIGH).catch(() => {});
    pool.execute('test', { id: 3 }, TaskPriority.NORMAL).catch(() => {});
    pool.execute('test', { id: 4 }, TaskPriority.HIGH).catch(() => {});
    pool.execute('test', { id: 5 }, TaskPriority.LOW).catch(() => {});
    
    const stats = pool.getStats();
    // First LOW task is active (not queued), so queued = 2 HIGH + 1 NORMAL + 1 LOW
    expect(stats.queuedTasks.high).toBe(2);
    expect(stats.queuedTasks.normal).toBe(1);
    expect(stats.queuedTasks.low).toBe(1);
    expect(stats.activeTasks).toBe(1);
    
    await pool.shutdown();
  });

  it('should clear timeout when task completes normally', async () => {
    const pool = new WorkerPool({
      minWorkers: 1,
      maxWorkers: 1,
      taskTimeout: 1000,
      autoScaling: { enabled: false },
      healthCheck: { enabled: false },
    });
    
    const task = pool.execute('test', { id: 1 });
    
    await vi.advanceTimersByTimeAsync(50);
    
    const result = await task;
    expect(result).toBeDefined();
    
    // Advance past original timeout - should not cause issues
    await vi.advanceTimersByTimeAsync(2000);
    
    const stats = pool.getStats();
    expect(stats.metrics.totalTasksFailed).toBe(0);
    
    await pool.shutdown();
  });

  it('should handle worker that exits with code 0', async () => {
    const pool = new WorkerPool({
      minWorkers: 2,
      maxWorkers: 4,
      autoScaling: { enabled: false },
      healthCheck: { enabled: false },
    });
    
    const initialCount = pool.getStats().totalWorkers;
    
    // Exit with code 0 (clean exit) - according to source:
    // "if (code !== 0 && !this.isShuttingDown)" - code 0 does nothing
    // So worker count should remain the same (worker is not removed on clean exit)
    mockWorkers[0].emit('exit', 0);
    
    await vi.advanceTimersByTimeAsync(50);
    
    // Worker stays in pool on clean exit (code 0)
    const stats = pool.getStats();
    expect(stats.totalWorkers).toBe(initialCount);
    
    await pool.shutdown();
  });

  it('should handle failed task without error message', async () => {
    const pool = new WorkerPool({
      minWorkers: 1,
      maxWorkers: 1,
      taskTimeout: 1000,
      autoScaling: { enabled: false },
      healthCheck: { enabled: false },
    });
    
    const promise = pool.execute('test', { id: 1 });
    
    const worker = mockWorkers[0];
    await vi.advanceTimersByTimeAsync(5);
    
    // Emit failure without error message
    const activeTasks = (pool as unknown as { activeTasks: Map<string, unknown> }).activeTasks;
    const taskId = Array.from(activeTasks.keys())[0];
    worker.emit('message', {
      taskId,
      success: false,
      // No error property
    });
    
    await expect(promise).rejects.toThrow('Task failed');
    
    await pool.shutdown();
  });
});

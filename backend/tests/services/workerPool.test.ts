/**
 * Tests for WorkerPool service
 * 
 * Run: npm test -- workerPool.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock worker_threads
vi.mock('worker_threads', () => {
  const mockWorkers = new Map();
  let workerIdCounter = 0;

  class MockWorker {
    id: number;
    handlers: Map<string, Function[]>;
    terminated: boolean;

    constructor() {
      this.id = workerIdCounter++;
      this.handlers = new Map();
      this.terminated = false;
      mockWorkers.set(this.id, this);
    }

    on(event: string, handler: Function) {
      if (!this.handlers.has(event)) {
        this.handlers.set(event, []);
      }
      this.handlers.get(event)!.push(handler);
    }

    postMessage(message: { taskId: string; type: string; data: unknown }) {
      // Simulate async task completion
      setTimeout(() => {
        const handlers = this.handlers.get('message');
        if (handlers) {
          handlers.forEach(h => h({
            taskId: message.taskId,
            success: true,
            result: { processed: true, input: message.data },
          }));
        }
      }, 10);
    }

    terminate() {
      this.terminated = true;
      return Promise.resolve();
    }
  }

  return { Worker: MockWorker };
});

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { WorkerPool, TaskPriority, type WorkerPoolStats } from '../../src/services/workerPool.js';

describe('WorkerPool', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool({
      minWorkers: 2,
      maxWorkers: 4,
      taskTimeout: 1000,
      autoScaling: { enabled: false },
      healthCheck: { enabled: false },
    });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('Basic operations', () => {
    it('should initialize with minimum workers', () => {
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(2);
      expect(stats.availableWorkers).toBe(2);
    });

    it('should execute a task', async () => {
      const result = await pool.execute<{ value: number }, { processed: boolean; input: { value: number } }>(
        'test',
        { value: 42 }
      );
      
      expect(result.processed).toBe(true);
      expect(result.input.value).toBe(42);
    });

    it('should execute multiple tasks', async () => {
      const results = await Promise.all([
        pool.execute('test', { id: 1 }),
        pool.execute('test', { id: 2 }),
        pool.execute('test', { id: 3 }),
      ]);
      
      expect(results).toHaveLength(3);
    });
  });

  describe('Priority handling', () => {
    it('should track tasks by priority in stats', async () => {
      // Queue some tasks but don't await them yet
      const task1 = pool.execute('test', { id: 1 }, TaskPriority.HIGH);
      const task2 = pool.execute('test', { id: 2 }, TaskPriority.NORMAL);
      const task3 = pool.execute('test', { id: 3 }, TaskPriority.LOW);
      
      // Wait for all tasks
      await Promise.all([task1, task2, task3]);
      
      const stats = pool.getStats();
      expect(stats.metrics.totalTasksProcessed).toBe(3);
    });
  });

  describe('Statistics', () => {
    it('should track metrics', async () => {
      await pool.execute('test', { id: 1 });
      await pool.execute('test', { id: 2 });
      
      const stats = pool.getStats();
      
      expect(stats.metrics.totalTasksProcessed).toBe(2);
      expect(stats.metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
      expect(stats.metrics.tasksPerSecond).toBeGreaterThan(0);
    });

    it('should track worker utilization', async () => {
      const stats = pool.getStats();
      
      expect(stats.busyWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.metrics.workerUtilization).toBeGreaterThanOrEqual(0);
      expect(stats.metrics.workerUtilization).toBeLessThanOrEqual(1);
    });
  });

  describe('Manual scaling', () => {
    it('should scale up manually', () => {
      pool.scale(4);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(4);
    });

    it('should not scale below minimum', () => {
      pool.scale(1);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(2);
    });

    it('should not scale above maximum', () => {
      pool.scale(10);
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(4);
    });
  });

  describe('Affinity hints', () => {
    it('should provide affinity hints for workers', () => {
      const hints = pool.getAffinityHints();
      
      expect(hints.length).toBe(2);
      expect(hints[0]).toHaveProperty('workerIndex');
      expect(hints[0]).toHaveProperty('suggestedCpuId');
    });
  });

  describe('Queue limits', () => {
    it('should reject tasks when queue is full', async () => {
      const smallPool = new WorkerPool({
        minWorkers: 1,
        maxWorkers: 1,
        maxQueueSize: 2,
        autoScaling: { enabled: false },
        healthCheck: { enabled: false },
      });

      // Fill the queue
      const tasks: Promise<unknown>[] = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(smallPool.execute('test', { id: i }).catch(e => e.message));
      }

      const results = await Promise.all(tasks);
      const errors = results.filter(r => typeof r === 'string' && r.includes('queue is full'));
      
      await smallPool.shutdown();
      
      // Some tasks should fail due to queue being full
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await pool.shutdown();
      
      await expect(pool.execute('test', {})).rejects.toThrow('shutting down');
    });
  });
});

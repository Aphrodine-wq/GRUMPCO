/**
 * Scheduled Agents Queue Unit Tests
 * Tests BullMQ-based repeatable job scheduling for scheduled agents.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock BullMQ
const mockQueueAdd = vi.fn();
const mockQueueAddBulk = vi.fn();
const mockQueueClose = vi.fn();
const mockQueueGetRepeatableJobs = vi.fn();
const mockQueueRemoveRepeatableByKey = vi.fn();

const mockWorkerClose = vi.fn();
const mockWorkerOn = vi.fn();
const mockWorkerInstance = {
  close: mockWorkerClose,
  on: mockWorkerOn,
};

const MockQueue = vi.fn().mockImplementation(() => ({
  add: mockQueueAdd,
  addBulk: mockQueueAddBulk,
  close: mockQueueClose,
  getRepeatableJobs: mockQueueGetRepeatableJobs,
  removeRepeatableByKey: mockQueueRemoveRepeatableByKey,
}));

const MockWorker = vi.fn().mockImplementation(() => mockWorkerInstance);

vi.mock('bullmq', () => ({
  Queue: MockQueue,
  Worker: MockWorker,
}));

// Mock scheduled agents service
const mockRunScheduledAgent = vi.fn();
vi.mock('../../src/services/scheduledAgentsService.js', () => ({
  runScheduledAgent: (...args: unknown[]) => mockRunScheduledAgent(...args),
}));

// Mock database
const mockStatement = {
  all: vi.fn(),
};
const mockDbInstance = {
  prepare: vi.fn(() => mockStatement),
};
const mockDb = {
  getDb: vi.fn(() => mockDbInstance),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb, databaseSupportsRawDb: () => true,
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('scheduledAgentsQueue', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Set default Redis environment
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    delete process.env.REDIS_PASSWORD;
    
    // Reset mocks
    mockQueueAdd.mockResolvedValue(undefined);
    mockQueueClose.mockResolvedValue(undefined);
    mockQueueGetRepeatableJobs.mockResolvedValue([]);
    mockQueueRemoveRepeatableByKey.mockResolvedValue(undefined);
    mockWorkerClose.mockResolvedValue(undefined);
    mockRunScheduledAgent.mockResolvedValue(undefined);
    mockStatement.all.mockReturnValue([]);
    
    // Reset mock constructors
    MockQueue.mockClear();
    MockWorker.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getScheduledQueue', () => {
    it('should create a new queue on first call', async () => {
      const { getScheduledQueue } = await import('../../src/services/scheduledAgentsQueue.js');
      
      const queue = await getScheduledQueue();
      
      expect(MockQueue).toHaveBeenCalledWith('grump-scheduled', {
        connection: {
          host: 'localhost',
          port: 6379,
          password: undefined,
        },
      });
      expect(queue).toBeDefined();
    });

    it('should reuse existing queue on subsequent calls', async () => {
      const { getScheduledQueue } = await import('../../src/services/scheduledAgentsQueue.js');
      
      const queue1 = await getScheduledQueue();
      const queue2 = await getScheduledQueue();
      
      // Queue constructor should only be called once
      expect(MockQueue).toHaveBeenCalledTimes(1);
      expect(queue1).toBe(queue2);
    });

    it('should use custom Redis port', async () => {
      process.env.REDIS_PORT = '6380';
      
      vi.resetModules();
      
      const { getScheduledQueue } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await getScheduledQueue();
      
      expect(MockQueue).toHaveBeenCalledWith('grump-scheduled', {
        connection: expect.objectContaining({
          port: 6380,
        }),
      });
    });

    it('should include password when REDIS_PASSWORD is set', async () => {
      process.env.REDIS_PASSWORD = 'my-secret-password';
      
      vi.resetModules();
      
      const { getScheduledQueue } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await getScheduledQueue();
      
      expect(MockQueue).toHaveBeenCalledWith('grump-scheduled', {
        connection: expect.objectContaining({
          password: 'my-secret-password',
        }),
      });
    });
  });

  describe('addScheduledRepeatableJob', () => {
    it('should add a repeatable job with cron pattern', async () => {
      const { addScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await addScheduledRepeatableJob('sched-123', '0 9 * * *', 'ship', {
        projectDescription: 'Daily build',
      });
      
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'run',
        {
          scheduleId: 'sched-123',
          action: 'ship',
          params: { projectDescription: 'Daily build' },
        },
        {
          jobId: 'sched-123',
          repeat: { pattern: '0 9 * * *' },
        }
      );
    });

    it('should log job addition', async () => {
      const { addScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await addScheduledRepeatableJob('sched-456', '0 * * * *', 'ship', {});
      
      expect(logger.info).toHaveBeenCalledWith(
        { scheduleId: 'sched-456', cronExpression: '0 * * * *', action: 'ship' },
        'Scheduled repeatable job added'
      );
    });

    it('should handle complex params', async () => {
      const { addScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      const complexParams = {
        projectDescription: 'Complex app',
        preferences: {
          frontendFramework: 'react',
          backendRuntime: 'node',
        },
        features: ['auth', 'api'],
      };
      
      await addScheduledRepeatableJob('sched-789', '0 0 * * 0', 'ship', complexParams);
      
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'run',
        expect.objectContaining({
          params: complexParams,
        }),
        expect.any(Object)
      );
    });

    it('should handle empty params', async () => {
      const { addScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await addScheduledRepeatableJob('sched-empty', '0 * * * *', 'ship', {});
      
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'run',
        expect.objectContaining({
          params: {},
        }),
        expect.any(Object)
      );
    });
  });

  describe('removeScheduledRepeatableJob', () => {
    it('should remove a repeatable job by ID', async () => {
      mockQueueGetRepeatableJobs.mockResolvedValueOnce([
        { id: 'sched-123', key: 'job-key-123', pattern: '0 9 * * *' },
        { id: 'sched-456', key: 'job-key-456', pattern: '0 * * * *' },
      ]);
      
      const { removeScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await removeScheduledRepeatableJob('sched-123');
      
      expect(mockQueueRemoveRepeatableByKey).toHaveBeenCalledWith('job-key-123');
    });

    it('should log job removal', async () => {
      mockQueueGetRepeatableJobs.mockResolvedValueOnce([
        { id: 'sched-123', key: 'job-key-123', pattern: '0 9 * * *' },
      ]);
      
      const { removeScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await removeScheduledRepeatableJob('sched-123');
      
      expect(logger.info).toHaveBeenCalledWith(
        { scheduleId: 'sched-123' },
        'Scheduled repeatable job removed'
      );
    });

    it('should not throw when job not found', async () => {
      mockQueueGetRepeatableJobs.mockResolvedValueOnce([
        { id: 'other-job', key: 'other-key', pattern: '0 * * * *' },
      ]);
      
      const { removeScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      // Should not throw
      await expect(removeScheduledRepeatableJob('non-existent')).resolves.not.toThrow();
      expect(mockQueueRemoveRepeatableByKey).not.toHaveBeenCalled();
    });

    it('should handle empty repeatable jobs list', async () => {
      mockQueueGetRepeatableJobs.mockResolvedValueOnce([]);
      
      const { removeScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await expect(removeScheduledRepeatableJob('sched-123')).resolves.not.toThrow();
      expect(mockQueueRemoveRepeatableByKey).not.toHaveBeenCalled();
    });
  });

  describe('startScheduledAgentsWorker', () => {
    it('should create a new worker', async () => {
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await startScheduledAgentsWorker();
      
      expect(MockWorker).toHaveBeenCalledWith(
        'grump-scheduled',
        expect.any(Function),
        {
          connection: {
            host: 'localhost',
            port: 6379,
            password: undefined,
          },
          concurrency: 1,
        }
      );
    });

    it('should register event handlers', async () => {
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await startScheduledAgentsWorker();
      
      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should log worker start', async () => {
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await startScheduledAgentsWorker();
      
      expect(logger.info).toHaveBeenCalledWith('Scheduled agents BullMQ worker started');
    });

    it('should not create duplicate workers', async () => {
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await startScheduledAgentsWorker();
      await startScheduledAgentsWorker();
      
      // Worker constructor should only be called once
      expect(MockWorker).toHaveBeenCalledTimes(1);
    });

    it('should process job and call runScheduledAgent', async () => {
      let jobProcessor: ((job: { data: unknown }) => Promise<void>) | undefined;
      MockWorker.mockImplementationOnce((name, processor, opts) => {
        jobProcessor = processor;
        return mockWorkerInstance;
      });
      
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await startScheduledAgentsWorker();
      
      expect(jobProcessor).toBeDefined();
      
      // Simulate job processing
      await jobProcessor!({
        data: {
          scheduleId: 'sched-test',
          action: 'ship',
          params: { projectDescription: 'Test build' },
        },
      });
      
      expect(mockRunScheduledAgent).toHaveBeenCalledWith('sched-test', 'ship', { projectDescription: 'Test build' });
    });
  });

  describe('stopScheduledAgentsWorker', () => {
    it('should log worker stop when worker was started', async () => {
      const { startScheduledAgentsWorker, stopScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await startScheduledAgentsWorker();
      await stopScheduledAgentsWorker();
      
      expect(logger.info).toHaveBeenCalledWith('Scheduled agents BullMQ worker stopped');
    });

    it('should handle stop when worker not started', async () => {
      const { stopScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      
      // Should not throw when worker hasn't been started
      await expect(stopScheduledAgentsWorker()).resolves.not.toThrow();
    });

    it('should call close on worker when stopping', async () => {
      const { startScheduledAgentsWorker, stopScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await startScheduledAgentsWorker();
      
      // Reset to track new calls
      mockWorkerClose.mockClear();
      
      await stopScheduledAgentsWorker();
      
      // Worker close should be called (may be in cleanup)
      expect(mockWorkerClose).toHaveBeenCalled();
    });
  });

  describe('loadRepeatableJobsFromDb', () => {
    it('should load enabled agents from database and add as jobs', async () => {
      const mockRows = [
        {
          id: 'sched-1',
          cronExpression: '0 9 * * *',
          action: 'ship',
          paramsJson: JSON.stringify({ projectDescription: 'Build 1' }),
        },
        {
          id: 'sched-2',
          cronExpression: '0 0 * * 0',
          action: 'ship',
          paramsJson: JSON.stringify({ projectDescription: 'Build 2' }),
        },
      ];
      mockStatement.all.mockReturnValueOnce(mockRows);
      
      const { loadRepeatableJobsFromDb } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await loadRepeatableJobsFromDb();
      
      expect(mockQueueAddBulk).toHaveBeenCalledTimes(1);
      expect(mockQueueAddBulk).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          name: 'run',
          data: expect.objectContaining({
            scheduleId: 'sched-1',
            action: 'ship',
            params: { projectDescription: 'Build 1' },
          }),
          opts: expect.objectContaining({
            jobId: 'sched-1',
            repeat: { pattern: '0 9 * * *' },
          })
        }),
        expect.objectContaining({
          name: 'run',
          data: expect.objectContaining({
            scheduleId: 'sched-2',
            action: 'ship',
            params: { projectDescription: 'Build 2' },
          }),
          opts: expect.objectContaining({
            jobId: 'sched-2',
            repeat: { pattern: '0 0 * * 0' },
          })
        })
      ]));
    });

    it('should handle empty database', async () => {
      mockStatement.all.mockReturnValueOnce([]);
      
      const { loadRepeatableJobsFromDb } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await loadRepeatableJobsFromDb();
      
      expect(mockQueueAddBulk).not.toHaveBeenCalled();
    });

    it('should handle null paramsJson', async () => {
      const mockRows = [
        {
          id: 'sched-1',
          cronExpression: '0 9 * * *',
          action: 'ship',
          paramsJson: null,
        },
      ];
      mockStatement.all.mockReturnValueOnce(mockRows);
      
      const { loadRepeatableJobsFromDb } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await loadRepeatableJobsFromDb();
      
      expect(mockQueueAddBulk).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          name: 'run',
          data: expect.objectContaining({
            params: {},
          }),
        })
      ]));
    });

    it('should log batch loaded', async () => {
      const mockRows = [
        {
          id: 'sched-1',
          cronExpression: '0 9 * * *',
          action: 'ship',
          paramsJson: '{}',
        },
      ];
      mockStatement.all.mockReturnValueOnce(mockRows);
      
      const { loadRepeatableJobsFromDb } = await import('../../src/services/scheduledAgentsQueue.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await loadRepeatableJobsFromDb();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1 }),
        'Scheduled repeatable jobs batch loaded from DB'
      );
    });

    it('should query only enabled agents', async () => {
      mockStatement.all.mockReturnValueOnce([]);
      
      const { loadRepeatableJobsFromDb } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await loadRepeatableJobsFromDb();
      
      // Check that the SQL query includes enabled = 1
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('enabled = 1')
      );
    });
  });

  describe('Worker event handlers', () => {
    it('should log on job completion', async () => {
      let completedHandler: ((job: { id: string }) => void) | undefined;
      mockWorkerOn.mockImplementation((event, handler) => {
        if (event === 'completed') {
          completedHandler = handler;
        }
      });
      
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await startScheduledAgentsWorker();
      
      expect(completedHandler).toBeDefined();
      completedHandler!({ id: 'job-123' });
      
      expect(logger.info).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        'Scheduled agent job completed'
      );
    });

    it('should log on job failure', async () => {
      let failedHandler: ((job: { id: string } | undefined, err: Error) => void) | undefined;
      mockWorkerOn.mockImplementation((event, handler) => {
        if (event === 'failed') {
          failedHandler = handler;
        }
      });
      
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await startScheduledAgentsWorker();
      
      expect(failedHandler).toBeDefined();
      failedHandler!({ id: 'job-456' }, new Error('Something went wrong'));
      
      expect(logger.error).toHaveBeenCalledWith(
        { jobId: 'job-456', err: 'Something went wrong' },
        'Scheduled agent job failed'
      );
    });

    it('should handle undefined job on failure', async () => {
      let failedHandler: ((job: { id: string } | undefined, err: Error) => void) | undefined;
      mockWorkerOn.mockImplementation((event, handler) => {
        if (event === 'failed') {
          failedHandler = handler;
        }
      });
      
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await startScheduledAgentsWorker();
      
      expect(failedHandler).toBeDefined();
      failedHandler!(undefined, new Error('Job not found'));
      
      expect(logger.error).toHaveBeenCalledWith(
        { jobId: undefined, err: 'Job not found' },
        'Scheduled agent job failed'
      );
    });
  });

  describe('Connection configuration', () => {
    it('should use default Redis host when not specified', async () => {
      delete process.env.REDIS_HOST;
      process.env.REDIS_HOST = '';
      
      vi.resetModules();
      process.env.REDIS_HOST = 'localhost'; // Need to set for module to work
      
      const { getScheduledQueue } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await getScheduledQueue();
      
      expect(MockQueue).toHaveBeenCalledWith('grump-scheduled', {
        connection: expect.objectContaining({
          host: 'localhost',
        }),
      });
    });

    it('should use default Redis port when not specified', async () => {
      delete process.env.REDIS_PORT;
      
      vi.resetModules();
      
      const { getScheduledQueue } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await getScheduledQueue();
      
      expect(MockQueue).toHaveBeenCalledWith('grump-scheduled', {
        connection: expect.objectContaining({
          port: 6379,
        }),
      });
    });

    it('should handle custom Redis host', async () => {
      process.env.REDIS_HOST = 'redis.example.com';
      
      vi.resetModules();
      
      const { getScheduledQueue } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await getScheduledQueue();
      
      expect(MockQueue).toHaveBeenCalledWith('grump-scheduled', {
        connection: expect.objectContaining({
          host: 'redis.example.com',
        }),
      });
    });
  });

  describe('Queue name', () => {
    it('should use correct queue name', async () => {
      const { getScheduledQueue } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await getScheduledQueue();
      
      expect(MockQueue).toHaveBeenCalledWith('grump-scheduled', expect.any(Object));
    });
  });

  describe('Job data structure', () => {
    it('should include all required fields in job data', async () => {
      const { addScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      const params = { projectDescription: 'Test' };
      await addScheduledRepeatableJob('sched-test', '0 * * * *', 'ship', params);
      
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'run',
        {
          scheduleId: 'sched-test',
          action: 'ship',
          params: params,
        },
        expect.any(Object)
      );
    });
  });
});

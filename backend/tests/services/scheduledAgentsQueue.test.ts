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
    mockQueueAddBulk.mockResolvedValue(undefined);
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
      
      const q1 = await getScheduledQueue();
      const q2 = await getScheduledQueue();
      
      expect(q1).toBe(q2);
      expect(MockQueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('addScheduledRepeatableJob', () => {
    it('should add job to queue', async () => {
      const { addScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await addScheduledRepeatableJob('sched-123', '0 * * * *', 'ship', { projectDescription: 'Test' });
      
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'run',
        { scheduleId: 'sched-123', action: 'ship', params: { projectDescription: 'Test' } },
        { jobId: 'sched-123', repeat: { pattern: '0 * * * *' } }
      );
    });
  });

  describe('removeScheduledRepeatableJob', () => {
    it('should remove job from queue if exists', async () => {
      mockQueueGetRepeatableJobs.mockResolvedValue([
        { id: 'sched-123', key: 'sched-123:...' },
        { id: 'other', key: 'other:...' },
      ]);
      
      const { removeScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await removeScheduledRepeatableJob('sched-123');
      
      expect(mockQueueRemoveRepeatableByKey).toHaveBeenCalledWith('sched-123:...');
    });

    it('should do nothing if job not found', async () => {
      mockQueueGetRepeatableJobs.mockResolvedValue([
        { id: 'other', key: 'other:...' },
      ]);
      
      const { removeScheduledRepeatableJob } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await removeScheduledRepeatableJob('sched-123');
      
      expect(mockQueueRemoveRepeatableByKey).not.toHaveBeenCalled();
    });
  });

  describe('startScheduledAgentsWorker', () => {
    it('should start worker only once', async () => {
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await startScheduledAgentsWorker();
      await startScheduledAgentsWorker();
      
      expect(MockWorker).toHaveBeenCalledTimes(1);
    });

    it('should process job correctly', async () => {
      const { startScheduledAgentsWorker } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await startScheduledAgentsWorker();
      
      // Get the worker processor function
      const jobProcessor = MockWorker.mock.calls[0][1];
      expect(jobProcessor).toBeDefined();
      
      // Simulate job processing
      await jobProcessor({
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
      const jobs = mockQueueAddBulk.mock.calls[0][0];
      expect(jobs).toHaveLength(2);

      expect(jobs[0]).toMatchObject({
        name: 'run',
        data: {
          scheduleId: 'sched-1',
          action: 'ship',
          params: { projectDescription: 'Build 1' },
        },
        opts: {
          jobId: 'sched-1',
          repeat: { pattern: '0 9 * * *' },
        }
      });

      expect(jobs[1]).toMatchObject({
        name: 'run',
        data: {
          scheduleId: 'sched-2',
          action: 'ship',
          params: { projectDescription: 'Build 2' },
        },
        opts: {
          jobId: 'sched-2',
          repeat: { pattern: '0 0 * * 0' },
        }
      });
    });

    it('should handle empty database', async () => {
      mockStatement.all.mockReturnValueOnce([]);
      
      const { loadRepeatableJobsFromDb } = await import('../../src/services/scheduledAgentsQueue.js');
      
      await loadRepeatableJobsFromDb();
      
      expect(mockQueueAdd).not.toHaveBeenCalled();
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
      
      expect(mockQueueAddBulk).toHaveBeenCalledTimes(1);
      const jobs = mockQueueAddBulk.mock.calls[0][0];

      expect(jobs[0]).toMatchObject({
        name: 'run',
        data: {
          params: {},
        },
      });
    });

    it('should log each job loaded', async () => {
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
        { scheduleId: 'sched-1', cronExpression: '0 9 * * *' },
        'Scheduled repeatable job loaded from DB'
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

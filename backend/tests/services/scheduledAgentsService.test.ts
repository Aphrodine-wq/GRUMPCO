/**
 * Scheduled Agents Service Unit Tests
 * Tests cron-based scheduling for SHIP and other agent runs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock database with prepare/all/get/run interface
const mockStatement = {
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
};
const mockDbInstance = {
  prepare: vi.fn(() => mockStatement),
};
const mockDb = {
  getDb: vi.fn(() => mockDbInstance),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock supabase client
vi.mock('../../src/services/supabaseClient.js', () => ({
  db: {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null }),
          }),
        }),
      }),
    })),
  },
  isMockMode: false,
}));

// Mock runtime config
vi.mock('../../src/config/runtime.js', () => ({
  isServerlessRuntime: false,
}));

// Mock ship mode service
const mockStartShipMode = vi.fn();
vi.mock('../../src/services/shipModeService.js', () => ({
  startShipMode: (opts: unknown) => mockStartShipMode(opts),
}));

// Mock job queue
const mockEnqueueShipJob = vi.fn();
vi.mock('../../src/services/jobQueue.js', () => ({
  enqueueShipJob: (id: string) => mockEnqueueShipJob(id),
}));

// Mock scheduled agents queue (used via dynamic import)
vi.mock('../../src/services/scheduledAgentsQueue.js', () => ({
  addScheduledRepeatableJob: vi.fn().mockResolvedValue(undefined),
  removeScheduledRepeatableJob: vi.fn().mockResolvedValue(undefined),
}));

// Mock scheduled agents cron (used via dynamic import)
vi.mock('../../src/services/scheduledAgentsCron.js', () => ({
  scheduleWithNodeCron: vi.fn(),
  unscheduleNodeCron: vi.fn(),
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

describe('scheduledAgentsService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset environment
    delete process.env.REDIS_HOST;
    delete process.env.DB_TYPE;
    
    // Reset mock defaults
    mockStatement.all.mockReturnValue([]);
    mockStatement.get.mockReturnValue(undefined);
    mockStatement.run.mockReturnValue({ changes: 1 });
    
    mockStartShipMode.mockResolvedValue({ id: 'session-123' });
    mockEnqueueShipJob.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('listScheduledAgents', () => {
    it('should return enabled scheduled agents from SQLite', async () => {
      const mockRows = [
        {
          id: 'sched-1',
          name: 'Daily Ship',
          cronExpression: '0 9 * * *',
          action: 'ship',
          paramsJson: JSON.stringify({ projectDescription: 'Daily build' }),
          enabled: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'sched-2',
          name: 'Weekly Check',
          cronExpression: '0 0 * * 0',
          action: 'ship',
          paramsJson: null,
          enabled: 1,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];
      mockStatement.all.mockReturnValue(mockRows);
      
      const { listScheduledAgents } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = listScheduledAgents();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'sched-1',
        name: 'Daily Ship',
        cronExpression: '0 9 * * *',
        action: 'ship',
        params: { projectDescription: 'Daily build' },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
      expect(result[1].params).toEqual({});
    });

    it('should return empty array when no agents exist', async () => {
      mockStatement.all.mockReturnValue([]);
      
      const { listScheduledAgents } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = listScheduledAgents();
      
      expect(result).toEqual([]);
    });
  });

  describe('runScheduledAgent', () => {
    it('should start ship mode and enqueue job for ship action', async () => {
      mockStartShipMode.mockResolvedValueOnce({ id: 'ship-session-456' });
      
      const { runScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      await runScheduledAgent('sched-123', 'ship', {
        projectDescription: 'Build a todo app',
        preferences: { frontendFramework: 'react' },
      });
      
      expect(mockStartShipMode).toHaveBeenCalledWith({
        projectDescription: 'Build a todo app',
        preferences: { frontendFramework: 'react' },
      });
      expect(mockEnqueueShipJob).toHaveBeenCalledWith('ship-session-456');
    });

    it('should handle empty project description', async () => {
      mockStartShipMode.mockResolvedValueOnce({ id: 'ship-session-789' });
      
      const { runScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      await runScheduledAgent('sched-123', 'ship', {});
      
      expect(mockStartShipMode).toHaveBeenCalledWith({
        projectDescription: '',
        preferences: undefined,
      });
    });

    it('should log warning for non-ship actions', async () => {
      const { runScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await runScheduledAgent('sched-123', 'codegen', { prompt: 'Generate code' });
      
      expect(logger.warn).toHaveBeenCalledWith(
        { scheduleId: 'sched-123', action: 'codegen' },
        'Scheduled agent: only ship action is implemented'
      );
      expect(mockStartShipMode).not.toHaveBeenCalled();
    });

    it('should log warning for chat action', async () => {
      const { runScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await runScheduledAgent('sched-123', 'chat', { message: 'Hello' });
      
      expect(logger.warn).toHaveBeenCalled();
      expect(mockStartShipMode).not.toHaveBeenCalled();
    });
  });

  describe('createScheduledAgent', () => {
    it('should create a scheduled agent with correct structure', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await createScheduledAgent(
        'Daily Ship',
        '0 9 * * *',
        'ship',
        { projectDescription: 'Daily build' }
      );
      
      expect(result.id).toMatch(/^sched_\d+_/);
      expect(result.name).toBe('Daily Ship');
      expect(result.cronExpression).toBe('0 9 * * *');
      expect(result.action).toBe('ship');
      expect(result.params).toEqual({ projectDescription: 'Daily build' });
      expect(result.enabled).toBe(true);
    });

    it('should handle null params', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await createScheduledAgent(
        'No Params Agent',
        '0 0 * * *',
        'ship',
        null as unknown as Record<string, unknown>
      );
      
      expect(result.params).toEqual({});
    });

    it('should log agent creation', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await createScheduledAgent('Test Agent', '0 * * * *', 'ship', {});
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Agent',
          cronExpression: '0 * * * *',
          action: 'ship',
        }),
        'Scheduled agent created'
      );
    });

    it('should generate unique IDs', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result1 = await createScheduledAgent('Agent 1', '0 * * * *', 'ship', {});
      
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const result2 = await createScheduledAgent('Agent 2', '0 * * * *', 'ship', {});
      
      expect(result1.id).toMatch(/^sched_\d+_[a-z0-9]+$/);
      expect(result2.id).toMatch(/^sched_\d+_[a-z0-9]+$/);
    });

    it('should set createdAt and updatedAt to same value on creation', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await createScheduledAgent('Test', '0 * * * *', 'ship', {});
      
      expect(result.createdAt).toBe(result.updatedAt);
      expect(new Date(result.createdAt).getTime()).not.toBeNaN();
    });
  });

  describe('getScheduledAgent', () => {
    it('should return agent when found in SQLite', async () => {
      const mockRow = {
        id: 'sched-123',
        name: 'Test Agent',
        cronExpression: '0 9 * * *',
        action: 'ship',
        paramsJson: JSON.stringify({ key: 'value' }),
        enabled: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      mockStatement.get.mockReturnValue(mockRow);
      
      const { getScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await getScheduledAgent('sched-123');
      
      expect(result).toEqual({
        id: 'sched-123',
        name: 'Test Agent',
        cronExpression: '0 9 * * *',
        action: 'ship',
        params: { key: 'value' },
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should return null when agent not found', async () => {
      mockStatement.get.mockReturnValue(undefined);
      
      const { getScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await getScheduledAgent('non-existent');
      
      expect(result).toBeNull();
    });

    it('should handle null paramsJson', async () => {
      const mockRow = {
        id: 'sched-123',
        name: 'Test Agent',
        cronExpression: '0 9 * * *',
        action: 'ship',
        paramsJson: null,
        enabled: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      mockStatement.get.mockReturnValue(mockRow);
      
      const { getScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await getScheduledAgent('sched-123');
      
      expect(result?.params).toEqual({});
    });

    it('should handle disabled agent', async () => {
      const mockRow = {
        id: 'sched-123',
        name: 'Disabled Agent',
        cronExpression: '0 9 * * *',
        action: 'ship',
        paramsJson: null,
        enabled: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      mockStatement.get.mockReturnValue(mockRow);
      
      const { getScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await getScheduledAgent('sched-123');
      
      expect(result?.enabled).toBe(false);
    });
  });

  describe('cancelScheduledAgent', () => {
    it('should return true when agent is successfully cancelled', async () => {
      mockStatement.run.mockReturnValue({ changes: 1 });
      
      const { cancelScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await cancelScheduledAgent('sched-123');
      
      expect(result).toBe(true);
    });

    it('should return false when agent not found', async () => {
      mockStatement.run.mockReturnValue({ changes: 0 });
      
      const { cancelScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await cancelScheduledAgent('non-existent');
      
      expect(result).toBe(false);
    });

    it('should log cancellation on success', async () => {
      mockStatement.run.mockReturnValue({ changes: 1 });
      
      const { cancelScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await cancelScheduledAgent('sched-123');
      
      expect(logger.info).toHaveBeenCalledWith({ id: 'sched-123' }, 'Scheduled agent cancelled');
    });
  });

  describe('listAllScheduledAgents', () => {
    it('should return all scheduled agents from SQLite', async () => {
      const mockRows = [
        {
          id: 'sched-1',
          name: 'Daily Ship',
          cronExpression: '0 9 * * *',
          action: 'ship',
          paramsJson: JSON.stringify({ projectDescription: 'Daily build' }),
          enabled: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'sched-2',
          name: 'Disabled Agent',
          cronExpression: '0 0 * * *',
          action: 'ship',
          paramsJson: null,
          enabled: 0,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];
      mockStatement.all.mockReturnValue(mockRows);
      
      const { listAllScheduledAgents } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await listAllScheduledAgents();
      
      expect(result).toHaveLength(2);
      expect(result[0].enabled).toBe(true);
      expect(result[1].enabled).toBe(false);
    });

    it('should return empty array when no agents exist', async () => {
      mockStatement.all.mockReturnValue([]);
      
      const { listAllScheduledAgents } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await listAllScheduledAgents();
      
      expect(result).toEqual([]);
    });
  });

  describe('ScheduledAction type', () => {
    it('should accept ship action', async () => {
      const { runScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      // Should not throw
      await expect(runScheduledAgent('sched-1', 'ship', {})).resolves.not.toThrow();
    });

    it('should accept codegen action (even if not implemented)', async () => {
      const { runScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      // Should not throw, but will log warning
      await expect(runScheduledAgent('sched-1', 'codegen', {})).resolves.not.toThrow();
    });

    it('should accept chat action (even if not implemented)', async () => {
      const { runScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      // Should not throw, but will log warning
      await expect(runScheduledAgent('sched-1', 'chat', {})).resolves.not.toThrow();
    });
  });

  describe('Cron expression handling', () => {
    it('should store cron expression correctly', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await createScheduledAgent('Every Hour', '0 * * * *', 'ship', {});
      
      expect(result.cronExpression).toBe('0 * * * *');
    });

    it('should handle complex cron expressions', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      // Every weekday at 9am
      const result = await createScheduledAgent('Weekday 9am', '0 9 * * 1-5', 'ship', {});
      
      expect(result.cronExpression).toBe('0 9 * * 1-5');
    });

    it('should handle cron with seconds (6-field)', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      // At second 30 of every minute
      const result = await createScheduledAgent('Every 30 sec', '30 * * * * *', 'ship', {});
      
      expect(result.cronExpression).toBe('30 * * * * *');
    });
  });

  describe('Params handling', () => {
    it('should preserve complex params structure', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const complexParams = {
        projectDescription: 'Build a complex app',
        preferences: {
          frontendFramework: 'react',
          backendRuntime: 'node',
          database: 'postgres',
        },
        features: ['auth', 'api', 'dashboard'],
        metadata: {
          createdBy: 'user-123',
          priority: 1,
        },
      };
      
      const result = await createScheduledAgent('Complex Agent', '0 * * * *', 'ship', complexParams);
      
      expect(result.params).toEqual(complexParams);
    });

    it('should handle empty params object', async () => {
      const { createScheduledAgent } = await import('../../src/services/scheduledAgentsService.js');
      
      const result = await createScheduledAgent('Empty Params', '0 * * * *', 'ship', {});
      
      expect(result.params).toEqual({});
    });
  });
});

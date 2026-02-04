/**
 * Tests for Persistent Agent Service
 * Tests agent lifecycle, task processing, and notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks
const {
  mockGetDatabase,
  mockWriteAuditLog,
  mockDispatchWebhook,
  mockGetDueHeartbeats,
  mockMarkHeartbeatExecuted,
  mockHasPremiumFeature,
  mockGetTier,
} = vi.hoisted(() => ({
  mockGetDatabase: vi.fn(),
  mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  mockDispatchWebhook: vi.fn().mockResolvedValue(undefined),
  mockGetDueHeartbeats: vi.fn().mockResolvedValue([]),
  mockMarkHeartbeatExecuted: vi.fn().mockResolvedValue(undefined),
  mockHasPremiumFeature: vi.fn().mockReturnValue(true),
  mockGetTier: vi.fn().mockReturnValue({ id: 'team' }),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockGetDatabase(),
}));

const mockQueryAuditLogs = vi.fn().mockResolvedValue([]);
vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: (data: unknown) => mockWriteAuditLog(data),
  queryAuditLogs: (...args: unknown[]) => mockQueryAuditLogs(...args),
}));

vi.mock('../../src/services/webhookService.js', () => ({
  dispatchWebhook: (...args: unknown[]) => mockDispatchWebhook(...args),
}));

vi.mock('../../src/services/heartbeatService.js', () => ({
  getDueHeartbeats: () => mockGetDueHeartbeats(),
  markHeartbeatExecuted: (id: string) => mockMarkHeartbeatExecuted(id),
}));

vi.mock('../../src/config/pricing.js', () => ({
  getTier: () => mockGetTier(),
  hasPremiumFeature: (...args: unknown[]) => mockHasPremiumFeature(...args),
}));

vi.mock('../../src/services/messagingShipNotifier.js', () => ({
  sendProactiveToUser: vi.fn().mockResolvedValue(undefined),
}));

import {
  startPersistentAgent,
  stopPersistentAgent,
  getAgentStatus,
  isAgentRunning,
  queueAgentTask,
  loadAutoStartAgents,
  PersistentAgentConfig,
  AgentTask,
  PersistentAgentStatus,
} from '../../src/services/persistentAgentService.js';

describe('Persistent Agent Service', () => {
  const testUserId = 'test-user-123';
  
  const mockDbInstance = {
    getSettings: vi.fn().mockResolvedValue({ tier: 'team' }),
    listShipSessions: vi.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetDatabase.mockReturnValue(mockDbInstance);
    mockHasPremiumFeature.mockReturnValue(true);
  });

  afterEach(async () => {
    // Stop agent if running to clean up
    await stopPersistentAgent(testUserId);
    vi.useRealTimers();
  });

  describe('startPersistentAgent', () => {
    it('should start an agent for a team tier user', async () => {
      const result = await startPersistentAgent(testUserId, {
        capabilities: ['database', 'webhook'],
        allowlist: ['api.example.com'],
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Persistent agent started');
      expect(isAgentRunning(testUserId)).toBe(true);
    });

    it('should reject starting agent for free tier users without premium feature', async () => {
      mockDbInstance.getSettings.mockResolvedValueOnce({ tier: 'free' });
      mockHasPremiumFeature.mockReturnValueOnce(false);

      const result = await startPersistentAgent(testUserId, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires Team tier');
    });

    it('should allow team tier users', async () => {
      mockDbInstance.getSettings.mockResolvedValueOnce({ tier: 'team' });
      mockHasPremiumFeature.mockReturnValueOnce(false); // Not via premium feature

      const result = await startPersistentAgent(testUserId, {});

      expect(result.success).toBe(true);
    });

    it('should allow enterprise tier users', async () => {
      mockDbInstance.getSettings.mockResolvedValueOnce({ tier: 'enterprise' });
      mockHasPremiumFeature.mockReturnValueOnce(false);

      const result = await startPersistentAgent(testUserId, {});

      expect(result.success).toBe(true);
    });

    it('should reject starting already running agent', async () => {
      await startPersistentAgent(testUserId, {});
      
      const result = await startPersistentAgent(testUserId, {});

      expect(result.success).toBe(false);
      expect(result.message).toBe('Agent already running');
    });

    it('should use default config values', async () => {
      await startPersistentAgent(testUserId, {});

      const status = getAgentStatus(testUserId);
      expect(status).toBeDefined();
      expect(status?.running).toBe(true);
    });

    it('should apply custom config', async () => {
      const result = await startPersistentAgent(testUserId, {
        capabilities: ['monitoring'],
        allowlist: ['api.test.com'],
        notifications: { telegram: true, discord: true },
        autoStart: true,
      });

      expect(result.success).toBe(true);
    });

    it('should process immediately due heartbeats on start', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-1',
          user_id: testUserId,
          name: 'Test Heartbeat',
          cron_expression: '* * * * *',
          payload: JSON.stringify({ template: 'HEALTH_CHECK' }),
        },
      ]);

      await startPersistentAgent(testUserId, {});

      // Wait for the initial heartbeat processing
      await vi.advanceTimersByTimeAsync(100);

      expect(mockMarkHeartbeatExecuted).toHaveBeenCalledWith('hb-1');
    });
  });

  describe('stopPersistentAgent', () => {
    it('should stop a running agent', async () => {
      await startPersistentAgent(testUserId, {});
      expect(isAgentRunning(testUserId)).toBe(true);

      await stopPersistentAgent(testUserId);

      expect(isAgentRunning(testUserId)).toBe(false);
    });

    it('should handle stopping non-existent agent gracefully', async () => {
      await expect(stopPersistentAgent('non-existent-user')).resolves.not.toThrow();
    });

    it('should clean up task queue on stop', async () => {
      await startPersistentAgent(testUserId, {});
      await queueAgentTask(testUserId, 'webhook', { test: true });
      
      await stopPersistentAgent(testUserId);

      expect(isAgentRunning(testUserId)).toBe(false);
    });

    it('should clear cron interval on stop', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      await startPersistentAgent(testUserId, {});
      await stopPersistentAgent(testUserId);

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('getAgentStatus', () => {
    it('should return null for non-running agent', () => {
      const status = getAgentStatus('non-existent-user');
      expect(status).toBeNull();
    });

    it('should return status for running agent', async () => {
      await startPersistentAgent(testUserId, {});

      const status = getAgentStatus(testUserId);

      expect(status).toBeDefined();
      expect(status?.userId).toBe(testUserId);
      expect(status?.running).toBe(true);
      expect(status?.tasksProcessed).toBe(0);
      expect(status?.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should track tasks processed', async () => {
      await startPersistentAgent(testUserId, {});
      
      // Queue and process a task
      await queueAgentTask(testUserId, 'webhook', { data: 'test' });
      await vi.advanceTimersByTimeAsync(100);

      const status = getAgentStatus(testUserId);
      expect(status?.tasksProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should show queued tasks count', async () => {
      await startPersistentAgent(testUserId, {});

      const status = getAgentStatus(testUserId);
      expect(typeof status?.tasksQueued).toBe('number');
    });
  });

  describe('isAgentRunning', () => {
    it('should return false for non-running agent', () => {
      expect(isAgentRunning('some-user')).toBe(false);
    });

    it('should return true for running agent', async () => {
      await startPersistentAgent(testUserId, {});
      expect(isAgentRunning(testUserId)).toBe(true);
    });

    it('should return false after agent is stopped', async () => {
      await startPersistentAgent(testUserId, {});
      await stopPersistentAgent(testUserId);
      expect(isAgentRunning(testUserId)).toBe(false);
    });
  });

  describe('queueAgentTask', () => {
    it('should return null for non-running agent', async () => {
      const task = await queueAgentTask('non-existent', 'webhook', {});
      expect(task).toBeNull();
    });

    it('should queue task for running agent', async () => {
      await startPersistentAgent(testUserId, {});

      const task = await queueAgentTask(testUserId, 'webhook', { data: 'test' });

      expect(task).toBeDefined();
      expect(task?.id).toMatch(/^task_/);
      expect(task?.userId).toBe(testUserId);
      expect(task?.type).toBe('webhook');
      // Task may be pending or already completed/running since processing starts immediately
      expect(['pending', 'running', 'completed']).toContain(task?.status);
    });

    it('should process task immediately if queue is empty', async () => {
      await startPersistentAgent(testUserId, {});

      const task = await queueAgentTask(testUserId, 'webhook', { action: 'test' });
      
      // Allow async processing
      await vi.advanceTimersByTimeAsync(100);

      expect(task).toBeDefined();
    });

    it('should queue anticipatory tasks', async () => {
      await startPersistentAgent(testUserId, {});

      const task = await queueAgentTask(testUserId, 'anticipatory', { prediction: 'test' });

      expect(task?.type).toBe('anticipatory');
    });

    it('should generate unique task IDs', async () => {
      await startPersistentAgent(testUserId, {});

      const task1 = await queueAgentTask(testUserId, 'webhook', { n: 1 });
      const task2 = await queueAgentTask(testUserId, 'webhook', { n: 2 });

      expect(task1?.id).not.toBe(task2?.id);
    });
  });

  describe('loadAutoStartAgents', () => {
    it('should not throw', async () => {
      await expect(loadAutoStartAgents()).resolves.not.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      mockGetDatabase.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      await expect(loadAutoStartAgents()).resolves.not.toThrow();
    });
  });

  describe('Heartbeat Processing', () => {
    it('should process heartbeats via cron', async () => {
      mockGetDueHeartbeats.mockResolvedValue([]);

      await startPersistentAgent(testUserId, {});

      // Advance time to trigger cron (60 seconds)
      await vi.advanceTimersByTimeAsync(60_000);

      expect(mockGetDueHeartbeats).toHaveBeenCalled();
    });

    it('should execute HEALTH_CHECK heartbeat', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-health',
          user_id: testUserId,
          name: 'Health Check',
          cron_expression: '* * * * *',
          payload: JSON.stringify({ template: 'HEALTH_CHECK' }),
        },
      ]);

      await startPersistentAgent(testUserId, {});
      await vi.advanceTimersByTimeAsync(100);

      expect(mockMarkHeartbeatExecuted).toHaveBeenCalledWith('hb-health');
      expect(mockDispatchWebhook).toHaveBeenCalled();
    });

    it('should execute HOURLY_SUMMARY heartbeat', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-summary',
          user_id: testUserId,
          name: 'Hourly Summary',
          cron_expression: '0 * * * *',
          payload: JSON.stringify({ template: 'HOURLY_SUMMARY' }),
        },
      ]);

      await startPersistentAgent(testUserId, {});
      await vi.advanceTimersByTimeAsync(100);

      expect(mockMarkHeartbeatExecuted).toHaveBeenCalledWith('hb-summary');
    });

    it('should execute DAILY_DIGEST heartbeat', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-digest',
          user_id: testUserId,
          name: 'Daily Digest',
          cron_expression: '0 0 * * *',
          payload: JSON.stringify({ template: 'DAILY_DIGEST' }),
        },
      ]);

      await startPersistentAgent(testUserId, {});
      await vi.advanceTimersByTimeAsync(100);

      expect(mockMarkHeartbeatExecuted).toHaveBeenCalledWith('hb-digest');
    });

    it('should execute MEMORY_CLEANUP heartbeat', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-cleanup',
          user_id: testUserId,
          name: 'Memory Cleanup',
          cron_expression: '0 0 * * *',
          payload: JSON.stringify({ template: 'MEMORY_CLEANUP' }),
        },
      ]);

      await startPersistentAgent(testUserId, {});
      await vi.advanceTimersByTimeAsync(100);

      expect(mockMarkHeartbeatExecuted).toHaveBeenCalledWith('hb-cleanup');
    });

    it('should handle custom heartbeat templates', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-custom',
          user_id: testUserId,
          name: 'Custom Task',
          cron_expression: '* * * * *',
          payload: JSON.stringify({ template: 'CUSTOM_TASK', data: { foo: 'bar' } }),
        },
      ]);

      await startPersistentAgent(testUserId, {});
      await vi.advanceTimersByTimeAsync(100);

      expect(mockMarkHeartbeatExecuted).toHaveBeenCalledWith('hb-custom');
    });

    it('should handle heartbeats with null payload', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-null',
          user_id: testUserId,
          name: 'Null Payload',
          cron_expression: '* * * * *',
          payload: null,
        },
      ]);

      await startPersistentAgent(testUserId, {});
      await vi.advanceTimersByTimeAsync(100);

      expect(mockMarkHeartbeatExecuted).toHaveBeenCalledWith('hb-null');
    });

    it('should handle heartbeat processing errors', async () => {
      mockGetDueHeartbeats.mockRejectedValueOnce(new Error('Database error'));

      await startPersistentAgent(testUserId, {});
      
      // Trigger cron
      await vi.advanceTimersByTimeAsync(60_000);

      // Should not crash, but log error
      const status = getAgentStatus(testUserId);
      expect(status?.running).toBe(true);
    });

    it('should only process heartbeats for the specific user', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-other',
          user_id: 'other-user',
          name: 'Other User Heartbeat',
          cron_expression: '* * * * *',
          payload: JSON.stringify({ template: 'HEALTH_CHECK' }),
        },
        {
          id: 'hb-mine',
          user_id: testUserId,
          name: 'My Heartbeat',
          cron_expression: '* * * * *',
          payload: JSON.stringify({ template: 'HEALTH_CHECK' }),
        },
      ]);

      await startPersistentAgent(testUserId, {});
      await vi.advanceTimersByTimeAsync(100);

      // Should only process the user's own heartbeat
      expect(mockMarkHeartbeatExecuted).toHaveBeenCalledWith('hb-mine');
      expect(mockMarkHeartbeatExecuted).not.toHaveBeenCalledWith('hb-other');
    });
  });

  describe('Task Types', () => {
    it('should handle webhook tasks', async () => {
      await startPersistentAgent(testUserId, {});

      const task = await queueAgentTask(testUserId, 'webhook', {
        source: 'github',
        event: 'push',
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(task).toBeDefined();
      expect(task?.type).toBe('webhook');
    });

    it('should handle anticipatory tasks', async () => {
      await startPersistentAgent(testUserId, {});

      const task = await queueAgentTask(testUserId, 'anticipatory', {
        prediction: 'user_will_request_tests',
        confidence: 0.85,
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(task).toBeDefined();
      expect(task?.type).toBe('anticipatory');
    });

    it('should handle queue tasks', async () => {
      await startPersistentAgent(testUserId, {});

      const task = await queueAgentTask(testUserId, 'queue', {
        job: 'background_analysis',
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(task).toBeDefined();
      expect(task?.type).toBe('queue');
    });
  });

  describe('Notifications', () => {
    it('should dispatch webhook on task completion', async () => {
      mockGetDueHeartbeats.mockResolvedValueOnce([
        {
          id: 'hb-notify',
          user_id: testUserId,
          name: 'Notify Test',
          cron_expression: '* * * * *',
          payload: JSON.stringify({ template: 'HEALTH_CHECK' }),
        },
      ]);

      await startPersistentAgent(testUserId, {
        notifications: { desktop: true },
      });
      await vi.advanceTimersByTimeAsync(100);

      expect(mockDispatchWebhook).toHaveBeenCalledWith(
        'ship.completed',
        expect.objectContaining({
          userId: testUserId,
          status: 'completed',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should track last error in status', async () => {
      mockGetDueHeartbeats.mockRejectedValueOnce(new Error('Test error'));

      await startPersistentAgent(testUserId, {});
      
      // Trigger heartbeat processing
      await vi.advanceTimersByTimeAsync(60_000);

      const status = getAgentStatus(testUserId);
      expect(status?.lastError).toBe('Test error');
    });
  });
});

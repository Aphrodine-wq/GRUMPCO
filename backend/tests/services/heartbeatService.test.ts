import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HeartbeatRecord, CreateHeartbeatInput } from '../../src/types/integrations.js';

// Mock the database module
const mockDb = {
  saveHeartbeat: vi.fn(),
  getHeartbeat: vi.fn(),
  getHeartbeatsForUser: vi.fn(),
  getEnabledHeartbeats: vi.fn(),
  deleteHeartbeat: vi.fn(),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock auditLogService
vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
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

// Mock cron-parser
vi.mock('cron-parser', () => ({
  default: {
    parseExpression: vi.fn((expression: string) => {
      if (expression === 'invalid') {
        throw new Error('Invalid cron expression');
      }
      return {
        next: () => ({
          toISOString: () => '2025-01-01T12:00:00.000Z',
        }),
      };
    }),
  },
}));

describe('heartbeatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('createHeartbeat', () => {
    it('should create a heartbeat with valid input', async () => {
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { createHeartbeat } = await import('../../src/services/heartbeatService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const input: CreateHeartbeatInput = {
        userId: 'user_123',
        name: 'Daily Digest',
        cronExpression: '0 9 * * *',
        payload: { type: 'digest', format: 'email' },
      };

      const result = await createHeartbeat(input);

      expect(result.id).toContain('hb_');
      expect(result.user_id).toBe('user_123');
      expect(result.name).toBe('Daily Digest');
      expect(result.cron_expression).toBe('0 9 * * *');
      expect(result.enabled).toBe(true);
      expect(result.payload).toBe(JSON.stringify({ type: 'digest', format: 'email' }));
      expect(result.last_run_at).toBeNull();
      expect(result.next_run_at).toBeDefined();
      expect(mockDb.saveHeartbeat).toHaveBeenCalled();
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'heartbeat.created',
        category: 'automation',
        target: 'Daily Digest',
      }));
    });

    it('should create a heartbeat without payload', async () => {
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { createHeartbeat } = await import('../../src/services/heartbeatService.js');

      const input: CreateHeartbeatInput = {
        userId: 'user_123',
        name: 'Simple Heartbeat',
        cronExpression: '0 * * * *',
      };

      const result = await createHeartbeat(input);

      expect(result.payload).toBeNull();
    });

    it('should use fallback next run time for invalid cron expression', async () => {
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { createHeartbeat } = await import('../../src/services/heartbeatService.js');

      const input: CreateHeartbeatInput = {
        userId: 'user_123',
        name: 'Test',
        cronExpression: 'invalid',
      };

      const result = await createHeartbeat(input);

      // Should still create with fallback time (1 hour from now)
      expect(result.next_run_at).toBeDefined();
    });
  });

  describe('getHeartbeat', () => {
    it('should return heartbeat when found', async () => {
      const heartbeat: HeartbeatRecord = {
        id: 'hb_123',
        user_id: 'user_123',
        name: 'Daily Digest',
        cron_expression: '0 9 * * *',
        enabled: true,
        payload: null,
        last_run_at: null,
        next_run_at: '2025-01-01T09:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getHeartbeat.mockResolvedValue(heartbeat);

      const { getHeartbeat } = await import('../../src/services/heartbeatService.js');

      const result = await getHeartbeat('hb_123');

      expect(result).toEqual(heartbeat);
    });

    it('should return null when not found', async () => {
      mockDb.getHeartbeat.mockResolvedValue(null);

      const { getHeartbeat } = await import('../../src/services/heartbeatService.js');

      const result = await getHeartbeat('hb_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getHeartbeatsForUser', () => {
    it('should return all heartbeats for a user', async () => {
      const heartbeats: HeartbeatRecord[] = [
        {
          id: 'hb_1',
          user_id: 'user_123',
          name: 'Daily Digest',
          cron_expression: '0 9 * * *',
          enabled: true,
          payload: null,
          last_run_at: null,
          next_run_at: '2025-01-01T09:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'hb_2',
          user_id: 'user_123',
          name: 'Hourly Check',
          cron_expression: '0 * * * *',
          enabled: false,
          payload: null,
          last_run_at: null,
          next_run_at: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockDb.getHeartbeatsForUser.mockResolvedValue(heartbeats);

      const { getHeartbeatsForUser } = await import('../../src/services/heartbeatService.js');

      const result = await getHeartbeatsForUser('user_123');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Daily Digest');
      expect(result[1].name).toBe('Hourly Check');
    });

    it('should return empty array when no heartbeats exist', async () => {
      mockDb.getHeartbeatsForUser.mockResolvedValue([]);

      const { getHeartbeatsForUser } = await import('../../src/services/heartbeatService.js');

      const result = await getHeartbeatsForUser('user_123');

      expect(result).toEqual([]);
    });
  });

  describe('getEnabledHeartbeats', () => {
    it('should return all enabled heartbeats', async () => {
      const heartbeats: HeartbeatRecord[] = [
        {
          id: 'hb_1',
          user_id: 'user_123',
          name: 'Enabled One',
          cron_expression: '0 9 * * *',
          enabled: true,
          payload: null,
          last_run_at: null,
          next_run_at: '2025-01-01T09:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockDb.getEnabledHeartbeats.mockResolvedValue(heartbeats);

      const { getEnabledHeartbeats } = await import('../../src/services/heartbeatService.js');

      const result = await getEnabledHeartbeats();

      expect(result).toHaveLength(1);
      expect(result[0].enabled).toBe(true);
    });
  });

  describe('getDueHeartbeats', () => {
    it('should return heartbeats where next_run_at is past', async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 60000).toISOString();
      const futureTime = new Date(now.getTime() + 60000).toISOString();
      
      const heartbeats: HeartbeatRecord[] = [
        {
          id: 'hb_1',
          user_id: 'user_123',
          name: 'Due',
          cron_expression: '0 * * * *',
          enabled: true,
          payload: null,
          last_run_at: null,
          next_run_at: pastTime,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'hb_2',
          user_id: 'user_123',
          name: 'Not Due',
          cron_expression: '0 * * * *',
          enabled: true,
          payload: null,
          last_run_at: null,
          next_run_at: futureTime,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockDb.getEnabledHeartbeats.mockResolvedValue(heartbeats);

      const { getDueHeartbeats } = await import('../../src/services/heartbeatService.js');

      const result = await getDueHeartbeats();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Due');
    });

    it('should include heartbeats with null next_run_at', async () => {
      const heartbeats: HeartbeatRecord[] = [
        {
          id: 'hb_1',
          user_id: 'user_123',
          name: 'No Next Run',
          cron_expression: '0 * * * *',
          enabled: true,
          payload: null,
          last_run_at: null,
          next_run_at: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockDb.getEnabledHeartbeats.mockResolvedValue(heartbeats);

      const { getDueHeartbeats } = await import('../../src/services/heartbeatService.js');

      const result = await getDueHeartbeats();

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no heartbeats are due', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const heartbeats: HeartbeatRecord[] = [
        {
          id: 'hb_1',
          user_id: 'user_123',
          name: 'Future',
          cron_expression: '0 * * * *',
          enabled: true,
          payload: null,
          last_run_at: null,
          next_run_at: futureTime,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockDb.getEnabledHeartbeats.mockResolvedValue(heartbeats);

      const { getDueHeartbeats } = await import('../../src/services/heartbeatService.js');

      const result = await getDueHeartbeats();

      expect(result).toEqual([]);
    });
  });

  describe('markHeartbeatExecuted', () => {
    it('should update last_run_at and next_run_at', async () => {
      const heartbeat: HeartbeatRecord = {
        id: 'hb_123',
        user_id: 'user_123',
        name: 'Test',
        cron_expression: '0 * * * *',
        enabled: true,
        payload: null,
        last_run_at: null,
        next_run_at: '2024-01-01T09:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getHeartbeat.mockResolvedValue(heartbeat);
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { markHeartbeatExecuted } = await import('../../src/services/heartbeatService.js');

      await markHeartbeatExecuted('hb_123');

      expect(mockDb.saveHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'hb_123',
          last_run_at: expect.any(String),
          next_run_at: expect.any(String),
        })
      );
    });

    it('should do nothing when heartbeat not found', async () => {
      mockDb.getHeartbeat.mockResolvedValue(null);

      const { markHeartbeatExecuted } = await import('../../src/services/heartbeatService.js');

      await markHeartbeatExecuted('hb_nonexistent');

      expect(mockDb.saveHeartbeat).not.toHaveBeenCalled();
    });
  });

  describe('setHeartbeatEnabled', () => {
    it('should enable a heartbeat and set next_run_at', async () => {
      const heartbeat: HeartbeatRecord = {
        id: 'hb_123',
        user_id: 'user_123',
        name: 'Test',
        cron_expression: '0 * * * *',
        enabled: false,
        payload: null,
        last_run_at: null,
        next_run_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getHeartbeat.mockResolvedValue(heartbeat);
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { setHeartbeatEnabled } = await import('../../src/services/heartbeatService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await setHeartbeatEnabled('hb_123', true, 'user_123');

      expect(mockDb.saveHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          next_run_at: expect.any(String),
        })
      );
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'heartbeat.enabled',
      }));
    });

    it('should disable a heartbeat and clear next_run_at', async () => {
      const heartbeat: HeartbeatRecord = {
        id: 'hb_123',
        user_id: 'user_123',
        name: 'Test',
        cron_expression: '0 * * * *',
        enabled: true,
        payload: null,
        last_run_at: null,
        next_run_at: '2025-01-01T09:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getHeartbeat.mockResolvedValue(heartbeat);
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { setHeartbeatEnabled } = await import('../../src/services/heartbeatService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await setHeartbeatEnabled('hb_123', false, 'user_123');

      expect(mockDb.saveHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          next_run_at: null,
        })
      );
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'heartbeat.disabled',
      }));
    });

    it('should throw when heartbeat not found', async () => {
      mockDb.getHeartbeat.mockResolvedValue(null);

      const { setHeartbeatEnabled } = await import('../../src/services/heartbeatService.js');

      await expect(setHeartbeatEnabled('hb_nonexistent', true, 'user_123'))
        .rejects.toThrow('Heartbeat not found: hb_nonexistent');
    });
  });

  describe('updateHeartbeatSchedule', () => {
    it('should update cron expression and recalculate next_run_at', async () => {
      const heartbeat: HeartbeatRecord = {
        id: 'hb_123',
        user_id: 'user_123',
        name: 'Test',
        cron_expression: '0 * * * *',
        enabled: true,
        payload: null,
        last_run_at: null,
        next_run_at: '2025-01-01T09:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getHeartbeat.mockResolvedValue(heartbeat);
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { updateHeartbeatSchedule } = await import('../../src/services/heartbeatService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await updateHeartbeatSchedule('hb_123', '0 9 * * *', 'user_123');

      expect(mockDb.saveHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          cron_expression: '0 9 * * *',
          next_run_at: expect.any(String),
        })
      );
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'heartbeat.schedule_updated',
      }));
    });

    it('should set next_run_at to null when disabled', async () => {
      const heartbeat: HeartbeatRecord = {
        id: 'hb_123',
        user_id: 'user_123',
        name: 'Test',
        cron_expression: '0 * * * *',
        enabled: false,
        payload: null,
        last_run_at: null,
        next_run_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getHeartbeat.mockResolvedValue(heartbeat);
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { updateHeartbeatSchedule } = await import('../../src/services/heartbeatService.js');

      await updateHeartbeatSchedule('hb_123', '0 9 * * *', 'user_123');

      expect(mockDb.saveHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          next_run_at: null,
        })
      );
    });

    it('should throw when heartbeat not found', async () => {
      mockDb.getHeartbeat.mockResolvedValue(null);

      const { updateHeartbeatSchedule } = await import('../../src/services/heartbeatService.js');

      await expect(updateHeartbeatSchedule('hb_nonexistent', '0 9 * * *', 'user_123'))
        .rejects.toThrow('Heartbeat not found: hb_nonexistent');
    });

    it('should throw for invalid cron expression', async () => {
      const heartbeat: HeartbeatRecord = {
        id: 'hb_123',
        user_id: 'user_123',
        name: 'Test',
        cron_expression: '0 * * * *',
        enabled: true,
        payload: null,
        last_run_at: null,
        next_run_at: '2025-01-01T09:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getHeartbeat.mockResolvedValue(heartbeat);

      const { updateHeartbeatSchedule } = await import('../../src/services/heartbeatService.js');

      await expect(updateHeartbeatSchedule('hb_123', 'invalid', 'user_123'))
        .rejects.toThrow('Invalid cron expression: invalid');
    });
  });

  describe('deleteHeartbeat', () => {
    it('should delete heartbeat and log audit', async () => {
      const heartbeat: HeartbeatRecord = {
        id: 'hb_123',
        user_id: 'user_123',
        name: 'Test',
        cron_expression: '0 * * * *',
        enabled: true,
        payload: null,
        last_run_at: null,
        next_run_at: '2025-01-01T09:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getHeartbeat.mockResolvedValue(heartbeat);
      mockDb.deleteHeartbeat.mockResolvedValue(undefined);

      const { deleteHeartbeat } = await import('../../src/services/heartbeatService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await deleteHeartbeat('hb_123', 'user_123');

      expect(mockDb.deleteHeartbeat).toHaveBeenCalledWith('hb_123');
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'heartbeat.deleted',
        target: 'Test',
      }));
    });

    it('should do nothing when heartbeat not found', async () => {
      mockDb.getHeartbeat.mockResolvedValue(null);

      const { deleteHeartbeat } = await import('../../src/services/heartbeatService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await deleteHeartbeat('hb_nonexistent', 'user_123');

      expect(mockDb.deleteHeartbeat).not.toHaveBeenCalled();
      expect(writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('HEARTBEAT_TEMPLATES', () => {
    it('should have all expected templates', async () => {
      const { HEARTBEAT_TEMPLATES } = await import('../../src/services/heartbeatService.js');

      expect(HEARTBEAT_TEMPLATES.HOURLY_SUMMARY).toBeDefined();
      expect(HEARTBEAT_TEMPLATES.DAILY_DIGEST).toBeDefined();
      expect(HEARTBEAT_TEMPLATES.WEEKLY_REVIEW).toBeDefined();
      expect(HEARTBEAT_TEMPLATES.HEALTH_CHECK).toBeDefined();
      expect(HEARTBEAT_TEMPLATES.MEMORY_CLEANUP).toBeDefined();
    });

    it('should have valid cron expressions in templates', async () => {
      const { HEARTBEAT_TEMPLATES } = await import('../../src/services/heartbeatService.js');

      expect(HEARTBEAT_TEMPLATES.HOURLY_SUMMARY.cronExpression).toBe('0 * * * *');
      expect(HEARTBEAT_TEMPLATES.DAILY_DIGEST.cronExpression).toBe('0 9 * * *');
      expect(HEARTBEAT_TEMPLATES.WEEKLY_REVIEW.cronExpression).toBe('0 10 * * 1');
      expect(HEARTBEAT_TEMPLATES.HEALTH_CHECK.cronExpression).toBe('*/15 * * * *');
      expect(HEARTBEAT_TEMPLATES.MEMORY_CLEANUP.cronExpression).toBe('0 3 * * *');
    });
  });

  describe('createHeartbeatFromTemplate', () => {
    it('should create heartbeat from template', async () => {
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { createHeartbeatFromTemplate } = await import('../../src/services/heartbeatService.js');

      const result = await createHeartbeatFromTemplate('user_123', 'DAILY_DIGEST');

      expect(result.name).toBe('Daily Digest');
      expect(result.cron_expression).toBe('0 9 * * *');
      expect(JSON.parse(result.payload!)).toEqual(expect.objectContaining({
        template: 'DAILY_DIGEST',
        description: 'Send daily digest of tasks and updates',
      }));
    });

    it('should merge additional payload with template data', async () => {
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { createHeartbeatFromTemplate } = await import('../../src/services/heartbeatService.js');

      const result = await createHeartbeatFromTemplate('user_123', 'HOURLY_SUMMARY', {
        customField: 'customValue',
      });

      const payload = JSON.parse(result.payload!);
      expect(payload.template).toBe('HOURLY_SUMMARY');
      expect(payload.customField).toBe('customValue');
    });

    it('should create heartbeat from HEALTH_CHECK template', async () => {
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { createHeartbeatFromTemplate } = await import('../../src/services/heartbeatService.js');

      const result = await createHeartbeatFromTemplate('user_123', 'HEALTH_CHECK');

      expect(result.name).toBe('System Health Check');
      expect(result.cron_expression).toBe('*/15 * * * *');
    });

    it('should create heartbeat from WEEKLY_REVIEW template', async () => {
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { createHeartbeatFromTemplate } = await import('../../src/services/heartbeatService.js');

      const result = await createHeartbeatFromTemplate('user_123', 'WEEKLY_REVIEW');

      expect(result.name).toBe('Weekly Review');
      expect(result.cron_expression).toBe('0 10 * * 1');
    });

    it('should create heartbeat from MEMORY_CLEANUP template', async () => {
      mockDb.saveHeartbeat.mockResolvedValue(undefined);

      const { createHeartbeatFromTemplate } = await import('../../src/services/heartbeatService.js');

      const result = await createHeartbeatFromTemplate('user_123', 'MEMORY_CLEANUP');

      expect(result.name).toBe('Memory Cleanup');
      expect(result.cron_expression).toBe('0 3 * * *');
    });
  });
});

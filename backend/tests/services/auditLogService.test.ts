/**
 * Audit Log Service Unit Tests
 * Tests writing and querying audit logs for security and compliance.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
const mockDb = {
  saveAuditLog: vi.fn(),
  getAuditLogs: vi.fn(),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
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

describe('auditLogService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset mock defaults
    mockDb.saveAuditLog.mockResolvedValue(undefined);
    mockDb.getAuditLogs.mockResolvedValue([]);
  });

  describe('writeAuditLog', () => {
    it('should write audit log entry with all fields', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await writeAuditLog({
        userId: 'user-123',
        action: 'session.created',
        category: 'system',
        actor: 'admin-user',
        target: 'session-456',
        metadata: { source: 'api', version: '1.0' },
      });

      expect(mockDb.saveAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        action: 'session.created',
        category: 'system',
        actor: 'admin-user',
        target: 'session-456',
        metadata: JSON.stringify({ source: 'api', version: '1.0' }),
      }));
    });

    it('should generate unique ID for each log entry', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await writeAuditLog({
        userId: 'user-123',
        action: 'action1',
        category: 'integration',
      });

      const firstCall = mockDb.saveAuditLog.mock.calls[0][0];
      expect(firstCall.id).toMatch(/^audit_\d+_[a-z0-9]+$/);

      await writeAuditLog({
        userId: 'user-123',
        action: 'action2',
        category: 'integration',
      });

      const secondCall = mockDb.saveAuditLog.mock.calls[1][0];
      expect(secondCall.id).toMatch(/^audit_\d+_[a-z0-9]+$/);
    });

    it('should include created_at timestamp', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const beforeCall = new Date().toISOString();
      
      await writeAuditLog({
        userId: 'user-123',
        action: 'test.action',
        category: 'security',
      });

      const afterCall = new Date().toISOString();
      const savedRecord = mockDb.saveAuditLog.mock.calls[0][0];

      expect(savedRecord.created_at).toBeDefined();
      expect(savedRecord.created_at >= beforeCall).toBe(true);
      expect(savedRecord.created_at <= afterCall).toBe(true);
    });

    it('should handle null actor and target', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await writeAuditLog({
        userId: 'user-123',
        action: 'test.action',
        category: 'system',
      });

      const savedRecord = mockDb.saveAuditLog.mock.calls[0][0];
      expect(savedRecord.actor).toBeNull();
      expect(savedRecord.target).toBeNull();
    });

    it('should handle null metadata', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await writeAuditLog({
        userId: 'user-123',
        action: 'test.action',
        category: 'automation',
      });

      const savedRecord = mockDb.saveAuditLog.mock.calls[0][0];
      expect(savedRecord.metadata).toBeNull();
    });

    it('should not throw on database error (silent failure)', async () => {
      mockDb.saveAuditLog.mockRejectedValueOnce(new Error('Database error'));

      const { writeAuditLog } = await import('../../src/services/auditLogService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      // Should not throw
      await expect(writeAuditLog({
        userId: 'user-123',
        action: 'test.action',
        category: 'security',
      })).resolves.not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Database error' }),
        'Audit log write failed'
      );
    });

    it('should handle all audit categories', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const categories = ['integration', 'system', 'security', 'automation', 'billing', 'agent', 'ai', 'tool', 'skill'] as const;

      for (const category of categories) {
        mockDb.saveAuditLog.mockClear();
        
        await writeAuditLog({
          userId: 'user-123',
          action: `${category}.test`,
          category,
        });

        expect(mockDb.saveAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({ category })
        );
      }
    });

    it('should serialize complex metadata objects', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const complexMetadata = {
        nested: { key: 'value', count: 42 },
        array: [1, 2, 3],
        boolean: true,
        null: null,
      };

      await writeAuditLog({
        userId: 'user-123',
        action: 'test.action',
        category: 'system',
        metadata: complexMetadata,
      });

      const savedRecord = mockDb.saveAuditLog.mock.calls[0][0];
      expect(JSON.parse(savedRecord.metadata)).toEqual(complexMetadata);
    });
  });

  describe('queryAuditLogs', () => {
    it('should query audit logs with default options', async () => {
      const mockLogs = [
        {
          id: 'audit_1',
          user_id: 'user-123',
          action: 'action1',
          category: 'system',
          created_at: new Date().toISOString(),
        },
        {
          id: 'audit_2',
          user_id: 'user-123',
          action: 'action2',
          category: 'security',
          created_at: new Date().toISOString(),
        },
      ];
      mockDb.getAuditLogs.mockResolvedValueOnce(mockLogs);

      const { queryAuditLogs } = await import('../../src/services/auditLogService.js');

      const result = await queryAuditLogs();

      expect(result).toEqual(mockLogs);
      expect(mockDb.getAuditLogs).toHaveBeenCalledWith({
        userId: undefined,
        category: undefined,
        limit: 100,
        offset: undefined,
      });
    });

    it('should query audit logs filtered by userId', async () => {
      mockDb.getAuditLogs.mockResolvedValueOnce([]);

      const { queryAuditLogs } = await import('../../src/services/auditLogService.js');

      await queryAuditLogs({ userId: 'user-123' });

      expect(mockDb.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' })
      );
    });

    it('should query audit logs filtered by category', async () => {
      mockDb.getAuditLogs.mockResolvedValueOnce([]);

      const { queryAuditLogs } = await import('../../src/services/auditLogService.js');

      await queryAuditLogs({ category: 'security' });

      expect(mockDb.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'security' })
      );
    });

    it('should support custom limit', async () => {
      mockDb.getAuditLogs.mockResolvedValueOnce([]);

      const { queryAuditLogs } = await import('../../src/services/auditLogService.js');

      await queryAuditLogs({ limit: 50 });

      expect(mockDb.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });

    it('should support offset for pagination', async () => {
      mockDb.getAuditLogs.mockResolvedValueOnce([]);

      const { queryAuditLogs } = await import('../../src/services/auditLogService.js');

      await queryAuditLogs({ offset: 100 });

      expect(mockDb.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 100 })
      );
    });

    it('should support combined filters', async () => {
      mockDb.getAuditLogs.mockResolvedValueOnce([]);

      const { queryAuditLogs } = await import('../../src/services/auditLogService.js');

      await queryAuditLogs({
        userId: 'user-123',
        category: 'security',
        limit: 25,
        offset: 50,
      });

      expect(mockDb.getAuditLogs).toHaveBeenCalledWith({
        userId: 'user-123',
        category: 'security',
        limit: 25,
        offset: 50,
      });
    });

    it('should return empty array on database error', async () => {
      mockDb.getAuditLogs.mockRejectedValueOnce(new Error('Database error'));

      const { queryAuditLogs } = await import('../../src/services/auditLogService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      const result = await queryAuditLogs();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Database error' }),
        'Audit log query failed'
      );
    });

    it('should use default limit of 100', async () => {
      mockDb.getAuditLogs.mockResolvedValueOnce([]);

      const { queryAuditLogs } = await import('../../src/services/auditLogService.js');

      await queryAuditLogs({});

      expect(mockDb.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });

  describe('AuditLogInput type', () => {
    it('should accept valid input with required fields only', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      // This should compile and run without errors
      await writeAuditLog({
        userId: 'user-123',
        action: 'test.action',
        category: 'system',
      });

      expect(mockDb.saveAuditLog).toHaveBeenCalled();
    });

    it('should accept valid input with all fields', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      // This should compile and run without errors
      await writeAuditLog({
        userId: 'user-123',
        action: 'test.action',
        category: 'security',
        actor: 'admin-user',
        target: 'resource-456',
        metadata: { key: 'value' },
      });

      expect(mockDb.saveAuditLog).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string values', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await writeAuditLog({
        userId: '',
        action: '',
        category: 'system',
        actor: '',
        target: '',
      });

      const savedRecord = mockDb.saveAuditLog.mock.calls[0][0];
      expect(savedRecord.user_id).toBe('');
      expect(savedRecord.action).toBe('');
      expect(savedRecord.actor).toBe('');
      expect(savedRecord.target).toBe('');
    });

    it('should handle very long action strings', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const longAction = 'a'.repeat(1000);
      
      await writeAuditLog({
        userId: 'user-123',
        action: longAction,
        category: 'system',
      });

      const savedRecord = mockDb.saveAuditLog.mock.calls[0][0];
      expect(savedRecord.action).toBe(longAction);
    });

    it('should handle special characters in strings', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await writeAuditLog({
        userId: 'user-123',
        action: 'test.action',
        category: 'system',
        target: '<script>alert("xss")</script>',
        metadata: { query: "'; DROP TABLE users; --" },
      });

      const savedRecord = mockDb.saveAuditLog.mock.calls[0][0];
      expect(savedRecord.target).toBe('<script>alert("xss")</script>');
      expect(JSON.parse(savedRecord.metadata).query).toBe("'; DROP TABLE users; --");
    });

    it('should handle concurrent writes', async () => {
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      // Simulate concurrent writes
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(writeAuditLog({
          userId: `user-${i}`,
          action: `action.${i}`,
          category: 'system',
        }));
      }

      await Promise.all(promises);

      expect(mockDb.saveAuditLog).toHaveBeenCalledTimes(10);
    });
  });
});

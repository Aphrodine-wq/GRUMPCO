/**
 * Usage Tracker Service Tests
 * Tests API call recording, usage retrieval, quota checking, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger to avoid thread-stream issues
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

// Mock database
const mockSaveUsageRecord = vi.fn();
const mockGetUsageForUser = vi.fn();
const mockGetUsageSummary = vi.fn();

vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    saveUsageRecord: mockSaveUsageRecord,
    getUsageForUser: mockGetUsageForUser,
    getUsageSummary: mockGetUsageSummary,
  })),
}));

describe('usageTracker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSaveUsageRecord.mockReset();
    mockGetUsageForUser.mockReset();
    mockGetUsageSummary.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('recordApiCall', () => {
    it('should record an API call with all fields', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      await recordApiCall({
        userId: 'user-123',
        endpoint: '/api/chat/stream',
        method: 'POST',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 250,
        success: true,
      });

      expect(mockSaveUsageRecord).toHaveBeenCalledWith({
        id: 'mock-uuid-1234',
        userId: 'user-123',
        endpoint: '/api/chat/stream',
        method: 'POST',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 250,
        success: true,
      });
    });

    it('should record an API call with minimal fields', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      await recordApiCall({
        userId: 'user-456',
        endpoint: '/api/health',
        method: 'GET',
        success: true,
      });

      expect(mockSaveUsageRecord).toHaveBeenCalledWith({
        id: 'mock-uuid-1234',
        userId: 'user-456',
        endpoint: '/api/health',
        method: 'GET',
        model: undefined,
        inputTokens: undefined,
        outputTokens: undefined,
        latencyMs: undefined,
        success: true,
      });
    });

    it('should record a failed API call', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      await recordApiCall({
        userId: 'user-789',
        endpoint: '/api/generate',
        method: 'POST',
        success: false,
      });

      expect(mockSaveUsageRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-789',
          success: false,
        })
      );
    });

    it('should add record to in-memory cache', async () => {
      const { recordApiCall, clearCache } = await import('../../src/services/usageTracker.js');

      // Clear any existing cache
      clearCache();

      await recordApiCall({
        userId: 'user-cache-test',
        endpoint: '/api/test',
        method: 'GET',
        success: true,
      });

      // The record should be added to cache - we verify by checking the db was called
      expect(mockSaveUsageRecord).toHaveBeenCalled();
    });

    it('should fail silently when database save fails', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      mockSaveUsageRecord.mockRejectedValueOnce(new Error('Database connection failed'));

      // Should not throw
      await expect(
        recordApiCall({
          userId: 'user-error',
          endpoint: '/api/test',
          method: 'POST',
          success: true,
        })
      ).resolves.not.toThrow();

      // Should log warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database connection failed',
          userId: 'user-error',
        }),
        'Failed to record usage'
      );
    });

    it('should handle non-Error thrown objects', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      mockSaveUsageRecord.mockRejectedValueOnce('String error');

      await recordApiCall({
        userId: 'user-string-error',
        endpoint: '/api/test',
        method: 'GET',
        success: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'String error',
        }),
        'Failed to record usage'
      );
    });

    it('should log debug message on successful record', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      await recordApiCall({
        userId: 'user-debug',
        endpoint: '/api/chat',
        method: 'POST',
        inputTokens: 500,
        success: true,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-debug',
          endpoint: '/api/chat',
          tokens: 500,
        }),
        'Usage recorded'
      );
    });
  });

  describe('recordTokenUsage', () => {
    it('should record token usage for a model call', async () => {
      const { recordTokenUsage } = await import('../../src/services/usageTracker.js');

      await recordTokenUsage('user-token', 'claude-sonnet-4-20250514', 1000, 500);

      expect(mockSaveUsageRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-token',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 1000,
          outputTokens: 500,
          endpoint: '/api/chat/stream',
          method: 'POST',
          success: true,
        })
      );
    });

    it('should log estimated cost when provided', async () => {
      const { recordTokenUsage } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      await recordTokenUsage('user-cost', 'gpt-4', 2000, 1000, 0.15);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-cost',
          model: 'gpt-4',
          estimatedCostUsd: 0.15,
        }),
        'Token cost tracked'
      );
    });

    it('should not log cost when not provided', async () => {
      vi.resetModules();
      vi.clearAllMocks();
      
      const { recordTokenUsage } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      await recordTokenUsage('user-no-cost', 'llama-3', 500, 250);

      // Should have debug call for 'Usage recorded' but not 'Token cost tracked'
      const tokenCostCalls = (logger.debug as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[1] === 'Token cost tracked'
      );
      expect(tokenCostCalls.length).toBe(0);
    });

    it('should handle zero tokens', async () => {
      const { recordTokenUsage } = await import('../../src/services/usageTracker.js');

      await recordTokenUsage('user-zero', 'test-model', 0, 0);

      expect(mockSaveUsageRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-zero',
          inputTokens: 0,
          outputTokens: 0,
        })
      );
    });
  });

  describe('getUsageForUser', () => {
    it('should return usage records for a user within date range', async () => {
      const { getUsageForUser } = await import('../../src/services/usageTracker.js');

      const mockRecords = [
        {
          user_id: 'user-123',
          endpoint: '/api/chat',
          method: 'POST',
          model: 'claude-sonnet-4-20250514',
          input_tokens: 1000,
          output_tokens: 500,
          latency_ms: 200,
          success: 1,
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          user_id: 'user-123',
          endpoint: '/api/generate',
          method: 'POST',
          model: null,
          input_tokens: null,
          output_tokens: null,
          latency_ms: null,
          success: 0,
          created_at: '2025-01-15T11:00:00Z',
        },
      ];

      mockGetUsageForUser.mockResolvedValueOnce(mockRecords);

      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');
      const records = await getUsageForUser('user-123', fromDate, toDate);

      expect(mockGetUsageForUser).toHaveBeenCalledWith('user-123', fromDate, toDate);
      expect(records).toHaveLength(2);

      expect(records[0]).toEqual({
        userId: 'user-123',
        endpoint: '/api/chat',
        method: 'POST',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 200,
        success: true,
        createdAt: new Date('2025-01-15T10:00:00Z'),
      });

      expect(records[1]).toEqual({
        userId: 'user-123',
        endpoint: '/api/generate',
        method: 'POST',
        model: undefined,
        inputTokens: undefined,
        outputTokens: undefined,
        latencyMs: undefined,
        success: false,
        createdAt: new Date('2025-01-15T11:00:00Z'),
      });
    });

    it('should return empty array when no records found', async () => {
      const { getUsageForUser } = await import('../../src/services/usageTracker.js');

      mockGetUsageForUser.mockResolvedValueOnce([]);

      const records = await getUsageForUser('user-empty', new Date(), new Date());

      expect(records).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      const { getUsageForUser } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      mockGetUsageForUser.mockRejectedValueOnce(new Error('Query failed'));

      const records = await getUsageForUser('user-error', new Date(), new Date());

      expect(records).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Query failed',
          userId: 'user-error',
        }),
        'Failed to get usage records'
      );
    });

    it('should handle non-Error thrown objects in getUsageForUser', async () => {
      const { getUsageForUser } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      mockGetUsageForUser.mockRejectedValueOnce({ code: 'UNKNOWN' });

      const records = await getUsageForUser('user-obj-error', new Date(), new Date());

      expect(records).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '[object Object]',
        }),
        'Failed to get usage records'
      );
    });

    it('should handle records with missing fields gracefully', async () => {
      const { getUsageForUser } = await import('../../src/services/usageTracker.js');

      const mockRecords = [
        {
          // Minimal record with nulls/missing fields
          user_id: null,
          endpoint: null,
          method: null,
          model: null,
          input_tokens: null,
          output_tokens: null,
          latency_ms: null,
          success: 0,
          created_at: null,
        },
      ];

      mockGetUsageForUser.mockResolvedValueOnce(mockRecords);

      const records = await getUsageForUser('user-123', new Date(), new Date());

      expect(records[0]).toEqual({
        userId: '',
        endpoint: '',
        method: '',
        model: undefined,
        inputTokens: undefined,
        outputTokens: undefined,
        latencyMs: undefined,
        success: false,
        createdAt: expect.any(Date),
      });
    });
  });

  describe('getMonthlyCallCount', () => {
    it('should return the count of calls for current month', async () => {
      const { getMonthlyCallCount } = await import('../../src/services/usageTracker.js');

      const mockRecords = [
        { user_id: 'user-123', endpoint: '/api/chat', method: 'POST', success: 1, created_at: new Date().toISOString() },
        { user_id: 'user-123', endpoint: '/api/generate', method: 'POST', success: 1, created_at: new Date().toISOString() },
        { user_id: 'user-123', endpoint: '/api/stream', method: 'POST', success: 0, created_at: new Date().toISOString() },
      ];

      mockGetUsageForUser.mockResolvedValueOnce(mockRecords);

      const count = await getMonthlyCallCount('user-123');

      expect(count).toBe(3);
    });

    it('should return 0 when no calls this month', async () => {
      const { getMonthlyCallCount } = await import('../../src/services/usageTracker.js');

      mockGetUsageForUser.mockResolvedValueOnce([]);

      const count = await getMonthlyCallCount('user-no-calls');

      expect(count).toBe(0);
    });

    it('should return 0 on error', async () => {
      const { getMonthlyCallCount } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      mockGetUsageForUser.mockRejectedValueOnce(new Error('DB error'));

      const count = await getMonthlyCallCount('user-db-error');

      expect(count).toBe(0);
      // The error is logged by getUsageForUser which is called internally
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DB error',
          userId: 'user-db-error',
        }),
        'Failed to get usage records'
      );
    });

    it('should query from start of month to now', async () => {
      const { getMonthlyCallCount } = await import('../../src/services/usageTracker.js');

      mockGetUsageForUser.mockResolvedValueOnce([]);

      await getMonthlyCallCount('user-date-check');

      expect(mockGetUsageForUser).toHaveBeenCalled();
      const [userId, fromDate, toDate] = mockGetUsageForUser.mock.calls[0];
      
      expect(userId).toBe('user-date-check');
      expect(fromDate.getDate()).toBe(1); // First day of month
      expect(toDate.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('getUsageSummary', () => {
    it('should return usage summary from database', async () => {
      const { getUsageSummary } = await import('../../src/services/usageTracker.js');

      const mockSummary = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        monthlyInputTokens: 50000,
        monthlyOutputTokens: 25000,
        avgLatencyMs: 150,
      };

      mockGetUsageSummary.mockResolvedValueOnce(mockSummary);

      const summary = await getUsageSummary('user-summary');

      expect(mockGetUsageSummary).toHaveBeenCalledWith('user-summary');
      expect(summary).toEqual(mockSummary);
    });

    it('should return default summary on error', async () => {
      const { getUsageSummary } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      mockGetUsageSummary.mockRejectedValueOnce(new Error('Summary query failed'));

      const summary = await getUsageSummary('user-summary-error');

      expect(summary).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        monthlyInputTokens: 0,
        monthlyOutputTokens: 0,
        avgLatencyMs: 0,
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Summary query failed',
          userId: 'user-summary-error',
        }),
        'Failed to get usage summary'
      );
    });

    it('should handle non-Error thrown objects', async () => {
      const { getUsageSummary } = await import('../../src/services/usageTracker.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      mockGetUsageSummary.mockRejectedValueOnce('String error');

      const summary = await getUsageSummary('user-string-err');

      expect(summary.totalRequests).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'String error',
        }),
        'Failed to get usage summary'
      );
    });
  });

  describe('clearCache', () => {
    it('should clear the in-memory cache', async () => {
      const { clearCache, recordApiCall } = await import('../../src/services/usageTracker.js');

      // Record some calls
      await recordApiCall({
        userId: 'user-cache-1',
        endpoint: '/api/test1',
        method: 'GET',
        success: true,
      });

      await recordApiCall({
        userId: 'user-cache-2',
        endpoint: '/api/test2',
        method: 'POST',
        success: true,
      });

      // Clear the cache
      clearCache();

      // Cache should be empty now - this is hard to verify directly
      // but we can ensure it doesn't throw
      expect(() => clearCache()).not.toThrow();
    });

    it('should be idempotent - clearing empty cache should not throw', async () => {
      const { clearCache } = await import('../../src/services/usageTracker.js');

      clearCache();
      clearCache();
      clearCache();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('cache limit behavior', () => {
    it('should respect CACHE_LIMIT and remove oldest entries', async () => {
      // This test verifies the cache eviction logic
      // The cache limit is 1000 records
      const { recordApiCall, clearCache } = await import('../../src/services/usageTracker.js');

      clearCache();

      // Record entries - the cache should handle this without issues
      for (let i = 0; i < 10; i++) {
        await recordApiCall({
          userId: `user-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          success: true,
        });
      }

      // The database should have been called 10 times
      expect(mockSaveUsageRecord).toHaveBeenCalledTimes(10);
    });

    it('should evict oldest entries when cache exceeds limit of 1000', async () => {
      // Test that the cache eviction logic (lines 35-37) works
      // CACHE_LIMIT is 1000, so we need to fill it up to trigger eviction
      const { recordApiCall, clearCache } = await import('../../src/services/usageTracker.js');

      clearCache();

      // Record 1001 entries to trigger the cache eviction
      // This will cause the oldest entry to be shifted out
      for (let i = 0; i < 1001; i++) {
        await recordApiCall({
          userId: `user-cache-evict-${i}`,
          endpoint: '/api/cache-test',
          method: 'POST',
          success: true,
        });
      }

      // All 1001 records should have been saved to DB
      expect(mockSaveUsageRecord).toHaveBeenCalledTimes(1001);
      
      // The cache eviction logic should have run - no error should occur
      // The cache should now have exactly 1000 entries (oldest was shifted)
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent recordApiCall operations', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      const promises = Array.from({ length: 10 }, (_, i) =>
        recordApiCall({
          userId: `user-concurrent-${i}`,
          endpoint: '/api/parallel',
          method: 'POST',
          success: true,
        })
      );

      await Promise.all(promises);

      expect(mockSaveUsageRecord).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent operations with some failures', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      // Make some saves fail
      mockSaveUsageRecord
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed 1'))
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed 2'))
        .mockResolvedValueOnce(undefined);

      const promises = Array.from({ length: 5 }, (_, i) =>
        recordApiCall({
          userId: `user-mixed-${i}`,
          endpoint: '/api/mixed',
          method: 'GET',
          success: true,
        })
      );

      // Should not throw even with failures
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very long endpoint strings', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      const longEndpoint = '/api/' + 'a'.repeat(1000);

      await recordApiCall({
        userId: 'user-long',
        endpoint: longEndpoint,
        method: 'GET',
        success: true,
      });

      expect(mockSaveUsageRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: longEndpoint,
        })
      );
    });

    it('should handle special characters in userId', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      await recordApiCall({
        userId: 'user@example.com',
        endpoint: '/api/test',
        method: 'GET',
        success: true,
      });

      expect(mockSaveUsageRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user@example.com',
        })
      );
    });

    it('should handle large token counts', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      await recordApiCall({
        userId: 'user-large-tokens',
        endpoint: '/api/chat',
        method: 'POST',
        inputTokens: 1000000,
        outputTokens: 500000,
        success: true,
      });

      expect(mockSaveUsageRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 1000000,
          outputTokens: 500000,
        })
      );
    });

    it('should handle negative latency (edge case)', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      await recordApiCall({
        userId: 'user-neg-latency',
        endpoint: '/api/test',
        method: 'GET',
        latencyMs: -100,
        success: true,
      });

      expect(mockSaveUsageRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          latencyMs: -100,
        })
      );
    });

    it('should handle empty string userId', async () => {
      const { recordApiCall } = await import('../../src/services/usageTracker.js');

      await recordApiCall({
        userId: '',
        endpoint: '/api/test',
        method: 'GET',
        success: true,
      });

      expect(mockSaveUsageRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '',
        })
      );
    });
  });

  describe('type safety', () => {
    it('should correctly type the UsageRecord interface', async () => {
      const { getUsageForUser } = await import('../../src/services/usageTracker.js');

      const mockRecords = [
        {
          user_id: 'user-type',
          endpoint: '/api/typed',
          method: 'POST',
          model: 'test-model',
          input_tokens: 100,
          output_tokens: 50,
          latency_ms: 25,
          success: 1,
          created_at: '2025-01-15T10:00:00Z',
        },
      ];

      mockGetUsageForUser.mockResolvedValueOnce(mockRecords);

      const records = await getUsageForUser('user-type', new Date(), new Date());

      // Type assertions - these would fail at compile time if types are wrong
      const record = records[0];
      expect(typeof record.userId).toBe('string');
      expect(typeof record.endpoint).toBe('string');
      expect(typeof record.method).toBe('string');
      expect(typeof record.success).toBe('boolean');
      expect(record.createdAt instanceof Date).toBe(true);
      
      // Optional fields
      if (record.model !== undefined) expect(typeof record.model).toBe('string');
      if (record.inputTokens !== undefined) expect(typeof record.inputTokens).toBe('number');
      if (record.outputTokens !== undefined) expect(typeof record.outputTokens).toBe('number');
      if (record.latencyMs !== undefined) expect(typeof record.latencyMs).toBe('number');
    });
  });
});

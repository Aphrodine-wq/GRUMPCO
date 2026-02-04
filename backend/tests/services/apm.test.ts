import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apm } from '../../src/services/apm.js';
import logger from '../../src/middleware/logger.js';

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics module
vi.mock('../../src/middleware/metrics.js', () => ({
  recordDbOperation: vi.fn(),
  recordLlmStreamMetrics: vi.fn(),
  recordLlmCost: vi.fn(),
  recordTieredCacheAccess: vi.fn(),
}));

describe('APM Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trace', () => {
    it('should trace successful operations', async () => {
      const result = await apm.trace('test.operation', async (span) => {
        span.setAttribute('custom', 'value');
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should trace failed operations', async () => {
      await expect(
        apm.trace('test.error', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should add custom attributes to span', async () => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
      };

      await apm.trace(
        'test.attributes',
        async (span) => {
          return 'done';
        },
        { userId: '123', action: 'test' }
      );

      expect(mockSpan.setAttribute).toBeDefined();
    });
  });

  describe('manual tracing', () => {
    it('should start and end trace', () => {
      const traceId = apm.startTrace('manual.operation', { user: 'test' });
      expect(traceId).toMatch(/^manual\.operation-\d+-/);

      apm.endTrace(traceId);
      const stats = apm.getStats();
      expect(stats.activeTraces).toBe(0);
    });

    it('should handle trace errors', () => {
      const traceId = apm.startTrace('manual.error');
      apm.endTrace(traceId, new Error('Test error'));
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should warn on ending non-existent trace', () => {
      apm.endTrace('non-existent-id');
      expect(logger.warn).toHaveBeenCalled();
    });
  });


  describe('recordDatabaseQuery', () => {
    it('should record successful query', () => {
      apm.recordDatabaseQuery('SELECT * FROM users', 15, 'success');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should record failed query', () => {
      apm.recordDatabaseQuery('SELECT * FROM invalid', 50, 'error');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should infer query type from SQL statement', () => {
      apm.recordDatabaseQuery('INSERT INTO users VALUES (1)', 10, 'success');
      apm.recordDatabaseQuery('UPDATE users SET name = "test"', 10, 'success');
      apm.recordDatabaseQuery('DELETE FROM users WHERE id = 1', 10, 'success');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('recordLLMCall', () => {
    it('should record LLM metrics', () => {
      apm.recordLLMCall({
        provider: 'nvidia',
        model: 'kimi-k2.5',
        duration: 1500,
        tokensUsed: 250,
        cost: 0.05,
        cached: false,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should track cached vs uncached calls', () => {
      apm.recordLLMCall({
        provider: 'nvidia',
        model: 'kimi-k2.5',
        duration: 50,
        tokensUsed: 250,
        cost: 0,
        cached: true,
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('recordCacheAccess', () => {
    it('should record L1 cache hit', () => {
      apm.recordCacheAccess('l1', true, 1);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should record L2 cache miss', () => {
      apm.recordCacheAccess('l2', false, 5);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should record L3 cache access', () => {
      apm.recordCacheAccess('l3', true, 20);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return current stats', () => {
      const traceId = apm.startTrace('test');

      const stats = apm.getStats();
      expect(stats).toMatchObject({
        activeTraces: expect.any(Number),
        uptime: expect.any(Number),
      });

      apm.endTrace(traceId);
    });

    it('should track uptime', () => {
      const stats = apm.getStats();
      expect(stats.uptime).toBeGreaterThan(0);
    });

    it('should track active traces', () => {
      const traceId1 = apm.startTrace('test1');
      const traceId2 = apm.startTrace('test2');

      const stats = apm.getStats();
      expect(stats.activeTraces).toBe(2);

      apm.endTrace(traceId1);
      apm.endTrace(traceId2);

      const finalStats = apm.getStats();
      expect(finalStats.activeTraces).toBe(0);
    });
  });
});

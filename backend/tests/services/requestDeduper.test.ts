/**
 * Request Deduper unit tests
 * Run: npm test -- requestDeduper.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted() for variables referenced in vi.mock() factories
const { mockLogger } = vi.hoisted(() => {
  return {
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

import { requestDeduper, RequestDeduper } from '../../src/services/requestDeduper.js';

describe('requestDeduper', () => {
  beforeEach(() => {
    mockLogger.debug.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('dedupe', () => {
    it('should execute function on first call', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      
      const result = await requestDeduper.dedupe('key1', fn);
      
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent requests with same key', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return `result-${callCount}`;
      });

      // Start two requests simultaneously
      const promise1 = requestDeduper.dedupe('same-key', fn);
      const promise2 = requestDeduper.dedupe('same-key', fn);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same result
      expect(result1).toBe(result2);
      // Function should only be called once
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute different keys separately', async () => {
      const fn1 = vi.fn().mockResolvedValue('result1');
      const fn2 = vi.fn().mockResolvedValue('result2');

      const result1 = await requestDeduper.dedupe('key-a', fn1);
      const result2 = await requestDeduper.dedupe('key-b', fn2);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should allow new request after first completes', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      // First request
      await requestDeduper.dedupe('key', fn);
      
      // Small delay to allow cleanup
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second request with same key
      await requestDeduper.dedupe('key', fn);

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle function errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(requestDeduper.dedupe('error-key', fn)).rejects.toThrow('Test error');

      // Wait for cleanup (100ms after promise resolves/rejects)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be able to retry after error
      const fn2 = vi.fn().mockResolvedValue('success');
      const result = await requestDeduper.dedupe('error-key', fn2);

      expect(result).toBe('success');
    });

    it('should propagate errors to all waiters', async () => {
      const fn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Shared error');
      });

      const promise1 = requestDeduper.dedupe('error-shared', fn);
      const promise2 = requestDeduper.dedupe('error-shared', fn);

      await expect(Promise.all([promise1, promise2])).rejects.toThrow('Shared error');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });


  describe('getStats', () => {
    it('should return zero stats initially', () => {
      // Use a fresh instance to guarantee clean state
      const freshDeduper = new RequestDeduper();
      const stats = freshDeduper.getStats();

      expect(stats.activeRequests).toBe(0);
      expect(stats.keys).toEqual([]);
    });

    it('should track active requests', async () => {
      // Use a fresh instance to guarantee clean state
      const freshDeduper = new RequestDeduper();
      const fn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      });

      // Start request but don't await
      const promise = freshDeduper.dedupe('active-key', fn);

      // Check active requests immediately
      const stats = freshDeduper.getStats();
      expect(stats.activeRequests).toBe(1);
      expect(stats.keys).toContain('active-key');

      await promise;
    });
  });

  describe('getActiveKeys', () => {
    it('should return empty array initially', () => {
      // Use a fresh instance to guarantee clean state
      const freshDeduper = new RequestDeduper();
      const stats = freshDeduper.getStats();
      expect(stats.keys).toEqual([]);
    });

    it('should return active keys', async () => {
      const freshDeduper = new RequestDeduper();
      const fn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      });

      const promise1 = freshDeduper.dedupe('key-1', fn);
      const promise2 = freshDeduper.dedupe('key-2', fn);

      const stats = freshDeduper.getStats();
      expect(stats.keys).toContain('key-1');
      expect(stats.keys).toContain('key-2');

      await Promise.all([promise1, promise2]);
    });
  });

  describe('RequestDeduper instance', () => {
    it('should create instance with custom maxAgeMs', async () => {
      const customDeduper = new RequestDeduper(100); // 100ms max age
      const fn = vi.fn().mockResolvedValue('result');

      await customDeduper.dedupe('custom-key', fn);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should allow new request
      await customDeduper.dedupe('custom-key', fn);
      
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should handle cleanup without errors', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      // Create a request
      await requestDeduper.dedupe('cleanup-key', fn);

      // Wait for cleanup (100ms after promise resolves)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be cleaned up
      const stats = requestDeduper.getStats();
      expect(stats.activeRequests).toBe(0);
    });
  });
});

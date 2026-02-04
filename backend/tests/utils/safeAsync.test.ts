/**
 * Unit tests for safeAsync utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the middleware logger
vi.mock('../../src/middleware/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  logOnError,
  withTimeout,
  retry,
  parallelLimit,
  safeCleanup,
  debounceAsync,
  singleton,
} from '../../src/utils/safeAsync.js';
import { logger } from '../../src/middleware/logger.js';

describe('safeAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('logOnError', () => {
    it('returns the value on success', async () => {
      const promise = Promise.resolve('success');
      const result = await logOnError(promise, 'test operation');
      expect(result).toBe('success');
    });

    it('returns undefined and logs warning on error', async () => {
      const promise = Promise.reject(new Error('test error'));
      const result = await logOnError(promise, 'test operation', { key: 'value' });

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'test error',
          context: 'test operation',
          key: 'value',
        }),
        'test operation failed'
      );
    });

    it('handles non-Error rejections', async () => {
      const promise = Promise.reject('string error');
      const result = await logOnError(promise, 'test operation');

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'string error',
          context: 'test operation',
        }),
        'test operation failed'
      );
    });
  });

  describe('withTimeout', () => {
    it('returns result when promise resolves before timeout', async () => {
      vi.useRealTimers();
      const promise = Promise.resolve('fast result');
      const result = await withTimeout(promise, 1000, 'fast operation');
      expect(result).toBe('fast result');
    });

    it('rejects with timeout error when promise is too slow', async () => {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('slow result'), 5000);
      });

      const resultPromise = withTimeout(slowPromise, 100, 'slow operation');

      vi.advanceTimersByTime(100);

      await expect(resultPromise).rejects.toThrow('slow operation timed out after 100ms');
    });

    it('clears timeout after promise resolves', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = Promise.resolve('result');
      await withTimeout(promise, 1000, 'test');

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('clears timeout after promise rejects', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = Promise.reject(new Error('original error'));

      await expect(withTimeout(promise, 1000, 'test')).rejects.toThrow('original error');
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('returns result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn, { maxAttempts: 3, context: 'test' });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds eventually', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await retry(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        context: 'retry test',
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('throws after max attempts exceeded', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('persistent error'));

      await expect(
        retry(fn, { maxAttempts: 3, baseDelayMs: 10, context: 'failing test' })
      ).rejects.toThrow('persistent error');

      expect(fn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'persistent error',
          attempt: 3,
          maxAttempts: 3,
        }),
        'failing test failed after 3 attempts'
      );
    });

    it('respects shouldRetry callback', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('do not retry'));

      await expect(
        retry(fn, {
          maxAttempts: 5,
          baseDelayMs: 10,
          shouldRetry: () => false,
        })
      ).rejects.toThrow('do not retry');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('uses default options when not provided', async () => {
      const fn = vi.fn().mockResolvedValue('default success');
      const result = await retry(fn);

      expect(result).toBe('default success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('respects maxDelayMs cap', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const start = Date.now();
      await retry(fn, {
        maxAttempts: 2,
        baseDelayMs: 100000, // Would be very long
        maxDelayMs: 50, // Capped at 50ms
      });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200); // Should be quick due to cap
    });

    it('handles non-Error rejections', async () => {
      const fn = vi.fn().mockRejectedValue('string rejection');

      await expect(
        retry(fn, { maxAttempts: 1, context: 'string error test' })
      ).rejects.toBe('string rejection');
    });
  });

  describe('parallelLimit', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('processes all items and returns results in order', async () => {
      const items = [1, 2, 3, 4, 5];
      const fn = vi.fn(async (item: number) => item * 2);

      const results = await parallelLimit(items, fn, 3);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('respects concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const items = [1, 2, 3, 4, 5];
      const fn = async (item: number) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 50));
        concurrent--;
        return item;
      };

      await parallelLimit(items, fn, 2);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('handles empty array', async () => {
      const fn = vi.fn(async (item: number) => item);
      const results = await parallelLimit([], fn, 5);

      expect(results).toEqual([]);
      expect(fn).not.toHaveBeenCalled();
    });

    it('handles array smaller than concurrency limit', async () => {
      const items = [1, 2];
      const fn = vi.fn(async (item: number) => item * 2);

      const results = await parallelLimit(items, fn, 10);

      expect(results).toEqual([2, 4]);
    });

    it('provides correct index to function', async () => {
      const items = ['a', 'b', 'c'];
      const indices: number[] = [];
      const fn = async (item: string, index: number) => {
        indices.push(index);
        return item;
      };

      await parallelLimit(items, fn, 2);

      expect(indices.sort()).toEqual([0, 1, 2]);
    });
  });

  describe('safeCleanup', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('executes sync cleanup function', async () => {
      const cleanup = vi.fn();
      await safeCleanup(cleanup, 'sync cleanup');

      expect(cleanup).toHaveBeenCalled();
    });

    it('executes async cleanup function', async () => {
      const cleanup = vi.fn().mockResolvedValue(undefined);
      await safeCleanup(cleanup, 'async cleanup');

      expect(cleanup).toHaveBeenCalled();
    });

    it('logs warning but does not throw on cleanup error', async () => {
      const cleanup = vi.fn().mockRejectedValue(new Error('cleanup failed'));
      await safeCleanup(cleanup, 'failing cleanup');

      expect(cleanup).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'cleanup failed',
          context: 'failing cleanup',
        }),
        'failing cleanup cleanup failed'
      );
    });

    it('handles non-Error exceptions in cleanup', async () => {
      const cleanup = vi.fn().mockRejectedValue('string error');
      await safeCleanup(cleanup, 'string error cleanup');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'string error',
        }),
        expect.any(String)
      );
    });
  });

  describe('debounceAsync', () => {
    it('delays execution by specified delay', async () => {
      vi.useFakeTimers();
      const fn = vi.fn().mockResolvedValue('result');
      const debounced = debounceAsync(fn, 100);

      const promise = debounced('arg1');

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      await promise;

      expect(fn).toHaveBeenCalledWith('arg1');
    });

    it('only executes last call when called multiple times within delay', async () => {
      vi.useFakeTimers();
      const fn = vi.fn().mockResolvedValue('result');
      const debounced = debounceAsync(fn, 100);

      debounced('first');
      debounced('second');
      const promise = debounced('third');

      vi.advanceTimersByTime(100);
      await promise;

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });

    it('returns undefined when function throws', async () => {
      vi.useFakeTimers();
      const fn = vi.fn().mockRejectedValue(new Error('debounce error'));
      const debounced = debounceAsync(fn, 100);

      const promise = debounced();
      vi.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBeUndefined();
    });

    it('returns result on success', async () => {
      vi.useFakeTimers();
      const fn = vi.fn().mockResolvedValue('success');
      const debounced = debounceAsync(fn, 50);

      const promise = debounced();
      vi.advanceTimersByTime(50);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('singleton', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('returns result from function', async () => {
      const fn = vi.fn().mockResolvedValue('singleton result');
      const singletonFn = singleton(fn);

      const result = await singletonFn('arg');
      expect(result).toBe('singleton result');
    });

    it('only runs one instance at a time', async () => {
      let running = false;
      let concurrentRuns = 0;

      const fn = vi.fn(async () => {
        if (running) concurrentRuns++;
        running = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
        running = false;
        return 'done';
      });

      const singletonFn = singleton(fn);

      const promises = [singletonFn(), singletonFn(), singletonFn()];
      await Promise.all(promises);

      expect(concurrentRuns).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('all concurrent callers receive same result', async () => {
      const fn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'shared result';
      });

      const singletonFn = singleton(fn);

      const results = await Promise.all([singletonFn(), singletonFn(), singletonFn()]);

      expect(results).toEqual(['shared result', 'shared result', 'shared result']);
    });

    it('allows new execution after previous completes', async () => {
      let counter = 0;
      const fn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return ++counter;
      });

      const singletonFn = singleton(fn);

      const first = await singletonFn();
      const second = await singletonFn();

      expect(first).toBe(1);
      expect(second).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('clears pending state on error', async () => {
      let callCount = 0;
      const fn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          throw new Error('first call failed');
        }
        return 'success';
      });

      const singletonFn = singleton(fn);

      await expect(singletonFn()).rejects.toThrow('first call failed');

      const result = await singletonFn();
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

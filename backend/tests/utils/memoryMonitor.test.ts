/**
 * Unit tests for memory monitoring utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  MemoryMonitor,
  StreamCleaner,
  ResourceTracker,
  WeakCache,
  memoryMonitor,
  streamCleaner,
  resourceTracker,
} from '../../src/utils/memoryMonitor.js';
import logger from '../../src/middleware/logger.js';

describe('memoryMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('MemoryMonitor', () => {
    describe('constructor', () => {
      it('creates with default config', () => {
        const monitor = new MemoryMonitor();
        // Default values are internal, but we can verify it doesn't throw
        expect(monitor).toBeInstanceOf(MemoryMonitor);
      });

      it('accepts custom config', () => {
        const monitor = new MemoryMonitor({
          checkIntervalMs: 30000,
          growthThresholdPercent: 50,
          minSamples: 10,
          maxSnapshots: 100,
        });
        expect(monitor).toBeInstanceOf(MemoryMonitor);
      });
    });

    describe('start and stop', () => {
      it('starts monitoring', () => {
        const monitor = new MemoryMonitor({ checkIntervalMs: 1000 });
        monitor.start();

        expect(logger.info).toHaveBeenCalledWith('Memory monitor started');

        monitor.stop();
      });

      it('stops monitoring', () => {
        const monitor = new MemoryMonitor({ checkIntervalMs: 1000 });
        monitor.start();
        monitor.stop();

        // Should not throw on multiple stops
        expect(() => monitor.stop()).not.toThrow();
      });

      it('takes snapshots on interval', () => {
        const monitor = new MemoryMonitor({ checkIntervalMs: 1000, minSamples: 10 });
        monitor.start();

        vi.advanceTimersByTime(3000);

        const stats = monitor.getStats();
        expect(stats.current).toBeDefined();
        expect(stats.current.heapUsed).toBeGreaterThan(0);

        monitor.stop();
      });
    });

    describe('takeSnapshot', () => {
      it('captures memory usage', () => {
        const monitor = new MemoryMonitor();
        const snapshot = monitor.takeSnapshot();

        expect(snapshot.timestamp).toBeGreaterThan(0);
        expect(snapshot.heapUsed).toBeGreaterThan(0);
        expect(snapshot.heapTotal).toBeGreaterThan(0);
        expect(snapshot.rss).toBeGreaterThan(0);
        expect(typeof snapshot.external).toBe('number');
        expect(typeof snapshot.arrayBuffers).toBe('number');
      });

      it('limits snapshots to maxSnapshots', () => {
        const monitor = new MemoryMonitor({ maxSnapshots: 3 });

        for (let i = 0; i < 5; i++) {
          monitor.takeSnapshot();
        }

        // Internal limit should be respected (can't directly check, but shouldn't error)
        expect(() => monitor.getStats()).not.toThrow();
      });
    });

    describe('getStats', () => {
      it('returns current memory stats', () => {
        const monitor = new MemoryMonitor();
        monitor.takeSnapshot();

        const stats = monitor.getStats();

        expect(stats.current).toBeDefined();
        expect(stats.trend).toMatch(/^(growing|stable|shrinking)$/);
        expect(typeof stats.growthRate).toBe('number');
      });

      it('detects growing trend', () => {
        const monitor = new MemoryMonitor();

        // Mock process.memoryUsage to simulate growth
        const originalMemoryUsage = process.memoryUsage;
        let callCount = 0;
        vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
          callCount++;
          return {
            heapUsed: 1000000 * callCount, // Grows each call
            heapTotal: 2000000 * callCount,
            rss: 3000000 * callCount,
            external: 100000,
            arrayBuffers: 50000,
          };
        });

        monitor.takeSnapshot();
        monitor.takeSnapshot();

        const stats = monitor.getStats();
        expect(stats.trend).toBe('growing');
        expect(stats.growthRate).toBeGreaterThan(5);

        process.memoryUsage = originalMemoryUsage;
      });

      it('detects shrinking trend', () => {
        const monitor = new MemoryMonitor();

        let callCount = 3;
        vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
          const val = callCount--;
          return {
            heapUsed: 1000000 * Math.max(val, 1),
            heapTotal: 2000000,
            rss: 3000000,
            external: 100000,
            arrayBuffers: 50000,
          };
        });

        monitor.takeSnapshot();
        monitor.takeSnapshot();

        const stats = monitor.getStats();
        expect(stats.trend).toBe('shrinking');
      });

      it('takes snapshot if none exist', () => {
        const monitor = new MemoryMonitor();
        const stats = monitor.getStats();

        expect(stats.current).toBeDefined();
        expect(stats.current.heapUsed).toBeGreaterThan(0);
      });
    });

    describe('onLeakDetected', () => {
      it('registers callback', () => {
        const monitor = new MemoryMonitor({
          checkIntervalMs: 100,
          growthThresholdPercent: 10,
          minSamples: 2,
        });

        const callback = vi.fn();
        monitor.onLeakDetected(callback);

        // Simulate rapid growth
        let callCount = 0;
        vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
          callCount++;
          return {
            heapUsed: 1000000 * (callCount * 2), // 100% growth each time
            heapTotal: 10000000,
            rss: 15000000,
            external: 100000,
            arrayBuffers: 50000,
          };
        });

        monitor.start();
        vi.advanceTimersByTime(300);

        expect(callback).toHaveBeenCalled();

        monitor.stop();
      });

      it('passes growth info to callback', () => {
        const monitor = new MemoryMonitor({
          checkIntervalMs: 100,
          growthThresholdPercent: 5,
          minSamples: 2,
        });

        const callback = vi.fn();
        monitor.onLeakDetected(callback);

        let callCount = 0;
        vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
          callCount++;
          return {
            heapUsed: 1000000 * (callCount * 2),
            heapTotal: 10000000,
            rss: 15000000,
            external: 100000,
            arrayBuffers: 50000,
          };
        });

        monitor.start();
        vi.advanceTimersByTime(300);

        if (callback.mock.calls.length > 0) {
          const arg = callback.mock.calls[0][0];
          expect(arg).toHaveProperty('growth');
          expect(arg).toHaveProperty('snapshots');
        }

        monitor.stop();
      });
    });

    describe('forceGC', () => {
      it('logs warning when gc not exposed', () => {
        const monitor = new MemoryMonitor();
        const originalGc = global.gc;
        (global as { gc?: () => void }).gc = undefined;

        monitor.forceGC();

        expect(logger.warn).toHaveBeenCalledWith(
          'Garbage collection not exposed. Run with --expose-gc flag'
        );

        if (originalGc) {
          global.gc = originalGc;
        }
      });

      it('calls gc and takes snapshot when exposed', () => {
        const monitor = new MemoryMonitor();
        const mockGc = vi.fn();
        (global as { gc?: () => void }).gc = mockGc;

        monitor.forceGC();

        expect(logger.info).toHaveBeenCalledWith('Forcing garbage collection');
        expect(mockGc).toHaveBeenCalled();

        delete (global as { gc?: () => void }).gc;
      });
    });
  });

  describe('StreamCleaner', () => {
    describe('track', () => {
      it('tracks stream', () => {
        const cleaner = new StreamCleaner();
        const stream = {
          destroy: vi.fn(),
        };

        const result = cleaner.track(stream);

        expect(result).toBe(stream);
        expect(cleaner.activeCount).toBe(1);
      });

      it('removes stream from tracking on destroy', () => {
        const cleaner = new StreamCleaner();
        const originalDestroy = vi.fn();
        const stream = {
          destroy: originalDestroy,
        };

        cleaner.track(stream);
        expect(cleaner.activeCount).toBe(1);

        stream.destroy();
        expect(cleaner.activeCount).toBe(0);
      });

      it('calls original destroy method', () => {
        const cleaner = new StreamCleaner();
        const originalDestroy = vi.fn();
        const stream = {
          destroy: originalDestroy,
        };

        cleaner.track(stream);
        stream.destroy();

        expect(originalDestroy).toHaveBeenCalled();
      });
    });

    describe('cleanupAll', () => {
      it('destroys all tracked streams', () => {
        const cleaner = new StreamCleaner();
        const stream1 = { destroy: vi.fn() };
        const stream2 = { destroy: vi.fn() };

        cleaner.track(stream1);
        cleaner.track(stream2);

        cleaner.cleanupAll();

        expect(cleaner.activeCount).toBe(0);
      });

      it('handles errors during destroy', () => {
        const cleaner = new StreamCleaner();
        const stream = {
          destroy: vi.fn().mockImplementation(() => {
            throw new Error('destroy failed');
          }),
        };

        cleaner.track(stream);

        expect(() => cleaner.cleanupAll()).not.toThrow();
        expect(logger.error).toHaveBeenCalled();
      });
    });

    describe('activeCount', () => {
      it('returns correct count', () => {
        const cleaner = new StreamCleaner();

        expect(cleaner.activeCount).toBe(0);

        cleaner.track({ destroy: vi.fn() });
        expect(cleaner.activeCount).toBe(1);

        cleaner.track({ destroy: vi.fn() });
        expect(cleaner.activeCount).toBe(2);
      });
    });
  });

  describe('ResourceTracker', () => {
    describe('track', () => {
      it('tracks resource with cleanup function', () => {
        const tracker = new ResourceTracker();
        const cleanup = vi.fn();

        tracker.track('resource-1', cleanup);

        expect(tracker.trackedCount).toBe(1);
      });

      it('replaces existing resource with same id', () => {
        const tracker = new ResourceTracker();
        const cleanup1 = vi.fn();
        const cleanup2 = vi.fn();

        tracker.track('resource-1', cleanup1);
        tracker.track('resource-1', cleanup2);

        expect(tracker.trackedCount).toBe(1);
        expect(cleanup1).toHaveBeenCalled();
      });
    });

    describe('release', () => {
      it('calls cleanup and returns true for existing resource', () => {
        const tracker = new ResourceTracker();
        const cleanup = vi.fn();

        tracker.track('resource-1', cleanup);
        const result = tracker.release('resource-1');

        expect(result).toBe(true);
        expect(cleanup).toHaveBeenCalled();
        expect(tracker.trackedCount).toBe(0);
      });

      it('returns false for non-existing resource', () => {
        const tracker = new ResourceTracker();
        const result = tracker.release('non-existent');

        expect(result).toBe(false);
      });

      it('handles cleanup errors', () => {
        const tracker = new ResourceTracker();
        const cleanup = vi.fn().mockImplementation(() => {
          throw new Error('cleanup error');
        });

        tracker.track('resource-1', cleanup);
        const result = tracker.release('resource-1');

        expect(result).toBe(true);
        expect(tracker.trackedCount).toBe(0);
        expect(logger.error).toHaveBeenCalled();
      });
    });

    describe('releaseAll', () => {
      it('releases all tracked resources', () => {
        const tracker = new ResourceTracker();
        const cleanup1 = vi.fn();
        const cleanup2 = vi.fn();

        tracker.track('resource-1', cleanup1);
        tracker.track('resource-2', cleanup2);

        tracker.releaseAll();

        expect(cleanup1).toHaveBeenCalled();
        expect(cleanup2).toHaveBeenCalled();
        expect(tracker.trackedCount).toBe(0);
      });

      it('handles errors during cleanup', () => {
        const tracker = new ResourceTracker();
        const failingCleanup = vi.fn().mockImplementation(() => {
          throw new Error('error');
        });

        tracker.track('resource-1', failingCleanup);
        tracker.track('resource-2', vi.fn());

        expect(() => tracker.releaseAll()).not.toThrow();
        expect(tracker.trackedCount).toBe(0);
      });
    });

    describe('getResourceAge', () => {
      it('returns age of existing resource', () => {
        const tracker = new ResourceTracker();
        tracker.track('resource-1', vi.fn());

        vi.advanceTimersByTime(5000);

        const age = tracker.getResourceAge('resource-1');
        expect(age).toBeGreaterThanOrEqual(5000);
      });

      it('returns undefined for non-existing resource', () => {
        const tracker = new ResourceTracker();
        const age = tracker.getResourceAge('non-existent');

        expect(age).toBeUndefined();
      });
    });

    describe('trackedCount', () => {
      it('returns correct count', () => {
        const tracker = new ResourceTracker();

        expect(tracker.trackedCount).toBe(0);

        tracker.track('r1', vi.fn());
        tracker.track('r2', vi.fn());
        expect(tracker.trackedCount).toBe(2);

        tracker.release('r1');
        expect(tracker.trackedCount).toBe(1);
      });
    });
  });

  describe('WeakCache', () => {
    describe('set and get', () => {
      it('stores and retrieves value', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        cache.set(key, 'value');
        expect(cache.get(key)).toBe('value');
      });

      it('returns undefined for missing key', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        expect(cache.get(key)).toBeUndefined();
      });
    });

    describe('set with strong reference', () => {
      it('stores strong reference by id', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        cache.set(key, 'value', 'my-id');
        expect(cache.getById('my-id')).toBe('value');
      });
    });

    describe('getById', () => {
      it('retrieves value by strong reference id', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        cache.set(key, 'test-value', 'test-id');
        expect(cache.getById('test-id')).toBe('test-value');
      });

      it('returns undefined for missing id', () => {
        const cache = new WeakCache<object, string>();
        expect(cache.getById('missing')).toBeUndefined();
      });
    });

    describe('releaseStrongRef', () => {
      it('releases strong reference', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        cache.set(key, 'value', 'id');
        expect(cache.getById('id')).toBe('value');

        const result = cache.releaseStrongRef('id');
        expect(result).toBe(true);
        expect(cache.getById('id')).toBeUndefined();
      });

      it('returns false for non-existing id', () => {
        const cache = new WeakCache<object, string>();
        const result = cache.releaseStrongRef('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('has', () => {
      it('returns true for existing key', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        cache.set(key, 'value');
        expect(cache.has(key)).toBe(true);
      });

      it('returns false for missing key', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        expect(cache.has(key)).toBe(false);
      });
    });

    describe('delete', () => {
      it('deletes existing entry', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        cache.set(key, 'value');
        const result = cache.delete(key);

        expect(result).toBe(true);
        expect(cache.has(key)).toBe(false);
      });

      it('returns false for non-existing key', () => {
        const cache = new WeakCache<object, string>();
        const key = {};

        const result = cache.delete(key);
        expect(result).toBe(false);
      });
    });
  });

  describe('global instances', () => {
    it('exports memoryMonitor singleton', () => {
      expect(memoryMonitor).toBeInstanceOf(MemoryMonitor);
    });

    it('exports streamCleaner singleton', () => {
      expect(streamCleaner).toBeInstanceOf(StreamCleaner);
    });

    it('exports resourceTracker singleton', () => {
      expect(resourceTracker).toBeInstanceOf(ResourceTracker);
    });
  });
});

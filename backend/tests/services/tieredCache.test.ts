/**
 * Tests for TieredCache service
 * 
 * Run: npm test -- tieredCache.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis before importing TieredCache
vi.mock('../../src/services/redis.js', () => ({
  getRedisClient: vi.fn(() => ({
    getBuffer: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    publish: vi.fn().mockResolvedValue(1),
  })),
  isRedisConnected: vi.fn().mockResolvedValue(false),
  createRedisClient: vi.fn(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock fs for L3 cache
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock metrics
vi.mock('../../src/middleware/metrics.js', () => ({
  recordTieredCacheAccess: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { TieredCache, type CacheStats } from '../../src/services/tieredCache.js';

describe('TieredCache', () => {
  let cache: TieredCache;

  beforeEach(() => {
    cache = new TieredCache({
      l1MaxSize: 100,
      l1TTL: 60000,
      pubsubEnabled: false, // Disable pub/sub for tests
    });
  });

  afterEach(async () => {
    await cache.shutdown();
  });

  describe('Basic operations', () => {
    it('should set and get a value from L1 cache', async () => {
      await cache.set('test', 'key1', { data: 'value1' });
      const result = await cache.get<{ data: string }>('test', 'key1');
      
      expect(result).toEqual({ data: 'value1' });
    });

    it('should return null for missing key', async () => {
      const result = await cache.get('test', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should delete a value', async () => {
      await cache.set('test', 'key1', { data: 'value1' });
      await cache.delete('test', 'key1');
      
      const result = await cache.get('test', 'key1');
      expect(result).toBeNull();
    });

    it('should handle complex objects', async () => {
      const complex = {
        name: 'test',
        nested: { a: 1, b: [1, 2, 3] },
        date: '2024-01-01',
      };
      
      await cache.set('test', 'complex', complex);
      const result = await cache.get<typeof complex>('test', 'complex');
      
      expect(result).toEqual(complex);
    });
  });

  describe('Cache statistics', () => {
    it('should track hits and misses', async () => {
      // Set a value
      await cache.set('stats', 'key1', 'value1');
      
      // Hit
      await cache.get('stats', 'key1');
      await cache.get('stats', 'key1');
      
      // Miss
      await cache.get('stats', 'nonexistent');
      
      const stats = cache.getStats();
      
      expect(stats.l1.hits).toBe(2);
      expect(stats.l1.misses).toBeGreaterThanOrEqual(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should track statistics by namespace', async () => {
      await cache.set('ns1', 'key1', 'value1');
      await cache.set('ns2', 'key1', 'value2');
      
      await cache.get('ns1', 'key1'); // hit
      await cache.get('ns1', 'key1'); // hit
      await cache.get('ns2', 'key1'); // hit
      await cache.get('ns1', 'miss'); // miss
      
      const stats = cache.getStats();
      
      expect(stats.byNamespace?.['ns1']).toBeDefined();
      expect(stats.byNamespace?.['ns1'].hits).toBe(2);
      expect(stats.byNamespace?.['ns1'].misses).toBe(1);
    });

    it('should reset statistics', async () => {
      await cache.set('test', 'key1', 'value1');
      await cache.get('test', 'key1');
      
      cache.resetStats();
      const stats = cache.getStats();
      
      expect(stats.l1.hits).toBe(0);
      expect(stats.l1.misses).toBe(0);
      expect(stats.totalHits).toBe(0);
    });
  });

  describe('Cost-aware eviction', () => {
    it('should track entry metadata', async () => {
      await cache.set('test', 'expensive', { data: 'value' }, undefined, 500);
      await cache.set('test', 'cheap', { data: 'value' }, undefined, 10);
      
      // Access expensive item multiple times
      await cache.get('test', 'expensive');
      await cache.get('test', 'expensive');
      await cache.get('test', 'expensive');
      
      const stats = cache.getStats();
      expect(stats.l1.size).toBe(2);
    });
  });

  describe('Namespace operations', () => {
    it('should clear a namespace', async () => {
      await cache.set('ns1', 'key1', 'value1');
      await cache.set('ns1', 'key2', 'value2');
      await cache.set('ns2', 'key1', 'value3');
      
      await cache.clearNamespace('ns1');
      
      const ns1Key1 = await cache.get('ns1', 'key1');
      const ns1Key2 = await cache.get('ns1', 'key2');
      const ns2Key1 = await cache.get('ns2', 'key1');
      
      expect(ns1Key1).toBeNull();
      expect(ns1Key2).toBeNull();
      expect(ns2Key1).toBe('value3');
    });
  });

  describe('Cache warming', () => {
    it('should warm cache with multiple entries', async () => {
      const entries = [
        { namespace: 'warm', key: 'key1', value: 'value1' },
        { namespace: 'warm', key: 'key2', value: 'value2' },
        { namespace: 'warm', key: 'key3', value: 'value3' },
      ];
      
      await cache.warmCache(entries);
      
      const result1 = await cache.get('warm', 'key1');
      const result2 = await cache.get('warm', 'key2');
      const result3 = await cache.get('warm', 'key3');
      
      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
      expect(result3).toBe('value3');
    });
  });

  describe('Instance ID and invalidation tracking', () => {
    it('should have unique instance ID', () => {
      const cache2 = new TieredCache({ pubsubEnabled: false });
      
      const stats1 = cache.getStats();
      const stats2 = cache2.getStats();
      
      expect(stats1.instanceId).toBeDefined();
      expect(stats2.instanceId).toBeDefined();
      expect(stats1.instanceId).not.toBe(stats2.instanceId);
      
      cache2.shutdown();
    });

    it('should track invalidation events', async () => {
      await cache.set('test', 'key1', 'value1');
      await cache.delete('test', 'key1');
      
      const stats = cache.getStats();
      // Invalidations sent is tracked (even if pub/sub disabled, the counter is updated)
      expect(stats.invalidations).toBeDefined();
    });
  });
});

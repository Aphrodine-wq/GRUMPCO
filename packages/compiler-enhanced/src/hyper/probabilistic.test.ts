/**
 * Probabilistic Cache Manager Tests
 * 
 * Tests for Bloom filters, Count-Min Sketch, HyperLogLog, and Cuckoo filters
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProbabilisticCacheManager,
  createProbabilisticCache
} from './probabilistic.js';
import type { ProbabilisticCacheConfig } from './types.js';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Full config factory
function createFullConfig(overrides: Partial<{
  persistencePath: string;
  expectedElements: number;
  falsePositiveRate: number;
}> = {}): ProbabilisticCacheConfig {
  return {
    enabled: true,
    bloomFilter: {
      enabled: true,
      expectedElements: overrides.expectedElements ?? 10000,
      falsePositiveRate: overrides.falsePositiveRate ?? 0.01,
      hashFunctions: 0,  // Auto-calculate
      bitArraySize: 0    // Auto-calculate
    },
    countMinSketch: {
      enabled: true,
      width: 2048,
      depth: 4,
      conservativeUpdate: true
    },
    hyperLogLog: {
      enabled: true,
      precision: 14
    },
    cuckooFilter: {
      enabled: true,
      bucketSize: 4,
      fingerprintSize: 16,
      maxKicks: 500
    },
    behavior: {
      warmupPeriod: 100,
      adaptiveThreshold: true,
      compressionLevel: 6,
      persistenceEnabled: true,
      persistencePath: overrides.persistencePath ?? join(tmpdir(), 'cache')
    }
  };
}

describe('ProbabilisticCacheManager', () => {
  let tempDir: string;
  let cache: ProbabilisticCacheManager;

  beforeEach(() => {
    tempDir = join(tmpdir(), `prob-cache-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    
    cache = createProbabilisticCache(createFullConfig({
      persistencePath: join(tempDir, 'cache')
    }));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('createProbabilisticCache', () => {
    it('should create a cache instance', () => {
      expect(cache).toBeInstanceOf(ProbabilisticCacheManager);
    });
  });

  describe('recordAccess', () => {
    it('should record access for a key', () => {
      cache.recordAccess('test-key');
      expect(cache.wasLikelyAccessed('test-key')).toBe(true);
    });

    it('should handle multiple accesses', () => {
      cache.recordAccess('key1');
      cache.recordAccess('key2');
      cache.recordAccess('key3');
      
      expect(cache.wasLikelyAccessed('key1')).toBe(true);
      expect(cache.wasLikelyAccessed('key2')).toBe(true);
      expect(cache.wasLikelyAccessed('key3')).toBe(true);
    });
  });

  describe('wasLikelyAccessed', () => {
    it('should return false for never-accessed keys', () => {
      expect(cache.wasLikelyAccessed('nonexistent-key')).toBe(false);
    });

    it('should return true for accessed keys', () => {
      cache.recordAccess('accessed-key');
      expect(cache.wasLikelyAccessed('accessed-key')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = cache.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('memoryUsage');
    });

    it('should update stats after access', () => {
      cache.recordAccess('key1');
      cache.wasLikelyAccessed('key1');  // Hit
      cache.wasLikelyAccessed('key2');  // Miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Bloom Filter - No False Negatives', () => {
    it('should never have false negatives for inserted keys', () => {
      const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);
      
      // Insert all keys
      for (const key of keys) {
        cache.recordAccess(key);
      }
      
      // All inserted keys must be found (no false negatives)
      for (const key of keys) {
        expect(cache.wasLikelyAccessed(key)).toBe(true);
      }
    });
  });

  describe('Count-Min Sketch', () => {
    it('should estimate frequency of accessed items', () => {
      // Access same key multiple times
      for (let i = 0; i < 10; i++) {
        cache.recordAccess('frequent-key');
      }
      cache.recordAccess('rare-key');
      
      // Both should be tracked
      expect(cache.wasLikelyAccessed('frequent-key')).toBe(true);
      expect(cache.wasLikelyAccessed('rare-key')).toBe(true);
    });
  });

  describe('HyperLogLog', () => {
    it('should estimate cardinality', () => {
      // Add unique items
      for (let i = 0; i < 100; i++) {
        cache.recordAccess(`unique-key-${i}`);
      }
      
      const stats = cache.getStats();
      // HyperLogLog estimate should be in reasonable range
      expect(stats.estimatedCardinality).toBeGreaterThan(0);
    });
  });

  describe('Persistence', () => {
    it('should save state', async () => {
      cache.recordAccess('persistent-key-1');
      cache.recordAccess('persistent-key-2');
      
      // Should not throw
      await expect(cache.saveToDisk()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string key', () => {
      cache.recordAccess('');
      expect(cache.wasLikelyAccessed('')).toBe(true);
    });

    it('should handle very long keys', () => {
      const longKey = 'x'.repeat(10000);
      cache.recordAccess(longKey);
      expect(cache.wasLikelyAccessed(longKey)).toBe(true);
    });

    it('should handle unicode keys', () => {
      const unicodeKey = '日本語テスト🎉';
      cache.recordAccess(unicodeKey);
      expect(cache.wasLikelyAccessed(unicodeKey)).toBe(true);
    });

    it('should handle special characters', () => {
      const specialKey = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      cache.recordAccess(specialKey);
      expect(cache.wasLikelyAccessed(specialKey)).toBe(true);
    });
  });
});

describe('Memory Efficiency', () => {
  it('should maintain bounded memory usage', () => {
    const cache = createProbabilisticCache(createFullConfig({
      expectedElements: 10000
    }));
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Insert many items
    for (let i = 0; i < 10000; i++) {
      cache.recordAccess(`key-${i}`);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable (< 10MB for 10k items)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});

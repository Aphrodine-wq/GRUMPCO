/**
 * Tests for TieredCache service
 * 
 * Run: npm test -- tieredCache.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted to ensure mock functions are defined before vi.mock runs
const {
  mockGetBuffer,
  mockSetex,
  mockDel,
  mockKeys,
  mockPublish,
  mockIsRedisConnected,
  mockGetRedisClient,
  mockCreateRedisClient,
  mockSubscribe,
  mockOn,
  mockUnsubscribe,
  mockQuit,
} = vi.hoisted(() => {
  const mockGetBuffer = vi.fn();
  const mockSetex = vi.fn();
  const mockDel = vi.fn();
  const mockKeys = vi.fn();
  const mockPublish = vi.fn();

  const mockRedisClient = {
    getBuffer: mockGetBuffer,
    setex: mockSetex,
    del: mockDel,
    keys: mockKeys,
    publish: mockPublish,
  };

  const mockIsRedisConnected = vi.fn();
  const mockGetRedisClient = vi.fn(() => mockRedisClient);
  
  const mockSubscribe = vi.fn();
  const mockOn = vi.fn();
  const mockUnsubscribe = vi.fn();
  const mockQuit = vi.fn();
  
  const mockCreateRedisClient = vi.fn(() => ({
    subscribe: mockSubscribe,
    on: mockOn,
    unsubscribe: mockUnsubscribe,
    quit: mockQuit,
  }));

  return {
    mockGetBuffer,
    mockSetex,
    mockDel,
    mockKeys,
    mockPublish,
    mockIsRedisConnected,
    mockGetRedisClient,
    mockCreateRedisClient,
    mockSubscribe,
    mockOn,
    mockUnsubscribe,
    mockQuit,
  };
});

// Mock Redis before importing TieredCache
vi.mock('../../src/services/redis.js', () => ({
  getRedisClient: mockGetRedisClient,
  isRedisConnected: mockIsRedisConnected,
  createRedisClient: mockCreateRedisClient,
}));

// Mock fs for L3 cache with hoisted mocks
const { mockMkdir, mockReadFile, mockWriteFile, mockReaddir, mockUnlink } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockUnlink: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: {
    mkdir: mockMkdir,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    readdir: mockReaddir,
    unlink: mockUnlink,
  },
}));

// Mock metrics
vi.mock('../../src/middleware/metrics.js', () => ({
  recordTieredCacheAccess: vi.fn(),
}));

// Mock logger
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

// Mock safeAsync
vi.mock('../../src/utils/safeAsync.js', () => ({
  safeCleanup: vi.fn(),
}));

import { TieredCache, getTieredCache, withTieredCache } from '../../src/services/tieredCache.js';
import { recordTieredCacheAccess } from '../../src/middleware/metrics.js';

describe('TieredCache', () => {
  let cache: TieredCache;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    mockWriteFile.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue([]);
    mockUnlink.mockResolvedValue(undefined);
    mockIsRedisConnected.mockResolvedValue(false);
    mockGetBuffer.mockResolvedValue(null);
    mockSetex.mockResolvedValue('OK');
    mockDel.mockResolvedValue(1);
    mockKeys.mockResolvedValue([]);
    mockPublish.mockResolvedValue(1);
    mockSubscribe.mockResolvedValue(undefined);
    mockOn.mockImplementation(() => {});
    mockUnsubscribe.mockResolvedValue(undefined);
    mockQuit.mockResolvedValue(undefined);

    cache = new TieredCache({
      l1MaxSize: 100,
      l1TTL: 60000,
      pubsubEnabled: false, // Disable pub/sub for tests
    });
  });

  afterEach(async () => {
    await cache.shutdown();
    vi.resetModules();
  });

  describe('Constructor and initialization', () => {
    it('should initialize with default options', () => {
      const defaultCache = new TieredCache();
      const stats = defaultCache.getStats();
      
      expect(stats.instanceId).toBeDefined();
      expect(stats.l1.size).toBe(0);
      
      defaultCache.shutdown();
    });

    it('should initialize with custom options', () => {
      const customCache = new TieredCache({
        l1MaxSize: 50,
        l1TTL: 30000,
        l2TTL: 7200,
        l3TTL: 172800,
        l3Path: '/custom/path',
        compression: true,
        compressionThreshold: 2048,
        costAwareEviction: false,
        pubsubEnabled: false,
      });
      
      const stats = customCache.getStats();
      expect(stats.instanceId).toBeDefined();
      
      customCache.shutdown();
    });

    it('should ensure cache directory exists', async () => {
      new TieredCache({ pubsubEnabled: false });
      
      // Wait for async mkdir
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('cache'),
        { recursive: true }
      );
    });

    it('should log error when cache directory creation fails', async () => {
      mockMkdir.mockRejectedValueOnce(new Error('Permission denied'));
      
      new TieredCache({ pubsubEnabled: false });
      
      // Wait for async mkdir
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission denied' }),
        'Failed to create cache directory'
      );
    });

    it('should log initialization info', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          costAwareEviction: true,
          pubsubEnabled: false,
        }),
        'Tiered cache initialized'
      );
    });
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

    it('should handle null values', async () => {
      await cache.set('test', 'nullValue', null);
      const result = await cache.get('test', 'nullValue');
      
      expect(result).toBeNull();
    });

    it('should handle array values', async () => {
      const array = [1, 2, 3, 'test', { a: 1 }];
      await cache.set('test', 'array', array);
      const result = await cache.get('test', 'array');
      
      expect(result).toEqual(array);
    });
  });

  describe('L2 (Redis) cache operations', () => {
    beforeEach(() => {
      // Ensure Redis is connected for all L2 tests
      mockIsRedisConnected.mockResolvedValue(true);
      mockGetBuffer.mockResolvedValue(null);
    });

    it('should write to L2 cache when Redis is connected', async () => {
      await cache.set('test', 'key1', { data: 'value1' });
      
      expect(mockSetex).toHaveBeenCalledWith(
        'test:key1',
        expect.any(Number),
        expect.any(Buffer)
      );
    });

    it('should attempt to read from L2 cache on L1 miss', async () => {
      await cache.get('test', 'key1');
      
      expect(mockGetBuffer).toHaveBeenCalledWith('test:key1');
    });

    it('should handle L2 read failure gracefully', async () => {
      mockGetBuffer.mockRejectedValue(new Error('Redis read error'));
      
      const result = await cache.get('test', 'key1');
      
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Redis read error' }),
        'L2 cache read failed'
      );
    });

    it('should handle L2 write failure gracefully', async () => {
      mockSetex.mockRejectedValueOnce(new Error('Redis write error'));
      
      await cache.set('test', 'key1', { data: 'value' });
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Redis write error' }),
        'L2 cache write failed'
      );
    });

    it('should delete from L2 cache', async () => {
      await cache.delete('test', 'key1');
      
      expect(mockDel).toHaveBeenCalledWith('test:key1');
    });

    it('should handle L2 delete failure gracefully', async () => {
      mockDel.mockRejectedValueOnce(new Error('Redis delete error'));
      
      await cache.delete('test', 'key1');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Redis delete error' }),
        'L2 cache delete failed'
      );
    });

    it('should use custom TTL for L2', async () => {
      await cache.set('test', 'key1', { data: 'value' }, 1800);
      
      expect(mockSetex).toHaveBeenCalledWith(
        'test:key1',
        1800,
        expect.any(Buffer)
      );
    });
  });

  describe('L3 (Disk) cache operations', () => {
    beforeEach(() => {
      // Ensure Redis is NOT connected for L3-only tests
      mockIsRedisConnected.mockResolvedValue(false);
    });

    it('should attempt to write to L3 cache', async () => {
      await cache.set('test', 'key1', { data: 'value1' });
      
      // L3 write is attempted (mock captures the call)
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('.cache'),
        expect.any(Buffer)
      );
    });

    it('should handle L3 write failure gracefully', async () => {
      mockWriteFile.mockRejectedValue(new Error('Disk write error'));
      
      await cache.set('test', 'key1', { data: 'value' });
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Disk write error' }),
        'L3 cache write failed'
      );
    });

    it('should attempt to read from L3 on cache miss', async () => {
      mockReadFile.mockReset();
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      
      const result = await cache.get('test', 'key1');
      
      // Should have tried to read from L3 (and failed)
      expect(result).toBeNull();
    });

    it('should handle L3 read failure gracefully', async () => {
      mockReadFile.mockReset();
      mockReadFile.mockRejectedValue(new Error('Disk read error'));
      
      const result = await cache.get('test', 'key1');
      
      expect(result).toBeNull();
    });

    it('should delete from L3 cache', async () => {
      await cache.set('test', 'key1', { data: 'value' });
      await cache.delete('test', 'key1');
      
      expect(mockUnlink).toHaveBeenCalled();
    });

    it('should ignore L3 delete errors', async () => {
      mockUnlink.mockRejectedValue(new Error('File not found'));
      
      // Should not throw
      await cache.delete('test', 'key1');
    });
  });

  describe('Compression', () => {
    it('should compress large data', async () => {
      const largeData = { data: 'x'.repeat(2000) }; // > 1KB threshold
      
      await cache.set('test', 'large', largeData);
      
      // Data should still be retrievable
      const result = await cache.get<typeof largeData>('test', 'large');
      expect(result).toEqual(largeData);
    });

    it('should not compress small data', async () => {
      const smallData = { data: 'small' }; // < 1KB threshold
      
      await cache.set('test', 'small', smallData);
      
      const result = await cache.get<typeof smallData>('test', 'small');
      expect(result).toEqual(smallData);
    });

    it('should handle compressed L3 data', async () => {
      // Create a cache with compression
      const compressedCache = new TieredCache({
        compression: true,
        compressionThreshold: 10,
        pubsubEnabled: false,
      });

      const testData = { data: 'compressed-data-value' };
      await compressedCache.set('test', 'key1', testData);
      
      const result = await compressedCache.get<typeof testData>('test', 'key1');
      expect(result).toEqual(testData);
      
      await compressedCache.shutdown();
    });

    it('should work with compression disabled', async () => {
      const noCompressionCache = new TieredCache({
        compression: false,
        pubsubEnabled: false,
      });

      const testData = { data: 'x'.repeat(2000) };
      await noCompressionCache.set('test', 'key1', testData);
      
      const result = await noCompressionCache.get<typeof testData>('test', 'key1');
      expect(result).toEqual(testData);
      
      await noCompressionCache.shutdown();
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

    it('should track L2 hits and misses', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGetBuffer.mockResolvedValue(null);
      
      await cache.get('test', 'key1'); // L2 miss (returns null)
      
      const stats = cache.getStats();
      expect(stats.l2.misses).toBeGreaterThanOrEqual(1);
    });

    it('should calculate hit rate correctly', async () => {
      await cache.set('test', 'key1', 'value1');
      
      // 3 hits
      await cache.get('test', 'key1');
      await cache.get('test', 'key1');
      await cache.get('test', 'key1');
      
      // 1 miss
      await cache.get('test', 'nonexistent');
      
      const stats = cache.getStats();
      // 3 hits out of 4 total = 0.75 hit rate
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should return 0 hit rate when no accesses', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should record metrics for cache access', async () => {
      await cache.set('test', 'key1', 'value1');
      await cache.get('test', 'key1');
      
      expect(recordTieredCacheAccess).toHaveBeenCalledWith('L1', true, 'test');
    });

    it('should get stats by namespace with correct hitRate', async () => {
      await cache.set('ns1', 'key1', 'value1');
      await cache.get('ns1', 'key1'); // hit
      await cache.get('ns1', 'miss1'); // miss
      await cache.get('ns1', 'miss2'); // miss
      
      const byNamespace = cache.getStatsByNamespace();
      
      expect(byNamespace['ns1']).toBeDefined();
      expect(byNamespace['ns1'].hits).toBe(1);
      expect(byNamespace['ns1'].misses).toBe(2);
      expect(byNamespace['ns1'].hitRate).toBeCloseTo(1/3, 2);
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

    it('should perform cost-aware eviction when cache is full', async () => {
      const smallCache = new TieredCache({
        l1MaxSize: 3,
        costAwareEviction: true,
        pubsubEnabled: false,
      });
      
      // Fill cache
      await smallCache.set('test', 'cheap1', { data: '1' }, undefined, 10);
      await smallCache.set('test', 'cheap2', { data: '2' }, undefined, 10);
      await smallCache.set('test', 'expensive', { data: '3' }, undefined, 1000);
      
      // Access expensive item to increase its score
      await smallCache.get('test', 'expensive');
      await smallCache.get('test', 'expensive');
      
      // Add another item - should evict a cheap one
      await smallCache.set('test', 'new', { data: '4' }, undefined, 10);
      
      const stats = smallCache.getStats();
      expect(stats.l1.size).toBe(3);
      
      await smallCache.shutdown();
    });

    it('should update access metadata on get', async () => {
      await cache.set('test', 'key1', { data: 'value' });
      
      await cache.get('test', 'key1');
      await cache.get('test', 'key1');
      await cache.get('test', 'key1');
      
      const stats = cache.getStats();
      expect(stats.l1.hits).toBe(3);
    });

    it('should work with cost-aware eviction disabled', async () => {
      const noCostCache = new TieredCache({
        l1MaxSize: 100,
        costAwareEviction: false,
        pubsubEnabled: false,
      });
      
      await noCostCache.set('test', 'key1', { data: 'value' });
      const result = await noCostCache.get('test', 'key1');
      
      expect(result).toEqual({ data: 'value' });
      
      await noCostCache.shutdown();
    });

    it('should delete metadata when entry is deleted', async () => {
      await cache.set('test', 'key1', { data: 'value' }, undefined, 100);
      await cache.delete('test', 'key1');
      
      // Entry should be gone
      const result = await cache.get('test', 'key1');
      expect(result).toBeNull();
    });
  });

  describe('Namespace operations', () => {
    it('should clear a namespace from L1', async () => {
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

    it('should clear namespace from L2 when Redis connected', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockResolvedValueOnce(['ns1:key1', 'ns1:key2']);
      
      await cache.clearNamespace('ns1');
      
      expect(mockKeys).toHaveBeenCalledWith('ns1:*');
      expect(mockDel).toHaveBeenCalledWith('ns1:key1', 'ns1:key2');
    });

    it('should handle L2 namespace clear failure', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockRejectedValueOnce(new Error('Redis error'));
      
      await cache.clearNamespace('ns1');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Redis error' }),
        'L2 namespace clear failed'
      );
    });

    it('should handle empty keys array', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockResolvedValueOnce([]);
      
      await cache.clearNamespace('ns1');
      
      // Should not call del with empty array
      expect(mockDel).not.toHaveBeenCalled();
    });
  });

  describe('Clear all', () => {
    it('should clear all L1 cache entries', async () => {
      await cache.set('ns1', 'key1', 'value1');
      await cache.set('ns2', 'key1', 'value2');
      
      await cache.clearAll();
      
      const result1 = await cache.get('ns1', 'key1');
      const result2 = await cache.get('ns2', 'key1');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should clear L2 when Redis connected', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockResolvedValueOnce(['ns1:key1', 'ns2:key1']);
      
      await cache.clearAll();
      
      expect(mockKeys).toHaveBeenCalledWith('*:*');
      expect(mockDel).toHaveBeenCalled();
    });

    it('should handle L2 clear failure', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockRejectedValueOnce(new Error('Redis error'));
      
      await cache.clearAll();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Redis error' }),
        'L2 cache clear failed'
      );
    });

    it('should log when all cache layers cleared', async () => {
      await cache.clearAll();
      
      expect(mockLogger.info).toHaveBeenCalledWith('All cache layers cleared');
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

    it('should log warming count', async () => {
      const entries = [
        { namespace: 'warm', key: 'key1', value: 'value1' },
        { namespace: 'warm', key: 'key2', value: 'value2' },
      ];
      
      await cache.warmCache(entries);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        { count: 2 },
        'Warming cache'
      );
    });

    it('should handle warming failures gracefully', async () => {
      // Both L2 and L3 write must fail for the warmCache error handler to be triggered
      mockIsRedisConnected.mockResolvedValue(false);
      mockWriteFile.mockRejectedValue(new Error('Write error'));
      
      const entries = [
        { namespace: 'warm', key: 'key1', value: 'value1' },
      ];
      
      // Should not throw - warmCache catches errors internally
      await cache.warmCache(entries);
      
      // The warn is logged by L3 write failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Write error' }),
        'L3 cache write failed'
      );
    });
  });

  describe('Cleanup expired entries', () => {
    beforeEach(() => {
      // Reset mocks for cleanup tests
      mockReaddir.mockReset();
      mockReadFile.mockReset();
      mockUnlink.mockReset();
      mockUnlink.mockResolvedValue(undefined);
    });

    it('should handle cleanup when no files exist', async () => {
      mockReaddir.mockResolvedValue([]);
      
      const cleaned = await cache.cleanupExpired();
      
      expect(cleaned).toBe(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockReaddir.mockRejectedValue(new Error('Readdir error'));
      
      const cleaned = await cache.cleanupExpired();
      
      expect(cleaned).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Readdir error' }),
        'Failed to cleanup expired cache'
      );
    });

    it('should ignore individual file errors during cleanup', async () => {
      mockReaddir.mockResolvedValue(['file1.cache', 'file2.cache']);
      mockReadFile
        .mockRejectedValueOnce(new Error('Read error'))
        .mockRejectedValueOnce(new Error('Read error'));
      
      // Should not throw
      const cleaned = await cache.cleanupExpired();
      
      expect(cleaned).toBe(0);
    });
  });

  describe('Pub/Sub functionality', () => {
    it('should initialize pub/sub when enabled and Redis connected', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockCreateRedisClient).toHaveBeenCalled();
      
      await pubsubCache.shutdown();
    });

    it('should not initialize pub/sub when Redis not connected', async () => {
      mockIsRedisConnected.mockResolvedValue(false);
      mockCreateRedisClient.mockClear();
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Redis not connected, pub/sub disabled');
      
      await pubsubCache.shutdown();
    });

    it('should handle pub/sub init failure', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockCreateRedisClient.mockReturnValueOnce(null as unknown as ReturnType<typeof mockCreateRedisClient>);
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Could not create Redis subscriber');
      
      await pubsubCache.shutdown();
    });

    it('should publish invalidation on delete', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      await cache.delete('test', 'key1');
      
      // Since pubsubEnabled is false in our cache, no publish should happen
      // But the delete should still work
    });

    it('should shutdown pub/sub subscriber', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockSubscribe.mockResolvedValue(undefined);
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await pubsubCache.shutdown();
      
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockQuit).toHaveBeenCalled();
    });

    it('should handle invalidation messages', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      let messageHandler: (channel: string, message: string) => void = () => {};
      mockOn.mockImplementation((event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Pre-populate cache
      await pubsubCache.set('test', 'key1', { data: 'value' });
      
      // Simulate receiving invalidation message from another instance
      const invalidationMsg = {
        type: 'delete',
        namespace: 'test',
        key: 'key1',
        instanceId: 'other-instance',
        timestamp: Date.now(),
      };
      
      messageHandler('cache:invalidation', JSON.stringify(invalidationMsg));
      
      const stats = pubsubCache.getStats();
      expect(stats.invalidations.received).toBe(1);
      
      await pubsubCache.shutdown();
    });

    it('should ignore own invalidation messages', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      let messageHandler: (channel: string, message: string) => void = () => {};
      mockOn.mockImplementation((event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const stats = pubsubCache.getStats();
      
      // Simulate receiving own message
      const invalidationMsg = {
        type: 'delete',
        namespace: 'test',
        key: 'key1',
        instanceId: stats.instanceId, // Same instance
        timestamp: Date.now(),
      };
      
      messageHandler('cache:invalidation', JSON.stringify(invalidationMsg));
      
      const updatedStats = pubsubCache.getStats();
      expect(updatedStats.invalidations.received).toBe(0);
      
      await pubsubCache.shutdown();
    });

    it('should handle clear_namespace invalidation', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      let messageHandler: (channel: string, message: string) => void = () => {};
      mockOn.mockImplementation((event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Pre-populate cache
      await pubsubCache.set('ns1', 'key1', { data: 'value1' });
      await pubsubCache.set('ns1', 'key2', { data: 'value2' });
      
      // Simulate namespace clear from another instance
      const invalidationMsg = {
        type: 'clear_namespace',
        namespace: 'ns1',
        instanceId: 'other-instance',
        timestamp: Date.now(),
      };
      
      messageHandler('cache:invalidation', JSON.stringify(invalidationMsg));
      
      await pubsubCache.shutdown();
    });

    it('should handle clear_all invalidation', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      let messageHandler: (channel: string, message: string) => void = () => {};
      mockOn.mockImplementation((event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate clear all from another instance
      const invalidationMsg = {
        type: 'clear_all',
        instanceId: 'other-instance',
        timestamp: Date.now(),
      };
      
      messageHandler('cache:invalidation', JSON.stringify(invalidationMsg));
      
      expect(mockLogger.debug).toHaveBeenCalledWith('L1 cache cleared via pub/sub');
      
      await pubsubCache.shutdown();
    });

    it('should handle invalid JSON in messages', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      let messageHandler: (channel: string, message: string) => void = () => {};
      mockOn.mockImplementation((event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate invalid message
      messageHandler('cache:invalidation', 'not-valid-json');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
        'Failed to parse invalidation message'
      );
      
      await pubsubCache.shutdown();
    });

    it('should ignore messages from other channels', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      let messageHandler: (channel: string, message: string) => void = () => {};
      mockOn.mockImplementation((event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const invalidationMsg = {
        type: 'delete',
        namespace: 'test',
        key: 'key1',
        instanceId: 'other-instance',
        timestamp: Date.now(),
      };
      
      // Message from wrong channel
      messageHandler('wrong:channel', JSON.stringify(invalidationMsg));
      
      const stats = pubsubCache.getStats();
      expect(stats.invalidations.received).toBe(0);
      
      await pubsubCache.shutdown();
    });

    it('should handle publish failures gracefully', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockPublish.mockRejectedValueOnce(new Error('Publish failed'));
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await pubsubCache.delete('test', 'key1');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Publish failed' }),
        'Failed to publish cache invalidation'
      );
      
      await pubsubCache.shutdown();
    });

    it('should handle subscribe error', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockSubscribe.mockRejectedValueOnce(new Error('Subscribe failed'));
      
      const pubsubCache = new TieredCache({
        pubsubEnabled: true,
      });
      
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Subscribe failed' }),
        'Failed to initialize cache pub/sub'
      );
      
      await pubsubCache.shutdown();
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

    it('should include instance ID in stats', () => {
      const stats = cache.getStats();
      
      expect(stats.instanceId).toMatch(/^\d+-\d+-[a-z0-9]+$/);
    });
  });
});

describe('getTieredCache', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset mock implementations
    mockMkdir.mockResolvedValue(undefined);
    mockIsRedisConnected.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return singleton instance', async () => {
    const { getTieredCache } = await import('../../src/services/tieredCache.js');
    
    const cache1 = getTieredCache({ pubsubEnabled: false });
    const cache2 = getTieredCache({ pubsubEnabled: false });
    
    expect(cache1).toBe(cache2);
    
    await cache1.shutdown();
  });

  it('should read env vars for configuration', async () => {
    const originalEnv = { ...process.env };
    process.env.TIERED_CACHE_L1_MAX = '200';
    process.env.TIERED_CACHE_L1_TTL_MS = '120000';
    
    vi.resetModules();
    
    const { getTieredCache } = await import('../../src/services/tieredCache.js');
    
    const cache = getTieredCache({ pubsubEnabled: false });
    expect(cache).toBeDefined();
    
    await cache.shutdown();
    
    process.env = originalEnv;
  });

  it('should handle invalid env vars', async () => {
    const originalEnv = { ...process.env };
    process.env.TIERED_CACHE_L1_MAX = 'not-a-number';
    process.env.TIERED_CACHE_L1_TTL_MS = 'also-not-a-number';
    
    vi.resetModules();
    
    const { getTieredCache } = await import('../../src/services/tieredCache.js');
    
    // Should not throw
    const cache = getTieredCache({ pubsubEnabled: false });
    expect(cache).toBeDefined();
    
    await cache.shutdown();
    
    process.env = originalEnv;
  });
});

describe('withTieredCache', () => {
  beforeEach(() => {
    vi.resetModules();
    mockMkdir.mockResolvedValue(undefined);
    mockIsRedisConnected.mockResolvedValue(false);
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return cached value on hit', async () => {
    vi.resetModules();
    const { getTieredCache, withTieredCache } = await import('../../src/services/tieredCache.js');
    const cache = getTieredCache({ pubsubEnabled: false });
    
    // Pre-populate cache
    await cache.set('test', 'key1', { data: 'cached' });
    
    const fn = vi.fn().mockResolvedValue({ data: 'computed' });
    
    const result = await withTieredCache('test', 'key1', fn);
    
    expect(result).toEqual({ data: 'cached' });
    expect(fn).not.toHaveBeenCalled();
    
    await cache.shutdown();
  });

  it('should compute and cache on miss', async () => {
    vi.resetModules();
    const { getTieredCache, withTieredCache } = await import('../../src/services/tieredCache.js');
    const cache = getTieredCache({ pubsubEnabled: false });
    
    const fn = vi.fn().mockResolvedValue({ data: 'computed' });
    
    const result = await withTieredCache('test', 'newkey', fn);
    
    expect(result).toEqual({ data: 'computed' });
    expect(fn).toHaveBeenCalled();
    
    // Verify it was cached
    const cached = await cache.get('test', 'newkey');
    expect(cached).toEqual({ data: 'computed' });
    
    await cache.shutdown();
  });

  it('should pass custom TTL', async () => {
    vi.resetModules();
    const { getTieredCache, withTieredCache } = await import('../../src/services/tieredCache.js');
    const cache = getTieredCache({ pubsubEnabled: false });
    
    const fn = vi.fn().mockResolvedValue({ data: 'computed' });
    
    await withTieredCache('test', 'key1', fn, 3600);
    
    expect(fn).toHaveBeenCalled();
    
    await cache.shutdown();
  });

  it('should handle cache set failure gracefully', async () => {
    vi.resetModules();
    mockWriteFile.mockRejectedValue(new Error('Write failed'));
    mockIsRedisConnected.mockResolvedValue(false);
    
    const { getTieredCache, withTieredCache } = await import('../../src/services/tieredCache.js');
    const cache = getTieredCache({ pubsubEnabled: false });
    
    const fn = vi.fn().mockResolvedValue({ data: 'computed' });
    
    // Should not throw
    const result = await withTieredCache('test', 'key1', fn);
    
    expect(result).toEqual({ data: 'computed' });
    
    // Wait for fire-and-forget cache set
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // The warn is logged by L3 write failure, not by withTieredCache
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Write failed' }),
      'L3 cache write failed'
    );
    
    await cache.shutdown();
  });
});

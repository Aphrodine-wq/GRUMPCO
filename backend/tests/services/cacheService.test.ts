/**
 * Cache Service unit tests.
 * Run: npm test -- cacheService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mock functions are defined before vi.mock runs
const { mockGet, mockSetex, mockDel, mockKeys, mockIsRedisConnected, mockGetRedisClient } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockSetex = vi.fn();
  const mockDel = vi.fn();
  const mockKeys = vi.fn();
  
  const mockRedisClient = {
    get: mockGet,
    setex: mockSetex,
    del: mockDel,
    keys: mockKeys,
  };
  
  const mockIsRedisConnected = vi.fn();
  const mockGetRedisClient = vi.fn(() => mockRedisClient);
  
  return { mockGet, mockSetex, mockDel, mockKeys, mockIsRedisConnected, mockGetRedisClient };
});

// Mock redis service
vi.mock('../../src/services/redis.js', () => ({
  isRedisConnected: mockIsRedisConnected,
  getRedisClient: mockGetRedisClient,
}));

// Mock logger
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

import {
  getFromCache,
  setInCache,
  deleteFromCache,
  clearCacheType,
  getCacheStats,
  withCache,
  type CacheType,
} from '../../src/services/cacheService.js';

describe('cacheService', () => {
  beforeEach(() => {
    // Clear all mock call history
    mockGet.mockReset();
    mockSetex.mockReset();
    mockDel.mockReset();
    mockKeys.mockReset();
    mockIsRedisConnected.mockReset();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getFromCache', () => {
    it('returns null when Redis is not connected', async () => {
      mockIsRedisConnected.mockResolvedValue(false);

      const result = await getFromCache('intent', 'test input');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { type: 'intent' },
        'Redis not connected, cache miss'
      );
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('returns null when key is not found in cache', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      const result = await getFromCache('intent', 'test input');

      expect(result).toBeNull();
      expect(mockGet).toHaveBeenCalled();
    });

    it('returns parsed JSON data when found in cache', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      const cachedData = { foo: 'bar', count: 42 };
      mockGet.mockResolvedValue(JSON.stringify(cachedData));

      const result = await getFromCache<typeof cachedData>('intent', 'test input');

      expect(result).toEqual(cachedData);
    });

    it('generates correct cache key with prefix', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      await getFromCache('architecture', 'test input');

      // The key should start with the architecture prefix
      const callArg = mockGet.mock.calls[0][0] as string;
      expect(callArg).toMatch(/^cache:arch:[a-f0-9]{16}$/);
    });

    it('generates consistent cache keys for same input', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      await getFromCache('prd', 'same input');
      await getFromCache('prd', 'same input');

      const key1 = mockGet.mock.calls[0][0];
      const key2 = mockGet.mock.calls[1][0];
      expect(key1).toBe(key2);
    });

    it('generates different cache keys for different inputs', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      await getFromCache('prd', 'input 1');
      await getFromCache('prd', 'input 2');

      const key1 = mockGet.mock.calls[0][0];
      const key2 = mockGet.mock.calls[1][0];
      expect(key1).not.toBe(key2);
    });

    it('generates different cache keys for different cache types', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      await getFromCache('intent', 'same input');
      await getFromCache('architecture', 'same input');

      const key1 = mockGet.mock.calls[0][0] as string;
      const key2 = mockGet.mock.calls[1][0] as string;
      expect(key1.startsWith('cache:intent:')).toBe(true);
      expect(key2.startsWith('cache:arch:')).toBe(true);
    });

    it('returns null and logs error when JSON parsing fails', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue('invalid json {{{');

      const result = await getFromCache('intent', 'test input');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'intent' }),
        'Cache get failed'
      );
    });

    it('returns null and logs error when redis get fails', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockRejectedValue(new Error('Redis connection error'));

      const result = await getFromCache('intent', 'test input');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Redis connection error', type: 'intent' },
        'Cache get failed'
      );
    });

    it('handles all cache types', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      const cacheTypes: CacheType[] = ['intent', 'architecture', 'prd', 'work_report', 'context', 'intent-optimization'];

      for (const type of cacheTypes) {
        await getFromCache(type, 'test input');
      }

      expect(mockGet).toHaveBeenCalledTimes(6);
    });
  });

  describe('setInCache', () => {
    it('returns false when Redis is not connected', async () => {
      mockIsRedisConnected.mockResolvedValue(false);

      const result = await setInCache('intent', 'test input', { data: 'value' });

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { type: 'intent' },
        'Redis not connected, skipping cache set'
      );
      expect(mockSetex).not.toHaveBeenCalled();
    });

    it('sets value in cache with correct TTL', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockSetex.mockResolvedValue('OK');

      const result = await setInCache('intent', 'test input', { data: 'value' });

      expect(result).toBe(true);
      expect(mockSetex).toHaveBeenCalledWith(
        expect.stringMatching(/^cache:intent:[a-f0-9]{16}$/),
        3600, // TTL for intent type
        JSON.stringify({ data: 'value' })
      );
    });

    it('uses correct TTL for each cache type', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockSetex.mockResolvedValue('OK');

      const expectedTTLs: Record<CacheType, number> = {
        intent: 3600,
        architecture: 7200,
        prd: 7200,
        work_report: 86400,
        context: 1800,
        'intent-optimization': 3600,
      };

      for (const [type, expectedTTL] of Object.entries(expectedTTLs)) {
        mockSetex.mockClear();
        await setInCache(type as CacheType, 'test input', { data: 'value' });
        
        expect(mockSetex).toHaveBeenCalledWith(
          expect.any(String),
          expectedTTL,
          expect.any(String)
        );
      }
    });

    it('returns false and logs error when setex fails', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockSetex.mockRejectedValue(new Error('Redis set error'));

      const result = await setInCache('intent', 'test input', { data: 'value' });

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Redis set error', type: 'intent' },
        'Cache set failed'
      );
    });

    it('serializes complex objects correctly', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockSetex.mockResolvedValue('OK');

      const complexData = {
        name: 'test',
        nested: { a: 1, b: [1, 2, 3] },
        date: '2024-01-01',
        nullable: null,
      };

      await setInCache('architecture', 'test input', complexData);

      expect(mockSetex).toHaveBeenCalledWith(
        expect.any(String),
        7200,
        JSON.stringify(complexData)
      );
    });
  });

  describe('deleteFromCache', () => {
    it('returns false when Redis is not connected', async () => {
      mockIsRedisConnected.mockResolvedValue(false);

      const result = await deleteFromCache('intent', 'test input');

      expect(result).toBe(false);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it('deletes value from cache and returns true', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockDel.mockResolvedValue(1);

      const result = await deleteFromCache('intent', 'test input');

      expect(result).toBe(true);
      expect(mockDel).toHaveBeenCalledWith(
        expect.stringMatching(/^cache:intent:[a-f0-9]{16}$/)
      );
    });

    it('returns false and logs error when del fails', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockDel.mockRejectedValue(new Error('Redis delete error'));

      const result = await deleteFromCache('intent', 'test input');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Redis delete error', type: 'intent' },
        'Cache delete failed'
      );
    });
  });

  describe('clearCacheType', () => {
    it('returns 0 when Redis is not connected', async () => {
      mockIsRedisConnected.mockResolvedValue(false);

      const result = await clearCacheType('intent');

      expect(result).toBe(0);
      expect(mockKeys).not.toHaveBeenCalled();
    });

    it('returns 0 when no keys exist for the type', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockResolvedValue([]);

      const result = await clearCacheType('intent');

      expect(result).toBe(0);
      expect(mockKeys).toHaveBeenCalledWith('cache:intent:*');
      expect(mockDel).not.toHaveBeenCalled();
    });

    it('deletes all keys and returns count', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      const foundKeys = ['cache:intent:abc123', 'cache:intent:def456', 'cache:intent:ghi789'];
      mockKeys.mockResolvedValue(foundKeys);
      mockDel.mockResolvedValue(3);

      const result = await clearCacheType('intent');

      expect(result).toBe(3);
      expect(mockDel).toHaveBeenCalledWith(...foundKeys);
    });

    it('uses correct prefix pattern for each cache type', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockResolvedValue([]);

      const expectedPrefixes: Record<CacheType, string> = {
        intent: 'cache:intent:*',
        architecture: 'cache:arch:*',
        prd: 'cache:prd:*',
        work_report: 'cache:report:*',
        context: 'cache:context:*',
        'intent-optimization': 'cache:intent-opt:*',
      };

      for (const [type, expectedPrefix] of Object.entries(expectedPrefixes)) {
        mockKeys.mockClear();
        await clearCacheType(type as CacheType);
        
        expect(mockKeys).toHaveBeenCalledWith(expectedPrefix);
      }
    });

    it('returns 0 and logs error when operation fails', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockRejectedValue(new Error('Redis keys error'));

      const result = await clearCacheType('intent');

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Redis keys error', type: 'intent' },
        'Cache clear failed'
      );
    });
  });

  describe('getCacheStats', () => {
    it('returns empty stats when Redis is not connected', async () => {
      mockIsRedisConnected.mockResolvedValue(false);

      const result = await getCacheStats();

      expect(result).toEqual({
        intent: 0,
        architecture: 0,
        prd: 0,
        work_report: 0,
        context: 0,
        'intent-optimization': 0,
      });
      expect(mockKeys).not.toHaveBeenCalled();
    });

    it('returns counts for each cache type', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys
        .mockResolvedValueOnce(['key1', 'key2', 'key3']) // intent
        .mockResolvedValueOnce(['key1']) // architecture
        .mockResolvedValueOnce([]) // prd
        .mockResolvedValueOnce(['key1', 'key2']) // work_report
        .mockResolvedValueOnce(['key1', 'key2', 'key3', 'key4']) // context
        .mockResolvedValueOnce(['key1']); // intent-optimization

      const result = await getCacheStats();

      expect(result).toEqual({
        intent: 3,
        architecture: 1,
        prd: 0,
        work_report: 2,
        context: 4,
        'intent-optimization': 1,
      });
    });

    it('queries correct prefix patterns for stats', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockResolvedValue([]);

      await getCacheStats();

      expect(mockKeys).toHaveBeenCalledWith('cache:intent:*');
      expect(mockKeys).toHaveBeenCalledWith('cache:arch:*');
      expect(mockKeys).toHaveBeenCalledWith('cache:prd:*');
      expect(mockKeys).toHaveBeenCalledWith('cache:report:*');
      expect(mockKeys).toHaveBeenCalledWith('cache:context:*');
      expect(mockKeys).toHaveBeenCalledWith('cache:intent-opt:*');
    });

    it('returns empty stats and logs error when operation fails', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockKeys.mockRejectedValue(new Error('Redis stats error'));

      const result = await getCacheStats();

      expect(result).toEqual({
        intent: 0,
        architecture: 0,
        prd: 0,
        work_report: 0,
        context: 0,
        'intent-optimization': 0,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Redis stats error' },
        'Cache stats failed'
      );
    });
  });

  describe('withCache', () => {
    it('executes function directly when skipCache is true', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      const fn = vi.fn().mockResolvedValue('computed result');

      const result = await withCache('intent', 'test input', fn, { skipCache: true });

      expect(result).toBe('computed result');
      expect(fn).toHaveBeenCalled();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('executes function directly when Redis is not connected', async () => {
      mockIsRedisConnected.mockResolvedValue(false);
      const fn = vi.fn().mockResolvedValue('computed result');

      const result = await withCache('intent', 'test input', fn);

      expect(result).toBe('computed result');
      expect(fn).toHaveBeenCalled();
    });

    it('returns cached value on cache hit', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      const cachedData = { cached: true };
      mockGet.mockResolvedValue(JSON.stringify(cachedData));
      const fn = vi.fn().mockResolvedValue('computed result');

      const result = await withCache('intent', 'test input', fn);

      expect(result).toEqual(cachedData);
      expect(fn).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith({ type: 'intent' }, 'Cache hit');
    });

    it('executes function and caches result on cache miss', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);
      mockSetex.mockResolvedValue('OK');
      const computedResult = { computed: true };
      const fn = vi.fn().mockResolvedValue(computedResult);

      const result = await withCache('intent', 'test input', fn);

      expect(result).toEqual(computedResult);
      expect(fn).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith({ type: 'intent' }, 'Cache miss');
      
      // Wait for fire-and-forget cache set to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockSetex).toHaveBeenCalled();
    });

    it('handles cache set failure gracefully', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);
      mockSetex.mockRejectedValue(new Error('Cache set error'));
      const fn = vi.fn().mockResolvedValue('computed result');

      const result = await withCache('intent', 'test input', fn);

      expect(result).toBe('computed result');
      
      // Wait for fire-and-forget cache set to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // The error is caught inside setInCache and logged there as 'Cache set failed'
      // The withCache function still returns the result successfully
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Cache set error', type: 'intent' },
        'Cache set failed'
      );
    });

    it('propagates errors from the function', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);
      const fn = vi.fn().mockRejectedValue(new Error('Function error'));

      await expect(withCache('intent', 'test input', fn)).rejects.toThrow('Function error');
    });

    it('works with all cache types', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);
      mockSetex.mockResolvedValue('OK');

      const cacheTypes: CacheType[] = ['intent', 'architecture', 'prd', 'work_report', 'context', 'intent-optimization'];

      for (const type of cacheTypes) {
        const fn = vi.fn().mockResolvedValue({ type });
        const result = await withCache(type, 'test input', fn);
        expect(result).toEqual({ type });
      }
    });

    it('handles async functions correctly', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);
      mockSetex.mockResolvedValue('OK');
      
      const fn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { delayed: true };
      });

      const result = await withCache('intent', 'test input', fn);

      expect(result).toEqual({ delayed: true });
    });

    it('returns cached value for subsequent calls with same input', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      
      // First call - cache miss
      mockGet.mockResolvedValueOnce(null);
      mockSetex.mockResolvedValue('OK');
      const firstResult = { first: true };
      const fn = vi.fn().mockResolvedValue(firstResult);

      const result1 = await withCache('intent', 'test input', fn);
      expect(result1).toEqual(firstResult);
      expect(fn).toHaveBeenCalledTimes(1);

      // Wait for cache set to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second call - cache hit
      mockGet.mockResolvedValueOnce(JSON.stringify(firstResult));
      const result2 = await withCache('intent', 'test input', fn);
      
      expect(result2).toEqual(firstResult);
      expect(fn).toHaveBeenCalledTimes(1); // Function should not be called again
    });
  });

  describe('Cache key generation', () => {
    it('generates SHA-256 based 16-char hex keys', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      await getFromCache('intent', 'test input');

      const key = mockGet.mock.calls[0][0] as string;
      const hash = key.replace('cache:intent:', '');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('generates deterministic keys for same input', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      const input = 'deterministic test input';
      await getFromCache('intent', input);
      await getFromCache('intent', input);

      const key1 = mockGet.mock.calls[0][0];
      const key2 = mockGet.mock.calls[1][0];
      expect(key1).toBe(key2);
    });

    it('generates unique keys for different inputs', async () => {
      mockIsRedisConnected.mockResolvedValue(true);
      mockGet.mockResolvedValue(null);

      await getFromCache('intent', 'input A');
      await getFromCache('intent', 'input B');
      await getFromCache('intent', 'input C');

      const keys = mockGet.mock.calls.map(call => call[0]);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(3);
    });
  });
});

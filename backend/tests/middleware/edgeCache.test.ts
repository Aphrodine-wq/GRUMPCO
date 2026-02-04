/**
 * Edge Cache Middleware unit tests
 * Run: npm test -- edgeCache.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

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

import { edgeCache, CacheConfigs, CacheTags, purgeCacheByTag, cacheWarmer, staleWhileRevalidate } from '../../src/middleware/edgeCache.js';

describe('edgeCache', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
    };
    mockRes = {
      setHeader: vi.fn(),
    };
    mockNext = vi.fn();
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('edgeCache middleware', () => {
    it('should set cache headers for GET requests', () => {
      const middleware = edgeCache();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('public'));
      expect(mockRes.setHeader).toHaveBeenCalledWith('Vary', 'Accept-Encoding');
    });

    it('should skip cache for non-GET requests', () => {
      mockReq.method = 'POST';
      
      const middleware = edgeCache();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should include stale-while-revalidate directive', () => {
      const middleware = edgeCache({ ttl: 60, staleWhileRevalidate: 300 });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('stale-while-revalidate=300')
      );
    });

    it('should include max-age directive', () => {
      const middleware = edgeCache({ ttl: 120 });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('max-age=120')
      );
    });

    it('should set cache tags when provided', () => {
      const middleware = edgeCache({ tags: ['models', 'api'] });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Tag', 'models,api');
    });

    it('should set surrogate keys', () => {
      const middleware = edgeCache({ tags: ['models'] });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Surrogate-Key', 'models');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Surrogate-Control', expect.stringContaining('max-age'));
    });

    it('should handle vary headers', () => {
      const middleware = edgeCache({ varyBy: ['Accept-Encoding', 'Authorization'] });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Vary', 'Accept-Encoding, Authorization');
    });

    it('should call next()', () => {
      const middleware = edgeCache();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle authenticated requests with no-cache', () => {
      mockReq.headers = { authorization: 'Bearer token123' };
      
      const middleware = edgeCache();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-cache');
    });

    it('should allow caching for authenticated requests when configured', () => {
      mockReq.headers = { authorization: 'Bearer token123' };
      
      const middleware = edgeCache({ ttl: 60 }); // Explicit TTL allows caching
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should set public cache with provided TTL
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('public')
      );
    });

    it('should log debug message', () => {
      const middleware = edgeCache({ tags: ['test'] });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/test',
          cacheControl: expect.any(String),
          tags: ['test'],
        }),
        'Edge cache headers set'
      );
    });
  });

  describe('CacheConfigs', () => {
    it('should have static config', () => {
      expect(CacheConfigs.static).toBeDefined();
      expect(CacheConfigs.static.ttl).toBe(86400);
      expect(CacheConfigs.static.staleWhileRevalidate).toBe(604800);
    });

    it('should have models config', () => {
      expect(CacheConfigs.models).toBeDefined();
      expect(CacheConfigs.models.ttl).toBe(300);
      expect(CacheConfigs.models.tags).toContain(CacheTags.MODELS);
    });

    it('should have sessions config with auth vary', () => {
      expect(CacheConfigs.sessions).toBeDefined();
      expect(CacheConfigs.sessions.varyBy).toContain('Authorization');
      expect(CacheConfigs.sessions.ttl).toBe(30);
    });

    it('should have settings config', () => {
      expect(CacheConfigs.settings).toBeDefined();
      expect(CacheConfigs.settings.ttl).toBe(60);
    });

    it('should have analytics config', () => {
      expect(CacheConfigs.analytics).toBeDefined();
      expect(CacheConfigs.analytics.ttl).toBe(60);
    });

    it('should have api config with no cache', () => {
      expect(CacheConfigs.api).toBeDefined();
      expect(CacheConfigs.api.ttl).toBe(0);
    });
  });

  describe('CacheTags', () => {
    it('should define all cache tags', () => {
      expect(CacheTags.MODELS).toBe('models');
      expect(CacheTags.SESSIONS).toBe('sessions');
      expect(CacheTags.SETTINGS).toBe('settings');
      expect(CacheTags.ANALYTICS).toBe('analytics');
      expect(CacheTags.STATIC).toBe('static');
      expect(CacheTags.API).toBe('api');
    });
  });

  describe('purgeCacheByTag', () => {
    it('should log purge request', async () => {
      await purgeCacheByTag('models');

      expect(mockLogger.info).toHaveBeenCalledWith(
        { tag: 'models' },
        'Cache purge requested'
      );
    });

    it('should handle Vercel purge when URL available', async () => {
      process.env.VERCEL_URL = 'example.vercel.app';
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await purgeCacheByTag('test-tag');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('vercel.com'),
        expect.objectContaining({
          method: 'DELETE',
          body: expect.stringContaining('test-tag'),
        })
      );

      delete process.env.VERCEL_URL;
    });

    it('should handle fetch errors gracefully', async () => {
      process.env.VERCEL_URL = 'example.vercel.app';
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(purgeCacheByTag('test')).resolves.not.toThrow();

      delete process.env.VERCEL_URL;
    });
  });

  describe('cacheWarmer', () => {
    it('should fetch urls asynchronously', async () => {
      vi.useFakeTimers();
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      cacheWarmer(['/api/models', '/api/settings']);

      // Fast-forward past setTimeout and allow async loop to complete
      await vi.runAllTimersAsync();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Cache-Warmer/1.0',
          }),
        })
      );

      vi.useRealTimers();
    });

    it('should log successful warming', async () => {
      vi.useFakeTimers();
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      cacheWarmer(['/api/test']);
      vi.advanceTimersByTime(150);

      // Allow promises to resolve
      await vi.runAllTimersAsync();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/test' }),
        'Cache warmed'
      );

      vi.useRealTimers();
    });

    it('should handle fetch errors', async () => {
      vi.useFakeTimers();
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed'));

      cacheWarmer(['/api/error']);
      vi.advanceTimersByTime(150);

      await vi.runAllTimersAsync();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/error' }),
        'Failed to warm cache'
      );

      vi.useRealTimers();
    });
  });

  describe('staleWhileRevalidate', () => {
    it('should return fresh data', async () => {
      const generator = vi.fn().mockResolvedValue({ data: 'fresh' });
      
      const result = await staleWhileRevalidate(generator, 60, 300);

      expect(result).toEqual({ data: 'fresh' });
      expect(generator).toHaveBeenCalled();
    });

    it('should propagate generator errors', async () => {
      const generator = vi.fn().mockRejectedValue(new Error('Generator failed'));
      
      await expect(staleWhileRevalidate(generator, 60, 300)).rejects.toThrow('Generator failed');
    });

    it('should handle async generators', async () => {
      const generator = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { async: true };
      });

      const result = await staleWhileRevalidate(generator, 60, 300);

      expect(result).toEqual({ async: true });
    });
  });

  describe('middleware integration with configs', () => {
    it('should work with CacheConfigs.static', () => {
      const middleware = edgeCache(CacheConfigs.static);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('max-age=86400')
      );
    });

    it('should work with CacheConfigs.models', () => {
      const middleware = edgeCache(CacheConfigs.models);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Tag', CacheTags.MODELS);
    });

    it('should work with CacheConfigs.sessions', () => {
      mockReq.headers = { authorization: 'Bearer token' };
      
      const middleware = edgeCache(CacheConfigs.sessions);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Vary',
        expect.stringContaining('Authorization')
      );
    });
  });
});

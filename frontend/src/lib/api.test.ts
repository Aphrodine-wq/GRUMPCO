/**
 * API Client Tests
 * 
 * Comprehensive tests for the central API client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getApiBase, resetApiBase, fetchApi } from './api';

describe('api', () => {
  beforeEach(() => {
    resetApiBase();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetApiBase();
  });

  describe('getApiBase', () => {
    it('should return default base URL in dev', () => {
      const base = getApiBase();
      // In test environment, should return default
      expect(base).toBe('http://localhost:3000');
    });

    it('should cache the base URL', () => {
      const base1 = getApiBase();
      const base2 = getApiBase();
      expect(base1).toBe(base2);
    });
  });

  describe('resetApiBase', () => {
    it('should clear cached base URL', () => {
      getApiBase(); // Cache it
      resetApiBase();
      // After reset, should re-evaluate
      const base = getApiBase();
      expect(base).toBe('http://localhost:3000');
    });
  });

  describe('fetchApi', () => {
    it('should make request with correct URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should add leading slash if missing', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.any(Object)
      );
    });

    it('should pass custom headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test', {
        headers: { 'X-Custom': 'value' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'value',
          }),
        })
      );
    });

    it('should pass request options', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'test' }),
        })
      );
    });

    it('should retry on 5xx errors when retries configured', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 500 }))
        .mockResolvedValueOnce(new Response('{}', { status: 500 }))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchApi('/api/test', { retries: 2 });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test', { retries: 3 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry 4xx errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }));
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchApi('/api/test', { retries: 3 });

      expect(response.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw after exhausting retries', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchApi('/api/test', { retries: 2 })).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should apply timeout when no signal provided', async () => {
      vi.useFakeTimers();
      
      const mockFetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(new Response('{}')), 50000))
      );
      vi.stubGlobal('fetch', mockFetch);

      const fetchPromise = fetchApi('/api/test', { timeout: 1000 });

      vi.advanceTimersByTime(1001);

      await expect(fetchPromise).rejects.toThrow();
      
      vi.useRealTimers();
    });

    it('should not apply timeout when signal provided', async () => {
      const controller = new AbortController();
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await fetchApi('/api/test', { 
        signal: controller.signal,
        timeout: 100 
      });

      // Should pass the user's signal, not create a timeout
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });
  });

  describe('error handling', () => {
    it('should propagate network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(fetchApi('/api/test')).rejects.toThrow('Network error');
    });

    it('should return error responses without throwing', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('{"error": "Not found"}', { status: 404 })
      );
      vi.stubGlobal('fetch', mockFetch);

      const response = await fetchApi('/api/test');
      expect(response.status).toBe(404);
    });
  });
});

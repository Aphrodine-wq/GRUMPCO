/**
 * Web API Client Tests
 * 
 * Comprehensive tests for the web API client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiBaseUrl, apiFetch } from './api';

describe('web api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('apiBaseUrl', () => {
    it('should return a string URL', () => {
      expect(typeof apiBaseUrl).toBe('string');
    });

    it('should be the window origin in browser', () => {
      // In test environment with jsdom, window.location.origin is available
      expect(apiBaseUrl).toBe(window.location.origin);
    });
  });

  describe('apiFetch', () => {
    it('should make request with JSON content type', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should use full URL if path starts with http', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await apiFetch('https://external.api.com/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://external.api.com/endpoint',
        expect.any(Object)
      );
    });

    it('should prepend base URL for relative paths', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.any(Object)
      );
    });

    it('should merge custom headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      await apiFetch('/api/test', {
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

    it('should pass request body', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      const body = JSON.stringify({ data: 'test' });
      await apiFetch('/api/test', { method: 'POST', body });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body,
        })
      );
    });

    it('should add authorization header when token exists', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      // Set auth token in localStorage
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        currentSession: { access_token: 'test-token-123' }
      }));

      await apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should handle access_token at root level', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'root-token-456'
      }));

      await apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer root-token-456',
          }),
        })
      );
    });

    it('should handle invalid JSON in localStorage', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);

      localStorage.setItem('supabase.auth.token', 'not-valid-json');

      // Should not throw
      await apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return the fetch response', async () => {
      const mockResponse = new Response('{"success": true}', { status: 200 });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const response = await apiFetch('/api/test');

      expect(response).toBe(mockResponse);
      expect(response.status).toBe(200);
    });

    it('should propagate network errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      await expect(apiFetch('/api/test')).rejects.toThrow('Network error');
    });
  });
});

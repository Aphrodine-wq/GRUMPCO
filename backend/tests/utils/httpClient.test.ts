import { HttpClient, getHttpClient, destroyHttpClient, pooledFetch } from '../../src/utils/httpClient';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HttpClient', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    destroyHttpClient();
  });

  it('should be a singleton', () => {
    const client1 = getHttpClient();
    const client2 = getHttpClient();
    expect(client1).toBe(client2);
  });

  it('should create an HttpClient with default options', () => {
    const client = new HttpClient();
    expect(client).toBeInstanceOf(HttpClient);
  });

  it('should use https agent for https urls', async () => {
    const client = getHttpClient();
    await client.fetch('https://example.com');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        agent: expect.any(Object),
      })
    );
  });

  it('should use http agent for http urls', async () => {
    const client = getHttpClient();
    await client.fetch('http://example.com');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://example.com',
      expect.objectContaining({
        agent: expect.any(Object),
      })
    );
  });

  it('pooledFetch should use the singleton client', async () => {
    await pooledFetch('https://example.com');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should get stats', () => {
    const client = getHttpClient();
    const stats = client.getStats();
    expect(stats).toHaveProperty('https');
    expect(stats).toHaveProperty('http');
  });

  it('should destroy the client', () => {
    const client = getHttpClient();
    const httpsSpy = vi.spyOn(client['httpsAgent'], 'destroy');
    const httpSpy = vi.spyOn(client['httpAgent'], 'destroy');
    client.destroy();
    expect(httpsSpy).toHaveBeenCalled();
    expect(httpSpy).toHaveBeenCalled();
  });

  it('should throw an error when fetch fails', async () => {
    const client = getHttpClient();
    mockFetch.mockRejectedValue(new Error('Network error'));
    await expect(client.fetch('https://example.com')).rejects.toThrow('Network error');
  });
});

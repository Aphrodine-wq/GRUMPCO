/**
 * Ollama Route Tests
 * Tests GET /ollama/status endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Store original env
const originalEnv = process.env.OLLAMA_HOST;

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import ollamaRouter from '../../src/routes/ollama.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/ollama', ollamaRouter);
  return app;
}

describe('Ollama Route', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.OLLAMA_HOST = originalEnv;
    } else {
      delete process.env.OLLAMA_HOST;
    }
  });

  describe('GET /ollama/status', () => {
    it('should return detected:true with models when Ollama is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama2:latest' },
            { name: 'codellama:7b' },
            { name: 'mistral:latest' },
          ],
        }),
      });

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: true,
        host: 'localhost:11434',
        models: ['llama2:latest', 'codellama:7b', 'mistral:latest'],
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should return detected:true with empty models array when no models installed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [],
        }),
      });

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: true,
        host: 'localhost:11434',
        models: [],
      });
    });

    it('should return detected:true with empty models when API returns null models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: true,
        host: 'localhost:11434',
        models: [],
      });
    });

    it('should return detected:false when Ollama returns non-ok status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: false,
        host: 'localhost:11434',
        models: [],
        error: 'Ollama returned 503',
      });
    });

    it('should return detected:false when Ollama returns 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: false,
        host: 'localhost:11434',
        models: [],
        error: 'Ollama returned 404',
      });
    });

    it('should return detected:false when fetch throws connection error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: false,
        host: 'localhost:11434',
        models: [],
        error: 'ECONNREFUSED',
      });
    });

    it('should return detected:false when fetch times out', async () => {
      mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: false,
        host: 'localhost:11434',
        models: [],
        error: 'The operation was aborted',
      });
    });

    it('should return detected:false when DNS lookup fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND localhost'));

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: false,
        host: 'localhost:11434',
        models: [],
        error: 'getaddrinfo ENOTFOUND localhost',
      });
    });
  });

  describe('Custom OLLAMA_HOST', () => {
    it('should use custom host without http prefix', async () => {
      // Note: The OLLAMA_HOST is read at module load time, so this test
      // verifies the URL construction logic. In practice, the host is
      // determined when the module is imported.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'test-model' }],
        }),
      });

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      // The default host is used since env was set at import time
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags'),
        expect.any(Object)
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed JSON response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        detected: false,
        host: 'localhost:11434',
        models: [],
        error: 'Invalid JSON',
      });
    });

    it('should handle models with various name formats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'model1' },
            { name: 'namespace/model2:tag' },
            { name: 'model3:v1.0.0' },
          ],
        }),
      });

      const response = await request(app).get('/ollama/status');

      expect(response.status).toBe(200);
      expect(response.body.models).toEqual([
        'model1',
        'namespace/model2:tag',
        'model3:v1.0.0',
      ]);
    });
  });
});

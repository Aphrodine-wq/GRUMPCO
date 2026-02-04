/**
 * Embedding Service Unit Tests
 * Run: npm test -- embeddingService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Use vi.hoisted to ensure mock functions are defined before vi.mock runs
const { mockNIMAccelerator, mockGetNIMAccelerator } = vi.hoisted(() => {
  const mockNIMAccelerator = {
    generateEmbeddings: vi.fn(),
  };
  const mockGetNIMAccelerator = vi.fn<[], typeof mockNIMAccelerator | null>(() => mockNIMAccelerator);
  return { mockNIMAccelerator, mockGetNIMAccelerator };
});

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

// Mock nimAccelerator
vi.mock('../../src/services/nimAccelerator.js', () => ({
  getNIMAccelerator: mockGetNIMAccelerator,
}));

// Mock nim config
vi.mock('../../src/config/nim.js', () => ({
  getNimEmbedUrl: vi.fn(() => 'https://integrate.api.nvidia.com/v1/embeddings'),
}));

describe('embeddingService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mockNIMAccelerator.generateEmbeddings.mockReset();
    mockGetNIMAccelerator.mockReset();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
    
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.NIM_EMBED_MODEL;
    delete process.env.RAG_EMBED_MODEL;
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = originalEnv;
  });

  describe('embed - NIM Accelerator path', () => {
    it('uses NIM accelerator when available and no model override', async () => {
      const expectedEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
      mockNIMAccelerator.generateEmbeddings.mockResolvedValue(expectedEmbeddings);
      mockGetNIMAccelerator.mockReturnValue(mockNIMAccelerator);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['hello', 'world']);

      expect(mockGetNIMAccelerator).toHaveBeenCalled();
      expect(mockNIMAccelerator.generateEmbeddings).toHaveBeenCalledWith(['hello', 'world']);
      expect(result).toEqual(expectedEmbeddings);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not use NIM accelerator when model override is provided', async () => {
      const expectedEmbeddings = [[0.1, 0.2, 0.3]];
      mockGetNIMAccelerator.mockReturnValue(mockNIMAccelerator);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: expectedEmbeddings[0], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['hello'], { model: 'custom/embed-model' });

      // Accelerator should not be used because model override is provided
      expect(mockNIMAccelerator.generateEmbeddings).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(expectedEmbeddings);
    });

    it('falls back to direct API when NIM accelerator is not available', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const expectedEmbeddings = [[0.7, 0.8, 0.9]];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: expectedEmbeddings[0], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['test']);

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(expectedEmbeddings);
    });
  });

  describe('embed - Direct API path', () => {
    it('throws error when no API key is set and NIM not available', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      delete process.env.NVIDIA_NIM_API_KEY;

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow(
        'NVIDIA_NIM_API_KEY is not set and no embedding provider available'
      );
    });

    it('sends correct request format to NIM API', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-api-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.3, 0.4], index: 1 },
          ],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['text1', 'text2']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      
      expect(url).toBe('https://integrate.api.nvidia.com/v1/embeddings');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
      
      const body = JSON.parse(options.body);
      expect(body.input).toEqual(['text1', 'text2']);
      expect(body.model).toBe('nvidia/nv-embed-v1');
    });

    it('uses default model when no model specified', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test']);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('nvidia/nv-embed-v1');
    });

    it('uses NIM_EMBED_MODEL from environment when set', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';
      process.env.NIM_EMBED_MODEL = 'nvidia/custom-embed';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test']);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('nvidia/custom-embed');
    });

    it('uses RAG_EMBED_MODEL from environment as fallback', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';
      process.env.RAG_EMBED_MODEL = 'nvidia/rag-embed';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test']);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('nvidia/rag-embed');
    });

    it('prioritizes NIM_EMBED_MODEL over RAG_EMBED_MODEL', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';
      process.env.NIM_EMBED_MODEL = 'nvidia/priority-model';
      process.env.RAG_EMBED_MODEL = 'nvidia/fallback-model';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test']);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('nvidia/priority-model');
    });

    it('uses explicit model option when provided', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';
      process.env.NIM_EMBED_MODEL = 'nvidia/env-model';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test'], { model: 'explicit/model' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('explicit/model');
    });

    it('includes input_type when provided in options', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test'], { inputType: 'query' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input_type).toBe('query');
    });

    it('includes input_type passage when provided', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test'], { inputType: 'passage' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input_type).toBe('passage');
    });

    it('does not include input_type when not provided', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test']);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input_type).toBeUndefined();
    });
  });

  describe('embed - Response handling', () => {
    it('returns embeddings sorted by index when indices are provided', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      // Return embeddings out of order
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.3, 0.4], index: 2 },
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.5, 0.6], index: 1 },
          ],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['a', 'b', 'c']);

      // Should be sorted by index
      expect(result).toEqual([
        [0.1, 0.2],
        [0.5, 0.6],
        [0.3, 0.4],
      ]);
    });

    it('preserves order when no indices are provided', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2] },
            { embedding: [0.3, 0.4] },
            { embedding: [0.5, 0.6] },
          ],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['a', 'b', 'c']);

      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
        [0.5, 0.6],
      ]);
    });

    it('handles empty data array', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow('NIM embeddings: length mismatch');
    });

    it('handles missing data field gracefully', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow('NIM embeddings: length mismatch');
    });

    it('throws error on length mismatch', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1], index: 0 },
          ],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      // Request embeddings for 3 texts but only get 1 back
      await expect(embed(['a', 'b', 'c'])).rejects.toThrow('NIM embeddings: length mismatch');
    });

    it('handles single embedding correctly', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3, 0.4], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['single text']);

      expect(result).toEqual([[0.1, 0.2, 0.3, 0.4]]);
    });

    it('handles mixed index values with some undefined', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      // Some indices are numbers, some are undefined - tests the ?? 0 fallback
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.3, 0.4], index: 2 },
            { embedding: [0.1, 0.2], index: undefined },
            { embedding: [0.5, 0.6], index: 1 },
          ],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['a', 'b', 'c']);

      // First item has index: undefined which falls back to 0
      // Items should be sorted: undefined(0), 1, 2
      expect(result).toEqual([
        [0.1, 0.2],
        [0.5, 0.6],
        [0.3, 0.4],
      ]);
    });

    it('handles null index values with fallback to zero', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.2], index: 1 },
            { embedding: [0.1], index: null },
          ],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['a', 'b']);

      // null falls back to 0, so order is: null(0), 1
      expect(result).toEqual([
        [0.1],
        [0.2],
      ]);
    });
  });

  describe('embed - Error handling', () => {
    it('throws error on API failure with status code', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized: Invalid API key',
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow('NIM embeddings: 401 Unauthorized: Invalid API k');
    });

    it('logs warning on API failure', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      try {
        await embed(['test']);
      } catch {
        // Expected to throw
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { status: 500, body: 'Internal server error' },
        'NIM embeddings error'
      );
    });

    it('truncates long error messages in logs', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const longError = 'x'.repeat(1000);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => longError,
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      try {
        await embed(['test']);
      } catch {
        // Expected to throw
      }

      // Log should have truncated body (first 500 chars)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { status: 400, body: 'x'.repeat(500) },
        'NIM embeddings error'
      );
    });

    it('handles network errors', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockRejectedValue(new Error('Network error: ECONNREFUSED'));

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow('Network error: ECONNREFUSED');
    });

    it('handles JSON parse errors from malformed response', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token in JSON');
        },
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow('Unexpected token in JSON');
    });

    it('handles rate limiting errors (429)', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded. Please retry after 60 seconds.',
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow('NIM embeddings: 429');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 429 }),
        'NIM embeddings error'
      );
    });

    it('handles service unavailable errors (503)', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service temporarily unavailable',
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow('NIM embeddings: 503');
    });
  });

  describe('embed - Batch processing', () => {
    it('handles large batch of texts', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const texts = Array(100).fill(0).map((_, i) => `text ${i}`);
      const embeddings = texts.map((_, i) => ({ embedding: [i * 0.01], index: i }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: embeddings }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(texts);

      expect(result.length).toBe(100);
      expect(result[0]).toEqual([0]);
      expect(result[99]).toEqual([0.99]);
    });

    it('handles empty input array', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed([]);

      expect(result).toEqual([]);
    });

    it('handles texts with special characters', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const specialTexts = [
        'Hello "world"',
        'Tab\there',
        'Newline\ntext',
        'Unicode: ',
        'Emoji: test',
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: specialTexts.map((_, i) => ({ embedding: [i * 0.1], index: i })),
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(specialTexts);

      expect(result.length).toBe(5);

      // Verify the texts were sent correctly
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input).toEqual(specialTexts);
    });

    it('handles very long text input', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const longText = 'a'.repeat(10000);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.5], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed([longText]);

      expect(result).toEqual([[0.5]]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.input[0].length).toBe(10000);
    });
  });

  describe('embed - Timeout handling', () => {
    it('uses AbortSignal with 60 second timeout', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test']);

      const options = mockFetch.mock.calls[0][1];
      expect(options.signal).toBeDefined();
    });
  });

  describe('embed - Combined scenarios', () => {
    it('uses accelerator with valid accelerator and no options', async () => {
      const acceleratorEmbeddings = [[1, 2, 3]];
      mockNIMAccelerator.generateEmbeddings.mockResolvedValue(acceleratorEmbeddings);
      mockGetNIMAccelerator.mockReturnValue(mockNIMAccelerator);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['test']);

      expect(result).toEqual(acceleratorEmbeddings);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('uses accelerator with valid accelerator and empty options', async () => {
      const acceleratorEmbeddings = [[1, 2, 3]];
      mockNIMAccelerator.generateEmbeddings.mockResolvedValue(acceleratorEmbeddings);
      mockGetNIMAccelerator.mockReturnValue(mockNIMAccelerator);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['test'], {});

      expect(result).toEqual(acceleratorEmbeddings);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('uses direct API when accelerator is available but model is specified', async () => {
      mockNIMAccelerator.generateEmbeddings.mockResolvedValue([[1, 2, 3]]);
      mockGetNIMAccelerator.mockReturnValue(mockNIMAccelerator);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.9, 0.8], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      const result = await embed(['test'], { model: 'specific/model' });

      expect(mockNIMAccelerator.generateEmbeddings).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual([[0.9, 0.8]]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('specific/model');
    });

    it('uses direct API with inputType when model is also specified', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.5], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test'], { model: 'custom/model', inputType: 'query' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('custom/model');
      expect(body.input_type).toBe('query');
    });

    it('handles accelerator error gracefully', async () => {
      mockNIMAccelerator.generateEmbeddings.mockRejectedValue(new Error('Accelerator failed'));
      mockGetNIMAccelerator.mockReturnValue(mockNIMAccelerator);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      const { embed } = await import('../../src/services/embeddingService.js');

      await expect(embed(['test'])).rejects.toThrow('Accelerator failed');
    });

    it('handles multiple concurrent embedding requests', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({
            data: [{ embedding: [callCount * 0.1], index: 0 }],
          }),
        };
      });

      const { embed } = await import('../../src/services/embeddingService.js');

      const [result1, result2, result3] = await Promise.all([
        embed(['text1']),
        embed(['text2']),
        embed(['text3']),
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result1.length).toBe(1);
      expect(result2.length).toBe(1);
      expect(result3.length).toBe(1);
    });
  });

  describe('EmbedOptions interface', () => {
    it('accepts both model and inputType options', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test'], { model: 'test/model', inputType: 'passage' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('test/model');
      expect(body.input_type).toBe('passage');
    });

    it('handles undefined options', async () => {
      mockGetNIMAccelerator.mockReturnValue(null);
      process.env.NVIDIA_NIM_API_KEY = 'test-key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
        }),
      });

      const { embed } = await import('../../src/services/embeddingService.js');
      await embed(['test'], undefined);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('nvidia/nv-embed-v1');
      expect(body.input_type).toBeUndefined();
    });
  });
});

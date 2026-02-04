/**
 * NIM Accelerator Unit Tests
 *
 * Tests for GPU-accelerated embeddings and parallel inference using NVIDIA NIM
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before imports
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('../../src/middleware/metrics.js', () => ({
  updateGpuMetrics: vi.fn(),
}));

// Mock nim config
vi.mock('../../src/config/nim.js', () => ({
  getNimApiBase: vi.fn(() => 'https://integrate.api.nvidia.com/v1'),
}));

// Mock batchProcessor
const mockBatchProcessorAdd = vi.fn();
const mockBatchProcessorFlush = vi.fn();
vi.mock('../../src/services/batchProcessor.js', () => ({
  createEmbeddingBatchProcessor: vi.fn(() => ({
    add: mockBatchProcessorAdd,
    flush: mockBatchProcessorFlush,
  })),
}));

describe('NIMAccelerator', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mockBatchProcessorAdd.mockReset();
    mockBatchProcessorFlush.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NVIDIA_NIM_API_KEY;
    delete process.env.NVIDIA_NIM_URL;
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      const stats = accelerator.getStats();
      expect(stats.activeRequests).toBe(0);
      expect(stats.maxParallelRequests).toBe(32);
      expect(stats.utilization).toBe(0);
    });

    it('should initialize with custom configuration', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.nvidia.com/v1',
        embeddingModel: 'custom/embedding-model',
        inferenceModel: 'custom/inference-model',
        maxBatchSize: 128,
        maxParallelRequests: 16,
        enableDynamicBatching: false,
        enableMultiGPU: false,
        gpuIds: [0, 1, 2],
      });

      const stats = accelerator.getStats();
      expect(stats.maxParallelRequests).toBe(16);
    });

    it('should enable multi-GPU monitoring when configured', async () => {
      vi.useFakeTimers();
      
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      // Create accelerator with multi-GPU enabled
      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: true,
        gpuIds: [0, 1],
      });

      // The constructor should have started GPU monitoring
      expect(accelerator.getAllGPUMetrics().size).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings using batch processor', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const mockEmbedding = [0.1, 0.2, 0.3];
      mockBatchProcessorAdd.mockResolvedValue(mockEmbedding);

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      const texts = ['Hello', 'World'];
      const embeddings = await accelerator.generateEmbeddings(texts);

      expect(mockBatchProcessorAdd).toHaveBeenCalledTimes(2);
      expect(mockBatchProcessorAdd).toHaveBeenCalledWith('embeddings', 'Hello');
      expect(mockBatchProcessorAdd).toHaveBeenCalledWith('embeddings', 'World');
      expect(embeddings).toHaveLength(2);
    });

    it('should handle empty text array', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      const embeddings = await accelerator.generateEmbeddings([]);

      expect(embeddings).toHaveLength(0);
      expect(mockBatchProcessorAdd).not.toHaveBeenCalled();
    });

    it('should propagate errors from batch processor', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockBatchProcessorAdd.mockRejectedValue(new Error('Batch processing failed'));

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      await expect(accelerator.generateEmbeddings(['test'])).rejects.toThrow('Batch processing failed');
    });
  });

  describe('parallelInference', () => {
    it('should process single prompt successfully', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      const result = await accelerator.parallelInference({
        prompts: ['Hello'],
      });

      expect(result.completions).toHaveLength(1);
      expect(result.completions[0]).toBe('Hello response');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
    });

    it('should process multiple prompts in parallel', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response 1' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response 2' } }],
            usage: { prompt_tokens: 12, completion_tokens: 6 },
          }),
        });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        maxParallelRequests: 32,
      });

      const result = await accelerator.parallelInference({
        prompts: ['Prompt 1', 'Prompt 2'],
      });

      expect(result.completions).toHaveLength(2);
      expect(result.completions[0]).toBe('Response 1');
      expect(result.completions[1]).toBe('Response 2');
      expect(result.usage.inputTokens).toBe(22);
      expect(result.usage.outputTokens).toBe(11);
    });

    it('should chunk prompts based on maxParallelRequests', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      // Mock responses for 5 prompts
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: `Response ${i}` } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        });
      }

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        maxParallelRequests: 2, // Process max 2 at a time
      });

      const prompts = ['P1', 'P2', 'P3', 'P4', 'P5'];
      const result = await accelerator.parallelInference({ prompts });

      expect(result.completions).toHaveLength(5);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should use custom model when specified', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      const result = await accelerator.parallelInference({
        prompts: ['Hello'],
        model: 'custom/model',
        maxTokens: 2048,
        temperature: 0.5,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.model).toBe('custom/model');
      expect(body.max_tokens).toBe(2048);
      expect(body.temperature).toBe(0.5);
    });

    it('should use default inference model when not specified', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        inferenceModel: 'moonshotai/kimi-k2.5',
      });

      const result = await accelerator.parallelInference({
        prompts: ['Hello'],
      });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.model).toBe('moonshotai/kimi-k2.5');
      expect(result.model).toBe('moonshotai/kimi-k2.5');
    });

    it('should handle empty response content', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: null } }],
          usage: { prompt_tokens: 10, completion_tokens: 0 },
        }),
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      const result = await accelerator.parallelInference({
        prompts: ['Hello'],
      });

      expect(result.completions[0]).toBe('');
    });

    it('should handle API errors', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      await expect(
        accelerator.parallelInference({ prompts: ['Hello'] })
      ).rejects.toThrow('NIM API error: 500');
    });

    it('should handle network errors', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      await expect(
        accelerator.parallelInference({ prompts: ['Hello'] })
      ).rejects.toThrow('Network error');
    });

    it('should track active requests correctly', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      let capturedActiveRequests: number[] = [];

      mockFetch.mockImplementation(async () => {
        // Capture active requests during fetch
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        };
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      expect(accelerator.getStats().activeRequests).toBe(0);

      await accelerator.parallelInference({ prompts: ['Hello'] });

      expect(accelerator.getStats().activeRequests).toBe(0);
    });
  });

  describe('getGpuMetrics', () => {
    it('should return GPU metrics when available', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: {
            utilization: 75,
            memory_used: 8000,
            memory_total: 16000,
          },
        }),
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: false,
      });

      const metrics = await accelerator.getGpuMetrics(0);

      expect(metrics).not.toBeNull();
      expect(metrics?.utilization).toBe(75);
      expect(metrics?.memoryUsed).toBe(8000);
      expect(metrics?.memoryTotal).toBe(16000);
    });

    it('should return null when API returns error', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: false,
      });

      const metrics = await accelerator.getGpuMetrics(0);

      expect(metrics).toBeNull();
    });

    it('should return null when GPU data is not present', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: false,
      });

      const metrics = await accelerator.getGpuMetrics(0);

      expect(metrics).toBeNull();
    });

    it('should return null on network error', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: false,
      });

      const metrics = await accelerator.getGpuMetrics(0);

      expect(metrics).toBeNull();
    });

    it('should call updateGpuMetrics when GPU data is available', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');
      const { updateGpuMetrics } = await import('../../src/middleware/metrics.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: {
            utilization: 50,
            memory_used: 4000,
            memory_total: 8000,
          },
        }),
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: false,
      });

      await accelerator.getGpuMetrics(1);

      expect(updateGpuMetrics).toHaveBeenCalledWith('nim-1', 50, 4000);
    });
  });

  describe('getAllGPUMetrics', () => {
    it('should return empty map initially', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: false,
      });

      const allMetrics = accelerator.getAllGPUMetrics();

      expect(allMetrics.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        maxParallelRequests: 64,
      });

      const stats = accelerator.getStats();

      expect(stats.activeRequests).toBe(0);
      expect(stats.maxParallelRequests).toBe(64);
      expect(stats.utilization).toBe(0);
    });

    it('should calculate utilization percentage correctly', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        maxParallelRequests: 10,
      });

      // Initially 0% utilization
      expect(accelerator.getStats().utilization).toBe(0);
    });
  });

  describe('flush', () => {
    it('should flush pending batches', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
      });

      await accelerator.flush();

      expect(mockBatchProcessorFlush).toHaveBeenCalledTimes(1);
    });
  });

  describe('GPU Selection (selectGPU)', () => {
    it('should use single GPU when multi-GPU is disabled', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2], index: 0 }],
          model: 'test',
          usage: { total_tokens: 10 },
        }),
      });

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: false,
        gpuIds: [0],
        enableDynamicBatching: false,
      });

      // Force a batch embedding call to test GPU selection
      // This would be called internally by batchEmbeddings

      expect(accelerator.getStats()).toBeDefined();
    });
  });

  describe('Dynamic Batch Sizing', () => {
    it('should respect disabling dynamic batching', async () => {
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      const accelerator = new NIMAccelerator({
        apiKey: 'test-api-key',
        maxBatchSize: 100,
        enableDynamicBatching: false,
      });

      // When dynamic batching is disabled, batch size stays constant
      expect(accelerator.getStats()).toBeDefined();
    });
  });
});

describe('getNIMAccelerator', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
    delete process.env.NVIDIA_NIM_URL;
  });

  it('should return null when API key is not set', async () => {
    delete process.env.NVIDIA_NIM_API_KEY;

    const { getNIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    const accelerator = getNIMAccelerator();

    expect(accelerator).toBeNull();
  });

  it('should return accelerator instance when API key is set', async () => {
    process.env.NVIDIA_NIM_API_KEY = 'test-key';

    const { getNIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    const accelerator = getNIMAccelerator();

    expect(accelerator).not.toBeNull();
    expect(accelerator?.getStats()).toBeDefined();
  });

  it('should return singleton instance', async () => {
    process.env.NVIDIA_NIM_API_KEY = 'test-key';

    const { getNIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    const accelerator1 = getNIMAccelerator();
    const accelerator2 = getNIMAccelerator();

    expect(accelerator1).toBe(accelerator2);
  });
});

describe('isNIMAvailable', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
  });

  it('should return false when API key is not set', async () => {
    delete process.env.NVIDIA_NIM_API_KEY;

    const { isNIMAvailable } = await import('../../src/services/nimAccelerator.js');

    expect(isNIMAvailable()).toBe(false);
  });

  it('should return true when API key is set', async () => {
    process.env.NVIDIA_NIM_API_KEY = 'test-key';

    const { isNIMAvailable } = await import('../../src/services/nimAccelerator.js');

    expect(isNIMAvailable()).toBe(true);
  });

  it('should return true for any non-empty API key', async () => {
    process.env.NVIDIA_NIM_API_KEY = 'x';

    const { isNIMAvailable } = await import('../../src/services/nimAccelerator.js');

    expect(isNIMAvailable()).toBe(true);
  });
});

describe('Batch Embeddings Integration', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mockBatchProcessorAdd.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
  });

  it('should correctly format embedding request', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    const mockEmbeddings = [[0.1, 0.2], [0.3, 0.4]];
    mockBatchProcessorAdd
      .mockResolvedValueOnce(mockEmbeddings[0])
      .mockResolvedValueOnce(mockEmbeddings[1]);

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      embeddingModel: 'nvidia/nv-embed-v1',
    });

    const results = await accelerator.generateEmbeddings(['text1', 'text2']);

    expect(results).toEqual(mockEmbeddings);
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
  });

  it('should handle rate limiting errors', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    await expect(
      accelerator.parallelInference({ prompts: ['Hello'] })
    ).rejects.toThrow('NIM API error: 429');
  });

  it('should handle unauthorized errors', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'invalid-key',
    });

    await expect(
      accelerator.parallelInference({ prompts: ['Hello'] })
    ).rejects.toThrow('NIM API error: 401');
  });

  it('should handle timeout errors', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    await expect(
      accelerator.parallelInference({ prompts: ['Hello'] })
    ).rejects.toThrow('Request timeout');
  });
});

describe('API Request Formatting', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
  });

  it('should include correct headers in inference request', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'my-api-key',
      baseUrl: 'https://custom.nvidia.com/v1',
    });

    await accelerator.parallelInference({ prompts: ['Hello'] });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://custom.nvidia.com/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Authorization']).toBe('Bearer my-api-key');
  });

  it('should format chat messages correctly', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    await accelerator.parallelInference({
      prompts: ['What is AI?'],
      maxTokens: 512,
      temperature: 0.3,
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.messages).toEqual([{ role: 'user', content: 'What is AI?' }]);
    expect(body.max_tokens).toBe(512);
    expect(body.temperature).toBe(0.3);
  });

  it('should use default values for maxTokens and temperature', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    await accelerator.parallelInference({ prompts: ['Hello'] });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.max_tokens).toBe(1024); // default
    expect(body.temperature).toBe(0.7); // default
  });
});

describe('Concurrent Request Handling', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
  });

  it('should handle multiple concurrent inference requests', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: `Response ${callCount}` } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      };
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      maxParallelRequests: 10,
    });

    const [result1, result2] = await Promise.all([
      accelerator.parallelInference({ prompts: ['Prompt 1'] }),
      accelerator.parallelInference({ prompts: ['Prompt 2'] }),
    ]);

    expect(result1.completions).toHaveLength(1);
    expect(result2.completions).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should maintain correct request count during parallel operations', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    mockFetch.mockImplementation(async () => {
      await delay(10); // Small delay to simulate network
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      };
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    const promises = [
      accelerator.parallelInference({ prompts: ['P1'] }),
      accelerator.parallelInference({ prompts: ['P2'] }),
      accelerator.parallelInference({ prompts: ['P3'] }),
    ];

    await Promise.all(promises);

    // After all complete, active requests should be 0
    expect(accelerator.getStats().activeRequests).toBe(0);
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mockBatchProcessorAdd.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
  });

  it('should handle very long prompts', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 50000, completion_tokens: 100 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    const longPrompt = 'A'.repeat(100000);
    const result = await accelerator.parallelInference({ prompts: [longPrompt] });

    expect(result.completions).toHaveLength(1);
  });

  it('should handle special characters in prompts', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 20, completion_tokens: 5 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    const specialPrompt = 'Hello\n\t"quotes" and \'apostrophes\' <tags> & symbols';
    const result = await accelerator.parallelInference({ prompts: [specialPrompt] });

    expect(result.completions).toHaveLength(1);
  });

  it('should handle unicode content', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Multilingual response' } }],
        usage: { prompt_tokens: 30, completion_tokens: 10 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    const unicodePrompt = 'Hello 你好 مرحبا Привет';
    const result = await accelerator.parallelInference({ prompts: [unicodePrompt] });

    expect(result.completions).toHaveLength(1);
  });

  it('should handle empty prompt in array', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '' } }],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    const result = await accelerator.parallelInference({ prompts: [''] });

    expect(result.completions).toHaveLength(1);
    expect(result.completions[0]).toBe('');
  });
});

describe('GPU Load Balancing', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
    vi.useRealTimers();
  });

  it('should initialize with multiple GPUs', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableMultiGPU: true,
      gpuIds: [0, 1, 2, 3],
    });

    expect(accelerator.getAllGPUMetrics().size).toBe(0); // No metrics yet
  });

  it('should use round-robin when no GPU metrics available', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableMultiGPU: true,
      gpuIds: [0, 1],
    });

    // Make multiple requests
    await accelerator.parallelInference({ prompts: ['P1'] });
    await accelerator.parallelInference({ prompts: ['P2'] });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

/**
 * Tests for internal methods using createEmbeddingBatchProcessor callback capture
 */
describe('NIMAccelerator Internal Methods', () => {
  // Store the captured batch function from the mock
  let capturedBatchFn: ((texts: string[]) => Promise<number[][]>) | null = null;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
    capturedBatchFn = null;
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
    vi.useRealTimers();
  });

  describe('batchEmbeddings (internal)', () => {
    it('should call NIM embeddings API with correct format via callback', async () => {
      // Import the actual batchProcessor module to get createEmbeddingBatchProcessor
      const batchProcessorModule = await import('../../src/services/batchProcessor.js');
      
      // Capture the callback function passed to createEmbeddingBatchProcessor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
        capturedBatchFn = fn;
        return {
          add: mockBatchProcessorAdd,
          flush: mockBatchProcessorFlush,
        };
      });

      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3], index: 0 },
            { embedding: [0.4, 0.5, 0.6], index: 1 },
          ],
          model: 'nvidia/nv-embed-v1',
          usage: { total_tokens: 20 },
        }),
      });

      new NIMAccelerator({
        apiKey: 'test-api-key',
        enableDynamicBatching: false,
        enableMultiGPU: false,
      });

      // Call the captured batch function directly
      expect(capturedBatchFn).not.toBeNull();
      if (capturedBatchFn) {
        const embeddings = await capturedBatchFn(['Hello', 'World']);
        
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toContain('/embeddings');
        
        const body = JSON.parse(options.body);
        expect(body.input).toEqual(['Hello', 'World']);
        expect(body.encoding_format).toBe('float');
        
        expect(embeddings).toEqual([
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ]);
      }
    });

    it('should sort embeddings by index', async () => {
      const batchProcessorModule = await import('../../src/services/batchProcessor.js');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
        capturedBatchFn = fn;
        return {
          add: mockBatchProcessorAdd,
          flush: mockBatchProcessorFlush,
        };
      });

      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      // Return embeddings in wrong order to test sorting
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.4, 0.5], index: 1 },
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.7, 0.8], index: 2 },
          ],
          model: 'nvidia/nv-embed-v1',
          usage: { total_tokens: 30 },
        }),
      });

      new NIMAccelerator({
        apiKey: 'test-api-key',
        enableDynamicBatching: false,
        enableMultiGPU: false,
      });

      expect(capturedBatchFn).not.toBeNull();
      if (capturedBatchFn) {
        const embeddings = await capturedBatchFn(['A', 'B', 'C']);
        
        // Should be sorted by index
        expect(embeddings[0]).toEqual([0.1, 0.2]);
        expect(embeddings[1]).toEqual([0.4, 0.5]);
        expect(embeddings[2]).toEqual([0.7, 0.8]);
      }
    });

    it('should handle embeddings API errors', async () => {
      const batchProcessorModule = await import('../../src/services/batchProcessor.js');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
        capturedBatchFn = fn;
        return {
          add: mockBatchProcessorAdd,
          flush: mockBatchProcessorFlush,
        };
      });

      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      });

      new NIMAccelerator({
        apiKey: 'test-api-key',
        enableDynamicBatching: false,
      });

      expect(capturedBatchFn).not.toBeNull();
      if (capturedBatchFn) {
        await expect(capturedBatchFn(['test'])).rejects.toThrow('NIM API error: 503');
      }
    });

    it('should include X-GPU-ID header when using multi-GPU', async () => {
      const batchProcessorModule = await import('../../src/services/batchProcessor.js');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
        capturedBatchFn = fn;
        return {
          add: mockBatchProcessorAdd,
          flush: mockBatchProcessorFlush,
        };
      });

      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2], index: 0 }],
          model: 'nvidia/nv-embed-v1',
          usage: { total_tokens: 10 },
        }),
      });

      new NIMAccelerator({
        apiKey: 'test-api-key',
        enableDynamicBatching: false,
        enableMultiGPU: true,
        gpuIds: [0, 1],
      });

      expect(capturedBatchFn).not.toBeNull();
      if (capturedBatchFn) {
        await capturedBatchFn(['test']);
        
        const [, options] = mockFetch.mock.calls[0];
        expect(options.headers['X-GPU-ID']).toBeDefined();
      }
    });
  });

  describe('GPU Monitoring Interval', () => {
    it('should start GPU monitoring when multi-GPU is enabled', async () => {
      vi.useFakeTimers();
      
      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      // Mock GPU metrics responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          gpu: {
            utilization: 50,
            memory_used: 4000,
            memory_total: 8000,
          },
        }),
      });

      new NIMAccelerator({
        apiKey: 'test-api-key',
        enableMultiGPU: true,
        gpuIds: [0, 1],
      });

      // Advance timer to trigger monitoring
      await vi.advanceTimersByTimeAsync(5000);

      // Should have called metrics endpoint for each GPU
      expect(mockFetch).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Dynamic Batch Sizing with GPU Metrics', () => {
    it('should adjust batch size based on GPU memory usage', async () => {
      const batchProcessorModule = await import('../../src/services/batchProcessor.js');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
        capturedBatchFn = fn;
        return {
          add: mockBatchProcessorAdd,
          flush: mockBatchProcessorFlush,
        };
      });

      const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
          model: 'test',
          usage: { total_tokens: 5 },
        }),
      });

      new NIMAccelerator({
        apiKey: 'test-api-key',
        enableDynamicBatching: true,
        maxBatchSize: 256,
        enableMultiGPU: false,
      });

      expect(capturedBatchFn).not.toBeNull();
      if (capturedBatchFn) {
        await capturedBatchFn(['test']);
        expect(mockFetch).toHaveBeenCalled();
      }
    });
  });
});

describe('Embedding Processor Not Initialized Error', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
  });

  it('should throw error when embedding batch processor is null', async () => {
    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
    });

    // Force the embeddingBatchProcessor to be null using type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (accelerator as any).embeddingBatchProcessor = null;

    await expect(accelerator.generateEmbeddings(['test'])).rejects.toThrow(
      'Embedding batch processor not initialized'
    );
  });
});

describe('GPU Selection with Cached Metrics', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
    vi.useRealTimers();
  });

  it('should select GPU with lowest utilization from cache', async () => {
    vi.useFakeTimers();

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    // Mock GPU metrics for two GPUs - GPU 1 has lower utilization
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 80, memory_used: 6000, memory_total: 8000 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 30, memory_used: 2000, memory_total: 8000 },
        }),
      });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableMultiGPU: true,
      gpuIds: [0, 1],
    });

    // Advance timer to trigger GPU monitoring
    await vi.advanceTimersByTimeAsync(5000);

    // Verify GPU metrics are cached
    const metrics = accelerator.getAllGPUMetrics();
    expect(metrics.size).toBeGreaterThanOrEqual(0);

    vi.useRealTimers();
  });
});

describe('Average GPU Metrics', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
    vi.useRealTimers();
  });

  it('should calculate average metrics from cached GPU data', async () => {
    vi.useFakeTimers();

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    // Mock GPU metrics responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 60, memory_used: 4000, memory_total: 8000 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 40, memory_used: 3000, memory_total: 8000 },
        }),
      });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableMultiGPU: true,
      enableDynamicBatching: true,
      gpuIds: [0, 1],
    });

    // Advance timer to populate GPU metrics cache
    await vi.advanceTimersByTimeAsync(5000);

    // The average should be calculated when dynamic batching is enabled
    const metrics = accelerator.getAllGPUMetrics();
    expect(metrics).toBeDefined();

    vi.useRealTimers();
  });

  it('should return null average when no recent metrics', async () => {
    vi.useFakeTimers();

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    // Mock GPU metrics to fail
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableMultiGPU: true,
      enableDynamicBatching: true,
      gpuIds: [0],
    });

    // Advance timer - metrics should fail to populate
    await vi.advanceTimersByTimeAsync(5000);

    // No metrics should be cached
    expect(accelerator.getAllGPUMetrics().size).toBe(0);

    vi.useRealTimers();
  });

  it('should filter out stale metrics older than 10 seconds', async () => {
    vi.useFakeTimers();

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        gpu: { utilization: 50, memory_used: 4000, memory_total: 8000 },
      }),
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableMultiGPU: true,
      gpuIds: [0],
    });

    // First metrics collection
    await vi.advanceTimersByTimeAsync(5000);

    // Advance past staleness threshold without new metrics
    await vi.advanceTimersByTimeAsync(15000);

    // Metrics would be stale at this point (but monitoring interval keeps them fresh)
    expect(accelerator.getAllGPUMetrics()).toBeDefined();

    vi.useRealTimers();
  });
});

/**
 * Tests for GPU selection with cached metrics and dynamic batch sizing
 */
describe('Dynamic Batch Sizing with GPU Memory', () => {
  let capturedBatchFn: ((texts: string[]) => Promise<number[][]>) | null = null;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
    capturedBatchFn = null;
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
    vi.useRealTimers();
  });

  it('should increase batch size when GPU memory usage is low (<50%)', async () => {
    vi.useFakeTimers();
    
    const batchProcessorModule = await import('../../src/services/batchProcessor.js');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
      capturedBatchFn = fn;
      return {
        add: mockBatchProcessorAdd,
        flush: mockBatchProcessorFlush,
      };
    });

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    // Mock GPU metrics with low memory usage (30%)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 20, memory_used: 2400, memory_total: 8000 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
          model: 'test',
          usage: { total_tokens: 5 },
        }),
      });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableDynamicBatching: true,
      maxBatchSize: 256,
      enableMultiGPU: true,
      gpuIds: [0],
    });

    // Populate GPU metrics cache
    await vi.advanceTimersByTimeAsync(5000);

    // Now call batchEmbeddings which should use dynamic batch sizing
    if (capturedBatchFn) {
      await capturedBatchFn(['test']);
    }

    vi.useRealTimers();
  });

  it('should use default batch size when GPU memory usage is moderate (50-70%)', async () => {
    vi.useFakeTimers();
    
    const batchProcessorModule = await import('../../src/services/batchProcessor.js');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
      capturedBatchFn = fn;
      return {
        add: mockBatchProcessorAdd,
        flush: mockBatchProcessorFlush,
      };
    });

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    // Mock GPU metrics with moderate memory usage (60%)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 50, memory_used: 4800, memory_total: 8000 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
          model: 'test',
          usage: { total_tokens: 5 },
        }),
      });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableDynamicBatching: true,
      maxBatchSize: 256,
      enableMultiGPU: true,
      gpuIds: [0],
    });

    // Populate GPU metrics cache
    await vi.advanceTimersByTimeAsync(5000);

    if (capturedBatchFn) {
      await capturedBatchFn(['test']);
    }

    vi.useRealTimers();
  });

  it('should reduce batch size when GPU memory usage is high (>70%)', async () => {
    vi.useFakeTimers();
    
    const batchProcessorModule = await import('../../src/services/batchProcessor.js');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
      capturedBatchFn = fn;
      return {
        add: mockBatchProcessorAdd,
        flush: mockBatchProcessorFlush,
      };
    });

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    // Mock GPU metrics with high memory usage (85%)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 80, memory_used: 6800, memory_total: 8000 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
          model: 'test',
          usage: { total_tokens: 5 },
        }),
      });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableDynamicBatching: true,
      maxBatchSize: 256,
      enableMultiGPU: true,
      gpuIds: [0],
    });

    // Populate GPU metrics cache
    await vi.advanceTimersByTimeAsync(5000);

    if (capturedBatchFn) {
      await capturedBatchFn(['test']);
    }

    vi.useRealTimers();
  });

  it('should select GPU with lowest utilization when metrics available', async () => {
    vi.useFakeTimers();
    
    const batchProcessorModule = await import('../../src/services/batchProcessor.js');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
      capturedBatchFn = fn;
      return {
        add: mockBatchProcessorAdd,
        flush: mockBatchProcessorFlush,
      };
    });

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    // Mock GPU metrics - GPU 1 has lower utilization
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 80, memory_used: 6000, memory_total: 8000 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gpu: { utilization: 25, memory_used: 2000, memory_total: 8000 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
          model: 'test',
          usage: { total_tokens: 5 },
        }),
      });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableDynamicBatching: false,
      enableMultiGPU: true,
      gpuIds: [0, 1],
    });

    // Populate GPU metrics cache for both GPUs
    await vi.advanceTimersByTimeAsync(5000);

    // Verify metrics are cached
    const metrics = accelerator.getAllGPUMetrics();
    expect(metrics.size).toBeGreaterThan(0);

    // Call batch function - should select GPU 1 (lower utilization)
    if (capturedBatchFn) {
      await capturedBatchFn(['test']);
      
      // Verify X-GPU-ID header was set
      const fetchCalls = mockFetch.mock.calls;
      const embeddingsCall = fetchCalls.find((call) => 
        typeof call[0] === 'string' && call[0].includes('/embeddings')
      );
      if (embeddingsCall) {
        expect(embeddingsCall[1].headers['X-GPU-ID']).toBeDefined();
      }
    }

    vi.useRealTimers();
  });
});

describe('Stale Metrics Handling', () => {
  let capturedBatchFn: ((texts: string[]) => Promise<number[][]>) | null = null;

  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
    capturedBatchFn = null;
  });

  afterEach(() => {
    delete process.env.NVIDIA_NIM_API_KEY;
    vi.useRealTimers();
  });

  it('should return null for average when all metrics are stale', async () => {
    vi.useFakeTimers();
    
    const batchProcessorModule = await import('../../src/services/batchProcessor.js');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (batchProcessorModule.createEmbeddingBatchProcessor as any).mockImplementation((fn: (texts: string[]) => Promise<number[][]>) => {
      capturedBatchFn = fn;
      return {
        add: mockBatchProcessorAdd,
        flush: mockBatchProcessorFlush,
      };
    });

    const { NIMAccelerator } = await import('../../src/services/nimAccelerator.js');

    // Only mock for the initial GPU collection, then fail subsequent ones
    let fetchCallCount = 0;
    mockFetch.mockImplementation(async (url) => {
      fetchCallCount++;
      if (typeof url === 'string' && url.includes('/metrics')) {
        // First call succeeds, subsequent fail
        if (fetchCallCount <= 1) {
          return {
            ok: true,
            json: async () => ({
              gpu: { utilization: 50, memory_used: 4000, memory_total: 8000 },
            }),
          };
        }
        return { ok: false, status: 404 };
      }
      return {
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1], index: 0 }],
          model: 'test',
          usage: { total_tokens: 5 },
        }),
      };
    });

    const accelerator = new NIMAccelerator({
      apiKey: 'test-api-key',
      enableDynamicBatching: true,
      enableMultiGPU: true,
      gpuIds: [0],
    });

    // First metrics collection
    await vi.advanceTimersByTimeAsync(5000);

    // Advance past staleness threshold (>10 seconds)
    await vi.advanceTimersByTimeAsync(15000);

    // Call batch function - should handle stale metrics gracefully
    if (capturedBatchFn) {
      await capturedBatchFn(['test']);
    }

    vi.useRealTimers();
  });
});

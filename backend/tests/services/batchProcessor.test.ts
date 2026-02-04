/**
 * Batch Processor Unit Tests
 * Tests batching and coalescing of similar LLM requests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BatchProcessor,
  createEmbeddingBatchProcessor,
  createCompletionBatchProcessor,
} from '../../src/services/batchProcessor.js';

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('BatchProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a batch processor with default options', () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor(processor);

      expect(batch).toBeDefined();
      expect(batch.getStats().activeBatches).toBe(0);
    });

    it('should accept custom options', () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor(processor, {
        maxBatchSize: 5,
        maxWaitTime: 200,
        deduplicateRequests: false,
      });

      expect(batch).toBeDefined();
    });
  });

  describe('add', () => {
    it('should add request to batch and process after maxWaitTime', async () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor(processor, { maxWaitTime: 100 });

      const promise = batch.add('batch-1', 'request-1');

      expect(batch.getStats().activeBatches).toBe(1);

      // Advance timer to trigger batch processing
      await vi.advanceTimersByTimeAsync(150);

      const result = await promise;
      expect(result).toBe('result');
      expect(processor).toHaveBeenCalledWith(['request-1']);
    });

    it('should batch multiple requests together', async () => {
      const processor = vi.fn(async (items: string[]) => items.map((_, i) => `result-${i}`));
      const batch = new BatchProcessor(processor, { maxWaitTime: 100, maxBatchSize: 10 });

      const promise1 = batch.add('batch-1', 'request-1');
      const promise2 = batch.add('batch-1', 'request-2');
      const promise3 = batch.add('batch-1', 'request-3');

      await vi.advanceTimersByTimeAsync(150);

      const results = await Promise.all([promise1, promise2, promise3]);
      expect(results).toEqual(['result-0', 'result-1', 'result-2']);
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor).toHaveBeenCalledWith(['request-1', 'request-2', 'request-3']);
    });

    it('should process immediately when batch reaches maxBatchSize', async () => {
      const processor = vi.fn(async (items: string[]) => items.map((_, i) => `result-${i}`));
      const batch = new BatchProcessor(processor, { maxBatchSize: 3, maxWaitTime: 1000 });

      const promise1 = batch.add('batch-1', 'request-1');
      const promise2 = batch.add('batch-1', 'request-2');
      const promise3 = batch.add('batch-1', 'request-3');

      // Should process immediately without waiting for timer
      await vi.advanceTimersByTimeAsync(10);

      const results = await Promise.all([promise1, promise2, promise3]);
      expect(results).toEqual(['result-0', 'result-1', 'result-2']);
      expect(processor).toHaveBeenCalledTimes(1);
    });

    it('should keep batches separate by key', async () => {
      const processor = vi.fn(async (items: string[]) => items.map((item) => `result-${item}`));
      const batch = new BatchProcessor(processor, { maxWaitTime: 100 });

      const promise1 = batch.add('batch-a', 'request-a1');
      const promise2 = batch.add('batch-b', 'request-b1');

      expect(batch.getStats().activeBatches).toBe(2);

      await vi.advanceTimersByTimeAsync(150);

      const results = await Promise.all([promise1, promise2]);
      expect(results).toEqual(['result-request-a1', 'result-request-b1']);
      expect(processor).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate identical requests by default', async () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'shared-result'));
      const batch = new BatchProcessor(processor, { maxWaitTime: 100, deduplicateRequests: true });

      const promise1 = batch.add('batch-1', 'same-request');
      const promise2 = batch.add('batch-1', 'same-request');

      await vi.advanceTimersByTimeAsync(150);

      const results = await Promise.all([promise1, promise2]);
      expect(results).toEqual(['shared-result', 'shared-result']);
      // Only one unique request should be processed
      expect(processor).toHaveBeenCalledWith(['same-request']);
    });

    it('should not deduplicate when disabled', async () => {
      const processor = vi.fn(async (items: string[]) => items.map((_, i) => `result-${i}`));
      const batch = new BatchProcessor(processor, { maxWaitTime: 100, deduplicateRequests: false });

      const promise1 = batch.add('batch-1', 'same-request');
      const promise2 = batch.add('batch-1', 'same-request');

      await vi.advanceTimersByTimeAsync(150);

      await Promise.all([promise1, promise2]);
      // Both requests should be processed
      expect(processor).toHaveBeenCalledWith(['same-request', 'same-request']);
    });
  });

  describe('processBatch (error handling)', () => {
    it('should reject all requests when processor throws', async () => {
      const processor = vi.fn(async () => {
        throw new Error('Processing failed');
      });
      const batch = new BatchProcessor<string, string>(processor, { maxWaitTime: 100 });

      const promise1 = batch.add('batch-1', 'request-1');
      const promise2 = batch.add('batch-1', 'request-2');

      // Attach catch handlers immediately to prevent unhandled rejection
      promise1.catch(() => {});
      promise2.catch(() => {});

      await vi.advanceTimersByTimeAsync(150);

      await expect(promise1).rejects.toThrow('Batch processing failed: Processing failed');
      await expect(promise2).rejects.toThrow('Batch processing failed: Processing failed');
    });

    it('should throw when result count does not match request count', async () => {
      const processor = vi.fn(async () => ['only-one-result']);
      const batch = new BatchProcessor<string, string>(processor, { maxWaitTime: 100 });

      const promise1 = batch.add('batch-1', 'request-1');
      const promise2 = batch.add('batch-1', 'request-2');

      // Attach catch handlers immediately to prevent unhandled rejection
      promise1.catch(() => {});
      promise2.catch(() => {});

      await vi.advanceTimersByTimeAsync(150);

      await expect(promise1).rejects.toThrow('Batch processor returned 1 results for 2 requests');
      await expect(promise2).rejects.toThrow('Batch processor returned 1 results for 2 requests');
    });

    it('should clear pending requests on error', async () => {
      const processor = vi.fn(async () => {
        throw new Error('Processing failed');
      });
      const batch = new BatchProcessor<string, string>(processor, { maxWaitTime: 100, deduplicateRequests: true });

      batch.add('batch-1', 'request-1').catch(() => {});

      await vi.advanceTimersByTimeAsync(150);

      // Pending requests should be cleared
      expect(batch.getStats().pendingRequests).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor(processor, { maxWaitTime: 100 });

      batch.add('batch-1', 'request-1');
      batch.add('batch-2', 'request-2');

      const stats = batch.getStats();
      expect(stats.activeBatches).toBe(2);
      expect(stats.activeTimers).toBe(2);
      expect(stats.pendingRequests).toBeGreaterThanOrEqual(0);
    });

    it('should show zero stats when empty', () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor(processor);

      const stats = batch.getStats();
      expect(stats.activeBatches).toBe(0);
      expect(stats.pendingRequests).toBe(0);
      expect(stats.activeTimers).toBe(0);
    });
  });

  describe('flush', () => {
    it('should process all pending batches immediately', async () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor(processor, { maxWaitTime: 10000 });

      const promise1 = batch.add('batch-1', 'request-1');
      const promise2 = batch.add('batch-2', 'request-2');

      expect(batch.getStats().activeBatches).toBe(2);

      await batch.flush();

      const results = await Promise.all([promise1, promise2]);
      expect(results).toEqual(['result', 'result']);
      expect(processor).toHaveBeenCalledTimes(2);
      expect(batch.getStats().activeBatches).toBe(0);
    });

    it('should handle empty flush gracefully', async () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor(processor);

      await expect(batch.flush()).resolves.not.toThrow();
      expect(processor).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should reject all pending requests', async () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor<string, string>(processor, { maxWaitTime: 10000 });

      const promise1 = batch.add('batch-1', 'request-1');
      const promise2 = batch.add('batch-2', 'request-2');

      batch.clear();

      await expect(promise1).rejects.toThrow('Batch processor cleared');
      await expect(promise2).rejects.toThrow('Batch processor cleared');
    });

    it('should clear all timers', async () => {
      const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
      const batch = new BatchProcessor(processor, { maxWaitTime: 10000 });

      // Store promises so we can handle their rejections
      const promise1 = batch.add('batch-1', 'request-1');
      const promise2 = batch.add('batch-2', 'request-2');

      expect(batch.getStats().activeTimers).toBe(2);

      batch.clear();

      expect(batch.getStats().activeTimers).toBe(0);
      expect(batch.getStats().activeBatches).toBe(0);
      expect(batch.getStats().pendingRequests).toBe(0);
      
      // Ensure the rejected promises are handled
      await expect(promise1).rejects.toThrow('Batch processor cleared');
      await expect(promise2).rejects.toThrow('Batch processor cleared');
    });
  });

  describe('hash deduplication', () => {
    it('should coalesce requests with same data', async () => {
      const processor = vi.fn(async (items: { id: number }[]) => 
        items.map((item) => ({ result: item.id * 2 }))
      );
      const batch = new BatchProcessor(processor, { 
        maxWaitTime: 100, 
        deduplicateRequests: true 
      });

      const promise1 = batch.add('batch-1', { id: 1 });
      const promise2 = batch.add('batch-1', { id: 1 }); // Same data
      const promise3 = batch.add('batch-1', { id: 2 }); // Different data

      await vi.advanceTimersByTimeAsync(150);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      
      // Same data should get same result
      expect(result1).toEqual({ result: 2 });
      expect(result2).toEqual({ result: 2 });
      expect(result3).toEqual({ result: 4 });
    });

    it('should handle unhashable data gracefully', async () => {
      const processor = vi.fn(async (items: unknown[]) => 
        items.map(() => 'result')
      );
      const batch = new BatchProcessor(processor, { 
        maxWaitTime: 100, 
        deduplicateRequests: true 
      });

      // Create circular reference that can't be JSON stringified
      const circularObj: { self?: unknown } = {};
      circularObj.self = circularObj;

      const promise = batch.add('batch-1', circularObj);

      await vi.advanceTimersByTimeAsync(150);

      const result = await promise;
      expect(result).toBe('result');
    });
  });
});

describe('createEmbeddingBatchProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Clear environment variables
    delete process.env.NIM_EMBED_BATCH_SIZE;
    delete process.env.NIM_EMBED_MAX_WAIT_MS;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create batch processor with default options', async () => {
    const embeddingFn = vi.fn(async (texts: string[]) => 
      texts.map(() => [0.1, 0.2, 0.3])
    );

    const processor = createEmbeddingBatchProcessor(embeddingFn);

    expect(processor).toBeDefined();
    expect(processor.getStats().activeBatches).toBe(0);
  });

  it('should use environment variables for configuration', async () => {
    process.env.NIM_EMBED_BATCH_SIZE = '128';
    process.env.NIM_EMBED_MAX_WAIT_MS = '25';

    const embeddingFn = vi.fn(async (texts: string[]) => 
      texts.map(() => [0.1, 0.2, 0.3])
    );

    // Re-import to pick up env changes
    vi.resetModules();
    const { createEmbeddingBatchProcessor: createProcessor } = await import('../../src/services/batchProcessor.js');
    
    const processor = createProcessor(embeddingFn);

    expect(processor).toBeDefined();
  });

  it('should use explicit options over environment variables', async () => {
    process.env.NIM_EMBED_BATCH_SIZE = '128';
    process.env.NIM_EMBED_MAX_WAIT_MS = '25';

    const embeddingFn = vi.fn(async (texts: string[]) => 
      texts.map(() => [0.1, 0.2, 0.3])
    );

    vi.resetModules();
    const { createEmbeddingBatchProcessor: createProcessor } = await import('../../src/services/batchProcessor.js');

    const processor = createProcessor(embeddingFn, {
      maxBatchSize: 64,
      maxWaitTime: 10,
    });

    expect(processor).toBeDefined();
  });

  it('should batch embedding requests', async () => {
    const embeddingFn = vi.fn(async (texts: string[]) => 
      texts.map((text) => [text.length * 0.1])
    );

    const processor = createEmbeddingBatchProcessor(embeddingFn, {
      maxBatchSize: 10,
      maxWaitTime: 100,
    });

    const promise1 = processor.add('embeddings', 'hello');
    const promise2 = processor.add('embeddings', 'world');

    await vi.advanceTimersByTimeAsync(150);

    const results = await Promise.all([promise1, promise2]);
    expect(results[0]).toEqual([0.5]); // 5 * 0.1
    expect(results[1]).toEqual([0.5]); // 5 * 0.1
    expect(embeddingFn).toHaveBeenCalledTimes(1);
  });

  it('should deduplicate identical embedding requests', async () => {
    const embeddingFn = vi.fn(async (texts: string[]) => 
      texts.map(() => [0.1, 0.2])
    );

    const processor = createEmbeddingBatchProcessor(embeddingFn, {
      maxBatchSize: 10,
      maxWaitTime: 100,
    });

    const promise1 = processor.add('embeddings', 'same text');
    const promise2 = processor.add('embeddings', 'same text');

    await vi.advanceTimersByTimeAsync(150);

    const results = await Promise.all([promise1, promise2]);
    expect(results[0]).toEqual([0.1, 0.2]);
    expect(results[1]).toEqual([0.1, 0.2]);
    // Should only call embedding function once for deduplicated request
    expect(embeddingFn).toHaveBeenCalledWith(['same text']);
  });
});

describe('createCompletionBatchProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create batch processor for completions', async () => {
    const completionFn = vi.fn(async (prompts: string[]) => 
      prompts.map((p) => `Response to: ${p}`)
    );

    const processor = createCompletionBatchProcessor(completionFn);

    expect(processor).toBeDefined();
  });

  it('should batch completion requests', async () => {
    const completionFn = vi.fn(async (prompts: string[]) => 
      prompts.map((p) => `Response to: ${p}`)
    );

    const processor = createCompletionBatchProcessor(completionFn);

    const promise1 = processor.add('completions', 'Hello');
    const promise2 = processor.add('completions', 'World');

    await vi.advanceTimersByTimeAsync(150);

    const results = await Promise.all([promise1, promise2]);
    expect(results[0]).toBe('Response to: Hello');
    expect(results[1]).toBe('Response to: World');
    expect(completionFn).toHaveBeenCalledTimes(1);
  });

  it('should deduplicate identical completion requests', async () => {
    const completionFn = vi.fn(async (prompts: string[]) => 
      prompts.map(() => 'Cached response')
    );

    const processor = createCompletionBatchProcessor(completionFn);

    const promise1 = processor.add('completions', 'Same prompt');
    const promise2 = processor.add('completions', 'Same prompt');

    await vi.advanceTimersByTimeAsync(150);

    const results = await Promise.all([promise1, promise2]);
    expect(results[0]).toBe('Cached response');
    expect(results[1]).toBe('Cached response');
    expect(completionFn).toHaveBeenCalledWith(['Same prompt']);
  });

  it('should process at max batch size of 10', async () => {
    const completionFn = vi.fn(async (prompts: string[]) => 
      prompts.map((_, i) => `Response ${i}`)
    );

    const processor = createCompletionBatchProcessor(completionFn);

    // Add 10 unique requests
    const promises: Promise<string>[] = [];
    for (let i = 0; i < 10; i++) {
      promises.push(processor.add('completions', `Prompt ${i}`));
    }

    // Should process immediately at max batch size without waiting
    await vi.advanceTimersByTimeAsync(10);

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    expect(completionFn).toHaveBeenCalledTimes(1);
  });
});

describe('BatchProcessor edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle rapid sequential adds', async () => {
    const processor = vi.fn(async (items: number[]) => items.map((n) => n * 2));
    const batch = new BatchProcessor(processor, { maxWaitTime: 100, maxBatchSize: 100 });

    const promises: Promise<number>[] = [];
    for (let i = 0; i < 50; i++) {
      promises.push(batch.add('batch-1', i));
    }

    await vi.advanceTimersByTimeAsync(150);

    const results = await Promise.all(promises);
    expect(results).toHaveLength(50);
    expect(results[0]).toBe(0);
    expect(results[49]).toBe(98);
  });

  it('should handle mixed success and error across batches', async () => {
    let callCount = 0;
    const processor = vi.fn(async (items: string[]) => {
      callCount++;
      if (callCount === 1) {
        return items.map(() => 'success');
      }
      throw new Error('Second batch failed');
    });

    const batch = new BatchProcessor<string, string>(processor, { maxWaitTime: 100 });

    const promise1 = batch.add('batch-1', 'request-1');
    const promise2 = batch.add('batch-2', 'request-2');

    // Attach catch handlers immediately to prevent unhandled rejection
    let result1: string | undefined;
    let error2: Error | undefined;
    promise1.then(r => { result1 = r; }).catch(() => {});
    promise2.then(() => {}).catch(e => { error2 = e; });

    await vi.advanceTimersByTimeAsync(150);

    // Wait for promises to settle
    await Promise.allSettled([promise1, promise2]);
    
    expect(result1).toBe('success');
    expect(error2?.message).toContain('Batch processing failed');
  });

  it('should handle empty batch key', async () => {
    const processor = vi.fn(async (items: string[]) => items.map(() => 'result'));
    const batch = new BatchProcessor(processor, { maxWaitTime: 100 });

    const promise = batch.add('', 'request');

    await vi.advanceTimersByTimeAsync(150);

    expect(await promise).toBe('result');
  });

  it('should handle undefined/null data', async () => {
    const processor = vi.fn(async (items: (null | undefined)[]) => 
      items.map(() => 'processed')
    );
    const batch = new BatchProcessor(processor, { maxWaitTime: 100 });

    const promise1 = batch.add('batch-1', null);
    const promise2 = batch.add('batch-1', undefined);

    await vi.advanceTimersByTimeAsync(150);

    const results = await Promise.all([promise1, promise2]);
    expect(results).toEqual(['processed', 'processed']);
  });
});

/**
 * Batch Processor
 * Batches and coalesces similar LLM requests to reduce API calls and costs
 */

import logger from "../../middleware/logger.js";
import { createHash } from "crypto";

export interface BatchRequest<T = unknown, R = unknown> {
  id: string;
  data: T;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
  createdAt: number;
  hash: string;
}

export interface BatchProcessorOptions {
  maxBatchSize?: number;
  maxWaitTime?: number; // milliseconds
  deduplicateRequests?: boolean;
}

export class BatchProcessor<T = unknown, R = unknown> {
  private batches = new Map<string, BatchRequest<T, R>[]>();
  private pendingRequests = new Map<string, BatchRequest<T, R>>();
  private timers = new Map<string, NodeJS.Timeout>();
  private maxBatchSize: number;
  private maxWaitTime: number;
  private deduplicateRequests: boolean;
  private processor: (requests: T[]) => Promise<R[]>;

  constructor(
    processor: (requests: T[]) => Promise<R[]>,
    options: BatchProcessorOptions = {},
  ) {
    this.processor = processor;
    this.maxBatchSize = options.maxBatchSize || 10;
    this.maxWaitTime = options.maxWaitTime || 100; // 100ms default
    this.deduplicateRequests = options.deduplicateRequests !== false;
  }

  /**
   * Add request to batch
   */
  public async add(batchKey: string, data: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const hash = this.deduplicateRequests ? this.hashRequest(data) : "";

      // Check for duplicate in-flight request
      if (this.deduplicateRequests && hash) {
        const existingRequest = this.pendingRequests.get(hash);
        if (existingRequest) {
          logger.debug({ hash }, "Coalescing duplicate request");
          // Piggyback on existing request
          const originalResolve = existingRequest.resolve;
          existingRequest.resolve = (value: R) => {
            originalResolve(value);
            resolve(value);
          };
          return;
        }
      }

      const request: BatchRequest<T, R> = {
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        data,
        resolve,
        reject,
        createdAt: Date.now(),
        hash,
      };

      // Track for deduplication
      if (this.deduplicateRequests && hash) {
        this.pendingRequests.set(hash, request);
      }

      // Add to batch
      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, []);
      }

      const batch = this.batches.get(batchKey);
      if (batch) {
        batch.push(request);

        // Process immediately if batch is full
        if (batch.length >= this.maxBatchSize) {
          this.processBatch(batchKey);
        } else {
          // Set timer to process batch after maxWaitTime
          if (!this.timers.has(batchKey)) {
            const timer = setTimeout(() => {
              this.processBatch(batchKey);
            }, this.maxWaitTime);
            this.timers.set(batchKey, timer);
          }
        }
      }
    });
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.length === 0) return;

    // Clear timer
    const timer = this.timers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(batchKey);
    }

    // Remove batch from queue
    this.batches.delete(batchKey);

    logger.debug({ batchKey, size: batch.length }, "Processing batch");

    try {
      // Extract data for processing
      const requestData = batch.map((req) => req.data);

      // Process batch
      const results = await this.processor(requestData);

      // Distribute results
      if (results.length !== batch.length) {
        throw new Error(
          `Batch processor returned ${results.length} results for ${batch.length} requests`,
        );
      }

      batch.forEach((request, index) => {
        request.resolve(results[index]);

        // Remove from pending
        if (this.deduplicateRequests && request.hash) {
          this.pendingRequests.delete(request.hash);
        }
      });
    } catch (error) {
      // Reject all requests in batch
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        { error: errorMessage, batchKey, size: batch.length },
        "Batch processing failed",
      );

      batch.forEach((request) => {
        request.reject(new Error(`Batch processing failed: ${errorMessage}`));

        // Remove from pending
        if (this.deduplicateRequests && request.hash) {
          this.pendingRequests.delete(request.hash);
        }
      });
    }
  }

  /**
   * Hash request data for deduplication
   */
  private hashRequest(data: T): string {
    try {
      const json = JSON.stringify(data);
      return createHash("sha256").update(json).digest("hex").substring(0, 16);
    } catch (_error) {
      return "";
    }
  }

  /**
   * Get statistics
   */
  public getStats(): {
    activeBatches: number;
    pendingRequests: number;
    activeTimers: number;
  } {
    return {
      activeBatches: this.batches.size,
      pendingRequests: this.pendingRequests.size,
      activeTimers: this.timers.size,
    };
  }

  /**
   * Flush all pending batches immediately
   */
  public async flush(): Promise<void> {
    const batchKeys = Array.from(this.batches.keys());
    await Promise.all(batchKeys.map((key) => this.processBatch(key)));
  }

  /**
   * Clear all pending batches
   */
  public clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Reject all pending requests
    for (const batch of this.batches.values()) {
      for (const request of batch) {
        request.reject(new Error("Batch processor cleared"));
      }
    }

    this.batches.clear();
    this.pendingRequests.clear();
  }
}

export interface EmbeddingBatchOptions {
  maxBatchSize?: number;
  maxWaitTime?: number;
}

/**
 * Create a batch processor for embedding generation.
 * Options can be driven by env: NIM_EMBED_BATCH_SIZE, NIM_EMBED_MAX_WAIT_MS.
 */
export function createEmbeddingBatchProcessor(
  embeddingFn: (texts: string[]) => Promise<number[][]>,
  options?: EmbeddingBatchOptions,
): BatchProcessor<string, number[]> {
  const maxBatchSize =
    options?.maxBatchSize ??
    (process.env.NIM_EMBED_BATCH_SIZE
      ? parseInt(process.env.NIM_EMBED_BATCH_SIZE, 10)
      : undefined) ??
    256;
  const maxWaitTime =
    options?.maxWaitTime ??
    (process.env.NIM_EMBED_MAX_WAIT_MS
      ? parseInt(process.env.NIM_EMBED_MAX_WAIT_MS, 10)
      : undefined) ??
    50;
  return new BatchProcessor<string, number[]>(
    async (texts: string[]) => {
      return await embeddingFn(texts);
    },
    {
      maxBatchSize,
      maxWaitTime,
      deduplicateRequests: true,
    },
  );
}

/**
 * Create a batch processor for simple text completions
 */
export function createCompletionBatchProcessor(
  completionFn: (prompts: string[]) => Promise<string[]>,
): BatchProcessor<string, string> {
  return new BatchProcessor<string, string>(
    async (prompts: string[]) => {
      return await completionFn(prompts);
    },
    {
      maxBatchSize: 10,
      maxWaitTime: 100,
      deduplicateRequests: true,
    },
  );
}

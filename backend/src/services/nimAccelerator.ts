/**
 * NVIDIA NIM Accelerator
 * GPU-accelerated embeddings and parallel inference using NVIDIA NIM
 */

import logger from "../middleware/logger.js";
import { createEmbeddingBatchProcessor } from "./batchProcessor.js";
import { updateGpuMetrics } from "../middleware/metrics.js";
import { getNimApiBase, isCloudNim } from "../config/nim.js";

export interface NIMConfig {
  apiKey: string;
  baseUrl?: string;
  embeddingModel?: string;
  inferenceModel?: string;
  maxBatchSize?: number;
  maxParallelRequests?: number;
  enableDynamicBatching?: boolean;
  enableMultiGPU?: boolean;
  gpuIds?: number[];
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: {
    totalTokens: number;
  };
}

export interface InferenceRequest {
  prompts: string[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface InferenceResponse {
  completions: string[];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class NIMAccelerator {
  private config: NIMConfig;
  private embeddingBatchProcessor: ReturnType<
    typeof createEmbeddingBatchProcessor
  > | null = null;
  private activeRequests = 0;
  private maxParallelRequests: number;
  private currentBatchSize: number;
  private gpuMetricsCache: Map<
    number,
    {
      utilization: number;
      memoryUsed: number;
      memoryTotal: number;
      timestamp: number;
    }
  > = new Map();
  private gpuRoundRobin = 0;

  constructor(config: NIMConfig) {
    this.config = {
      baseUrl: config.baseUrl || "https://integrate.api.nvidia.com/v1",
      embeddingModel: config.embeddingModel || "nvidia/nv-embed-v1",
      inferenceModel: config.inferenceModel || "moonshotai/kimi-k2.5",
      maxBatchSize: config.maxBatchSize || 256,
      maxParallelRequests: config.maxParallelRequests || 32,
      enableDynamicBatching: config.enableDynamicBatching ?? true,
      enableMultiGPU: config.enableMultiGPU ?? true,
      gpuIds: config.gpuIds || [0],
      ...config,
    };

    this.maxParallelRequests = this.config.maxParallelRequests ?? 32;
    this.currentBatchSize = this.config.maxBatchSize ?? 256;

    // Initialize batch processor for embeddings (env: NIM_EMBED_BATCH_SIZE, NIM_EMBED_MAX_WAIT_MS)
    this.embeddingBatchProcessor = createEmbeddingBatchProcessor(
      (texts: string[]) => this.batchEmbeddings(texts),
      {
        maxBatchSize: this.currentBatchSize,
        maxWaitTime: undefined,
      },
    );

    // Start GPU metrics monitoring only for self-hosted NIM (cloud Integrate API has no /v1/metrics)
    if (this.config.enableMultiGPU && !isCloudNim(this.config.baseUrl ?? "")) {
      this.startGPUMonitoring();
    }

    logger.info(
      {
        embeddingModel: this.config.embeddingModel,
        inferenceModel: this.config.inferenceModel,
        maxBatchSize: this.config.maxBatchSize,
        dynamicBatching: this.config.enableDynamicBatching,
        multiGPU: this.config.enableMultiGPU,
        gpuIds: this.config.gpuIds,
      },
      "NIM Accelerator initialized",
    );
  }

  /**
   * Generate embeddings for multiple texts (batched)
   */
  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.embeddingBatchProcessor) {
      throw new Error("Embedding batch processor not initialized");
    }

    // Use batch processor for automatic batching
    const embeddings = await Promise.all(
      texts.map(
        (text) =>
          this.embeddingBatchProcessor?.add("embeddings", text) ??
          Promise.reject(new Error("Batch processor not available")),
      ),
    );

    return embeddings;
  }

  /**
   * Get optimal batch size based on GPU memory
   */
  private async getOptimalBatchSize(): Promise<number> {
    const maxBatchSize = this.config.maxBatchSize ?? 256;
    if (!this.config.enableDynamicBatching) {
      return maxBatchSize;
    }

    const gpuMetrics = await this.getAverageGPUMetrics();
    if (!gpuMetrics) {
      return maxBatchSize;
    }

    const memoryUsedRatio = gpuMetrics.memoryUsed / gpuMetrics.memoryTotal;

    // Dynamic batch sizing based on available GPU memory
    if (memoryUsedRatio < 0.5) {
      return Math.min(512, maxBatchSize * 2); // 50% free - increase batch size
    } else if (memoryUsedRatio < 0.7) {
      return maxBatchSize; // 30% free - use default
    } else {
      return Math.max(128, Math.floor(maxBatchSize / 2)); // Conservative
    }
  }

  /**
   * Select best GPU for next request (load balancing)
   */
  private selectGPU(): number {
    const gpuIds = this.config.gpuIds ?? [0];
    if (!this.config.enableMultiGPU || gpuIds.length === 1) {
      return gpuIds[0];
    }

    // Find GPU with lowest utilization
    let bestGPU = gpuIds[0];
    let lowestUtilization = 100;

    for (const gpuId of gpuIds) {
      const metrics = this.gpuMetricsCache.get(gpuId);
      if (metrics && metrics.utilization < lowestUtilization) {
        lowestUtilization = metrics.utilization;
        bestGPU = gpuId;
      }
    }

    // Fallback to round-robin if no metrics available
    if (lowestUtilization === 100) {
      bestGPU = gpuIds[this.gpuRoundRobin % gpuIds.length];
      this.gpuRoundRobin++;
    }

    return bestGPU;
  }

  /**
   * Generate embeddings in batch (internal)
   */
  private async batchEmbeddings(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();

    // Update batch size dynamically
    if (this.config.enableDynamicBatching) {
      const optimalSize = await this.getOptimalBatchSize();
      if (optimalSize !== this.currentBatchSize) {
        this.currentBatchSize = optimalSize;
        logger.debug({ newBatchSize: optimalSize }, "Adjusted batch size");
      }
    }

    // Select GPU for this batch
    const gpuId = this.selectGPU();

    try {
      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          "X-GPU-ID": String(gpuId), // Custom header for GPU selection (if supported)
        },
        body: JSON.stringify({
          model: this.config.embeddingModel,
          input: texts,
          encoding_format: "float",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`NIM API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
        model: string;
        usage: { total_tokens: number };
      };

      const duration = Date.now() - startTime;
      logger.debug(
        {
          batchSize: texts.length,
          duration,
          tokensUsed: data.usage.total_tokens,
          gpuId,
        },
        "Batch embeddings generated",
      );

      // Return embeddings in correct order
      return data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          batchSize: texts.length,
          gpuId,
        },
        "Batch embedding generation failed",
      );
      throw error;
    }
  }

  /**
   * Generate completions for multiple prompts in parallel
   */
  public async parallelInference(
    requests: InferenceRequest,
  ): Promise<InferenceResponse> {
    const { prompts, model, maxTokens = 1024, temperature = 0.7 } = requests;

    // Limit concurrent requests
    const chunks: string[][] = [];
    for (let i = 0; i < prompts.length; i += this.maxParallelRequests) {
      chunks.push(prompts.slice(i, i + this.maxParallelRequests));
    }

    const allCompletions: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((prompt) =>
          this.singleInference(prompt, model, maxTokens, temperature),
        ),
      );

      chunkResults.forEach((result) => {
        allCompletions.push(result.completion);
        totalInputTokens += result.usage.inputTokens;
        totalOutputTokens += result.usage.outputTokens;
      });
    }

    return {
      completions: allCompletions,
      model: model || this.config.inferenceModel || "moonshotai/kimi-k2.5",
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    };
  }

  /**
   * Single inference request
   */
  private async singleInference(
    prompt: string,
    model?: string,
    maxTokens = 1024,
    temperature = 0.7,
  ): Promise<{
    completion: string;
    usage: { inputTokens: number; outputTokens: number };
  }> {
    this.activeRequests++;

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: model || this.config.inferenceModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`NIM API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      };

      return {
        completion: data.choices[0]?.message?.content || "",
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        },
      };
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Start GPU monitoring (periodic updates)
   */
  private startGPUMonitoring(): void {
    setInterval(async () => {
      for (const gpuId of this.config.gpuIds ?? [0]) {
        const metrics = await this.getGpuMetrics(gpuId);
        if (metrics) {
          this.gpuMetricsCache.set(gpuId, {
            ...metrics,
            timestamp: Date.now(),
          });
        }
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Get GPU utilization metrics for specific GPU
   * Note: /v1/metrics exists only on local/self-hosted NIM, not on cloud integrate.api.nvidia.com
   */
  public async getGpuMetrics(gpuId: number = 0): Promise<{
    utilization: number;
    memoryUsed: number;
    memoryTotal: number;
  } | null> {
    if (isCloudNim(this.config.baseUrl ?? "")) {
      return null;
    }
    try {
      // Try to get GPU metrics from NIM API (local/self-hosted only)
      const response = await fetch(
        `${this.config.baseUrl}/metrics?gpu_id=${gpuId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        gpu?: {
          utilization: number;
          memory_used: number;
          memory_total: number;
        };
      };

      if (data.gpu) {
        updateGpuMetrics(
          `nim-${gpuId}`,
          data.gpu.utilization,
          data.gpu.memory_used,
        );
        return {
          utilization: data.gpu.utilization,
          memoryUsed: data.gpu.memory_used,
          memoryTotal: data.gpu.memory_total,
        };
      }

      return null;
    } catch (_error) {
      logger.debug({ gpuId }, "GPU metrics not available");
      return null;
    }
  }

  /**
   * Get average GPU metrics across all GPUs
   */
  private async getAverageGPUMetrics(): Promise<{
    utilization: number;
    memoryUsed: number;
    memoryTotal: number;
  } | null> {
    const allMetrics = Array.from(this.gpuMetricsCache.values());

    if (allMetrics.length === 0) {
      return null;
    }

    const now = Date.now();
    const recentMetrics = allMetrics.filter((m) => now - m.timestamp < 10000); // Last 10 seconds

    if (recentMetrics.length === 0) {
      return null;
    }

    return {
      utilization:
        recentMetrics.reduce((sum, m) => sum + m.utilization, 0) /
        recentMetrics.length,
      memoryUsed:
        recentMetrics.reduce((sum, m) => sum + m.memoryUsed, 0) /
        recentMetrics.length,
      memoryTotal:
        recentMetrics.reduce((sum, m) => sum + m.memoryTotal, 0) /
        recentMetrics.length,
    };
  }

  /**
   * Get metrics for all GPUs
   */
  public getAllGPUMetrics(): Map<
    number,
    {
      utilization: number;
      memoryUsed: number;
      memoryTotal: number;
      timestamp: number;
    }
  > {
    return new Map(this.gpuMetricsCache);
  }

  /**
   * Get accelerator statistics
   */
  public getStats(): {
    activeRequests: number;
    maxParallelRequests: number;
    utilization: number;
  } {
    return {
      activeRequests: this.activeRequests,
      maxParallelRequests: this.maxParallelRequests,
      utilization: (this.activeRequests / this.maxParallelRequests) * 100,
    };
  }

  /**
   * Flush all pending batches
   */
  public async flush(): Promise<void> {
    if (this.embeddingBatchProcessor) {
      await this.embeddingBatchProcessor.flush();
    }
  }
}

// Singleton instance
let nimAccelerator: NIMAccelerator | null = null;

/**
 * Get or create the global NIM accelerator
 */
export function getNIMAccelerator(): NIMAccelerator | null {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;

  if (!apiKey) {
    logger.debug("NVIDIA_NIM_API_KEY not set, NIM accelerator disabled");
    return null;
  }

  if (!nimAccelerator) {
    nimAccelerator = new NIMAccelerator({ apiKey, baseUrl: getNimApiBase() });
  }

  return nimAccelerator;
}

/**
 * Check if NIM is available
 */
export function isNIMAvailable(): boolean {
  return Boolean(process.env.NVIDIA_NIM_API_KEY);
}

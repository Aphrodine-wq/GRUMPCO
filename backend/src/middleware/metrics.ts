import client from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

// Create a Registry
const register = new client.Registry();

// Add default metrics (memory, CPU, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics

// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// HTTP requests counter
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

// Claude API call duration
export const claudeApiDuration = new client.Histogram({
  name: 'claude_api_duration_seconds',
  help: 'Duration of Claude API calls in seconds',
  labelNames: ['operation', 'status'] as const,
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

// Claude API calls counter
export const claudeApiCallsTotal = new client.Counter({
  name: 'claude_api_calls_total',
  help: 'Total number of Claude API calls',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

// Circuit breaker state gauge
export const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['name'] as const,
  registers: [register],
});

// Active SSE connections gauge
export const activeSseConnections = new client.Gauge({
  name: 'active_sse_connections',
  help: 'Number of active SSE connections',
  registers: [register],
});

// Database operation duration
export const dbOperationDuration = new client.Histogram({
  name: 'db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'table', 'status'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// Database operation counter
export const dbOperationTotal = new client.Counter({
  name: 'db_operation_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'table', 'status'] as const,
  registers: [register],
});

// Context generation duration
export const contextGenerationDuration = new client.Histogram({
  name: 'context_generation_duration_seconds',
  help: 'Duration of context generation in seconds',
  labelNames: ['status'] as const,
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

// Context cache hits counter
export const contextCacheHitsTotal = new client.Counter({
  name: 'context_cache_hits_total',
  help: 'Total number of context cache hits',
  labelNames: ['type'] as const,
  registers: [register],
});

// Context cache misses counter
export const contextCacheMissesTotal = new client.Counter({
  name: 'context_cache_misses_total',
  help: 'Total number of context cache misses',
  registers: [register],
});

// Cost metrics
export const llmCostUsdTotal = new client.Counter({
  name: 'llm_cost_usd_total',
  help: 'Total LLM API cost in USD',
  labelNames: ['model', 'provider', 'operation'] as const,
  registers: [register],
});

export const llmCostPerRequest = new client.Histogram({
  name: 'llm_cost_per_request_usd',
  help: 'LLM API cost per request in USD',
  labelNames: ['model', 'provider', 'operation'] as const,
  buckets: [0.0001, 0.001, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const cacheSavingsUsdTotal = new client.Counter({
  name: 'cache_savings_usd_total',
  help: 'Total cost savings from cache hits in USD',
  labelNames: ['type'] as const,
  registers: [register],
});

export const modelRoutingSavingsUsd = new client.Counter({
  name: 'model_routing_savings_usd_total',
  help: 'Total cost savings from smart model routing in USD',
  registers: [register],
});

// Performance metrics
export const compilationDuration = new client.Histogram({
  name: 'compilation_duration_seconds',
  help: 'Duration of TypeScript/Rust compilation in seconds',
  labelNames: ['compiler', 'target'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const workerQueueDepth = new client.Gauge({
  name: 'worker_queue_depth',
  help: 'Number of tasks in worker thread queue',
  registers: [register],
});

export const workerPoolUtilization = new client.Gauge({
  name: 'worker_pool_utilization_percent',
  help: 'Worker pool utilization percentage',
  registers: [register],
});

export const gpuUtilizationPercent = new client.Gauge({
  name: 'gpu_utilization_percent',
  help: 'GPU utilization percentage (if available)',
  labelNames: ['gpu_id'] as const,
  registers: [register],
});

export const gpuMemoryUsedBytes = new client.Gauge({
  name: 'gpu_memory_used_bytes',
  help: 'GPU memory used in bytes',
  labelNames: ['gpu_id'] as const,
  registers: [register],
});

// Tiered cache metrics (layer + namespace for per-namespace hit rate)
export const tieredCacheHits = new client.Counter({
  name: 'tiered_cache_hits_total',
  help: 'Total number of tiered cache hits',
  labelNames: ['layer', 'namespace'] as const,
  registers: [register],
});

export const tieredCacheMisses = new client.Counter({
  name: 'tiered_cache_misses_total',
  help: 'Total number of tiered cache misses',
  labelNames: ['layer', 'namespace'] as const,
  registers: [register],
});

export const tieredCacheSize = new client.Gauge({
  name: 'tiered_cache_size_bytes',
  help: 'Size of tiered cache in bytes',
  labelNames: ['layer'] as const,
  registers: [register],
});

// Batch processing metrics
export const batchProcessingRequests = new client.Counter({
  name: 'batch_processing_requests_total',
  help: 'Total number of batch processing requests',
  labelNames: ['batch_type', 'status'] as const,
  registers: [register],
});

export const batchSize = new client.Histogram({
  name: 'batch_size',
  help: 'Size of processed batches',
  labelNames: ['batch_type'] as const,
  buckets: [1, 5, 10, 20, 50, 100, 256],
  registers: [register],
});

// Model selection metrics
export const modelSelectionTotal = new client.Counter({
  name: 'model_selection_total',
  help: 'Total number of model selections',
  labelNames: ['selected_model', 'complexity_level'] as const,
  registers: [register],
});

// LLM stream duration (per provider/model)
export const llmStreamDurationSeconds = new client.Histogram({
  name: 'llm_stream_duration_seconds',
  help: 'Duration of LLM stream from first chunk to message_stop',
  labelNames: ['provider', 'model'] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// NVIDIA NIM-aligned: Time to first token (TTFB)
export const llmTimeToFirstTokenSeconds = new client.Histogram({
  name: 'llm_time_to_first_token_seconds',
  help: 'Time from request start to first token received (NIM-aligned)',
  labelNames: ['provider', 'model'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// NVIDIA NIM-aligned: Tokens per second (generation throughput)
export const llmTokensPerSecond = new client.Histogram({
  name: 'llm_tokens_per_second',
  help: 'Output tokens per second during generation (NIM-aligned)',
  labelNames: ['provider', 'model'] as const,
  buckets: [1, 5, 10, 25, 50, 100, 200, 500],
  registers: [register],
});

// LLM token usage (input/output)
export const llmTokensTotal = new client.Counter({
  name: 'llm_tokens_total',
  help: 'Total LLM tokens by provider, model, and type',
  labelNames: ['provider', 'model', 'type'] as const,
  registers: [register],
});

// LLM router selections (provider + model_id)
export const llmRouterSelectionsTotal = new client.Counter({
  name: 'llm_router_selections_total',
  help: 'Total number of LLM router selections',
  labelNames: ['provider', 'model_id'] as const,
  registers: [register],
});

export const taskComplexityScore = new client.Histogram({
  name: 'task_complexity_score',
  help: 'Task complexity score (0-100)',
  labelNames: ['operation'] as const,
  buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [register],
});

// Chat requests by session type (chat vs gAgent)
export const chatRequestsTotal = new client.Counter({
  name: 'chat_requests_total',
  help: 'Total chat stream requests by session type',
  labelNames: ['session_type'] as const,
  registers: [register],
});

// Session created counter
export const sessionCreatedTotal = new client.Counter({
  name: 'session_created_total',
  help: 'Total number of sessions created',
  labelNames: ['type'] as const,
  registers: [register],
});

// Session completed counter
export const sessionCompletedTotal = new client.Counter({
  name: 'session_completed_total',
  help: 'Total number of sessions completed',
  labelNames: ['type', 'status'] as const,
  registers: [register],
});

// Session duration histogram
export const sessionDuration = new client.Histogram({
  name: 'session_duration_seconds',
  help: 'Duration of sessions in seconds',
  labelNames: ['type'] as const,
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400],
  registers: [register],
});

// Circuit breaker transitions counter
export const circuitBreakerTransitionsTotal = new client.Counter({
  name: 'circuit_breaker_transitions_total',
  help: 'Total number of circuit breaker state transitions',
  labelNames: ['name', 'from_state', 'to_state'] as const,
  registers: [register],
});

interface RouteRequest extends Omit<Request, 'route'> {
  route?: { path?: string };
}

// Middleware to track HTTP metrics
export function metricsMiddleware(req: RouteRequest, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || 'unknown';

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
  });

  next();
}

interface ApiTimer {
  success: () => void;
  failure: (errorType?: string) => void;
}

// Helper to time Claude API calls
export function createApiTimer(operation: string): ApiTimer {
  const start = process.hrtime.bigint();

  return {
    success: () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      claudeApiDuration.observe({ operation, status: 'success' }, duration);
      claudeApiCallsTotal.inc({ operation, status: 'success' });
    },
    failure: (errorType = 'error') => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      claudeApiDuration.observe({ operation, status: errorType }, duration);
      claudeApiCallsTotal.inc({ operation, status: errorType });
    },
  };
}

// Update circuit breaker state metric
export function updateCircuitState(
  name: string,
  state: 'closed' | 'half-open' | 'open',
  previousState?: 'closed' | 'half-open' | 'open'
): void {
  const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
  circuitBreakerState.set({ name }, stateValue);

  // Record transition if previous state is provided
  if (previousState && previousState !== state) {
    circuitBreakerTransitionsTotal.inc({
      name,
      from_state: previousState,
      to_state: state,
    });
  }
}

// Helper to record database operation
export function recordDbOperation(
  operation: string,
  table: string,
  duration: number,
  status: 'success' | 'error'
): void {
  const labels = { operation, table, status };
  dbOperationDuration.observe(labels, duration);
  dbOperationTotal.inc(labels);
}

// Helper to record context generation
export function recordContextGeneration(duration: number, status: 'success' | 'error'): void {
  contextGenerationDuration.observe({ status }, duration);
}

// Helper to record context cache hit
export function recordContextCacheHit(type: 'hit' | 'miss'): void {
  if (type === 'hit') {
    contextCacheHitsTotal.inc({ type: 'hit' });
  } else {
    contextCacheMissesTotal.inc();
  }
}

// Helper to record chat request (for G-Agent vs chat monitoring)
export function recordChatRequest(sessionType: string): void {
  chatRequestsTotal.inc({ session_type: sessionType });
}

// Helper to record session creation
export function recordSessionCreated(type: string): void {
  sessionCreatedTotal.inc({ type });
}

// Helper to record session completion
export function recordSessionCompleted(type: string, status: string, duration: number): void {
  sessionCompletedTotal.inc({ type, status });
  sessionDuration.observe({ type }, duration);
}

// Helper to record LLM cost
export function recordLlmCost(
  model: string,
  provider: string,
  operation: string,
  costUsd: number
): void {
  llmCostUsdTotal.inc({ model, provider, operation }, costUsd);
  llmCostPerRequest.observe({ model, provider, operation }, costUsd);
}

// Helper to record cache savings
export function recordCacheSavings(type: string, savingsUsd: number): void {
  cacheSavingsUsdTotal.inc({ type }, savingsUsd);
}

// Helper to record model routing savings
export function recordModelRoutingSavings(savingsUsd: number): void {
  modelRoutingSavingsUsd.inc(savingsUsd);
}

// Helper to record compilation duration
export function recordCompilation(compiler: string, target: string, duration: number): void {
  compilationDuration.observe({ compiler, target }, duration);
}

// Helper to update worker pool metrics
export function updateWorkerPoolMetrics(queueDepth: number, utilization: number): void {
  workerQueueDepth.set(queueDepth);
  workerPoolUtilization.set(utilization);
}

// Helper to update GPU metrics
export function updateGpuMetrics(gpuId: string, utilization: number, memoryUsed: number): void {
  gpuUtilizationPercent.set({ gpu_id: gpuId }, utilization);
  gpuMemoryUsedBytes.set({ gpu_id: gpuId }, memoryUsed);
}

// Helper to record tiered cache hit/miss (namespace for per-namespace hit rate)
export function recordTieredCacheAccess(
  layer: string,
  hit: boolean,
  namespace: string = 'default'
): void {
  const labels = { layer, namespace };
  if (hit) {
    tieredCacheHits.inc(labels);
  } else {
    tieredCacheMisses.inc(labels);
  }
}

// Helper to record LLM router selection
export function recordLlmRouterSelection(provider: string, modelId: string): void {
  llmRouterSelectionsTotal.inc({ provider, model_id: modelId });
}

// Helper to record LLM stream duration and optional token usage
// Supports NVIDIA NIM-aligned metrics: TTFB and tokens/sec
export function recordLlmStreamMetrics(
  provider: string,
  model: string,
  durationSeconds: number,
  inputTokens?: number,
  outputTokens?: number,
  timeToFirstTokenSeconds?: number,
  tokensPerSecond?: number
): void {
  llmStreamDurationSeconds.observe({ provider, model }, durationSeconds);
  if (typeof inputTokens === 'number' && inputTokens > 0) {
    llmTokensTotal.inc({ provider, model, type: 'input' }, inputTokens);
  }
  if (typeof outputTokens === 'number' && outputTokens > 0) {
    llmTokensTotal.inc({ provider, model, type: 'output' }, outputTokens);
  }
  if (typeof timeToFirstTokenSeconds === 'number' && timeToFirstTokenSeconds >= 0) {
    llmTimeToFirstTokenSeconds.observe({ provider, model }, timeToFirstTokenSeconds);
  }
  if (typeof tokensPerSecond === 'number' && tokensPerSecond > 0) {
    llmTokensPerSecond.observe({ provider, model }, tokensPerSecond);
  }
}

// Helper to update tiered cache size
export function updateTieredCacheSize(layer: string, sizeBytes: number): void {
  tieredCacheSize.set({ layer }, sizeBytes);
}

// Helper to record batch processing
export function recordBatchProcessing(
  batchType: string,
  size: number,
  status: 'success' | 'error'
): void {
  batchProcessingRequests.inc({ batch_type: batchType, status });
  batchSize.observe({ batch_type: batchType }, size);
}

// Helper to record model selection
export function recordModelSelection(
  selectedModel: string,
  complexityScore: number,
  operation: string
): void {
  const complexityLevel =
    complexityScore < 30 ? 'simple' : complexityScore < 60 ? 'medium' : 'complex';
  modelSelectionTotal.inc({
    selected_model: selectedModel,
    complexity_level: complexityLevel,
  });
  taskComplexityScore.observe({ operation }, complexityScore);
}

// Get metrics endpoint handler
export async function getMetrics(_req: Request, res: Response): Promise<void> {
  if (typeof res.set === 'function') {
    res.set('Content-Type', register.contentType);
  } else if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', register.contentType);
  }
  res.end(await register.metrics());
}

export { register };

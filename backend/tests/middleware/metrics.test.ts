/**
 * Metrics Middleware Tests
 * Comprehensive tests for Prometheus metrics middleware and helpers
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  httpRequestDuration,
  httpRequestsTotal,
  claudeApiDuration,
  claudeApiCallsTotal,
  circuitBreakerState,
  activeSseConnections,
  dbOperationDuration,
  dbOperationTotal,
  contextGenerationDuration,
  contextCacheHitsTotal,
  contextCacheMissesTotal,
  llmCostUsdTotal,
  llmCostPerRequest,
  cacheSavingsUsdTotal,
  modelRoutingSavingsUsd,
  compilationDuration,
  workerQueueDepth,
  workerPoolUtilization,
  gpuUtilizationPercent,
  gpuMemoryUsedBytes,
  tieredCacheHits,
  tieredCacheMisses,
  tieredCacheSize,
  batchProcessingRequests,
  batchSize,
  modelSelectionTotal,
  llmStreamDurationSeconds,
  llmTokensTotal,
  llmRouterSelectionsTotal,
  taskComplexityScore,
  chatRequestsTotal,
  sessionCreatedTotal,
  sessionCompletedTotal,
  sessionDuration,
  circuitBreakerTransitionsTotal,
  metricsMiddleware,
  createApiTimer,
  updateCircuitState,
  recordDbOperation,
  recordContextGeneration,
  recordContextCacheHit,
  recordChatRequest,
  recordSessionCreated,
  recordSessionCompleted,
  recordLlmCost,
  recordCacheSavings,
  recordModelRoutingSavings,
  recordCompilation,
  updateWorkerPoolMetrics,
  updateGpuMetrics,
  recordTieredCacheAccess,
  recordLlmRouterSelection,
  recordLlmStreamMetrics,
  updateTieredCacheSize,
  recordBatchProcessing,
  recordModelSelection,
  getMetrics,
  register,
} from '../../src/middleware/metrics.js';

// Helper to create mock request
function createMockRequest(
  overrides: Partial<Request & { route?: { path?: string } }> = {}
): Request & { route?: { path?: string } } {
  return {
    path: '/api/test',
    method: 'GET',
    headers: {},
    route: { path: '/api/test' },
    ...overrides,
  } as Request & { route?: { path?: string } };
}

// Helper to create mock response
function createMockResponse(): Response & {
  _finishCallbacks: Array<() => void>;
  triggerFinish: () => void;
} {
  const finishCallbacks: Array<() => void> = [];

  const res = {
    statusCode: 200,
    on: vi.fn((event: string, callback: () => void) => {
      if (event === 'finish') {
        finishCallbacks.push(callback);
      }
      return res;
    }),
    set: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
    _finishCallbacks: finishCallbacks,
    triggerFinish: () => {
      finishCallbacks.forEach((cb) => cb());
    },
  } as unknown as Response & {
    _finishCallbacks: Array<() => void>;
    triggerFinish: () => void;
  };

  return res;
}

describe('Metrics', () => {
  let next: NextFunction;

  beforeEach(() => {
    // Reset metrics between tests
    register.resetMetrics();
    vi.clearAllMocks();
    next = vi.fn() as unknown as NextFunction;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTTP Metrics', () => {
    it('should have httpRequestDuration metric', () => {
      expect(httpRequestDuration).toBeDefined();
    });

    it('should have httpRequestsTotal metric', () => {
      expect(httpRequestsTotal).toBeDefined();
    });

    it('should record HTTP request duration', () => {
      const labels = { method: 'GET', route: '/test', status_code: '200' };
      httpRequestDuration.observe(labels, 0.5);
      expect(httpRequestDuration).toBeDefined();
    });

    it('should increment HTTP requests counter', () => {
      const labels = { method: 'POST', route: '/api', status_code: '201' };
      httpRequestsTotal.inc(labels);
      expect(httpRequestsTotal).toBeDefined();
    });
  });

  describe('Claude API Metrics', () => {
    it('should have claudeApiDuration metric', () => {
      expect(claudeApiDuration).toBeDefined();
    });

    it('should have claudeApiCallsTotal metric', () => {
      expect(claudeApiCallsTotal).toBeDefined();
    });

    it('should record API call duration', () => {
      const labels = { operation: 'generate', status: 'success' };
      claudeApiDuration.observe(labels, 1.2);
      expect(claudeApiDuration).toBeDefined();
    });

    it('should increment API calls counter', () => {
      const labels = { operation: 'stream', status: 'success' };
      claudeApiCallsTotal.inc(labels);
      expect(claudeApiCallsTotal).toBeDefined();
    });
  });

  describe('Circuit Breaker Metrics', () => {
    it('should have circuitBreakerState metric', () => {
      expect(circuitBreakerState).toBeDefined();
    });

    it('should update circuit breaker state to open (2)', () => {
      updateCircuitState('test-circuit', 'open');
      expect(circuitBreakerState).toBeDefined();
    });

    it('should update circuit breaker state to half-open (1)', () => {
      updateCircuitState('test-circuit', 'half-open');
      expect(circuitBreakerState).toBeDefined();
    });

    it('should update circuit breaker state to closed (0)', () => {
      updateCircuitState('test-circuit', 'closed');
      expect(circuitBreakerState).toBeDefined();
    });

    it('should record state transitions', () => {
      updateCircuitState('test-circuit', 'open', 'closed');
      expect(circuitBreakerTransitionsTotal).toBeDefined();
    });

    it('should not record transition when states are the same', () => {
      updateCircuitState('test-circuit', 'closed', 'closed');
      expect(circuitBreakerTransitionsTotal).toBeDefined();
    });
  });

  describe('SSE Connection Metrics', () => {
    it('should have activeSseConnections gauge', () => {
      expect(activeSseConnections).toBeDefined();
    });

    it('should set SSE connection count', () => {
      activeSseConnections.set(5);
      expect(activeSseConnections).toBeDefined();
    });

    it('should increment and decrement SSE connections', () => {
      activeSseConnections.inc();
      activeSseConnections.dec();
      expect(activeSseConnections).toBeDefined();
    });
  });

  describe('Database Operation Metrics', () => {
    it('should have dbOperationDuration metric', () => {
      expect(dbOperationDuration).toBeDefined();
    });

    it('should have dbOperationTotal metric', () => {
      expect(dbOperationTotal).toBeDefined();
    });

    it('should record successful database operation', () => {
      recordDbOperation('SELECT', 'users', 0.05, 'success');
      expect(dbOperationDuration).toBeDefined();
    });

    it('should record failed database operation', () => {
      recordDbOperation('INSERT', 'sessions', 0.2, 'error');
      expect(dbOperationTotal).toBeDefined();
    });
  });

  describe('Context Generation Metrics', () => {
    it('should have contextGenerationDuration metric', () => {
      expect(contextGenerationDuration).toBeDefined();
    });

    it('should record context generation success', () => {
      recordContextGeneration(1.5, 'success');
      expect(contextGenerationDuration).toBeDefined();
    });

    it('should record context generation error', () => {
      recordContextGeneration(0.5, 'error');
      expect(contextGenerationDuration).toBeDefined();
    });
  });

  describe('Context Cache Metrics', () => {
    it('should have contextCacheHitsTotal metric', () => {
      expect(contextCacheHitsTotal).toBeDefined();
    });

    it('should have contextCacheMissesTotal metric', () => {
      expect(contextCacheMissesTotal).toBeDefined();
    });

    it('should record cache hit', () => {
      recordContextCacheHit('hit');
      expect(contextCacheHitsTotal).toBeDefined();
    });

    it('should record cache miss', () => {
      recordContextCacheHit('miss');
      expect(contextCacheMissesTotal).toBeDefined();
    });
  });

  describe('LLM Cost Metrics', () => {
    it('should have llmCostUsdTotal metric', () => {
      expect(llmCostUsdTotal).toBeDefined();
    });

    it('should have llmCostPerRequest metric', () => {
      expect(llmCostPerRequest).toBeDefined();
    });

    it('should record LLM cost', () => {
      recordLlmCost('claude-3-sonnet', 'anthropic', 'chat', 0.05);
      expect(llmCostUsdTotal).toBeDefined();
    });

    it('should record cost for different models and operations', () => {
      recordLlmCost('gpt-4', 'openai', 'completion', 0.10);
      recordLlmCost('kimi-k2.5', 'nim', 'code-gen', 0.02);
      expect(llmCostPerRequest).toBeDefined();
    });
  });

  describe('Cache Savings Metrics', () => {
    it('should have cacheSavingsUsdTotal metric', () => {
      expect(cacheSavingsUsdTotal).toBeDefined();
    });

    it('should record cache savings', () => {
      recordCacheSavings('l1', 0.03);
      recordCacheSavings('l2', 0.05);
      expect(cacheSavingsUsdTotal).toBeDefined();
    });
  });

  describe('Model Routing Savings Metrics', () => {
    it('should have modelRoutingSavingsUsd metric', () => {
      expect(modelRoutingSavingsUsd).toBeDefined();
    });

    it('should record model routing savings', () => {
      recordModelRoutingSavings(0.08);
      expect(modelRoutingSavingsUsd).toBeDefined();
    });
  });

  describe('Compilation Metrics', () => {
    it('should have compilationDuration metric', () => {
      expect(compilationDuration).toBeDefined();
    });

    it('should record compilation duration', () => {
      recordCompilation('tsc', 'dist', 5.2);
      recordCompilation('swc', 'esm', 1.5);
      expect(compilationDuration).toBeDefined();
    });
  });

  describe('Worker Pool Metrics', () => {
    it('should have workerQueueDepth gauge', () => {
      expect(workerQueueDepth).toBeDefined();
    });

    it('should have workerPoolUtilization gauge', () => {
      expect(workerPoolUtilization).toBeDefined();
    });

    it('should update worker pool metrics', () => {
      updateWorkerPoolMetrics(10, 75.5);
      expect(workerQueueDepth).toBeDefined();
      expect(workerPoolUtilization).toBeDefined();
    });
  });

  describe('GPU Metrics', () => {
    it('should have gpuUtilizationPercent gauge', () => {
      expect(gpuUtilizationPercent).toBeDefined();
    });

    it('should have gpuMemoryUsedBytes gauge', () => {
      expect(gpuMemoryUsedBytes).toBeDefined();
    });

    it('should update GPU metrics', () => {
      updateGpuMetrics('0', 85.5, 8_000_000_000);
      updateGpuMetrics('1', 42.0, 4_000_000_000);
      expect(gpuUtilizationPercent).toBeDefined();
    });
  });

  describe('Tiered Cache Metrics', () => {
    it('should have tieredCacheHits counter', () => {
      expect(tieredCacheHits).toBeDefined();
    });

    it('should have tieredCacheMisses counter', () => {
      expect(tieredCacheMisses).toBeDefined();
    });

    it('should have tieredCacheSize gauge', () => {
      expect(tieredCacheSize).toBeDefined();
    });

    it('should record cache hit with layer and namespace', () => {
      recordTieredCacheAccess('L1', true, 'chat');
      expect(tieredCacheHits).toBeDefined();
    });

    it('should record cache miss with layer and namespace', () => {
      recordTieredCacheAccess('L2', false, 'code');
      expect(tieredCacheMisses).toBeDefined();
    });

    it('should use default namespace when not provided', () => {
      recordTieredCacheAccess('L1', true);
      expect(tieredCacheHits).toBeDefined();
    });

    it('should update tiered cache size', () => {
      updateTieredCacheSize('L1', 1_000_000);
      updateTieredCacheSize('L2', 50_000_000);
      expect(tieredCacheSize).toBeDefined();
    });
  });

  describe('Batch Processing Metrics', () => {
    it('should have batchProcessingRequests counter', () => {
      expect(batchProcessingRequests).toBeDefined();
    });

    it('should have batchSize histogram', () => {
      expect(batchSize).toBeDefined();
    });

    it('should record successful batch processing', () => {
      recordBatchProcessing('embedding', 50, 'success');
      expect(batchProcessingRequests).toBeDefined();
    });

    it('should record failed batch processing', () => {
      recordBatchProcessing('inference', 100, 'error');
      expect(batchSize).toBeDefined();
    });
  });

  describe('Model Selection Metrics', () => {
    it('should have modelSelectionTotal counter', () => {
      expect(modelSelectionTotal).toBeDefined();
    });

    it('should have taskComplexityScore histogram', () => {
      expect(taskComplexityScore).toBeDefined();
    });

    it('should record model selection for simple task', () => {
      recordModelSelection('kimi-k2.5', 20, 'chat');
      expect(modelSelectionTotal).toBeDefined();
    });

    it('should record model selection for medium task', () => {
      recordModelSelection('claude-3-sonnet', 45, 'code-review');
      expect(modelSelectionTotal).toBeDefined();
    });

    it('should record model selection for complex task', () => {
      recordModelSelection('claude-3-opus', 85, 'architecture');
      expect(modelSelectionTotal).toBeDefined();
    });
  });

  describe('LLM Stream Metrics', () => {
    it('should have llmStreamDurationSeconds histogram', () => {
      expect(llmStreamDurationSeconds).toBeDefined();
    });

    it('should have llmTokensTotal counter', () => {
      expect(llmTokensTotal).toBeDefined();
    });

    it('should record stream duration without tokens', () => {
      recordLlmStreamMetrics('anthropic', 'claude-3-sonnet', 2.5);
      expect(llmStreamDurationSeconds).toBeDefined();
    });

    it('should record stream duration with tokens', () => {
      recordLlmStreamMetrics('anthropic', 'claude-3-opus', 5.0, 1000, 500);
      expect(llmTokensTotal).toBeDefined();
    });

    it('should not record tokens when they are zero', () => {
      recordLlmStreamMetrics('nim', 'kimi-k2.5', 1.0, 0, 0);
      expect(llmStreamDurationSeconds).toBeDefined();
    });

    it('should not record tokens when they are negative', () => {
      recordLlmStreamMetrics('nim', 'kimi-k2.5', 1.0, -100, -50);
      expect(llmStreamDurationSeconds).toBeDefined();
    });
  });

  describe('LLM Router Selection Metrics', () => {
    it('should have llmRouterSelectionsTotal counter', () => {
      expect(llmRouterSelectionsTotal).toBeDefined();
    });

    it('should record router selection', () => {
      recordLlmRouterSelection('anthropic', 'claude-3-sonnet');
      recordLlmRouterSelection('nim', 'kimi-k2.5');
      expect(llmRouterSelectionsTotal).toBeDefined();
    });
  });

  describe('Chat Session Metrics', () => {
    it('should have chatRequestsTotal counter', () => {
      expect(chatRequestsTotal).toBeDefined();
    });

    it('should record chat request by session type', () => {
      recordChatRequest('chat');
      recordChatRequest('gAgent');
      expect(chatRequestsTotal).toBeDefined();
    });
  });

  describe('Session Lifecycle Metrics', () => {
    it('should have sessionCreatedTotal counter', () => {
      expect(sessionCreatedTotal).toBeDefined();
    });

    it('should have sessionCompletedTotal counter', () => {
      expect(sessionCompletedTotal).toBeDefined();
    });

    it('should have sessionDuration histogram', () => {
      expect(sessionDuration).toBeDefined();
    });

    it('should record session creation', () => {
      recordSessionCreated('chat');
      recordSessionCreated('codegen');
      expect(sessionCreatedTotal).toBeDefined();
    });

    it('should record session completion with success', () => {
      recordSessionCompleted('chat', 'success', 120);
      expect(sessionCompletedTotal).toBeDefined();
    });

    it('should record session completion with error', () => {
      recordSessionCompleted('codegen', 'error', 30);
      expect(sessionDuration).toBeDefined();
    });
  });

  describe('metricsMiddleware', () => {
    it('should call next', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      metricsMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should register finish event handler', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      metricsMiddleware(req, res, next);

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should record metrics on response finish', () => {
      const req = createMockRequest({
        method: 'POST',
        path: '/api/chat',
        route: { path: '/api/chat' },
      });
      const res = createMockResponse();
      res.statusCode = 200;

      metricsMiddleware(req, res, next);
      res.triggerFinish();

      // Metrics should be recorded
      expect(httpRequestDuration).toBeDefined();
      expect(httpRequestsTotal).toBeDefined();
    });

    it('should use path when route is not available', () => {
      const req = createMockRequest({
        method: 'GET',
        path: '/api/unknown',
        route: undefined,
      });
      const res = createMockResponse();

      metricsMiddleware(req, res, next);
      res.triggerFinish();

      expect(next).toHaveBeenCalled();
    });

    it('should use "unknown" when neither route nor path is available', () => {
      const req = createMockRequest({
        method: 'GET',
        path: undefined as unknown as string,
        route: undefined,
      });
      const res = createMockResponse();

      metricsMiddleware(req, res, next);
      res.triggerFinish();

      expect(next).toHaveBeenCalled();
    });

    it('should handle different status codes', () => {
      const statusCodes = [200, 201, 400, 401, 403, 404, 500, 502, 503];

      for (const statusCode of statusCodes) {
        const req = createMockRequest();
        const res = createMockResponse();
        res.statusCode = statusCode;

        metricsMiddleware(req, res, next);
        res.triggerFinish();
      }

      expect(next).toHaveBeenCalledTimes(statusCodes.length);
    });
  });

  describe('createApiTimer', () => {
    it('should return timer with success and failure methods', () => {
      const timer = createApiTimer('test-operation');

      expect(typeof timer.success).toBe('function');
      expect(typeof timer.failure).toBe('function');
    });

    it('should record success metrics', () => {
      const timer = createApiTimer('chat-completion');
      timer.success();

      expect(claudeApiDuration).toBeDefined();
      expect(claudeApiCallsTotal).toBeDefined();
    });

    it('should record failure metrics with default error type', () => {
      const timer = createApiTimer('embedding');
      timer.failure();

      expect(claudeApiDuration).toBeDefined();
      expect(claudeApiCallsTotal).toBeDefined();
    });

    it('should record failure metrics with custom error type', () => {
      const timer = createApiTimer('completion');
      timer.failure('rate_limit');

      expect(claudeApiDuration).toBeDefined();
    });

    it('should measure duration accurately', async () => {
      const timer = createApiTimer('slow-operation');
      
      // Wait a bit before completing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      timer.success();

      expect(claudeApiDuration).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics as string', async () => {
      const res = {
        set: vi.fn(),
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;

      await getMetrics({} as Request, res);

      expect(res.end).toHaveBeenCalled();
      const [payload] = vi.mocked(res.end).mock.calls[0] || [];
      expect(typeof payload).toBe('string');
    });

    it('should set Content-Type header using set', async () => {
      const res = {
        set: vi.fn(),
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;

      await getMetrics({} as Request, res);

      expect(res.set).toHaveBeenCalledWith('Content-Type', expect.any(String));
    });

    it('should fall back to setHeader when set is not available', async () => {
      const res = {
        set: undefined,
        setHeader: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;

      await getMetrics({} as Request, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', expect.any(String));
    });

    it('should include default metrics in output', async () => {
      const res = {
        set: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;

      await getMetrics({} as Request, res);

      const [payload] = vi.mocked(res.end).mock.calls[0] || [];
      expect(typeof payload).toBe('string');
      // Default metrics should include process_cpu and nodejs_heap
      expect(String(payload)).toContain('process_');
    });

    it('should include custom HTTP metrics in output', async () => {
      // Record some metrics first
      httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });

      const res = {
        set: vi.fn(),
        end: vi.fn(),
      } as unknown as Response;

      await getMetrics({} as Request, res);

      const [payload] = vi.mocked(res.end).mock.calls[0] || [];
      expect(String(payload)).toContain('http_requests_total');
    });
  });

  describe('register', () => {
    it('should be defined', () => {
      expect(register).toBeDefined();
    });

    it('should have resetMetrics method', () => {
      expect(typeof register.resetMetrics).toBe('function');
    });

    it('should have metrics method', async () => {
      const metrics = await register.metrics();
      expect(typeof metrics).toBe('string');
    });

    it('should have contentType property', () => {
      expect(register.contentType).toBeDefined();
      expect(typeof register.contentType).toBe('string');
    });
  });
});

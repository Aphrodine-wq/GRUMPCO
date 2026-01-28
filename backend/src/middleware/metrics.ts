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
export function metricsMiddleware(
  req: RouteRequest,
  res: Response,
  next: NextFunction
): void {
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

// Helper to record session creation
export function recordSessionCreated(type: string): void {
  sessionCreatedTotal.inc({ type });
}

// Helper to record session completion
export function recordSessionCompleted(type: string, status: string, duration: number): void {
  sessionCompletedTotal.inc({ type, status });
  sessionDuration.observe({ type }, duration);
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

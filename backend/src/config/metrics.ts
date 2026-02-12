import prom from 'prom-client';
import { logger } from '../utils/logger.js';

// Create a Registry
export const register = new prom.Registry();

// Add default metrics
prom.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new prom.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new prom.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const aiRequestDuration = new prom.Histogram({
  name: 'ai_request_duration_seconds',
  help: 'Duration of AI provider requests',
  labelNames: ['provider', 'model', 'operation'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const aiRequestTotal = new prom.Counter({
  name: 'ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['provider', 'model', 'operation', 'status'],
  registers: [register],
});

export const aiTokensUsed = new prom.Counter({
  name: 'ai_tokens_used_total',
  help: 'Total AI tokens consumed',
  labelNames: ['provider', 'model', 'type'], // type: prompt | completion
  registers: [register],
});

export const aiCostEstimate = new prom.Counter({
  name: 'ai_cost_estimate_dollars',
  help: 'Estimated AI costs in dollars',
  labelNames: ['provider', 'model'],
  registers: [register],
});

export const activeConnections = new prom.Gauge({
  name: 'active_connections',
  help: 'Number of active WebSocket/SSE connections',
  labelNames: ['type'], // type: websocket | sse
  registers: [register],
});

export const cacheHitRate = new prom.Counter({
  name: 'cache_operations_total',
  help: 'Cache operations',
  labelNames: ['operation', 'tier'], // operation: hit | miss, tier: l1 | l2 | l3
  registers: [register],
});

export const databaseQueryDuration = new prom.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const queueJobDuration = new prom.Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Queue job processing duration',
  labelNames: ['job_type', 'status'],
  buckets: [1, 5, 10, 30, 60, 300, 600],
  registers: [register],
});

export const queueJobTotal = new prom.Counter({
  name: 'queue_jobs_total',
  help: 'Total queue jobs processed',
  labelNames: ['job_type', 'status'], // status: completed | failed
  registers: [register],
});

export const errorTotal = new prom.Counter({
  name: 'errors_total',
  help: 'Total application errors',
  labelNames: ['type', 'severity'], // type: validation | system | network, severity: error | warning
  registers: [register],
});

// Business metrics
export const shipWorkflowsTotal = new prom.Counter({
  name: 'ship_workflows_total',
  help: 'Total SHIP workflows initiated',
  labelNames: ['phase', 'status'], // phase: design | spec | plan | code, status: completed | failed
  registers: [register],
});

export const codeGenerationTotal = new prom.Counter({
  name: 'code_generation_total',
  help: 'Total code generation operations',
  labelNames: ['type', 'status'], // type: frontend | backend | devops | tests
  registers: [register],
});

export const architectureDiagramsTotal = new prom.Counter({
  name: 'architecture_diagrams_total',
  help: 'Total architecture diagrams generated',
  labelNames: ['diagram_type', 'level'], // diagram_type: c4 | erd | sequence
  registers: [register],
});

// Helper functions for tracking costs
export function trackAICost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  costPer1kTokens: number
) {
  const totalTokens = promptTokens + completionTokens;
  const cost = (totalTokens / 1000) * costPer1kTokens;

  aiTokensUsed.inc({ provider, model, type: 'prompt' }, promptTokens);
  aiTokensUsed.inc({ provider, model, type: 'completion' }, completionTokens);
  aiCostEstimate.inc({ provider, model }, cost);

  logger.debug(
    {
      provider,
      model,
      promptTokens,
      completionTokens,
      cost: cost.toFixed(4),
    },
    'AI cost tracked'
  );
}

// Middleware for HTTP metrics
export function metricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;

      httpRequestDuration.observe(
        { method: req.method, route, status_code: res.statusCode },
        duration
      );

      httpRequestTotal.inc({
        method: req.method,
        route,
        status_code: res.statusCode,
      });
    });

    next();
  };
}

export default register;

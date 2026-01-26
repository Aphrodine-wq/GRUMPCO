import client from 'prom-client';
// Create a Registry
const register = new client.Registry();
// Add default metrics (memory, CPU, event loop lag, etc.)
client.collectDefaultMetrics({ register });
// Custom metrics
// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
});
// HTTP requests counter
export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});
// Claude API call duration
export const claudeApiDuration = new client.Histogram({
    name: 'claude_api_duration_seconds',
    help: 'Duration of Claude API calls in seconds',
    labelNames: ['operation', 'status'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
    registers: [register],
});
// Claude API calls counter
export const claudeApiCallsTotal = new client.Counter({
    name: 'claude_api_calls_total',
    help: 'Total number of Claude API calls',
    labelNames: ['operation', 'status'],
    registers: [register],
});
// Circuit breaker state gauge
export const circuitBreakerState = new client.Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
    labelNames: ['name'],
    registers: [register],
});
// Active SSE connections gauge
export const activeSseConnections = new client.Gauge({
    name: 'active_sse_connections',
    help: 'Number of active SSE connections',
    registers: [register],
});
// Middleware to track HTTP metrics
export function metricsMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - start) / 1e9;
        const route = req.route?.path || req.path || 'unknown';
        const labels = {
            method: req.method,
            route,
            status_code: res.statusCode,
        };
        httpRequestDuration.observe(labels, duration);
        httpRequestsTotal.inc(labels);
    });
    next();
}
// Helper to time Claude API calls
export function createApiTimer(operation) {
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
export function updateCircuitState(name, state) {
    const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
    circuitBreakerState.set({ name }, stateValue);
}
// Get metrics endpoint handler
export async function getMetrics(req, res) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
}
export { register };
//# sourceMappingURL=metrics.js.map
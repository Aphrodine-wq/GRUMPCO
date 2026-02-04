/**
 * @fileoverview Express application factory and middleware setup.
 * Creates and configures the Express application with all middleware layers.
 *
 * OPTIMIZATION: Middleware is loaded conditionally based on runtime environment.
 * - Serverless (Vercel): Minimal middleware, lazy-loaded heavy deps
 * - Desktop/Local: Full middleware stack with all features
 *
 * @module server/app
 */

import express, { type Request, type Response, type NextFunction, type Express } from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { requestIdMiddleware, httpLogger, default as logger } from '../middleware/logger.js';
import { metricsMiddleware, getMetrics } from '../middleware/metrics.js';
import { requestTimeout } from '../middleware/timeout.js';
import { initializeTracing, tracingMiddleware } from '../middleware/tracing.js';
import { applySecurityMiddleware } from '../middleware/security.js';
import { applyRateLimiting } from '../middleware/rateLimiter.js';
import { apiAuthMiddleware } from '../middleware/authMiddleware.js';
import { mountLazyRoutes } from '../routes/registry.js';
import { env } from '../config/env.js';
import { timingSafeEqualString } from '../utils/security.js';
import { isServerlessRuntime } from '../config/runtime.js';

// Lazy-loaded middleware (only imported when needed)
let agentGovernanceMiddleware:
  | typeof import('../middleware/agentGovernance.js').agentGovernanceMiddleware
  | null = null;
let kimiOptimizationMiddleware:
  | typeof import('../middleware/kimiMiddleware.js').kimiOptimizationMiddleware
  | null = null;
let kimiPromptOptimizationMiddleware:
  | typeof import('../middleware/kimiMiddleware.js').kimiPromptOptimizationMiddleware
  | null = null;
let usageTrackingMiddleware:
  | typeof import('../middleware/usageTrackingMiddleware.js').usageTrackingMiddleware
  | null = null;
let usageLimitsMiddleware:
  | typeof import('../middleware/usageLimitsMiddleware.js').usageLimitsMiddleware
  | null = null;
let createCsrfMiddleware: typeof import('../middleware/csrf.js').createCsrfMiddleware | null = null;

/**
 * Creates the Express application with base middleware configured.
 * Does not include async middleware that requires initialization.
 * @returns Configured Express application
 */
export function createApp(): Express {
  const app = express();

  // Initialize OpenTelemetry tracing (lazy-loaded, non-blocking)
  initializeTracing();

  // Apply security middleware (helmet, CORS, host validation)
  applySecurityMiddleware(app);

  // Request ID middleware (must be before logging)
  app.use(requestIdMiddleware);

  // Tracing middleware (after request ID, before logging) - lightweight even when tracing disabled
  app.use(tracingMiddleware);

  // HTTP request logging - skip in serverless for reduced overhead
  if (!isServerlessRuntime || process.env.LOG_REQUESTS === 'true') {
    app.use(httpLogger);
  }

  // Prometheus metrics collection - skip in serverless (no scrape endpoint)
  if (!isServerlessRuntime) {
    app.use(metricsMiddleware);
  }

  // Response compression (Brotli + gzip)
  app.use(createCompressionMiddleware());

  // Stripe webhook removed - desktop only (no billing)

  // Body parsing
  app.use(
    express.json({
      limit: '100kb',
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));
  app.use(cookieParser());

  // Request timeout
  app.use(requestTimeout);

  return app;
}

/**
 * Creates compression middleware with SSE-aware filtering.
 * @returns Configured compression middleware
 */
function createCompressionMiddleware() {
  return compression({
    level: isServerlessRuntime ? 4 : 6, // Faster compression in serverless
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Don't compress SSE streams
      if (res.getHeader('Content-Type')?.toString().includes('text/event-stream')) {
        return false;
      }
      return compression.filter(req, res);
    },
  });
}

/**
 * Lazy-load heavy middleware modules (called once on first request needing them)
 */
async function loadHeavyMiddleware(): Promise<void> {
  if (agentGovernanceMiddleware) return; // Already loaded

  const [govMod, kimiMod, usageTrackMod, usageLimitMod, csrfMod] = await Promise.all([
    import('../middleware/agentGovernance.js'),
    import('../middleware/kimiMiddleware.js'),
    import('../middleware/usageTrackingMiddleware.js'),
    import('../middleware/usageLimitsMiddleware.js'),
    import('../middleware/csrf.js'),
  ]);

  agentGovernanceMiddleware = govMod.agentGovernanceMiddleware;
  kimiOptimizationMiddleware = kimiMod.kimiOptimizationMiddleware;
  kimiPromptOptimizationMiddleware = kimiMod.kimiPromptOptimizationMiddleware;
  usageTrackingMiddleware = usageTrackMod.usageTrackingMiddleware;
  usageLimitsMiddleware = usageLimitMod.usageLimitsMiddleware;
  createCsrfMiddleware = csrfMod.createCsrfMiddleware;

  logger.debug('Lazy-loaded heavy middleware modules');
}

/**
 * Applies async middleware that requires service initialization.
 * Should be called after core services are initialized.
 * @param app - Express application instance
 */
export async function applyAsyncMiddleware(app: Express): Promise<void> {
  // Rate limiting (uses Redis store when available)
  const rateLimitMw = await applyRateLimiting();
  app.use('/api', rateLimitMw);
  app.use('/auth', rateLimitMw);

  // Load heavy middleware modules in parallel
  await loadHeavyMiddleware();

  // CSRF protection (production enabled by default, development opt-in)
  if (createCsrfMiddleware) {
    app.use('/api', createCsrfMiddleware());
    app.use('/auth', createCsrfMiddleware());
  }

  // Agent governance (block/control AI agents)
  if (agentGovernanceMiddleware) {
    app.use('/api', agentGovernanceMiddleware);
  }

  // API authentication
  app.use('/api', apiAuthMiddleware);

  // Usage limits + tracking (after auth, before routes)
  if (usageLimitsMiddleware) {
    app.use('/api', usageLimitsMiddleware);
  }
  if (usageTrackingMiddleware) {
    app.use('/api', usageTrackingMiddleware);
  }

  // Kimi K2.5 optimization middleware - only for AI routes and when not in minimal mode
  if (kimiOptimizationMiddleware && kimiPromptOptimizationMiddleware && !isServerlessRuntime) {
    const kimiRoutes = ['/api/chat', '/api/ship', '/api/codegen', '/api/plan'];
    for (const route of kimiRoutes) {
      app.use(route, kimiOptimizationMiddleware({ autoRoute: true, trackSavings: true }));
    }
    app.use('/api/chat', kimiPromptOptimizationMiddleware());
  }

  // Mount all API routes via lazy-loading registry
  mountLazyRoutes(app);
}

/**
 * Applies the metrics endpoint with authentication in production.
 * @param app - Express application instance
 */
export function applyMetricsEndpoint(app: Express): void {
  app.get(
    '/metrics',
    (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'production') {
        if (!env.METRICS_AUTH) {
          res.status(403).json({ error: 'Metrics disabled in production without METRICS_AUTH' });
          return;
        }
        const auth = req.headers.authorization;
        const expected = `Basic ${Buffer.from(env.METRICS_AUTH).toString('base64')}`;
        if (!auth || !timingSafeEqualString(auth, expected)) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }
      next();
    },
    getMetrics
  );
}

/**
 * Applies error handling middleware (404 and global error handler).
 * Should be called last in middleware chain.
 * @param app - Express application instance
 */
export function applyErrorHandlers(app: Express): void {
  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found', type: 'not_found' });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const correlationId = (req as Request & { correlationId?: string }).correlationId;
    logger.error({ error: err.message, stack: err.stack, correlationId }, 'Unhandled error');

    if (err.message === 'Not allowed by CORS') {
      res.status(403).json({ error: 'CORS error', type: 'forbidden' });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      type: 'internal_error',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  });
}

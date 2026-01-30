// MUST be first import - loads environment variables before other modules
import './config/env.js';
import { initializeDatabase, closeDatabase } from './db/database.js';
import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { requestIdMiddleware, httpLogger } from './middleware/logger.js';
import { applyRateLimiting } from './middleware/rateLimiter.js';
import { metricsMiddleware, getMetrics } from './middleware/metrics.js';
import { requestTimeout } from './middleware/timeout.js';
import { initializeTracing, shutdownTracing, tracingMiddleware } from './middleware/tracing.js';
import { initializeAlerting } from './services/alerting.js';
import logger from './middleware/logger.js';
import diagramRoutes from './routes/diagram.js';
import intentRoutes from './routes/intent.js';
import architectureRoutes from './routes/architecture.js';
import prdRoutes from './routes/prd.js';
import codegenRoutes from './routes/codegen.js';
import chatRoutes from './routes/chat.js';
import planRoutes from './routes/plan.js';
import specRoutes from './routes/spec.js';
import shipRoutes from './routes/ship.js';
import healthRoutes from './routes/health.js';
import messagingRoutes from './routes/messaging.js';
import authRoutes from './routes/auth.js';
import githubRoutes from './routes/github.js';
import analyzeRoutes from './features/codebase-analysis/routes.js';
import settingsRoutes from './routes/settings.js';
import billingRoutes from './routes/billing.js';
import costDashboardRoutes from './routes/costDashboard.js';
import skillsApiRoutes from './routes/skillsApi.js';
import securityRoutes from './features/security-compliance/routes.js';
import infraRoutes from './features/infrastructure/routes.js';
import testingRoutes from './features/testing-qa/routes.js';
import expoTestRoutes from './routes/expoTest.js';
import webhookRoutes from './routes/webhooks.js';
import eventsRoutes from './routes/events.js';
import agentsRoutes from './routes/agents.js';
import jobsRoutes from './routes/jobs.js';
import { handleStripeWebhook } from './routes/billingWebhook.js';
import collaborationRoutes from './routes/collaboration.js';
import analyticsRoutes from './routes/analytics.js';
import templatesRoutes from './routes/templates.js';
import workspaceRoutes from './routes/workspace.js';
import demoRoutes from './routes/demo.js';
import integrationsRoutes from './features/integrations/routes.js';
import ragRoutes from './routes/rag.js';
import voiceRoutes from './routes/voice.js';
import memoryRoutes from './routes/memory.js';
import visionRoutes from './routes/vision.js';
import { findAvailablePort } from './utils/portUtils.js';
import { skillRegistry } from './skills/index.js';
import { startJobWorker, stopJobWorker } from './services/jobQueue.js';
import { getNIMAccelerator } from './services/nimAccelerator.js';
import { updateGpuMetrics } from './middleware/metrics.js';
import { shutdownWorkerPool } from './services/workerPool.js';
import { getTieredCache } from './services/tieredCache.js';
import { isServerlessRuntime } from './config/runtime.js';
import { startScheduledAgentsWorker, stopScheduledAgentsWorker, loadRepeatableJobsFromDb } from './services/scheduledAgentsQueue.js';
import { apiAuthMiddleware } from './middleware/authMiddleware.js';
import { kimiOptimizationMiddleware, kimiPromptOptimizationMiddleware } from './middleware/kimiMiddleware.js';
import type { Server } from 'http';

const app: Express = express();
const PREFERRED_PORT = parseInt(process.env.PORT || '3000', 10) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
let resolveAppReady: (() => void) | null = null;
export const appReady = new Promise<void>((resolve) => {
  resolveAppReady = resolve as () => void;
});

// Determine allowed origins (production: require CORS_ORIGINS or use minimal default)
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : isProduction
    ? ['tauri://localhost', 'http://tauri.localhost', 'http://127.0.0.1:3000']
    : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5178',
      'http://127.0.0.1:5178',
      'tauri://localhost',
      'http://tauri.localhost',
    ];

// Security middleware - must be early in chain
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for diagrams
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // In development, allow all localhost origins
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'Blocked by CORS');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Initialize tracing (must be early)
initializeTracing();

// Request ID middleware (must be before logging)
app.use(requestIdMiddleware);

// Tracing middleware (after request ID, before logging)
app.use(tracingMiddleware);

// HTTP logging
app.use(httpLogger);

// Metrics middleware
app.use(metricsMiddleware);

// Compression middleware (Brotli + gzip)
app.use(
  compression({
    level: 6, // Balance between speed and compression ratio
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
  })
);

// Stripe webhook (raw body required for signature verification) – must be before express.json
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Body parsing (JSON + urlencoded for Twilio webhooks)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Request timeout middleware (route-level timeouts)
app.use(requestTimeout);

// Rate limiting, routes, metrics, 404, and error handler are mounted in async startup

// Graceful shutdown with automatic port detection
let server: Server | undefined;
let gpuMetricsInterval: ReturnType<typeof setInterval> | null = null;

(async () => {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Start job worker for SHIP/codegen (skip in serverless runtime)
    if (!isServerlessRuntime) {
      await startJobWorker();

      // Scheduled agents: Redis = BullMQ repeatable jobs; no Redis = node-cron
      if (process.env.REDIS_HOST?.trim()) {
        await startScheduledAgentsWorker();
        await loadRepeatableJobsFromDb();
      } else {
        const { loadAllFromDbAndSchedule: loadCron } = await import('./services/scheduledAgentsCron.js');
        await loadCron();
      }
    } else {
      logger.info('Serverless runtime: job workers and schedulers disabled');
    }

    // Rate limiting (uses Redis store when REDIS_HOST is set)
    const rateLimitMw = await applyRateLimiting();
    app.use('/api', rateLimitMw);
    // When REQUIRE_AUTH_FOR_API=true, chat/ship/codegen require auth; else optionalAuth
    app.use('/api', apiAuthMiddleware);
    
    // Kimi K2.5 optimization middleware - auto-routes to Kimi for appropriate requests
    app.use('/api/chat', kimiOptimizationMiddleware({ autoRoute: true, trackSavings: true }));
    app.use('/api/chat', kimiPromptOptimizationMiddleware());
    app.use('/api/ship', kimiOptimizationMiddleware({ autoRoute: true, trackSavings: true }));
    app.use('/api/codegen', kimiOptimizationMiddleware({ autoRoute: true, trackSavings: true }));
    app.use('/api/plan', kimiOptimizationMiddleware({ autoRoute: true, trackSavings: true }));
    
    app.use('/api', diagramRoutes);
    app.use('/api/intent', intentRoutes);
    app.use('/api/architecture', architectureRoutes);
    app.use('/api/prd', prdRoutes);
    app.use('/api/codegen', codegenRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/plan', planRoutes);
    app.use('/api/spec', specRoutes);
    app.use('/api/ship', shipRoutes);
    app.use('/auth', authRoutes);
    app.use('/api/github', githubRoutes);
    app.use('/api/analyze', analyzeRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/billing', billingRoutes);
    app.use('/api/cost', costDashboardRoutes);
    app.use('/api/skills-api', skillsApiRoutes);
    app.use('/api/messaging', messagingRoutes);
    app.use('/api/security', securityRoutes);
    app.use('/api/infra', infraRoutes);
    app.use('/api/testing', testingRoutes);
    app.use('/api/expo-test', expoTestRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api/jobs', jobsRoutes);
    app.use('/api/agents', agentsRoutes);
    app.use('/api/collaboration', collaborationRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/templates', templatesRoutes);
    app.use('/api/workspace', workspaceRoutes);
    app.use('/api/demo', demoRoutes);
    app.use('/api/integrations', integrationsRoutes);
    app.use('/api/rag', ragRoutes);
    app.use('/api/memory', memoryRoutes);
    app.use('/api/vision', visionRoutes);
    app.use('/api/voice', voiceRoutes);
    app.use('/health', healthRoutes);

    // Metrics endpoint
    app.get('/metrics', (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'production' && process.env.METRICS_AUTH) {
        const auth = req.headers.authorization;
        const expected = `Basic ${Buffer.from(process.env.METRICS_AUTH).toString('base64')}`;
        if (auth !== expected) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }
      next();
    }, getMetrics);

    // 404 handler
    app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found', type: 'not_found' });
    });

    // Global error handler
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
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

    (resolveAppReady as (() => void) | null)?.();

    // Initialize alerting
    initializeAlerting(60000); // Check every minute
    logger.info('Alerting service initialized');

    // Initialize skills system
    await skillRegistry.discoverSkills();
    await skillRegistry.initialize();
    skillRegistry.mountRoutes(app);
    logger.info({ skillCount: skillRegistry.count }, 'Skills system initialized');

    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST && !process.env.VERCEL) {
      const PORT = await findAvailablePort(PREFERRED_PORT);
      const host = process.env.HOST ?? (isProduction ? '127.0.0.1' : '0.0.0.0');
      server = app.listen(PORT, host, () => {
        logger.info(
          { port: PORT, host, env: process.env.NODE_ENV || 'development' },
          'Server started'
        );
        // Periodic GPU metrics (every 45s) when NIM is configured
        const nim = getNIMAccelerator();
        if (nim) {
          gpuMetricsInterval = setInterval(async () => {
            try {
              const gpu = await nim.getGpuMetrics();
              if (gpu) {
                updateGpuMetrics('nim-0', gpu.utilization, gpu.memoryUsed);
              } else {
                updateGpuMetrics('nim-0', 0, 0);
              }
            } catch {
              updateGpuMetrics('nim-0', 0, 0);
            }
          }, 45_000);
        }
      });
    }

    const gracefulShutdown = async () => {
      if (gpuMetricsInterval) clearInterval(gpuMetricsInterval);
      await stopJobWorker();
      await stopScheduledAgentsWorker();
      await shutdownWorkerPool();
      const nim = getNIMAccelerator();
      if (nim) await nim.flush();
      try {
        await getTieredCache().shutdown();
      } catch (e) {
        logger.warn({ err: (e as Error).message }, 'Tiered cache shutdown warning');
      }
      const finish = async () => {
        await skillRegistry.cleanup();
        await closeDatabase();
        await shutdownTracing();
        logger.info('Server closed');
        process.exit(0);
      };
      if (server) {
        server.close(() => {
          finish();
        });
      } else {
        await finish();
      }
    };

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await gracefulShutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await gracefulShutdown();
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ error: error.message }, 'Failed to start server');
    process.exit(1);
  }
})();

export default app;

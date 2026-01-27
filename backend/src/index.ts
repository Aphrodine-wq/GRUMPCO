// MUST be first import - loads environment variables before other modules
import './config/env.js';
import { initializeDatabase, closeDatabase } from './db/database.js';
import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requestIdMiddleware, httpLogger } from './middleware/logger.js';
import { applyRateLimiting, getEndpointRateLimiter } from './middleware/rateLimiter.js';
import { metricsMiddleware, getMetrics } from './middleware/metrics.js';
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
import authRoutes from './routes/auth.js';
import githubRoutes from './routes/github.js';
import { findAvailablePort } from './utils/portUtils.js';
import type { Server } from 'http';

const app: Express = express();
const PREFERRED_PORT = parseInt(process.env.PORT || '3000', 10) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

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

// Body parsing
app.use(express.json({ limit: '100kb' }));

// Apply advanced rate limiting (per-endpoint and per-user)
// This will use endpoint-specific limits where configured, or fall back to global
app.use('/api', applyRateLimiting());

// Routes
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
app.use('/health', healthRoutes);

// Metrics endpoint (should be protected in production)
app.get('/metrics', (req: Request, res: Response, next: NextFunction) => {
  // Basic auth check for metrics in production
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

  // Handle CORS errors
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

// Graceful shutdown with automatic port detection
let server: Server | undefined;

(async () => {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize alerting
    initializeAlerting(60000); // Check every minute
    logger.info('Alerting service initialized');

    const PORT = await findAvailablePort(PREFERRED_PORT);
    const host = process.env.HOST ?? (isProduction ? '127.0.0.1' : '0.0.0.0');
    server = app.listen(PORT, host, () => {
      logger.info(
        { port: PORT, host, env: process.env.NODE_ENV || 'development' },
        'Server started'
      );
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server?.close(async () => {
        await closeDatabase();
        await shutdownTracing();
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      server?.close(async () => {
        await closeDatabase();
        await shutdownTracing();
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ error: error.message }, 'Failed to start server');
    process.exit(1);
  }
})();

export default app;

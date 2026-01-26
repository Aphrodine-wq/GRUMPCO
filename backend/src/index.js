// MUST be first import - loads environment variables before other modules
import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { requestIdMiddleware, httpLogger } from './middleware/logger.js';
import { metricsMiddleware, getMetrics } from './middleware/metrics.js';
import logger from './middleware/logger.js';
import diagramRoutes from './routes/diagram.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import { findAvailablePort } from './utils/portUtils.js';
const app = express();
const PREFERRED_PORT = parseInt(process.env.PORT, 10) || 3000;
// Determine allowed origins
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];
// Security middleware - must be early in chain
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for diagrams
}));
// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        }
        else {
            logger.warn({ origin }, 'Blocked by CORS');
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// Request ID middleware (must be before logging)
app.use(requestIdMiddleware);
// HTTP logging
app.use(httpLogger);
// Metrics middleware
app.use(metricsMiddleware);
// Body parsing
app.use(express.json({ limit: '100kb' }));
// Rate limiting for API routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
        error: 'Too many requests',
        type: 'rate_limit',
        retryAfter: 15 * 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use x-forwarded-for if behind proxy, otherwise use built-in IP handling
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        return ipKeyGenerator(req);
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path.startsWith('/health');
    },
});
// Apply rate limiting to API routes
app.use('/api', apiLimiter);
// Routes
app.use('/api', diagramRoutes);
app.use('/auth', authRoutes);
app.use('/health', healthRoutes);
// Metrics endpoint (should be protected in production)
app.get('/metrics', (req, res, next) => {
    // Basic auth check for metrics in production
    if (process.env.NODE_ENV === 'production' && process.env.METRICS_AUTH) {
        const auth = req.headers.authorization;
        const expected = `Basic ${Buffer.from(process.env.METRICS_AUTH).toString('base64')}`;
        if (auth !== expected) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }
    next();
}, getMetrics);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', type: 'not_found' });
});
// Global error handler
app.use((err, req, res, _next) => {
    logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
    // Handle CORS errors
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'CORS error', type: 'forbidden' });
    }
    res.status(500).json({
        error: 'Internal server error',
        type: 'internal_error',
        ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
});
// Graceful shutdown with automatic port detection
let server;

(async () => {
    try {
        const PORT = await findAvailablePort(PREFERRED_PORT);
        server = app.listen(PORT, () => {
            logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server started');
        });

        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT received, shutting down gracefully');
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        });
    } catch (err) {
        logger.error({ error: err.message }, 'Failed to start server');
        process.exit(1);
    }
})();

export default app;
//# sourceMappingURL=index.js.map
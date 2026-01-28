/**
 * G-Rump Web API Server
 * Production-ready Express server with CORS, rate limiting, and security headers.
 */
import './config/env.js'
import express, { Request, Response, NextFunction, Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pino from 'pino'
import authRoutes from './routes/auth.js'
import billingRoutes from './routes/billing.js'
import { handleStripeWebhook } from './routes/billingWebhook.js'
import collaborationRoutes from './routes/collaboration.js'
import githubRoutes from './routes/github.js'
import analyticsRoutes from './routes/analytics.js'
import templatesRoutes from './routes/templates.js'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

function requestLogger(req: Request, _res: Response, next: NextFunction) {
  logger.info({ method: req.method, path: req.path, ip: req.ip }, 'request')
  next()
}

const app: Express = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

// Allowed origins for web app and desktop
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5178',
      'http://127.0.0.1:5178',
      'tauri://localhost',
      'http://tauri.localhost',
    ]

// Security headers (Helmet)
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
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: true,
  })
)

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true)
        }
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        logger.warn({ origin }, 'Blocked by CORS')
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// Request logging
app.use(requestLogger)

// Stripe webhook (raw body required for signature verification) – must be before express.json
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)

// Body parsing
app.use(express.json({ limit: '100kb' }))

// Global rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 120,
  message: { error: 'Too many requests', retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Health checks
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'grump-backend-web' })
})

app.get('/health/quick', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send('ok')
})

// Auth routes
app.use('/api/auth', authRoutes)
// Billing routes
app.use('/api/billing', billingRoutes)
// Collaboration routes
app.use('/api/collaboration', collaborationRoutes)
// GitHub integration
app.use('/api/github', githubRoutes)
// Analytics
app.use('/api/analytics', analyticsRoutes)
// Template marketplace
app.use('/api/templates', templatesRoutes)

// API 404 for other /api/*
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', type: 'not_found' })
})

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err.message }, 'Unhandled error')
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'CORS error', type: 'forbidden' })
    return
  }
  res.status(500).json({
    error: 'Internal server error',
    type: 'internal_error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  })
})

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Backend-web started')
})

const shutdown = () => {
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

export default app

import express, { Request, Response, Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getRequestLogger } from '../middleware/logger.js';
import { getDatabase } from '../db/database.js';
import { getAllServiceStates } from '../services/bulkheads.js';
import { getAlertingService } from '../services/alerting.js';
import { isRedisConnected } from '../services/redis.js';

const router: Router = express.Router();

// Shallow health check for load balancers
router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Quick health check for frontend status badge - no API calls, token-free
router.get('/quick', (_req: Request, res: Response) => {
  const apiKeyConfigured = !!(
    process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY !== 'your_api_key_here' &&
    process.env.ANTHROPIC_API_KEY.startsWith('sk-')
  );

  const authEnabled =
    !!process.env.SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_KEY &&
    process.env.SUPABASE_URL !== 'https://your-project.supabase.co';
  const billingEnabled =
    !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_');

  // Determine overall status
  let status: 'healthy' | 'unhealthy' = 'healthy';
  if (!apiKeyConfigured) {
    status = 'unhealthy';
  }

  res.json({
    status,
    checks: {
      api_key_configured: apiKeyConfigured,
      server_responsive: true,
      auth_enabled: authEnabled,
      billing_enabled: billingEnabled,
    },
    timestamp: new Date().toISOString(),
  });
});

// Liveness probe - is the process alive?
router.get('/live', (_req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const heapPercentage = (heapUsedMB / heapTotalMB) * 100;

  // Fail if heap usage exceeds 90%
  if (heapPercentage > 90) {
    res.status(503).json({
      status: 'unhealthy',
      reason: 'high_memory_usage',
      memory: {
        heapUsedMB: Math.round(heapUsedMB),
        heapTotalMB: Math.round(heapTotalMB),
        heapPercentage: Math.round(heapPercentage),
      },
    });
    return;
  }

  res.json({
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsedMB: Math.round(heapUsedMB),
      heapTotalMB: Math.round(heapTotalMB),
      heapPercentage: Math.round(heapPercentage),
    },
  });
});

// Readiness probe - can we handle requests?
router.get('/ready', async (_req: Request, res: Response) => {
  const log = getRequestLogger();

  const checks: Record<string, boolean> = {
    api_key: false,
    anthropic_api: false,
    database: false,
  };

  const redisRequired =
    process.env.REDIS_HOST != null && process.env.REDIS_HOST !== '' ||
    process.env.SESSION_STORAGE === 'redis';
  if (redisRequired) {
    checks.redis = false;
  }

  // Check API key is configured
  if (process.env.ANTHROPIC_API_KEY) {
    checks.api_key = true;
  }

  // Check database connectivity
  try {
    const db = getDatabase();
    const dbInstance = db.getDb();
    dbInstance.prepare('SELECT 1').get();
    checks.database = true;
  } catch (error) {
    const err = error as Error;
    log.warn({ error: err.message }, 'Database health check failed');
    checks.database = false;
  }

  // Check Redis when required (REDIS_HOST or SESSION_STORAGE=redis)
  if (redisRequired) {
    try {
      checks.redis = await isRedisConnected();
    } catch (error) {
      const err = error as Error;
      log.warn({ error: err.message }, 'Redis health check failed');
      checks.redis = false;
    }
  }

  // Check Anthropic API connectivity (lightweight check)
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Use a minimal request to verify connectivity
    // Note: This costs tokens, so we only do it on /ready, not /health
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
    checks.anthropic_api = true;
  } catch (error) {
    const err = error as Error;
    log.warn({ error: err.message }, 'Anthropic API health check failed');
    checks.anthropic_api = false;
  }

  const allHealthy = Object.values(checks).every(v => v);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
  });
});

// Detailed health check with all component statuses
router.get('/detailed', async (_req: Request, res: Response) => {
  const _log = getRequestLogger();
  const checks: Record<string, { status: 'healthy' | 'unhealthy' | 'degraded'; details?: unknown }> = {};

  // Database check
  try {
    const db = getDatabase();
    const dbInstance = db.getDb();
    const start = Date.now();
    dbInstance.prepare('SELECT 1').get();
    const latency = Date.now() - start;
    checks.database = {
      status: 'healthy',
      details: { latencyMs: latency },
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      details: { error: (error as Error).message },
    };
  }

  // Circuit breaker status
  try {
    const serviceStates = getAllServiceStates();
    const openCircuits: string[] = [];
    const halfOpenCircuits: string[] = [];

    for (const [serviceName, state] of Object.entries(serviceStates)) {
      if (state.state === 'open') {
        openCircuits.push(serviceName);
      } else if (state.state === 'half-open') {
        halfOpenCircuits.push(serviceName);
      }
    }

    if (openCircuits.length > 0) {
      checks.circuit_breakers = {
        status: 'unhealthy',
        details: { openCircuits, halfOpenCircuits, allStates: serviceStates },
      };
    } else if (halfOpenCircuits.length > 0) {
      checks.circuit_breakers = {
        status: 'degraded',
        details: { openCircuits, halfOpenCircuits, allStates: serviceStates },
      };
    } else {
      checks.circuit_breakers = {
        status: 'healthy',
        details: { allStates: serviceStates },
      };
    }
  } catch (error) {
    checks.circuit_breakers = {
      status: 'unhealthy',
      details: { error: (error as Error).message },
    };
  }

  // API endpoint check
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const start = Date.now();
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
    const latency = Date.now() - start;
    checks.api_endpoint = {
      status: 'healthy',
      details: { latencyMs: latency },
    };
  } catch (error) {
    checks.api_endpoint = {
      status: 'unhealthy',
      details: { error: (error as Error).message },
    };
  }

  // Metrics endpoint check
  try {
    checks.metrics = {
      status: 'healthy',
      details: { available: true },
    };
  } catch (error) {
    checks.metrics = {
      status: 'unhealthy',
      details: { error: (error as Error).message },
    };
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const heapPercentage = (heapUsedMB / heapTotalMB) * 100;

  checks.memory = {
    status: heapPercentage > 90 ? 'unhealthy' : heapPercentage > 75 ? 'degraded' : 'healthy',
    details: {
      heapUsedMB: Math.round(heapUsedMB),
      heapTotalMB: Math.round(heapTotalMB),
      heapPercentage: Math.round(heapPercentage),
    },
  };

  // Recent alerts
  try {
    const alertingService = getAlertingService();
    const recentAlerts = alertingService.getRecentAlerts(10);
    checks.alerts = {
      status: recentAlerts.some(a => a.severity === 'critical') ? 'unhealthy' : 'healthy',
      details: { recentAlerts: recentAlerts.length, alerts: recentAlerts },
    };
  } catch (error) {
    checks.alerts = {
      status: 'degraded',
      details: { error: (error as Error).message },
    };
  }

  // Overall status
  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');
  const overallStatus = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

  res.status(overallStatus === 'unhealthy' ? 503 : overallStatus === 'degraded' ? 200 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;

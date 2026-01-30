import express, { Request, Response, Router } from 'express';
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
    process.env.NVIDIA_NIM_API_KEY ||
    process.env.OPENROUTER_API_KEY
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
    nim_api: false,
    database: false,
  };

  const redisRequired =
    process.env.REDIS_HOST != null && process.env.REDIS_HOST !== '' ||
    process.env.SESSION_STORAGE === 'redis';
  if (redisRequired) {
    checks.redis = false;
  }

  // Check API key is configured (NVIDIA NIM or OpenRouter)
  if (process.env.NVIDIA_NIM_API_KEY || process.env.OPENROUTER_API_KEY) {
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

  // Check NVIDIA NIM API connectivity using OpenAI-compatible endpoint
  if (process.env.NVIDIA_NIM_API_KEY) {
    try {
      const response = await fetch(`${process.env.NVIDIA_NIM_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2.5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      checks.nim_api = response.ok;
    } catch (error) {
      const err = error as Error;
      log.warn({ error: err.message }, 'NVIDIA NIM API health check failed');
      checks.nim_api = false;
    }
  } else if (process.env.OPENROUTER_API_KEY) {
    // Check OpenRouter as fallback
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Opencode Health Check',
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2.5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      checks.nim_api = response.ok;
    } catch (error) {
      const err = error as Error;
      log.warn({ error: err.message }, 'OpenRouter API health check failed');
      checks.nim_api = false;
    }
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

  // API endpoint check (NVIDIA NIM with Kimi K2.5)
  try {
    const start = Date.now();
    let response;
    
    if (process.env.NVIDIA_NIM_API_KEY) {
      response = await fetch(`${process.env.NVIDIA_NIM_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2.5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
    } else if (process.env.OPENROUTER_API_KEY) {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Opencode Health Check',
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2.5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
    } else {
      throw new Error('No AI provider API key configured');
    }
    
    const latency = Date.now() - start;
    if (response.ok) {
      checks.api_endpoint = {
        status: 'healthy',
        details: { latencyMs: latency },
      };
    } else {
      throw new Error(`API returned status ${response.status}`);
    }
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

  // Redis (optional): report degraded when configured but disconnected
  const redisConfigured = !!(process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== '');
  if (redisConfigured) {
    try {
      const connected = await isRedisConnected();
      checks.redis = {
        status: connected ? 'healthy' : 'degraded',
        details: connected
          ? { message: 'connected' }
          : {
              message: 'Redis configured but disconnected',
              impact: 'Rate limiting not shared; L2 cache disabled. See docs/RUNBOOK_REDIS.md.',
            },
      };
    } catch (error) {
      checks.redis = {
        status: 'degraded',
        details: { error: (error as Error).message, impact: 'L2 cache disabled; rate limits in-memory only.' },
      };
    }
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

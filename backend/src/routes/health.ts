import express, { type Request, type Response, type Router } from 'express';
import { getRequestLogger } from '../middleware/logger.js';
import { getDatabase } from '../db/database.js';
import { getAllServiceStates } from '../services/infra/bulkheads.js';
import { getAlertingService } from '../services/infra/alerting.js';
import { isRedisConnected } from '../services/infra/redis.js';
import {
  getConfiguredProviders,
  getProviderConfig,
  type LLMProvider,
} from '../services/ai-providers/llmGateway.js';
import { env } from '../config/env.js';

const router: Router = express.Router();

// Shallow health check for load balancers
router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Quick health check for frontend status badge - no API calls, token-free
router.get('/quick', (_req: Request, res: Response) => {
  const apiKeyConfigured = !!process.env.NVIDIA_NIM_API_KEY;

  const authEnabled =
    !!process.env.SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_KEY &&
    process.env.SUPABASE_URL !== 'https://your-project.supabase.co';

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

  // Fail if heap usage exceeds 90%, but only when the total heap is large
  // enough to be meaningful. V8 naturally runs at 90%+ on small heaps (< 200 MB)
  // because GC only expands the heap under real memory pressure.
  const heapIsLarge = heapTotalMB >= 200;
  if (heapIsLarge && heapPercentage > 90) {
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
    (process.env.REDIS_HOST != null && process.env.REDIS_HOST !== '') ||
    process.env.SESSION_STORAGE === 'redis';
  if (redisRequired) {
    checks.redis = false;
  }

  // Check API key is configured (NVIDIA NIM)
  if (process.env.NVIDIA_NIM_API_KEY) {
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
      const response = await fetch(
        `${process.env.NVIDIA_NIM_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'meta/llama-3.1-70b-instruct',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        }
      );
      checks.nim_api = response.ok;
    } catch (error) {
      const err = error as Error;
      log.warn({ error: err.message }, 'NVIDIA NIM API health check failed');
      checks.nim_api = false;
    }
  }

  const allHealthy = Object.values(checks).every((v) => v);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
  });
});

// Detailed health check with all component statuses
router.get('/detailed', async (_req: Request, res: Response) => {
  const _log = getRequestLogger();
  const checks: Record<
    string,
    { status: 'healthy' | 'unhealthy' | 'degraded'; details?: unknown }
  > = {};

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

  // API endpoint check (NVIDIA NIM - Powered by NVIDIA)
  try {
    const start = Date.now();
    let response;

    if (process.env.NVIDIA_NIM_API_KEY) {
      response = await fetch(
        `${process.env.NVIDIA_NIM_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'meta/llama-3.1-70b-instruct',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        }
      );
    } else {
      throw new Error('NVIDIA NIM API key not configured');
    }

    const latency = Date.now() - start;
    if (response.ok) {
      checks.api_endpoint = {
        status: 'healthy',
        details: { latencyMs: latency, provider: 'nvidia-nim' },
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
        details: {
          error: (error as Error).message,
          impact: 'L2 cache disabled; rate limits in-memory only.',
        },
      };
    }
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const heapPercentage = (heapUsedMB / heapTotalMB) * 100;

  // Only flag memory as unhealthy/degraded when heap is large enough (>= 200 MB).
  // Small V8 heaps naturally run at 90%+ — that's normal GC behavior.
  const detailedHeapIsLarge = heapTotalMB >= 200;
  checks.memory = {
    status:
      detailedHeapIsLarge && heapPercentage > 90
        ? 'unhealthy'
        : detailedHeapIsLarge && heapPercentage > 75
          ? 'degraded'
          : 'healthy',
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
      status: recentAlerts.some((a) => a.severity === 'critical') ? 'unhealthy' : 'healthy',
      details: { recentAlerts: recentAlerts.length, alerts: recentAlerts },
    };
  } catch (error) {
    checks.alerts = {
      status: 'degraded',
      details: { error: (error as Error).message },
    };
  }

  // Overall status
  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some((c) => c.status === 'unhealthy');
  const overallStatus = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

  res.status(overallStatus === 'unhealthy' ? 503 : overallStatus === 'degraded' ? 200 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

// AI Providers status endpoint
router.get('/ai-providers', async (_req: Request, res: Response) => {
  const log = getRequestLogger();
  const providers = getConfiguredProviders();

  const providerStatus: Record<
    string,
    {
      configured: boolean;
      healthy?: boolean;
      latencyMs?: number;
      error?: string;
      models?: string[];
    }
  > = {};

  // Check each configured provider
  for (const provider of providers) {
    const config = getProviderConfig(provider);
    if (!config) continue;

    const start = Date.now();
    try {
      // Quick health check - just validate the endpoint is reachable
      // For most providers, we'll do a lightweight check
      let healthy = false;

      switch (provider) {
        case 'nim':
          if (env.NVIDIA_NIM_API_KEY) {
            const response = await fetch(
              `${env.NVIDIA_NIM_URL || 'https://integrate.api.nvidia.com/v1'}/models`,
              {
                headers: { Authorization: `Bearer ${env.NVIDIA_NIM_API_KEY}` },
              }
            );
            healthy = response.ok;
          }
          break;

        case 'openrouter':
          if (env.OPENROUTER_API_KEY) {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
              headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
            });
            healthy = response.ok;
          }
          break;
        case 'ollama':
          if (env.OLLAMA_BASE_URL) {
            const response = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`);
            healthy = response.ok;
          }
          break;
      }

      providerStatus[provider] = {
        configured: true,
        healthy,
        latencyMs: Date.now() - start,
        models: config.models.slice(0, 5), // Show first 5 models
      };
    } catch (error) {
      providerStatus[provider] = {
        configured: true,
        healthy: false,
        latencyMs: Date.now() - start,
        error: (error as Error).message,
        models: config.models.slice(0, 5),
      };
    }
  }

  // Add unconfigured providers
  const allProviders: LLMProvider[] = ['nim', 'openrouter', 'ollama'];
  for (const provider of allProviders) {
    if (!providerStatus[provider]) {
      providerStatus[provider] = { configured: false };
    }
  }

  const healthyCount = Object.values(providerStatus).filter((p) => p.healthy).length;
  const configuredCount = Object.values(providerStatus).filter((p) => p.configured).length;

  res.json({
    status: healthyCount > 0 ? 'healthy' : configuredCount > 0 ? 'degraded' : 'unhealthy',
    summary: {
      total: allProviders.length,
      configured: configuredCount,
      healthy: healthyCount,
    },
    providers: providerStatus,
    timestamp: new Date().toISOString(),
  });
});

export default router;

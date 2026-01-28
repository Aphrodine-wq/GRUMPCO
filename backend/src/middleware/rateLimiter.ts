/**
 * Advanced Rate Limiting Middleware
 * Per-user and per-endpoint rate limiting with Redis when REDIS_HOST is set.
 * Tier-based limits: free < pro < team < enterprise (when X-Tier header or tier context is set).
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request, Response } from 'express';
import logger from './logger.js';
import { getRedisClient, isRedisConnected } from '../services/redis.js';
import type { TierId } from '../services/featureFlagsService.js';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface EndpointRateLimit {
  path: string;
  config: RateLimitConfig;
}

interface UserRateLimit {
  userId: string;
  config: RateLimitConfig;
}

/** Max requests per window by tier (same windowMs). */
const TIER_MULTIPLIERS: Record<TierId, number> = {
  free: 1,
  pro: 4,
  team: 8,
  enterprise: 20,
};

function getTierFromRequest(req: Request): TierId {
  const h = (req.headers['x-tier'] as string)?.toLowerCase();
  if (h === 'pro' || h === 'team' || h === 'enterprise') return h;
  return 'free';
}

// Per-endpoint base rate limit configurations (max is per-tier: base * TIER_MULTIPLIERS)
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  '/api/chat': {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many chat requests. Please wait a moment.',
  },
  '/api/codegen': {
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many code generation requests. Please wait a moment.',
  },
  '/api/diagram': {
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: 'Too many diagram requests. Please wait a moment.',
  },
  '/api/intent': {
    windowMs: 60 * 1000, // 1 minute
    max: 15,
    message: 'Too many intent requests. Please wait a moment.',
  },
  '/api/architecture': {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many architecture requests. Please wait a moment.',
  },
  '/api/prd': {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many PRD requests. Please wait a moment.',
  },
};

// Global fallback rate limit (max scaled by tier)
const GLOBAL_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests. Please wait a moment.',
};

/**
 * Get user ID from request (from auth middleware or session)
 */
function getUserId(req: Request): string | null {
  // Try to get from auth middleware
  if ((req as any).user?.id) {
    return (req as any).user.id;
  }

  // Try to get from session
  if ((req as any).session?.userId) {
    return (req as any).session.userId;
  }

  // Fallback to IP if no user ID
  return null;
}

type Store = InstanceType<typeof RedisStore>;

/**
 * Get Redis store when REDIS_HOST is set and Redis is connected
 */
async function getRedisStoreIfConfigured(): Promise<Store | undefined> {
  if (!process.env.REDIS_HOST) return undefined;
  try {
    const client = getRedisClient();
    const connected = await isRedisConnected();
    if (!connected) {
      logger.debug('Redis not connected, rate limiting will use in-memory store');
      return undefined;
    }
    return new RedisStore({
      sendCommand: (command: string, ...args: string[]) =>
        client.call(command, ...args) as Promise<number>,
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Redis store for rate limiting unavailable, using in-memory');
    return undefined;
  }
}

/**
 * Create rate limiter with custom key generator and optional Redis store
 */
function createRateLimiter(
  config: RateLimitConfig,
  keyGenerator?: (req: Request) => string,
  store?: Store
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    ...(store && { store }),
    message: {
      error: config.message || 'Too many requests',
      type: 'rate_limit',
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
      ip: false,
      // @ts-ignore - suppress IPv6 validation error
      keyGeneratorIpFallback: false,
    },
    keyGenerator: keyGenerator || ((req: Request) => {
      // Default: use IP address
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded && typeof forwarded === 'string') {
        return `ip:${forwarded.split(',')[0].trim()}`;
      }
      let ip = req.ip || req.socket.remoteAddress || 'unknown';
      // Sanitize IPv6 localhost
      if (ip === '::1') {
        ip = '127.0.0.1';
      }
      return `ip:${ip}`;
    }),
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path.startsWith('/health');
    },
    handler: (req: Request, res: Response) => {
      logger.warn(
        {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userId: getUserId(req),
        },
        'Rate limit exceeded'
      );

      res.status(429).json({
        error: config.message || 'Too many requests',
        type: 'rate_limit',
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
    },
  });
}

/**
 * Create per-user rate limiter
 * Uses user ID from auth, falls back to IP if no user
 */
export function createUserRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  return createRateLimiter(config, (req: Request) => {
    const userId = getUserId(req);
    if (userId) {
      return `user:${userId}`;
    }
    // Fallback to IP
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      return `ip:${forwarded.split(',')[0].trim()}`;
    }
    let ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (ip === '::1') {
      ip = '127.0.0.1';
    }
    return `ip:${ip}`;
  });
}

/**
 * Create per-endpoint rate limiter with tier-scaled max
 */
function createEndpointRateLimiter(
  path: string,
  config: RateLimitConfig,
  tier: TierId,
  store?: Store
): RateLimitRequestHandler {
  const scaled = { ...config, max: Math.max(1, Math.floor(config.max * (TIER_MULTIPLIERS[tier] ?? 1))) };
  return createRateLimiter(
    scaled,
    (req: Request) => {
      const userId = getUserId(req);
      const base = userId ? `user:${userId}` : `ip:${req.ip || 'unknown'}`;
      return `endpoint:${path}:tier:${tier}:${base}`;
    },
    store
  );
}

/**
 * Get rate limiter for a specific endpoint and tier (optional Redis store for multi-instance)
 */
export function getEndpointRateLimiter(path: string, tier: TierId, store?: Store): RateLimitRequestHandler | null {
  const config = ENDPOINT_LIMITS[path];
  if (!config) return null;
  return createEndpointRateLimiter(path, config, tier, store);
}

/**
 * Normalize request path to endpoint key for rate limit lookup.
 * e.g. /api/chat/stream -> /api/chat, /api/codegen/start -> /api/codegen
 */
function normalizePathForRateLimit(path: string): string {
  const bases = Object.keys(ENDPOINT_LIMITS);
  for (const base of bases) {
    if (path === base || path.startsWith(base + '/')) return base;
  }
  return path;
}

/** Build limiters per tier for global and each endpoint. */
function buildTierLimiters(store?: Store): Map<string, RateLimitRequestHandler> {
  const limiters = new Map<string, RateLimitRequestHandler>();
  const tiers: TierId[] = ['free', 'pro', 'team', 'enterprise'];
  for (const tier of tiers) {
    const globalMax = Math.max(1, Math.floor(GLOBAL_LIMIT.max * (TIER_MULTIPLIERS[tier] ?? 1)));
    limiters.set(`global:${tier}`, createRateLimiter(
      { ...GLOBAL_LIMIT, max: globalMax },
      (req: Request) => {
        const userId = getUserId(req);
        const base = userId ? `user:${userId}` : `ip:${req.ip || 'unknown'}`;
        return `global:tier:${tier}:${base}`;
      },
      store
    ));
    for (const path of Object.keys(ENDPOINT_LIMITS)) {
      limiters.set(`${path}:${tier}`, createEndpointRateLimiter(path, ENDPOINT_LIMITS[path], tier, store));
    }
  }
  return limiters;
}

/**
 * Apply rate limiting to specific routes.
 * When REDIS_HOST is set and Redis is connected, uses Redis store for multi-instance consistency.
 * Tier (X-Tier header) scales limits: free &lt; pro &lt; team &lt; enterprise.
 */
export async function applyRateLimiting(): Promise<RateLimitRequestHandler> {
  const store = await getRedisStoreIfConfigured();
  if (store) {
    logger.info('Rate limiting using Redis store (tier-aware)');
  }
  const tierLimiters = buildTierLimiters(store);
  return (req: Request, res: Response, next: () => void) => {
    const tier = getTierFromRequest(req);
    const pathKey = normalizePathForRateLimit(req.path);
    const endpointLimiter = tierLimiters.get(`${pathKey}:${tier}`);
    const globalLimiter = tierLimiters.get(`global:${tier}`);
    (endpointLimiter ?? globalLimiter!)(req, res, next);
  };
}

/**
 * Redis-based rate limiter (for multi-instance deployments)
 * Note: Requires ioredis package and Redis instance
 */
export async function createRedisRateLimiter(
  config: RateLimitConfig,
  redisClient?: any
): Promise<RateLimitRequestHandler | null> {
  if (!redisClient) {
    // Fallback to in-memory if Redis not available
    logger.warn('Redis not available, using in-memory rate limiting');
    return createRateLimiter(config);
  }

  try {
    // Use express-rate-limit with Redis store
    // This would require express-rate-limit/redis-store or similar
    // For now, return in-memory limiter
    logger.info('Redis rate limiting not fully implemented, using in-memory');
    return createRateLimiter(config);
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Failed to create Redis rate limiter');
    return createRateLimiter(config);
  }
}

/**
 * Get rate limit configuration for an endpoint
 */
export function getEndpointLimitConfig(path: string): RateLimitConfig | null {
  return ENDPOINT_LIMITS[path] || null;
}

/**
 * Update endpoint rate limit configuration
 */
export function updateEndpointLimit(path: string, config: Partial<RateLimitConfig>): void {
  if (ENDPOINT_LIMITS[path]) {
    ENDPOINT_LIMITS[path] = { ...ENDPOINT_LIMITS[path], ...config };
    logger.info({ path, config: ENDPOINT_LIMITS[path] }, 'Endpoint rate limit updated');
  } else {
    ENDPOINT_LIMITS[path] = { ...GLOBAL_LIMIT, ...config };
    logger.info({ path, config: ENDPOINT_LIMITS[path] }, 'Endpoint rate limit created');
  }
}

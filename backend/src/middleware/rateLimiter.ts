/**
 * Advanced Rate Limiting Middleware
 * Per-user and per-endpoint rate limiting with Redis support
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';
import logger from './logger.js';

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

// Per-endpoint rate limit configurations
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

// Global fallback rate limit
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

/**
 * Create rate limiter with custom key generator
 */
function createRateLimiter(config: RateLimitConfig, keyGenerator?: (req: Request) => string): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: config.message || 'Too many requests',
      type: 'rate_limit',
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req: Request) => {
      // Default: use IP address
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded && typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.socket.remoteAddress || 'unknown';
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
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  });
}

/**
 * Create per-endpoint rate limiter
 */
export function createEndpointRateLimiter(path: string, config: RateLimitConfig): RateLimitRequestHandler {
  return createRateLimiter(config, (req: Request) => {
    const userId = getUserId(req);
    const key = userId ? `endpoint:${path}:user:${userId}` : `endpoint:${path}:ip:${req.ip || 'unknown'}`;
    return key;
  });
}

/**
 * Get rate limiter for a specific endpoint
 */
export function getEndpointRateLimiter(path: string): RateLimitRequestHandler | null {
  const config = ENDPOINT_LIMITS[path];
  if (!config) {
    return null;
  }

  return createEndpointRateLimiter(path, config);
}

/**
 * Global rate limiter (fallback)
 */
export const globalRateLimiter = createRateLimiter(GLOBAL_LIMIT);

/**
 * Apply rate limiting to specific routes
 * Returns middleware that applies endpoint-specific limits or falls back to global
 */
export function applyRateLimiting(): RateLimitRequestHandler {
  return (req: Request, res: Response, next: () => void) => {
    // Check if there's an endpoint-specific limiter
    const endpointLimiter = getEndpointRateLimiter(req.path);
    
    if (endpointLimiter) {
      // Apply endpoint-specific limit
      endpointLimiter(req, res, next);
    } else {
      // Apply global limit
      globalRateLimiter(req, res, next);
    }
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

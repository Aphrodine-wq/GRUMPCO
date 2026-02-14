/**
 * Cache Service
 * Provides Redis-based caching for intent compilation, architectures, PRDs, and work reports
 */

import { getRedisClient, isRedisConnected } from '../infra/redis.js';
import logger from '../../middleware/logger.js';
import crypto from 'crypto';

export type CacheType =
  | 'intent'
  | 'architecture'
  | 'prd'
  | 'work_report'
  | 'context'
  | 'intent-optimization';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix: string;
}

const CACHE_CONFIGS: Record<CacheType, CacheConfig> = {
  intent: { ttl: 3600, prefix: 'cache:intent:' }, // 1 hour
  architecture: { ttl: 7200, prefix: 'cache:arch:' }, // 2 hours
  prd: { ttl: 7200, prefix: 'cache:prd:' }, // 2 hours
  work_report: { ttl: 86400, prefix: 'cache:report:' }, // 24 hours
  context: { ttl: 1800, prefix: 'cache:context:' }, // 30 minutes
  'intent-optimization': { ttl: 3600, prefix: 'cache:intent-opt:' }, // 1 hour
};

/**
 * Generate cache key from input
 */
function generateCacheKey(type: CacheType, input: string): string {
  const config = CACHE_CONFIGS[type];
  const hash = crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
  return `${config.prefix}${hash}`;
}

/**
 * Get value from cache
 */
export async function getFromCache<T>(type: CacheType, input: string): Promise<T | null> {
  if (!(await isRedisConnected())) {
    logger.debug({ type }, 'Redis not connected, cache miss');
    return null;
  }

  try {
    const redis = getRedisClient();
    const key = generateCacheKey(type, input);
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as T;
  } catch (error) {
    logger.error({ error: (error as Error).message, type }, 'Cache get failed');
    return null;
  }
}

/**
 * Set value in cache
 */
export async function setInCache<T>(type: CacheType, input: string, value: T): Promise<boolean> {
  if (!(await isRedisConnected())) {
    logger.debug({ type }, 'Redis not connected, skipping cache set');
    return false;
  }

  try {
    const redis = getRedisClient();
    const config = CACHE_CONFIGS[type];
    const key = generateCacheKey(type, input);
    const data = JSON.stringify(value);

    await redis.setex(key, config.ttl, data);
    return true;
  } catch (error) {
    logger.error({ error: (error as Error).message, type }, 'Cache set failed');
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function deleteFromCache(type: CacheType, input: string): Promise<boolean> {
  if (!(await isRedisConnected())) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const key = generateCacheKey(type, input);
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error({ error: (error as Error).message, type }, 'Cache delete failed');
    return false;
  }
}

/**
 * Clear all cache entries of a specific type
 */
export async function clearCacheType(type: CacheType): Promise<number> {
  if (!(await isRedisConnected())) {
    return 0;
  }

  try {
    const redis = getRedisClient();
    const config = CACHE_CONFIGS[type];
    const keys = await redis.keys(`${config.prefix}*`);

    if (keys.length === 0) {
      return 0;
    }

    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    logger.error({ error: (error as Error).message, type }, 'Cache clear failed');
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<Record<CacheType, number>> {
  if (!(await isRedisConnected())) {
    return {
      intent: 0,
      architecture: 0,
      prd: 0,
      work_report: 0,
      context: 0,
      'intent-optimization': 0,
    };
  }

  try {
    const redis = getRedisClient();
    const stats: Record<CacheType, number> = {
      intent: 0,
      architecture: 0,
      prd: 0,
      work_report: 0,
      context: 0,
      'intent-optimization': 0,
    };

    for (const [type, config] of Object.entries(CACHE_CONFIGS) as [CacheType, CacheConfig][]) {
      const keys = await redis.keys(`${config.prefix}*`);
      stats[type] = keys.length;
    }

    return stats;
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Cache stats failed');
    return {
      intent: 0,
      architecture: 0,
      prd: 0,
      work_report: 0,
      context: 0,
      'intent-optimization': 0,
    };
  }
}

/**
 * Cache wrapper function
 */
export async function withCache<T>(
  type: CacheType,
  input: string,
  fn: () => Promise<T>,
  options?: { skipCache?: boolean }
): Promise<T> {
  // Skip cache if requested or Redis not available
  if (options?.skipCache || !(await isRedisConnected())) {
    return await fn();
  }

  // Try to get from cache
  const cached = await getFromCache<T>(type, input);
  if (cached !== null) {
    logger.debug({ type }, 'Cache hit');
    return cached;
  }

  // Cache miss, execute function
  logger.debug({ type }, 'Cache miss');
  const result = await fn();

  // Store in cache (fire and forget)
  setInCache(type, input, result).catch((error) => {
    logger.warn({ error: (error as Error).message, type }, 'Failed to cache result');
  });

  return result;
}

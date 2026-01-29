/**
 * Context Cache Service
 * Caches generated contexts to avoid regeneration
 */

import crypto from 'crypto';
import logger from '../middleware/logger.js';
import type { MasterContext } from '../types/context.js';

export interface ContextCacheOptions {
  enrichedIntent?: unknown;
  architecture?: unknown;
  prd?: unknown;
}

interface CachedContext {
  context: MasterContext;
  hash: string;
  createdAt: string;
  expiresAt: string;
}

// In-memory cache (for single instance)
// In production with multiple instances, use Redis
const contextCache = new Map<string, CachedContext>();

// TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate hash from project description for cache key
 */
function generateCacheKey(projectDescription: string, options?: {
  enrichedIntent?: unknown;
  architecture?: unknown;
  prd?: unknown;
}): string {
  const data = {
    projectDescription,
    enrichedIntent: options?.enrichedIntent ? 'provided' : undefined,
    architecture: options?.architecture ? 'provided' : undefined,
    prd: options?.prd ? 'provided' : undefined,
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return `context_${hash}`;
}

/**
 * Get cached context if available and not expired
 */
export function getCachedContext(
  projectDescription: string,
  options?: ContextCacheOptions
): MasterContext | null {
  const cacheKey = generateCacheKey(projectDescription, options);
  const cached = contextCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  // Check if expired
  const now = new Date().getTime();
  const expiresAt = new Date(cached.expiresAt).getTime();

  if (now > expiresAt) {
    contextCache.delete(cacheKey);
    logger.debug({ cacheKey }, 'Context cache expired');
    return null;
  }

  logger.debug({ cacheKey }, 'Context cache hit');
  return cached.context;
}

/**
 * Cache a generated context
 */
export function cacheContext(
  projectDescription: string,
  context: MasterContext,
  options?: ContextCacheOptions
): void {
  const cacheKey = generateCacheKey(projectDescription, options);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  const cached: CachedContext = {
    context,
    hash: cacheKey,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  contextCache.set(cacheKey, cached);
  logger.debug({ cacheKey, expiresAt: cached.expiresAt }, 'Context cached');
}

/**
 * Invalidate cache for a specific project description
 */
export function invalidateCache(projectDescription: string): void {
  const cacheKey = generateCacheKey(projectDescription);
  contextCache.delete(cacheKey);
  logger.debug({ cacheKey }, 'Context cache invalidated');
}

/**
 * Clear all cached contexts
 */
export function clearCache(): void {
  const count = contextCache.size;
  contextCache.clear();
  logger.info({ clearedCount: count }, 'Context cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
  oldestEntry?: string;
  newestEntry?: string;
} {
  const keys = Array.from(contextCache.keys());
  const entries = Array.from(contextCache.values());

  let oldestEntry: string | undefined;
  let newestEntry: string | undefined;

  if (entries.length > 0) {
    const sorted = entries.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    oldestEntry = sorted[0].createdAt;
    newestEntry = sorted[sorted.length - 1].createdAt;
  }

  return {
    size: contextCache.size,
    keys,
    oldestEntry,
    newestEntry,
  };
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries(): number {
  const now = new Date().getTime();
  let cleaned = 0;

  for (const [key, cached] of contextCache.entries()) {
    const expiresAt = new Date(cached.expiresAt).getTime();
    if (now > expiresAt) {
      contextCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug({ cleaned }, 'Expired context cache entries cleaned');
  }

  return cleaned;
}

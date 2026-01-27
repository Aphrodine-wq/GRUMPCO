/**
 * Mock Context Cache
 * In-memory cache for testing context caching behavior
 */

import type { MasterContext } from '../../src/types/context.js';

interface CachedContext {
  context: MasterContext;
  hash: string;
  createdAt: string;
  expiresAt: string;
}

export class MockContextCache {
  private cache: Map<string, CachedContext> = new Map();
  private ttl = 24 * 60 * 60 * 1000; // 24 hours
  private shouldReturnNull = false;

  /**
   * Configure cache to return null (cache miss)
   */
  setShouldReturnNull(value: boolean): void {
    this.shouldReturnNull = value;
  }

  /**
   * Set TTL for cache entries
   */
  setTTL(ms: number): void {
    this.ttl = ms;
  }

  /**
   * Reset cache
   */
  reset(): void {
    this.cache.clear();
    this.shouldReturnNull = false;
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Get cached context
   */
  getCachedContext(
    projectDescription: string,
    options?: {
      enrichedIntent?: any;
      architecture?: any;
      prd?: any;
    }
  ): MasterContext | null {
    if (this.shouldReturnNull) {
      return null;
    }

    const cacheKey = this._generateCacheKey(projectDescription, options);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if expired
    const now = new Date().getTime();
    const expiresAt = new Date(cached.expiresAt).getTime();

    if (now > expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.context;
  }

  /**
   * Cache a context
   */
  cacheContext(
    projectDescription: string,
    context: MasterContext,
    options?: {
      enrichedIntent?: any;
      architecture?: any;
      prd?: any;
    }
  ): void {
    const cacheKey = this._generateCacheKey(projectDescription, options);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttl);

    const cached: CachedContext = {
      context,
      hash: cacheKey,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.cache.set(cacheKey, cached);
  }

  /**
   * Invalidate cache
   */
  invalidateCache(projectDescription: string): void {
    const cacheKey = this._generateCacheKey(projectDescription);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const keys = Array.from(this.cache.keys());
    const entries = Array.from(this.cache.values());

    let oldestEntry: string | undefined;
    let newestEntry: string | undefined;

    if (entries.length > 0) {
      const sorted = entries.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      oldestEntry = sorted[0].createdAt;
      newestEntry = sorted[sorted.length - 1].createdAt;
    }

    return {
      size: this.cache.size,
      keys,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanupExpiredEntries(): number {
    const now = new Date().getTime();
    let cleaned = 0;

    for (const [key, cached] of this.cache.entries()) {
      const expiresAt = new Date(cached.expiresAt).getTime();
      if (now > expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  private _generateCacheKey(
    projectDescription: string,
    options?: {
      enrichedIntent?: any;
      architecture?: any;
      prd?: any;
    }
  ): string {
    const data = {
      projectDescription,
      enrichedIntent: options?.enrichedIntent ? 'provided' : undefined,
      architecture: options?.architecture ? 'provided' : undefined,
      prd: options?.prd ? 'provided' : undefined,
    };
    // Simple hash for testing
    return `context_${JSON.stringify(data).length}`;
  }
}

/**
 * Create a mock context cache instance
 */
export function createMockContextCache(): MockContextCache {
  return new MockContextCache();
}

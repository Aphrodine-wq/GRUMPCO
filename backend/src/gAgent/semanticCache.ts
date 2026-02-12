/**
 * Semantic Cache - Hierarchical cache delegation layer
 *
 * Provides a typed facade over the HierarchicalCacheService for the
 * SemanticCompiler, managing compilation results across L1 (hot),
 * L2 (warm), and L3 (persistent) tiers.
 *
 * @fileoverview Cache operations extracted from semanticCompiler.ts
 * @module gAgent/semanticCache
 */

import type {
  HierarchicalCacheService,
  CacheMetrics as HierarchicalCacheMetrics,
  CacheEntry,
} from '../services/caching/hierarchicalCache.js';

// ============================================================================
// SEMANTIC CACHE MIXIN
// ============================================================================

/**
 * Mixin that adds hierarchical cache methods to a host class.
 * The host must expose a `hierarchicalCache` property.
 */
export class SemanticCacheDelegate {
  constructor(private hierarchicalCache: HierarchicalCacheService) {}

  /**
   * Get cached compilation result using hierarchical cache
   * Checks L1 (hot) → L2 (warm) → L3 (persistent)
   */
  async getCached<T = unknown>(
    key: string,
    namespace: string = 'compilation'
  ): Promise<T | undefined> {
    return this.hierarchicalCache.get<T>(key, namespace);
  }

  /**
   * Set cached compilation result with tier preference
   */
  async setCached<T = unknown>(
    key: string,
    value: T,
    options: {
      namespace?: string;
      ttl?: number;
      importance?: number;
      tier?: 'l1' | 'l2' | 'l3';
    } = {}
  ): Promise<void> {
    await this.hierarchicalCache.set(key, value, {
      namespace: options.namespace || 'compilation',
      ttl: options.ttl,
      importance: options.importance || 0.5,
      tier: options.tier || 'l2',
    });
  }

  /**
   * Delete from all cache tiers
   */
  async deleteCached(key: string, namespace: string = 'compilation'): Promise<boolean> {
    return this.hierarchicalCache.delete(key, namespace);
  }

  /**
   * Check if key exists in hierarchical cache
   */
  async hasCached(key: string, namespace: string = 'compilation'): Promise<boolean> {
    return this.hierarchicalCache.has(key, namespace);
  }

  /**
   * Get hierarchical cache metrics
   */
  getHierarchicalCacheMetrics(): HierarchicalCacheMetrics {
    return this.hierarchicalCache.getMetrics();
  }

  /**
   * Clear cache by tier
   */
  async clearHierarchicalCache(
    options: { l1?: boolean; l2?: boolean; l3?: boolean } = {}
  ): Promise<void> {
    await this.hierarchicalCache.clear(options);
  }

  /**
   * Clear cache by namespace
   */
  async clearCacheNamespace(namespace: string): Promise<number> {
    return this.hierarchicalCache.clearNamespace(namespace);
  }

  /**
   * Warm L2 cache from persistent L3
   */
  async warmCacheFromPersistent(limit: number = 100): Promise<number> {
    return this.hierarchicalCache.warmFromPersistent(undefined, limit);
  }

  /**
   * Preload entries into cache (e.g., frequently accessed files)
   */
  async preloadCache<T = unknown>(
    entries: Array<{
      key: string;
      value: T;
      namespace?: string;
      importance?: number;
    }>
  ): Promise<void> {
    await this.hierarchicalCache.preload(entries);
  }

  /**
   * Get cached entries by namespace
   */
  async getCacheEntriesByNamespace(namespace: string): Promise<CacheEntry[]> {
    return this.hierarchicalCache.getByNamespace(namespace);
  }

  /**
   * Batch get cached values
   */
  async getCachedMany<T = unknown>(
    keys: string[],
    namespace: string = 'compilation'
  ): Promise<Map<string, T>> {
    return this.hierarchicalCache.getMany<T>(keys, namespace);
  }

  /**
   * Batch set cached values
   */
  async setCachedMany<T = unknown>(
    entries: Array<{ key: string; value: T; importance?: number }>,
    options: {
      namespace?: string;
      ttl?: number;
      tier?: 'l1' | 'l2' | 'l3';
    } = {}
  ): Promise<void> {
    await this.hierarchicalCache.setMany(entries, {
      namespace: options.namespace || 'compilation',
      ttl: options.ttl,
      tier: options.tier || 'l2',
    });
  }

  /**
   * Shutdown hierarchical cache (persist all data)
   */
  async shutdownHierarchicalCache(): Promise<void> {
    await this.hierarchicalCache.shutdown();
  }
}

// Re-export types needed by consumers
export type { HierarchicalCacheMetrics, CacheEntry };

/**
 * Cache Warmer
 * Predictive cache warming based on access patterns
 */

import logger from "../../middleware/logger.js";
import { getTieredCache } from "./tieredCache.js";

export interface AccessPattern {
  key: string;
  namespace: string;
  frequency: number;
  lastAccess: number;
  avgAccessInterval: number;
  nextPredictedAccess: number;
}

export interface WarmingStrategy {
  enabled: boolean;
  minFrequency: number; // Minimum access frequency to consider
  maxAge: number; // Maximum age of pattern in ms
  warmingInterval: number; // How often to warm cache in ms
  batchSize: number; // Max items to warm at once
}

export class CacheWarmer {
  private accessPatterns = new Map<string, AccessPattern>();
  private warmingInterval: NodeJS.Timeout | null = null;
  private strategy: WarmingStrategy;
  private warmingCallbacks = new Map<
    string,
    (key: string) => Promise<unknown>
  >();

  constructor(strategy: Partial<WarmingStrategy> = {}) {
    this.strategy = {
      enabled: strategy.enabled ?? true,
      minFrequency: strategy.minFrequency ?? 3,
      maxAge: strategy.maxAge ?? 24 * 60 * 60 * 1000, // 24 hours
      warmingInterval: strategy.warmingInterval ?? 5 * 60 * 1000, // 5 minutes
      batchSize: strategy.batchSize ?? 10,
    };

    if (this.strategy.enabled) {
      this.startWarming();
    }

    logger.info({ strategy: this.strategy }, "Cache warmer initialized");
  }

  /**
   * Record cache access for pattern analysis
   */
  public recordAccess(namespace: string, key: string): void {
    const patternKey = `${namespace}:${key}`;
    const now = Date.now();

    const existing = this.accessPatterns.get(patternKey);

    if (existing) {
      const interval = now - existing.lastAccess;
      const newAvgInterval =
        (existing.avgAccessInterval * existing.frequency + interval) /
        (existing.frequency + 1);

      this.accessPatterns.set(patternKey, {
        ...existing,
        frequency: existing.frequency + 1,
        lastAccess: now,
        avgAccessInterval: newAvgInterval,
        nextPredictedAccess: now + newAvgInterval,
      });
    } else {
      this.accessPatterns.set(patternKey, {
        key,
        namespace,
        frequency: 1,
        lastAccess: now,
        avgAccessInterval: 0,
        nextPredictedAccess: now,
      });
    }
  }

  /**
   * Register a callback to warm specific cache entries
   */
  public registerWarmingCallback(
    namespace: string,
    callback: (key: string) => Promise<unknown>,
  ): void {
    this.warmingCallbacks.set(namespace, callback);
  }

  /**
   * Get patterns that should be warmed
   */
  private getPatternsToWarm(): AccessPattern[] {
    const now = Date.now();
    const patterns: AccessPattern[] = [];

    for (const pattern of this.accessPatterns.values()) {
      // Filter by frequency and age
      if (pattern.frequency < this.strategy.minFrequency) {
        continue;
      }

      const age = now - pattern.lastAccess;
      if (age > this.strategy.maxAge) {
        continue;
      }

      // Check if predicted access time is near
      const timeToPredictedAccess = pattern.nextPredictedAccess - now;
      if (
        timeToPredictedAccess > 0 &&
        timeToPredictedAccess < this.strategy.warmingInterval
      ) {
        patterns.push(pattern);
      }
    }

    // Sort by predicted access time (soonest first)
    patterns.sort((a, b) => a.nextPredictedAccess - b.nextPredictedAccess);

    return patterns.slice(0, this.strategy.batchSize);
  }

  /**
   * Warm cache entries based on patterns
   */
  private async warmCache(): Promise<void> {
    const patterns = this.getPatternsToWarm();

    if (patterns.length === 0) {
      logger.debug("No patterns to warm");
      return;
    }

    logger.info({ count: patterns.length }, "Warming cache entries");

    for (const pattern of patterns) {
      try {
        const callback = this.warmingCallbacks.get(pattern.namespace);

        if (callback) {
          const cache = getTieredCache();

          // Check if already cached
          const existing = await cache.get(pattern.namespace, pattern.key);
          if (existing) {
            logger.debug(
              { namespace: pattern.namespace, key: pattern.key },
              "Already cached",
            );
            continue;
          }

          // Warm the cache
          const data = await callback(pattern.key);
          await cache.set(pattern.namespace, pattern.key, data);

          logger.debug(
            { namespace: pattern.namespace, key: pattern.key },
            "Cache warmed",
          );
        }
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            namespace: pattern.namespace,
            key: pattern.key,
          },
          "Failed to warm cache entry",
        );
      }
    }
  }

  /**
   * Start periodic cache warming
   */
  private startWarming(): void {
    this.warmingInterval = setInterval(async () => {
      try {
        await this.warmCache();
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Cache warming failed",
        );
      }
    }, this.strategy.warmingInterval);

    logger.info("Cache warming started");
  }

  /**
   * Stop cache warming
   */
  public stop(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      logger.info("Cache warming stopped");
    }
  }

  /**
   * Get warming statistics
   */
  public getStats(): {
    totalPatterns: number;
    patternsToWarm: number;
    registeredCallbacks: number;
  } {
    return {
      totalPatterns: this.accessPatterns.size,
      patternsToWarm: this.getPatternsToWarm().length,
      registeredCallbacks: this.warmingCallbacks.size,
    };
  }

  /**
   * Clean up old patterns
   */
  public cleanupOldPatterns(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, pattern] of this.accessPatterns.entries()) {
      const age = now - pattern.lastAccess;
      if (age > this.strategy.maxAge) {
        this.accessPatterns.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info({ removed }, "Cleaned up old access patterns");
    }
  }
}

// Singleton instance
let cacheWarmer: CacheWarmer | null = null;

/**
 * Get or create the global cache warmer
 */
export function getCacheWarmer(): CacheWarmer {
  if (!cacheWarmer) {
    cacheWarmer = new CacheWarmer();
  }
  return cacheWarmer;
}

/**
 * Stop the cache warmer
 */
export function stopCacheWarmer(): void {
  if (cacheWarmer) {
    cacheWarmer.stop();
    cacheWarmer = null;
  }
}

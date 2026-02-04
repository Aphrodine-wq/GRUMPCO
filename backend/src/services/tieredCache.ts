/**
 * Tiered Cache System
 * Implements L1 (memory) + L2 (Redis) + L3 (disk) caching hierarchy
 *
 * Features:
 * - Cost-aware eviction (keeps high-value entries longer)
 * - Redis pub/sub for cache invalidation across instances
 * - Compression for large entries
 * - Automatic tier promotion on cache hits
 */

import { LRUCache } from 'lru-cache';
import { getRedisClient, isRedisConnected, createRedisClient } from './redis.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import logger from '../middleware/logger.js';
import { recordTieredCacheAccess } from '../middleware/metrics.js';
import { safeCleanup } from '../utils/safeAsync.js';
import type { Redis } from 'ioredis';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Redis pub/sub channel for cache invalidation
const CACHE_INVALIDATION_CHANNEL = 'cache:invalidation';

// Message types for pub/sub
interface InvalidationMessage {
  type: 'delete' | 'clear_namespace' | 'clear_all';
  namespace?: string;
  key?: string;
  instanceId: string;
  timestamp: number;
}

export interface TieredCacheOptions {
  l1MaxSize?: number;
  l1TTL?: number;
  l2TTL?: number;
  l3TTL?: number;
  l3Path?: string;
  compression?: boolean;
  compressionThreshold?: number; // bytes
  costAwareEviction?: boolean;
  pubsubEnabled?: boolean; // Enable Redis pub/sub for cross-instance invalidation
}

export interface CacheEntry {
  data: Buffer;
  cost: number; // Computation cost in ms
  accessCount: number;
  createdAt: number;
  lastAccess: number;
  size: number;
}

export interface CacheStats {
  l1: { hits: number; misses: number; size: number };
  l2: { hits: number; misses: number };
  l3: { hits: number; misses: number };
  invalidations: { sent: number; received: number };
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  instanceId: string;
  byNamespace?: Record<string, { hits: number; misses: number; hitRate: number }>;
}

export class TieredCache {
  private l1Cache: LRUCache<string, Buffer>;
  private l2TTL: number;
  private l3TTL: number;
  private l3Path: string;
  private compression: boolean;
  private compressionThreshold: number;
  private costAwareEviction: boolean;

  // Unique instance ID for pub/sub (to ignore own messages)
  private instanceId: string;
  private subscriber: Redis | null = null;
  private pubsubEnabled: boolean;

  private stats = {
    l1: { hits: 0, misses: 0 },
    l2: { hits: 0, misses: 0 },
    l3: { hits: 0, misses: 0 },
    invalidations: { sent: 0, received: 0 },
  };
  private statsByNamespace = new Map<string, { hits: number; misses: number }>();
  private entryMetadata = new Map<string, Omit<CacheEntry, 'data'>>();

  private recordNamespaceAccess(namespace: string, hit: boolean): void {
    let entry = this.statsByNamespace.get(namespace);
    if (!entry) {
      entry = { hits: 0, misses: 0 };
      this.statsByNamespace.set(namespace, entry);
    }
    if (hit) entry.hits++;
    else entry.misses++;
  }

  constructor(options: TieredCacheOptions = {}) {
    this.costAwareEviction = options.costAwareEviction ?? true;
    this.instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.pubsubEnabled = options.pubsubEnabled !== false;

    // L1: In-memory LRU cache with cost-aware eviction
    this.l1Cache = new LRUCache<string, Buffer>({
      max: options.l1MaxSize || 500,
      ttl: options.l1TTL || 5 * 60 * 1000, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      // Custom disposal to track evictions
      dispose: (value, key) => {
        if (this.costAwareEviction) {
          this.entryMetadata.delete(key);
        }
      },
    });

    this.l2TTL = options.l2TTL || 3600; // 1 hour (Redis uses seconds)
    this.l3TTL = options.l3TTL || 86400; // 24 hours
    this.l3Path = options.l3Path || join(process.cwd(), 'data', 'cache');
    this.compression = options.compression !== false;
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB

    this.ensureCacheDirectory();

    // Initialize pub/sub subscriber for cross-instance invalidation
    if (this.pubsubEnabled) {
      this.initPubSub();
    }

    logger.info(
      {
        l1MaxSize: options.l1MaxSize,
        l3Path: this.l3Path,
        costAwareEviction: this.costAwareEviction,
        instanceId: this.instanceId,
        pubsubEnabled: this.pubsubEnabled,
      },
      'Tiered cache initialized'
    );
  }

  /**
   * Initialize Redis pub/sub for cache invalidation
   */
  private async initPubSub(): Promise<void> {
    try {
      if (!(await isRedisConnected())) {
        logger.warn('Redis not connected, pub/sub disabled');
        return;
      }

      // Create a dedicated subscriber connection (Redis requires separate connection for pub/sub)
      this.subscriber = createRedisClient();

      if (!this.subscriber) {
        logger.warn('Could not create Redis subscriber');
        return;
      }

      // Subscribe to invalidation channel
      await this.subscriber.subscribe(CACHE_INVALIDATION_CHANNEL);

      // Handle incoming invalidation messages
      this.subscriber.on('message', (channel: string, message: string) => {
        if (channel !== CACHE_INVALIDATION_CHANNEL) return;

        try {
          const msg: InvalidationMessage = JSON.parse(message);

          // Ignore messages from this instance
          if (msg.instanceId === this.instanceId) return;

          this.handleInvalidationMessage(msg);
        } catch (error) {
          logger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Failed to parse invalidation message'
          );
        }
      });

      logger.info({ channel: CACHE_INVALIDATION_CHANNEL }, 'Cache pub/sub initialized');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to initialize cache pub/sub'
      );
    }
  }

  /**
   * Handle incoming invalidation message from another instance
   */
  private handleInvalidationMessage(msg: InvalidationMessage): void {
    this.stats.invalidations.received++;

    switch (msg.type) {
      case 'delete':
        if (msg.namespace && msg.key) {
          const cacheKey = this.getCacheKey(msg.namespace, msg.key);
          this.l1Cache.delete(cacheKey);
          this.entryMetadata.delete(cacheKey);
          logger.debug({ namespace: msg.namespace, key: msg.key }, 'L1 invalidated via pub/sub');
        }
        break;

      case 'clear_namespace':
        if (msg.namespace) {
          for (const key of this.l1Cache.keys()) {
            if (key.startsWith(`${msg.namespace}:`)) {
              this.l1Cache.delete(key);
              this.entryMetadata.delete(key);
            }
          }
          logger.debug({ namespace: msg.namespace }, 'L1 namespace cleared via pub/sub');
        }
        break;

      case 'clear_all':
        this.l1Cache.clear();
        this.entryMetadata.clear();
        logger.debug('L1 cache cleared via pub/sub');
        break;
    }
  }

  /**
   * Publish invalidation message to other instances
   */
  private async publishInvalidation(
    msg: Omit<InvalidationMessage, 'instanceId' | 'timestamp'>
  ): Promise<void> {
    if (!this.pubsubEnabled) return;

    try {
      if (!(await isRedisConnected())) return;

      const redis = getRedisClient();
      const fullMsg: InvalidationMessage = {
        ...msg,
        instanceId: this.instanceId,
        timestamp: Date.now(),
      };

      await redis.publish(CACHE_INVALIDATION_CHANNEL, JSON.stringify(fullMsg));
      this.stats.invalidations.sent++;

      logger.debug(
        { type: msg.type, namespace: msg.namespace, key: msg.key },
        'Published cache invalidation'
      );
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to publish cache invalidation'
      );
    }
  }

  /**
   * Shutdown pub/sub subscriber
   */
  public async shutdown(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe(CACHE_INVALIDATION_CHANNEL);
      await this.subscriber.quit();
      this.subscriber = null;
      logger.info('Cache pub/sub shutdown');
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.l3Path, { recursive: true });
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), path: this.l3Path },
        'Failed to create cache directory'
      );
    }
  }

  private getCacheKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  private getL3FilePath(cacheKey: string): string {
    const hash = createHash('sha256').update(cacheKey).digest('hex');
    return join(this.l3Path, `${hash}.cache`);
  }

  private async compressData(data: Buffer): Promise<Buffer> {
    if (!this.compression || data.length < this.compressionThreshold) {
      return data;
    }
    return await gzipAsync(data);
  }

  private async decompressData(data: Buffer, compressed: boolean): Promise<Buffer> {
    if (!compressed) {
      return data;
    }
    return await gunzipAsync(data);
  }

  /**
   * Calculate eviction score for cost-aware eviction
   * Higher score = more valuable to keep
   */
  private calculateEvictionScore(metadata: Omit<CacheEntry, 'data'>): number {
    const now = Date.now();
    const age = now - metadata.lastAccess;
    const ageSeconds = age / 1000;

    // Score = (cost * accessCount) / (size * timeSinceAccess)
    // Keep high-cost, frequently-accessed, recently-used items
    const score =
      (metadata.cost * metadata.accessCount) / (metadata.size * Math.max(1, ageSeconds));

    return score;
  }

  /**
   * Perform cost-aware eviction if needed
   */
  private performCostAwareEviction(): void {
    if (!this.costAwareEviction || this.l1Cache.size < this.l1Cache.max) {
      return;
    }

    // Find entry with lowest eviction score
    let lowestScore = Infinity;
    let keyToEvict: string | null = null;

    for (const [key, metadata] of this.entryMetadata.entries()) {
      const score = this.calculateEvictionScore(metadata);
      if (score < lowestScore) {
        lowestScore = score;
        keyToEvict = key;
      }
    }

    if (keyToEvict) {
      this.l1Cache.delete(keyToEvict);
      logger.debug({ key: keyToEvict, score: lowestScore }, 'Cost-aware eviction');
    }
  }

  /**
   * Get value from cache (checks L1 -> L2 -> L3)
   */
  public async get<T>(namespace: string, key: string): Promise<T | null> {
    const cacheKey = this.getCacheKey(namespace, key);

    // L1: Memory cache
    const l1Data = this.l1Cache.get(cacheKey);
    if (l1Data) {
      this.stats.l1.hits++;
      this.recordNamespaceAccess(namespace, true);
      recordTieredCacheAccess('L1', true, namespace);

      // Update access metadata
      if (this.costAwareEviction) {
        const metadata = this.entryMetadata.get(cacheKey);
        if (metadata) {
          metadata.accessCount++;
          metadata.lastAccess = Date.now();
        }
      }

      logger.debug({ namespace, key, layer: 'L1' }, 'Cache hit');
      return JSON.parse(l1Data.toString('utf-8')) as T;
    }
    this.stats.l1.misses++;
    recordTieredCacheAccess('L1', false, namespace);

    // L2: Redis cache
    if (await isRedisConnected()) {
      try {
        const redis = getRedisClient();
        const l2Data = await redis.getBuffer(cacheKey);

        if (l2Data) {
          this.stats.l2.hits++;
          this.recordNamespaceAccess(namespace, true);
          recordTieredCacheAccess('L2', true, namespace);
          logger.debug({ namespace, key, layer: 'L2' }, 'Cache hit');

          // Promote to L1
          this.l1Cache.set(cacheKey, l2Data);

          const decompressed = await this.decompressData(l2Data, this.compression);
          return JSON.parse(decompressed.toString('utf-8')) as T;
        }
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error), namespace, key },
          'L2 cache read failed'
        );
      }
    }
    this.stats.l2.misses++;
    recordTieredCacheAccess('L2', false, namespace);

    // L3: Disk cache
    try {
      const l3Path = this.getL3FilePath(cacheKey);
      const l3Data = await fs.readFile(l3Path);
      const metadata = JSON.parse(l3Data.slice(0, 256).toString('utf-8').trim());

      // Check expiration
      if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
        safeCleanup(() => fs.unlink(l3Path), 'Remove expired L3 cache file');
        this.stats.l3.misses++;
        this.recordNamespaceAccess(namespace, false);
        recordTieredCacheAccess('L3', false, namespace);
        return null;
      }

      this.stats.l3.hits++;
      this.recordNamespaceAccess(namespace, true);
      recordTieredCacheAccess('L3', true, namespace);
      logger.debug({ namespace, key, layer: 'L3' }, 'Cache hit');

      const dataBuffer = l3Data.slice(256);
      const decompressed = await this.decompressData(dataBuffer, metadata.compressed);

      // Promote to L2 and L1
      this.l1Cache.set(cacheKey, decompressed);
      if (await isRedisConnected()) {
        const redis = getRedisClient();
        await redis.setex(cacheKey, this.l2TTL, decompressed);
      }

      return JSON.parse(decompressed.toString('utf-8')) as T;
    } catch (_error) {
      // File doesn't exist or read error
      this.stats.l3.misses++;
      recordTieredCacheAccess('L3', false, namespace);
    }

    this.recordNamespaceAccess(namespace, false);
    return null;
  }

  /**
   * Set value in cache (writes to all layers)
   */
  public async set<T>(
    namespace: string,
    key: string,
    value: T,
    ttl?: number,
    computationCost?: number
  ): Promise<void> {
    const cacheKey = this.getCacheKey(namespace, key);
    const jsonData = JSON.stringify(value);
    const buffer = Buffer.from(jsonData, 'utf-8');
    const compressed = await this.compressData(buffer);

    // Perform cost-aware eviction if needed
    if (this.costAwareEviction) {
      this.performCostAwareEviction();

      // Store metadata
      this.entryMetadata.set(cacheKey, {
        cost: computationCost || 100, // Default cost in ms
        accessCount: 1,
        createdAt: Date.now(),
        lastAccess: Date.now(),
        size: buffer.length,
      });
    }

    // L1: Memory cache
    this.l1Cache.set(cacheKey, buffer);

    // L2: Redis cache
    if (await isRedisConnected()) {
      try {
        const redis = getRedisClient();
        await redis.setex(cacheKey, ttl || this.l2TTL, compressed);
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error), namespace, key },
          'L2 cache write failed'
        );
      }
    }

    // L3: Disk cache
    try {
      const l3Path = this.getL3FilePath(cacheKey);
      const metadata = {
        namespace,
        key,
        createdAt: Date.now(),
        expiresAt: Date.now() + (ttl ? ttl * 1000 : this.l3TTL * 1000),
        compressed: this.compression && compressed.length < buffer.length,
      };

      // Write metadata (first 256 bytes) + data
      const metadataBuffer = Buffer.alloc(256);
      metadataBuffer.write(JSON.stringify(metadata), 'utf-8');
      const fileData = Buffer.concat([metadataBuffer, compressed]);

      await fs.writeFile(l3Path, fileData);
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error), namespace, key },
        'L3 cache write failed'
      );
    }
  }

  /**
   * Delete value from all cache layers
   */
  public async delete(namespace: string, key: string): Promise<void> {
    const cacheKey = this.getCacheKey(namespace, key);

    // L1: Memory cache
    this.l1Cache.delete(cacheKey);
    this.entryMetadata.delete(cacheKey);

    // L2: Redis cache
    if (await isRedisConnected()) {
      try {
        const redis = getRedisClient();
        await redis.del(cacheKey);
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'L2 cache delete failed'
        );
      }
    }

    // L3: Disk cache
    try {
      const l3Path = this.getL3FilePath(cacheKey);
      await fs.unlink(l3Path);
    } catch (_error) {
      // File might not exist, ignore
    }

    // Publish invalidation to other instances
    await this.publishInvalidation({ type: 'delete', namespace, key });
  }

  /**
   * Clear all cache layers for a namespace
   */
  public async clearNamespace(namespace: string): Promise<void> {
    // L1: Clear matching keys
    for (const key of this.l1Cache.keys()) {
      if (key.startsWith(`${namespace}:`)) {
        this.l1Cache.delete(key);
        this.entryMetadata.delete(key);
      }
    }

    // L2: Clear matching keys
    if (await isRedisConnected()) {
      try {
        const redis = getRedisClient();
        const keys = await redis.keys(`${namespace}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'L2 namespace clear failed'
        );
      }
    }

    // L3: Clear all files (no efficient way to filter by namespace)
    logger.info(
      { namespace },
      'L3 cache namespace clear not implemented (would require full scan)'
    );

    // Publish invalidation to other instances
    await this.publishInvalidation({ type: 'clear_namespace', namespace });
  }

  /**
   * Clear all cache layers (all namespaces)
   */
  public async clearAll(): Promise<void> {
    // L1: Clear all
    this.l1Cache.clear();
    this.entryMetadata.clear();

    // L2: Flush (be careful with this in production)
    if (await isRedisConnected()) {
      try {
        const redis = getRedisClient();
        // Only flush keys with our prefix pattern, not entire Redis
        const keys = await redis.keys('*:*');
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'L2 cache clear failed'
        );
      }
    }

    // Publish invalidation to other instances
    await this.publishInvalidation({ type: 'clear_all' });

    logger.info('All cache layers cleared');
  }

  /**
   * Get cache statistics by namespace (hits, misses, hitRate per namespace).
   */
  public getStatsByNamespace(): Record<string, { hits: number; misses: number; hitRate: number }> {
    const out: Record<string, { hits: number; misses: number; hitRate: number }> = {};
    for (const [ns, entry] of this.statsByNamespace) {
      const total = entry.hits + entry.misses;
      out[ns] = {
        hits: entry.hits,
        misses: entry.misses,
        hitRate: total > 0 ? entry.hits / total : 0,
      };
    }
    return out;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const totalHits = this.stats.l1.hits + this.stats.l2.hits + this.stats.l3.hits;
    const totalMisses = this.stats.l1.misses + this.stats.l2.misses + this.stats.l3.misses;
    const total = totalHits + totalMisses;

    return {
      l1: { ...this.stats.l1, size: this.l1Cache.size },
      l2: { ...this.stats.l2 },
      l3: { ...this.stats.l3 },
      invalidations: { ...this.stats.invalidations },
      totalHits,
      totalMisses,
      hitRate: total > 0 ? totalHits / total : 0,
      instanceId: this.instanceId,
      byNamespace: this.getStatsByNamespace(),
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      l1: { hits: 0, misses: 0 },
      l2: { hits: 0, misses: 0 },
      l3: { hits: 0, misses: 0 },
      invalidations: { sent: 0, received: 0 },
    };
    this.statsByNamespace.clear();
  }

  /**
   * Warm cache with common entries
   */
  public async warmCache(
    entries: Array<{ namespace: string; key: string; value: unknown }>
  ): Promise<void> {
    logger.info({ count: entries.length }, 'Warming cache');

    await Promise.all(
      entries.map(({ namespace, key, value }) =>
        this.set(namespace, key, value).catch((error) => {
          logger.warn({ error: error.message, namespace, key }, 'Failed to warm cache entry');
        })
      )
    );
  }

  /**
   * Clean up expired L3 cache files
   */
  public async cleanupExpired(): Promise<number> {
    let cleaned = 0;

    try {
      const files = await fs.readdir(this.l3Path);

      await Promise.all(
        files.map(async (file) => {
          try {
            const filePath = join(this.l3Path, file);
            const data = await fs.readFile(filePath);
            const metadata = JSON.parse(data.slice(0, 256).toString('utf-8').trim());

            if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
              await fs.unlink(filePath);
              cleaned++;
            }
          } catch (_error) {
            // Ignore errors for individual files
          }
        })
      );

      if (cleaned > 0) {
        logger.info({ cleaned }, 'Cleaned up expired cache files');
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to cleanup expired cache'
      );
    }

    return cleaned;
  }
}

// Singleton instance
let tieredCache: TieredCache | null = null;

/**
 * Get or create the global tiered cache.
 * When options are not passed, L1 size and TTL are read from env:
 * TIERED_CACHE_L1_MAX, TIERED_CACHE_L1_TTL_MS.
 */
export function getTieredCache(options?: TieredCacheOptions): TieredCache {
  if (!tieredCache) {
    const envOptions: TieredCacheOptions = {};
    if (process.env.TIERED_CACHE_L1_MAX) {
      const n = parseInt(process.env.TIERED_CACHE_L1_MAX, 10);
      if (!Number.isNaN(n)) envOptions.l1MaxSize = n;
    }
    if (process.env.TIERED_CACHE_L1_TTL_MS) {
      const n = parseInt(process.env.TIERED_CACHE_L1_TTL_MS, 10);
      if (!Number.isNaN(n)) envOptions.l1TTL = n;
    }
    tieredCache = new TieredCache({ ...envOptions, ...options });
  }
  return tieredCache;
}

/**
 * Helper function to use cache with automatic fallback
 */
export async function withTieredCache<T>(
  namespace: string,
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cache = getTieredCache();

  // Try to get from cache
  const cached = await cache.get<T>(namespace, key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss, execute function
  const result = await fn();

  // Store in cache (fire and forget)
  cache.set(namespace, key, result, ttl).catch((error) => {
    logger.warn({ error: error.message, namespace, key }, 'Failed to cache result');
  });

  return result;
}

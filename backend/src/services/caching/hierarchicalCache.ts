/**
 * Hierarchical Cache Service for G-Agent Semantic Compiler
 *
 * Implements a 3-tier caching architecture:
 * - L1: In-memory hot cache (current request, ultra-fast)
 * - L2: Session cache (LRU, configurable size, warm)
 * - L3: Persistent cache (cross-session, file/SQLite-based, cold)
 *
 * Features:
 * - Automatic tier promotion/demotion based on access patterns
 * - Smart eviction based on recency, frequency, and importance
 * - Background persistence for session recovery
 * - Metrics and hit rate tracking per tier
 * - TTL support with lazy expiration
 * - Namespace isolation for different cache types
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  namespace: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  size: number;
  ttl?: number; // Time-to-live in ms (undefined = no expiry)
  importance: number; // 0-1, higher = less likely to evict
  metadata?: Record<string, unknown>;
}

export interface CacheTierConfig {
  maxSize: number; // Max entries
  maxMemoryMb: number; // Max memory usage
  defaultTtl?: number; // Default TTL for entries
  evictionBatchSize: number; // How many to evict when full
}

export interface HierarchicalCacheConfig {
  l1: CacheTierConfig;
  l2: CacheTierConfig;
  l3: {
    enabled: boolean;
    persistPath: string;
    maxSizeMb: number;
    syncIntervalMs: number;
  };
  promotionThreshold: number; // Access count to promote L2 → L1
  demotionIntervalMs: number; // How often to check for demotion
}

export interface CacheMetrics {
  l1: TierMetrics;
  l2: TierMetrics;
  l3: TierMetrics;
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
  promotions: number;
  demotions: number;
  evictions: number;
  persistedEntries: number;
}

export interface TierMetrics {
  entries: number;
  memoryUsageMb: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgAccessCount: number;
  oldestEntryAge: number;
}

interface SerializedEntry {
  key: string;
  value: string; // JSON stringified
  namespace: string;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  size: number;
  ttl?: number;
  importance: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// LRU CACHE TIER
// ============================================================================

class LRUCacheTier<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private memoryUsage: number = 0;
  private hits: number = 0;
  private misses: number = 0;

  constructor(private config: CacheTierConfig) {}

  get(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      // Check TTL
      if (this.isExpired(entry)) {
        this.delete(key);
        this.misses++;
        return undefined;
      }

      // Update access stats
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;

      // Move to end of access order (most recently used)
      this.promoteAccessOrder(key);

      this.hits++;
      return entry;
    }

    this.misses++;
    return undefined;
  }

  set(key: string, entry: CacheEntry<T>): boolean {
    // Check if we need to evict
    while (this.shouldEvict(entry)) {
      if (!this.evictOne()) {
        return false; // Can't make room
      }
    }

    const existing = this.cache.get(key);
    if (existing) {
      this.memoryUsage -= existing.size;
      this.removeFromAccessOrder(key);
    }

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.memoryUsage += entry.size;

    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.memoryUsage -= entry.size;
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return true;
    }
    return false;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry && this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    return entry !== undefined;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.memoryUsage = 0;
  }

  getAll(): CacheEntry<T>[] {
    return Array.from(this.cache.values()).filter((e) => !this.isExpired(e));
  }

  getByNamespace(namespace: string): CacheEntry<T>[] {
    return this.getAll().filter((e) => e.namespace === namespace);
  }

  getMetrics(): TierMetrics {
    const entries = this.getAll();
    const now = Date.now();

    return {
      entries: entries.length,
      memoryUsageMb: this.memoryUsage / (1024 * 1024),
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      avgAccessCount:
        entries.length > 0
          ? entries.reduce((sum, e) => sum + e.accessCount, 0) / entries.length
          : 0,
      oldestEntryAge: entries.length > 0 ? now - Math.min(...entries.map((e) => e.createdAt)) : 0,
    };
  }

  /**
   * Get entries sorted by eviction priority (lowest = evict first)
   */
  getEvictionCandidates(count: number): CacheEntry<T>[] {
    return this.getAll()
      .sort((a, b) => this.calculateEvictionScore(a) - this.calculateEvictionScore(b))
      .slice(0, count);
  }

  /**
   * Get entries ready for promotion (high access count)
   */
  getPromotionCandidates(accessThreshold: number): CacheEntry<T>[] {
    return this.getAll()
      .filter((e) => e.accessCount >= accessThreshold)
      .sort((a, b) => b.accessCount - a.accessCount);
  }

  /**
   * Get entries ready for demotion (old, low access)
   */
  getDemotionCandidates(ageThresholdMs: number): CacheEntry<T>[] {
    const now = Date.now();
    return this.getAll()
      .filter((e) => now - e.lastAccessedAt > ageThresholdMs)
      .sort((a, b) => this.calculateEvictionScore(a) - this.calculateEvictionScore(b));
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.ttl) return false;
    return Date.now() > entry.createdAt + entry.ttl;
  }

  private shouldEvict(newEntry: CacheEntry<T>): boolean {
    if (this.cache.size >= this.config.maxSize) return true;
    if (this.memoryUsage + newEntry.size > this.config.maxMemoryMb * 1024 * 1024) return true;
    return false;
  }

  private evictOne(): boolean {
    if (this.accessOrder.length === 0) return false;

    // Find best eviction candidate (consider importance)
    const candidates = this.getEvictionCandidates(this.config.evictionBatchSize);
    if (candidates.length === 0) return false;

    const victim = candidates[0];
    return this.delete(victim.key);
  }

  private calculateEvictionScore(entry: CacheEntry<T>): number {
    const now = Date.now();
    const age = now - entry.lastAccessedAt;
    const recencyScore = 1 / (1 + age / 60000); // Decay over minutes
    const frequencyScore = Math.log(1 + entry.accessCount);
    const importanceScore = entry.importance;

    // Higher score = less likely to evict
    return recencyScore * 0.4 + frequencyScore * 0.3 + importanceScore * 0.3;
  }

  private promoteAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

// ============================================================================
// PERSISTENT TIER
// ============================================================================

class PersistentCacheTier {
  private index: Map<string, { offset: number; size: number }> = new Map();
  private dirty: Set<string> = new Set();
  private pendingWrites: Map<string, CacheEntry> = new Map();
  private syncTimer: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  private hits: number = 0;
  private misses: number = 0;

  constructor(
    private config: HierarchicalCacheConfig['l3'],
    private onError: (error: Error) => void
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.config.enabled) return;

    try {
      await fs.mkdir(this.config.persistPath, { recursive: true });
      await this.loadIndex();
      this.startSyncTimer();
      this.initialized = true;
    } catch (error) {
      this.onError(error as Error);
    }
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    if (!this.config.enabled) return undefined;

    // Check pending writes first
    if (this.pendingWrites.has(key)) {
      this.hits++;
      const entry = this.pendingWrites.get(key)!;
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      return entry;
    }

    try {
      const filePath = this.getFilePath(key);
      const data = await fs.readFile(filePath, 'utf-8');
      const serialized: SerializedEntry = JSON.parse(data);

      // Check TTL
      if (serialized.ttl && Date.now() > serialized.createdAt + serialized.ttl) {
        await this.delete(key);
        this.misses++;
        return undefined;
      }

      const entry: CacheEntry = {
        ...serialized,
        value: JSON.parse(serialized.value),
        lastAccessedAt: Date.now(),
        accessCount: serialized.accessCount + 1,
      };

      // Mark for update
      this.pendingWrites.set(key, entry);
      this.dirty.add(key);

      this.hits++;
      return entry;
    } catch {
      this.misses++;
      return undefined;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    if (!this.config.enabled) return;

    this.pendingWrites.set(key, entry);
    this.dirty.add(key);
  }

  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      this.pendingWrites.delete(key);
      this.dirty.delete(key);
      this.index.delete(key);

      const filePath = this.getFilePath(key);
      await fs.unlink(filePath).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    if (this.pendingWrites.has(key)) return true;

    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      this.pendingWrites.clear();
      this.dirty.clear();
      this.index.clear();

      const files = await fs.readdir(this.config.persistPath);
      await Promise.all(
        files.map((f) => fs.unlink(path.join(this.config.persistPath, f)).catch(() => {}))
      );
    } catch {
      // Ignore errors
    }
  }

  async flush(): Promise<void> {
    if (!this.config.enabled) return;
    if (this.dirty.size === 0) return;

    const toWrite = Array.from(this.dirty);
    this.dirty.clear();

    await Promise.all(
      toWrite.map(async (key) => {
        const entry = this.pendingWrites.get(key);
        if (!entry) return;

        try {
          const serialized: SerializedEntry = {
            ...entry,
            value: JSON.stringify(entry.value),
          };
          const data = JSON.stringify(serialized);
          const filePath = this.getFilePath(key);
          await fs.writeFile(filePath, data, 'utf-8');

          this.index.set(key, { offset: 0, size: data.length });
          this.pendingWrites.delete(key);
        } catch (error) {
          this.onError(error as Error);
          this.dirty.add(key); // Re-add for retry
        }
      })
    );
  }

  async getAll(): Promise<CacheEntry[]> {
    if (!this.config.enabled) return [];

    const entries: CacheEntry[] = [];

    // Add pending writes
    entries.push(...this.pendingWrites.values());

    // Load from disk
    try {
      const files = await fs.readdir(this.config.persistPath);
      await Promise.all(
        files
          .filter((f) => f.endsWith('.cache'))
          .map(async (f) => {
            const key = f.replace('.cache', '');
            if (this.pendingWrites.has(key)) return;

            try {
              const data = await fs.readFile(path.join(this.config.persistPath, f), 'utf-8');
              const serialized: SerializedEntry = JSON.parse(data);

              // Skip expired
              if (serialized.ttl && Date.now() > serialized.createdAt + serialized.ttl) {
                return;
              }

              entries.push({
                ...serialized,
                value: JSON.parse(serialized.value),
              });
            } catch {
              // Skip corrupted entries
            }
          })
      );
    } catch {
      // Ignore errors
    }

    return entries;
  }

  getMetrics(): TierMetrics {
    return {
      entries: this.index.size + this.pendingWrites.size,
      memoryUsageMb: 0, // Disk-based
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      avgAccessCount: 0, // Would need to scan all files
      oldestEntryAge: 0, // Would need to scan all files
    };
  }

  async shutdown(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    await this.flush();
  }

  private getFilePath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 16);
    return path.join(this.config.persistPath, `${hash}.cache`);
  }

  private async loadIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.persistPath);
      for (const file of files) {
        if (file.endsWith('.cache')) {
          const stats = await fs.stat(path.join(this.config.persistPath, file));
          this.index.set(file.replace('.cache', ''), {
            offset: 0,
            size: stats.size,
          });
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
  }

  private startSyncTimer(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.flush().catch(this.onError);
    }, this.config.syncIntervalMs);
  }
}

// ============================================================================
// HIERARCHICAL CACHE SERVICE
// ============================================================================

const DEFAULT_CONFIG: HierarchicalCacheConfig = {
  l1: {
    maxSize: 100,
    maxMemoryMb: 50,
    defaultTtl: 5 * 60 * 1000, // 5 minutes
    evictionBatchSize: 10,
  },
  l2: {
    maxSize: 1000,
    maxMemoryMb: 200,
    defaultTtl: 30 * 60 * 1000, // 30 minutes
    evictionBatchSize: 50,
  },
  l3: {
    enabled: true,
    persistPath: './cache',
    maxSizeMb: 500,
    syncIntervalMs: 30000, // 30 seconds
  },
  promotionThreshold: 3, // Promote after 3 accesses
  demotionIntervalMs: 60000, // Check every minute
};

export class HierarchicalCacheService {
  private l1: LRUCacheTier;
  private l2: LRUCacheTier;
  private l3: PersistentCacheTier;
  private config: HierarchicalCacheConfig;
  private demotionTimer: NodeJS.Timeout | null = null;
  private promotions: number = 0;
  private demotions: number = 0;
  private evictions: number = 0;
  private initialized: boolean = false;

  constructor(config: Partial<HierarchicalCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.l1 = new LRUCacheTier(this.config.l1);
    this.l2 = new LRUCacheTier(this.config.l2);
    this.l3 = new PersistentCacheTier(this.config.l3, this.handleError.bind(this));
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.l3.initialize();
    this.startDemotionTimer();
    this.initialized = true;
  }

  // ==========================================================================
  // CORE CACHE OPERATIONS
  // ==========================================================================

  /**
   * Get a value from the cache, checking all tiers
   */
  async get<T = unknown>(key: string, namespace: string = 'default'): Promise<T | undefined> {
    const fullKey = this.makeKey(key, namespace);

    // Try L1 first (hot cache)
    let entry = this.l1.get(fullKey) as CacheEntry<T> | undefined;
    if (entry) {
      return entry.value;
    }

    // Try L2 (warm cache)
    entry = this.l2.get(fullKey) as CacheEntry<T> | undefined;
    if (entry) {
      // Check for promotion
      if (entry.accessCount >= this.config.promotionThreshold) {
        this.promote(entry);
      }
      return entry.value;
    }

    // Try L3 (cold cache)
    if (this.config.l3.enabled) {
      const persistedEntry = await this.l3.get(fullKey);
      if (persistedEntry) {
        // Promote to L2
        this.l2.set(fullKey, persistedEntry as CacheEntry);
        return persistedEntry.value as T;
      }
    }

    return undefined;
  }

  /**
   * Set a value in the cache
   */
  async set<T = unknown>(
    key: string,
    value: T,
    options: {
      namespace?: string;
      ttl?: number;
      importance?: number;
      tier?: 'l1' | 'l2' | 'l3';
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    const namespace = options.namespace || 'default';
    const fullKey = this.makeKey(key, namespace);

    const entry: CacheEntry<T> = {
      key: fullKey,
      value,
      namespace,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      size: this.estimateSize(value),
      ttl: options.ttl ?? this.config.l2.defaultTtl,
      importance: options.importance ?? 0.5,
      metadata: options.metadata,
    };

    const tier = options.tier || 'l2';

    switch (tier) {
      case 'l1':
        if (!this.l1.set(fullKey, entry)) {
          // Overflow to L2
          this.l2.set(fullKey, entry);
        }
        break;
      case 'l2':
        this.l2.set(fullKey, entry);
        break;
      case 'l3':
        await this.l3.set(fullKey, entry as CacheEntry);
        break;
    }
  }

  /**
   * Delete from all tiers
   */
  async delete(key: string, namespace: string = 'default'): Promise<boolean> {
    const fullKey = this.makeKey(key, namespace);

    const l1Deleted = this.l1.delete(fullKey);
    const l2Deleted = this.l2.delete(fullKey);
    const l3Deleted = await this.l3.delete(fullKey);

    return l1Deleted || l2Deleted || l3Deleted;
  }

  /**
   * Check if key exists in any tier
   */
  async has(key: string, namespace: string = 'default'): Promise<boolean> {
    const fullKey = this.makeKey(key, namespace);

    if (this.l1.has(fullKey)) return true;
    if (this.l2.has(fullKey)) return true;
    if (await this.l3.has(fullKey)) return true;

    return false;
  }

  /**
   * Clear all caches
   */
  async clear(options: { l1?: boolean; l2?: boolean; l3?: boolean } = {}): Promise<void> {
    const clearAll = !options.l1 && !options.l2 && !options.l3;

    if (clearAll || options.l1) this.l1.clear();
    if (clearAll || options.l2) this.l2.clear();
    if (clearAll || options.l3) await this.l3.clear();
  }

  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================

  /**
   * Get multiple values
   */
  async getMany<T = unknown>(
    keys: string[],
    namespace: string = 'default'
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key, namespace);
        if (value !== undefined) {
          results.set(key, value);
        }
      })
    );

    return results;
  }

  /**
   * Set multiple values
   */
  async setMany<T = unknown>(
    entries: Array<{ key: string; value: T; importance?: number }>,
    options: {
      namespace?: string;
      ttl?: number;
      tier?: 'l1' | 'l2' | 'l3';
    } = {}
  ): Promise<void> {
    await Promise.all(
      entries.map((e) =>
        this.set(e.key, e.value, {
          ...options,
          importance: e.importance,
        })
      )
    );
  }

  // ==========================================================================
  // NAMESPACE OPERATIONS
  // ==========================================================================

  /**
   * Get all entries in a namespace
   */
  async getByNamespace(namespace: string): Promise<CacheEntry[]> {
    const entries: CacheEntry[] = [];

    entries.push(...this.l1.getByNamespace(namespace));
    entries.push(...this.l2.getByNamespace(namespace));

    const l3Entries = await this.l3.getAll();
    entries.push(...l3Entries.filter((e) => e.namespace === namespace));

    // Dedupe by key
    const seen = new Set<string>();
    return entries.filter((e) => {
      if (seen.has(e.key)) return false;
      seen.add(e.key);
      return true;
    });
  }

  /**
   * Clear all entries in a namespace
   */
  async clearNamespace(namespace: string): Promise<number> {
    let cleared = 0;

    // L1
    for (const entry of this.l1.getByNamespace(namespace)) {
      if (this.l1.delete(entry.key)) cleared++;
    }

    // L2
    for (const entry of this.l2.getByNamespace(namespace)) {
      if (this.l2.delete(entry.key)) cleared++;
    }

    // L3
    const l3Entries = await this.l3.getAll();
    for (const entry of l3Entries.filter((e) => e.namespace === namespace)) {
      if (await this.l3.delete(entry.key)) cleared++;
    }

    return cleared;
  }

  // ==========================================================================
  // TIER MANAGEMENT
  // ==========================================================================

  /**
   * Promote entry from L2 to L1
   */
  private promote(entry: CacheEntry): void {
    if (this.l1.set(entry.key, entry)) {
      this.l2.delete(entry.key);
      this.promotions++;
    }
  }

  /**
   * Demote entries from L1 to L2
   */
  private demoteFromL1(): void {
    const candidates = this.l1.getDemotionCandidates(this.config.demotionIntervalMs / 2);

    for (const entry of candidates.slice(0, 10)) {
      if (this.l2.set(entry.key, entry)) {
        this.l1.delete(entry.key);
        this.demotions++;
      }
    }
  }

  /**
   * Demote entries from L2 to L3
   */
  private async demoteFromL2(): Promise<void> {
    if (!this.config.l3.enabled) return;

    const candidates = this.l2.getDemotionCandidates(this.config.demotionIntervalMs);

    for (const entry of candidates.slice(0, 20)) {
      await this.l3.set(entry.key, entry as CacheEntry);
      this.l2.delete(entry.key);
      this.demotions++;
    }
  }

  /**
   * Run demotion cycle
   */
  private async runDemotionCycle(): Promise<void> {
    this.demoteFromL1();
    await this.demoteFromL2();
  }

  private startDemotionTimer(): void {
    if (this.demotionTimer) return;

    this.demotionTimer = setInterval(() => {
      this.runDemotionCycle().catch(this.handleError.bind(this));
    }, this.config.demotionIntervalMs);
  }

  // ==========================================================================
  // CACHE WARMING
  // ==========================================================================

  /**
   * Warm L2 cache from L3
   */
  async warmFromPersistent(
    filter?: (entry: CacheEntry) => boolean,
    limit: number = 100
  ): Promise<number> {
    if (!this.config.l3.enabled) return 0;

    const entries = await this.l3.getAll();
    let warmed = 0;

    const candidates = filter ? entries.filter(filter) : entries;

    // Sort by importance and recency
    candidates.sort((a, b) => {
      const scoreA = a.importance + 1 / (1 + (Date.now() - a.lastAccessedAt) / 60000);
      const scoreB = b.importance + 1 / (1 + (Date.now() - b.lastAccessedAt) / 60000);
      return scoreB - scoreA;
    });

    for (const entry of candidates.slice(0, limit)) {
      if (this.l2.set(entry.key, entry)) {
        warmed++;
      }
    }

    return warmed;
  }

  /**
   * Pre-populate cache with expected entries
   */
  async preload<T = unknown>(
    entries: Array<{
      key: string;
      value: T;
      namespace?: string;
      importance?: number;
    }>
  ): Promise<void> {
    await this.setMany(entries, { tier: 'l2' });
  }

  // ==========================================================================
  // METRICS
  // ==========================================================================

  getMetrics(): CacheMetrics {
    const l1Metrics = this.l1.getMetrics();
    const l2Metrics = this.l2.getMetrics();
    const l3Metrics = this.l3.getMetrics();

    const totalHits = l1Metrics.hits + l2Metrics.hits + l3Metrics.hits;
    const totalMisses = l1Metrics.misses + l2Metrics.misses + l3Metrics.misses;

    return {
      l1: l1Metrics,
      l2: l2Metrics,
      l3: l3Metrics,
      totalHits,
      totalMisses,
      overallHitRate: totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
      promotions: this.promotions,
      demotions: this.demotions,
      evictions: this.evictions,
      persistedEntries: l3Metrics.entries,
    };
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private makeKey(key: string, namespace: string): string {
    return `${namespace}:${key}`;
  }

  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2; // Rough UTF-16 estimate
    } catch {
      return 1024; // Default 1KB for non-serializable
    }
  }

  private handleError(error: Error): void {
    console.error('[HierarchicalCache] Error:', error.message);
  }

  /**
   * Shutdown and persist
   */
  async shutdown(): Promise<void> {
    if (this.demotionTimer) {
      clearInterval(this.demotionTimer);
      this.demotionTimer = null;
    }

    // Persist all L1 and L2 entries to L3
    if (this.config.l3.enabled) {
      for (const entry of this.l1.getAll()) {
        await this.l3.set(entry.key, entry as CacheEntry);
      }
      for (const entry of this.l2.getAll()) {
        await this.l3.set(entry.key, entry as CacheEntry);
      }
      await this.l3.flush();
      await this.l3.shutdown();
    }
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

const cacheInstances = new Map<string, HierarchicalCacheService>();

/**
 * Get or create a hierarchical cache service for a session
 */
export function getHierarchicalCache(
  sessionId: string = 'default',
  config?: Partial<HierarchicalCacheConfig>
): HierarchicalCacheService {
  const existing = cacheInstances.get(sessionId);
  if (existing) return existing;

  const instance = new HierarchicalCacheService({
    ...config,
    l3: {
      ...DEFAULT_CONFIG.l3,
      ...config?.l3,
      persistPath: config?.l3?.persistPath || `./cache/${sessionId}`,
    },
  });

  cacheInstances.set(sessionId, instance);
  return instance;
}

/**
 * Destroy a cache instance
 */
export async function destroyHierarchicalCache(sessionId: string): Promise<void> {
  const instance = cacheInstances.get(sessionId);
  if (instance) {
    await instance.shutdown();
    cacheInstances.delete(sessionId);
  }
}

/**
 * Destroy all cache instances
 */
export async function destroyAllHierarchicalCaches(): Promise<void> {
  await Promise.all(
    Array.from(cacheInstances.entries()).map(([id]) => destroyHierarchicalCache(id))
  );
}

export default HierarchicalCacheService;

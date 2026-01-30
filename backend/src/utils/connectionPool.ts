/**
 * Connection pooling and management
 * Optimizes database and external service connections
 */

import { LRUCache } from 'lru-cache';

interface PoolConfig {
  minConnections?: number;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  acquireTimeoutMs?: number;
}

interface PooledConnection<T> {
  connection: T;
  createdAt: number;
  lastUsed: number;
  useCount: number;
  isHealthy: boolean;
}

export class ConnectionPool<T> {
  private pool: PooledConnection<T>[] = [];
  private waiting: ((conn: T) => void)[] = [];
  private factory: () => Promise<T>;
  private validator: (conn: T) => Promise<boolean>;
  private destroyer: (conn: T) => Promise<void>;
  private config: Required<PoolConfig>;
  private activeConnections = 0;
  private maintenanceTimer?: NodeJS.Timeout;

  constructor(
    factory: () => Promise<T>,
    validator: (conn: T) => Promise<boolean>,
    destroyer: (conn: T) => Promise<void>,
    config: PoolConfig = {}
  ) {
    this.factory = factory;
    this.validator = validator;
    this.destroyer = destroyer;
    this.config = {
      minConnections: config.minConnections ?? 2,
      maxConnections: config.maxConnections ?? 10,
      idleTimeoutMs: config.idleTimeoutMs ?? 30000,
      connectionTimeoutMs: config.connectionTimeoutMs ?? 5000,
      acquireTimeoutMs: config.acquireTimeoutMs ?? 10000,
    };

    // Start maintenance loop
    this.startMaintenance();
  }

  async initialize(): Promise<void> {
    // Create minimum connections
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection());
    }
    await Promise.all(promises);
  }

  private async createConnection(): Promise<void> {
    try {
      const connection = await this.factory();
      this.pool.push({
        connection,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 0,
        isHealthy: true,
      });
    } catch (error) {
      console.error('Failed to create connection:', error);
    }
  }

  async acquire(): Promise<T> {
    // Try to get an available connection
    const available = this.pool.find(c => c.isHealthy);
    if (available) {
      available.lastUsed = Date.now();
      available.useCount++;
      this.activeConnections++;
      return available.connection;
    }

    // Create new connection if under max
    if (this.pool.length < this.config.maxConnections) {
      const connection = await this.factory();
      this.activeConnections++;
      return connection;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.indexOf(resolve as (conn: T) => void);
        if (index > -1) {
          this.waiting.splice(index, 1);
        }
        reject(new Error('Connection acquisition timeout'));
      }, this.config.acquireTimeoutMs);

      this.waiting.push((conn: T) => {
        clearTimeout(timeout);
        resolve(conn);
      });
    });
  }

  release(connection: T): void {
    const pooled = this.pool.find(c => c.connection === connection);
    if (pooled) {
      pooled.lastUsed = Date.now();
      pooled.isHealthy = true;
      this.activeConnections--;

      // Serve waiting requests
      if (this.waiting.length > 0) {
        const waiter = this.waiting.shift();
        if (waiter) {
          waiter(connection);
        }
      }
    }
  }

  async destroy(connection: T): Promise<void> {
    const index = this.pool.findIndex(c => c.connection === connection);
    if (index > -1) {
      const pooled = this.pool.splice(index, 1)[0];
      await this.destroyer(pooled.connection);
    }
    this.activeConnections--;
  }

  private startMaintenance(): void {
    this.maintenanceTimer = setInterval(async () => {
      await this.runMaintenance();
    }, 30000);
  }

  private async runMaintenance(): Promise<void> {
    const now = Date.now();
    const toRemove: PooledConnection<T>[] = [];

    for (const conn of this.pool) {
      // Remove idle connections that exceed minimum
      const isIdle = now - conn.lastUsed > this.config.idleTimeoutMs;
      const canRemove = this.pool.length > this.config.minConnections;

      if (isIdle && canRemove) {
        toRemove.push(conn);
        continue;
      }

      // Validate connections
      if (!conn.isHealthy || conn.useCount > 100) {
        try {
          conn.isHealthy = await this.validator(conn.connection);
        } catch {
          conn.isHealthy = false;
        }

        if (!conn.isHealthy) {
          toRemove.push(conn);
        }
      }
    }

    // Remove unhealthy/idle connections
    for (const conn of toRemove) {
      const index = this.pool.indexOf(conn);
      if (index > -1) {
        this.pool.splice(index, 1);
        await this.destroyer(conn.connection);
      }
    }

    // Ensure minimum connections
    while (this.pool.length < this.config.minConnections) {
      await this.createConnection();
    }
  }

  get stats(): { total: number; active: number; available: number; waiting: number } {
    return {
      total: this.pool.length,
      active: this.activeConnections,
      available: this.pool.filter(c => c.isHealthy).length,
      waiting: this.waiting.length,
    };
  }

  async shutdown(): Promise<void> {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }

    // Destroy all connections
    await Promise.all(this.pool.map(c => this.destroyer(c.connection)));
    this.pool.length = 0;
    this.activeConnections = 0;
  }
}

/**
 * Request batching utility
 * Batches multiple requests into single operations
 */
export class RequestBatcher<T, R> {
  private batch: T[] = [];
  private promises: { resolve: (value: R) => void; reject: (reason: unknown) => void }[] = [];
  private timer?: NodeJS.Timeout;
  private processor: (items: T[]) => Promise<R[]>;
  private config: { maxBatchSize: number; batchWindowMs: number };

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    config: { maxBatchSize?: number; batchWindowMs?: number } = {}
  ) {
    this.processor = processor;
    this.config = {
      maxBatchSize: config.maxBatchSize ?? 10,
      batchWindowMs: config.batchWindowMs ?? 50,
    };
  }

  async request(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push(item);
      this.promises.push({ resolve, reject });

      if (this.batch.length >= this.config.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.config.batchWindowMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.batch.length === 0) return;

    const batch = [...this.batch];
    const promises = [...this.promises];
    this.batch.length = 0;
    this.promises.length = 0;

    try {
      const results = await this.processor(batch);
      results.forEach((result, index) => {
        if (promises[index]) {
          promises[index].resolve(result);
        }
      });
    } catch (error) {
      promises.forEach(p => p.reject(error));
    }
  }

  get pendingCount(): number {
    return this.batch.length;
  }
}

/**
 * Smart caching with TTL and LRU eviction
 */
export class SmartCache<K extends string | number | symbol, V> {
  private cache: LRUCache<K, { value: V; expires: number }>;

  constructor(options: { maxSize: number; defaultTTLMs: number }) {
    this.cache = new LRUCache<K, { value: V; expires: number }>({
      max: options.maxSize,
      ttl: options.defaultTTLMs,
      updateAgeOnGet: true,
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const expires = Date.now() + (ttlMs ?? this.cache.ttl ?? 60000);
    this.cache.set(key, { value, expires });
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

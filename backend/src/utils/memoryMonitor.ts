/**
 * Memory monitoring and leak detection utilities
 * Helps identify memory leaks and optimize garbage collection
 */

import logger from "../middleware/logger.js";

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
}

interface LeakDetectionConfig {
  checkIntervalMs: number;
  growthThresholdPercent: number;
  minSamples: number;
  maxSnapshots: number;
}

export class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private config: LeakDetectionConfig;
  private checkTimer?: NodeJS.Timeout;
  private alertCallbacks: ((info: {
    growth: number;
    snapshots: MemorySnapshot[];
  }) => void)[] = [];

  constructor(config: Partial<LeakDetectionConfig> = {}) {
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? 60000, // 1 minute
      growthThresholdPercent: config.growthThresholdPercent ?? 20,
      minSamples: config.minSamples ?? 5,
      maxSnapshots: config.maxSnapshots ?? 60,
    };
  }

  start(): void {
    this.takeSnapshot(); // Initial snapshot
    this.checkTimer = setInterval(() => {
      this.takeSnapshot();
      this.analyze();
    }, this.config.checkIntervalMs);

    logger.info("Memory monitor started");
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  takeSnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers ?? 0,
      rss: usage.rss,
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  private analyze(): void {
    if (this.snapshots.length < this.config.minSamples) return;

    const recent = this.snapshots.slice(-this.config.minSamples);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const growth = ((last.heapUsed - first.heapUsed) / first.heapUsed) * 100;

    if (growth > this.config.growthThresholdPercent) {
      logger.warn(
        {
          growth: `${growth.toFixed(2)}%`,
          snapshots: recent.length,
          duration: `${((last.timestamp - first.timestamp) / 1000).toFixed(0)}s`,
        },
        "Potential memory leak detected",
      );

      // Trigger alerts
      this.alertCallbacks.forEach((cb) => cb({ growth, snapshots: recent }));
    }
  }

  onLeakDetected(
    callback: (info: { growth: number; snapshots: MemorySnapshot[] }) => void,
  ): void {
    this.alertCallbacks.push(callback);
  }

  getStats(): {
    current: MemorySnapshot;
    trend: "growing" | "stable" | "shrinking";
    growthRate: number;
  } {
    const current =
      this.snapshots[this.snapshots.length - 1] ?? this.takeSnapshot();

    let trend: "growing" | "stable" | "shrinking" = "stable";
    let growthRate = 0;

    if (this.snapshots.length >= 2) {
      const prev = this.snapshots[this.snapshots.length - 2];
      growthRate = ((current.heapUsed - prev.heapUsed) / prev.heapUsed) * 100;

      if (growthRate > 5) trend = "growing";
      else if (growthRate < -5) trend = "shrinking";
    }

    return { current, trend, growthRate };
  }

  forceGC(): void {
    if (globalThis.gc) {
      logger.info("Forcing garbage collection");
      globalThis.gc();
      this.takeSnapshot();
    } else {
      logger.warn("Garbage collection not exposed. Run with --expose-gc flag");
    }
  }
}

// Global memory monitor instance
export const memoryMonitor = new MemoryMonitor();

/**
 * Stream cleanup utilities
 * Ensures streams are properly closed to prevent memory leaks
 */
export class StreamCleaner {
  private activeStreams = new Set<{ destroy: () => void }>();

  track<T extends { destroy: () => void }>(stream: T): T {
    this.activeStreams.add(stream);

    stream.destroy = new Proxy(stream.destroy, {
      apply: (target, thisArg, args) => {
        this.activeStreams.delete(stream);
        return Reflect.apply(target, thisArg, args);
      },
    });

    return stream;
  }

  cleanupAll(): void {
    for (const stream of this.activeStreams) {
      try {
        stream.destroy();
      } catch (error) {
        logger.error({ error }, "Error destroying stream");
      }
    }
    this.activeStreams.clear();
  }

  get activeCount(): number {
    return this.activeStreams.size;
  }
}

export const streamCleaner = new StreamCleaner();

/**
 * Resource tracking for cleanup
 */
export class ResourceTracker {
  private resources = new Map<
    string,
    { cleanup: () => void; createdAt: number }
  >();

  track(id: string, cleanup: () => void): void {
    // Clean up existing resource with same id
    this.release(id);

    this.resources.set(id, {
      cleanup,
      createdAt: Date.now(),
    });
  }

  release(id: string): boolean {
    const resource = this.resources.get(id);
    if (resource) {
      try {
        resource.cleanup();
      } catch (error) {
        logger.error({ error, id }, "Error cleaning up resource");
      }
      this.resources.delete(id);
      return true;
    }
    return false;
  }

  releaseAll(): void {
    for (const [id, resource] of this.resources) {
      try {
        resource.cleanup();
      } catch (error) {
        logger.error({ error, id }, "Error cleaning up resource");
      }
    }
    this.resources.clear();
  }

  getResourceAge(id: string): number | undefined {
    const resource = this.resources.get(id);
    if (resource) {
      return Date.now() - resource.createdAt;
    }
    return undefined;
  }

  get trackedCount(): number {
    return this.resources.size;
  }
}

export const resourceTracker = new ResourceTracker();

/**
 * WeakRef-based cache for automatic garbage collection
 */
export class WeakCache<K extends object, V> {
  private cache = new WeakMap<K, V>();
  private strongRefs = new Map<string, K>();

  set(key: K, value: V, strongRefId?: string): void {
    this.cache.set(key, value);
    if (strongRefId) {
      this.strongRefs.set(strongRefId, key);
    }
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  getById(id: string): V | undefined {
    const key = this.strongRefs.get(id);
    if (key) {
      return this.cache.get(key);
    }
    return undefined;
  }

  releaseStrongRef(id: string): boolean {
    return this.strongRefs.delete(id);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}

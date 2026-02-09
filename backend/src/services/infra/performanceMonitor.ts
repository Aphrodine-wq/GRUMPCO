/**
 * Performance Monitor
 * Monitors system performance and reports metrics
 */

import { cpus, freemem, totalmem } from "os";
import { performance } from "perf_hooks";
import logger from "../../middleware/logger.js";

export interface PerformanceSnapshot {
  timestamp: number;
  cpu: {
    usage: number; // 0-100
    cores: number;
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    usagePercent: number;
  };
  eventLoop: {
    lag: number; // milliseconds
  };
  uptime: number; // seconds
}

export class PerformanceMonitor {
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCheck: number = 0;
  private eventLoopLag: number = 0;
  private monitorInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring
   */
  public start(intervalMs = 5000): void {
    if (this.monitorInterval) {
      return; // Already running
    }

    // Start event loop lag monitoring
    this.startEventLoopMonitoring();

    // Start periodic monitoring
    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    logger.info({ intervalMs }, "Performance monitoring started");
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    logger.info("Performance monitoring stopped");
  }

  /**
   * Get current performance snapshot
   */
  public getSnapshot(): PerformanceSnapshot {
    const cpuUsage = this.getCpuUsage();
    const memUsed = totalmem() - freemem();
    const memTotal = totalmem();

    return {
      timestamp: Date.now(),
      cpu: {
        usage: cpuUsage,
        cores: cpus().length,
      },
      memory: {
        used: memUsed,
        total: memTotal,
        usagePercent: (memUsed / memTotal) * 100,
      },
      eventLoop: {
        lag: this.eventLoopLag,
      },
      uptime: process.uptime(),
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  private getCpuUsage(): number {
    const currentUsage = process.cpuUsage();
    const now = Date.now();

    if (!this.lastCpuUsage || !this.lastCheck) {
      this.lastCpuUsage = currentUsage;
      this.lastCheck = now;
      return 0;
    }

    const elapsedTime = (now - this.lastCheck) * 1000; // Convert to microseconds
    const userDiff = currentUsage.user - this.lastCpuUsage.user;
    const systemDiff = currentUsage.system - this.lastCpuUsage.system;
    const totalDiff = userDiff + systemDiff;

    this.lastCpuUsage = currentUsage;
    this.lastCheck = now;

    // Calculate percentage (total CPU time / elapsed time)
    return Math.min(100, (totalDiff / elapsedTime) * 100);
  }

  /**
   * Monitor event loop lag
   */
  private startEventLoopMonitoring(): void {
    let lastCheck = performance.now();

    const checkLag = () => {
      const now = performance.now();
      const lag = now - lastCheck - 100; // Expected 100ms interval
      this.eventLoopLag = Math.max(0, lag);
      lastCheck = now;
      setTimeout(checkLag, 100);
    };

    setTimeout(checkLag, 100);
  }

  /**
   * Collect and report metrics
   */
  private collectMetrics(): void {
    const snapshot = this.getSnapshot();

    logger.debug(
      {
        cpu: snapshot.cpu.usage.toFixed(2),
        memory: snapshot.memory.usagePercent.toFixed(2),
        eventLoopLag: snapshot.eventLoop.lag.toFixed(2),
      },
      "Performance snapshot",
    );

    // Report to Prometheus metrics
    // (metrics are already collected by prom-client's default metrics)
  }

  /**
   * Check if system is under high load
   */
  public isHighLoad(): boolean {
    const snapshot = this.getSnapshot();
    return (
      snapshot.cpu.usage > 80 ||
      snapshot.memory.usagePercent > 85 ||
      snapshot.eventLoop.lag > 100
    );
  }

  /**
   * Get performance recommendations
   */
  public getRecommendations(): string[] {
    const snapshot = this.getSnapshot();
    const recommendations: string[] = [];

    if (snapshot.cpu.usage > 80) {
      recommendations.push(
        "High CPU usage detected. Consider scaling horizontally or optimizing CPU-bound operations.",
      );
    }

    if (snapshot.memory.usagePercent > 85) {
      recommendations.push(
        "High memory usage detected. Consider increasing memory allocation or optimizing memory usage.",
      );
    }

    if (snapshot.eventLoop.lag > 100) {
      recommendations.push(
        "Event loop lag detected. Consider offloading CPU-intensive tasks to worker threads.",
      );
    }

    if (snapshot.cpu.cores < 4) {
      recommendations.push(
        "Limited CPU cores available. Consider upgrading to a larger instance for better parallel processing.",
      );
    }

    return recommendations;
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

/**
 * Get or create the global performance monitor
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
}

/**
 * Start performance monitoring
 */
export function startPerformanceMonitoring(intervalMs = 5000): void {
  const monitor = getPerformanceMonitor();
  monitor.start(intervalMs);
}

/**
 * Stop performance monitoring
 */
export function stopPerformanceMonitoring(): void {
  if (performanceMonitor) {
    performanceMonitor.stop();
  }
}

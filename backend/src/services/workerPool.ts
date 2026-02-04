/**
 * Worker Thread Pool with Dynamic Scaling
 *
 * Features:
 * - Dynamic worker scaling based on queue depth and CPU usage
 * - Priority lanes (high/normal/low) with separate queues
 * - Worker health checks with automatic restart
 * - Metrics for monitoring (queue depth, avg latency, worker utilization)
 */

import { Worker } from "worker_threads";
import { cpus, loadavg } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import logger from "../middleware/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Priority levels
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
}

export interface WorkerTask<T = unknown, R = unknown> {
  id: string;
  type: string;
  data: T;
  priority: TaskPriority;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
  createdAt: number;
  startedAt?: number;
}

export interface WorkerPoolOptions {
  minWorkers?: number;
  maxWorkers?: number;
  maxQueueSize?: number;
  taskTimeout?: number;
  workerScript?: string;
  /** Enable thread-affinity hints for workers */
  threadAffinity?: boolean;
  /** Auto-scaling configuration */
  autoScaling?: {
    enabled?: boolean;
    scaleUpThreshold?: number; // Queue depth per worker to trigger scale up
    scaleDownThreshold?: number; // Queue depth per worker to trigger scale down
    scaleUpCooldown?: number; // Minimum time between scale ups (ms)
    scaleDownCooldown?: number; // Minimum time between scale downs (ms)
    cpuThreshold?: number; // CPU load average threshold (0-1) to prevent over-scaling
  };
  /** Health check configuration */
  healthCheck?: {
    enabled?: boolean;
    interval?: number; // Health check interval (ms)
    timeout?: number; // Health check timeout (ms)
  };
}

export interface WorkerMessage<T = unknown> {
  type: string;
  taskId: string;
  data: T;
}

export interface WorkerResponse<R = unknown> {
  taskId: string;
  success: boolean;
  result?: R;
  error?: string;
}

export interface WorkerAffinityHint {
  workerIndex: number;
  suggestedCpuId: number;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  availableWorkers: number;
  busyWorkers: number;
  queuedTasks: { high: number; normal: number; low: number; total: number };
  activeTasks: number;
  metrics: {
    totalTasksProcessed: number;
    totalTasksFailed: number;
    avgLatencyMs: number;
    tasksPerSecond: number;
    workerUtilization: number;
    scaleEvents: { up: number; down: number };
  };
}

interface WorkerState {
  worker: Worker;
  index: number;
  busy: boolean;
  lastHealthCheck: number;
  healthy: boolean;
  tasksProcessed: number;
}

export class WorkerPool {
  private workers = new Map<Worker, WorkerState>();
  private availableWorkers: Worker[] = [];

  // Priority queues
  private highPriorityQueue: WorkerTask[] = [];
  private normalPriorityQueue: WorkerTask[] = [];
  private lowPriorityQueue: WorkerTask[] = [];

  private activeTasks = new Map<string, WorkerTask>();

  // Configuration
  private minWorkers: number;
  private maxWorkers: number;
  private maxQueueSize: number;
  private taskTimeout: number;
  private workerScript: string;
  private threadAffinity: boolean;
  private isShuttingDown = false;

  // Auto-scaling
  private autoScaling: Required<NonNullable<WorkerPoolOptions["autoScaling"]>>;
  private lastScaleUp = 0;
  private lastScaleDown = 0;
  private scalingInterval: NodeJS.Timeout | null = null;

  // Health check
  private healthCheckConfig: Required<
    NonNullable<WorkerPoolOptions["healthCheck"]>
  >;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Metrics
  private metrics = {
    totalTasksProcessed: 0,
    totalTasksFailed: 0,
    totalLatencyMs: 0,
    scaleUpEvents: 0,
    scaleDownEvents: 0,
    startTime: Date.now(),
  };

  constructor(options: WorkerPoolOptions = {}) {
    const cpuCount = cpus().length;

    this.minWorkers =
      options.minWorkers ?? Math.max(2, Math.floor(cpuCount / 2));
    this.maxWorkers = options.maxWorkers ?? cpuCount * 2;
    this.maxQueueSize = options.maxQueueSize ?? 1000;
    this.taskTimeout = options.taskTimeout ?? 30000;
    this.workerScript =
      options.workerScript ?? join(__dirname, "../workers/cpuBoundWorker.js");
    this.threadAffinity = options.threadAffinity ?? false;

    this.autoScaling = {
      enabled: options.autoScaling?.enabled ?? true,
      scaleUpThreshold: options.autoScaling?.scaleUpThreshold ?? 5,
      scaleDownThreshold: options.autoScaling?.scaleDownThreshold ?? 0.5,
      scaleUpCooldown: options.autoScaling?.scaleUpCooldown ?? 5000,
      scaleDownCooldown: options.autoScaling?.scaleDownCooldown ?? 30000,
      cpuThreshold: options.autoScaling?.cpuThreshold ?? 0.8,
    };

    this.healthCheckConfig = {
      enabled: options.healthCheck?.enabled ?? true,
      interval: options.healthCheck?.interval ?? 30000,
      timeout: options.healthCheck?.timeout ?? 5000,
    };

    // Initialize minimum workers
    for (let i = 0; i < this.minWorkers; i++) {
      this.createWorker(i);
    }

    // Start auto-scaling monitor
    if (this.autoScaling.enabled) {
      this.startAutoScaling();
    }

    // Start health checks
    if (this.healthCheckConfig.enabled) {
      this.startHealthChecks();
    }

    logger.info(
      {
        minWorkers: this.minWorkers,
        maxWorkers: this.maxWorkers,
        autoScaling: this.autoScaling.enabled,
        healthChecks: this.healthCheckConfig.enabled,
      },
      "Worker pool initialized with dynamic scaling",
    );
  }

  private createWorker(workerIndex: number): Worker | null {
    if (this.workers.size >= this.maxWorkers) {
      logger.debug({ maxWorkers: this.maxWorkers }, "Max workers reached");
      return null;
    }

    try {
      const worker = new Worker(this.workerScript, {
        workerData: this.threadAffinity
          ? { workerIndex, cpuCount: cpus().length }
          : undefined,
      });

      const state: WorkerState = {
        worker,
        index: workerIndex,
        busy: false,
        lastHealthCheck: Date.now(),
        healthy: true,
        tasksProcessed: 0,
      };

      this.workers.set(worker, state);

      worker.on("message", (response: WorkerResponse) => {
        this.handleWorkerMessage(worker, response);
      });

      worker.on("error", (error) => {
        logger.error({ error: error.message, workerIndex }, "Worker error");
        this.handleWorkerError(worker, error);
      });

      worker.on("exit", (code) => {
        if (code !== 0 && !this.isShuttingDown) {
          logger.warn(
            { code, workerIndex },
            "Worker exited unexpectedly, restarting",
          );
          this.removeWorker(worker);
          this.createWorker(this.workers.size);
        }
      });

      this.availableWorkers.push(worker);
      return worker;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to create worker",
      );
      return null;
    }
  }

  private removeWorker(worker: Worker): void {
    const state = this.workers.get(worker);
    this.workers.delete(worker);

    const availableIndex = this.availableWorkers.indexOf(worker);
    if (availableIndex > -1) {
      this.availableWorkers.splice(availableIndex, 1);
    }

    worker.terminate().catch((error) => {
      logger.error({ error: error.message }, "Error terminating worker");
    });

    if (state) {
      logger.debug(
        { workerIndex: state.index, tasksProcessed: state.tasksProcessed },
        "Worker removed",
      );
    }
  }

  private handleWorkerMessage(worker: Worker, response: WorkerResponse): void {
    const task = this.activeTasks.get(response.taskId);
    const state = this.workers.get(worker);

    if (!task) {
      logger.warn(
        { taskId: response.taskId },
        "Received response for unknown task",
      );
      return;
    }

    this.activeTasks.delete(response.taskId);

    // Update metrics
    const latency = Date.now() - (task.startedAt ?? task.createdAt);
    this.metrics.totalLatencyMs += latency;

    if (response.success && response.result !== undefined) {
      this.metrics.totalTasksProcessed++;
      task.resolve(response.result);
    } else {
      this.metrics.totalTasksFailed++;
      task.reject(new Error(response.error || "Task failed"));
    }

    if (state) {
      state.busy = false;
      state.tasksProcessed++;
    }

    // Make worker available again
    this.availableWorkers.push(worker);
    this.processQueue();
  }

  private handleWorkerError(worker: Worker, error: Error): void {
    const _state = this.workers.get(worker);

    // Reject all tasks assigned to this worker
    for (const [taskId, task] of this.activeTasks.entries()) {
      task.reject(new Error(`Worker error: ${error.message}`));
      this.activeTasks.delete(taskId);
      this.metrics.totalTasksFailed++;
    }

    // Remove and replace worker if above minimum
    this.removeWorker(worker);
    if (!this.isShuttingDown && this.workers.size < this.minWorkers) {
      this.createWorker(this.workers.size);
    }
  }

  private getNextTask(): WorkerTask | undefined {
    // Process high priority first, then normal, then low
    if (this.highPriorityQueue.length > 0) {
      return this.highPriorityQueue.shift();
    }
    if (this.normalPriorityQueue.length > 0) {
      return this.normalPriorityQueue.shift();
    }
    return this.lowPriorityQueue.shift();
  }

  private getTotalQueueLength(): number {
    return (
      this.highPriorityQueue.length +
      this.normalPriorityQueue.length +
      this.lowPriorityQueue.length
    );
  }

  private processQueue(): void {
    while (this.availableWorkers.length > 0) {
      const task = this.getNextTask();
      if (!task) break;

      const worker = this.availableWorkers.shift();
      if (!worker) break;

      this.executeTask(worker, task);
    }
  }

  private executeTask(worker: Worker, task: WorkerTask): void {
    const state = this.workers.get(worker);
    if (state) {
      state.busy = true;
    }

    task.startedAt = Date.now();
    this.activeTasks.set(task.id, task);

    const message: WorkerMessage = {
      type: task.type,
      taskId: task.id,
      data: task.data,
    };

    // Set timeout
    const timeout = setTimeout(() => {
      const activeTask = this.activeTasks.get(task.id);
      if (activeTask) {
        this.activeTasks.delete(task.id);
        this.metrics.totalTasksFailed++;
        activeTask.reject(new Error("Task timeout"));

        if (state) {
          state.busy = false;
        }

        this.availableWorkers.push(worker);
        this.processQueue();
      }
    }, this.taskTimeout);

    const originalResolve = task.resolve;
    const originalReject = task.reject;

    task.resolve = (value) => {
      clearTimeout(timeout);
      originalResolve(value);
    };

    task.reject = (error) => {
      clearTimeout(timeout);
      originalReject(error);
    };

    worker.postMessage(message);
  }

  // ============================================================================
  // Auto-Scaling
  // ============================================================================

  private startAutoScaling(): void {
    this.scalingInterval = setInterval(() => {
      this.evaluateScaling();
    }, 1000);
  }

  private evaluateScaling(): void {
    if (this.isShuttingDown) return;

    const now = Date.now();
    const workerCount = this.workers.size;
    const queueDepth = this.getTotalQueueLength();
    const queuePerWorker =
      workerCount > 0 ? queueDepth / workerCount : queueDepth;

    // Check CPU load (1-minute average)
    const cpuLoad = loadavg()[0] / cpus().length;

    // Scale up: high queue depth and CPU is not overloaded
    if (
      queuePerWorker > this.autoScaling.scaleUpThreshold &&
      cpuLoad < this.autoScaling.cpuThreshold &&
      workerCount < this.maxWorkers &&
      now - this.lastScaleUp > this.autoScaling.scaleUpCooldown
    ) {
      const newWorker = this.createWorker(workerCount);
      if (newWorker) {
        this.lastScaleUp = now;
        this.metrics.scaleUpEvents++;
        logger.info(
          {
            workers: workerCount + 1,
            queueDepth,
            cpuLoad: cpuLoad.toFixed(2),
          },
          "Scaled up worker pool",
        );
      }
    }

    // Scale down: low queue depth and above minimum workers
    if (
      queuePerWorker < this.autoScaling.scaleDownThreshold &&
      workerCount > this.minWorkers &&
      now - this.lastScaleDown > this.autoScaling.scaleDownCooldown
    ) {
      // Remove an idle worker
      const idleWorker = this.availableWorkers.pop();
      if (idleWorker) {
        this.removeWorker(idleWorker);
        this.lastScaleDown = now;
        this.metrics.scaleDownEvents++;
        logger.info(
          {
            workers: workerCount - 1,
            queueDepth,
          },
          "Scaled down worker pool",
        );
      }
    }
  }

  // ============================================================================
  // Health Checks
  // ============================================================================

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckConfig.interval);
  }

  private async performHealthChecks(): Promise<void> {
    if (this.isShuttingDown) return;

    const now = Date.now();
    const unhealthyWorkers: Worker[] = [];

    for (const [worker, state] of this.workers.entries()) {
      // Consider worker unhealthy if it's been busy for too long
      if (
        state.busy &&
        now - state.lastHealthCheck > this.healthCheckConfig.timeout * 2
      ) {
        state.healthy = false;
        unhealthyWorkers.push(worker);
        logger.warn({ workerIndex: state.index }, "Worker appears stuck");
      } else {
        state.lastHealthCheck = now;
        state.healthy = true;
      }
    }

    // Replace unhealthy workers
    for (const worker of unhealthyWorkers) {
      logger.info("Replacing unhealthy worker");
      this.removeWorker(worker);
      if (this.workers.size < this.minWorkers) {
        this.createWorker(this.workers.size);
      }
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Execute a task on the worker pool
   */
  public async execute<T, R>(
    type: string,
    data: T,
    priority: TaskPriority = TaskPriority.NORMAL,
  ): Promise<R> {
    if (this.isShuttingDown) {
      throw new Error("Worker pool is shutting down");
    }

    if (this.getTotalQueueLength() >= this.maxQueueSize) {
      throw new Error("Task queue is full");
    }

    return new Promise<R>((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        priority,
        resolve: resolve as (value: unknown) => void,
        reject,
        createdAt: Date.now(),
      };

      // Add to appropriate priority queue
      switch (priority) {
        case TaskPriority.HIGH:
          this.highPriorityQueue.push(task as WorkerTask<unknown, unknown>);
          break;
        case TaskPriority.LOW:
          this.lowPriorityQueue.push(task as WorkerTask<unknown, unknown>);
          break;
        default:
          this.normalPriorityQueue.push(task as WorkerTask<unknown, unknown>);
      }

      this.processQueue();
    });
  }

  /**
   * Get thread-affinity hints
   */
  public getAffinityHints(): WorkerAffinityHint[] {
    const cpuCount = cpus().length;
    const hints: WorkerAffinityHint[] = [];

    for (const state of this.workers.values()) {
      hints.push({
        workerIndex: state.index,
        suggestedCpuId: state.index % cpuCount,
      });
    }

    return hints;
  }

  /**
   * Get comprehensive pool statistics
   */
  public getStats(): WorkerPoolStats {
    const totalTasks =
      this.metrics.totalTasksProcessed + this.metrics.totalTasksFailed;
    const elapsedSeconds = (Date.now() - this.metrics.startTime) / 1000;
    const busyWorkers = Array.from(this.workers.values()).filter(
      (s) => s.busy,
    ).length;

    return {
      totalWorkers: this.workers.size,
      availableWorkers: this.availableWorkers.length,
      busyWorkers,
      queuedTasks: {
        high: this.highPriorityQueue.length,
        normal: this.normalPriorityQueue.length,
        low: this.lowPriorityQueue.length,
        total: this.getTotalQueueLength(),
      },
      activeTasks: this.activeTasks.size,
      metrics: {
        totalTasksProcessed: this.metrics.totalTasksProcessed,
        totalTasksFailed: this.metrics.totalTasksFailed,
        avgLatencyMs:
          totalTasks > 0 ? this.metrics.totalLatencyMs / totalTasks : 0,
        tasksPerSecond: elapsedSeconds > 0 ? totalTasks / elapsedSeconds : 0,
        workerUtilization:
          this.workers.size > 0 ? busyWorkers / this.workers.size : 0,
        scaleEvents: {
          up: this.metrics.scaleUpEvents,
          down: this.metrics.scaleDownEvents,
        },
      },
    };
  }

  /**
   * Manually scale the pool
   */
  public scale(targetWorkers: number): void {
    const target = Math.max(
      this.minWorkers,
      Math.min(this.maxWorkers, targetWorkers),
    );
    const current = this.workers.size;

    if (target > current) {
      for (let i = current; i < target; i++) {
        this.createWorker(i);
      }
      logger.info({ from: current, to: target }, "Manually scaled up");
    } else if (target < current) {
      const toRemove = current - target;
      for (let i = 0; i < toRemove && this.availableWorkers.length > 0; i++) {
        const worker = this.availableWorkers.pop();
        if (worker) {
          this.removeWorker(worker);
        }
      }
      logger.info(
        { from: current, to: this.workers.size },
        "Manually scaled down",
      );
    }
  }

  /**
   * Shutdown the worker pool
   */
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop intervals
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
      this.scalingInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Reject all queued tasks
    const allQueued = [
      ...this.highPriorityQueue,
      ...this.normalPriorityQueue,
      ...this.lowPriorityQueue,
    ];
    for (const task of allQueued) {
      task.reject(new Error("Worker pool shutting down"));
    }
    this.highPriorityQueue = [];
    this.normalPriorityQueue = [];
    this.lowPriorityQueue = [];

    // Reject all active tasks
    for (const task of this.activeTasks.values()) {
      task.reject(new Error("Worker pool shutting down"));
    }
    this.activeTasks.clear();

    // Terminate all workers
    const workers = Array.from(this.workers.keys());
    await Promise.all(
      workers.map((worker) =>
        worker.terminate().catch((error) => {
          logger.error({ error: error.message }, "Error terminating worker");
        }),
      ),
    );

    this.workers.clear();
    this.availableWorkers = [];

    logger.info(
      {
        totalProcessed: this.metrics.totalTasksProcessed,
        totalFailed: this.metrics.totalTasksFailed,
        scaleEvents: {
          up: this.metrics.scaleUpEvents,
          down: this.metrics.scaleDownEvents,
        },
      },
      "Worker pool shut down",
    );
  }
}

// Singleton instance
let workerPool: WorkerPool | null = null;

/**
 * Get or create the global worker pool
 */
export function getWorkerPool(options?: WorkerPoolOptions): WorkerPool {
  if (!workerPool) {
    workerPool = new WorkerPool(options);
  }
  return workerPool;
}

/**
 * Shutdown the global worker pool
 */
export async function shutdownWorkerPool(): Promise<void> {
  if (workerPool) {
    await workerPool.shutdown();
    workerPool = null;
  }
}

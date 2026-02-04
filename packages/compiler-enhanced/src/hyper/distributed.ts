/**
 * Distributed Compilation with BullMQ/Redis
 * 
 * Scales compilation across multiple processes/machines using:
 * - BullMQ for reliable job queues
 * - Redis for distributed state
 * - Auto-scaling worker pools
 * - Sharded queues for high throughput
 */

import { EventEmitter } from 'events';
import { cpus, hostname } from 'os';
import { randomUUID } from 'crypto';
import type {
  DistributedConfig,
  DistributedJob,
  DistributedJobPayload,
  DistributedWorkerStats,
} from './types.js';

// ============================================================================
// REDIS CONNECTION (Lazy loaded)
// ============================================================================

let bullmqLoaded = false;
let Queue: any = null;
let Worker: any = null;
let QueueEvents: any = null;

async function loadBullMQ(): Promise<boolean> {
  if (bullmqLoaded) return Queue !== null;
  
  try {
    const bullmq = await import('bullmq');
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
    QueueEvents = bullmq.QueueEvents;
    bullmqLoaded = true;
    return true;
  } catch {
    console.warn('BullMQ not available. Distributed compilation disabled.');
    bullmqLoaded = true;
    return false;
  }
}

// ============================================================================
// DISTRIBUTED COMPILER
// ============================================================================

/**
 * Distributed Compiler Manager
 * 
 * Manages a fleet of workers across processes/machines for parallel compilation.
 */
export class DistributedCompiler extends EventEmitter {
  private config: DistributedConfig;
  private queues: Map<string, any> = new Map(); // Queue instances
  private workers: Map<string, any> = new Map(); // Worker instances
  private queueEvents: Map<string, any> = new Map();
  private workerStats: Map<string, DistributedWorkerStats> = new Map();
  private isInitialized = false;
  private nodeId: string;
  private jobResults: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(config: DistributedConfig) {
    super();
    this.config = config;
    this.nodeId = `${hostname()}-${process.pid}`;
  }

  /**
   * Initialize the distributed compiler
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (!this.config.enabled) return false;

    const loaded = await loadBullMQ();
    if (!loaded) return false;

    try {
      // Create queues based on sharding config
      const queueCount = this.config.sharding.enabled ? this.config.sharding.shardCount : 1;
      
      for (let i = 0; i < queueCount; i++) {
        const queueName = queueCount > 1 
          ? `${this.config.queue.name}-shard-${i}`
          : this.config.queue.name;

        const queue = new Queue(queueName, {
          connection: {
            host: this.config.redis.host,
            port: this.config.redis.port,
            password: this.config.redis.password,
            db: this.config.redis.db,
            maxRetriesPerRequest: this.config.redis.maxRetries,
            retryStrategy: (times: number) => 
              Math.min(times * this.config.redis.retryDelay, 30000),
          },
          defaultJobOptions: {
            attempts: this.config.jobs.attempts,
            backoff: this.config.jobs.backoff,
            removeOnComplete: this.config.jobs.removeOnComplete,
            removeOnFail: this.config.jobs.removeOnFail,
          },
        });

        this.queues.set(queueName, queue);

        // Create queue events for job tracking
        const queueEvents = new QueueEvents(queueName, {
          connection: {
            host: this.config.redis.host,
            port: this.config.redis.port,
            password: this.config.redis.password,
            db: this.config.redis.db,
          },
        });

        queueEvents.on('completed', (job: any) => {
          this.handleJobCompleted(job.jobId, job.returnvalue);
        });

        queueEvents.on('failed', (job: any) => {
          this.handleJobFailed(job.jobId, job.failedReason);
        });

        this.queueEvents.set(queueName, queueEvents);
      }

      // Start workers
      await this.startWorkers();

      this.isInitialized = true;
      this.emit('initialized', { nodeId: this.nodeId, queues: this.queues.size });
      return true;
    } catch (error) {
      console.error('Failed to initialize distributed compiler:', error);
      return false;
    }
  }

  /**
   * Start worker processes
   */
  private async startWorkers(): Promise<void> {
    const workerCount = this.config.workers.count || Math.max(1, cpus().length - 1);

    for (const [queueName, queue] of this.queues) {
      for (let i = 0; i < workerCount; i++) {
        const workerId = `${this.nodeId}-worker-${i}`;
        
        const worker = new Worker(
          queueName,
          async (job: any) => this.processJob(job, workerId),
          {
            connection: {
              host: this.config.redis.host,
              port: this.config.redis.port,
              password: this.config.redis.password,
              db: this.config.redis.db,
            },
            concurrency: this.config.queue.concurrency,
            stalledInterval: this.config.queue.stalledInterval,
            lockDuration: this.config.queue.lockDuration,
            lockRenewTime: this.config.queue.lockRenewTime,
          }
        );

        worker.on('active', (job: any) => {
          this.updateWorkerStats(workerId, { currentJob: job.id });
          this.emit('job:started', { jobId: job.id, workerId });
        });

        worker.on('completed', (job: any) => {
          this.updateWorkerStats(workerId, { 
            currentJob: undefined,
            jobsCompleted: (this.workerStats.get(workerId)?.jobsCompleted || 0) + 1,
          });
        });

        worker.on('failed', (job: any, error: Error) => {
          this.updateWorkerStats(workerId, {
            currentJob: undefined,
            jobsFailed: (this.workerStats.get(workerId)?.jobsFailed || 0) + 1,
          });
          this.emit('job:failed', { jobId: job?.id, workerId, error: error.message });
        });

        worker.on('error', (error: Error) => {
          console.error(`Worker ${workerId} error:`, error);
        });

        this.workers.set(workerId, worker);
        this.workerStats.set(workerId, {
          workerId,
          nodeId: this.nodeId,
          hostname: hostname(),
          jobsCompleted: 0,
          jobsFailed: 0,
          averageJobTime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          uptime: Date.now(),
        });
      }
    }
  }

  /**
   * Process a job
   */
  private async processJob(job: any, workerId: string): Promise<unknown> {
    const startTime = performance.now();
    const payload: DistributedJobPayload = job.data;

    try {
      // Update progress
      await job.updateProgress(10);

      // Get or read file content
      let content = payload.content;
      if (!content && payload.filePath) {
        const fs = await import('fs/promises');
        content = await fs.readFile(payload.filePath, 'utf-8');
      }

      await job.updateProgress(30);

      // Compile the content
      // This is a placeholder - in reality would call actual compilation logic
      const result = await this.compileContent(content || '', payload);

      await job.updateProgress(90);

      // Update worker stats
      const duration = performance.now() - startTime;
      const stats = this.workerStats.get(workerId);
      if (stats) {
        const totalJobs = stats.jobsCompleted + 1;
        stats.averageJobTime = ((stats.averageJobTime * stats.jobsCompleted) + duration) / totalJobs;
      }

      await job.updateProgress(100);

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Compile content (placeholder for actual compilation)
   */
  private async compileContent(
    content: string,
    payload: DistributedJobPayload
  ): Promise<{ output: string; metadata: Record<string, unknown> }> {
    // Simulate compilation work
    // In reality, this would call the actual compiler
    return {
      output: content, // Would be transformed content
      metadata: {
        inputHash: payload.contentHash,
        compiledAt: Date.now(),
        size: content.length,
      },
    };
  }

  /**
   * Submit a compilation job
   */
  async submitJob(
    type: DistributedJob['type'],
    payload: DistributedJobPayload,
    priority: number = 0
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Distributed compiler not initialized');
    }

    const jobId = randomUUID();
    const queueName = this.getQueueForPayload(payload);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.add(type, payload, {
      jobId,
      priority: this.config.jobs.priority === 'priority' ? priority : undefined,
      lifo: this.config.jobs.priority === 'lifo',
    });

    this.emit('job:submitted', { jobId, type, queueName });
    return jobId;
  }

  /**
   * Submit a job and wait for result
   */
  async submitAndWait<T>(
    type: DistributedJob['type'],
    payload: DistributedJobPayload,
    timeout: number = 60000
  ): Promise<T> {
    const jobId = await this.submitJob(type, payload);

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.jobResults.delete(jobId);
        reject(new Error(`Job ${jobId} timed out after ${timeout}ms`));
      }, timeout);

      this.jobResults.set(jobId, { resolve, reject, timeout: timeoutHandle });
    });
  }

  /**
   * Submit multiple jobs in batch
   */
  async submitBatch(
    jobs: Array<{ type: DistributedJob['type']; payload: DistributedJobPayload }>
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (const job of jobs) {
      const jobId = await this.submitJob(job.type, job.payload);
      jobIds.push(jobId);
    }

    return jobIds;
  }

  /**
   * Wait for multiple jobs to complete
   */
  async waitForJobs<T>(jobIds: string[], timeout: number = 120000): Promise<T[]> {
    const promises = jobIds.map(jobId => 
      new Promise<T>((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          this.jobResults.delete(jobId);
          reject(new Error(`Job ${jobId} timed out`));
        }, timeout);

        this.jobResults.set(jobId, { resolve, reject, timeout: timeoutHandle });
      })
    );

    return Promise.all(promises);
  }

  /**
   * Handle job completion
   */
  private handleJobCompleted(jobId: string, result: unknown): void {
    const pending = this.jobResults.get(jobId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.jobResults.delete(jobId);
      pending.resolve(result);
    }
    this.emit('job:completed', { jobId, result });
  }

  /**
   * Handle job failure
   */
  private handleJobFailed(jobId: string, reason: string): void {
    const pending = this.jobResults.get(jobId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.jobResults.delete(jobId);
      pending.reject(new Error(reason));
    }
    this.emit('job:failed', { jobId, reason });
  }

  /**
   * Get queue for payload based on sharding strategy
   */
  private getQueueForPayload(payload: DistributedJobPayload): string {
    if (!this.config.sharding.enabled || this.queues.size === 1) {
      return this.config.queue.name;
    }

    let shardIndex: number;
    
    switch (this.config.sharding.shardKey) {
      case 'file':
        shardIndex = this.hashString(payload.filePath) % this.config.sharding.shardCount;
        break;
      case 'hash':
        shardIndex = this.hashString(payload.contentHash) % this.config.sharding.shardCount;
        break;
      case 'round-robin':
      default:
        shardIndex = Date.now() % this.config.sharding.shardCount;
    }

    return `${this.config.queue.name}-shard-${shardIndex}`;
  }

  /**
   * Simple string hash
   */
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  /**
   * Update worker statistics
   */
  private updateWorkerStats(workerId: string, update: Partial<DistributedWorkerStats>): void {
    const stats = this.workerStats.get(workerId);
    if (stats) {
      Object.assign(stats, update);
    }
  }

  /**
   * Get all worker statistics
   */
  getWorkerStats(): DistributedWorkerStats[] {
    return Array.from(this.workerStats.values());
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<Array<{
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>> {
    const stats: Array<{
      name: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    }> = [];

    for (const [name, queue] of this.queues) {
      const counts = await queue.getJobCounts();
      stats.push({
        name,
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
      });
    }

    return stats;
  }

  /**
   * Scale workers up or down
   */
  async scaleWorkers(count: number): Promise<void> {
    const currentCount = this.workers.size;
    
    if (count > currentCount) {
      // Scale up
      const toAdd = count - currentCount;
      for (let i = 0; i < toAdd; i++) {
        // Add new workers (simplified)
        console.log(`Would add worker ${currentCount + i + 1}`);
      }
    } else if (count < currentCount) {
      // Scale down
      const toRemove = currentCount - count;
      let removed = 0;
      
      for (const [workerId, worker] of this.workers) {
        if (removed >= toRemove) break;
        
        // Only remove idle workers
        const stats = this.workerStats.get(workerId);
        if (!stats?.currentJob) {
          await worker.close();
          this.workers.delete(workerId);
          this.workerStats.delete(workerId);
          removed++;
        }
      }
    }

    this.emit('workers:scaled', { from: currentCount, to: this.workers.size });
  }

  /**
   * Pause all queues
   */
  async pause(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.pause();
    }
    this.emit('paused');
  }

  /**
   * Resume all queues
   */
  async resume(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.resume();
    }
    this.emit('resumed');
  }

  /**
   * Shutdown the distributed compiler
   */
  async shutdown(graceful: boolean = true): Promise<void> {
    // Close workers
    for (const worker of this.workers.values()) {
      if (graceful) {
        await worker.close();
      } else {
        await worker.forceClose();
      }
    }
    this.workers.clear();

    // Close queue events
    for (const qe of this.queueEvents.values()) {
      await qe.close();
    }
    this.queueEvents.clear();

    // Close queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();

    // Reject pending jobs
    for (const [jobId, pending] of this.jobResults) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Distributed compiler shutdown'));
    }
    this.jobResults.clear();

    this.isInitialized = false;
    this.emit('shutdown');
  }
}

/**
 * Create distributed compiler instance
 */
export function createDistributedCompiler(config: DistributedConfig): DistributedCompiler {
  return new DistributedCompiler(config);
}

/**
 * Default distributed compiler configuration
 */
export function getDefaultDistributedConfig(): DistributedConfig {
  return {
    enabled: true,
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
      maxRetries: 3,
      retryDelay: 1000,
      tls: false,
    },
    queue: {
      name: 'hyper-compile',
      concurrency: 4,
      maxJobsPerWorker: 100,
      stalledInterval: 30000,
      lockDuration: 30000,
      lockRenewTime: 15000,
    },
    workers: {
      count: Math.max(1, cpus().length - 1),
      autoScale: true,
      minWorkers: 1,
      maxWorkers: cpus().length * 2,
      scaleUpThreshold: 10,
      scaleDownThreshold: 2,
      idleTimeout: 60000,
    },
    jobs: {
      priority: 'fifo',
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
      ttl: 3600000, // 1 hour
    },
    sharding: {
      enabled: false,
      shardCount: 4,
      shardKey: 'hash',
    },
    aggregation: {
      strategy: 'eager',
      batchSize: 10,
      timeout: 30000,
    },
  };
}

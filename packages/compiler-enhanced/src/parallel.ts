/**
 * Parallel Processing System
 * Worker threads for multi-file compilation with thread pool management
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CompilerConfig, WorkerTask, WorkerResult } from './types.js';

/** Default worker pool size */
const DEFAULT_POOL_SIZE = Math.max(1, cpus().length - 1);

/** Maximum queue size */
const MAX_QUEUE_SIZE = 1000;

/** Worker script content */
const WORKER_SCRIPT = `
const { parentPort } = require('worker_threads');
const { parseIntentWithFallback } = require('./intentCompiler.js');

parentPort.on('message', async (task) => {
  const startTime = Date.now();
  
  try {
    // Parse intent from content
    const result = await parseIntentWithFallback(task.content, {});
    
    // Extract dependencies
    const dependencies = result.data_flows || [];
    
    parentPort.postMessage({
      taskId: task.id,
      success: true,
      output: JSON.stringify(result, null, 2),
      dependencies,
      duration: Date.now() - startTime
    });
  } catch (error) {
    parentPort.postMessage({
      taskId: task.id,
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});
`;

/**
 * Worker pool for parallel compilation
 */
export class WorkerPool {
  private config: CompilerConfig;
  private poolSize: number;
  private workers: Worker[] = [];
  private idleWorkers: Set<Worker> = new Set();
  private taskQueue: Array<{ task: WorkerTask; resolve: (result: WorkerResult) => void; reject: (error: Error) => void }> = [];
  private activeTasks: Map<Worker, { task: WorkerTask; startTime: number }> = new Map();
  private isShuttingDown: boolean = false;
  private workerScriptPath: string;

  constructor(config: CompilerConfig) {
    this.config = config;
    this.poolSize = config.workers || DEFAULT_POOL_SIZE;
    this.workerScriptPath = this.createWorkerScript();
  }

  /**
   * Create worker script file
   */
  private createWorkerScript(): string {
    const cacheDir = this.config.cacheDir || join(process.cwd(), '.grump', 'cache');
    const scriptPath = join(cacheDir, 'worker.js');
    
    const fs = require('fs');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    fs.writeFileSync(scriptPath, WORKER_SCRIPT);
    return scriptPath;
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.workers.length > 0) {
      return; // Already initialized
    }

    const workerPromises: Promise<void>[] = [];

    for (let i = 0; i < this.poolSize; i++) {
      const promise = this.createWorker();
      workerPromises.push(promise);
    }

    await Promise.all(workerPromises);
  }

  /**
   * Create a single worker
   */
  private createWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(this.workerScriptPath);
        
        worker.on('message', (result: WorkerResult) => {
          this.handleWorkerMessage(worker, result);
        });

        worker.on('error', (error) => {
          console.error('Worker error:', error);
          this.handleWorkerError(worker, error);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
            this.replaceWorker(worker);
          }
        });

        this.workers.push(worker);
        this.idleWorkers.add(worker);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(worker: Worker, result: WorkerResult): void {
    const activeTask = this.activeTasks.get(worker);
    if (activeTask) {
      this.activeTasks.delete(worker);
      this.idleWorkers.add(worker);
      
      // Resolve the promise for this task
      const queuedTask = this.taskQueue.find(qt => qt.task.id === result.taskId);
      if (queuedTask) {
        this.taskQueue = this.taskQueue.filter(qt => qt.task.id !== result.taskId);
        queuedTask.resolve(result);
      }

      // Process next task
      this.processQueue();
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(worker: Worker, error: Error): void {
    const activeTask = this.activeTasks.get(worker);
    if (activeTask) {
      this.activeTasks.delete(worker);
      
      const queuedTask = this.taskQueue.find(qt => qt.task.id === activeTask.task.id);
      if (queuedTask) {
        this.taskQueue = this.taskQueue.filter(qt => qt.task.id !== activeTask.task.id);
        queuedTask.reject(error);
      }
    }

    this.replaceWorker(worker);
  }

  /**
   * Replace a failed worker
   */
  private async replaceWorker(oldWorker: Worker): Promise<void> {
    this.workers = this.workers.filter(w => w !== oldWorker);
    this.idleWorkers.delete(oldWorker);
    
    try {
      await oldWorker.terminate();
    } catch {
      // Ignore termination errors
    }

    if (!this.isShuttingDown) {
      await this.createWorker();
    }
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0 || this.idleWorkers.size === 0) {
      return;
    }

    const worker = this.idleWorkers.values().next().value as Worker;
    const queuedTask = this.taskQueue.shift()!;

    this.idleWorkers.delete(worker);
    this.activeTasks.set(worker, { task: queuedTask.task, startTime: Date.now() });

    worker.postMessage(queuedTask.task);

    // Process more if we have capacity
    if (this.taskQueue.length > 0 && this.idleWorkers.size > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Execute a task in the worker pool
   */
  async execute(task: WorkerTask): Promise<WorkerResult> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    if (this.taskQueue.length >= MAX_QUEUE_SIZE) {
      throw new Error('Task queue is full');
    }

    // Ensure initialized
    if (this.workers.length === 0) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Execute multiple tasks in parallel
   */
  async executeBatch(tasks: WorkerTask[]): Promise<WorkerResult[]> {
    const promises = tasks.map(task => this.execute(task));
    return Promise.all(promises);
  }

  /**
   * Execute tasks with concurrency limit
   */
  async executeWithLimit(tasks: WorkerTask[], limit: number = this.poolSize): Promise<WorkerResult[]> {
    const results: WorkerResult[] = [];
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const promise = this.execute(task).then(result => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= limit) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Map function over items using worker pool
   */
  async map<T, R>(
    items: T[],
    mapper: (item: T) => WorkerTask,
    options: { concurrency?: number; ordered?: boolean } = {}
  ): Promise<R[]> {
    const tasks = items.map(mapper);
    
    if (options.ordered) {
      // Execute in order
      const results: R[] = [];
      for (const task of tasks) {
        const result = await this.execute(task);
        if (result.success && result.output) {
          results.push(JSON.parse(result.output) as R);
        }
      }
      return results;
    } else {
      // Execute in parallel
      const results = await this.executeBatch(tasks);
      return results
        .filter(r => r.success && r.output)
        .map(r => JSON.parse(r.output!) as R);
    }
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(timeout: number = 5000): Promise<void> {
    this.isShuttingDown = true;

    // Cancel pending tasks
    for (const queuedTask of this.taskQueue) {
      queuedTask.reject(new Error('Worker pool shutting down'));
    }
    this.taskQueue = [];

    // Terminate workers
    const terminationPromises = this.workers.map(worker => {
      return Promise.race([
        worker.terminate(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Worker termination timeout')), timeout)
        )
      ]);
    });

    try {
      await Promise.all(terminationPromises);
    } catch (error) {
      console.error('Error terminating workers:', error);
    }

    this.workers = [];
    this.idleWorkers.clear();
    this.activeTasks.clear();
    this.isShuttingDown = false;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number;
    idleWorkers: number;
    activeWorkers: number;
    queueSize: number;
    totalTasks: number;
  } {
    return {
      poolSize: this.poolSize,
      idleWorkers: this.idleWorkers.size,
      activeWorkers: this.activeTasks.size,
      queueSize: this.taskQueue.length,
      totalTasks: this.taskQueue.length + this.activeTasks.size
    };
  }

  /**
   * Check if pool is healthy
   */
  isHealthy(): boolean {
    return this.workers.length > 0 && !this.isShuttingDown;
  }
}

/**
 * Create worker pool instance
 */
export function createWorkerPool(config: CompilerConfig): WorkerPool {
  return new WorkerPool(config);
}

/**
 * Parallel compilation options
 */
export interface ParallelCompileOptions {
  /** Maximum concurrency */
  concurrency?: number;
  /** Whether to preserve order */
  ordered?: boolean;
  /** Batch size */
  batchSize?: number;
}

/**
 * Compile files in parallel
 */
export async function compileParallel(
  filePaths: string[],
  compiler: (filePath: string) => Promise<string>,
  options: ParallelCompileOptions = {}
): Promise<Array<{ filePath: string; output: string | null; error?: Error }>> {
  const { concurrency = DEFAULT_POOL_SIZE, ordered = true } = options;
  
  const results: Array<{ filePath: string; output: string | null; error?: Error }> = [];
  
  if (ordered) {
    // Process in order with limited concurrency
    const executing: Promise<void>[] = [];
    
    for (const filePath of filePaths) {
      const promise = compiler(filePath)
        .then(output => {
          results.push({ filePath, output });
        })
        .catch(error => {
          results.push({ filePath, output: null, error: error as Error });
        });
      
      executing.push(promise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }
    
    await Promise.all(executing);
  } else {
    // Process all at once
    const promises = filePaths.map(async filePath => {
      try {
        const output = await compiler(filePath);
        return { filePath, output };
      } catch (error) {
        return { filePath, output: null, error: error as Error };
      }
    });
    
    return Promise.all(promises);
  }
  
  return results;
}

/**
 * Get optimal worker count based on system resources
 */
export function getOptimalWorkerCount(): number {
  const cpuCount = cpus().length;
  const memoryGB = Math.floor(require('os').totalmem() / 1024 / 1024 / 1024);
  
  // Use fewer workers if memory is limited
  const maxWorkersByMemory = Math.max(1, Math.floor(memoryGB / 2));
  const maxWorkersByCPU = Math.max(1, cpuCount - 1);
  
  return Math.min(maxWorkersByMemory, maxWorkersByCPU);
}

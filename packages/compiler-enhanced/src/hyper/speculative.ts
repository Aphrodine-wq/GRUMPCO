/**
 * Speculative Execution Engine
 * 
 * Predicts and pre-executes likely operations to reduce latency:
 * - Markov chain model for file access prediction
 * - Pre-compilation of likely edits
 * - Cache warming based on usage patterns
 * - Automatic invalidation when predictions are wrong
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  SpeculativeExecutionConfig,
  SpeculationEntry,
  PredictionModel,
} from './types.js';

// ============================================================================
// MARKOV CHAIN PREDICTOR
// ============================================================================

/**
 * Markov Chain-based prediction model
 * Learns patterns from file access history to predict future accesses
 */
export class MarkovPredictor {
  private transitions: Map<string, Map<string, number>> = new Map();
  private windowSize: number;
  private history: string[] = [];
  private totalTransitions: Map<string, number> = new Map();

  constructor(windowSize: number = 3) {
    this.windowSize = windowSize;
  }

  /**
   * Record an observation (file access, operation, etc.)
   */
  observe(item: string): void {
    if (this.history.length >= this.windowSize) {
      // Record transition from last N items to new item
      const context = this.history.slice(-this.windowSize).join('->');
      
      if (!this.transitions.has(context)) {
        this.transitions.set(context, new Map());
        this.totalTransitions.set(context, 0);
      }
      
      const contextMap = this.transitions.get(context)!;
      contextMap.set(item, (contextMap.get(item) || 0) + 1);
      this.totalTransitions.set(context, this.totalTransitions.get(context)! + 1);
    }
    
    this.history.push(item);
    
    // Keep history bounded
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
  }

  /**
   * Predict next likely items with probabilities
   */
  predict(topK: number = 5): Array<{ item: string; probability: number }> {
    if (this.history.length < this.windowSize) {
      return [];
    }

    const context = this.history.slice(-this.windowSize).join('->');
    const contextMap = this.transitions.get(context);
    
    if (!contextMap) {
      return [];
    }

    const total = this.totalTransitions.get(context) || 1;
    const predictions: Array<{ item: string; probability: number }> = [];
    
    for (const [item, count] of contextMap) {
      predictions.push({
        item,
        probability: count / total,
      });
    }
    
    return predictions
      .sort((a, b) => b.probability - a.probability)
      .slice(0, topK);
  }

  /**
   * Get hot paths (frequently occurring sequences)
   */
  getHotPaths(minOccurrences: number = 5): string[][] {
    const paths: Array<{ path: string[]; count: number }> = [];
    
    for (const [context, total] of this.totalTransitions) {
      if (total >= minOccurrences) {
        const path = context.split('->');
        paths.push({ path, count: total });
      }
    }
    
    return paths
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map(p => p.path);
  }

  /**
   * Serialize model for persistence
   */
  serialize(): string {
    return JSON.stringify({
      transitions: Array.from(this.transitions.entries()).map(([k, v]) => [k, Array.from(v.entries())]),
      totalTransitions: Array.from(this.totalTransitions.entries()),
      history: this.history.slice(-100),
      windowSize: this.windowSize,
    });
  }

  /**
   * Deserialize model from persistence
   */
  static deserialize(data: string): MarkovPredictor {
    const parsed = JSON.parse(data);
    const predictor = new MarkovPredictor(parsed.windowSize);
    
    predictor.transitions = new Map(
      parsed.transitions.map(([k, v]: [string, [string, number][]]) => [k, new Map(v)])
    );
    predictor.totalTransitions = new Map(parsed.totalTransitions);
    predictor.history = parsed.history;
    
    return predictor;
  }
}

// ============================================================================
// SPECULATIVE EXECUTION ENGINE
// ============================================================================

/**
 * Speculative Execution Engine
 * 
 * Pre-executes operations based on predictions to reduce latency.
 */
export class SpeculativeExecutionEngine extends EventEmitter {
  private config: SpeculativeExecutionConfig;
  private predictor: MarkovPredictor;
  private speculations: Map<string, SpeculationEntry> = new Map();
  private speculationExecutor: Map<string, (target: string) => Promise<unknown>> = new Map();
  private usageCount: Map<string, number> = new Map(); // Track speculation usage
  private rollbackCount: number = 0;
  private speculationInterval: NodeJS.Timeout | null = null;
  private persistPath: string;

  constructor(config: SpeculativeExecutionConfig, persistPath: string = '.grump/speculation') {
    super();
    this.config = config;
    this.persistPath = persistPath;
    this.predictor = new MarkovPredictor(config.prediction.windowSize);
    
    this.loadModel();
  }

  /**
   * Start the speculation engine
   */
  start(): void {
    if (this.speculationInterval) return;

    // Run speculation checks periodically
    this.speculationInterval = setInterval(() => {
      this.runSpeculations();
    }, 1000);

    this.emit('started');
  }

  /**
   * Stop the speculation engine
   */
  stop(): void {
    if (this.speculationInterval) {
      clearInterval(this.speculationInterval);
      this.speculationInterval = null;
    }
    this.emit('stopped');
  }

  /**
   * Record an access (to improve predictions)
   */
  recordAccess(target: string, type: SpeculationEntry['type']): void {
    const key = `${type}:${target}`;
    this.predictor.observe(key);

    // Check if we had a speculation for this
    const speculation = this.speculations.get(key);
    if (speculation && speculation.status === 'completed') {
      speculation.wasUsed = true;
      this.usageCount.set(key, (this.usageCount.get(key) || 0) + 1);
      this.emit('speculation:hit', { target, type });
    }

    // Trigger new speculations based on this access
    this.scheduleSpeculations();
  }

  /**
   * Get a speculated result if available
   */
  getSpeculation<T>(target: string, type: SpeculationEntry['type']): T | null {
    const key = `${type}:${target}`;
    const speculation = this.speculations.get(key);

    if (speculation && speculation.status === 'completed' && speculation.result !== undefined) {
      speculation.wasUsed = true;
      this.emit('speculation:used', { target, type });
      return speculation.result as T;
    }

    return null;
  }

  /**
   * Register an executor for a speculation type
   */
  registerExecutor(
    type: SpeculationEntry['type'],
    executor: (target: string) => Promise<unknown>
  ): void {
    this.speculationExecutor.set(type, (target) => executor(target as string));
  }

  /**
   * Schedule speculations based on predictions
   */
  private scheduleSpeculations(): void {
    if (!this.config.enabled) return;

    const predictions = this.predictor.predict(this.config.prediction.maxSpeculations);
    
    for (const { item, probability } of predictions) {
      if (probability < this.config.prediction.confidenceThreshold) continue;

      const [type, ...targetParts] = item.split(':');
      const target = targetParts.join(':');

      // Check if already speculating
      const existingSpec = this.speculations.get(item);
      if (existingSpec && (existingSpec.status === 'pending' || existingSpec.status === 'executing')) {
        continue;
      }

      // Check resource limits
      if (!this.canSpeculate()) continue;

      // Create speculation entry
      const entry: SpeculationEntry = {
        id: createHash('md5').update(item).digest('hex').substring(0, 8),
        type: type as SpeculationEntry['type'],
        target,
        confidence: probability,
        status: 'pending',
        createdAt: Date.now(),
        memoryUsage: 0,
        wasUsed: false,
      };

      this.speculations.set(item, entry);
      this.emit('speculation:scheduled', { target, type, confidence: probability });
    }
  }

  /**
   * Check if we can create more speculations
   */
  private canSpeculate(): boolean {
    let executing = 0;
    let totalMemory = 0;

    for (const spec of this.speculations.values()) {
      if (spec.status === 'executing') executing++;
      totalMemory += spec.memoryUsage;
    }

    if (executing >= this.config.resources.maxConcurrent) return false;
    if (totalMemory >= this.config.resources.maxMemoryMB * 1024 * 1024) return false;

    return true;
  }

  /**
   * Run pending speculations
   */
  private async runSpeculations(): Promise<void> {
    const pending = Array.from(this.speculations.entries())
      .filter(([_, s]) => s.status === 'pending')
      .sort(([_, a], [__, b]) => b.confidence - a.confidence);

    for (const [key, spec] of pending) {
      if (!this.canSpeculate()) break;

      const executor = this.speculationExecutor.get(spec.type);
      if (!executor) continue;

      spec.status = 'executing';
      this.emit('speculation:started', { target: spec.target, type: spec.type });

      try {
        const startMem = process.memoryUsage().heapUsed;
        const result = await (executor as (target: string) => Promise<unknown>)(spec.target);
        const endMem = process.memoryUsage().heapUsed;

        spec.result = result;
        spec.status = 'completed';
        spec.completedAt = Date.now();
        spec.memoryUsage = Math.max(0, endMem - startMem);

        this.emit('speculation:completed', { 
          target: spec.target, 
          type: spec.type,
          duration: spec.completedAt - spec.createdAt,
        });

        // Set TTL for cleanup
        setTimeout(() => {
          if (!spec.wasUsed) {
            this.invalidateSpeculation(key);
          }
        }, this.config.resources.ttl);

      } catch (error) {
        spec.status = 'invalidated';
        this.emit('speculation:failed', { 
          target: spec.target, 
          type: spec.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Cleanup old speculations
    this.cleanup();
  }

  /**
   * Invalidate a speculation
   */
  invalidateSpeculation(key: string): void {
    const spec = this.speculations.get(key);
    if (spec) {
      if (spec.status === 'completed' && !spec.wasUsed && this.config.rollback.enabled) {
        this.rollbackCount++;
        
        // Reduce confidence for future predictions
        // (This is simplified - a real implementation would update the model)
        this.emit('speculation:rollback', { target: spec.target, type: spec.type });
      }
      
      this.speculations.delete(key);
    }
  }

  /**
   * Invalidate all speculations for a target
   */
  invalidateTarget(target: string): void {
    for (const [key, spec] of this.speculations) {
      if (spec.target === target) {
        spec.status = 'invalidated';
        this.speculations.delete(key);
      }
    }
    this.emit('target:invalidated', { target });
  }

  /**
   * Cleanup expired speculations
   */
  private cleanup(): void {
    const now = Date.now();
    const ttl = this.config.resources.ttl;

    for (const [key, spec] of this.speculations) {
      if (spec.status === 'completed' && spec.completedAt) {
        if (now - spec.completedAt > ttl) {
          this.invalidateSpeculation(key);
        }
      }
      if (spec.status === 'invalidated') {
        this.speculations.delete(key);
      }
    }
  }

  /**
   * Pre-warm cache with likely files
   */
  async warmCache(fileLoader: (path: string) => Promise<unknown>): Promise<number> {
    if (!this.config.targets.cacheWarming) return 0;

    const predictions = this.predictor.predict(20);
    let warmed = 0;

    for (const { item, probability } of predictions) {
      if (probability < 0.2) continue;

      const [type, ...targetParts] = item.split(':');
      if (type !== 'file') continue;

      const target = targetParts.join(':');
      
      try {
        await fileLoader(target);
        warmed++;
      } catch {
        // Ignore errors during warming
      }
    }

    return warmed;
  }

  /**
   * Get speculation statistics
   */
  getStats(): {
    total: number;
    pending: number;
    executing: number;
    completed: number;
    invalidated: number;
    hitRate: number;
    rollbackCount: number;
    memoryUsage: number;
  } {
    let pending = 0;
    let executing = 0;
    let completed = 0;
    let invalidated = 0;
    let hits = 0;
    let memoryUsage = 0;

    for (const spec of this.speculations.values()) {
      switch (spec.status) {
        case 'pending': pending++; break;
        case 'executing': executing++; break;
        case 'completed': 
          completed++; 
          if (spec.wasUsed) hits++;
          break;
        case 'invalidated': invalidated++; break;
      }
      memoryUsage += spec.memoryUsage;
    }

    return {
      total: this.speculations.size,
      pending,
      executing,
      completed,
      invalidated,
      hitRate: completed > 0 ? hits / completed : 0,
      rollbackCount: this.rollbackCount,
      memoryUsage,
    };
  }

  /**
   * Get hot paths from the prediction model
   */
  getHotPaths(): string[][] {
    return this.predictor.getHotPaths();
  }

  /**
   * Save model to disk
   */
  async saveModel(): Promise<void> {
    if (!existsSync(this.persistPath)) {
      mkdirSync(this.persistPath, { recursive: true });
    }

    const modelPath = join(this.persistPath, 'model.json');
    writeFileSync(modelPath, this.predictor.serialize());
  }

  /**
   * Load model from disk
   */
  private loadModel(): void {
    const modelPath = join(this.persistPath, 'model.json');
    
    if (existsSync(modelPath)) {
      try {
        const data = readFileSync(modelPath, 'utf-8');
        this.predictor = MarkovPredictor.deserialize(data);
      } catch {
        // Start with fresh predictor
        this.predictor = new MarkovPredictor(this.config.prediction.windowSize);
      }
    }
  }

  /**
   * Dispose the engine
   */
  async dispose(): Promise<void> {
    this.stop();
    await this.saveModel();
    this.speculations.clear();
    this.speculationExecutor.clear();
  }
}

/**
 * Create speculative execution engine
 */
export function createSpeculativeEngine(config: SpeculativeExecutionConfig): SpeculativeExecutionEngine {
  return new SpeculativeExecutionEngine(config);
}

/**
 * Default speculative execution configuration
 */
export function getDefaultSpeculativeConfig(): SpeculativeExecutionConfig {
  return {
    enabled: true,
    prediction: {
      model: 'markov',
      windowSize: 3,
      confidenceThreshold: 0.3,
      maxSpeculations: 10,
    },
    targets: {
      fileAccess: true,
      compilation: true,
      transformation: true,
      dependencyResolution: true,
      cacheWarming: true,
    },
    resources: {
      maxCpuPercent: 20,
      maxMemoryMB: 256,
      maxConcurrent: 5,
      ttl: 30000, // 30 seconds
    },
    rollback: {
      enabled: true,
      maxRollbacks: 10,
      penaltyMultiplier: 0.5,
    },
  };
}

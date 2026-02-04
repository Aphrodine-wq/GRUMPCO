/**
 * Lazy JIT Compilation Engine
 * 
 * Implements tiered compilation with hot-path detection:
 * - Tier 0: Interpretation (fast startup)
 * - Tier 1: Baseline JIT (quick compilation)
 * - Tier 2: Optimizing JIT (full optimization)
 * - Tier 3: Super-optimizing JIT (speculative optimization)
 * 
 * Hot paths are detected through profiling and promoted to higher tiers.
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  JITConfig,
  JITCompilationUnit,
  ExecutionProfile,
} from './types.js';

// ============================================================================
// PROFILING INFRASTRUCTURE
// ============================================================================

interface ProfileSample {
  timestamp: number;
  functionId: string;
  duration: number;
  heapUsed: number;
}

interface HotSpot {
  id: string;
  invocationCount: number;
  totalTime: number;
  avgTime: number;
  tier: 0 | 1 | 2 | 3;
  lastPromotion: number;
  deoptCount: number;
}

// ============================================================================
// JIT COMPILATION ENGINE
// ============================================================================

/**
 * JIT Compilation Engine
 * 
 * Manages tiered compilation with automatic promotion based on profiling data.
 */
export class JITCompilationEngine extends EventEmitter {
  private config: JITConfig;
  private hotSpots: Map<string, HotSpot> = new Map();
  private compilationUnits: Map<string, JITCompilationUnit> = new Map();
  private profileSamples: ProfileSample[] = [];
  private profilingInterval: NodeJS.Timeout | null = null;
  private codeCache: Map<string, Buffer> = new Map();
  private isInitialized = false;
  private codeCachePath: string;

  constructor(config: JITConfig) {
    super();
    this.config = config;
    this.codeCachePath = config.codeCachePath || '.grump/jit-cache';
  }

  /**
   * Initialize the JIT engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Ensure cache directory exists
    if (!existsSync(this.codeCachePath)) {
      mkdirSync(this.codeCachePath, { recursive: true });
    }

    // Load existing code cache
    await this.loadCodeCache();

    // Start profiling if enabled
    if (this.config.profilingInterval > 0) {
      this.startProfiling();
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Start profiling for hot path detection
   */
  private startProfiling(): void {
    this.profilingInterval = setInterval(() => {
      this.analyzeHotSpots();
    }, this.config.profilingInterval);
  }

  /**
   * Stop profiling
   */
  stopProfiling(): void {
    if (this.profilingInterval) {
      clearInterval(this.profilingInterval);
      this.profilingInterval = null;
    }
  }

  /**
   * Record a function execution for profiling
   */
  recordExecution(functionId: string, duration: number): void {
    const sample: ProfileSample = {
      timestamp: Date.now(),
      functionId,
      duration,
      heapUsed: process.memoryUsage().heapUsed,
    };
    
    this.profileSamples.push(sample);
    
    // Keep only recent samples (5 minutes)
    const cutoff = Date.now() - 5 * 60 * 1000;
    this.profileSamples = this.profileSamples.filter(s => s.timestamp > cutoff);

    // Update hot spot tracking
    this.updateHotSpot(functionId, duration);
  }

  /**
   * Update hot spot tracking
   */
  private updateHotSpot(functionId: string, duration: number): void {
    let hotSpot = this.hotSpots.get(functionId);
    
    if (!hotSpot) {
      hotSpot = {
        id: functionId,
        invocationCount: 0,
        totalTime: 0,
        avgTime: 0,
        tier: 0,
        lastPromotion: 0,
        deoptCount: 0,
      };
      this.hotSpots.set(functionId, hotSpot);
    }

    hotSpot.invocationCount++;
    hotSpot.totalTime += duration;
    hotSpot.avgTime = hotSpot.totalTime / hotSpot.invocationCount;

    // Check for promotion
    this.checkPromotion(hotSpot);
  }

  /**
   * Check if a hot spot should be promoted to a higher tier
   */
  private checkPromotion(hotSpot: HotSpot): void {
    if (hotSpot.tier >= 3) return; // Already at max tier
    if (hotSpot.deoptCount >= this.config.deoptimizationLimit) return; // Too many deopts

    const { callCount, timeThreshold } = this.config.optimizationTriggers;
    
    let shouldPromote = false;
    let newTier = hotSpot.tier;

    // Tier 0 -> 1: Baseline compilation
    if (hotSpot.tier === 0 && hotSpot.invocationCount >= callCount / 10) {
      if (this.config.tiers.baseline) {
        shouldPromote = true;
        newTier = 1;
      }
    }
    
    // Tier 1 -> 2: Optimizing compilation
    if (hotSpot.tier === 1 && hotSpot.invocationCount >= callCount) {
      if (this.config.tiers.optimizing) {
        shouldPromote = true;
        newTier = 2;
      }
    }
    
    // Tier 2 -> 3: Super-optimizing (if average time is high)
    if (hotSpot.tier === 2 && 
        hotSpot.invocationCount >= callCount * 10 && 
        hotSpot.avgTime > timeThreshold) {
      if (this.config.tiers.superOptimizing) {
        shouldPromote = true;
        newTier = 3;
      }
    }

    if (shouldPromote) {
      this.promoteHotSpot(hotSpot, newTier as 0 | 1 | 2 | 3);
    }
  }

  /**
   * Promote a hot spot to a higher tier
   */
  private async promoteHotSpot(hotSpot: HotSpot, newTier: 0 | 1 | 2 | 3): Promise<void> {
    const oldTier = hotSpot.tier;
    hotSpot.tier = newTier;
    hotSpot.lastPromotion = Date.now();

    this.emit('promotion', {
      functionId: hotSpot.id,
      oldTier,
      newTier,
      invocationCount: hotSpot.invocationCount,
      avgTime: hotSpot.avgTime,
    });

    // Trigger recompilation at new tier
    const unit = this.compilationUnits.get(hotSpot.id);
    if (unit) {
      await this.compileAtTier(unit, newTier);
    }
  }

  /**
   * Compile code at a specific tier
   */
  async compileAtTier(unit: JITCompilationUnit, tier: 0 | 1 | 2 | 3): Promise<Buffer | null> {
    const startTime = performance.now();
    
    // Check code cache first
    const cacheKey = `${unit.sourceHash}_tier${tier}`;
    const cached = this.codeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let compiled: Buffer | null = null;

    try {
      switch (tier) {
        case 0:
          // Tier 0: Just parse, no compilation
          compiled = this.parseOnly(unit);
          break;
        case 1:
          // Tier 1: Quick baseline compilation
          compiled = await this.baselineCompile(unit);
          break;
        case 2:
          // Tier 2: Full optimization
          compiled = await this.optimizingCompile(unit);
          break;
        case 3:
          // Tier 3: Speculative optimization
          compiled = await this.superOptimizingCompile(unit);
          break;
      }

      if (compiled) {
        // Update unit
        unit.tier = tier;
        unit.nativeCode = compiled;
        unit.compilationTime = performance.now() - startTime;

        // Cache the result
        this.codeCache.set(cacheKey, compiled);
        
        this.emit('compiled', {
          id: unit.id,
          tier,
          size: compiled.length,
          duration: unit.compilationTime,
        });
      }
    } catch (error) {
      this.emit('error', {
        id: unit.id,
        tier,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return compiled;
  }

  /**
   * Tier 0: Parse only (interpretation mode)
   */
  private parseOnly(unit: JITCompilationUnit): Buffer {
    // In parse-only mode, we just validate and store the bytecode
    const bytecode = this.generateBytecode(unit);
    return Buffer.from(bytecode);
  }

  /**
   * Tier 1: Baseline compilation (fast, minimal optimization)
   */
  private async baselineCompile(unit: JITCompilationUnit): Promise<Buffer> {
    // Baseline compilation: quick and dirty
    // In a real implementation, this would generate actual machine code
    const bytecode = this.generateBytecode(unit);
    
    // Apply basic optimizations
    const optimized = this.applyBasicOptimizations(bytecode);
    
    return Buffer.from(optimized);
  }

  /**
   * Tier 2: Optimizing compilation (full optimization)
   */
  private async optimizingCompile(unit: JITCompilationUnit): Promise<Buffer> {
    const bytecode = this.generateBytecode(unit);
    
    // Apply full optimization pipeline
    let optimized = this.applyBasicOptimizations(bytecode);
    optimized = this.applyInlining(optimized, unit);
    optimized = this.applyConstantFolding(optimized);
    optimized = this.applyDeadCodeElimination(optimized);
    optimized = this.applyLoopOptimizations(optimized);
    
    return Buffer.from(optimized);
  }

  /**
   * Tier 3: Super-optimizing compilation (speculative optimization)
   */
  private async superOptimizingCompile(unit: JITCompilationUnit): Promise<Buffer> {
    const bytecode = this.generateBytecode(unit);
    
    // Full optimization plus speculative optimizations
    let optimized = this.applyBasicOptimizations(bytecode);
    optimized = this.applyInlining(optimized, unit);
    optimized = this.applyConstantFolding(optimized);
    optimized = this.applyDeadCodeElimination(optimized);
    optimized = this.applyLoopOptimizations(optimized);
    
    // Speculative optimizations based on profiling data
    const hotSpot = this.hotSpots.get(unit.id);
    if (hotSpot) {
      optimized = this.applySpeculativeOptimizations(optimized, hotSpot);
    }
    
    return Buffer.from(optimized);
  }

  /**
   * Generate bytecode from compilation unit
   */
  private generateBytecode(unit: JITCompilationUnit): Uint8Array {
    // Simplified bytecode generation
    // In reality, this would parse and generate actual bytecode
    const hash = createHash('md5').update(unit.sourceHash).digest();
    return new Uint8Array(hash);
  }

  /**
   * Apply basic optimizations (Tier 1+)
   */
  private applyBasicOptimizations(bytecode: Uint8Array): Uint8Array {
    // Simplified: in reality would do:
    // - Constant propagation
    // - Copy propagation
    // - Common subexpression elimination
    return bytecode;
  }

  /**
   * Apply function inlining (Tier 2+)
   */
  private applyInlining(bytecode: Uint8Array, unit: JITCompilationUnit): Uint8Array {
    // Inline small, frequently called functions
    return bytecode;
  }

  /**
   * Apply constant folding (Tier 2+)
   */
  private applyConstantFolding(bytecode: Uint8Array): Uint8Array {
    // Evaluate constant expressions at compile time
    return bytecode;
  }

  /**
   * Apply dead code elimination (Tier 2+)
   */
  private applyDeadCodeElimination(bytecode: Uint8Array): Uint8Array {
    // Remove unreachable code
    return bytecode;
  }

  /**
   * Apply loop optimizations (Tier 2+)
   */
  private applyLoopOptimizations(bytecode: Uint8Array): Uint8Array {
    // Loop unrolling, loop invariant code motion, etc.
    return bytecode;
  }

  /**
   * Apply speculative optimizations (Tier 3 only)
   */
  private applySpeculativeOptimizations(bytecode: Uint8Array, hotSpot: HotSpot): Uint8Array {
    // Speculative optimizations based on profiling:
    // - Type specialization
    // - Branch prediction optimization
    // - Devirtualization
    return bytecode;
  }

  /**
   * Deoptimize a function (fallback to lower tier)
   */
  deoptimize(functionId: string, reason: string): void {
    const hotSpot = this.hotSpots.get(functionId);
    if (!hotSpot) return;

    const oldTier = hotSpot.tier;
    hotSpot.tier = Math.max(0, hotSpot.tier - 1) as 0 | 1 | 2 | 3;
    hotSpot.deoptCount++;

    this.emit('deoptimization', {
      functionId,
      oldTier,
      newTier: hotSpot.tier,
      reason,
      deoptCount: hotSpot.deoptCount,
    });
  }

  /**
   * Analyze hot spots and trigger optimizations
   */
  private analyzeHotSpots(): void {
    const now = Date.now();
    const recentSamples = this.profileSamples.filter(s => s.timestamp > now - 60000);

    // Group by function
    const functionStats = new Map<string, { count: number; totalTime: number }>();
    
    for (const sample of recentSamples) {
      const stats = functionStats.get(sample.functionId) || { count: 0, totalTime: 0 };
      stats.count++;
      stats.totalTime += sample.duration;
      functionStats.set(sample.functionId, stats);
    }

    // Identify hot functions for promotion
    for (const [funcId, stats] of functionStats) {
      if (stats.count >= this.config.hotPathThreshold) {
        const hotSpot = this.hotSpots.get(funcId);
        if (hotSpot) {
          this.checkPromotion(hotSpot);
        }
      }
    }
  }

  /**
   * Load code cache from disk
   */
  private async loadCodeCache(): Promise<void> {
    try {
      const indexPath = join(this.codeCachePath, 'index.json');
      if (!existsSync(indexPath)) return;

      const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
      
      for (const entry of index.entries) {
        const codePath = join(this.codeCachePath, entry.file);
        if (existsSync(codePath)) {
          const code = readFileSync(codePath);
          this.codeCache.set(entry.key, code);
        }
      }
    } catch (error) {
      // Ignore cache load errors
    }
  }

  /**
   * Save code cache to disk
   */
  async saveCodeCache(): Promise<void> {
    const entries: Array<{ key: string; file: string }> = [];
    let fileIndex = 0;

    for (const [key, code] of this.codeCache) {
      const fileName = `code_${fileIndex++}.bin`;
      const filePath = join(this.codeCachePath, fileName);
      writeFileSync(filePath, code);
      entries.push({ key, file: fileName });
    }

    const indexPath = join(this.codeCachePath, 'index.json');
    writeFileSync(indexPath, JSON.stringify({ entries, timestamp: Date.now() }));
  }

  /**
   * Create or get a compilation unit
   */
  getOrCreateUnit(id: string, sourceHash: string): JITCompilationUnit {
    let unit = this.compilationUnits.get(id);
    
    if (!unit || unit.sourceHash !== sourceHash) {
      unit = {
        id,
        sourceHash,
        tier: 0,
        hotness: 0,
        lastAccess: Date.now(),
        compilationTime: 0,
        executionProfile: {
          invocationCount: 0,
          totalTime: 0,
          averageTime: 0,
          peakMemory: 0,
          gcPauses: 0,
          branchPredictionMisses: 0,
          cacheMisses: 0,
        },
      };
      this.compilationUnits.set(id, unit);
    }

    return unit;
  }

  /**
   * Get compilation statistics
   */
  getStats(): {
    hotSpots: number;
    compilationUnits: number;
    codeCacheSize: number;
    codeCacheBytes: number;
    tierDistribution: Record<number, number>;
  } {
    const tierDistribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    
    for (const hotSpot of this.hotSpots.values()) {
      tierDistribution[hotSpot.tier]++;
    }

    let codeCacheBytes = 0;
    for (const code of this.codeCache.values()) {
      codeCacheBytes += code.length;
    }

    return {
      hotSpots: this.hotSpots.size,
      compilationUnits: this.compilationUnits.size,
      codeCacheSize: this.codeCache.size,
      codeCacheBytes,
      tierDistribution,
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    this.stopProfiling();
    await this.saveCodeCache();
    this.hotSpots.clear();
    this.compilationUnits.clear();
    this.codeCache.clear();
    this.profileSamples = [];
  }
}

/**
 * Create JIT compilation engine instance
 */
export function createJITEngine(config: JITConfig): JITCompilationEngine {
  return new JITCompilationEngine(config);
}

/**
 * Default JIT configuration
 */
export function getDefaultJITConfig(): JITConfig {
  return {
    enabled: true,
    hotPathThreshold: 10,
    profilingInterval: 1000,
    tiers: {
      interpret: true,
      baseline: true,
      optimizing: true,
      superOptimizing: true,
    },
    optimizationTriggers: {
      loopCount: 100,
      callCount: 50,
      timeThreshold: 10,
    },
    codeCachePath: '.grump/jit-cache',
    codeCacheMaxSize: 100, // 100MB
    deoptimizationLimit: 5,
    bailoutReasons: [
      'type_mismatch',
      'overflow',
      'deopt_loop',
      'stack_overflow',
    ],
  };
}

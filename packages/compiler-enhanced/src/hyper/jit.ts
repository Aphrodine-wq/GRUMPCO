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
  private sourceStore: Map<string, string> = new Map(); // id -> source text
  private isInitialized = false;
  private codeCachePath: string;

  // Regex patterns compiled once for optimization passes
  private static readonly CONST_ARITH = /(?<!\w)(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)(?!\w)/g;
  private static readonly DEAD_RETURN = /\b(return|throw)\b[^;]*;[^\n}]*\n([ \t]+[^}\s][^\n]*\n)+/g;
  private static readonly IF_FALSE = /if\s*\(\s*false\s*\)\s*\{[^}]*\}/g;
  private static readonly IF_TRUE = /if\s*\(\s*true\s*\)\s*\{([^}]*)\}/g;
  private static readonly EMPTY_BLOCKS = /\{\s*\}/g;
  private static readonly MULTI_SEMICOLONS = /;{2,}/g;
  private static readonly MULTI_NEWLINES = /\n{3,}/g;
  private static readonly TRAILING_WHITESPACE = /[ \t]+$/gm;
  private static readonly INLINE_ARROW = /(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*([^;{][^;\n]*);/g;
  private static readonly TYPEOF_GUARD = /typeof\s+(\w+)\s*===?\s*['"](\w+)['"]/g;

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
   * Generate bytecode from compilation unit.
   * Uses stored source content if available, falls back to hash-derived placeholder.
   */
  private generateBytecode(unit: JITCompilationUnit): Uint8Array {
    const source = this.sourceStore.get(unit.id);
    if (source) {
      return new TextEncoder().encode(source);
    }
    // Fallback: hash-derived bytecode for units without stored source
    const hash = createHash('md5').update(unit.sourceHash).digest();
    return new Uint8Array(hash);
  }

  /**
   * Apply basic optimizations (Tier 1+)
   * - Trailing whitespace removal
   * - Consecutive semicolons collapse
   * - Excessive blank line reduction  
   * - Empty block annotation
   */
  private applyBasicOptimizations(bytecode: Uint8Array): Uint8Array {
    let code = new TextDecoder().decode(bytecode);

    // Remove trailing whitespace on each line
    code = code.replace(JITCompilationEngine.TRAILING_WHITESPACE, '');

    // Collapse consecutive semicolons (e.g. `;;` -> `;`)
    code = code.replace(JITCompilationEngine.MULTI_SEMICOLONS, ';');

    // Reduce 3+ consecutive newlines to 2
    code = code.replace(JITCompilationEngine.MULTI_NEWLINES, '\n\n');

    // Annotate empty blocks with /* empty */ for clarity (helps later passes skip them)
    code = code.replace(JITCompilationEngine.EMPTY_BLOCKS, (match) => {
      // Don't annotate if already annotated
      return '{ /* empty */ }';
    });

    return new TextEncoder().encode(code);
  }

  /**
   * Apply function inlining (Tier 2+)
   * Inlines small arrow functions at their call sites.
   * Only inlines single-expression arrow functions (no block body).
   */
  private applyInlining(bytecode: Uint8Array, unit: JITCompilationUnit): Uint8Array {
    let code = new TextDecoder().decode(bytecode);

    // Collect inline candidates: const/let/var name = (params) => expr;
    const candidates = new Map<string, { params: string[]; body: string }>();
    const declPattern = /(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*([^;{][^;\n]*);/g;
    let match: RegExpExecArray | null;

    while ((match = declPattern.exec(code)) !== null) {
      const [, name, paramStr, body] = match;
      const params = paramStr.split(',').map(p => p.trim()).filter(Boolean);
      // Only inline small functions (body < 80 chars, no nested function calls with dots)
      if (body.length < 80 && !body.includes('=>')) {
        candidates.set(name, { params, body });
      }
    }

    // For each candidate, find call sites and inline
    for (const [name, { params, body }] of candidates) {
      // Match call sites: name(arg1, arg2, ...)
      // Only inline if called with exact number of args
      const callPattern = new RegExp(`\\b${name}\\s*\\(([^)]*)\\)`, 'g');
      code = code.replace(callPattern, (fullMatch: string, argStr: string) => {
        const args = argStr.split(',').map((a: string) => a.trim());
        if (args.length !== params.length && !(params.length === 0 && args.length === 1 && args[0] === '')) {
          return fullMatch; // Arity mismatch — don't inline
        }

        // Substitute params with args in the body
        let inlined = body;
        for (let i = 0; i < params.length; i++) {
          const paramName = params[i].replace(/:\s*\w+/, '').trim(); // Strip type annotations
          // Use word-boundary replacement to avoid partial matches
          inlined = inlined.replace(new RegExp(`\\b${paramName}\\b`, 'g'), args[i]);
        }
        return `(${inlined})`;
      });
    }

    return new TextEncoder().encode(code);
  }

  /**
   * Apply constant folding (Tier 2+)
   * Evaluates constant arithmetic expressions at compile time:
   *   2 + 3 -> 5, 10 * 4 -> 40, 100 / 5 -> 20, 50 - 7 -> 43
   * Only folds when both operands are numeric literals with no adjacent identifiers.
   */
  private applyConstantFolding(bytecode: Uint8Array): Uint8Array {
    let code = new TextDecoder().decode(bytecode);
    let prevCode: string;
    
    // Iterate because folding can create new constant expressions
    // e.g., (2 + 3) * 4 -> after first pass: 5 * 4 -> second pass: 20
    let iterations = 0;
    do {
      prevCode = code;
      code = code.replace(JITCompilationEngine.CONST_ARITH, (_match: string, leftStr: string, op: string, rightStr: string) => {
        const left = parseFloat(leftStr);
        const right = parseFloat(rightStr);
        
        if (isNaN(left) || isNaN(right)) return _match;
        
        let result: number;
        switch (op) {
          case '+': result = left + right; break;
          case '-': result = left - right; break;
          case '*': result = left * right; break;
          case '/':
            if (right === 0) return _match; // Don't fold division by zero
            result = left / right;
            break;
          default: return _match;
        }

        // Keep result clean: integer if no fractional part
        const resultStr = Number.isInteger(result) ? result.toString() : result.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
        return resultStr;
      });
      iterations++;
    } while (code !== prevCode && iterations < 5);

    return new TextEncoder().encode(code);
  }

  /**
   * Apply dead code elimination (Tier 2+)
   * - Remove code after return/throw statements within the same block
   * - Remove if(false) blocks entirely
   * - Replace if(true) blocks with just the body
   */
  private applyDeadCodeElimination(bytecode: Uint8Array): Uint8Array {
    let code = new TextDecoder().decode(bytecode);

    // Remove if(false) { ... } blocks
    code = code.replace(JITCompilationEngine.IF_FALSE, '');

    // Replace if(true) { body } with just body (unwrap the block)
    code = code.replace(JITCompilationEngine.IF_TRUE, (_match: string, body: string) => {
      return body.trim();
    });

    // Remove unreachable code after return/throw within block scopes.
    // We process line by line, tracking brace depth per function.
    const lines = code.split('\n');
    const result: string[] = [];
    let deadUntilBraceDepth = -1; // -1 means not in dead zone
    let braceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Count brace changes
      const opens = (trimmed.match(/\{/g) || []).length;
      const closes = (trimmed.match(/\}/g) || []).length;

      if (deadUntilBraceDepth >= 0) {
        // We're in a dead zone — skip lines until we close back to the target depth
        braceDepth += opens;
        braceDepth -= closes;
        
        if (braceDepth <= deadUntilBraceDepth) {
          // We've exited the dead zone — include this closing brace line
          deadUntilBraceDepth = -1;
          if (trimmed === '}' || trimmed.startsWith('}')) {
            result.push(line);
          }
        }
        continue;
      }

      result.push(line);
      braceDepth += opens;
      braceDepth -= closes;

      // Detect terminal statements (return/throw/break/continue followed by ;)
      // Only enter dead zone if there's a block to eliminate (braceDepth > 0)
      if (braceDepth > 0 && /^\s*(return\b[^;]*;|throw\b[^;]*;|break\s*;|continue\s*;)\s*$/.test(line)) {
        deadUntilBraceDepth = braceDepth - 1;
      }
    }

    code = result.join('\n');

    // Clean up resulting empty lines
    code = code.replace(JITCompilationEngine.MULTI_NEWLINES, '\n\n');

    return new TextEncoder().encode(code);
  }

  /**
   * Apply loop optimizations (Tier 2+)
   * - Loop invariant code motion: hoist `.length` property accesses out of for-loops
   * - Small constant loop unrolling hints via comment annotations
   */
  private applyLoopOptimizations(bytecode: Uint8Array): Uint8Array {
    let code = new TextDecoder().decode(bytecode);

    // Loop invariant code motion: hoist .length out of for-loop conditions
    // for (let i = 0; i < arr.length; i++) -> const __len_arr = arr.length; for (let i = 0; i < __len_arr; i++)
    const forLoopPattern = /for\s*\(\s*(let|var|const)\s+(\w+)\s*=\s*0\s*;\s*\2\s*<\s*(\w+)\.length\s*;\s*\2\+\+\s*\)/g;
    code = code.replace(forLoopPattern, (_match: string, decl: string, varName: string, arrName: string) => {
      const lenVar = `__len_${arrName}`;
      return `const ${lenVar} = ${arrName}.length; for (${decl} ${varName} = 0; ${varName} < ${lenVar}; ${varName}++)`;
    });

    // Small constant loop unrolling annotation:
    // for loops with known small bounds (< 8) get an unroll hint comment
    const constLoopPattern = /for\s*\(\s*(?:let|var|const)\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\d+)\s*;\s*\1\+\+\s*\)/g;
    code = code.replace(constLoopPattern, (match: string, _varName: string, boundStr: string) => {
      const bound = parseInt(boundStr, 10);
      if (bound > 0 && bound <= 8) {
        return `/* @jit-unroll(${bound}) */ ${match}`;
      }
      return match;
    });

    return new TextEncoder().encode(code);
  }

  /**
   * Apply speculative optimizations (Tier 3 only)
   * Based on profiling data from the hot spot:
   * - High invocation count -> add inline hint comments
   * - Type guard specialization annotations
   * - Branch weight annotations based on execution profile
   */
  private applySpeculativeOptimizations(bytecode: Uint8Array, hotSpot: HotSpot): Uint8Array {
    let code = new TextDecoder().decode(bytecode);

    // If the function is extremely hot, add optimization hints
    if (hotSpot.invocationCount > 1000) {
      // Add monomorphic call site hints for typeof guards
      code = code.replace(JITCompilationEngine.TYPEOF_GUARD, (match: string, varName: string, typeName: string) => {
        return `/* @jit-specialize(${varName}:${typeName}) */ ${match}`;
      });
    }

    // Add branch prediction hints based on execution profile
    // If avg time is low, the happy path is likely dominant
    if (hotSpot.avgTime < 1) {
      // Fast function — annotate first branch of if/else as likely
      code = code.replace(
        /if\s*\(([^)]+)\)\s*\{/g,
        (match: string) => `/* @jit-likely */ ${match}`
      );
    }

    // For functions with many deopts, add guard checks
    if (hotSpot.deoptCount > 0) {
      // Prefix with deopt tracking comment so runtime can install OSR points
      code = `/* @jit-osr-entry deopt_count=${hotSpot.deoptCount} */ \n${code}`;
    }

    return new TextEncoder().encode(code);
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
  getOrCreateUnit(id: string, sourceHash: string, sourceContent?: string): JITCompilationUnit {
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

    // Store source content for compilation passes
    if (sourceContent !== undefined) {
      this.sourceStore.set(id, sourceContent);
    }

    return unit;
  }

  /**
   * Compile source content through the JIT pipeline.
   * Called by HyperCompiler.compileFile() with actual file contents.
   * Returns the optimized source as a string.
   */
  async compileSource(id: string, sourceHash: string, sourceContent: string, requestedTier?: 0 | 1 | 2 | 3): Promise<string> {
    const unit = this.getOrCreateUnit(id, sourceHash, sourceContent);
    
    // Determine tier: use requested tier, or the hot-spot promoted tier
    const hotSpot = this.hotSpots.get(id);
    const tier = requestedTier ?? (hotSpot ? hotSpot.tier : unit.tier);

    const compiled = await this.compileAtTier(unit, tier as 0 | 1 | 2 | 3);
    if (compiled) {
      return compiled.toString('utf-8');
    }
    return sourceContent;
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
    this.sourceStore.clear();
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

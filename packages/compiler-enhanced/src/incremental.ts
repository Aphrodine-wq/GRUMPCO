/**
 * Incremental Compilation System
 * Tracks file hashes and maintains dependency graph for efficient recompilation
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import type {
  CompilerConfig,
  FileHashEntry,
  DependencyNode,
  CacheEntry,
  EnrichedIntent
} from './types.js';

/** Hash algorithm used for file content hashing */
const HASH_ALGORITHM = 'sha256';

/** Default cache file name */
const CACHE_FILE = '.grump-cache.json';

/** Dependency graph file name */
const DEPS_FILE = '.grump-deps.json';

/**
 * Calculate hash of file content
 */
export function calculateHash(content: string | Buffer): string {
  return createHash(HASH_ALGORITHM).update(content).digest('hex');
}

/**
 * Calculate hash of a file on disk
 */
export function calculateFileHash(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath);
    return calculateHash(content);
  } catch {
    return null;
  }
}

/**
 * Incremental compilation manager
 */
export class IncrementalCompiler {
  private config: CompilerConfig;
  private cacheDir: string;
  private fileHashes: Map<string, FileHashEntry> = new Map();
  private dependencyGraph: Map<string, DependencyNode> = new Map();
  private cacheEntries: Map<string, CacheEntry> = new Map();

  constructor(config: CompilerConfig) {
    this.config = config;
    this.cacheDir = config.cacheDir || join(process.cwd(), '.grump', 'cache');
    this.ensureCacheDir();
    this.loadCache();
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get cache file path
   */
  private getCacheFilePath(): string {
    return join(this.cacheDir, CACHE_FILE);
  }

  /**
   * Get dependency file path
   */
  private getDepsFilePath(): string {
    return join(this.cacheDir, DEPS_FILE);
  }

  /**
   * Load cache from disk
   */
  private loadCache(): void {
    try {
      const cachePath = this.getCacheFilePath();
      if (existsSync(cachePath)) {
        const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
        this.cacheEntries = new Map(Object.entries(cache.entries || {}));
      }

      const depsPath = this.getDepsFilePath();
      if (existsSync(depsPath)) {
        const deps = JSON.parse(readFileSync(depsPath, 'utf-8'));
        this.dependencyGraph = new Map(Object.entries(deps.graph || {}));
        this.fileHashes = new Map(Object.entries(deps.hashes || {}));
      }
    } catch (error) {
      console.warn('Failed to load cache, starting fresh:', error);
    }
  }

  /**
   * Save cache to disk
   */
  saveCache(): void {
    try {
      const cacheData = {
        version: '1.0',
        timestamp: Date.now(),
        entries: Object.fromEntries(this.cacheEntries)
      };
      writeFileSync(this.getCacheFilePath(), JSON.stringify(cacheData, null, 2));

      const depsData = {
        version: '1.0',
        timestamp: Date.now(),
        graph: Object.fromEntries(this.dependencyGraph),
        hashes: Object.fromEntries(this.fileHashes)
      };
      writeFileSync(this.getDepsFilePath(), JSON.stringify(depsData, null, 2));
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  /**
   * Check if file needs recompilation
   */
  needsRecompilation(filePath: string, dependencies: string[] = []): boolean {
    const normalizedPath = resolve(filePath);
    const currentHash = calculateFileHash(normalizedPath);
    
    if (!currentHash) {
      return true; // File doesn't exist or can't be read
    }

    const cachedEntry = this.fileHashes.get(normalizedPath);
    if (!cachedEntry) {
      return true; // Not in cache
    }

    if (cachedEntry.hash !== currentHash) {
      return true; // File content changed
    }

    // Check if dependencies changed
    const node = this.dependencyGraph.get(normalizedPath);
    if (node) {
      for (const dep of node.dependencies) {
        const depHash = calculateFileHash(dep);
        const depCached = this.fileHashes.get(dep);
        if (!depCached || depCached.hash !== depHash) {
          return true; // Dependency changed
        }
      }
    }

    return false;
  }

  /**
   * Get cached output if available and valid
   */
  getCachedOutput(filePath: string): CacheEntry | null {
    const normalizedPath = resolve(filePath);
    const currentHash = calculateFileHash(normalizedPath);
    
    if (!currentHash) {
      return null;
    }

    const cached = this.cacheEntries.get(normalizedPath);
    if (!cached || cached.inputHash !== currentHash) {
      return null;
    }

    // Verify dependencies haven't changed
    for (const dep of cached.dependencies) {
      const depHash = calculateFileHash(dep);
      const depCached = this.fileHashes.get(dep);
      if (!depCached || depCached.hash !== depHash) {
        return null;
      }
    }

    return cached;
  }

  /**
   * Store compilation result in cache
   */
  storeCache(
    filePath: string,
    output: string,
    dependencies: string[],
    intent?: EnrichedIntent
  ): void {
    const normalizedPath = resolve(filePath);
    const inputHash = calculateFileHash(normalizedPath) || calculateHash(filePath);
    const outputHash = calculateHash(output);

    const entry: CacheEntry = {
      inputHash,
      output,
      outputHash,
      dependencies,
      timestamp: Date.now(),
      intent
    };

    this.cacheEntries.set(normalizedPath, entry);

    // Update file hash entry
    const stats = existsSync(normalizedPath) ? readFileSync(normalizedPath) : null;
    this.fileHashes.set(normalizedPath, {
      path: normalizedPath,
      hash: inputHash,
      mtime: Date.now(),
      size: stats ? stats.length : 0
    });

    // Update dependency graph
    const node: DependencyNode = {
      path: normalizedPath,
      dependencies: dependencies.map(d => resolve(d)),
      dependents: [],
      hash: inputHash,
      outputHash,
      intent
    };

    // Update dependents
    for (const dep of dependencies) {
      const depPath = resolve(dep);
      const depNode = this.dependencyGraph.get(depPath);
      if (depNode) {
        if (!depNode.dependents.includes(normalizedPath)) {
          depNode.dependents.push(normalizedPath);
        }
      }
    }

    this.dependencyGraph.set(normalizedPath, node);
  }

  /**
   * Get all files that need recompilation based on changed files
   */
  getAffectedFiles(changedFiles: string[]): string[] {
    const affected = new Set<string>();
    const queue = [...changedFiles];

    while (queue.length > 0) {
      const file = queue.shift()!;
      const normalizedPath = resolve(file);
      
      if (affected.has(normalizedPath)) {
        continue;
      }

      affected.add(normalizedPath);

      // Find all files that depend on this file
      const node = this.dependencyGraph.get(normalizedPath);
      if (node) {
        for (const dependent of node.dependents) {
          if (!affected.has(dependent)) {
            queue.push(dependent);
          }
        }
      }
    }

    return Array.from(affected);
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): Map<string, DependencyNode> {
    return new Map(this.dependencyGraph);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cacheEntries.clear();
    this.dependencyGraph.clear();
    this.fileHashes.clear();
    this.saveCache();
  }

  /**
   * Invalidate specific file cache
   */
  invalidate(filePath: string): void {
    const normalizedPath = resolve(filePath);
    this.cacheEntries.delete(normalizedPath);
    this.dependencyGraph.delete(normalizedPath);
    this.fileHashes.delete(normalizedPath);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cachedFiles: number;
    dependencyNodes: number;
    totalCacheSize: number;
  } {
    let totalSize = 0;
    for (const entry of this.cacheEntries.values()) {
      totalSize += Buffer.byteLength(entry.output, 'utf-8');
    }

    return {
      cachedFiles: this.cacheEntries.size,
      dependencyNodes: this.dependencyGraph.size,
      totalCacheSize: totalSize
    };
  }
}

/**
 * Create incremental compiler instance
 */
export function createIncrementalCompiler(config: CompilerConfig): IncrementalCompiler {
  return new IncrementalCompiler(config);
}

/**
 * Calculate hash for content (exported for testing)
 */
export { calculateHash as hashContent };

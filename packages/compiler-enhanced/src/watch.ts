/**
 * Watch Mode System
 * Monitor file system changes and auto-recompile with debouncing
 */

import chokidar from 'chokidar';
import { resolve, relative } from 'path';
import { EventEmitter } from 'events';
import type { CompilerConfig, WatchEvent } from './types.js';
import type { IncrementalCompiler } from './incremental.js';

/** Default debounce time in ms */
const DEFAULT_DEBOUNCE_MS = 300;

/** Default watch patterns */
const DEFAULT_WATCH_PATTERNS = ['**/*.intent', '**/*.grump', '**/intents/**'];

/** Default ignored patterns */
const DEFAULT_IGNORED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/.grump/cache/**',
  '**/coverage/**',
  '**/*.log'
];

/**
 * Watch mode compiler
 */
export class WatchCompiler extends EventEmitter {
  private config: CompilerConfig;
  private incremental: IncrementalCompiler | undefined;
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;
  private pendingChanges: Map<string, WatchEvent> = new Map();
  private isCompiling: boolean = false;
  private compileQueue: string[] = [];

  constructor(
    config: CompilerConfig,
    incremental?: IncrementalCompiler
  ) {
    super();
    this.config = config;
    this.incremental = incremental;
    this.debounceMs = typeof config.watch === 'number' ? config.watch : DEFAULT_DEBOUNCE_MS;
  }

  /**
   * Start watching files
   */
  async start(
    patterns: string | string[] = DEFAULT_WATCH_PATTERNS,
    ignored: string | string[] = DEFAULT_IGNORED
  ): Promise<void> {
    if (this.watcher) {
      throw new Error('Watcher already started');
    }

    const resolvedPatterns = Array.isArray(patterns) ? patterns : [patterns];
    const resolvedIgnored = Array.isArray(ignored) ? ignored : [ignored];

    this.emit('starting', { patterns: resolvedPatterns, ignored: resolvedIgnored });

    this.watcher = chokidar.watch(resolvedPatterns, {
      ignored: resolvedIgnored,
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false,
      atomic: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    this.watcher.on('add', (path, stats) => this.handleChange('add', path, stats));
    this.watcher.on('change', (path, stats) => this.handleChange('change', path, stats));
    this.watcher.on('unlink', (path) => this.handleChange('unlink', path));
    this.watcher.on('error', (error) => this.emit('error', error));
    this.watcher.on('ready', () => this.emit('ready'));

    return new Promise((resolve, reject) => {
      this.watcher!.once('ready', resolve);
      this.watcher!.once('error', reject);
    });
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.pendingChanges.clear();
    this.compileQueue = [];
    this.isCompiling = false;

    this.emit('stopped');
  }

  /**
   * Handle file change event
   */
  private handleChange(
    type: 'add' | 'change' | 'unlink',
    path: string,
    stats?: { size: number; mtime: Date }
  ): void {
    const normalizedPath = resolve(path);
    const relativePath = relative(process.cwd(), normalizedPath);

    const event: WatchEvent = {
      type,
      path: normalizedPath,
      stats: stats ? { size: stats.size, mtime: stats.mtime } : undefined
    };

    this.pendingChanges.set(normalizedPath, event);
    this.emit('change', event);

    // Debounce compilation
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.triggerCompilation();
    }, this.debounceMs);
  }

  /**
   * Trigger compilation of pending changes
   */
  private async triggerCompilation(): Promise<void> {
    if (this.isCompiling) {
      // Queue changes for next compilation
      this.compileQueue.push(...this.pendingChanges.keys());
      this.pendingChanges.clear();
      return;
    }

    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    // Add queued files
    if (this.compileQueue.length > 0) {
      for (const path of this.compileQueue) {
        if (!changes.find(c => c.path === path)) {
          changes.push({ type: 'change', path });
        }
      }
      this.compileQueue = [];
    }

    if (changes.length === 0) {
      return;
    }

    this.isCompiling = true;
    this.emit('compiling', { files: changes });

    try {
      // Determine which files to compile
      let filesToCompile: string[] = [];

      if (this.incremental) {
        // Get all affected files based on dependency graph
        const changedPaths = changes.map(c => c.path);
        filesToCompile = this.incremental.getAffectedFiles(changedPaths);
      } else {
        // Compile only changed files
        filesToCompile = changes
          .filter(c => c.type !== 'unlink')
          .map(c => c.path);
      }

      if (filesToCompile.length === 0) {
        this.emit('compiled', { 
          success: true, 
          compiledFiles: [],
          skipped: true,
          message: 'No files need compilation'
        });
        return;
      }

      this.emit('compile:start', { files: filesToCompile });

      // Perform compilation
      const result = await this.compile(filesToCompile);

      this.emit('compiled', {
        success: result.success,
        compiledFiles: filesToCompile,
        duration: result.duration,
        warnings: result.warnings,
        errors: result.errors,
        result
      });
    } catch (error) {
      this.emit('error', error);
      this.emit('compiled', {
        success: false,
        compiledFiles: [],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.isCompiling = false;

      // Check if more changes accumulated during compilation
      if (this.pendingChanges.size > 0 || this.compileQueue.length > 0) {
        this.triggerCompilation();
      }
    }
  }

  /**
   * Compile files
   */
  private async compile(filePaths: string[]): Promise<{
    success: boolean;
    duration: number;
    warnings: string[];
    errors: string[];
  }> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    // This is a placeholder - actual compilation would be done by the main compiler
    // The watch mode just coordinates when to trigger compilation
    for (const filePath of filePaths) {
      try {
        this.emit('compiling:file', { path: filePath });
        
        // Simulate compilation work
        await new Promise(resolve => setTimeout(resolve, 10));
        
        this.emit('compiled:file', { path: filePath });
      } catch (error) {
        errors.push(`Failed to compile ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: errors.length === 0,
      duration,
      warnings,
      errors
    };
  }

  /**
   * Get current watcher status
   */
  getStatus(): {
    isWatching: boolean;
    pendingChanges: number;
    isCompiling: boolean;
    queuedCompilations: number;
  } {
    return {
      isWatching: this.watcher !== null,
      pendingChanges: this.pendingChanges.size,
      isCompiling: this.isCompiling,
      queuedCompilations: this.compileQueue.length
    };
  }

  /**
   * Force recompile of all watched files
   */
  async recompileAll(): Promise<void> {
    if (!this.watcher) {
      throw new Error('Watcher not started');
    }

    const watched = this.watcher.getWatched();
    const allFiles: string[] = [];

    for (const [dir, files] of Object.entries(watched)) {
      for (const file of files) {
        if (typeof file === 'string') {
          allFiles.push(resolve(dir, file));
        }
      }
    }

    // Add to compilation queue
    for (const file of allFiles) {
      this.pendingChanges.set(file, { type: 'change', path: file });
    }

    // Trigger immediately
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.triggerCompilation();
  }
}

/**
 * Create watch compiler instance
 */
export function createWatchCompiler(
  config: CompilerConfig,
  incremental?: IncrementalCompiler
): WatchCompiler {
  return new WatchCompiler(config, incremental);
}

/**
 * Start watch mode (convenience function)
 */
export async function watch(
  config: CompilerConfig,
  onChange?: (event: WatchEvent) => void,
  onCompile?: (result: unknown) => void
): Promise<WatchCompiler> {
  const incremental = config.incremental ? new (await import('./incremental.js')).IncrementalCompiler(config) : undefined;
  const watcher = createWatchCompiler(config, incremental);

  if (onChange) {
    watcher.on('change', onChange);
  }

  if (onCompile) {
    watcher.on('compiled', onCompile);
  }

  await watcher.start();
  return watcher;
}

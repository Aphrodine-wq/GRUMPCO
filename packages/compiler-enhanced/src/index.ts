/**
 * Enhanced Compiler Main Entry Point
 * Orchestrates all compiler features
 */

import { resolve, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { glob } from 'glob';
import type {
  CompilerConfig,
  CompileResult,
  OutputFile,
  EnrichedIntent
} from './types.js';
import { createIncrementalCompiler } from './incremental.js';
import { createWatchCompiler } from './watch.js';
import { createBundleAnalyzer } from './analyzer.js';
import { createDeadCodeEliminator } from './dce.js';
import { createWorkerPool, compileParallel } from './parallel.js';
import { createTransformPipeline } from './transforms.js';
import { createSourceMapGenerator, generateSourceMap } from './sourcemaps.js';
import { createHotReloadServer } from './hotreload.js';

/**
 * Main enhanced compiler class
 */
export class EnhancedCompiler {
  private config: CompilerConfig;
  private incremental: ReturnType<typeof createIncrementalCompiler> | null = null;
  private watcher: ReturnType<typeof createWatchCompiler> | null = null;
  private workerPool: ReturnType<typeof createWorkerPool> | null = null;
  private hotReload: ReturnType<typeof createHotReloadServer> | null = null;
  private transformPipeline: ReturnType<typeof createTransformPipeline>;
  private analyzer: ReturnType<typeof createBundleAnalyzer>;
  private dce: ReturnType<typeof createDeadCodeEliminator>;

  constructor(config: CompilerConfig) {
    this.config = this.normalizeConfig(config);
    this.transformPipeline = createTransformPipeline(this.config);
    this.analyzer = createBundleAnalyzer(this.config);
    this.dce = createDeadCodeEliminator(this.config);

    // Initialize optional features
    if (this.config.incremental) {
      this.incremental = createIncrementalCompiler(this.config);
    }

    if (this.config.parallel) {
      this.workerPool = createWorkerPool(this.config);
    }
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: CompilerConfig): CompilerConfig {
    return {
      outDir: './dist',
      cacheDir: './.grump/cache',
      target: 'es2022',
      ...config
    };
  }

  /**
   * Compile files
   */
  async compile(entryPoints: string | string[]): Promise<CompileResult> {
    const startTime = Date.now();
    const entries = Array.isArray(entryPoints) ? entryPoints : [entryPoints];
    
    // Resolve entry points
    const resolvedEntries = entries.map(e => resolve(e));
    
    // Ensure output directory exists
    const outDir = resolve(this.config.outDir!);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const outputs: OutputFile[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const intents = new Map<string, EnrichedIntent>();

    try {
      // Find all intent files
      const files = await this.findIntentFiles(resolvedEntries);
      
      // Filter to only changed files if incremental
      let filesToCompile = files;
      if (this.config.incremental && this.incremental) {
        filesToCompile = files.filter(f => this.incremental!.needsRecompilation(f));
      }

      // Compile files
      if (this.config.parallel && this.workerPool) {
        // Parallel compilation
        await this.workerPool.initialize();
        
        const results = await compileParallel(
          filesToCompile,
          (filePath) => this.compileFile(filePath, intents),
          { concurrency: this.config.workers, ordered: false }
        );

        for (const result of results) {
          if (result.error) {
            errors.push(result.error.message);
          } else if (result.output) {
            const outputPath = join(outDir, this.getOutputFilename(result.filePath));
            outputs.push({
              path: outputPath,
              content: result.output,
              size: Buffer.byteLength(result.output, 'utf-8')
            });
          }
        }
      } else {
        // Sequential compilation
        for (const file of filesToCompile) {
          try {
            const output = await this.compileFile(file, intents);
            const outputPath = join(outDir, this.getOutputFilename(file));
            outputs.push({
              path: outputPath,
              content: output,
              size: Buffer.byteLength(output, 'utf-8')
            });
          } catch (error) {
            errors.push(`Failed to compile ${file}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      // Apply dead code elimination if enabled
      if (this.config.dce) {
        const dceResult = this.dce.eliminate();
        warnings.push(`DCE removed ${dceResult.bytesRemoved} bytes of dead code`);
      }

      // Generate source maps if enabled
      if (this.config.sourceMaps) {
        for (const output of outputs) {
          const mapInfo = generateSourceMap(
            output.path,
            output.content.toString(),
            output.path,
            output.content.toString(),
            this.config
          );
          output.sourceMapPath = mapInfo.mapPath;
        }
      }

      // Write outputs
      for (const output of outputs) {
        writeFileSync(output.path, output.content);
        
        if (output.sourceMapPath) {
          const mapContent = generateSourceMap(
            output.path,
            output.content.toString(),
            output.path,
            output.content.toString(),
            this.config
          );
          // Source map would be written here
        }
      }

      // Perform bundle analysis if enabled
      let analysis;
      if (this.config.analyze) {
        analysis = this.analyzer.analyze(outputs, intents);
        
        // Write HTML report
        const reportPath = join(outDir, 'bundle-analysis.html');
        writeFileSync(reportPath, this.analyzer.generateHTML(analysis));
        
        // Log ASCII report
        console.log(this.analyzer.generateASCII(analysis));
      }

      // Trigger hot reload if enabled
      if (this.config.hotReload && this.hotReload) {
        this.hotReload.update(outputs.map(o => o.path));
      }

      const duration = Date.now() - startTime;
      const totalSize = outputs.reduce((sum, o) => sum + o.size, 0);

      return {
        success: errors.length === 0,
        outputs,
        duration,
        fileCount: outputs.length,
        totalSize,
        warnings,
        errors,
        analysis,
        sourceMaps: this.config.sourceMaps 
          ? outputs.map(o => ({
              sourcePath: o.path,
              outputPath: o.path,
              mapPath: o.sourceMapPath!
            }))
          : undefined
      };

    } catch (error) {
      return {
        success: false,
        outputs,
        duration: Date.now() - startTime,
        fileCount: outputs.length,
        totalSize: outputs.reduce((sum, o) => sum + o.size, 0),
        warnings,
        errors: [...errors, error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Compile a single file
   */
  private async compileFile(
    filePath: string,
    intents: Map<string, EnrichedIntent>
  ): Promise<string> {
    // Check cache
    if (this.config.incremental && this.incremental) {
      const cached = this.incremental.getCachedOutput(filePath);
      if (cached) {
        return cached.output;
      }
    }

    // Read file
    const content = readFileSync(filePath, 'utf-8');

    // Pre-parse transform
    const preParseResult = await this.transformPipeline.transformPreParse(filePath, content);
    
    // Parse intent (placeholder - would integrate with actual intent parser)
    const intent: EnrichedIntent = {
      actors: ['user'],
      features: [],
      data_flows: [],
      tech_stack_hints: [],
      constraints: {},
      raw: content
    };

    // Store intent
    const intentId = this.extractIntentId(filePath);
    intents.set(intentId, intent);

    // Post-parse transform
    const postParseResult = await this.transformPipeline.transformPostParse(
      filePath,
      preParseResult.content,
      {}, // AST placeholder
      preParseResult.sourceMap,
      intent
    );

    // Pre-compile transform
    const preCompileResult = await this.transformPipeline.transformPreCompile(
      filePath,
      postParseResult.content,
      postParseResult.sourceMap,
      intent
    );

    // Compile (placeholder)
    let output = preCompileResult.content;

    // Post-compile transform
    const postCompileResult = await this.transformPipeline.transformPostCompile(
      filePath,
      output,
      preCompileResult.sourceMap,
      intent
    );

    output = postCompileResult.content;

    // Cache result
    if (this.config.incremental && this.incremental) {
      this.incremental.storeCache(filePath, output, [], intent);
    }

    return output;
  }

  /**
   * Find intent files from entry points
   */
  private async findIntentFiles(entries: string[]): Promise<string[]> {
    const files: string[] = [];
    
    for (const entry of entries) {
      if (existsSync(entry)) {
        const stat = await import('fs').then(fs => fs.promises.stat(entry));
        if (stat.isFile()) {
          files.push(entry);
        } else if (stat.isDirectory()) {
          const pattern = join(entry, '**/*.intent');
          const found = await glob(pattern);
          files.push(...found);
        }
      }
    }

    return files;
  }

  /**
   * Get output filename for input file
   */
  private getOutputFilename(inputPath: string): string {
    const base = inputPath.replace(/\.intent$/, '').split(/[\\/]/).pop() || 'output';
    return `${base}.js`;
  }

  /**
   * Extract intent ID from file path
   */
  private extractIntentId(filePath: string): string {
    return filePath.replace(/\.intent$/, '').split(/[\\/]/).pop() || 'unknown';
  }

  /**
   * Start watch mode
   */
  async watch(
    patterns: string | string[] = ['**/*.intent'],
    onChange?: (files: string[]) => void
  ): Promise<void> {
    if (this.watcher) {
      throw new Error('Watch mode already active');
    }

    this.watcher = createWatchCompiler(this.config, this.incremental || undefined);

    this.watcher.on('compiled', (result) => {
      if (result.success && onChange) {
        onChange(result.compiledFiles);
      }
    });

    await this.watcher.start(patterns);
  }

  /**
   * Stop watch mode
   */
  async stopWatch(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop();
      this.watcher = null;
    }
  }

  /**
   * Start hot reload server
   */
  async startHotReload(): Promise<void> {
    if (this.hotReload) {
      throw new Error('Hot reload already active');
    }

    this.hotReload = createHotReloadServer(this.config);
    await this.hotReload.start();
  }

  /**
   * Stop hot reload server
   */
  async stopHotReload(): Promise<void> {
    if (this.hotReload) {
      await this.hotReload.stop();
      this.hotReload = null;
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    await this.stopWatch();
    await this.stopHotReload();

    if (this.workerPool) {
      await this.workerPool.shutdown();
    }

    if (this.incremental) {
      this.incremental.saveCache();
    }
  }

  /**
   * Get compiler statistics
   */
  getStats(): object {
    return {
      config: this.config,
      incremental: this.incremental?.getStats(),
      transforms: this.transformPipeline.getStats(),
      dce: this.dce.getStats(),
      workerPool: this.workerPool?.getStats(),
      hotReload: this.hotReload?.getStatus()
    };
  }
}

/**
 * Create enhanced compiler instance
 */
export function createCompiler(config: CompilerConfig): EnhancedCompiler {
  return new EnhancedCompiler(config);
}

/**
 * Load configuration from file
 */
export function loadConfig(configPath?: string): CompilerConfig {
  const paths = configPath 
    ? [configPath]
    : [
        './grump.compiler.config.js',
        './grump.compiler.config.ts',
        './grump.config.js'
      ];

  for (const path of paths) {
    const resolved = resolve(path);
    if (existsSync(resolved)) {
      // In a real implementation, this would require() or import() the config
      // For now, return empty config
      return {};
    }
  }

  return {};
}

/**
 * Compile with configuration
 */
export async function compile(
  entryPoints: string | string[],
  config: CompilerConfig = {}
): Promise<CompileResult> {
  const compiler = createCompiler(config);
  
  try {
    return await compiler.compile(entryPoints);
  } finally {
    await compiler.dispose();
  }
}

// Export all sub-modules
export * from './types.js';
export * from './incremental.js';
export * from './watch.js';
export * from './analyzer.js';
export * from './dce.js';
export * from './parallel.js';
export * from './transforms.js';
export * from './sourcemaps.js';
export * from './hotreload.js';

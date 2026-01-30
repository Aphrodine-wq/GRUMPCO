/**
 * Compile Command for G-Rump CLI
 * Integrates enhanced compiler features
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { existsSync } from 'fs';
import type { CompilerConfig } from '@grump/compiler-enhanced';

interface CompileOptions {
  watch?: boolean;
  analyze?: boolean;
  parallel?: boolean;
  incremental?: boolean;
  dce?: boolean;
  sourceMaps?: boolean;
  hotReload?: boolean;
  workers?: string;
  outDir?: string;
  config?: string;
  target?: string;
  minify?: boolean;
  verbose?: boolean;
}

/**
 * Execute compile command
 */
export async function execute(entryPoints: string[], options: CompileOptions): Promise<void> {
  // Load compiler dynamically
  const { createCompiler, loadConfig } = await import('@grump/compiler-enhanced');
  
  // Load configuration
  const configFile = options.config ? resolve(options.config) : undefined;
  const fileConfig: CompilerConfig = loadConfig(configFile);
  
  // Build compiler configuration from CLI options
  const config: CompilerConfig = {
    ...fileConfig,
    watch: options.watch || fileConfig.watch,
    analyze: options.analyze || fileConfig.analyze,
    parallel: options.parallel || fileConfig.parallel,
    incremental: options.incremental || fileConfig.incremental,
    dce: options.dce || fileConfig.dce,
    sourceMaps: options.sourceMaps || fileConfig.sourceMaps,
    hotReload: options.hotReload || fileConfig.hotReload,
    workers: options.workers ? parseInt(options.workers, 10) : fileConfig.workers,
    outDir: options.outDir || fileConfig.outDir || './dist',
    target: (options.target as CompilerConfig['target']) || fileConfig.target || 'es2022',
    minify: options.minify || fileConfig.minify,
  };

  // Validate entry points
  const validEntries = entryPoints.filter(entry => {
    const resolved = resolve(entry);
    if (!existsSync(resolved)) {
      console.error(chalk.red(`Error: Entry point not found: ${entry}`));
      return false;
    }
    return true;
  });

  if (validEntries.length === 0) {
    throw new Error('No valid entry points found');
  }

  // Create compiler
  const compiler = createCompiler(config);

  try {
    // Start hot reload server if requested
    if (config.hotReload) {
      console.log(chalk.blue('Starting hot reload server...'));
      await compiler.startHotReload();
      console.log(chalk.green('Hot reload server started'));
    }

    // Perform initial compilation
    console.log(chalk.blue(`Compiling ${validEntries.length} entry point(s)...`));
    if (options.verbose) {
      console.log(chalk.dim('Configuration:'), JSON.stringify(config, null, 2));
    }

    const result = await compiler.compile(validEntries);

    // Display results
    displayResults(result, options);

    if (!result.success) {
      process.exitCode = 1;
      
      if (!options.watch) {
        return;
      }
    }

    // Start watch mode if requested
    if (config.watch) {
      console.log(chalk.blue('\nStarting watch mode...'));
      console.log(chalk.dim('Press Ctrl+C to stop'));
      
      await compiler.watch(['**/*.intent', '**/*.grump'], (changedFiles) => {
        console.log(chalk.yellow(`\n[Watch] Files changed: ${changedFiles.join(', ')}`));
      });

      // Keep process alive
      await new Promise(() => {});
    }

  } catch (error) {
    console.error(chalk.red('Compilation failed:'), error instanceof Error ? error.message : String(error));
    
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    
    process.exitCode = 1;
  } finally {
    if (!config.watch) {
      await compiler.dispose();
    }
  }
}

/**
 * Display compilation results
 */
function displayResults(result: any, options: CompileOptions): void {
  console.log('');
  
  if (result.success) {
    console.log(chalk.green.bold('✓ Compilation successful'));
  } else {
    console.log(chalk.red.bold('✗ Compilation failed'));
  }

  console.log(chalk.dim('─'.repeat(50)));
  
  // Statistics
  console.log(`  Files compiled: ${chalk.cyan(result.fileCount)}`);
  console.log(`  Total size: ${chalk.cyan(formatSize(result.totalSize))}`);
  console.log(`  Duration: ${chalk.cyan(result.duration + 'ms')}`);
  
  if (result.warnings && result.warnings.length > 0) {
    console.log(`  Warnings: ${chalk.yellow(result.warnings.length)}`);
  }
  
  if (result.errors && result.errors.length > 0) {
    console.log(`  Errors: ${chalk.red(result.errors.length)}`);
  }

  // Warnings
  if (result.warnings && result.warnings.length > 0) {
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.yellow('Warnings:'));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ⚠ ${warning}`));
    }
  }

  // Errors
  if (result.errors && result.errors.length > 0) {
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.red('Errors:'));
    for (const error of result.errors) {
      console.log(chalk.red(`  ✗ ${error}`));
    }
  }

  // Bundle analysis
  if (options.analyze && result.analysis) {
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.blue('Bundle Analysis:'));
    console.log(`  Total: ${formatSize(result.analysis.totalSize)}`);
    console.log(`  Gzipped: ${formatSize(result.analysis.gzippedSize)}`);
    console.log(`  Intents: ${result.analysis.intents.length}`);
    console.log(`  Dependencies: ${result.analysis.dependencies.length}`);
    
    if (options.verbose) {
      console.log(chalk.dim('\n  Top intents by size:'));
      for (const intent of result.analysis.intents.slice(0, 5)) {
        console.log(chalk.dim(`    - ${intent.name}: ${formatSize(intent.size)} (${intent.percentage.toFixed(1)}%)`));
      }
    }
  }

  // Output files
  if (options.verbose && result.outputs && result.outputs.length > 0) {
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.blue('Output files:'));
    for (const output of result.outputs) {
      const mapInfo = output.sourceMapPath ? chalk.dim(' (+map)') : '';
      console.log(chalk.dim(`  ${output.path} ${formatSize(output.size)}${mapInfo}`));
    }
  }

  console.log(chalk.dim('─'.repeat(50)));
}

/**
 * Format size in human readable format
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Register compile command with Commander
 */
export function registerCompileCommand(program: Command): void {
  program
    .command('compile')
    .alias('c')
    .description('Compile intent files with enhanced features')
    .argument('<entry-points...>', 'Entry points to compile (files or directories)')
    .option('-w, --watch', 'Enable watch mode', false)
    .option('-a, --analyze', 'Enable bundle analysis', false)
    .option('-p, --parallel', 'Enable parallel compilation', false)
    .option('-i, --incremental', 'Enable incremental compilation', false)
    .option('--dce', 'Enable dead code elimination', false)
    .option('-s, --source-maps', 'Generate source maps', false)
    .option('--hot-reload', 'Enable hot reload server', false)
    .option('--workers <number>', 'Number of worker threads for parallel compilation')
    .option('-o, --out-dir <path>', 'Output directory', './dist')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-t, --target <target>', 'Target environment (es2020, es2022, node20)', 'es2022')
    .option('-m, --minify', 'Minify output', false)
    .option('--verbose', 'Enable verbose output', false)
    .action(async (entryPoints: string[], options: CompileOptions) => {
      try {
        await execute(entryPoints, options);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

export const compileCommand = { execute, registerCompileCommand };

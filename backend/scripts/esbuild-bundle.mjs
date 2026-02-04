/**
 * esbuild Bundle Script
 * 
 * Replaces the deprecated `pkg` bundler with esbuild for creating
 * standalone Node.js bundles.
 * 
 * Usage:
 *   node scripts/esbuild-bundle.mjs
 *   node scripts/esbuild-bundle.mjs --platform=win32 --arch=x64
 *   node scripts/esbuild-bundle.mjs --platform=linux --arch=x64
 *   node scripts/esbuild-bundle.mjs --platform=darwin --arch=x64
 */

import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const outDir = join(rootDir, 'dist-bundle');

// Parse command line arguments
const args = process.argv.slice(2);
const argMap = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [key, value] = a.slice(2).split('=');
    return [key, value || 'true'];
  })
);

const platform = argMap.platform || process.platform;
const arch = argMap.arch || process.arch;

console.log(`📦 Building for ${platform}-${arch}...`);

// Ensure output directory exists
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  if (!existsSync(src)) return;
  
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const entries = readdirSync(src);
  
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get Node.js native modules that need to be externalized
 */
const nativeModules = [
  // Core Node.js modules
  'fs', 'path', 'os', 'crypto', 'http', 'https', 'net', 'tls', 'url', 
  'stream', 'zlib', 'events', 'util', 'buffer', 'child_process', 
  'cluster', 'dgram', 'dns', 'domain', 'querystring', 'readline',
  'repl', 'tty', 'vm', 'worker_threads', 'async_hooks', 'perf_hooks',
  
  // Native addon modules (require native binaries)
  'better-sqlite3',
  
  // Optional peer dependencies
  '@opentelemetry/auto-instrumentations-node',
  
  // Modules with native bindings that can't be bundled
  'ioredis',
];

/**
 * Build configuration
 */
async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: [join(srcDir, 'index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: join(outDir, 'server.mjs'),
      sourcemap: true,
      minify: true,
      treeShaking: true,
      metafile: true,
      
      // Externalize native modules
      external: nativeModules,
      
      // Define environment variables
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      
      // Banner to handle ESM compatibility
      banner: {
        js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim(),
      },
      
      // Log level
      logLevel: 'info',
    });
    
    // Write metafile for analysis
    writeFileSync(
      join(outDir, 'meta.json'),
      JSON.stringify(result.metafile, null, 2)
    );
    
    console.log('✅ Bundle created successfully!');
    
    // Analyze bundle size
    if (result.metafile) {
      const outputs = result.metafile.outputs;
      for (const [file, info] of Object.entries(outputs)) {
        const sizeKb = (info.bytes / 1024).toFixed(2);
        const sizeMb = (info.bytes / (1024 * 1024)).toFixed(2);
        console.log(`   📄 ${basename(file)}: ${sizeMb} MB (${sizeKb} KB)`);
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

/**
 * Copy additional required files
 */
function copyAssets() {
  console.log('📁 Copying assets...');
  
  // Copy package.json (for node_modules resolution if needed)
  const pkgJson = {
    name: 'grump-backend-bundle',
    version: '1.0.0',
    type: 'module',
    main: 'server.mjs',
    scripts: {
      start: 'node server.mjs',
    },
    // List external dependencies that need to be installed
    dependencies: {
      'better-sqlite3': '^11.7.0',
      'ioredis': '^5.3.2',
    },
    optionalDependencies: {
      '@opentelemetry/auto-instrumentations-node': '^0.57.0',
    },
  };
  
  writeFileSync(
    join(outDir, 'package.json'),
    JSON.stringify(pkgJson, null, 2)
  );
  
  // Copy migrations if they exist
  const migrationsDir = join(rootDir, 'migrations');
  if (existsSync(migrationsDir)) {
    copyDir(migrationsDir, join(outDir, 'migrations'));
    console.log('   📄 Copied migrations/');
  }
  
  // Copy .env.example
  const envExample = join(rootDir, '.env.example');
  if (existsSync(envExample)) {
    copyFileSync(envExample, join(outDir, '.env.example'));
    console.log('   📄 Copied .env.example');
  }
  
  console.log('✅ Assets copied successfully!');
}

/**
 * Create launcher script for the bundle
 */
function createLauncher() {
  console.log('🚀 Creating launcher...');
  
  // Create a simple launcher script
  const launcherContent = `#!/usr/bin/env node
/**
 * G-Rump Backend Launcher
 * 
 * This script starts the bundled G-Rump backend server.
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Start the server
const server = spawn('node', [join(__dirname, 'server.mjs')], {
  stdio: 'inherit',
  env: { ...process.env },
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle signals
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
`;
  
  writeFileSync(join(outDir, 'start.mjs'), launcherContent);
  console.log('   📄 Created start.mjs');
  
  // Windows batch launcher
  const batContent = `@echo off
node "%~dp0server.mjs" %*
`;
  writeFileSync(join(outDir, 'start.bat'), batContent);
  console.log('   📄 Created start.bat');
  
  // Unix shell launcher
  const shContent = `#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/server.mjs" "$@"
`;
  writeFileSync(join(outDir, 'start.sh'), shContent);
  console.log('   📄 Created start.sh');
  
  console.log('✅ Launchers created successfully!');
}

/**
 * Create README for the bundle
 */
function createReadme() {
  const readmeContent = `# G-Rump Backend Bundle

This is a bundled version of the G-Rump backend server.

## Quick Start

### Prerequisites
- Node.js 18 or higher

### Installation

1. Install native dependencies (required):
   \`\`\`bash
   npm install
   \`\`\`

2. Copy \`.env.example\` to \`.env\` and configure your settings

3. Start the server:
   \`\`\`bash
   # Windows
   start.bat
   
   # macOS/Linux
   ./start.sh
   
   # Or directly
   node server.mjs
   \`\`\`

## Environment Variables

See \`.env.example\` for all available configuration options.

## Native Dependencies

Some dependencies require native binaries and are not bundled:
- better-sqlite3 (for local caching)
- ioredis (for Redis connection)

These are installed when you run \`npm install\`.

## Production Deployment

For production, consider:
- Using a process manager like PM2
- Setting up proper logging
- Configuring health checks
- Using a reverse proxy (nginx, caddy)

\`\`\`bash
# With PM2
pm2 start server.mjs --name grump-backend
\`\`\`
`;
  
  writeFileSync(join(outDir, 'README.md'), readmeContent);
  console.log('   📄 Created README.md');
}

// Main execution
async function main() {
  console.log('');
  console.log('🏗️  G-Rump Backend Bundler');
  console.log('='.repeat(40));
  console.log('');
  
  await build();
  copyAssets();
  createLauncher();
  createReadme();
  
  console.log('');
  console.log('='.repeat(40));
  console.log('✨ Bundle complete!');
  console.log(`   Output: ${outDir}`);
  console.log('');
  console.log('To run the bundle:');
  console.log(`   cd ${outDir}`);
  console.log('   npm install');
  console.log('   node server.mjs');
  console.log('');
}

main().catch(console.error);

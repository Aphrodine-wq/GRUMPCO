import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner, createProgressSpinner, MultiStepProgress } from '../utils/progress.js';
import { GrumpError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';

interface BuildOptions {
  watch?: boolean;
  analyze?: boolean;
  production?: boolean;
  target?: string;
  output?: string;
  clean?: boolean;
}

/**
 * Auto-detect project type and build configuration
 */
function detectProjectType(cwd: string): { type: string; buildCommand: string; configFiles: string[] } {
  const configFiles = {
    'package.json': ['npm run build', 'yarn build', 'pnpm build'],
    'Cargo.toml': ['cargo build'],
    'go.mod': ['go build'],
    'pom.xml': ['mvn package'],
    'build.gradle': ['gradle build'],
    'CMakeLists.txt': ['cmake --build build'],
    'Makefile': ['make'],
    'tsconfig.json': ['tsc', 'npx tsc'],
    'vite.config.ts': ['vite build', 'npx vite build'],
    'next.config.js': ['next build', 'npx next build'],
    'astro.config.mjs': ['astro build', 'npx astro build']
  };
  
  for (const [file, commands] of Object.entries(configFiles)) {
    if (existsSync(join(cwd, file))) {
      return { type: file.replace(/\.(json|toml|xml|txt|ts|js|mjs)$/, ''), buildCommand: commands[0], configFiles: [file] };
    }
  }
  
  return { type: 'unknown', buildCommand: '', configFiles: [] };
}

/**
 * Build the current project
 */
export async function execute(options: BuildOptions): Promise<void> {
  const cwd = process.cwd();
  const project = detectProjectType(cwd);
  
  console.log(branding.format('\n🔨 Build Project\n', 'title'));
  
  if (project.type === 'unknown') {
    console.log(chalk.hex(branding.colors.lightPurple)('No recognized project configuration found.\n'));
    
    const { buildCmd } = await askUser<{ buildCmd: string }>([{
      type: 'input',
      name: 'buildCmd',
      message: 'Enter custom build command:',
      default: 'echo "No build configured"'
    }]);
    
    project.buildCommand = buildCmd;
    project.type = 'custom';
  } else {
    console.log(chalk.hex(branding.colors.lightPurple)(`Detected project type: ${project.type}`));
    console.log(chalk.dim(`Config: ${project.configFiles.join(', ')}\n`));
  }
  
  // Clean previous build if requested
  if (options.clean) {
    await withSpinner(
      'Cleaning previous build...',
      async () => {
        return new Promise((resolve, reject) => {
          const clean = spawn('rm', ['-rf', options.output || 'dist', 'build', '.next', 'target/debug', 'target/release'], {
            cwd,
            shell: true
          });
          clean.on('close', (code) => code === 0 ? resolve(undefined) : reject(new Error(`Clean failed with code ${code}`)));
        });
      },
      'Build cleaned'
    );
  }
  
  // Execute build
  const buildEnv = {
    ...process.env,
    NODE_ENV: options.production ? 'production' : 'development',
    CI: 'true'
  };
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n⚙️  Running: ${project.buildCommand}\n`));
  
  const startTime = Date.now();
  
  await new Promise((resolve, reject) => {
    const [cmd, ...args] = project.buildCommand.split(' ');
    const build = spawn(cmd, args, {
      cwd,
      env: buildEnv,
      stdio: 'inherit',
      shell: true
    });
    
    build.on('close', (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new GrumpError(
          `Build failed with exit code ${code}`,
          'BUILD_FAILED',
          code ?? undefined,
          ['Check the error output above', 'Run with --verbose for more details', 'Ensure all dependencies are installed']
        ));
      }
    });
    
    build.on('error', (err) => {
      reject(new GrumpError(
        `Failed to execute build: ${err.message}`,
        'BUILD_ERROR',
        undefined,
        ['Ensure the build tool is installed', 'Check your PATH configuration']
      ));
    });
  });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Bundle analysis if requested
  if (options.analyze) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n📦 Bundle Analysis:\n'));
    
    const distPath = resolve(cwd, options.output || 'dist');
    if (existsSync(distPath)) {
      const { execSync } = require('child_process');
      try {
        const output = execSync(`du -sh ${distPath}/* 2>/dev/null || dir /s /-c ${distPath}`, { encoding: 'utf-8' });
        console.log(chalk.hex(branding.colors.lightPurple)(output));
      } catch {
        console.log(chalk.dim('Unable to analyze bundle size'));
      }
    }
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.status(`Build completed in ${duration}s`, 'success'));
  
  if (options.production) {
    console.log(chalk.hex(branding.colors.lightPurple)('\n🚀 Production build ready for deployment'));
    console.log(chalk.dim('Run `grump deploy` to deploy to cloud'));
  }
}

export const buildCommand = { execute };

import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner, MultiStepProgress } from '../utils/progress.js';
import { GrumpError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';

interface CloudDeployOptions {
  platform?: string;
  prod?: boolean;
  preview?: boolean;
  env?: string;
  buildDir?: string;
  skipBuild?: boolean;
}

const platforms = {
  vercel: {
    name: 'Vercel',
    command: 'vercel',
    prodFlag: '--prod',
    configFile: 'vercel.json',
    envVar: 'VERCEL_TOKEN'
  },
  netlify: {
    name: 'Netlify',
    command: 'netlify deploy',
    prodFlag: '--prod',
    configFile: 'netlify.toml',
    envVar: 'NETLIFY_AUTH_TOKEN'
  },
  railway: {
    name: 'Railway',
    command: 'railway up',
    prodFlag: '',
    configFile: 'railway.json',
    envVar: 'RAILWAY_TOKEN'
  },
  render: {
    name: 'Render',
    command: 'render deploy',
    prodFlag: '',
    configFile: 'render.yaml',
    envVar: 'RENDER_API_KEY'
  },
  fly: {
    name: 'Fly.io',
    command: 'fly deploy',
    prodFlag: '',
    configFile: 'fly.toml',
    envVar: 'FLY_API_TOKEN'
  }
};

/**
 * Detect deployment platform from config files
 */
function detectPlatform(cwd: string): string | null {
  for (const [key, platform] of Object.entries(platforms)) {
    if (existsSync(join(cwd, platform.configFile))) {
      return key;
    }
  }
  return null;
}

/**
 * Check if CLI tool is installed
 */
async function checkCLI(tool: string): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn('which', [tool], { shell: true });
    check.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Deploy to cloud platform (Vercel/Netlify/Railway/etc)
 */
export async function execute(options: CloudDeployOptions): Promise<void> {
  const cwd = process.cwd();
  
  console.log(branding.format('\n☁️  Cloud Deployment\n', 'title'));
  
  // Detect or select platform
  let platform = options.platform || detectPlatform(cwd);
  
  if (!platform) {
    const { selected } = await askUser<{ selected: string }>([{
      type: 'list',
      name: 'selected',
      message: 'Select deployment platform:',
      choices: Object.entries(platforms).map(([key, p]) => ({
        name: `${p.name} ${existsSync(join(cwd, p.configFile)) ? '(detected)' : ''}`,
        value: key
      }))
    }]);
    platform = selected;
  }
  
  const platformConfig = platforms[platform as keyof typeof platforms];
  if (!platformConfig) {
    throw new GrumpError(`Unknown platform: ${platform}`, 'INVALID_PLATFORM');
  }
  
  console.log(chalk.hex(branding.colors.lightPurple)(`Platform: ${platformConfig.name}\n`));
  
  // Check if CLI is installed
  const cliInstalled = await checkCLI(platformConfig.command.split(' ')[0]);
  if (!cliInstalled) {
    console.log(chalk.hex(branding.colors.mediumPurple)(`⚠️  ${platformConfig.name} CLI not found\n`));
    
    const { install } = await askUser<{ install: boolean }>([{
      type: 'confirm',
      name: 'install',
      message: `Install ${platformConfig.name} CLI?`,
      default: true
    }]);
    
    if (install) {
      await withSpinner(
        `Installing ${platformConfig.name} CLI...`,
        async () => {
          return new Promise((resolve, reject) => {
            const installCmd = platform === 'vercel' 
              ? 'npm i -g vercel'
              : platform === 'netlify'
              ? 'npm i -g netlify-cli'
              : platform === 'railway'
              ? 'npm i -g @railway/cli'
              : platform === 'fly'
              ? 'curl -L https://fly.io/install.sh | sh'
              : `npm i -g ${platform}-cli`;
            
            const install = spawn(installCmd, { shell: true, stdio: 'inherit' });
            install.on('close', (code) => code === 0 ? resolve(undefined) : reject(new Error('Installation failed')));
          });
        },
        'CLI installed'
      );
    } else {
      throw new GrumpError(
        `${platformConfig.name} CLI is required`,
        'CLI_MISSING',
        undefined,
        [`Install with: npm i -g ${platform}-cli`]
      );
    }
  }
  
  // Check authentication
  if (!process.env[platformConfig.envVar]) {
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n🔐 Authentication required\n`));
    
    await new Promise((resolve, reject) => {
      const login = spawn(platformConfig.command.split(' ')[0], ['login'], {
        cwd,
        stdio: 'inherit',
        shell: true
      });
      login.on('close', (code) => code === 0 ? resolve(undefined) : reject(new Error('Login failed')));
    });
  }
  
  // Build if needed
  if (!options.skipBuild) {
    const buildExists = existsSync(resolve(cwd, options.buildDir || 'dist')) ||
                       existsSync(resolve(cwd, 'build')) ||
                       existsSync(resolve(cwd, '.next'));
    
    if (!buildExists) {
      console.log(chalk.hex(branding.colors.mediumPurple)('📦 No build found. Building first...\n'));
      
      const { buildCommand } = await import('./build.js');
      await buildCommand.execute({ production: true });
    }
  }
  
  // Deploy
  console.log(chalk.hex(branding.colors.mediumPurple)(`\n🚀 Deploying to ${platformConfig.name}...\n`));
  
  const deployFlags: string[] = [];
  if (options.prod || options.preview === false) {
    deployFlags.push(platformConfig.prodFlag);
  }
  if (options.buildDir) {
    deployFlags.push('--dir', options.buildDir);
  }
  if (options.env) {
    deployFlags.push('--env', options.env);
  }
  
  const deployCmd = `${platformConfig.command} ${deployFlags.filter(Boolean).join(' ')}`.trim();
  console.log(chalk.dim(`Running: ${deployCmd}\n`));
  
  const startTime = Date.now();
  
  await new Promise((resolve, reject) => {
    const [cmd, ...baseArgs] = deployCmd.split(' ');
    const deploy = spawn(cmd, [...baseArgs, ...deployFlags.filter(Boolean)], {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        [platformConfig.envVar]: process.env[platformConfig.envVar]
      }
    });
    
    deploy.on('close', (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new GrumpError(
          `Deployment failed with code ${code}`,
          'DEPLOY_FAILED',
          code ?? undefined,
          ['Check the error output above', 'Verify your authentication token', 'Check platform status page']
        ));
      }
    });
  });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n' + branding.getDivider());
  console.log(branding.status(`Deployed to ${platformConfig.name} in ${duration}s`, 'success'));
  
  if (options.prod) {
    console.log(chalk.hex(branding.colors.lightPurple)('\n✨ Production deployment complete!'));
  } else {
    console.log(chalk.hex(branding.colors.lightPurple)('\n🔗 Preview deployment ready'));
  }
}

export const cloudDeployCommand = { execute };

import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner } from '../utils/progress.js';
import { GrumpError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';

interface FormatOptions {
  write?: boolean;
  check?: boolean;
  file?: string;
  pattern?: string;
  cache?: boolean;
}

/**
 * Detect available formatters
 */
function detectFormatters(cwd: string): Array<{ name: string; command: string; configFiles: string[]; defaultPattern: string }> {
  const formatters = [];
  
  const checks = [
    { 
      name: 'Prettier', 
      command: 'prettier', 
      configFiles: ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js'],
      defaultPattern: 'src/**/*.{js,ts,jsx,tsx,json,css,md}'
    },
    { 
      name: 'Biome', 
      command: 'biome format', 
      configFiles: ['biome.json'],
      defaultPattern: 'src/**/*'
    },
    { 
      name: 'Deno', 
      command: 'deno fmt', 
      configFiles: ['deno.json'],
      defaultPattern: 'src/**/*'
    },
    { 
      name: 'Rustfmt', 
      command: 'cargo fmt', 
      configFiles: ['rustfmt.toml', '.rustfmt.toml'],
      defaultPattern: 'src/**/*.rs'
    },
    { 
      name: 'Go fmt', 
      command: 'gofmt', 
      configFiles: ['go.mod'],
      defaultPattern: '**/*.go'
    },
    { 
      name: 'Black', 
      command: 'black', 
      configFiles: ['pyproject.toml', '.black'],
      defaultPattern: '**/*.py'
    }
  ];
  
  for (const check of checks) {
    for (const configFile of check.configFiles) {
      if (existsSync(join(cwd, configFile))) {
        formatters.push({ 
          name: check.name, 
          command: check.command, 
          configFiles: check.configFiles,
          defaultPattern: check.defaultPattern
        });
        break;
      }
    }
  }
  
  return formatters;
}

/**
 * Check if formatter is installed
 */
async function checkFormatter(command: string): Promise<boolean> {
  const cmd = command.split(' ')[0];
  return new Promise((resolve) => {
    const check = process.platform === 'win32' 
      ? spawn('where', [cmd], { shell: true })
      : spawn('which', [cmd], { shell: true });
    check.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Format code
 */
export async function execute(options: FormatOptions): Promise<void> {
  const cwd = process.cwd();
  let formatters = detectFormatters(cwd);
  
  console.log(branding.format('\n✨ Code Formatter\n', 'title'));
  
  // If no formatter config found, check for installed formatters
  if (formatters.length === 0) {
    const availableFormatters = [];
    
    if (await checkFormatter('prettier')) availableFormatters.push('Prettier');
    if (await checkFormatter('biome')) availableFormatters.push('Biome');
    if (await checkFormatter('deno')) availableFormatters.push('Deno');
    if (await checkFormatter('cargo')) availableFormatters.push('Rustfmt');
    if (await checkFormatter('gofmt')) availableFormatters.push('Go fmt');
    if (await checkFormatter('black')) availableFormatters.push('Black');
    
    if (availableFormatters.length > 0) {
      console.log(chalk.hex(branding.colors.lightPurple)(`Available formatters: ${availableFormatters.join(', ')}\n`));
      
      const { selected } = await askUser<{ selected: string }>([{
        type: 'list',
        name: 'selected',
        message: 'Select formatter to use:',
        choices: availableFormatters.map(f => ({ name: f, value: f.toLowerCase().replace(' ', '-') }))
      }]);
      
      // Set up basic config for selected formatter
      if (selected === 'prettier') {
        writeFileSync(join(cwd, '.prettierrc'), JSON.stringify({
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'es5'
        }, null, 2));
      } else if (selected === 'biome') {
        writeFileSync(join(cwd, 'biome.json'), JSON.stringify({
          formatter: {
            enabled: true,
            indentStyle: 'tab',
            lineWidth: 80
          }
        }, null, 2));
      }
      
      // Re-detect
      formatters = detectFormatters(cwd);
    } else {
      console.log(chalk.hex(branding.colors.lightPurple)('No formatters detected.\n'));
      
      const { setup } = await askUser<{ setup: boolean }>([{
        type: 'confirm',
        name: 'setup',
        message: 'Install Prettier (recommended)?',
        default: true
      }]);
      
      if (setup) {
        await withSpinner(
          'Installing Prettier...',
          async () => {
            return new Promise((resolve, reject) => {
              const install = spawn('npm', ['install', '-D', 'prettier'], {
                cwd,
                stdio: 'inherit'
              });
              install.on('close', (code) => code === 0 ? resolve(undefined) : reject(new Error('Install failed')));
            });
          },
          'Prettier installed'
        );
        
        // Create config
        writeFileSync(join(cwd, '.prettierrc'), JSON.stringify({
          semi: true,
          singleQuote: true,
          tabWidth: 2
        }, null, 2));
        
        formatters = [{ 
          name: 'Prettier', 
          command: 'prettier', 
          configFiles: ['.prettierrc'],
          defaultPattern: 'src/**/*.{js,ts,jsx,tsx,json,css,md}'
        }];
      } else {
        console.log(branding.status('Formatting skipped', 'info'));
        return;
      }
    }
  }
  
  console.log(chalk.hex(branding.colors.lightPurple)(`Formatter: ${formatters.map(f => f.name).join(', ')}\n`));
  
  // Determine files to format
  const files = options.file || options.pattern || formatters[0].defaultPattern;
  const mode = options.check ? '--check' : '--write';
  
  console.log(chalk.hex(branding.colors.mediumPurple)(`${options.check ? 'Checking' : 'Formatting'}: ${files}\n`));
  
  // Run formatters
  const results: Array<{ formatter: string; success: boolean; duration: string }> = [];
  
  for (const formatter of formatters) {
    console.log(chalk.hex(branding.colors.mediumPurple)(`Running ${formatter.name}...`));
    
    const args: string[] = [];
    if (formatter.name === 'Prettier') {
      args.push(mode);
      if (options.cache) args.push('--cache');
      args.push(files);
    } else if (formatter.name === 'Biome') {
      args.push(mode === '--check' ? '--check' : '--write');
      args.push(files);
    } else if (formatter.name === 'Rustfmt') {
      args.push(mode === '--check' ? '-- --check' : '');
    } else if (formatter.name === 'Black') {
      args.push(mode === '--check' ? '--check' : '');
      args.push(files);
    } else {
      args.push(files);
    }
    
    const startTime = Date.now();
    
    await new Promise((resolve, reject) => {
      const [cmd, ...baseArgs] = formatter.command.split(' ');
      const format = spawn(cmd, [...baseArgs, ...args.filter(Boolean)], {
        cwd,
        stdio: 'inherit',
        shell: true
      });
      
      format.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        results.push({
          formatter: formatter.name,
          success: code === 0,
          duration
        });
        
        if (code === 0) {
          resolve(undefined);
        } else {
          // Format check failed or partial failure
          resolve(undefined); // Don't reject, just record
        }
      });
    });
  }
  
  // Summary
  console.log('\n' + branding.getDivider());
  
  const allSuccess = results.every(r => r.success);
  
  if (allSuccess) {
    if (options.check) {
      console.log(branding.status('All files are properly formatted!', 'success'));
    } else {
      console.log(branding.status('Formatting complete!', 'success'));
      console.log(chalk.dim(`\n${results.length} formatter(s) applied`));
    }
  } else {
    const failed = results.filter(r => !r.success);
    if (options.check) {
      console.log(branding.status(`${failed.length} formatter(s) found unformatted files`, 'warning'));
      console.log(chalk.dim('\nRun `grump format --write` to fix formatting issues'));
      throw new GrumpError('Formatting check failed', 'FORMAT_CHECK_FAILED');
    } else {
      console.log(branding.status('Some formatters had issues', 'warning'));
    }
  }
}

export const formatCommand = { execute };

import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { prompt as askUser } from '../utils/prompt.js';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { GrumpError } from '../utils/errors.js';

interface InitOptions {
  force: boolean;
  global: boolean;
  interactive: boolean;
}

/**
 * Initialize project configuration
 */
export async function execute(options: InitOptions): Promise<void> {
  console.log(branding.getLogo('compact'));
  console.log(branding.format('Initializing G-Rump configuration...', 'subtitle'));
  
  const configPath = await config.init(options.global, options.force);
  
  if (options.interactive) {
    await interactiveSetup(configPath);
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.status(`Configuration created at: ${configPath}`, 'success'));
  
  if (!options.global) {
    console.log(chalk.dim('\nNext steps:'));
    console.log(chalk.dim('  1. Edit .grumprc to customize your settings'));
    console.log(chalk.dim('  2. Run `grump auth login` to authenticate'));
    console.log(chalk.dim('  3. Run `grump ship "Your project description"` to get started'));
  }
}

/**
 * Interactive configuration setup
 */
async function interactiveSetup(configPath: string): Promise<void> {
  console.log('\n' + chalk.hex('#F7931E')('Let\'s configure G-Rump:'));
  
  const answers = await askUser<{ apiUrl: string; apiKey: string; theme: string; defaultOutputDir: string; autoStream: boolean; progressIndicators: boolean }>([
    {
      type: 'input',
      name: 'apiUrl',
      message: 'API URL:',
      default: 'http://localhost:3000'
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key (leave blank to configure later):',
      default: ''
    },
    {
      type: 'list',
      name: 'theme',
      message: 'Choose a theme:',
      choices: [
        { name: 'Dark (default)', value: 'dark' },
        { name: 'Light', value: 'light' },
        { name: 'Minimal', value: 'minimal' },
        { name: 'Grumpy (extra red!)', value: 'grumpy' }
      ],
      default: 'dark'
    },
    {
      type: 'input',
      name: 'defaultOutputDir',
      message: 'Default output directory:',
      default: './output'
    },
    {
      type: 'confirm',
      name: 'autoStream',
      message: 'Enable streaming by default?',
      default: false
    },
    {
      type: 'confirm',
      name: 'progressIndicators',
      message: 'Enable progress indicators?',
      default: true
    }
  ]);
  
  // Build configuration object
  const configuration = {
    apiUrl: answers.apiUrl,
    apiKey: answers.apiKey || null,
    theme: answers.theme,
    defaultOutputDir: answers.defaultOutputDir,
    colors: {
      primary: '#FF6B35',
      secondary: '#F7931E',
      error: '#FF4136'
    },
    features: {
      autoStream: answers.autoStream,
      cacheEnabled: true,
      progressIndicators: answers.progressIndicators
    }
  };
  
  // Write configuration
  writeFileSync(configPath, JSON.stringify(configuration, null, 2));
  
  console.log('\n' + branding.status('Configuration saved!', 'success'));
}

export const initCommand = { execute };

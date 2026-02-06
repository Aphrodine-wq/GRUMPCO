import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { prompt as askUser } from '../utils/prompt.js';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { GrumpError } from '../utils/errors.js';
import { runWizard, shouldShowWizard, type WizardOptions } from '../wizard/index.js';

interface InitOptions {
  force?: boolean;
  global?: boolean;
  interactive?: boolean;
  template?: string;
  quick?: boolean;
  wizard?: boolean;
}

const TEMPLATES: Record<string, { desc: string; files: string[] }> = {
  'react-app': { desc: 'React + Vite + TailwindCSS', files: [] },
  'svelte-app': { desc: 'SvelteKit + TailwindCSS', files: [] },
  'express-api': { desc: 'Express + TypeScript + Prisma', files: [] },
  'cli-tool': { desc: 'Commander.js + TypeScript', files: [] },
};

/**
 * Initialize project configuration (or create from template).
 * Commander passes (projectDir?, options).
 */
export async function execute(projectDir?: string, options?: InitOptions): Promise<void> {
  const opts = options ?? {};

  // Handle template creation
  if (opts.template) {
    const t = TEMPLATES[opts.template];
    if (!t) {
      console.log(chalk.yellow('Available templates: ' + Object.keys(TEMPLATES).join(', ')));
      return;
    }
    const dir = projectDir || opts.template;
    console.log(branding.format(`Template: ${opts.template} (${t.desc})`, 'subtitle'));
    console.log(chalk.dim(`Project dir: ${dir}. Run \`mkdir -p ${dir} && cd ${dir}\` then \`grump init\` for config.`));
    return;
  }

  // Check if we should run the new wizard
  const runNewWizard = opts.wizard || (opts.interactive !== false && shouldShowWizard());

  if (runNewWizard) {
    // Run the comprehensive first-run wizard
    const wizardOpts: WizardOptions = {
      quick: opts.quick,
      skipSystemCheck: false,
      skipAuth: false,
      skipTechStack: opts.quick
    };

    const result = await runWizard(wizardOpts);

    if (result.success) {
      // Wizard handles everything, including showing next steps
      return;
    } else if (result.skipped) {
      // User cancelled - offer simple setup
      console.log();
      const { useSimple } = await askUser<{ useSimple: boolean }>([{
        type: 'confirm',
        name: 'useSimple',
        message: 'Would you like to do a quick setup instead?',
        default: true
      }]);

      if (!useSimple) {
        return;
      }
      // Fall through to legacy setup
    }
  }

  // Legacy/simple setup flow
  console.log(branding.getLogo('compact'));
  console.log(branding.format('Initializing G-Rump configuration...', 'subtitle'));

  const configPath = await config.init(opts.global ?? false, opts.force ?? false);

  if (opts.interactive !== false) {
    await legacyInteractiveSetup(configPath);
  }

  console.log('\n' + branding.getDivider());
  console.log(branding.status(`Configuration created at: ${configPath}`, 'success'));

  if (!opts.global) {
    console.log(chalk.dim('\nNext steps:'));
    console.log(chalk.dim('  1. Edit .grumprc to customize your settings'));
    console.log(chalk.dim('  2. Run `grump auth login` to authenticate'));
    console.log(chalk.dim('  3. Run `grump ship "Your project description"` to get started'));
  }
}

/**
 * Legacy interactive setup (simplified version for --no-wizard).
 */
async function legacyInteractiveSetup(configPath: string): Promise<void> {
  console.log('\n' + chalk.hex('#A855F7')('Welcome to G-Rump! Let\'s get you set up.\n'));

  const projectType = await askUser<{ projectType: string }>([
    {
      type: 'list',
      name: 'projectType',
      message: 'What type of project are you building?',
      choices: [
        { name: 'Web Application', value: 'web' },
        { name: 'Mobile App', value: 'mobile' },
        { name: 'API / Backend', value: 'api' },
        { name: 'CLI Tool', value: 'cli' },
        { name: 'Other', value: 'other' },
      ],
      default: 'web',
    },
  ]);

  const providers = await askUser<{ providers: string[] }>([
    {
      type: 'checkbox',
      name: 'providers',
      message: 'Select your preferred AI providers (space to toggle):',
      choices: [
        { name: '🌙 Kimi K2.5 (Recommended)', value: 'kimi', checked: true },
        { name: '🟢 NVIDIA NIM', value: 'nim', checked: false },
        { name: '🔀 OpenRouter', value: 'openrouter', checked: true },
        { name: '⚡ Groq', value: 'groq', checked: false },
        { name: '🦙 Ollama (local)', value: 'ollama', checked: false },
      ],
    },
  ]);

  console.log(chalk.dim('\nTesting API connection...'));
  
  const answers = await askUser<{ apiUrl: string; apiKey: string; theme: string; defaultOutputDir: string; autoStream: boolean; progressIndicators: boolean }>([
    {
      type: 'input',
      name: 'apiUrl',
      message: 'API URL:',
      default: 'https://grump-backend.onrender.com'
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'AI Provider API key (leave blank to configure later):',
      mask: '*'
    },
    {
      type: 'list',
      name: 'theme',
      message: 'Choose a theme:',
      choices: [
        { name: '🌙 Dark (default)', value: 'dark' },
        { name: '☀️  Light', value: 'light' },
        { name: '⬜ Minimal', value: 'minimal' },
        { name: '💜 Grumpy (extra purple!)', value: 'grumpy' }
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
    projectType: projectType.projectType,
    preferredProviders: providers.providers,
    colors: {
      primary: '#6B46C1',
      secondary: '#8B5CF6',
      error: '#EF4444'
    },
    features: {
      autoStream: answers.autoStream,
      cacheEnabled: true,
      progressIndicators: answers.progressIndicators,
      wizardComplete: true
    }
  };
  
  // Write configuration
  writeFileSync(configPath, JSON.stringify(configuration, null, 2));

  // Test API connection if URL and key provided
  if (answers.apiUrl && answers.apiKey) {
    try {
      const res = await fetch(`${answers.apiUrl.replace(/\/$/, '')}/health/quick`, { method: 'GET' });
      const data = (await res.json()) as { status?: string };
      if (data?.status === 'healthy') {
        console.log(branding.status('API connection: OK', 'success'));
      } else {
        console.log(chalk.yellow('API health check returned: ' + (data?.status ?? res.status)));
      }
    } catch {
      console.log(chalk.yellow('Could not reach API. Start backend with npm run dev or check API URL.'));
    }
  }

  console.log('\n' + branding.status('Configuration saved!', 'success'));
  console.log(chalk.dim('\nNext: Run `grump ship "Your project description"` to get started.'));
}

export const initCommand = { execute };

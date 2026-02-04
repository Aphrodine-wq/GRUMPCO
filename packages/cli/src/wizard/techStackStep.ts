/**
 * Tech Stack Selection Step for G-Rump CLI Wizard
 */

import chalk from 'chalk';
import { prompt as askUser } from '../utils/prompt.js';
import { branding } from '../branding.js';

export interface TechStackResult {
  frontend: string[];
  backendLanguage: string[];
  backendFramework: string[];
  database: string[];
  cloud: string[];
  infrastructure: string[];
  gitProvider: string[];
  ide: string[];
}

interface TechOption {
  name: string;
  value: string;
  popular?: boolean;
}

const FRONTEND_OPTIONS: TechOption[] = [
  { name: '⚛️  React', value: 'react', popular: true },
  { name: '▲  Next.js', value: 'nextjs', popular: true },
  { name: '💚 Vue', value: 'vue' },
  { name: '💚 Nuxt', value: 'nuxt' },
  { name: '🔥 Svelte', value: 'svelte', popular: true },
  { name: '🔥 SvelteKit', value: 'sveltekit' },
  { name: '🅰️  Angular', value: 'angular' },
  { name: '🚀 Astro', value: 'astro' },
  { name: '💿 Remix', value: 'remix' },
  { name: '📜 Vanilla JS', value: 'vanilla' },
  { name: '❌ No frontend', value: 'none' }
];

const BACKEND_LANGUAGE_OPTIONS: TechOption[] = [
  { name: '🔷 TypeScript', value: 'typescript', popular: true },
  { name: '🟨 JavaScript', value: 'javascript', popular: true },
  { name: '🐍 Python', value: 'python', popular: true },
  { name: '🐹 Go', value: 'go' },
  { name: '🦀 Rust', value: 'rust' },
  { name: '☕ Java', value: 'java' },
  { name: '🔵 C#', value: 'csharp' },
  { name: '💎 Ruby', value: 'ruby' },
  { name: '🐘 PHP', value: 'php' },
  { name: '❌ No backend', value: 'none' }
];

const BACKEND_FRAMEWORK_OPTIONS: TechOption[] = [
  { name: '🚂 Express', value: 'express', popular: true },
  { name: '⚡ Fastify', value: 'fastify' },
  { name: '🐱 NestJS', value: 'nestjs' },
  { name: '🔥 Hono', value: 'hono' },
  { name: '🐍 FastAPI', value: 'fastapi', popular: true },
  { name: '🎸 Django', value: 'django' },
  { name: '🍶 Flask', value: 'flask' },
  { name: '🍃 Spring Boot', value: 'spring' },
  { name: '🛤️  Rails', value: 'rails' },
  { name: '❌ None / Custom', value: 'none' }
];

const DATABASE_OPTIONS: TechOption[] = [
  { name: '🐘 PostgreSQL', value: 'postgresql', popular: true },
  { name: '🍃 MongoDB', value: 'mongodb', popular: true },
  { name: '🐬 MySQL', value: 'mysql' },
  { name: '📦 SQLite', value: 'sqlite' },
  { name: '🔴 Redis', value: 'redis' },
  { name: '⚡ Supabase', value: 'supabase', popular: true },
  { name: '🔥 Firebase', value: 'firebase' },
  { name: '🌍 PlanetScale', value: 'planetscale' },
  { name: '❌ No database', value: 'none' }
];

const CLOUD_OPTIONS: TechOption[] = [
  { name: '▲  Vercel', value: 'vercel', popular: true },
  { name: '🚂 Railway', value: 'railway', popular: true },
  { name: '🌐 Netlify', value: 'netlify' },
  { name: '✈️  Fly.io', value: 'fly' },
  { name: '☁️  AWS', value: 'aws' },
  { name: '🌈 Google Cloud', value: 'gcp' },
  { name: '🔵 Azure', value: 'azure' },
  { name: '🏠 Self-hosted', value: 'self-hosted' }
];

const INFRA_OPTIONS: TechOption[] = [
  { name: '🐳 Docker', value: 'docker', popular: true },
  { name: '☸️  Kubernetes', value: 'kubernetes' },
  { name: '🔄 GitHub Actions', value: 'github-actions', popular: true },
  { name: '🦊 GitLab CI', value: 'gitlab-ci' },
  { name: '🏗️  Terraform', value: 'terraform' },
  { name: '❌ None yet', value: 'none' }
];

const GIT_OPTIONS: TechOption[] = [
  { name: '🐙 GitHub', value: 'github', popular: true },
  { name: '🦊 GitLab', value: 'gitlab' },
  { name: '🪣 Bitbucket', value: 'bitbucket' },
  { name: '📦 Other', value: 'other' }
];

const IDE_OPTIONS: TechOption[] = [
  { name: '💙 VS Code', value: 'vscode', popular: true },
  { name: '🔮 Cursor', value: 'cursor', popular: true },
  { name: '🌊 Windsurf', value: 'windsurf' },
  { name: '🧠 IntelliJ IDEA', value: 'intellij' },
  { name: '🟢 Vim/Neovim', value: 'vim' },
  { name: '⚡ Zed', value: 'zed' },
  { name: '📝 Other', value: 'other' }
];

/**
 * Format choices with popular badges
 */
function formatChoices(options: TechOption[]): { name: string; value: string; checked?: boolean }[] {
  return options.map(opt => ({
    name: opt.popular ? `${opt.name} ${chalk.hex('#A855F7')('★')}` : opt.name,
    value: opt.value,
    checked: opt.popular
  }));
}

/**
 * Run tech stack selection step
 */
export async function runTechStackStep(): Promise<TechStackResult> {
  console.log(chalk.white('  Tell us about your tech preferences.\n'));
  console.log(chalk.dim('  (Use spacebar to select, enter to continue)\n'));

  // Frontend
  const { frontend } = await askUser<{ frontend: string[] }>([{
    type: 'checkbox',
    name: 'frontend',
    message: 'Frontend frameworks you use:',
    choices: formatChoices(FRONTEND_OPTIONS)
  }]);

  // Backend Language
  const { backendLanguage } = await askUser<{ backendLanguage: string[] }>([{
    type: 'checkbox',
    name: 'backendLanguage',
    message: 'Backend languages:',
    choices: formatChoices(BACKEND_LANGUAGE_OPTIONS)
  }]);

  // Backend Framework (if backend language selected)
  let backendFramework: string[] = [];
  if (backendLanguage.length > 0 && !backendLanguage.includes('none')) {
    const result = await askUser<{ backendFramework: string[] }>([{
      type: 'checkbox',
      name: 'backendFramework',
      message: 'Backend frameworks:',
      choices: formatChoices(BACKEND_FRAMEWORK_OPTIONS)
    }]);
    backendFramework = result.backendFramework;
  }

  // Database
  const { database } = await askUser<{ database: string[] }>([{
    type: 'checkbox',
    name: 'database',
    message: 'Databases:',
    choices: formatChoices(DATABASE_OPTIONS)
  }]);

  // Cloud/Hosting
  const { cloud } = await askUser<{ cloud: string[] }>([{
    type: 'checkbox',
    name: 'cloud',
    message: 'Cloud/Hosting:',
    choices: formatChoices(CLOUD_OPTIONS)
  }]);

  // Infrastructure
  const { infrastructure } = await askUser<{ infrastructure: string[] }>([{
    type: 'checkbox',
    name: 'infrastructure',
    message: 'Infrastructure tools:',
    choices: formatChoices(INFRA_OPTIONS)
  }]);

  // Git Provider
  const { gitProvider } = await askUser<{ gitProvider: string[] }>([{
    type: 'checkbox',
    name: 'gitProvider',
    message: 'Git provider:',
    choices: formatChoices(GIT_OPTIONS)
  }]);

  // IDE
  const { ide } = await askUser<{ ide: string[] }>([{
    type: 'checkbox',
    name: 'ide',
    message: 'IDE/Editor:',
    choices: formatChoices(IDE_OPTIONS)
  }]);

  console.log();
  console.log(branding.status('Tech preferences saved!', 'success'));

  return {
    frontend,
    backendLanguage,
    backendFramework,
    database,
    cloud,
    infrastructure,
    gitProvider,
    ide
  };
}

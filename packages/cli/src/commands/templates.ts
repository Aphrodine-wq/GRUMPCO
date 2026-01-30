import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner, createProgressSpinner } from '../utils/progress.js';
import { GrumpError, handleApiError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';

interface TemplatesOptions {
  list?: boolean;
  use?: string;
  output?: string;
  search?: string;
  category?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  downloads?: number;
  rating?: number;
  author?: string;
  files?: Array<{ path: string; content: string }>;
  setupCommands?: string[];
  version?: string;
  prdSnippet?: string;
  createdAt?: string;
}

const defaultCategories = [
  { id: 'web', name: 'Web Applications', icon: '🌐' },
  { id: 'api', name: 'API Services', icon: '🔌' },
  { id: 'cli', name: 'CLI Tools', icon: '⌨️' },
  { id: 'library', name: 'Libraries', icon: '📚' },
  { id: 'mobile', name: 'Mobile Apps', icon: '📱' },
  { id: 'desktop', name: 'Desktop Apps', icon: '💻' },
  { id: 'starter', name: 'Starter Templates', icon: '🚀' },
  { id: 'fullstack', name: 'Full Stack', icon: '⚡' }
];

/**
 * List and use project templates
 */
export async function execute(options: TemplatesOptions): Promise<void> {
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  
  console.log(branding.format('\n📋 Project Templates\n', 'title'));
  
  // Show categories
  if (!options.category && !options.search && !options.use) {
    console.log(chalk.hex(branding.colors.mediumPurple)('Categories:\n'));
    
    for (const cat of defaultCategories) {
      console.log(chalk.hex(branding.colors.lightPurple)(`  ${cat.icon} ${cat.name}`));
    }
    
    console.log('');
  }
  
  // Search or list templates
  let templates: Template[] = [];
  
  try {
    const queryParams = new URLSearchParams();
    if (options.category) queryParams.append('category', options.category);
    if (options.search) queryParams.append('search', options.search);
    
    const response = await fetch(`${apiUrl}/api/templates?${queryParams}`, {
      headers
    });
    
    if (response.ok) {
      const data = await response.json() as { templates: Template[] };
      templates = data.templates;
    } else {
      // Fallback to mock templates if API fails
      templates = getMockTemplates(options.category, options.search);
    }
  } catch {
    // Use mock templates
    templates = getMockTemplates(options.category, options.search);
  }
  
  // List templates
  if (options.list || (!options.use && templates.length > 0)) {
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n📦 Available Templates (${templates.length}):\n`));
    
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const num = chalk.dim(`${(i + 1).toString().padStart(2)}.`);
      const name = chalk.hex(branding.colors.lightPurple).bold(t.name);
      const ratingVal = t.rating ?? 0;
      const rating = '★'.repeat(Math.floor(ratingVal)) + '☆'.repeat(5 - Math.floor(ratingVal));
      
      console.log(`${num} ${name} ${t.rating !== undefined ? chalk.hex('#F7931E')(rating) : ''}`);
      console.log(chalk.dim(`    ${t.description}`));
      
      const tags = t.tags?.join(', ') ?? 'none';
      const downloads = t.downloads !== undefined ? `${t.downloads.toLocaleString()} downloads` : '';
      const author = t.author ?? 'unknown';
      const metaItems = [tags && `Tags: ${tags}`, downloads, `by ${author}`].filter(Boolean).join('  •  ');
      console.log(chalk.dim(`    ${metaItems}`));
      console.log('');
    }
  }
  
  // Use a template
  if (options.use) {
    const template = templates.find(t => t.id === options.use || t.name.toLowerCase() === options.use?.toLowerCase());
    
    if (!template && templates.length > 0) {
      // Interactive selection
      const { selected } = await askUser<{ selected: string }>([{
        type: 'list',
        name: 'selected',
        message: 'Select a template:',
        choices: templates.map(t => ({
          name: `${t.name} - ${t.description}`,
          value: t.id
        }))
      }]);
      
      options.use = selected;
      return execute(options);
    }
    
    if (!template) {
      throw new GrumpError(
        `Template "${options.use}" not found`,
        'TEMPLATE_NOT_FOUND',
        undefined,
        ['Run `grump templates --list` to see available templates', 'Use a different template name']
      );
    }
    
    const outputDir = options.output ? resolve(options.output) : process.cwd();
    
    console.log(chalk.hex(branding.colors.mediumPurple)(`\n🚀 Using template: ${template.name}\n`));
    
    // Confirm if directory not empty
    if (existsSync(outputDir) && readdirSync(outputDir).length > 0) {
      const { confirm } = await askUser<{ confirm: boolean }>([{
        type: 'confirm',
        name: 'confirm',
        message: `Directory ${outputDir} is not empty. Continue?`,
        default: false
      }]);
      
      if (!confirm) {
        console.log(branding.status('Cancelled', 'info'));
        return;
      }
    }
    
    // Create files
    console.log(chalk.hex(branding.colors.mediumPurple)('📁 Creating project files:\n'));
    
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    const templateFiles = template.files ?? [];
    
    if (templateFiles.length === 0) {
      console.log(chalk.yellow('  No files in this template. You may need to set up the project manually.'));
    } else {
      const progress = createProgressSpinner('Creating files...', templateFiles.length);
      progress.start();
      
      for (let i = 0; i < templateFiles.length; i++) {
        const file = templateFiles[i];
        const filePath = join(outputDir, file.path);
        const fileDir = resolve(filePath, '..');
        
        if (!existsSync(fileDir)) {
          mkdirSync(fileDir, { recursive: true });
        }
        
        writeFileSync(filePath, file.content);
        progress.update(file.path, i + 1);
      }
      
      progress.succeed(`Created ${templateFiles.length} files`);
    }
    
    // Run setup commands
    if (template.setupCommands && template.setupCommands.length > 0) {
      console.log(chalk.hex(branding.colors.mediumPurple)('\n⚙️  Running setup commands:\n'));
      
      for (const cmd of template.setupCommands) {
        console.log(chalk.dim(`  $ ${cmd}`));
        
        await new Promise((resolve, reject) => {
          const [command, ...args] = cmd.split(' ');
          const proc = spawn(command, args, {
            cwd: outputDir,
            stdio: 'inherit',
            shell: true
          });
          
          proc.on('close', (code) => {
            if (code === 0) {
              resolve(undefined);
            } else {
              reject(new Error(`Command failed: ${cmd}`));
            }
          });
        });
      }
    }
    
    // Save template info
    writeFileSync(join(outputDir, '.grump-template'), JSON.stringify({
      id: template.id,
      name: template.name,
      created: new Date().toISOString()
    }, null, 2));
    
    console.log('\n' + branding.getDivider());
    console.log(branding.status(`Project created from ${template.name} template!`, 'success'));
    console.log(chalk.dim(`\nLocation: ${outputDir}`));
    console.log(chalk.dim('\nNext steps:'));
    console.log(chalk.dim('  1. cd ' + (options.output || '.')));
    console.log(chalk.dim('  2. grump build'));
    console.log(chalk.dim('  3. grump dev'));
  } else if (!options.list) {
    console.log(chalk.dim('\nTip: Use `grump templates --use <name>` to create a project from a template'));
    console.log(chalk.dim('     Use `grump templates --search <keyword>` to find specific templates'));
  }
}

/**
 * Get mock templates for fallback
 */
function getMockTemplates(category?: string, search?: string): Template[] {
  const mockTemplates: Template[] = [
    {
      id: 'nextjs-starter',
      name: 'Next.js Starter',
      description: 'Modern Next.js app with TypeScript, Tailwind, and shadcn/ui',
      category: 'web',
      tags: ['nextjs', 'react', 'typescript', 'tailwind'],
      downloads: 15420,
      rating: 4.8,
      author: 'grump-team',
      files: [
        { path: 'package.json', content: JSON.stringify({ name: 'my-app', version: '0.1.0', private: true }, null, 2) },
        { path: 'next.config.js', content: '/** @type {import("next").NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;' },
        { path: 'src/app/page.tsx', content: 'export default function Home() {\n  return <main>Hello World</main>;\n}' }
      ],
      setupCommands: ['npm install', 'git init']
    },
    {
      id: 'express-api',
      name: 'Express API',
      description: 'Production-ready Express API with TypeScript and Prisma',
      category: 'api',
      tags: ['express', 'api', 'typescript', 'prisma'],
      downloads: 8930,
      rating: 4.6,
      author: 'grump-team',
      files: [
        { path: 'package.json', content: JSON.stringify({ name: 'api', version: '1.0.0' }, null, 2) },
        { path: 'src/index.ts', content: 'import express from "express";\nconst app = express();\napp.listen(3000);' }
      ],
      setupCommands: ['npm install']
    },
    {
      id: 'react-vite',
      name: 'React + Vite',
      description: 'Lightning fast React app with Vite build tool',
      category: 'web',
      tags: ['react', 'vite', 'typescript'],
      downloads: 12300,
      rating: 4.7,
      author: 'community',
      files: [
        { path: 'package.json', content: JSON.stringify({ name: 'vite-app', version: '0.1.0', type: 'module' }, null, 2) },
        { path: 'vite.config.ts', content: 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });' }
      ],
      setupCommands: ['npm install']
    },
    {
      id: 'cli-tool',
      name: 'CLI Tool Starter',
      description: 'Build command-line tools with TypeScript and Commander.js',
      category: 'cli',
      tags: ['cli', 'typescript', 'commander'],
      downloads: 5670,
      rating: 4.5,
      author: 'grump-team',
      files: [
        { path: 'package.json', content: JSON.stringify({ name: 'cli-tool', version: '1.0.0', bin: { 'my-cli': './dist/index.js' } }, null, 2) },
        { path: 'src/index.ts', content: '#!/usr/bin/env node\nimport { Command } from "commander";\nconst program = new Command();\nprogram.parse();' }
      ],
      setupCommands: ['npm install', 'npm run build']
    },
    {
      id: 'fastapi-python',
      name: 'FastAPI Project',
      description: 'Modern Python API with FastAPI, Pydantic, and SQLAlchemy',
      category: 'api',
      tags: ['python', 'fastapi', 'api'],
      downloads: 7890,
      rating: 4.9,
      author: 'community',
      files: [
        { path: 'main.py', content: 'from fastapi import FastAPI\napp = FastAPI()\n\n@app.get("/")\ndef read_root():\n    return {"Hello": "World"}' },
        { path: 'requirements.txt', content: 'fastapi\nuvicorn\npydantic' }
      ],
      setupCommands: ['python -m venv venv', 'pip install -r requirements.txt']
    }
  ];
  
  let filtered = mockTemplates;
  
  if (category) {
    filtered = filtered.filter(t => t.category === category);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(t => 
      t.name.toLowerCase().includes(searchLower) ||
      t.description.toLowerCase().includes(searchLower) ||
      (t.tags ?? []).some(tag => tag.toLowerCase().includes(searchLower))
    );
  }
  
  return filtered;
}

export const templatesCommand = { execute };

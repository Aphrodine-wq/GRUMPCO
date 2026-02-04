import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner, createProgressSpinner } from '../utils/progress.js';
import { validateRequired, GrumpError, handleApiError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';

interface GenerateOptions {
  output?: string;
  language?: string;
  framework?: string;
  template?: string;
  stream?: boolean;
}

/**
 * Generate code from natural language prompt using AI
 */
export async function execute(prompt: string, options: GenerateOptions): Promise<void> {
  validateRequired(prompt, 'prompt');
  
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  const outputDir = options.output ? resolve(options.output) : process.cwd();
  
  console.log(branding.format('\n🤖 AI Code Generation\n', 'title'));
  console.log(chalk.hex(branding.colors.lightPurple)(`Prompt: "${prompt}"\n`));
  
  // Interactive mode if no specific options provided
  if (!options.language && !options.framework) {
    const answers = await askUser<{ language: string; framework: string | null; confirm: boolean }>([
      {
        type: 'list',
        name: 'language',
        message: 'Select language:',
        choices: [
          { name: 'TypeScript', value: 'typescript' },
          { name: 'JavaScript', value: 'javascript' },
          { name: 'Python', value: 'python' },
          { name: 'Rust', value: 'rust' },
          { name: 'Go', value: 'go' },
          { name: 'Java', value: 'java' },
          { name: 'Other', value: 'other' }
        ]
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Select framework (optional):',
        choices: [
          { name: 'None', value: null },
          { name: 'React', value: 'react' },
          { name: 'Next.js', value: 'nextjs' },
          { name: 'Express', value: 'express' },
          { name: 'FastAPI', value: 'fastapi' },
          { name: 'Django', value: 'django' },
          { name: 'Vue', value: 'vue' }
        ]
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Generate code now?',
        default: true
      }
    ]);
    
    if (!answers.confirm) {
      console.log(branding.status('Generation cancelled', 'info'));
      return;
    }
    
    options.language = answers.language;
    options.framework = answers.framework ?? undefined;
  }
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  // Call API to generate code
  const generatedCode = await withSpinner(
    'Generating code with AI...',
    async () => {
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          language: options.language,
          framework: options.framework,
          template: options.template
        })
      });
      
      if (!response.ok) {
        handleApiError(response);
      }
      
      return response.json();
    },
    'Code generated successfully'
  );
  
  const codeData = generatedCode as { 
    files: Array<{ path: string; content: string }>; 
    explanation?: string;
    usage?: { tokens: number; credits: number };
  };
  
  // Write generated files
  console.log(chalk.hex(branding.colors.mediumPurple)('\n📁 Writing files:\n'));
  
  for (const file of codeData.files) {
    const filePath = join(outputDir, file.path);
    const fileDir = resolve(filePath, '..');
    
    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }
    
    writeFileSync(filePath, file.content);
    console.log(chalk.hex(branding.colors.lightPurple)(`  ✓ ${file.path}`));
  }
  
  // Show explanation if provided
  if (codeData.explanation) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n📝 Code Explanation:\n'));
    console.log(chalk.hex(branding.colors.white)(codeData.explanation));
  }
  
  // Show usage stats
  if (codeData.usage) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n📊 Usage:\n'));
    console.log(chalk.hex(branding.colors.lightPurple)(`  Tokens used: ${codeData.usage.tokens}`));
    console.log(chalk.hex(branding.colors.lightPurple)(`  Credits consumed: ${codeData.usage.credits}`));
  }
  
  console.log('\n' + branding.getDivider());
  console.log(branding.status(`Generated ${codeData.files.length} files in ${outputDir}`, 'success'));
  console.log(chalk.dim('\nNext steps:'));
  console.log(chalk.dim('  1. Review the generated code'));
  console.log(chalk.dim('  2. Run `grump test` to generate tests'));
  console.log(chalk.dim('  3. Run `grump build` to compile'));
}

export const generateCommand = { execute };

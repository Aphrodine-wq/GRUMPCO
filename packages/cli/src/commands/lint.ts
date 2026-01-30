import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner, MultiStepProgress } from '../utils/progress.js';
import { GrumpError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';

interface LintOptions {
  fix?: boolean;
  ai?: boolean;
  staged?: boolean;
  file?: string;
  format?: string;
}

/**
 * Detect linting tools available
 */
function detectLinters(cwd: string): Array<{ name: string; command: string; config: string[] }> {
  const linters = [];
  
  const checks = [
    { name: 'ESLint', command: 'npx eslint', configs: ['.eslintrc.js', '.eslintrc.json', '.eslintrc', 'eslint.config.js'] },
    { name: 'Prettier', command: 'npx prettier --check', configs: ['.prettierrc', '.prettierrc.json', 'prettier.config.js'] },
    { name: 'TypeScript', command: 'npx tsc --noEmit', configs: ['tsconfig.json'] },
    { name: 'Stylelint', command: 'npx stylelint', configs: ['.stylelintrc'] },
    { name: 'Rust Clippy', command: 'cargo clippy', configs: ['Cargo.toml'] },
    { name: 'Go Vet', command: 'go vet', configs: ['go.mod'] },
    { name: 'Pylint', command: 'python -m pylint', configs: ['.pylintrc', 'pyproject.toml'] }
  ];
  
  for (const check of checks) {
    for (const configFile of check.configs) {
      if (existsSync(join(cwd, configFile))) {
        linters.push({ name: check.name, command: check.command, config: check.configs });
        break;
      }
    }
  }
  
  return linters;
}

/**
 * Run linter and capture output
 */
async function runLinter(command: string, args: string[], cwd: string): Promise<{ success: boolean; output: string; issues: Array<{ file: string; line: number; message: string; severity: string }> }> {
  return new Promise((resolve) => {
    const [cmd, ...baseArgs] = command.split(' ');
    const lint = spawn(cmd, [...baseArgs, ...args], {
      cwd,
      shell: true
    });
    
    let output = '';
    lint.stdout?.on('data', (data) => { output += data.toString(); });
    lint.stderr?.on('data', (data) => { output += data.toString(); });
    
    lint.on('close', (code) => {
      // Parse ESLint-style output
      const issues: Array<{ file: string; line: number; message: string; severity: string }> = [];
      const lines = output.split('\n');
      
      for (const line of lines) {
        // Match patterns like: file.ts:10:5 error Message here
        const match = line.match(/^(.*?):(\d+):(\d+)\s+(error|warning|warn)\s+(.+)$/);
        if (match) {
          issues.push({
            file: match[1],
            line: parseInt(match[2]),
            message: match[5],
            severity: match[4] === 'warn' ? 'warning' : match[4]
          });
        }
      }
      
      resolve({ success: code === 0, output, issues });
    });
  });
}

/**
 * Get AI-powered fixes for linting issues
 */
async function getAIFixes(issues: Array<{ file: string; line: number; message: string }>, apiUrl: string, headers: Record<string, string>): Promise<Record<string, string>> {
  const response = await fetch(`${apiUrl}/api/lint-fix`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ issues })
  });
  
  if (!response.ok) {
    throw new GrumpError('Failed to get AI fixes', 'AI_ERROR');
  }
  
  const data = await response.json() as { fixes: Record<string, string> };
  return data.fixes;
}

/**
 * Lint code with AI-powered fixes
 */
export async function execute(options: LintOptions): Promise<void> {
  const cwd = process.cwd();
  const linters = detectLinters(cwd);
  
  console.log(branding.format('\n🔍 Code Linter\n', 'title'));
  
  if (linters.length === 0) {
    console.log(chalk.hex(branding.colors.lightPurple)('No linters detected.\n'));
    
    const { setup } = await askUser<{ setup: string }>([{
      type: 'list',
      name: 'setup',
      message: 'Set up linting:',
      choices: [
        { name: 'ESLint (JavaScript/TypeScript)', value: 'eslint' },
        { name: 'Prettier (Formatter)', value: 'prettier' },
        { name: 'Both ESLint + Prettier', value: 'both' },
        { name: 'Skip', value: 'skip' }
      ]
    }]);
    
    if (setup === 'skip') {
      console.log(branding.status('Linting skipped', 'info'));
      return;
    }
    
    // Install linters
    const packages = setup === 'both' 
      ? ['eslint', 'prettier', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin']
      : setup === 'eslint'
      ? ['eslint', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin']
      : ['prettier'];
    
    await withSpinner(
      'Installing linting tools...',
      async () => {
        return new Promise((resolve, reject) => {
          const install = spawn('npm', ['install', '-D', ...packages], {
            cwd,
            stdio: 'inherit'
          });
          install.on('close', (code) => code === 0 ? resolve(undefined) : reject(new Error('Install failed')));
        });
      },
      'Linters installed'
    );
    
    // Create config files
    if (setup === 'eslint' || setup === 'both') {
      writeFileSync(join(cwd, '.eslintrc.json'), JSON.stringify({
        extends: ['eslint:recommended', '@typescript-eslint/recommended'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint']
      }, null, 2));
    }
    
    if (setup === 'prettier' || setup === 'both') {
      writeFileSync(join(cwd, '.prettierrc'), JSON.stringify({
        semi: true,
        singleQuote: true,
        tabWidth: 2
      }, null, 2));
    }
    
    // Re-detect linters
    linters.push(...detectLinters(cwd));
  }
  
  console.log(chalk.hex(branding.colors.lightPurple)(`Linters: ${linters.map(l => l.name).join(', ')}\n`));
  
  // Run each linter
  const allIssues: Array<{ file: string; line: number; message: string; severity: string }> = [];
  let hasErrors = false;
  
  for (const linter of linters) {
    console.log(chalk.hex(branding.colors.mediumPurple)(`Running ${linter.name}...`));
    
    const args = [];
    if (options.fix && linter.command !== 'tsc --noEmit') args.push('--fix');
    if (options.staged) args.push('--cache');
    if (options.file) {
      args.push(options.file);
    } else {
      // Default patterns
      if (linter.name === 'ESLint') args.push('src/**/*.{js,ts,jsx,tsx}');
      else if (linter.name === 'Prettier') args.push('--check', 'src/**/*.{js,ts,jsx,tsx,json,css,md}');
    }
    
    const result = await runLinter(linter.command, args, cwd);
    allIssues.push(...result.issues);
    
    if (!result.success) {
      hasErrors = true;
      console.log(chalk.hex(branding.colors.mediumPurple)(`  ✗ ${linter.name} found issues`));
    } else {
      console.log(branding.status(`${linter.name} passed`, 'success'));
    }
    
    if (result.output && !result.success) {
      console.log(chalk.dim(result.output.split('\n').slice(0, 20).join('\n')));
    }
  }
  
  // AI-powered fixes
  if (options.ai && allIssues.length > 0 && !options.fix) {
    console.log('\n' + branding.getDivider());
    console.log(chalk.hex(branding.colors.mediumPurple)('\n🤖 AI Lint Analysis\n'));
    
    const groupedByFile: Record<string, typeof allIssues> = {};
    for (const issue of allIssues) {
      if (!groupedByFile[issue.file]) groupedByFile[issue.file] = [];
      groupedByFile[issue.file].push(issue);
    }
    
    // Show summary
    console.log(chalk.hex(branding.colors.lightPurple)(`Found ${allIssues.length} issues across ${Object.keys(groupedByFile).length} files:\n`));
    
    for (const [file, issues] of Object.entries(groupedByFile).slice(0, 5)) {
      console.log(chalk.hex(branding.colors.mediumPurple)(`  ${file}:`));
      for (const issue of issues.slice(0, 3)) {
        const color = issue.severity === 'error' ? branding.colors.mediumPurple : '#C4B5FD';
        console.log(chalk.hex(color)(`    ${issue.line}: ${issue.message}`));
      }
      if (issues.length > 3) {
        console.log(chalk.dim(`    ... and ${issues.length - 3} more`));
      }
    }
    
    // Offer AI fixes
    if (config.hasApiKey()) {
      const { applyFixes } = await askUser<{ applyFixes: boolean }>([{
        type: 'confirm',
        name: 'applyFixes',
        message: 'Apply AI-powered fixes?',
        default: true
      }]);
      
      if (applyFixes) {
        try {
          const apiUrl = config.get('apiUrl');
          const headers = config.getHeaders();
          
          const fixes = await withSpinner(
            'Generating AI fixes...',
            async () => getAIFixes(allIssues, apiUrl, headers),
            'Fixes generated'
          );
          
          console.log(chalk.hex(branding.colors.lightPurple)('\n📝 Applying fixes:\n'));
          
          for (const [file, fixContent] of Object.entries(fixes)) {
            const filePath = resolve(cwd, file);
            if (existsSync(filePath)) {
              writeFileSync(filePath, fixContent);
              console.log(chalk.hex(branding.colors.lightPurple)(`  ✓ ${file}`));
            }
          }
          
          console.log('\n' + branding.status('AI fixes applied! Re-running linter...', 'success'));
          
          // Re-run to verify
          return execute({ ...options, fix: false, ai: false });
        } catch (error) {
          console.log(chalk.hex(branding.colors.mediumPurple)('\n⚠️  Could not apply AI fixes'));
        }
      }
    }
  }
  
  // Summary
  console.log('\n' + branding.getDivider());
  
  if (hasErrors) {
    console.log(branding.status(`Linting failed with ${allIssues.length} issues`, 'error'));
    
    if (!options.fix) {
      console.log(chalk.dim('\nTip: Run `grump lint --fix` to auto-fix issues'));
    }
    if (!options.ai && config.hasApiKey()) {
      console.log(chalk.dim('Tip: Run `grump lint --ai` for AI-powered suggestions'));
    }
    
    throw new GrumpError('Linting failed', 'LINT_FAILED');
  } else {
    console.log(branding.status('All lint checks passed!', 'success'));
  }
}

export const lintCommand = { execute };

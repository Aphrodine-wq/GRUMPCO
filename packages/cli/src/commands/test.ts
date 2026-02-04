import chalk from 'chalk';
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, resolve, relative } from 'path';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner } from '../utils/progress.js';
import { GrumpError } from '../utils/errors.js';
import { prompt as askUser } from '../utils/prompt.js';

interface TestOptions {
  watch?: boolean;
  coverage?: boolean;
  ai?: boolean;
  update?: boolean;
  file?: string;
  generate?: boolean;
}

/**
 * Detect test framework and configuration
 */
function detectTestFramework(cwd: string): { framework: string; command: string; configFiles: string[] } {
  const configs = {
    vitest: ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts'],
    jest: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
    mocha: ['.mocharc.js', '.mocharc.json', 'mocha.opts'],
    cypress: ['cypress.config.js', 'cypress.config.ts', 'cypress.json'],
    playwright: ['playwright.config.js', 'playwright.config.ts'],
    pytest: ['pytest.ini', 'setup.cfg', 'pyproject.toml'],
    cargo: ['Cargo.toml']
  };
  
  for (const [framework, files] of Object.entries(configs)) {
    for (const file of files) {
      if (existsSync(join(cwd, file))) {
        const commands: Record<string, string> = {
          vitest: 'npx vitest',
          jest: 'npx jest',
          mocha: 'npx mocha',
          cypress: 'npx cypress run',
          playwright: 'npx playwright test',
          pytest: 'pytest',
          cargo: 'cargo test'
        };
        return { framework, command: commands[framework], configFiles: [file] };
      }
    }
  }
  
  // Check package.json for test script
  if (existsSync(join(cwd, 'package.json'))) {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
    if (pkg.scripts?.test) {
      return { framework: 'npm', command: 'npm test', configFiles: ['package.json'] };
    }
  }
  
  return { framework: 'unknown', command: '', configFiles: [] };
}

/**
 * Find source files without tests
 */
function findUntestedFiles(cwd: string, testPattern: RegExp): string[] {
  const untested: string[] = [];
  const srcDir = join(cwd, 'src');
  
  if (!existsSync(srcDir)) return untested;
  
  function scan(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry) && !entry.includes('.test.') && !entry.includes('.spec.')) {
        // Check if test file exists
        const testFile = fullPath.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
        const specFile = fullPath.replace(/\.(ts|tsx|js|jsx)$/, '.spec.$1');
        
        if (!existsSync(testFile) && !existsSync(specFile)) {
          untested.push(relative(cwd, fullPath));
        }
      }
    }
  }
  
  scan(srcDir);
  return untested;
}

/**
 * Generate AI test suggestions via API
 */
async function generateTests(filePath: string, apiUrl: string, headers: Record<string, string>): Promise<string> {
  const content = readFileSync(filePath, 'utf-8');
  
  const response = await fetch(`${apiUrl}/api/generate-tests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      file: relative(process.cwd(), filePath),
      content,
      framework: detectTestFramework(process.cwd()).framework
    })
  });
  
  if (!response.ok) {
    throw new GrumpError('Failed to generate tests', 'AI_ERROR');
  }
  
  const data = await response.json() as { testCode: string };
  return data.testCode;
}

/**
 * Run tests with AI-generated test suggestions
 */
export async function execute(options: TestOptions): Promise<void> {
  const cwd = process.cwd();
  const testSetup = detectTestFramework(cwd);
  
  console.log(branding.format('\n🧪 Test Runner\n', 'title'));
  
  if (testSetup.framework === 'unknown') {
    console.log(chalk.hex(branding.colors.lightPurple)('No test framework detected.\n'));
    
    const { framework } = await askUser<{ framework: string }>([{
      type: 'list',
      name: 'framework',
      message: 'Select a test framework to set up:',
      choices: [
        { name: 'Vitest (recommended)', value: 'vitest' },
        { name: 'Jest', value: 'jest' },
        { name: 'Skip tests', value: 'skip' }
      ]
    }]);
    
    if (framework === 'skip') {
      console.log(branding.status('Tests skipped', 'info'));
      return;
    }
    
    // Install test framework
    await withSpinner(
      `Setting up ${framework}...`,
      async () => {
        return new Promise((resolve, reject) => {
          const install = spawn('npm', ['install', '-D', framework], {
            cwd,
            stdio: 'inherit'
          });
          install.on('close', (code) => code === 0 ? resolve(undefined) : reject(new Error('Install failed')));
        });
      },
      `${framework} installed`
    );
    
    testSetup.framework = framework;
    testSetup.command = `npx ${framework}`;
  }
  
  console.log(chalk.hex(branding.colors.lightPurple)(`Framework: ${testSetup.framework}`));
  console.log(chalk.dim(`Config: ${testSetup.configFiles.join(', ')}\n`));
  
  // AI test generation mode
  if (options.ai || options.generate) {
    console.log(chalk.hex(branding.colors.mediumPurple)('🤖 AI Test Generation Mode\n'));
    
    const untested = findUntestedFiles(cwd, /\.(test|spec)\./);
    
    if (untested.length === 0) {
      console.log(branding.status('All files have tests!', 'success'));
    } else {
      console.log(chalk.hex(branding.colors.lightPurple)(`Found ${untested.length} files without tests:\n`));
      
      const { selected } = await askUser<{ selected: string[] }>([{
        type: 'checkbox',
        name: 'selected',
        message: 'Select files to generate tests for:',
        choices: untested.slice(0, 10).map(f => ({ name: f, value: f }))
      }]);
      
      if (selected.length > 0) {
        const apiUrl = config.get('apiUrl');
        const headers = config.getHeaders();
        
        console.log(chalk.hex(branding.colors.mediumPurple)(`\n📝 Generating tests...\n`));
        
        for (const file of selected) {
          try {
            const testCode = await withSpinner(
              `Generating tests for ${file}...`,
              async () => generateTests(resolve(cwd, file), apiUrl, headers),
              'Tests generated'
            );
            
            // Write test file
            const ext = file.match(/\.(ts|tsx|js|jsx)$/)?.[1] || 'ts';
            const testFile = file.replace(/\.(ts|tsx|js|jsx)$/, `.test.${ext}`);
            const testPath = resolve(cwd, testFile);
            
            const testDir = resolve(testPath, '..');
            if (!existsSync(testDir)) {
              mkdirSync(testDir, { recursive: true });
            }
            
            writeFileSync(testPath, testCode);
            console.log(chalk.hex(branding.colors.lightPurple)(`  ✓ ${testFile}`));
          } catch (error) {
            console.log(chalk.hex(branding.colors.mediumPurple)(`  ✗ Failed for ${file}`));
          }
        }
      }
    }
    
    if (!options.generate) {
      // Continue to run tests
      console.log('\n' + branding.getDivider());
    } else {
      return;
    }
  }
  
  // Build test command
  const testArgs: string[] = [];
  if (options.watch) testArgs.push('--watch');
  if (options.coverage) testArgs.push('--coverage');
  if (options.update) testArgs.push('--update');
  if (options.file) {
    testArgs.push(options.file);
  }
  
  const testCmd = `${testSetup.command} ${testArgs.join(' ')}`.trim();
  console.log(chalk.hex(branding.colors.mediumPurple)(`Running: ${testCmd}\n`));
  
  const startTime = Date.now();
  
  await new Promise((resolve, reject) => {
    const [cmd, ...baseArgs] = testCmd.split(' ');
    const tests = spawn(cmd, [...baseArgs, ...testArgs], {
      cwd,
      stdio: 'inherit',
      shell: true
    });
    
    tests.on('close', (code: number | null) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const exitCode = code ?? 1;
      
      if (exitCode === 0) {
        console.log('\n' + branding.getDivider());
        console.log(branding.status(`All tests passed in ${duration}s`, 'success'));
        resolve(undefined);
      } else {
        console.log('\n' + branding.getDivider());
        console.log(branding.status(`Tests failed (${code}) in ${duration}s`, 'error'));
        
        if (options.ai) {
          console.log(chalk.dim('\nTip: Run `grump test --ai` to get AI suggestions for failing tests'));
        }
        
        reject(new GrumpError('Tests failed', 'TESTS_FAILED', exitCode));
      }
    });
  });
}

export const testCommand = { execute };

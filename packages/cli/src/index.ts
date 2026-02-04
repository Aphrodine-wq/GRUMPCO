#!/usr/bin/env node
/**
 * G-Rump CLI - Lightning Fast Edition
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Lazy-load ALL command modules on-demand (not at startup)
 * 2. Minimal imports at top level
 * 3. Deferred branding display
 * 4. Fast-path for common commands
 */

import { Command } from 'commander';

// Lazy-load chalk only when needed
let chalkModule: typeof import('chalk') | null = null;
const getChalk = async () => {
  if (!chalkModule) chalkModule = await import('chalk');
  return chalkModule.default;
};

// Lazy-load branding only when needed
let brandingModule: typeof import('./branding.js') | null = null;
const getBranding = async () => {
  if (!brandingModule) brandingModule = await import('./branding.js');
  return brandingModule.branding;
};

// Lazy-load config only when needed
let configModule: typeof import('./config.js') | null = null;
const getConfig = async () => {
  if (!configModule) configModule = await import('./config.js');
  return configModule.config;
};

// Lazy-load error display
let displayErrorFn: typeof import('./utils/errors.js').displayError | null = null;
const getDisplayError = async () => {
  if (!displayErrorFn) {
    const mod = await import('./utils/errors.js');
    displayErrorFn = mod.displayError;
  }
  return displayErrorFn;
};

const program = new Command();

// Command loader factory - defers module loading until command execution
function lazyCommand<T extends (...args: unknown[]) => Promise<unknown>>(
  modulePath: string,
  exportName: string
): (...args: Parameters<T>) => Promise<void> {
  return async (...args: Parameters<T>) => {
    try {
      const module = await import(modulePath);
      const command = module[exportName];
      await command.execute(...args);
    } catch (error) {
      const displayError = await getDisplayError();
      displayError(error as Error);
      process.exit(1);
    }
  };
}



// Fast startup - minimal setup
program
  .name('grump')
  .description('G-Rump CLI - The grumpiest AI assistant (now in purple!)')
  .version('3.0.0', '-v, --version', 'Display version number')
  .option('-u, --url <url>', 'API base URL')
  .option('--no-color', 'Disable colored output')
  .option('--no-progress', 'Disable progress indicators')
  .option('--verbose', 'Enable verbose output')
  .hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    
    // Handle --no-color
    if (opts.color === false) {
      const chalk = await getChalk();
      chalk.level = 0;
    }
    
    // Show branding (skip if GRUMP_NO_BRANDING is set for maximum speed)
    if (process.env.GRUMP_NO_BRANDING !== 'true' && process.env.GRUMP_FAST !== 'true') {
      const branding = await getBranding();
      console.log(branding.getLogo());
    }
  });

// ============================================
// CORE COMMANDS (most commonly used - prioritized)
// ============================================

program
  .command('ship')
  .description('Start SHIP workflow')
  .argument('<description>', 'Project description')
  .option('-s, --stream', 'Stream output in real-time', false)
  .option('-w, --workspace <path>', 'Workspace path', process.cwd())
  .option('-o, --output <path>', 'Output directory')
  .action(lazyCommand('./commands/ship.js', 'shipCommand'));

program
  .command('chat')
  .description('Quick chat with AI')
  .argument('[message]', 'Message to send')
  .option('-i, --interactive', 'Interactive chat mode', false)
  .option('-c, --context <path>', 'Context file path')
  .option('-s, --session <id>', 'Continue existing chat session')
  .action(lazyCommand('./commands/chat.js', 'chatCommand'));

program
  .command('generate')
  .alias('gen')
  .description('Generate code from natural language prompt')
  .argument('<prompt>', 'Natural language description of what to generate')
  .option('-o, --output <path>', 'Output directory', process.cwd())
  .option('-l, --language <lang>', 'Target language (typescript, python, rust, etc.)')
  .option('-f, --framework <fw>', 'Framework to use (react, nextjs, express, etc.)')
  .option('-t, --template <name>', 'Template to use')
  .option('-s, --stream', 'Stream output in real-time', false)
  .action(lazyCommand('./commands/generate.js', 'generateCommand'));

program
  .command('build')
  .description('Build the current project')
  .option('-w, --watch', 'Watch mode - rebuild on changes', false)
  .option('-a, --analyze', 'Run bundle analyzer', false)
  .option('-p, --production', 'Production build', true)
  .option('-t, --target <target>', 'Build target')
  .option('-o, --output <path>', 'Output directory')
  .option('-c, --clean', 'Clean previous build first', false)
  .action(lazyCommand('./commands/build.js', 'buildCommand'));

// ============================================
// SECONDARY COMMANDS
// ============================================

program
  .command('codegen')
  .description('Run codegen on a session')
  .argument('<session-id>', 'SHIP session ID')
  .option('-o, --output <path>', 'Output directory', process.cwd())
  .option('-f, --format <format>', 'Output format (zip, json, files)', 'zip')
  .action(lazyCommand('./commands/codegen.js', 'codegenCommand'));

program
  .command('architecture')
  .alias('arch')
  .description('Generate system architecture')
  .argument('<description>', 'System description')
  .option('-f, --format <format>', 'Output format (mermaid, dot, json)', 'mermaid')
  .option('-o, --output <path>', 'Output file path')
  .option('-w, --workspace <path>', 'Workspace to analyze')
  .action(lazyCommand('./commands/architecture.js', 'architectureCommand'));

program
  .command('prd')
  .description('Generate Product Requirements Document')
  .argument('<description>', 'Product description')
  .option('-o, --output <path>', 'Output file path', './prd.md')
  .option('-t, --template <name>', 'PRD template to use', 'default')
  .action(lazyCommand('./commands/prd.js', 'prdCommand'));

program
  .command('status')
  .description('Check session status')
  .argument('<session-id>', 'SHIP session ID')
  .option('-w, --watch', 'Watch mode (continuously poll)', false)
  .option('--json', 'Output as JSON', false)
  .option('-i, --interval <ms>', 'Poll interval in milliseconds', '5000')
  .action(lazyCommand('./commands/status.js', 'statusCommand'));

program
  .command('list')
  .description('List active sessions')
  .option('-a, --all', 'Show all sessions including completed', false)
  .option('-f, --format <format>', 'Output format (table, json, compact)', 'table')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(lazyCommand('./commands/list.js', 'listCommand'));

program
  .command('init')
  .description('Initialize project configuration')
  .argument('[projectDir]', 'Project directory (for --template)')
  .option('-f, --force', 'Overwrite existing config', false)
  .option('-g, --global', 'Create global config', false)
  .option('-i, --interactive', 'Interactive setup', true)
  .option('-t, --template <name>', 'Project template (react-app, svelte-app, express-api, cli-tool)')
  .action(lazyCommand('./commands/init.js', 'initCommand'));

program
  .command('doctor')
  .description('Run system diagnostic (Docker, GPU, API, integrations)')
  .option('--fix', 'Attempt automatic fixes', false)
  .option('--json', 'Output as JSON', false)
  .action(lazyCommand('./commands/doctor.js', 'doctorCommand'));

program
  .command('profile')
  .description('Manage configuration profiles (create, list, use, export, import)')
  .argument('<action>', 'create | list | use | export | import')
  .argument('[name]', 'Profile name')
  .action(lazyCommand('./commands/profile.js', 'profileCommand'));

program
  .command('config')
  .description('Manage configuration')
  .argument('[action]', 'Action: get, set, list, reset', 'list')
  .argument('[key]', 'Configuration key')
  .argument('[value]', 'Configuration value')
  .option('-g, --global', 'Use global config')
  .action(lazyCommand('./commands/config.js', 'configCommand'));

program
  .command('auth')
  .description('Manage authentication')
  .argument('[action]', 'Action: login, logout, status, set-key', 'status')
  .argument('[key]', 'API key (for set-key action)')
  .action(lazyCommand('./commands/auth.js', 'authCommand'));

// Secure command with subcommands - loaded dynamically
const secureCmd = program
  .command('secure')
  .description('Manage API keys securely using OS keychain');

// Hook to dynamically load subcommands
secureCmd.hook('preSubcommand', async (subcommand) => {
  try {
    const secureModule = await import('./commands/secure.js');
    const createSecureCommand = secureModule.createSecureCommand;
    if (createSecureCommand) {
      const fullSecureCmd = createSecureCommand();
      // Subcommands are already registered via addCommand in createSecureCommand
    }
  } catch (error) {
    const displayError = await getDisplayError();
    displayError(error as Error);
    process.exit(1);
  }
});

program
  .command('compile')
  .description('Compile intent files to structured output')
  .argument('[files...]', 'Intent files or directories to compile')
  .option('-w, --watch', 'Enable watch mode', false)
  .option('-a, --analyze', 'Run bundle analyzer', false)
  .option('-p, --parallel', 'Use parallel processing', false)
  .option('-i, --incremental', 'Use incremental compilation', false)
  .option('--dce', 'Enable dead code elimination', false)
  .option('--source-maps', 'Generate source maps', false)
  .option('--hot-reload', 'Start hot reload server', false)
  .option('--config <path>', 'Use custom config file')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .option('-f, --format <format>', 'Output format (json, yaml, typescript)', 'json')
  .option('--verbose', 'Enable verbose output', false)
  .action(lazyCommand('./commands/compile.js', 'compileCommand'));

// ============================================
// PRACTICAL COMMANDS
// ============================================

program
  .command('deploy')
  .alias('cloud-deploy')
  .description('Deploy to cloud platform (Vercel, Netlify, Railway, etc.)')
  .option('-p, --platform <name>', 'Deployment platform')
  .option('--prod', 'Production deployment', false)
  .option('--preview', 'Create preview deployment', true)
  .option('-e, --env <environment>', 'Environment to deploy')
  .option('-d, --build-dir <path>', 'Build directory to deploy')
  .option('--skip-build', 'Skip build step', false)
  .action(lazyCommand('./commands/cloud-deploy.js', 'cloudDeployCommand'));

program
  .command('test')
  .description('Run tests with AI-generated test suggestions')
  .option('-w, --watch', 'Watch mode', false)
  .option('-c, --coverage', 'Generate coverage report', false)
  .option('--ai', 'Enable AI test generation/suggestions', false)
  .option('-u, --update', 'Update snapshots', false)
  .option('-f, --file <pattern>', 'Test file pattern to run')
  .option('--generate', 'Generate tests for untested files', false)
  .action(lazyCommand('./commands/test.js', 'testCommand'));

program
  .command('lint')
  .description('Lint code with AI-powered fixes')
  .option('--fix', 'Auto-fix issues', false)
  .option('--ai', 'Enable AI-powered fix suggestions', false)
  .option('--staged', 'Lint only staged files', false)
  .option('-f, --file <path>', 'Specific file to lint')
  .option('--format <format>', 'Output format (stylish, compact, json)')
  .action(lazyCommand('./commands/lint.js', 'lintCommand'));

program
  .command('format')
  .description('Format code using configured formatters')
  .option('--write', 'Write formatted output to files', true)
  .option('--check', 'Check if files are formatted', false)
  .option('-f, --file <path>', 'Specific file to format')
  .option('-p, --pattern <pattern>', 'File pattern to format')
  .option('--cache', 'Use caching for faster formatting', false)
  .action(lazyCommand('./commands/format.js', 'formatCommand'));

program
  .command('credits')
  .description('Check credit balance and purchase more')
  .option('--buy', 'Purchase credits', false)
  .option('-a, --amount <number>', 'Amount of credits to buy')
  .option('--history', 'Show transaction history', false)
  .action(lazyCommand('./commands/credits.js', 'creditsCommand'));

program
  .command('sync')
  .description('Sync project files with cloud storage')
  .option('--push', 'Push local changes to cloud')
  .option('--pull', 'Pull changes from cloud to local')
  .option('--watch', 'Watch for changes and auto-sync', false)
  .option('--force', 'Force sync (overwrite conflicts)', false)
  .option('--dry-run', 'Show what would be synced without making changes', false)
  .action(lazyCommand('./commands/sync.js', 'syncCommand'));

program
  .command('templates')
  .alias('template')
  .description('List and use project templates')
  .option('--list', 'List all available templates', true)
  .option('--use <name>', 'Use a specific template')
  .option('-o, --output <path>', 'Output directory for new project')
  .option('--search <keyword>', 'Search templates by keyword')
  .option('--category <name>', 'Filter by category')
  .action(lazyCommand('./commands/templates.js', 'templatesCommand'));

// ============================================
// FUN COMMANDS (lowest priority - lazy loaded)
// ============================================

program
  .command('rant')
  .description('AI complains about your code with sarcasm')
  .option('-l, --level <level>', 'Rant level: gentle, harsh, brutal', 'harsh')
  .option('-t, --topic <topic>', 'Specific topic to rant about')
  .option('-c, --count <number>', 'Number of rants', '3')
  .action(lazyCommand('./commands/rant.js', 'rantCommand'));

program
  .command('roast')
  .description('Brutal code review with funny insults')
  .argument('<file>', 'File to roast')
  .option('-b, --brutal', 'Maximum roast mode', false)
  .option('-s, --stats', 'Show code statistics', false)
  .action(lazyCommand('./commands/roast.js', 'roastCommand'));

program
  .command('excuse')
  .description('Generate creative excuses for missed deadlines')
  .option('-c, --category <category>', 'Category: classic, technical, creative, relatable, absurd, professional, random', 'random')
  .option('-n, --count <number>', 'Number of excuses', '1')
  .option('-t, --context <context>', 'Context for the excuse')
  .action(lazyCommand('./commands/excuse.js', 'excuseCommand'));

program
  .command('blame')
  .description('Git blame with personality')
  .argument('[file]', 'File to analyze')
  .option('-l, --line <number>', 'Specific line number')
  .option('-f, --funny', 'Maximum humor mode', false)
  .action(lazyCommand('./commands/blame.js', 'blameCommand'));

program
  .command('coffee')
  .description('Check if code is coffee-ready')
  .argument('[file]', 'File to check')
  .option('-a, --all', 'Check all files', false)
  .action(lazyCommand('./commands/coffee.js', 'coffeeCommand'));

program
  .command('vibes')
  .description('Emotional analysis of codebase')
  .option('-p, --path <path>', 'Path to analyze', process.cwd())
  .option('-d, --deep', 'Deep analysis mode', false)
  .action(lazyCommand('./commands/vibes.js', 'vibesCommand'));

program
  .command('panic')
  .description('Emergency fix mode')
  .option('-r, --reason <reason>', 'Reason for panic')
  .option('-f, --fix', 'Attempt emergency fix', false)
  .action(lazyCommand('./commands/panic.js', 'panicCommand'));

program
  .command('shipit')
  .description('Force deploy with funny warnings (YOLO mode)')
  .option('-f, --force', 'Skip all warnings', false)
  .option('-m, --message <message>', 'Deployment message')
  .option('-y, --yolo', 'Maximum YOLO mode', false)
  .action(lazyCommand('./commands/shipit.js', 'shipitCommand'));

program
  .command('docs')
  .description('Generate docs with snarky comments')
  .argument('[file]', 'File to document')
  .option('-o, --output <path>', 'Output path')
  .option('-s, --style <style>', 'Documentation style: sassy, professional, brutal', 'sassy')
  .action(lazyCommand('./commands/docs.js', 'docsCommand'));

program
  .command('refactor')
  .description('Aggressive refactoring suggestions')
  .argument('[file]', 'File to analyze')
  .option('-a, --aggressive', 'Aggressive mode', false)
  .action(lazyCommand('./commands/refactor.js', 'refactorCommand'));

program
  .command('why')
  .description('Explain why code exists (existential crisis mode)')
  .argument('[target]', 'File or concept to question')
  .option('-d, --deep', 'Deep philosophical mode', false)
  .action(lazyCommand('./commands/why.js', 'whyCommand'));

program
  .command('fortune')
  .description('Random programming fortune with sass')
  .option('-c, --category <category>', 'Fortune category', 'random')
  .option('-s, --sign <sign>', 'Zodiac sign for horoscope')
  .action(lazyCommand('./commands/fortune.js', 'fortuneCommand'));

program
  .command('overtime')
  .description('Calculate unpaid overtime')
  .option('-h, --hours <number>', 'Weekly hours worked', '45')
  .option('-r, --rate <number>', 'Hourly rate', '50')
  .option('-w, --weeks <number>', 'Weeks per year', '52')
  .action(lazyCommand('./commands/overtime.js', 'overtimeCommand'));

program
  .command('meeting')
  .description('Meeting survival guide')
  .option('-e, --excuse', 'Generate meeting excuse', false)
  .option('-t, --tip', 'Get survival tip', false)
  .option('--type <type>', 'Meeting type')
  .action(lazyCommand('./commands/meeting.js', 'meetingCommand'));

program
  .command('stackoverflow')
  .alias('so')
  .description('Simulate the StackOverflow experience')
  .option('-q, --question <question>', 'Simulate asking a question')
  .option('-e, --experience', 'Full SO experience', false)
  .action(lazyCommand('./commands/stackoverflow.js', 'stackoverflowCommand'));

program
  .command('fml')
  .description('FML mode for when everything is broken')
  .option('-v, --vent', 'Venting mode', false)
  .option('-h, --help-me', 'Show survival kit', false)
  .action(lazyCommand('./commands/fml.js', 'fmlCommand'));

program
  .command('intern')
  .description('Intern simulator')
  .option('-e, --excuse', 'Generate intern excuse', false)
  .option('-a, --achievement', 'Show achievements', false)
  .action(lazyCommand('./commands/intern.js', 'internCommand'));

program
  .command('legacy')
  .description('Legacy code therapy')
  .option('-h, --horror', 'Show legacy horrors', false)
  .option('-e, --excuse', 'Excuse for not refactoring', false)
  .option('-t, --tips', 'Code archaeology tips', false)
  .option('-a, --age <years>', 'Estimated code age')
  .action(lazyCommand('./commands/legacy.js', 'legacyCommand'));

program
  .command('yeet')
  .description('YEET code into the void')
  .argument('[target]', 'What to yeet')
  .option('-d, --dramatic', 'Dramatic yeet sequence', false)
  .option('-w, --wisdom', 'Show yeet wisdom', false)
  .action(lazyCommand('./commands/yeet.js', 'yeetCommand'));

program
  .command('techdebt')
  .alias('debt')
  .description('Measure technical debt')
  .option('-e, --excuses', 'Excuses for not fixing debt', false)
  .option('-s, --strategies', 'Debt payoff strategies', false)
  .action(lazyCommand('./commands/techdebt.js', 'techDebtCommand'));

program
  .command('friday')
  .description('Friday deployment checker')
  .option('-e, --excuse', 'Generate emergency excuse', false)
  .option('-g, --guide', 'Show survival guide', false)
  .option('-f, --force', 'Force deploy anyway', false)
  .action(lazyCommand('./commands/friday.js', 'fridayCommand'));

program
  .command('imposter')
  .description('Imposter syndrome therapy')
  .option('-t, --truth', 'Show uncomfortable truths', false)
  .option('-a, --affirm', 'Developer affirmations', false)
  .option('-s, --stats', 'Industry imposter stats', false)
  .action(lazyCommand('./commands/imposter.js', 'imposterCommand'));

// ============================================
// ERROR HANDLING & EXECUTION
// ============================================

process.on('unhandledRejection', async (error) => {
  const displayError = await getDisplayError();
  displayError(error as Error, 'Unhandled Promise Rejection');
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  const displayError = await getDisplayError();
  displayError(error, 'Uncaught Exception');
  process.exit(1);
});

// Parse arguments
program.parse();

// Show help if no command provided (with deferred branding)
if (!process.argv.slice(2).length) {
  (async () => {
    const branding = await getBranding();
    console.log(branding.getLogo());
    program.outputHelp();
  })();
}

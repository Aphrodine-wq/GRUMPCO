#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { branding } from './branding.js';
import { config } from './config.js';
import { shipCommand } from './commands/ship.js';
import { codegenCommand } from './commands/codegen.js';
import { architectureCommand } from './commands/architecture.js';
import { prdCommand } from './commands/prd.js';
import { statusCommand } from './commands/status.js';
import { listCommand } from './commands/list.js';
import { chatCommand } from './commands/chat.js';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { authCommand } from './commands/auth.js';
import { compileCommand } from './commands/compile.js';

// Import practical commands
import { generateCommand } from './commands/generate.js';
import { buildCommand } from './commands/build.js';
import { cloudDeployCommand } from './commands/cloud-deploy.js';
import { testCommand } from './commands/test.js';
import { lintCommand } from './commands/lint.js';
import { formatCommand } from './commands/format.js';
import { creditsCommand } from './commands/credits.js';
import { syncCommand } from './commands/sync.js';
import { templatesCommand } from './commands/templates.js';

// Import new funny commands
import { rantCommand } from './commands/rant.js';
import { roastCommand } from './commands/roast.js';
import { excuseCommand } from './commands/excuse.js';
import { blameCommand } from './commands/blame.js';
import { coffeeCommand } from './commands/coffee.js';
import { vibesCommand } from './commands/vibes.js';
import { panicCommand } from './commands/panic.js';
import { shipitCommand } from './commands/shipit.js';
import { docsCommand } from './commands/docs.js';
import { refactorCommand } from './commands/refactor.js';
import { whyCommand } from './commands/why.js';
import { fortuneCommand } from './commands/fortune.js';

// Import batch 2 funny commands
import { overtimeCommand } from './commands/overtime.js';
import { meetingCommand } from './commands/meeting.js';
import { stackoverflowCommand } from './commands/stackoverflow.js';
import { fmlCommand } from './commands/fml.js';
import { internCommand } from './commands/intern.js';
import { legacyCommand } from './commands/legacy.js';
import { yeetCommand } from './commands/yeet.js';
import { techDebtCommand } from './commands/techdebt.js';
import { fridayCommand } from './commands/friday.js';
import { imposterCommand } from './commands/imposter.js';

import { displayError } from './utils/errors.js';

const program = new Command();

// Set up program metadata
program
  .name('grump')
  .description('G-Rump CLI - The grumpiest AI assistant (now in purple!)')
  .version('3.0.0', '-v, --version', 'Display version number')
  .option('-u, --url <url>', 'API base URL', config.get('apiUrl'))
  .option('--no-color', 'Disable colored output')
  .option('--no-progress', 'Disable progress indicators')
  .option('--verbose', 'Enable verbose output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    
    // Handle --no-color
    if (opts.color === false) {
      chalk.level = 0;
    }
    
    // Show branding on every command
    if (process.env.GRUMP_NO_BRANDING !== 'true') {
      console.log(branding.getLogo());
    }
  });

// Ship command
program
  .command('ship')
  .description('Start SHIP workflow')
  .argument('<description>', 'Project description')
  .option('-s, --stream', 'Stream output in real-time', false)
  .option('-w, --workspace <path>', 'Workspace path', process.cwd())
  .option('-o, --output <path>', 'Output directory')
  .action(async (description, options) => {
    try {
      await shipCommand.execute(description, options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// Codegen command
program
  .command('codegen')
  .description('Run codegen on a session')
  .argument('<session-id>', 'SHIP session ID')
  .option('-o, --output <path>', 'Output directory', process.cwd())
  .option('-f, --format <format>', 'Output format (zip, json, files)', 'zip')
  .action(async (sessionId, options) => {
    try {
      await codegenCommand.execute(sessionId, options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// Architecture command
program
  .command('architecture')
  .alias('arch')
  .description('Generate system architecture')
  .argument('<description>', 'System description')
  .option('-f, --format <format>', 'Output format (mermaid, dot, json)', 'mermaid')
  .option('-o, --output <path>', 'Output file path')
  .option('-w, --workspace <path>', 'Workspace to analyze')
  .action(async (description, options) => {
    try {
      await architectureCommand.execute(description, options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// PRD command
program
  .command('prd')
  .description('Generate Product Requirements Document')
  .argument('<description>', 'Product description')
  .option('-o, --output <path>', 'Output file path', './prd.md')
  .option('-t, --template <name>', 'PRD template to use', 'default')
  .action(async (description, options) => {
    try {
      await prdCommand.execute(description, options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check session status')
  .argument('<session-id>', 'SHIP session ID')
  .option('-w, --watch', 'Watch mode (continuously poll)', false)
  .option('--json', 'Output as JSON', false)
  .option('-i, --interval <ms>', 'Poll interval in milliseconds', '5000')
  .action(async (sessionId, options) => {
    try {
      await statusCommand.execute(sessionId, options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List active sessions')
  .option('-a, --all', 'Show all sessions including completed', false)
  .option('-f, --format <format>', 'Output format (table, json, compact)', 'table')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async (options) => {
    try {
      await listCommand.execute(options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// Chat command
program
  .command('chat')
  .description('Quick chat with AI')
  .argument('[message]', 'Message to send')
  .option('-i, --interactive', 'Interactive chat mode', false)
  .option('-c, --context <path>', 'Context file path')
  .option('-s, --session <id>', 'Continue existing chat session')
  .action(async (message, options) => {
    try {
      await chatCommand.execute(message, options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize project configuration')
  .option('-f, --force', 'Overwrite existing config', false)
  .option('-g, --global', 'Create global config', false)
  .option('-i, --interactive', 'Interactive setup', true)
  .action(async (options) => {
    try {
      await initCommand.execute(options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage configuration')
  .argument('[action]', 'Action: get, set, list, reset', 'list')
  .argument('[key]', 'Configuration key')
  .argument('[value]', 'Configuration value')
  .option('-g, --global', 'Use global config')
  .action(async (action, key, value, options) => {
    try {
      await configCommand.execute(action, key, value, options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// Auth command
program
  .command('auth')
  .description('Manage authentication')
  .argument('[action]', 'Action: login, logout, status, set-key', 'status')
  .argument('[key]', 'API key (for set-key action)')
  .action(async (action, key) => {
    try {
      await authCommand.execute(action, key);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
    }
  });

// Compile command
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
  .action(async (files, options) => {
    try {
      await compileCommand.execute(files || [], options);
    } catch (error) {
      displayError(error as Error);
      process.exit(1);
      }
    });

  // Generate command - Generate code from natural language
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
    .action(async (prompt, options) => {
      try {
        await generateCommand.execute(prompt, options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Build command - Build the current project
  program
    .command('build')
    .description('Build the current project')
    .option('-w, --watch', 'Watch mode - rebuild on changes', false)
    .option('-a, --analyze', 'Run bundle analyzer', false)
    .option('-p, --production', 'Production build', true)
    .option('-t, --target <target>', 'Build target')
    .option('-o, --output <path>', 'Output directory')
    .option('-c, --clean', 'Clean previous build first', false)
    .action(async (options) => {
      try {
        await buildCommand.execute(options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Deploy command - Deploy to cloud (Vercel/Netlify/Railway)
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
    .action(async (options) => {
      try {
        await cloudDeployCommand.execute(options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Test command - Run tests with AI suggestions
  program
    .command('test')
    .description('Run tests with AI-generated test suggestions')
    .option('-w, --watch', 'Watch mode', false)
    .option('-c, --coverage', 'Generate coverage report', false)
    .option('--ai', 'Enable AI test generation/suggestions', false)
    .option('-u, --update', 'Update snapshots', false)
    .option('-f, --file <pattern>', 'Test file pattern to run')
    .option('--generate', 'Generate tests for untested files', false)
    .action(async (options) => {
      try {
        await testCommand.execute(options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Lint command - Lint code with AI fixes
  program
    .command('lint')
    .description('Lint code with AI-powered fixes')
    .option('--fix', 'Auto-fix issues', false)
    .option('--ai', 'Enable AI-powered fix suggestions', false)
    .option('--staged', 'Lint only staged files', false)
    .option('-f, --file <path>', 'Specific file to lint')
    .option('--format <format>', 'Output format (stylish, compact, json)')
    .action(async (options) => {
      try {
        await lintCommand.execute(options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Format command - Format code
  program
    .command('format')
    .description('Format code using configured formatters')
    .option('--write', 'Write formatted output to files', true)
    .option('--check', 'Check if files are formatted', false)
    .option('-f, --file <path>', 'Specific file to format')
    .option('-p, --pattern <pattern>', 'File pattern to format')
    .option('--cache', 'Use caching for faster formatting', false)
    .action(async (options) => {
      try {
        await formatCommand.execute(options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Credits command - Check credit balance and buy more
  program
    .command('credits')
    .description('Check credit balance and purchase more')
    .option('--buy', 'Purchase credits', false)
    .option('-a, --amount <number>', 'Amount of credits to buy')
    .option('--history', 'Show transaction history', false)
    .action(async (options) => {
      try {
        await creditsCommand.execute(options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Sync command - Sync project with cloud
  program
    .command('sync')
    .description('Sync project files with cloud storage')
    .option('--push', 'Push local changes to cloud')
    .option('--pull', 'Pull changes from cloud to local')
    .option('--watch', 'Watch for changes and auto-sync', false)
    .option('--force', 'Force sync (overwrite conflicts)', false)
    .option('--dry-run', 'Show what would be synced without making changes', false)
    .action(async (options) => {
      try {
        await syncCommand.execute(options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Templates command - List and use project templates
  program
    .command('templates')
    .alias('template')
    .description('List and use project templates')
    .option('--list', 'List all available templates', true)
    .option('--use <name>', 'Use a specific template')
    .option('-o, --output <path>', 'Output directory for new project')
    .option('--search <keyword>', 'Search templates by keyword')
    .option('--category <name>', 'Filter by category')
    .action(async (options) => {
      try {
        await templatesCommand.execute(options);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Rant command - AI complains about your code
  program
    .command('rant')
    .description('AI complains about your code with sarcasm (insult generator)')
    .option('-l, --level <level>', 'Rant level: gentle, harsh, brutal', 'harsh')
    .option('-t, --topic <topic>', 'Specific topic to rant about')
    .option('-c, --count <number>', 'Number of rants', '3')
    .action(async (options) => {
      try {
        await rantCommand.execute({
          level: options.level,
          topic: options.topic,
          count: parseInt(options.count)
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Roast command - Brutal code review
  program
    .command('roast')
    .description('Brutal code review with funny insults')
    .argument('<file>', 'File to roast')
    .option('-b, --brutal', 'Maximum roast mode', false)
    .option('-s, --stats', 'Show code statistics', false)
    .action(async (file, options) => {
      try {
        await roastCommand.execute(file, {
          brutal: options.brutal,
          stats: options.stats
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Excuse command - Generate creative excuses
  program
    .command('excuse')
    .description('Generate creative excuses for missed deadlines')
    .option('-c, --category <category>', 'Category: classic, technical, creative, relatable, absurd, professional, random', 'random')
    .option('-n, --count <number>', 'Number of excuses', '1')
    .option('-t, --context <context>', 'Context for the excuse')
    .action(async (options) => {
      try {
        await excuseCommand.execute({
          category: options.category,
          count: parseInt(options.count),
          context: options.context
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Blame command - Git blame with personality
  program
    .command('blame')
    .description('Git blame with personality (shows who to blame with funny comments)')
    .argument('[file]', 'File to analyze')
    .option('-l, --line <number>', 'Specific line number')
    .option('-f, --funny', 'Maximum humor mode', false)
    .action(async (file, options) => {
      try {
        await blameCommand.execute(file, {
          line: options.line ? parseInt(options.line) : undefined,
          funny: options.funny
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Coffee command - Check if code is coffee-ready
  program
    .command('coffee')
    .description('Check if code is coffee-ready or needs more work')
    .argument('[file]', 'File to check (or check developer caffeine levels)')
    .option('-a, --all', 'Check all files', false)
    .action(async (file, options) => {
      try {
        await coffeeCommand.execute(file, {
          file: file,
          all: options.all
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Vibes command - Emotional analysis of codebase
  program
    .command('vibes')
    .description('Emotional analysis of codebase (returns emoji vibes)')
    .option('-p, --path <path>', 'Path to analyze', process.cwd())
    .option('-d, --deep', 'Deep analysis mode', false)
    .action(async (options) => {
      try {
        await vibesCommand.execute({
          path: options.path,
          deep: options.deep
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Panic command - Emergency fix mode
  program
    .command('panic')
    .description('Emergency fix mode (dramatic output)')
    .option('-r, --reason <reason>', 'Reason for panic')
    .option('-f, --fix', 'Attempt emergency fix', false)
    .action(async (options) => {
      try {
        await panicCommand.execute({
          reason: options.reason,
          fix: options.fix
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Shipit command - Force deploy with funny warnings
  program
    .command('shipit')
    .description('Force deploy with funny warnings (YOLO mode)')
    .option('-f, --force', 'Skip all warnings', false)
    .option('-m, --message <message>', 'Deployment message')
    .option('-y, --yolo', 'Maximum YOLO mode', false)
    .action(async (options) => {
      try {
        await shipitCommand.execute({
          force: options.force,
          message: options.message,
          yolo: options.yolo
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Docs command - Generate docs with snarky comments
  program
    .command('docs')
    .description('Generate docs with snarky comments')
    .argument('[file]', 'File to document (or generate project docs)')
    .option('-o, --output <path>', 'Output path')
    .option('-s, --style <style>', 'Documentation style: sassy, professional, brutal', 'sassy')
    .action(async (file, options) => {
      try {
        await docsCommand.execute(file, {
          file: file,
          output: options.output,
          style: options.style
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Refactor command - Aggressive refactoring suggestions
  program
    .command('refactor')
    .description('Aggressive refactoring suggestions with attitude')
    .argument('[file]', 'File to analyze (or general tips)')
    .option('-a, --aggressive', 'Aggressive mode', false)
    .action(async (file, options) => {
      try {
        await refactorCommand.execute(file, {
          file: file,
          aggressive: options.aggressive
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Why command - Existential crisis mode
  program
    .command('why')
    .description('Explain why code exists (existential crisis mode)')
    .argument('[target]', 'File or concept to question')
    .option('-d, --deep', 'Deep philosophical mode', false)
    .action(async (target, options) => {
      try {
        await whyCommand.execute(target, {
          file: target,
          deep: options.deep
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Fortune command - Random programming fortune
  program
    .command('fortune')
    .description('Random programming fortune with sass')
    .option('-c, --category <category>', 'Fortune category: lucky, caution, doom, wisdom, comedy, sarcastic, random', 'random')
    .option('-s, --sign <sign>', 'Zodiac sign for horoscope')
    .action(async (options) => {
      try {
        await fortuneCommand.execute({
          category: options.category,
          sign: options.sign
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Overtime command - Calculate unpaid overtime
  program
    .command('overtime')
    .description('Calculate how much unpaid overtime you\'ve worked')
    .option('-h, --hours <number>', 'Weekly hours worked', '45')
    .option('-r, --rate <number>', 'Hourly rate', '50')
    .option('-w, --weeks <number>', 'Weeks per year', '52')
    .action(async (options) => {
      try {
        await overtimeCommand.execute({
          hours: parseInt(options.hours),
          rate: parseInt(options.rate),
          weeks: parseInt(options.weeks)
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Meeting command - Meeting survival guide
  program
    .command('meeting')
    .description('Meeting survival guide and excuse generator')
    .option('-e, --excuse', 'Generate meeting excuse', false)
    .option('-t, --tip', 'Get survival tip', false)
    .option('--type <type>', 'Meeting type: standup, planning, retro, allhands, oneOnOne, brainstorm')
    .action(async (options) => {
      try {
        await meetingCommand.execute({
          excuse: options.excuse,
          tip: options.tip,
          type: options.type
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // StackOverflow command - Simulate SO experience
  program
    .command('stackoverflow')
    .alias('so')
    .description('Simulate the StackOverflow experience')
    .option('-q, --question <question>', 'Simulate asking a question')
    .option('-e, --experience', 'Full SO experience', false)
    .action(async (options) => {
      try {
        await stackoverflowCommand.execute({
          question: options.question,
          experience: options.experience
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // FML command - Fix My Life mode
  program
    .command('fml')
    .description('FML (Fix My Life) mode for when everything is broken')
    .option('-v, --vent', 'Venting mode', false)
    .option('-h, --help-me', 'Show survival kit', false)
    .action(async (options) => {
      try {
        await fmlCommand.execute({
          vent: options.vent,
          help: options.helpMe
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Intern command - Intern simulator
  program
    .command('intern')
    .description('Intern simulator and code patterns')
    .option('-e, --excuse', 'Generate intern excuse', false)
    .option('-a, --achievement', 'Show achievements', false)
    .action(async (options) => {
      try {
        await internCommand.execute({
          excuse: options.excuse,
          achievement: options.achievement
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Legacy command - Legacy code therapy
  program
    .command('legacy')
    .description('Legacy code therapy and archaeology')
    .option('-h, --horror', 'Show legacy horrors', false)
    .option('-e, --excuse', 'Excuse for not refactoring', false)
    .option('-t, --tips', 'Code archaeology tips', false)
    .option('-a, --age <years>', 'Estimated code age')
    .action(async (options) => {
      try {
        await legacyCommand.execute({
          horror: options.horror,
          excuse: options.excuse,
          tips: options.tips,
          age: options.age ? parseInt(options.age) : undefined
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Yeet command - Dramatically delete code
  program
    .command('yeet')
    .description('YEET code or ideas into the void')
    .argument('[target]', 'What to yeet')
    .option('-d, --dramatic', 'Dramatic yeet sequence', false)
    .option('-w, --wisdom', 'Show yeet wisdom', false)
    .action(async (target, options) => {
      try {
        await yeetCommand.execute(target, {
          target,
          dramatic: options.dramatic,
          wisdom: options.wisdom
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Tech debt command - Measure technical debt
  program
    .command('techdebt')
    .alias('debt')
    .description('Measure and lament your technical debt')
    .option('-e, --excuses', 'Excuses for not fixing debt', false)
    .option('-s, --strategies', 'Debt payoff strategies', false)
    .action(async (options) => {
      try {
        await techDebtCommand.execute({
          excuses: options.excuses,
          strategies: options.strategies
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Friday command - Friday deploy checker
  program
    .command('friday')
    .description('Friday deployment checker and predictor')
    .option('-e, --excuse', 'Generate emergency excuse', false)
    .option('-g, --guide', 'Show survival guide', false)
    .option('-f, --force', 'Force deploy anyway', false)
    .action(async (options) => {
      try {
        await fridayCommand.execute({
          excuse: options.excuse,
          guide: options.guide,
          force: options.force
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Imposter command - Imposter syndrome therapy
  program
    .command('imposter')
    .description('Imposter syndrome therapy and validation')
    .option('-t, --truth', 'Show uncomfortable truths', false)
    .option('-a, --affirm', 'Developer affirmations', false)
    .option('-s, --stats', 'Industry imposter stats', false)
    .action(async (options) => {
      try {
        await imposterCommand.execute({
          truth: options.truth,
          affirm: options.affirm,
          stats: options.stats
        });
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  // Global error handler
process.on('unhandledRejection', (error) => {
  displayError(error as Error, 'Unhandled Promise Rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  displayError(error, 'Uncaught Exception');
  process.exit(1);
});

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(branding.getLogo());
  program.outputHelp();
}

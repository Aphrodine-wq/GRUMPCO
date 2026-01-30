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

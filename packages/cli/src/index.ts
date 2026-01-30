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
import { displayError } from './utils/errors.js';

const program = new Command();

// Set up program metadata
program
  .name('grump')
  .description('G-Rump CLI - The grumpiest AI assistant')
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

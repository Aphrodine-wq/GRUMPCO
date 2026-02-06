#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const program = new Command();

program
  .name('grump')
  .description('G-Rump - The AI Product Operating System')
  .version(packageJson.version);

// Ship command
program
  .command('ship')
  .description('Transform a project description into production-ready code')
  .argument('<description>', 'Natural language project description')
  .option('-s, --stack <stack...>', 'Preferred tech stack')
  .option('-t, --target <target>', 'Deployment target (docker|vercel|aws|gcp)', 'docker')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('--no-interactive', 'Non-interactive mode')
  .action(async (description, options) => {
    const spinner = ora('🚀 Launching SHIP workflow...').start();

    try {
      const { shipCommand } = await import('./commands/ship.js');
      await shipCommand(description, options);
      spinner.succeed(chalk.green('✅ Project generated successfully!'));
    } catch (error) {
      spinner.fail(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Chat command
program
  .command('chat')
  .description('Interactive AI chat with development tools')
  .option('-i, --interactive', 'Start interactive mode', true)
  .option('-m, --model <model>', 'AI model to use')
  .option('-p, --provider <provider>', 'AI provider (nim|anthropic|openrouter)')
  .action(async (options) => {
    try {
      const { chatCommand } = await import('./commands/chat.js');
      await chatCommand(options);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Architect command
program
  .command('architect')
  .description('Generate architecture diagrams from descriptions')
  .argument('<description>', 'System description')
  .option('-t, --type <type>', 'Diagram type (c4|erd|sequence|flowchart)', 'c4')
  .option('-l, --level <level>', 'C4 level (context|container|component|code)', 'container')
  .option('-o, --output <file>', 'Output file', './architecture.mmd')
  .action(async (description, options) => {
    const spinner = ora('🏗️  Generating architecture...').start();

    try {
      const { architectCommand } = await import('./commands/architect.js');
      await architectCommand(description, options);
      spinner.succeed(chalk.green(`✅ Architecture saved to ${options.output}`));
    } catch (error) {
      spinner.fail(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Generate command
program
  .command('generate')
  .description('Generate specific code artifacts')
  .option('--type <type>', 'Generation type (frontend|backend|devops|tests)', 'frontend')
  .argument('<description>', 'What to generate')
  .option('-o, --output <dir>', 'Output directory', './generated')
  .action(async (description, options) => {
    const spinner = ora(`⚡ Generating ${options.type}...`).start();

    try {
      const { generateCommand } = await import('./commands/generate.js');
      await generateCommand(description, options);
      spinner.succeed(chalk.green('✅ Code generated successfully!'));
    } catch (error) {
      spinner.fail(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage G-Rump configuration')
  .option('--set <key=value>', 'Set configuration value')
  .option('--get <key>', 'Get configuration value')
  .option('--list', 'List all configuration')
  .action(async (options) => {
    try {
      const { configCommand } = await import('./commands/config.js');
      await configCommand(options);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Models command
program
  .command('models')
  .description('List available AI models and providers')
  .option('--provider <provider>', 'Filter by provider')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const { modelsCommand } = await import('./commands/models.js');
      await modelsCommand(options);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Completion command
program
  .command('completion')
  .description('Generate shell completion script')
  .option('--shell <shell>', 'Shell type (bash|zsh|fish|powershell)', 'bash')
  .action(async (options) => {
    try {
      const { completionCommand } = await import('./commands/completion.js');
      await completionCommand(options);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Login command (for cloud version)
program
  .command('login')
  .description('Authenticate with G-Rump cloud')
  .option('--api-key <key>', 'API key')
  .action(async (options) => {
    try {
      const { loginCommand } = await import('./commands/login.js');
      await loginCommand(options);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Usage analytics command
program
  .command('usage')
  .description('View AI usage and costs')
  .option('--period <period>', 'Time period (day|week|month)', 'month')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const { usageCommand } = await import('./commands/usage.js');
      await usageCommand(options);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Doctor command - check system health
program
  .command('doctor')
  .description('Check system configuration and health')
  .action(async () => {
    try {
      const { doctorCommand } = await import('./commands/doctor.js');
      await doctorCommand();
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Init command - initialize a new project
program
  .command('init')
  .description('Initialize G-Rump in current directory')
  .option('--template <template>', 'Project template')
  .action(async (options) => {
    const spinner = ora('📦 Initializing G-Rump project...').start();

    try {
      const { initCommand } = await import('./commands/init.js');
      await initCommand(options);
      spinner.succeed(chalk.green('✅ Project initialized!'));
    } catch (error) {
      spinner.fail(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error.code === 'commander.unknownCommand') {
    console.error(chalk.red(`❌ Unknown command: ${error.message}`));
    console.log(chalk.yellow('\n💡 Run'), chalk.cyan('grump --help'), chalk.yellow('for usage information'));
  } else if (error.code !== 'commander.helpDisplayed') {
    console.error(chalk.red(`❌ Error: ${error.message}`));
  }
  process.exit(1);
}

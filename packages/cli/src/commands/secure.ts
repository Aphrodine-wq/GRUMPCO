import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { prompt } from '../utils/prompt.js';
import { secureConfig } from '../utils/secureStorage.js';

export function createSecureCommand(): Command {
  const secure = new Command('secure')
    .description('Manage API keys securely using OS keychain')
    .addCommand(createSetCommand())
    .addCommand(createGetCommand())
    .addCommand(createListCommand())
    .addCommand(createDeleteCommand())
    .addCommand(createMigrateCommand())
    .addCommand(createDoctorCommand());

  return secure;
}

function createSetCommand(): Command {
  return new Command('set')
    .description('Securely store an API key in OS keychain')
    .argument('<provider>', 'API provider (nvidia_nim, openai, groq, etc.)')
    .option('-k, --key <key>', 'API key (will prompt if not provided)')
    .option('--no-keychain', 'Use encrypted file storage instead of OS keychain')
    .action(async (provider: string, options) => {
      let apiKey = options.key;

      if (!apiKey) {
        const response = await prompt<{ key: string }>([
          {
            type: 'password',
            name: 'key',
            message: `Enter API key for ${provider}:`,
            mask: '*'
          }
        ]);
        apiKey = response.key;
      }

      if (!apiKey) {
        console.log(chalk.red('Error: API key is required'));
        process.exit(1);
      }

      const spinner = ora(`Storing API key for ${provider}...`).start();

      try {
        await secureConfig.setApiKey(provider, apiKey, options.keychain !== false);
        spinner.succeed(chalk.green(`API key for ${provider} stored securely`));
        
        const method = options.keychain !== false ? 'OS keychain' : 'encrypted storage';
        console.log(chalk.dim(`Storage method: ${method}`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to store API key: ${error}`));
        process.exit(1);
      }
    });
}

function createGetCommand(): Command {
  return new Command('get')
    .description('Retrieve an API key (masked by default)')
    .argument('<provider>', 'API provider')
    .option('--show', 'Show the full API key (use with caution)')
    .action(async (provider: string, options) => {
      const spinner = ora('Retrieving API key...').start();

      try {
        const apiKey = await secureConfig.getApiKey(provider);
        spinner.stop();

        if (!apiKey) {
          console.log(chalk.yellow(`No API key found for ${provider}`));
          console.log(chalk.dim(`Use 'grump secure set ${provider}' to add one`));
          process.exit(1);
        }

        const storageMethod = secureConfig.getStorageMethod(provider);
        
        if (options.show) {
          console.log(chalk.cyan(`API key for ${provider}:`));
          console.log(apiKey);
          console.log(chalk.yellow('Warning: API key exposed in terminal history'));
        } else {
          const masked = apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
          console.log(chalk.cyan(`API key for ${provider}: ${masked}`));
        }
        
        console.log(chalk.dim(`Storage: ${storageMethod}`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to retrieve API key: ${error}`));
        process.exit(1);
      }
    });
}

function createListCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List all securely stored API keys')
    .action(async () => {
      const spinner = ora('Checking stored credentials...').start();

      try {
        const providers = await secureConfig.listStoredProviders();
        spinner.stop();

        if (providers.length === 0) {
          console.log(chalk.yellow('No API keys stored securely'));
          console.log(chalk.dim('Use "grump secure set <provider>" to add API keys'));
          return;
        }

        console.log(chalk.cyan('Securely stored API keys:'));
        console.log('');

        for (const provider of providers) {
          const hasKey = await secureConfig.hasApiKey(provider);
          const method = secureConfig.getStorageMethod(provider);
          const status = hasKey ? chalk.green('✓') : chalk.red('✗');
          const methodLabel = chalk.dim(`[${method}]`);
          console.log(`  ${status} ${provider.padEnd(20)} ${methodLabel}`);
        }

        console.log('');
        console.log(chalk.dim(`Total: ${providers.length} provider(s)`));
      } catch (error) {
        spinner.fail(chalk.red(`Failed to list credentials: ${error}`));
        process.exit(1);
      }
    });
}

function createDeleteCommand(): Command {
  return new Command('delete')
    .alias('rm')
    .description('Remove a stored API key')
    .argument('<provider>', 'API provider')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (provider: string, options) => {
      if (!options.force) {
        const response = await prompt<{ confirm: boolean }>([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete the API key for ${provider}?`,
            default: false
          }
        ]);

        if (!response.confirm) {
          console.log(chalk.yellow('Operation cancelled'));
          return;
        }
      }

      const spinner = ora(`Deleting API key for ${provider}...`).start();

      try {
        const deleted = await secureConfig.deleteApiKey(provider);
        if (deleted) {
          spinner.succeed(chalk.green(`API key for ${provider} deleted`));
        } else {
          spinner.warn(chalk.yellow(`No API key found for ${provider}`));
        }
      } catch (error) {
        spinner.fail(chalk.red(`Failed to delete API key: ${error}`));
        process.exit(1);
      }
    });
}

function createMigrateCommand(): Command {
  return new Command('migrate')
    .description('Migrate API keys from environment variables to secure storage')
    .option('--dry-run', 'Show what would be migrated without making changes')
    .action(async (options) => {
      const providers = [
        'nvidia_nim',
        'openai',
        'anthropic',
        'groq',
        'together',
        'openrouter',
        'ollama',
        'kimi'
      ];

      const envKeys: Array<{ provider: string; key: string }> = [];

      for (const provider of providers) {
        const envVar = `${provider.toUpperCase()}_API_KEY`;
        const value = process.env[envVar];
        if (value) {
          envKeys.push({ provider, key: value });
        }
      }

      if (envKeys.length === 0) {
        console.log(chalk.yellow('No API keys found in environment variables'));
        return;
      }

      console.log(chalk.cyan(`Found ${envKeys.length} API key(s) in environment:`));
      console.log('');

      for (const { provider } of envKeys) {
        console.log(`  • ${provider}`);
      }

      if (options.dryRun) {
        console.log('');
        console.log(chalk.dim('(Dry run - no changes made)'));
        return;
      }

      const response = await prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Migrate these API keys to secure storage?',
          default: true
        }
      ]);

      if (!response.confirm) {
        console.log(chalk.yellow('Migration cancelled'));
        return;
      }

      const spinner = ora('Migrating API keys...').start();
      let migrated = 0;

      for (const { provider, key } of envKeys) {
        try {
          await secureConfig.setApiKey(provider, key, true);
          migrated++;
        } catch (error) {
          spinner.warn(chalk.yellow(`Failed to migrate ${provider}: ${error}`));
        }
      }

      spinner.succeed(chalk.green(`Migrated ${migrated}/${envKeys.length} API keys to secure storage`));
      console.log(chalk.dim('You can now remove these keys from your .env file'));
    });
}

function createDoctorCommand(): Command {
  return new Command('doctor')
    .description('Check secure storage health and configuration')
    .action(async () => {
      const spinner = ora('Checking secure storage...').start();

      try {
        const checks = await Promise.all([
          checkKeychainAccess(),
          checkFallbackStorage(),
          checkEnvVariables()
        ]);

        spinner.stop();

        console.log(chalk.cyan('Secure Storage Health Check:'));
        console.log('');

        for (const check of checks) {
          const icon = check.passed ? chalk.green('✓') : chalk.yellow('⚠');
          console.log(`${icon} ${check.name}`);
          if (check.message) {
            console.log(chalk.dim(`  ${check.message}`));
          }
        }

        console.log('');
        
        const allPassed = checks.every(c => c.passed);
        if (allPassed) {
          console.log(chalk.green('All checks passed! Secure storage is ready.'));
        } else {
          console.log(chalk.yellow('Some checks need attention. Run "grump secure set" to test storage.'));
        }
      } catch (error) {
        spinner.fail(chalk.red(`Health check failed: ${error}`));
        process.exit(1);
      }
    });
}

interface HealthCheck {
  name: string;
  passed: boolean;
  message?: string;
}

async function checkKeychainAccess(): Promise<HealthCheck> {
  try {
    const testProvider = '_health_check_' + Date.now();
    await secureConfig.setApiKey(testProvider, 'test', true);
    const retrieved = await secureConfig.getApiKey(testProvider);
    await secureConfig.deleteApiKey(testProvider);
    
    if (retrieved === 'test') {
      return { name: 'OS Keychain Access', passed: true, message: 'Keychain storage is working' };
    }
    return { name: 'OS Keychain Access', passed: false, message: 'Keychain not available, using fallback' };
  } catch {
    return { name: 'OS Keychain Access', passed: false, message: 'Keychain not available, using fallback' };
  }
}

async function checkFallbackStorage(): Promise<HealthCheck> {
  try {
    const providers = await secureConfig.listStoredProviders();
    return { 
      name: 'Fallback Storage', 
      passed: true, 
      message: `${providers.length} key(s) in fallback storage` 
    };
  } catch {
    return { name: 'Fallback Storage', passed: true, message: 'Fallback storage ready' };
  }
}

async function checkEnvVariables(): Promise<HealthCheck> {
  const providers = ['nvidia_nim', 'openai', 'anthropic', 'groq'];
  const envKeys = providers.filter(p => process.env[`${p.toUpperCase()}_API_KEY`]);
  
  if (envKeys.length > 0) {
    return { 
      name: 'Environment Variables', 
      passed: false, 
      message: `${envKeys.length} key(s) in env vars (use 'secure migrate' to secure them)` 
    };
  }
  return { name: 'Environment Variables', passed: true, message: 'No API keys in environment' };
}

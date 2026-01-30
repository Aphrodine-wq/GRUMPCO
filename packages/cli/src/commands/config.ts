import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { GrumpError } from '../utils/errors.js';

interface ConfigCommandOptions {
  global: boolean;
}

/**
 * Manage G-Rump configuration
 */
export async function execute(
  action: string,
  key: string | undefined,
  value: string | undefined,
  options: ConfigCommandOptions
): Promise<void> {
  switch (action.toLowerCase()) {
    case 'get':
      await getConfig(key);
      break;
    case 'set':
      await setConfig(key, value, options.global);
      break;
    case 'list':
      await listConfig();
      break;
    case 'reset':
      await resetConfig(options.global);
      break;
    default:
      throw new GrumpError(
        `Unknown config action: ${action}`,
        'UNKNOWN_ACTION',
        undefined,
        ['Valid actions: get, set, list, reset']
      );
  }
}

/**
 * Get a specific configuration value
 */
async function getConfig(key: string | undefined): Promise<void> {
  if (!key) {
    throw new GrumpError(
      'Config key is required',
      'MISSING_KEY',
      undefined,
      ['Usage: grump config get <key>']
    );
  }
  
  const value = config.get(key as any);
  
  console.log(branding.format('Configuration Value:', 'subtitle'));
  console.log(chalk.white(`${key}: ${JSON.stringify(value, null, 2)}`));
}

/**
 * Set a configuration value
 */
async function setConfig(
  key: string | undefined, 
  value: string | undefined,
  global: boolean
): Promise<void> {
  if (!key || value === undefined) {
    throw new GrumpError(
      'Both key and value are required',
      'MISSING_PARAMS',
      undefined,
      ['Usage: grump config set <key> <value>']
    );
  }
  
  // Parse value
  let parsedValue: any = value;
  
  // Try to parse as JSON
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Keep as string if JSON parsing fails
  }
  
  // Convert boolean strings
  if (value.toLowerCase() === 'true') parsedValue = true;
  if (value.toLowerCase() === 'false') parsedValue = false;
  
  // Convert number strings
  if (!isNaN(Number(value)) && value !== '') {
    parsedValue = Number(value);
  }
  
  config.set(key as any, parsedValue, global);
  
  console.log(branding.status(`Set ${key} = ${JSON.stringify(parsedValue)}`, 'success'));
  
  if (global) {
    console.log(chalk.dim('(saved to global config)'));
  }
}

/**
 * List all configuration values
 */
async function listConfig(): Promise<void> {
  const allConfig = config.getAll();
  const configPath = config.getConfigPath();
  
  console.log(branding.format('G-Rump Configuration', 'subtitle'));
  
  if (configPath) {
    console.log(chalk.dim(`Config file: ${configPath}\n`));
  } else {
    console.log(chalk.dim('Using default configuration\n'));
  }
  
  console.log(chalk.bold('Current Settings:'));
  console.log(chalk.gray('─'.repeat(50)));
  
  const displayKey = (key: string, value: any, indent = 0) => {
    const spaces = '  '.repeat(indent);
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`${spaces}${chalk.cyan(key)}:`);
      Object.entries(value).forEach(([subKey, subValue]) => {
        displayKey(subKey, subValue, indent + 1);
      });
    } else {
      const valueStr = typeof value === 'string' 
        ? `"${value}"` 
        : JSON.stringify(value);
      console.log(`${spaces}${chalk.cyan(key)}: ${chalk.white(valueStr)}`);
    }
  };
  
  Object.entries(allConfig).forEach(([key, value]) => {
    // Don't show API key in full
    if (key === 'apiKey' && value) {
      const maskedKey = typeof value === 'string' 
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`  ${chalk.cyan(key)}: ${chalk.white(maskedKey)}`);
    } else {
      displayKey(key, value, 1);
    }
  });
  
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.dim('\nUse `grump config get <key>` to view a specific setting'));
  console.log(chalk.dim('Use `grump config set <key> <value>` to change a setting'));
}

/**
 * Reset configuration to defaults
 */
async function resetConfig(global: boolean): Promise<void> {
  console.log(branding.format('Resetting configuration...', 'subtitle'));
  
  config.reset(global);
  
  console.log(branding.status('Configuration reset to defaults', 'success'));
  
  if (global) {
    console.log(chalk.dim('Global configuration cleared'));
  }
}

export const configCommand = { execute };

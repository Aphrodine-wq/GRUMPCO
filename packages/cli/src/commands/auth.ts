import chalk from 'chalk';
import { prompt as askUser } from '../utils/prompt.js';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { withSpinner } from '../utils/progress.js';
import { handleApiError } from '../utils/errors.js';

/**
 * Manage API authentication
 */
export async function execute(action: string, key?: string): Promise<void> {
  switch (action.toLowerCase()) {
    case 'login':
      await login();
      break;
    case 'logout':
      await logout();
      break;
    case 'status':
      await status();
      break;
    case 'set-key':
      await setKey(key);
      break;
    default:
      console.log(chalk.red(`Unknown auth action: ${action}`));
      console.log(chalk.dim('Valid actions: login, logout, status, set-key'));
      process.exit(1);
  }
}

/**
 * Authenticate with API key
 */
async function login(): Promise<void> {
  console.log(branding.getLogo('compact'));
  console.log(branding.format('Authentication', 'subtitle'));
  
  const { apiKey } = await askUser<{ apiKey: string }>([{
    type: 'password',
    name: 'apiKey',
    message: 'Enter your API key:',
    mask: '*'
  }]);
  
  if (!apiKey) {
    console.log(chalk.red('API key is required'));
    process.exit(1);
  }
  
  // Verify the API key
  const isValid = await verifyApiKey(apiKey);
  
  if (isValid) {
    config.set('apiKey', apiKey, true);
    console.log('\n' + branding.status('Authentication successful!', 'success'));
    console.log(chalk.dim('API key saved to global config'));
  } else {
    console.log('\n' + branding.status('Authentication failed. Please check your API key.', 'error'));
    process.exit(1);
  }
}

/**
 * Log out and remove API key
 */
async function logout(): Promise<void> {
  const hadKey = config.hasApiKey();
  
  config.set('apiKey', null, true);
  
  if (hadKey) {
    console.log(branding.status('Logged out successfully', 'success'));
  } else {
    console.log(branding.status('No API key was stored', 'info'));
  }
}

/**
 * Check authentication status
 */
async function status(): Promise<void> {
  console.log(branding.format('Authentication Status', 'subtitle'));
  
  const hasKey = config.hasApiKey();
  const apiUrl = config.get('apiUrl');
  
  console.log(chalk.bold('API URL: ') + chalk.white(apiUrl));
  console.log(chalk.bold('Authenticated: ') + (hasKey 
    ? chalk.greenBright('✓ Yes') 
    : chalk.redBright('✗ No')
  ));
  
  if (hasKey) {
    // Verify the key is still valid
    const apiKey = config.get('apiKey');
    const isValid = await verifyApiKey(apiKey as string);
    
    if (isValid) {
      console.log(chalk.bold('API Key: ') + chalk.green('Valid'));
      
      // Try to get user info if available
      try {
        const userInfo = await fetchUserInfo();
        if (userInfo) {
          console.log(chalk.bold('User: ') + chalk.white(userInfo.name || 'Unknown'));
        }
      } catch {
        // Ignore user info errors
      }
    } else {
      console.log(chalk.bold('API Key: ') + chalk.red('Invalid'));
      console.log(chalk.yellow('\nWarning: Your API key appears to be invalid.'));
      console.log(chalk.dim('Run `grump auth login` to update your credentials.'));
    }
  } else {
    console.log(chalk.dim('\nYou are not authenticated.'));
    console.log(chalk.dim('Run `grump auth login` to authenticate.'));
  }
}

/**
 * Set API key directly
 */
async function setKey(key: string | undefined): Promise<void> {
  if (!key) {
    console.log(chalk.red('API key is required'));
    console.log(chalk.dim('Usage: grump auth set-key <api-key>'));
    process.exit(1);
  }
  
  const isValid = await verifyApiKey(key);
  
  if (isValid) {
    config.set('apiKey', key, true);
    console.log(branding.status('API key set successfully', 'success'));
  } else {
    console.log(branding.status('Invalid API key', 'error'));
    process.exit(1);
  }
}

/**
 * Verify API key with the server
 */
async function verifyApiKey(apiKey: string): Promise<boolean> {
  const apiUrl = config.get('apiUrl');
  
  try {
    const response = await fetch(`${apiUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    return response.ok;
  } catch {
    // If we can't connect, assume the key is valid (will fail on actual use)
    return true;
  }
}

/**
 * Fetch user information
 */
async function fetchUserInfo(): Promise<{ name?: string; email?: string } | null> {
  const apiUrl = config.get('apiUrl');
  const headers = config.getHeaders();
  
  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json() as Promise<{ name?: string; email?: string }>;
  } catch {
    return null;
  }
}

export const authCommand = { execute };

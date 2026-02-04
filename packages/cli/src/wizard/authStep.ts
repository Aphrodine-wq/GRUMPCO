/**
 * Authentication Step for G-Rump CLI Wizard
 */

import chalk from 'chalk';
import open from 'open';
import http from 'http';
import { prompt as askUser } from '../utils/prompt.js';
import { branding } from '../branding.js';
import { config } from '../config.js';
import { createSpinner } from '../utils/progress.js';

export interface AuthResult {
  method: 'oauth' | 'api-key' | 'skipped';
  provider?: 'google' | 'github' | 'discord';
  authenticated: boolean;
  userId?: string;
  email?: string;
}

const OAUTH_PROVIDERS = [
  { name: 'Google', value: 'google', icon: '🔵' },
  { name: 'GitHub', value: 'github', icon: '🐙' },
  { name: 'Discord', value: 'discord', icon: '💜' }
];

/**
 * Start local OAuth callback server
 */
async function startOAuthServer(port: number): Promise<{ token: string; userId: string; email: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);
      
      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token') || url.searchParams.get('access_token');
        const userId = url.searchParams.get('user_id') || '';
        const email = url.searchParams.get('email') || '';
        
        if (token) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>G-Rump - Authentication Complete</title>
              <style>
                body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #6B46C1, #A855F7); color: white; }
                .container { text-align: center; padding: 2rem; }
                h1 { font-size: 2rem; margin-bottom: 0.5rem; }
                p { opacity: 0.9; }
                .emoji { font-size: 4rem; margin-bottom: 1rem; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="emoji">😊</div>
                <h1>Authentication Complete!</h1>
                <p>You can close this window and return to the terminal.</p>
              </div>
            </body>
            </html>
          `);
          
          server.close();
          resolve({ token, userId, email });
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication failed</h1><p>No token received.</p>');
          server.close();
          reject(new Error('No token received'));
        }
      }
    });
    
    server.listen(port, () => {
      // Server started
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout - no response received'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Run OAuth authentication flow
 */
async function runOAuthFlow(provider: string): Promise<AuthResult> {
  const apiUrl = config.get('apiUrl');
  const callbackPort = 9876;
  const callbackUrl = `http://localhost:${callbackPort}/callback`;
  
  console.log();
  console.log(chalk.dim(`  Opening browser for ${provider} authentication...`));
  
  // Start the callback server
  const serverPromise = startOAuthServer(callbackPort);
  
  // Open browser to OAuth URL
  const authUrl = `${apiUrl}/auth/${provider}?redirect_uri=${encodeURIComponent(callbackUrl)}&cli=true`;
  
  try {
    await open(authUrl);
  } catch {
    console.log(chalk.yellow('\n  Could not open browser automatically.'));
    console.log(chalk.white(`  Please visit: ${authUrl}`));
  }
  
  const spinner = createSpinner({ text: 'Waiting for authentication...' });
  spinner.start();
  
  try {
    const { token, userId, email } = await serverPromise;
    
    // Save the token
    config.set('apiKey', token, true);
    
    spinner.succeed(branding.status('Authenticated successfully!', 'success'));
    
    if (email) {
      console.log(chalk.dim(`  Logged in as: ${email}`));
    }
    
    return {
      method: 'oauth',
      provider: provider as AuthResult['provider'],
      authenticated: true,
      userId,
      email
    };
  } catch (error) {
    spinner.fail(branding.status('Authentication failed', 'error'));
    console.log(chalk.dim(`  ${(error as Error).message}`));
    
    return {
      method: 'oauth',
      provider: provider as AuthResult['provider'],
      authenticated: false
    };
  }
}

/**
 * Run API key authentication flow
 */
async function runApiKeyFlow(): Promise<AuthResult> {
  const { apiKey } = await askUser<{ apiKey: string }>([{
    type: 'password',
    name: 'apiKey',
    message: 'Enter your API key:',
    mask: '*'
  }]);
  
  if (!apiKey) {
    return { method: 'api-key', authenticated: false };
  }
  
  // Verify the key
  const spinner = createSpinner({ text: 'Verifying API key...' });
  spinner.start();
  
  try {
    const apiUrl = config.get('apiUrl');
    const response = await fetch(`${apiUrl}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (response.ok) {
      config.set('apiKey', apiKey, true);
      spinner.succeed(branding.status('API key verified!', 'success'));
      return { method: 'api-key', authenticated: true };
    } else {
      spinner.fail(branding.status('Invalid API key', 'error'));
      return { method: 'api-key', authenticated: false };
    }
  } catch {
    // If we can't connect, save the key anyway (will be verified on use)
    config.set('apiKey', apiKey, true);
    spinner.warn(branding.status('Could not verify (saved for later)', 'warning'));
    return { method: 'api-key', authenticated: true };
  }
}

/**
 * Run authentication step
 */
export async function runAuthStep(): Promise<AuthResult> {
  console.log(chalk.white('  Choose how you want to authenticate:\n'));
  
  const { method } = await askUser<{ method: string }>([{
    type: 'list',
    name: 'method',
    message: 'Authentication method:',
    choices: [
      { name: '🔐 Sign in with Google (Recommended)', value: 'google' },
      { name: '🐙 Sign in with GitHub', value: 'github' },
      { name: '💜 Sign in with Discord', value: 'discord' },
      { name: '🔑 Enter API Key manually', value: 'api-key' },
      { name: '⏭️  Skip for now', value: 'skip' }
    ]
  }]);
  
  if (method === 'skip') {
    console.log(chalk.dim('\n  You can authenticate later with `grump auth login`'));
    return { method: 'skipped', authenticated: false };
  }
  
  if (method === 'api-key') {
    return await runApiKeyFlow();
  }
  
  // OAuth flow
  return await runOAuthFlow(method);
}

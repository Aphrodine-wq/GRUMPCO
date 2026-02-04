/**
 * Connection Test Step for G-Rump CLI Wizard
 */

import chalk from 'chalk';
import { branding } from '../branding.js';
import { createSpinner } from '../utils/progress.js';

export interface ConnectionTestResult {
  backend: { ok: boolean; latency?: number; error?: string };
  aiProvider?: { ok: boolean; latency?: number; error?: string };
}

/**
 * Test backend API connection
 */
async function testBackendConnection(apiUrl: string): Promise<{ ok: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/health/quick`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (response.ok) {
      return { ok: true, latency };
    } else {
      return { ok: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    if (message.includes('abort')) {
      return { ok: false, error: 'Timeout (10s)' };
    }
    return { ok: false, error: message };
  }
}

/**
 * Test AI provider connection
 */
async function testAiProviderConnection(
  provider: string,
  apiKey?: string
): Promise<{ ok: boolean; latency?: number; error?: string }> {
  if (!apiKey && provider !== 'ollama') {
    return { ok: false, error: 'No API key' };
  }

  const providerEndpoints: Record<string, string> = {
    'kimi': 'https://api.moonshot.cn/v1/models',
    'nvidia-nim': 'https://integrate.api.nvidia.com/v1/models',
    'openrouter': 'https://openrouter.ai/api/v1/models',
    'anthropic': 'https://api.anthropic.com/v1/messages',
    'openai': 'https://api.openai.com/v1/models',
    'groq': 'https://api.groq.com/openai/v1/models',
    'together': 'https://api.together.xyz/v1/models',
    'ollama': 'http://localhost:11434/api/tags'
  };

  const endpoint = providerEndpoints[provider];
  if (!endpoint) {
    return { ok: false, error: 'Unknown provider' };
  }

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const headers: Record<string, string> = {};
    if (apiKey) {
      if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (response.ok) {
      return { ok: true, latency };
    } else if (response.status === 401) {
      return { ok: false, error: 'Invalid API key' };
    } else {
      return { ok: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    if (message.includes('abort')) {
      return { ok: false, error: 'Timeout (10s)' };
    }
    if (message.includes('ECONNREFUSED')) {
      return { ok: false, error: 'Service not running' };
    }
    return { ok: false, error: message };
  }
}

/**
 * Run connection test step
 */
export async function runConnectionTest(
  apiUrl: string,
  aiProvider?: string,
  aiApiKey?: string
): Promise<ConnectionTestResult> {
  console.log(chalk.white('  Testing connections...\n'));

  const result: ConnectionTestResult = {
    backend: { ok: false }
  };

  // Test backend
  const backendSpinner = createSpinner({ text: 'Testing G-Rump backend...' });
  backendSpinner.start();

  result.backend = await testBackendConnection(apiUrl);

  if (result.backend.ok) {
    backendSpinner.succeed(
      `Backend: ${chalk.green('Connected')} ${chalk.dim(`(${result.backend.latency}ms)`)}`
    );
  } else {
    backendSpinner.warn(
      `Backend: ${chalk.yellow('Not available')} ${chalk.dim(`(${result.backend.error})`)}`
    );
    console.log(chalk.dim('    Make sure the backend is running: npm run dev'));
  }

  // Test AI provider (if configured)
  if (aiProvider) {
    const aiSpinner = createSpinner({ text: `Testing ${aiProvider}...` });
    aiSpinner.start();

    result.aiProvider = await testAiProviderConnection(aiProvider, aiApiKey);

    if (result.aiProvider.ok) {
      aiSpinner.succeed(
        `${aiProvider}: ${chalk.green('Connected')} ${chalk.dim(`(${result.aiProvider.latency}ms)`)}`
      );
    } else {
      aiSpinner.warn(
        `${aiProvider}: ${chalk.yellow('Not available')} ${chalk.dim(`(${result.aiProvider.error})`)}`
      );
    }
  }

  console.log();

  // Summary
  const allOk = result.backend.ok && (!result.aiProvider || result.aiProvider.ok);
  if (allOk) {
    console.log(branding.status('All connections successful!', 'success'));
  } else if (result.backend.ok || result.aiProvider?.ok) {
    console.log(branding.status('Some connections unavailable (you can fix this later)', 'warning'));
  } else {
    console.log(branding.status('Connections unavailable (setup can still continue)', 'warning'));
  }

  return result;
}

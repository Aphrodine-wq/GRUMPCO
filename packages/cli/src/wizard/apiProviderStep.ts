/**
 * AI Provider Selection Step for G-Rump CLI Wizard
 */

import chalk from 'chalk';
import { prompt as askUser } from '../utils/prompt.js';
import { branding } from '../branding.js';
import { createSpinner } from '../utils/progress.js';

export interface ApiProviderResult {
  provider: string;
  apiKey?: string;
  tested: boolean;
}

interface ProviderOption {
  name: string;
  value: string;
  description: string;
  requiresKey: boolean;
  keyPlaceholder?: string;
}

const AI_PROVIDERS: ProviderOption[] = [
  {
    name: '🌙 Kimi K2.5 (Recommended)',
    value: 'kimi',
    description: 'Great balance of speed and quality',
    requiresKey: true,
    keyPlaceholder: 'sk-...'
  },
  {
    name: '🟢 NVIDIA NIM',
    value: 'nvidia-nim',
    description: 'GPU-accelerated inference',
    requiresKey: true,
    keyPlaceholder: 'nvapi-...'
  },
  {
    name: '🔀 OpenRouter',
    value: 'openrouter',
    description: 'Access multiple models (Claude, GPT, etc.)',
    requiresKey: true,
    keyPlaceholder: 'sk-or-...'
  },
  {
    name: '🧠 Anthropic Claude',
    value: 'anthropic',
    description: 'Advanced reasoning',
    requiresKey: true,
    keyPlaceholder: 'sk-ant-...'
  },
  {
    name: '🤖 OpenAI',
    value: 'openai',
    description: 'GPT models',
    requiresKey: true,
    keyPlaceholder: 'sk-...'
  },
  {
    name: '⚡ Groq',
    value: 'groq',
    description: 'Ultra-fast inference',
    requiresKey: true,
    keyPlaceholder: 'gsk_...'
  },
  {
    name: '🤝 Together AI',
    value: 'together',
    description: 'Open-source models',
    requiresKey: true,
    keyPlaceholder: ''
  },
  {
    name: '🦙 Ollama (Local)',
    value: 'ollama',
    description: 'Run models locally - no API key needed',
    requiresKey: false
  }
];

/**
 * Test API key with provider
 */
async function testProviderKey(provider: string, apiKey: string): Promise<boolean> {
  // Provider-specific endpoints for testing
  const testEndpoints: Record<string, string> = {
    'kimi': 'https://api.moonshot.cn/v1/models',
    'nvidia-nim': 'https://integrate.api.nvidia.com/v1/models',
    'openrouter': 'https://openrouter.ai/api/v1/models',
    'anthropic': 'https://api.anthropic.com/v1/messages',
    'openai': 'https://api.openai.com/v1/models',
    'groq': 'https://api.groq.com/openai/v1/models',
    'together': 'https://api.together.xyz/v1/models'
  };

  const endpoint = testEndpoints[provider];
  if (!endpoint) {
    return true; // Skip test for unknown providers
  }

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`
    };

    // Anthropic uses a different header
    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers
    });

    return response.ok || response.status === 401 === false;
  } catch {
    return false;
  }
}

/**
 * Run API provider selection step
 */
export async function runApiProviderStep(): Promise<ApiProviderResult> {
  console.log(chalk.white('  Choose your primary AI provider:\n'));
  
  const { provider } = await askUser<{ provider: string }>([{
    type: 'list',
    name: 'provider',
    message: 'AI Provider:',
    choices: AI_PROVIDERS.map(p => ({
      name: `${p.name}\n      ${chalk.dim(p.description)}`,
      value: p.value,
      short: p.name.replace(/^[^\s]+\s/, '') // Remove emoji for short display
    }))
  }]);

  const selectedProvider = AI_PROVIDERS.find(p => p.value === provider);

  if (!selectedProvider?.requiresKey) {
    // Ollama or other local provider
    console.log();
    console.log(chalk.dim('  Make sure Ollama is running locally.'));
    console.log(chalk.dim('  Start it with: ollama serve'));
    return { provider, tested: false };
  }

  // Ask for API key
  console.log();
  const { apiKey } = await askUser<{ apiKey: string }>([{
    type: 'password',
    name: 'apiKey',
    message: `Enter your ${selectedProvider.name.replace(/^[^\s]+\s/, '')} API key:`,
    mask: '*'
  }]);

  if (!apiKey) {
    console.log(chalk.dim('\n  No API key provided. You can add it later in settings.'));
    return { provider, tested: false };
  }

  // Test the key
  const spinner = createSpinner({ text: 'Testing API connection...' });
  spinner.start();

  const isValid = await testProviderKey(provider, apiKey);

  if (isValid) {
    spinner.succeed(branding.status('API key verified!', 'success'));
    return { provider, apiKey, tested: true };
  } else {
    spinner.warn(branding.status('Could not verify key (saved anyway)', 'warning'));
    console.log(chalk.dim('  The key will be tested when you make your first request.'));
    return { provider, apiKey, tested: false };
  }
}

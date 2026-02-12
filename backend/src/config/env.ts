/**
 * Environment configuration orchestrator.
 *
 * This file:
 *   1. Locates and loads the .env file
 *   2. Parses process.env through the Zod schema (envSchema.ts)
 *   3. Validates production constraints (envValidation.ts)
 *   4. Exports the validated `env` object + provider helpers
 *
 * Schema: ./envSchema.ts
 * Validation & reporting: ./envValidation.ts
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import pino from 'pino';
import {
  fullEnvSchema,
  reportValidationErrors,
  logValidationSuccess,
  type Env,
} from './envValidation.js';

// Bootstrap logger – used only during env loading
const log = pino({ name: 'env', level: process.env.LOG_LEVEL ?? 'info' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple paths for .env file
const possiblePaths = [
  resolve(__dirname, '../../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend/.env'),
];

let envPath: string | null = null;
for (const path of possiblePaths) {
  if (existsSync(path)) {
    envPath = path;
    break;
  }
}

if (envPath) {
  log.info({ path: envPath }, 'Loading .env file');
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    log.error({ err: result.error.message }, 'Error loading .env');
  }
} else {
  log.warn({ searched: possiblePaths }, '.env file not found in any searched location');
  log.info('Attempting to load .env from current directory');
  const result = dotenv.config();
  if (result.error) {
    log.error({ err: result.error.message }, 'Error loading .env');
  }
}

// ── Parse & validate ──

export type { Env };

const parseResult = fullEnvSchema.safeParse(process.env);

if (!parseResult.success) {
  reportValidationErrors(parseResult.error.issues, log, envPath);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Export validated env (with defaults applied)
export const env: Env = parseResult.success
  ? parseResult.data
  : fullEnvSchema.parse({
      ...process.env,
      NVIDIA_NIM_API_KEY: 'invalid-key-see-errors-above',
    });

if (parseResult.success) {
  logValidationSuccess(env, log);
}

// Also export raw process.env for backwards compatibility
export default process.env;

// ── Provider helpers ──

export type ApiProvider = 'nvidia_nim' | 'openrouter' | 'ollama' | 'anthropic';

/**
 * Get API key for a provider.
 */
export function getApiKey(provider: ApiProvider): string | undefined {
  switch (provider) {
    case 'nvidia_nim':
      return env.NVIDIA_NIM_API_KEY;
    case 'openrouter':
      return env.OPENROUTER_API_KEY;
    case 'ollama':
      return undefined;
    case 'anthropic':
      return env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Check if a provider is configured and available.
 */
export function isProviderConfigured(provider: ApiProvider): boolean {
  switch (provider) {
    case 'nvidia_nim':
      return Boolean(env.NVIDIA_NIM_API_KEY);
    case 'openrouter':
      return Boolean(env.OPENROUTER_API_KEY);
    case 'ollama':
      return Boolean(env.OLLAMA_BASE_URL);
    case 'anthropic':
      return Boolean(env.ANTHROPIC_API_KEY);
    default:
      return false;
  }
}

/**
 * Get all configured providers.
 */
export function getConfiguredProviders(): ApiProvider[] {
  const providers: ApiProvider[] = [];
  if (env.NVIDIA_NIM_API_KEY) providers.push('nvidia_nim');
  if (env.OPENROUTER_API_KEY) providers.push('openrouter');
  if (env.OLLAMA_BASE_URL) providers.push('ollama');
  if (env.ANTHROPIC_API_KEY) providers.push('anthropic');
  return providers;
}

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

// Try multiple paths for .env file
const possiblePaths = [
  resolve(__dirname, '../../.env'), // From src/config/env.ts -> backend/.env
  resolve(process.cwd(), '.env'),   // From current working directory
  resolve(process.cwd(), 'backend/.env'), // From project root
];

let envPath: string | null = null;
for (const path of possiblePaths) {
  if (existsSync(path)) {
    envPath = path;
    break;
  }
}

if (envPath) {
  console.log(`[env] Loading .env from: ${envPath}`);
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error(`[env] Error loading .env: ${result.error.message}`);
  }
} else {
  console.warn('[env] .env file not found in any of these locations:');
  possiblePaths.forEach(p => console.warn(`  - ${p}`));
  console.log('[env] Attempting to load from current directory...');
  const result = dotenv.config();
  if (result.error) {
    console.error(`[env] Error loading .env: ${result.error.message}`);
  }
}

// Define environment schema with Zod
const envSchema = z.object({
  // AI Providers - at least one required
  NVIDIA_NIM_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().optional(),
  SERVERLESS_MODE: z.enum(['vercel']).optional(),
  EVENTS_MODE: z.enum(['sse', 'poll']).optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),

  // Database
  DB_PATH: z.string().default('./data/grump.db'),

  // Redis (optional)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Abuse prevention
  BLOCK_SUSPICIOUS_PROMPTS: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  REQUIRE_AUTH_FOR_API: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),

  // Webhooks
  GRUMP_WEBHOOK_SECRET: z.string().optional(),

  // Intent compiler
  GRUMP_INTENT_PATH: z.string().optional(),
  GRUMP_USE_WASM_INTENT: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  GRUMP_USE_WORKER_POOL_INTENT: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  // Supabase
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  // Serverless jobs (QStash)
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_URL: z.string().optional(),
  JOB_WORKER_SECRET: z.string().optional(),

  // Stripe (optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Twilio (optional)
  MESSAGING_PROVIDER: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_REPLY_TO_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_SECRET: z.string().optional(),

  // Docker Sandbox (optional)
  DOCKER_HOST: z.string().default('unix:///var/run/docker.sock'),
  SANDBOX_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  SANDBOX_MEMORY_LIMIT: z.string().default('512m'),

  // Metrics (optional)
  METRICS_AUTH: z.string().optional(),

  // NVIDIA NIM / GPU (optional)
  NVIDIA_NIM_URL: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\/[^\s]+$/.test(String(v).trim()), 'NVIDIA_NIM_URL must be http(s) URL'),
  NIM_EMBED_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  NIM_EMBED_MAX_WAIT_MS: z.coerce.number().int().nonnegative().optional(),

  // Observability (optional)
  OTLP_ENDPOINT: z.string().url().optional(),
}).refine((data) => {
  // Require at least one AI provider API key (skip in test environment)
  return isTestEnv || data.NVIDIA_NIM_API_KEY || data.OPENROUTER_API_KEY;
}, {
  message: 'At least one AI provider API key is required (NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY)',
});

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

// Validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('\n' + '='.repeat(60));
  console.error('  G-RUMP CONFIGURATION ERROR');
  console.error('='.repeat(60));
  console.error('\nEnvironment validation failed:\n');

  for (const issue of parseResult.error.issues) {
    const path = issue.path.join('.');
    console.error(`  - ${path}: ${issue.message}`);
  }

  console.error('\nTo fix this:');
  console.error('  1. Copy backend/.env.example to backend/.env');
  console.error('  2. Add your NVIDIA NIM API key or OpenRouter API key');
  console.error('  3. Restart the server');
  console.error(`\nCurrent directory: ${process.cwd()}`);
  console.error(`Searched in: ${envPath || 'default location'}`);
  console.error('='.repeat(60) + '\n');

  // In production, exit immediately on invalid config
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Export validated env (with defaults applied)
export const env: Env = parseResult.success
  ? parseResult.data
  : envSchema.parse({ ...process.env, NVIDIA_NIM_API_KEY: 'invalid-key-see-errors-above', OPENROUTER_API_KEY: 'invalid-key-see-errors-above' });

// Log successful validation (never log raw secrets or key material in production)
if (parseResult.success) {
  if (process.env.NODE_ENV !== 'production') {
    if (env.NVIDIA_NIM_API_KEY) {
      const keyPreview = env.NVIDIA_NIM_API_KEY.substring(0, 12) + '...' + env.NVIDIA_NIM_API_KEY.slice(-4);
      console.log(`[env] NVIDIA_NIM_API_KEY loaded: ${keyPreview}`);
    }
    if (env.OPENROUTER_API_KEY) {
      console.log('[env] OPENROUTER_API_KEY set (OpenRouter provider available)');
    }
    if (env.REDIS_HOST) {
      console.log(`[env] Redis configured at ${env.REDIS_HOST}:${env.REDIS_PORT}`);
    }
    if (env.NVIDIA_NIM_URL) {
      console.log(`[env] NVIDIA_NIM_URL set (local/self-hosted NIM)`);
    }
  }
  console.log(`[env] Environment validated successfully (${env.NODE_ENV} mode)`);
}

// Also export raw process.env for backwards compatibility
export default process.env;

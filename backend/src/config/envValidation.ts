/**
 * Production refinements and validation error reporting for the env schema.
 * Extracted from env.ts to keep individual files under ~500 lines.
 */
import { z } from 'zod';
import type pino from 'pino';
import { envSchema as baseSchema } from './envSchema.js';

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

/**
 * Full env schema = base schema + provider requirement + prod refinements.
 */
export const fullEnvSchema = baseSchema
  .refine(
    (data) => {
      if (isTestEnv || data.MOCK_AI_MODE) return true;
      return Boolean(data.NVIDIA_NIM_API_KEY || data.OPENROUTER_API_KEY);
    },
    {
      message:
        'At least one AI provider API key is required (NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY). Set MOCK_AI_MODE=true for zero-config mode. Get free keys: https://build.nvidia.com/',
    }
  )
  .superRefine((data, ctx) => {
    const isProd = data.NODE_ENV === 'production';
    const strict = isProd && data.SECURITY_STRICT_PROD;
    if (!strict) return;

    const requiredFields: Array<{
      field: string;
      test: boolean;
      message: string;
    }> = [
      {
        field: 'CORS_ORIGINS',
        test: !data.CORS_ORIGINS || !data.CORS_ORIGINS.trim(),
        message: 'CORS_ORIGINS is required in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'CORS_ORIGINS',
        test: Boolean(data.CORS_ORIGINS?.includes('*')),
        message: 'CORS_ORIGINS must not include "*" in production',
      },
      {
        field: 'ALLOWED_HOSTS',
        test: !data.ALLOWED_HOSTS || !data.ALLOWED_HOSTS.trim(),
        message: 'ALLOWED_HOSTS is required in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'REQUIRE_AUTH_FOR_API',
        test: !data.REQUIRE_AUTH_FOR_API,
        message: 'REQUIRE_AUTH_FOR_API must be true in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'BLOCK_SUSPICIOUS_PROMPTS',
        test: !data.BLOCK_SUSPICIOUS_PROMPTS,
        message:
          'BLOCK_SUSPICIOUS_PROMPTS must be true in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'OUTPUT_FILTER_PII',
        test: !data.OUTPUT_FILTER_PII,
        message: 'OUTPUT_FILTER_PII must be true in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'OUTPUT_FILTER_HARMFUL',
        test: !data.OUTPUT_FILTER_HARMFUL,
        message: 'OUTPUT_FILTER_HARMFUL must be true in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'STRICT_COMMAND_ALLOWLIST',
        test: !data.STRICT_COMMAND_ALLOWLIST,
        message:
          'STRICT_COMMAND_ALLOWLIST must be true in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'METRICS_AUTH',
        test: !data.METRICS_AUTH || !data.METRICS_AUTH.trim(),
        message: 'METRICS_AUTH is required in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'MASTER_KEY',
        test: !data.MASTER_KEY || data.MASTER_KEY.length < 32,
        message: 'MASTER_KEY (32+ chars) is required in production when SECURITY_STRICT_PROD=true',
      },
      {
        field: 'SECURITY_SCAN_ROOT',
        test: !data.SECURITY_SCAN_ROOT || !data.SECURITY_SCAN_ROOT.trim(),
        message: 'SECURITY_SCAN_ROOT is required in production when SECURITY_STRICT_PROD=true',
      },
    ];

    for (const { field, test, message } of requiredFields) {
      if (test) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message,
        });
      }
    }
  });

export type Env = z.infer<typeof fullEnvSchema>;

/**
 * Report validation errors in a developer-friendly format.
 */
export function reportValidationErrors(
  issues: z.ZodIssue[],
  log: pino.Logger,
  envPath: string | null
): void {
  const formatted = issues.map((i) => {
    const field = i.path.join('.');
    const message = i.message;

    const hints: Record<string, string> = {
      'At least one AI provider':
        '💡 Try MOCK_AI_MODE=true for zero-config, or get free key: https://build.nvidia.com/',
      'CORS_ORIGINS is required': '💡 Example: CORS_ORIGINS=https://yourdomain.com',
      'ALLOWED_HOSTS is required': '💡 Example: ALLOWED_HOSTS=yourdomain.com,app.yourdomain.com',
      'METRICS_AUTH is required': '💡 Example: METRICS_AUTH=username:password',
      'MASTER_KEY (32+ chars) is required': '💡 Generate: openssl rand -base64 32',
    };

    const hint = Object.entries(hints).find(([key]) => message.includes(key))?.[1];
    return hint ? `${field}: ${message}\n  ${hint}` : `${field}: ${message}`;
  });

  log.error('');
  log.error('╔════════════════════════════════════════════════════════════════╗');
  log.error('║                                                                ║');
  log.error('║  ❌  Configuration Error - Cannot Start Server                ║');
  log.error('║                                                                ║');
  log.error('╚════════════════════════════════════════════════════════════════╝');
  log.error('');

  formatted.forEach((issue) => {
    log.error(`  ${issue}`);
    log.error('');
  });

  log.error('📝 Quick fixes:');
  log.error('  1. Copy template: cp backend/.env.minimal backend/.env');
  log.error('  2. For mock mode: echo "MOCK_AI_MODE=true" > backend/.env');
  log.error('  3. Full setup: see docs/GETTING_STARTED.md');
  log.error('');
  log.error(`Working directory: ${process.cwd()}`);
  log.error(`Searched for .env in: ${envPath ?? 'default location'}`);
  log.error('');
}

/**
 * Log successful validation summary (no raw secrets).
 */
export function logValidationSuccess(env: Env, log: pino.Logger): void {
  const providers: string[] = [];
  if (env.NVIDIA_NIM_API_KEY) providers.push('NVIDIA NIM');
  if (env.OPENROUTER_API_KEY) providers.push('OpenRouter');
  if (env.OLLAMA_BASE_URL && env.OLLAMA_BASE_URL !== 'http://localhost:11434') {
    providers.push('Ollama');
  }

  const features: Record<string, boolean> = {};
  if (env.MOCK_AI_MODE) features.mockMode = true;
  if (env.MULTI_PROVIDER_ROUTING) features.multiProvider = true;
  if (env.DISABLE_RAG) features.ragDisabled = true;
  if (env.DISABLE_VOICE) features.voiceDisabled = true;
  if (env.FRONTEND_ONLY) features.frontendOnly = true;

  log.info(
    {
      mode: env.NODE_ENV,
      providers: providers.length ? providers : env.MOCK_AI_MODE ? ['MOCK'] : undefined,
      features: Object.keys(features).length ? features : undefined,
      redis:
        env.REDIS_URL && env.REDIS_URL.trim()
          ? env.REDIS_URL.replace(/:[^:@]+@/, ':****@')
          : env.REDIS_HOST
            ? `${env.REDIS_HOST}:${env.REDIS_PORT}`
            : undefined,
      nimUrl: env.NVIDIA_NIM_URL || undefined,
    },
    'Environment validated successfully'
  );

  if (env.MOCK_AI_MODE) {
    log.warn('');
    log.warn('╔════════════════════════════════════════════════════════════════╗');
    log.warn('║                                                                ║');
    log.warn('║  🤖  MOCK MODE ACTIVE - Zero-config exploration enabled       ║');
    log.warn('║                                                                ║');
    log.warn('║  AI responses will be realistic placeholders.                 ║');
    log.warn('║  To enable real AI:                                           ║');
    log.warn('║    1. Copy backend/.env.minimal to backend/.env              ║');
    log.warn('║    2. Uncomment ONE provider key                             ║');
    log.warn('║    3. Set MOCK_AI_MODE=false                                 ║');
    log.warn('║    4. Restart the server                                     ║');
    log.warn('║                                                                ║');
    log.warn('║  Free API keys: https://build.nvidia.com/                    ║');
    log.warn('║                                                                ║');
    log.warn('╚════════════════════════════════════════════════════════════════╝');
    log.warn('');
  }
}

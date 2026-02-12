/**
 * Zod schema definition for all environment variables.
 * Extracted from env.ts to keep individual files under ~500 lines.
 */
import { z } from 'zod';

/** Boolean transform helper — reusable across many fields. */
const boolStr = (defaultValue: 'true' | 'false' = 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((v) => v === 'true');

/** Optional "truthy" string → boolean transform. */
const optBool = () =>
  z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
  // ─── FEATURE TOGGLES ───
  MOCK_AI_MODE: boolStr('false'),
  DISABLE_RAG: boolStr('false'),
  DISABLE_VOICE: boolStr('false'),
  FRONTEND_ONLY: boolStr('false'),
  SHOW_ONBOARDING_TOUR: boolStr('true'),

  // ─── AI PROVIDERS ───
  NVIDIA_NIM_API_KEY: z.string().optional(),
  MULTI_PROVIDER_ROUTING: boolStr('false'),
  OPENROUTER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z
    .string()
    .optional()
    .default('http://localhost:11434')
    .refine(
      (v) => !v || /^https?:\/\/[^\s]+$/.test(String(v).trim()),
      'OLLAMA_BASE_URL must be a valid http(s) URL'
    ),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GITHUB_COPILOT_CLIENT_ID: z.string().optional(),
  GITHUB_COPILOT_CLIENT_SECRET: z.string().optional(),

  // ─── ROUTER PREFERENCES ───
  ROUTER_FAST_PROVIDER: z.enum(['nim', 'openrouter', 'anthropic', 'ollama']).default('nim'),
  ROUTER_QUALITY_PROVIDER: z
    .enum(['anthropic', 'openrouter', 'nim', 'ollama'])
    .default('anthropic'),
  ROUTER_CODING_PROVIDER: z.enum(['anthropic', 'nim', 'openrouter', 'ollama']).default('anthropic'),

  // ─── SERVER ───
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().optional(),
  SERVERLESS_MODE: z.enum(['vercel']).optional(),
  EVENTS_MODE: z.enum(['sse', 'poll']).optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),
  ALLOWED_HOSTS: z.string().optional(),

  // ─── DATABASE ───
  DB_PATH: z.string().default('./data/grump.db'),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // ─── SECURITY / ABUSE ───
  BLOCK_SUSPICIOUS_PROMPTS: boolStr('false'),
  REQUIRE_AUTH_FOR_API: boolStr('false'),
  SECURITY_STRICT_PROD: boolStr('true'),
  OUTPUT_FILTER_PII: boolStr('false'),
  OUTPUT_FILTER_HARMFUL: boolStr('false'),
  STRICT_COMMAND_ALLOWLIST: boolStr('false'),
  SECURITY_SCAN_ROOT: z.string().optional(),

  // ─── WEBHOOKS ───
  GRUMP_WEBHOOK_SECRET: z.string().optional(),
  GRUMP_WEBHOOK_URLS: z.string().optional(),

  // ─── AGENT GOVERNANCE ───
  AGENT_ACCESS_POLICY: z.enum(['block', 'allowlist', 'audit_only']).default('block'),
  AGENT_ALLOWLIST: z.string().optional(),
  AGENT_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().optional(),
  /** @deprecated Use G_AGENT_ENABLED instead. */
  FREE_AGENT_ENABLED: optBool(),

  // ─── INTENT COMPILER ───
  GRUMP_INTENT_PATH: z.string().optional(),
  INTENT_COMPILER_MODE: z.enum(['hybrid', 'rust-first', 'llm-first']).default('rust-first'),
  INTENT_AMBIGUITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
  GRUMP_USE_WASM_INTENT: optBool(),
  GRUMP_USE_WORKER_POOL_INTENT: optBool(),

  // ─── SUPABASE ───
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  // ─── SERVERLESS JOBS ───
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_URL: z.string().optional(),
  JOB_WORKER_SECRET: z.string().optional(),

  // ─── STRIPE ───
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ─── TWILIO ───
  MESSAGING_PROVIDER: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_REPLY_TO_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_SECRET: z.string().optional(),
  TWILIO_WHATSAPP_NUMBER: z.string().optional(),

  // ─── TELEGRAM ───
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // ─── DOCKER SANDBOX ───
  DOCKER_HOST: z.string().default('unix:///var/run/docker.sock'),
  SANDBOX_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  SANDBOX_MEMORY_LIMIT: z.string().default('512m'),

  // ─── METRICS ───
  METRICS_AUTH: z.string().optional(),

  // ─── NVIDIA NIM / GPU ───
  NVIDIA_NIM_URL: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\/[^\s]+$/.test(String(v).trim()),
      'NVIDIA_NIM_URL must be http(s) URL'
    ),
  NIM_EMBED_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  NIM_EMBED_MAX_WAIT_MS: z.coerce.number().int().nonnegative().optional(),

  // ─── OBSERVABILITY ───
  OTLP_ENDPOINT: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_DEBUG: boolStr('false'),

  // ─── INTEGRATIONS PLATFORM ───
  MASTER_KEY: z.string().min(32).optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  OBSIDIAN_VAULT_PATH: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  HOME_ASSISTANT_URL: z.string().url().optional(),
  HOME_ASSISTANT_TOKEN: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MODEL_FAILOVER_PROVIDERS: z.string().optional(),
  BONJOUR_ENABLED: optBool(),
  NOTION_CLIENT_ID: z.string().optional(),
  NOTION_CLIENT_SECRET: z.string().optional(),
  NOTION_REDIRECT_URI: z.string().url().optional(),
  FIGMA_CLIENT_ID: z.string().optional(),
  FIGMA_CLIENT_SECRET: z.string().optional(),
  FIGMA_REDIRECT_URI: z.string().url().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),

  // ─── PINECONE / RAG ───
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().optional(),
  PINECONE_HOST: z.string().optional(),
  PINECONE_NAMESPACE: z.string().optional(),
  RAG_INDEX_PATH: z.string().default('./data/rag-index.json'),
  RAG_LLM_MODEL: z.string().optional(),
  RAG_VECTOR_STORE: z.enum(['memory', 'pinecone', 'qdrant']).optional(),
  RAG_CONTEXT_ENABLED: optBool(),
  RAG_RERANKER: z.string().optional(),
  RAG_RERANKER_URL: z.string().url().optional(),
  RAG_CLAUDE_FALLBACK: optBool(),
  RAG_EMBED_MODEL: z.string().optional(),
  RAG_MEMORY_INDEX_PATH: z.string().optional(),
  RAG_NAMESPACE: z.string().optional(),
  REINDEX_SECRET: z.string().optional(),
  RAG_INTENT_GUIDED: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  INTENT_RAG_AUGMENT_ENRICH: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),

  // ─── ALT DATABASE ───
  DATABASE_URL: z.string().url().optional(),
});

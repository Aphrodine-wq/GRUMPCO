import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";
import { z } from "zod";
import pino from "pino";

// Bootstrap logger – used only during env loading (before the main logger is available)
const log = pino({ name: "env", level: process.env.LOG_LEVEL ?? "info" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isTestEnv =
  process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

// Try multiple paths for .env file
const possiblePaths = [
  resolve(__dirname, "../../.env"), // From src/config/env.ts -> backend/.env
  resolve(process.cwd(), ".env"), // From current working directory
  resolve(process.cwd(), "backend/.env"), // From project root
];

let envPath: string | null = null;
for (const path of possiblePaths) {
  if (existsSync(path)) {
    envPath = path;
    break;
  }
}

if (envPath) {
  log.info({ path: envPath }, "Loading .env file");
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    log.error({ err: result.error.message }, "Error loading .env");
  }
} else {
  log.warn(
    { searched: possiblePaths },
    ".env file not found in any searched location",
  );
  log.info("Attempting to load .env from current directory");
  const result = dotenv.config();
  if (result.error) {
    log.error({ err: result.error.message }, "Error loading .env");
  }
}

// Define environment schema with Zod
const envSchema = z
  .object({
    // ───────────────────────────────────────────
    // 🚀 FEATURE TOGGLES & LEARNING CURVE HELPERS
    // ───────────────────────────────────────────
    // Enable mock AI mode for zero-config exploration (no API keys needed)
    MOCK_AI_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Disable RAG (document search) - useful for quick setup
    DISABLE_RAG: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Disable voice features (TTS/ASR)
    DISABLE_VOICE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Frontend-only mode (skip backend, use external API)
    FRONTEND_ONLY: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Show onboarding tour on first run
    SHOW_ONBOARDING_TOUR: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),

    // AI Provider - NVIDIA NIM (Primary)
    // Get your free API key at https://build.nvidia.com
    NVIDIA_NIM_API_KEY: z.string().optional(),

    // Multi-Provider AI Router Configuration
    // Enable provider routing (defaults to NIM-only if false)
    MULTI_PROVIDER_ROUTING: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    // OpenRouter - https://openrouter.ai
    OPENROUTER_API_KEY: z.string().optional(),

    // Ollama - Local/self-hosted (Enterprise)
    OLLAMA_BASE_URL: z
      .string()
      .optional()
      .default("http://localhost:11434")
      .refine(
        (v) => !v || /^https?:\/\/[^\s]+$/.test(String(v).trim()),
        "OLLAMA_BASE_URL must be a valid http(s) URL",
      ),

    // GitHub Copilot - https://github.com/features/copilot
    GITHUB_COPILOT_TOKEN: z.string().optional(),

    // Kimi K2.5 - https://platform.moonshot.cn
    KIMI_API_KEY: z.string().optional(),

    // Anthropic - https://anthropic.com
    ANTHROPIC_API_KEY: z.string().optional(),

    // Mistral AI - https://mistral.ai
    MISTRAL_API_KEY: z.string().optional(),

    // Groq - https://groq.com
    GROQ_API_KEY: z.string().optional(),

    // Jan - Local AI (OpenAI-compatible, default port 1337)
    JAN_BASE_URL: z
      .string()
      .optional()
      .default("http://localhost:1337")
      .refine(
        (v) => !v || /^https?:\/\/[^\s]+$/.test(String(v).trim()),
        "JAN_BASE_URL must be a valid http(s) URL",
      ),

    // Google AI (Gemini) - https://ai.google.dev
    GOOGLE_AI_API_KEY: z.string().optional(),

    // Provider routing preferences
    ROUTER_FAST_PROVIDER: z
      .enum([
        "nim",
        "kimi",
        "github-copilot",
        "mistral",
        "openrouter",
        "anthropic",
        "ollama",
        "groq",
      ])
      .default("nim"),
    ROUTER_QUALITY_PROVIDER: z
      .enum([
        "anthropic",
        "openrouter",
        "nim",
        "mistral",
        "github-copilot",
        "kimi",
        "ollama",
        "groq",
      ])
      .default("anthropic"),
    ROUTER_CODING_PROVIDER: z
      .enum([
        "github-copilot",
        "mistral",
        "nim",
        "anthropic",
        "openrouter",
        "kimi",
        "ollama",
        "groq",
      ])
      .default("github-copilot"),

    // Server
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGINS: z.string().optional(),
    SERVERLESS_MODE: z.enum(["vercel"]).optional(),
    EVENTS_MODE: z.enum(["sse", "poll"]).optional(),
    PUBLIC_BASE_URL: z.string().url().optional(),
    ALLOWED_HOSTS: z.string().optional(),

    // Database
    DB_PATH: z.string().default("./data/grump.db"),

    // Redis (optional; REDIS_URL or REDIS_HOST+PORT)
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // Abuse prevention
    BLOCK_SUSPICIOUS_PROMPTS: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    REQUIRE_AUTH_FOR_API: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    SECURITY_STRICT_PROD: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    OUTPUT_FILTER_PII: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    OUTPUT_FILTER_HARMFUL: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    STRICT_COMMAND_ALLOWLIST: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    SECURITY_SCAN_ROOT: z.string().optional(),

    // Webhooks
    GRUMP_WEBHOOK_SECRET: z.string().optional(),
    GRUMP_WEBHOOK_URLS: z.string().optional(),

    // Agent governance (Moltbot/OpenClaw blocking)
    AGENT_ACCESS_POLICY: z
      .enum(["block", "allowlist", "audit_only"])
      .default("block"),
    AGENT_ALLOWLIST: z.string().optional(),
    AGENT_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().optional(),
    FREE_AGENT_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),

    // Intent compiler
    GRUMP_INTENT_PATH: z.string().optional(),
    INTENT_COMPILER_MODE: z
      .enum(["hybrid", "rust-first", "llm-first"])
      .default("rust-first"),
    INTENT_AMBIGUITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
    GRUMP_USE_WASM_INTENT: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    GRUMP_USE_WORKER_POOL_INTENT: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),

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
    TWILIO_WHATSAPP_NUMBER: z.string().optional(),

    // Telegram (optional; native messaging)
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

    // Docker Sandbox (optional)
    DOCKER_HOST: z.string().default("unix:///var/run/docker.sock"),
    SANDBOX_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
    SANDBOX_MEMORY_LIMIT: z.string().default("512m"),

    // Metrics (optional)
    METRICS_AUTH: z.string().optional(),

    // NVIDIA NIM / GPU (optional)
    NVIDIA_NIM_URL: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^https?:\/\/[^\s]+$/.test(String(v).trim()),
        "NVIDIA_NIM_URL must be http(s) URL",
      ),
    NIM_EMBED_BATCH_SIZE: z.coerce.number().int().positive().optional(),
    NIM_EMBED_MAX_WAIT_MS: z.coerce.number().int().nonnegative().optional(),

    // Observability (optional)
    OTLP_ENDPOINT: z.string().url().optional(),

    // Error tracking (Sentry)
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_DEBUG: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    // Integrations Platform
    MASTER_KEY: z.string().min(32).optional(), // Required for encryption (32+ chars)

    // Discord Integration
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),

    // Slack Integration
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string().optional(),

    // Spotify Integration
    SPOTIFY_CLIENT_ID: z.string().optional(),
    SPOTIFY_CLIENT_SECRET: z.string().optional(),

    // Obsidian Integration
    OBSIDIAN_VAULT_PATH: z.string().optional(),

    // ElevenLabs Voice
    ELEVENLABS_API_KEY: z.string().optional(),
    ELEVENLABS_VOICE_ID: z.string().optional(),

    // Home Assistant
    HOME_ASSISTANT_URL: z.string().url().optional(),
    HOME_ASSISTANT_TOKEN: z.string().optional(),

    // AWS Bedrock
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),

    // Gmail/Google Integration
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Model failover (comma-separated provider list to try on failure)
    MODEL_FAILOVER_PROVIDERS: z.string().optional(),

    // Bonjour/mDNS
    BONJOUR_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true"),

    // Notion Integration
    NOTION_CLIENT_ID: z.string().optional(),
    NOTION_CLIENT_SECRET: z.string().optional(),
    NOTION_REDIRECT_URI: z.string().url().optional(),

    // Figma Integration (Design-to-Code / Architecture mode)
    FIGMA_CLIENT_ID: z.string().optional(),
    FIGMA_CLIENT_SECRET: z.string().optional(),
    FIGMA_REDIRECT_URI: z.string().url().optional(),

    // Twitter/X Integration
    TWITTER_CLIENT_ID: z.string().optional(),
    TWITTER_CLIENT_SECRET: z.string().optional(),

    // GitHub Integration
    GITHUB_TOKEN: z.string().optional(),
    GITHUB_WEBHOOK_SECRET: z.string().optional(),
    GITHUB_APP_ID: z.string().optional(),
    GITHUB_PRIVATE_KEY: z.string().optional(),

    // Pinecone Vector Store (RAG)
    PINECONE_API_KEY: z.string().optional(),
    PINECONE_INDEX: z.string().optional(),
    PINECONE_HOST: z.string().optional(),
    PINECONE_NAMESPACE: z.string().optional(),

    // RAG Configuration
    RAG_INDEX_PATH: z.string().default("./data/rag-index.json"),
    RAG_LLM_MODEL: z.string().optional(),
    RAG_VECTOR_STORE: z.enum(["memory", "pinecone", "qdrant"]).optional(),
    RAG_CONTEXT_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    RAG_RERANKER: z.string().optional(),
    RAG_RERANKER_URL: z.string().url().optional(),
    RAG_CLAUDE_FALLBACK: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    RAG_EMBED_MODEL: z.string().optional(),
    RAG_MEMORY_INDEX_PATH: z.string().optional(),
    RAG_NAMESPACE: z.string().optional(),
    REINDEX_SECRET: z.string().optional(),
    RAG_INTENT_GUIDED: z
      .string()
      .optional()
      .transform((v) => v !== "false" && v !== "0"),
    INTENT_RAG_AUGMENT_ENRICH: z
      .string()
      .optional()
      .transform((v) => v !== "false" && v !== "0"),

    // Database URL (PostgreSQL - alternative to SQLite)
    DATABASE_URL: z.string().url().optional(),
  })
  .refine(
    (data) => {
      // Require at least one AI provider (skip in test environment or when mock mode enabled)
      if (isTestEnv || data.MOCK_AI_MODE) return true;

      // Check if any provider is configured
      const hasProvider = Boolean(
        data.NVIDIA_NIM_API_KEY || data.OPENROUTER_API_KEY || data.GROQ_API_KEY,
      );

      return hasProvider;
    },
    {
      message:
        "At least one AI provider API key is required (NVIDIA_NIM_API_KEY, OPENROUTER_API_KEY, or GROQ_API_KEY). Set MOCK_AI_MODE=true for zero-config mode. Get free keys: https://build.nvidia.com/",
    },
  )
  .superRefine((data, ctx) => {
    const isProd = data.NODE_ENV === "production";
    const strict = isProd && data.SECURITY_STRICT_PROD;

    if (!strict) return;

    if (!data.CORS_ORIGINS || !data.CORS_ORIGINS.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGINS"],
        message:
          "CORS_ORIGINS is required in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (data.CORS_ORIGINS?.includes("*")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGINS"],
        message: 'CORS_ORIGINS must not include "*" in production',
      });
    }

    if (!data.ALLOWED_HOSTS || !data.ALLOWED_HOSTS.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ALLOWED_HOSTS"],
        message:
          "ALLOWED_HOSTS is required in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (!data.REQUIRE_AUTH_FOR_API) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["REQUIRE_AUTH_FOR_API"],
        message:
          "REQUIRE_AUTH_FOR_API must be true in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (!data.BLOCK_SUSPICIOUS_PROMPTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BLOCK_SUSPICIOUS_PROMPTS"],
        message:
          "BLOCK_SUSPICIOUS_PROMPTS must be true in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (!data.OUTPUT_FILTER_PII) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OUTPUT_FILTER_PII"],
        message:
          "OUTPUT_FILTER_PII must be true in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (!data.OUTPUT_FILTER_HARMFUL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OUTPUT_FILTER_HARMFUL"],
        message:
          "OUTPUT_FILTER_HARMFUL must be true in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (!data.STRICT_COMMAND_ALLOWLIST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRICT_COMMAND_ALLOWLIST"],
        message:
          "STRICT_COMMAND_ALLOWLIST must be true in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (!data.METRICS_AUTH || !data.METRICS_AUTH.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["METRICS_AUTH"],
        message:
          "METRICS_AUTH is required in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (!data.MASTER_KEY || data.MASTER_KEY.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MASTER_KEY"],
        message:
          "MASTER_KEY (32+ chars) is required in production when SECURITY_STRICT_PROD=true",
      });
    }

    if (!data.SECURITY_SCAN_ROOT || !data.SECURITY_SCAN_ROOT.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SECURITY_SCAN_ROOT"],
        message:
          "SECURITY_SCAN_ROOT is required in production when SECURITY_STRICT_PROD=true",
      });
    }
  });

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

// Validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const issues = parseResult.error.issues.map((i) => {
    const field = i.path.join(".");
    const message = i.message;

    // Add helpful hints for common issues
    const hints: Record<string, string> = {
      "At least one AI provider":
        "💡 Try MOCK_AI_MODE=true for zero-config, or get free key: https://build.nvidia.com/",
      "CORS_ORIGINS is required":
        "💡 Example: CORS_ORIGINS=https://yourdomain.com",
      "ALLOWED_HOSTS is required":
        "💡 Example: ALLOWED_HOSTS=yourdomain.com,app.yourdomain.com",
      "METRICS_AUTH is required": "💡 Example: METRICS_AUTH=username:password",
      "MASTER_KEY (32+ chars) is required":
        "💡 Generate: openssl rand -base64 32",
    };

    const hint = Object.entries(hints).find(([key]) =>
      message.includes(key),
    )?.[1];
    return hint ? `${field}: ${message}\n  ${hint}` : `${field}: ${message}`;
  });

  log.error("");
  log.error(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  log.error(
    "║                                                                ║",
  );
  log.error(
    "║  ❌  Configuration Error - Cannot Start Server                ║",
  );
  log.error(
    "║                                                                ║",
  );
  log.error(
    "╚════════════════════════════════════════════════════════════════╝",
  );
  log.error("");

  issues.forEach((issue) => {
    log.error(`  ${issue}`);
    log.error("");
  });

  log.error("📝 Quick fixes:");
  log.error("  1. Copy template: cp backend/.env.minimal backend/.env");
  log.error('  2. For mock mode: echo "MOCK_AI_MODE=true" > backend/.env');
  log.error("  3. Full setup: see docs/GETTING_STARTED.md");
  log.error("");
  log.error(`Working directory: ${process.cwd()}`);
  log.error(`Searched for .env in: ${envPath ?? "default location"}`);
  log.error("");

  // In production, exit immediately on invalid config
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

// Export validated env (with defaults applied)
export const env: Env = parseResult.success
  ? parseResult.data
  : envSchema.parse({
    ...process.env,
    NVIDIA_NIM_API_KEY: "invalid-key-see-errors-above",
  });

// Log successful validation (never log raw secrets or key material in production)
if (parseResult.success) {
  const providers: string[] = [];
  if (env.NVIDIA_NIM_API_KEY) providers.push("NVIDIA NIM");
  if (env.OPENROUTER_API_KEY) providers.push("OpenRouter");
  if (env.GROQ_API_KEY) providers.push("Groq");
  if (env.OLLAMA_BASE_URL && env.OLLAMA_BASE_URL !== "http://localhost:11434") {
    providers.push("Ollama");
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
      providers: providers.length
        ? providers
        : env.MOCK_AI_MODE
          ? ["MOCK"]
          : undefined,
      features: Object.keys(features).length ? features : undefined,
      redis:
        env.REDIS_URL && env.REDIS_URL.trim()
          ? env.REDIS_URL.replace(/:[^:@]+@/, ":****@") // hide password in logs
          : env.REDIS_HOST
            ? `${env.REDIS_HOST}:${env.REDIS_PORT}`
            : undefined,
      nimUrl: env.NVIDIA_NIM_URL || undefined,
    },
    "Environment validated successfully",
  );

  if (env.MOCK_AI_MODE) {
    log.warn("");
    log.warn(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    log.warn(
      "║                                                                ║",
    );
    log.warn(
      "║  🤖  MOCK MODE ACTIVE - Zero-config exploration enabled       ║",
    );
    log.warn(
      "║                                                                ║",
    );
    log.warn(
      "║  AI responses will be realistic placeholders.                 ║",
    );
    log.warn(
      "║  To enable real AI:                                           ║",
    );
    log.warn(
      "║    1. Copy backend/.env.minimal to backend/.env              ║",
    );
    log.warn(
      "║    2. Uncomment ONE provider key                             ║",
    );
    log.warn(
      "║    3. Set MOCK_AI_MODE=false                                 ║",
    );
    log.warn(
      "║    4. Restart the server                                     ║",
    );
    log.warn(
      "║                                                                ║",
    );
    log.warn(
      "║  Free API keys: https://build.nvidia.com/                    ║",
    );
    log.warn(
      "║                                                                ║",
    );
    log.warn(
      "╚════════════════════════════════════════════════════════════════╝",
    );
    log.warn("");
  }
}

// Also export raw process.env for backwards compatibility
export default process.env;

/**
 * Get API key for a provider. Abstraction for future secret manager integration.
 * When SECRET_MANAGER_URL is set, this could fetch from Vault/AWS/GCP; for now uses env.
 */
export type ApiProvider =
  | "nvidia_nim"
  | "openrouter"
  | "ollama"
  | "jan"
  | "github_copilot"
  | "kimi"
  | "anthropic"
  | "mistral"
  | "groq"
  | "google";

export function getApiKey(provider: ApiProvider): string | undefined {
  switch (provider) {
    case "nvidia_nim":
      return env.NVIDIA_NIM_API_KEY;
    case "openrouter":
      return env.OPENROUTER_API_KEY;
    case "ollama":
    case "jan":
      // Local providers typically don't require an API key
      return undefined;
    case "github_copilot":
      return env.GITHUB_COPILOT_TOKEN;
    case "kimi":
      return env.KIMI_API_KEY;
    case "anthropic":
      return env.ANTHROPIC_API_KEY;
    case "mistral":
      return env.MISTRAL_API_KEY;
    case "groq":
      return env.GROQ_API_KEY;
    case "google":
      return env.GOOGLE_AI_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Check if a provider is configured and available
 */
export function isProviderConfigured(provider: ApiProvider): boolean {
  switch (provider) {
    case "nvidia_nim":
      return Boolean(env.NVIDIA_NIM_API_KEY);
    case "openrouter":
      return Boolean(env.OPENROUTER_API_KEY);
    case "ollama":
      return Boolean(env.OLLAMA_BASE_URL);
    case "jan":
      return true; // Jan is always local
    case "github_copilot":
      return Boolean(env.GITHUB_COPILOT_TOKEN);
    case "kimi":
      return Boolean(env.KIMI_API_KEY);
    case "anthropic":
      return Boolean(env.ANTHROPIC_API_KEY);
    case "mistral":
      return Boolean(env.MISTRAL_API_KEY);
    case "groq":
      return Boolean(env.GROQ_API_KEY);
    case "google":
      return Boolean(env.GOOGLE_AI_API_KEY);
    default:
      return false;
  }
}

/**
 * Get all configured providers
 */
export function getConfiguredProviders(): ApiProvider[] {
  const providers: ApiProvider[] = [];
  if (env.NVIDIA_NIM_API_KEY) providers.push("nvidia_nim");
  if (env.OPENROUTER_API_KEY) providers.push("openrouter");
  if (env.OLLAMA_BASE_URL) providers.push("ollama");
  providers.push("jan"); // Jan is always available (local)
  if (env.GITHUB_COPILOT_TOKEN) providers.push("github_copilot");
  if (env.KIMI_API_KEY) providers.push("kimi");
  if (env.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (env.MISTRAL_API_KEY) providers.push("mistral");
  if (env.GROQ_API_KEY) providers.push("groq");
  if (env.GOOGLE_AI_API_KEY) providers.push("google");
  return providers;
}

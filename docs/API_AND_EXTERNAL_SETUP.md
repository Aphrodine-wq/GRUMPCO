# API and External Setup Reference

This document lists **every** API key, external service, and environment variable needed for G-Rump to work. Copy `backend/.env.example` to `backend/.env` and fill in the values you need.

---

## Core (Required for basic AI)

### AI provider (choose one or more)

| Variable | Purpose | Where to get it | Required |
|----------|---------|-----------------|----------|
| `MOCK_AI_MODE` | Set `true` for zero-config placeholder AI (no keys) | — | Optional; use for quick try |
| `NVIDIA_NIM_API_KEY` | Primary AI (Nemotron, Llama, Mistral, etc.) | [build.nvidia.com](https://build.nvidia.com/) | Yes* |
| `NVIDIA_NIM_URL` | Self-hosted NIM base URL (omit for cloud) | Your NIM endpoint | Optional |
| `OPENROUTER_API_KEY` | Multi-model fallback | [openrouter.ai](https://openrouter.ai) | Optional |
| `GROQ_API_KEY` | Fast inference | [groq.com](https://groq.com) | Optional |
| `TOGETHER_API_KEY` | Open models | [together.ai](https://together.ai) | Optional |
| `OLLAMA_BASE_URL` | Local models (default `http://localhost:11434`) | Local Ollama | Optional |

\* Required unless `MOCK_AI_MODE=true` or another provider is set.

**Multi-provider:** Set `MULTI_PROVIDER_ROUTING=true` and optionally `ROUTER_FAST_PROVIDER`, `ROUTER_QUALITY_PROVIDER`, `ROUTER_CODING_PROVIDER`.

### Server

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | Backend port | `3000` |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated) | e.g. `http://localhost:5173` |

### Database

| Variable | Purpose | Default |
|----------|---------|---------|
| `DB_PATH` | SQLite file path (local dev) | `./data/grump.db` |
| `DATABASE_URL` | PostgreSQL URL (alternative to SQLite) | — |

---

## Auth (optional; for OAuth / Supabase)

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `SUPABASE_URL` | Supabase project URL | [supabase.com](https://supabase.com) dashboard |
| `SUPABASE_ANON_KEY` | Supabase anon key (Google/GitHub/Discord OAuth) | Same dashboard |
| `SUPABASE_SERVICE_KEY` | Service role key (server-only) | Same dashboard |
| `PUBLIC_BASE_URL` | Backend URL for OAuth callbacks | e.g. `http://localhost:3000` |
| `FRONTEND_URL` | Frontend URL after OAuth | e.g. `http://localhost:5173` |
| `GITHUB_OAUTH_REDIRECT_URL` | Override GitHub callback | Optional |
| `DISCORD_OAUTH_REDIRECT_URL` | Override Discord callback | Optional |

Enable providers in Supabase Dashboard → Authentication → Providers.

---

## Integrations (optional)

### Figma (Design-to-Code / Architecture)

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `FIGMA_CLIENT_ID` | OAuth app client ID | [figma.com/developers/apps](https://www.figma.com/developers/apps) |
| `FIGMA_CLIENT_SECRET` | OAuth app secret | Same |
| `FIGMA_REDIRECT_URI` | Callback URL | e.g. `http://localhost:3000/api/figma/callback` |

### Stripe (billing)

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `STRIPE_SECRET_KEY` | Stripe API key | [dashboard.stripe.com](https://dashboard.stripe.com) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Stripe webhooks |

### Twilio (SMS / voice / WhatsApp)

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `MESSAGING_PROVIDER` | Set `twilio` to enable | — |
| `TWILIO_ACCOUNT_SID` | Twilio account | [twilio.com](https://www.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Same |
| `TWILIO_REPLY_TO_NUMBER` | Outbound number | Same |
| `TWILIO_WEBHOOK_SECRET` | Inbound webhook verification | Your secret |
| `TWILIO_WHATSAPP_NUMBER` | WhatsApp number (optional) | Same |

### Telegram

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `TELEGRAM_BOT_TOKEN` | Bot token | [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook secret | Your secret; set webhook: `https://api.telegram.org/bot{TOKEN}/setWebhook?url={PUBLIC_URL}/api/messaging/telegram` |

### Slack

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `SLACK_CLIENT_ID` | OAuth client ID | [api.slack.com](https://api.slack.com) |
| `SLACK_CLIENT_SECRET` | OAuth secret | Same |
| `SLACK_SIGNING_SECRET` | Events API signing secret | Same |
| `SLACK_BOT_TOKEN` | Bot token (after install) | Same |

### Discord

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `DISCORD_CLIENT_ID` | OAuth client ID | [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_CLIENT_SECRET` | OAuth secret | Same |
| `DISCORD_BOT_TOKEN` | Bot token; enable Message Content intent | Same |

### Notion

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `NOTION_CLIENT_ID` | OAuth client ID | [notion.so/my-integrations](https://www.notion.so/my-integrations) |
| `NOTION_CLIENT_SECRET` | OAuth secret | Same |
| `NOTION_REDIRECT_URI` | Callback URL | e.g. `http://localhost:5173/notion/callback` |

### GitHub

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `GITHUB_TOKEN` | Personal or app token | [github.com/settings/tokens](https://github.com/settings/tokens) |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret for PR/issue events | Your repo webhook |
| `GITHUB_APP_ID` | GitHub App ID (optional) | GitHub App settings |
| `GITHUB_PRIVATE_KEY` | GitHub App private key (optional) | Same |

### Gmail / Google

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | OAuth secret | Same |

### Other integrations (env names only)

- **Spotify:** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- **Obsidian:** `OBSIDIAN_VAULT_PATH`
- **ElevenLabs:** `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
- **Home Assistant:** `HOME_ASSISTANT_URL`, `HOME_ASSISTANT_TOKEN`
- **AWS Bedrock:** `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Twitter/X:** `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`

---

## Observability (optional)

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `SENTRY_DSN` | Error tracking | [sentry.io](https://sentry.io) |
| `SENTRY_DEBUG` | Sentry debug mode | `true` / `false` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry OTLP endpoint | Your OTEL collector (e.g. Datadog, Grafana) |
| `OTEL_METRICS_EXPORTER` | OTLP metrics exporter | e.g. `otlp` |
| `OTEL_TRACES_EXPORTER` | OTLP traces exporter | e.g. `otlp` |
| `OTEL_SERVICE_NAME` | Service name in traces | e.g. `grump-backend` |
| `METRICS_AUTH` | Basic auth for `/metrics` (recommended in prod) | Your secret |
| `OTLP_ENDPOINT` | Legacy name for OTLP endpoint | Same as above |

---

## Billing & usage (optional)

- **Stripe:** See Integrations → Stripe.
- Credits/limits are configured in `backend/src/config/pricing.ts` (free/pro/team tiers). No env vars for tier limits; optional billing API can use Stripe.

---

## Optional backend features

### Redis (rate limiting, cache, BullMQ)

| Variable | Purpose | Default |
|----------|---------|---------|
| `REDIS_HOST` | Redis host (leave empty to disable) | — |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | — |

### Docker sandbox (code execution)

| Variable | Purpose | Default |
|----------|---------|---------|
| `DOCKER_HOST` | Docker socket or URL | `unix:///var/run/docker.sock` |
| `SANDBOX_TIMEOUT_MS` | Max execution time (ms) | `60000` |
| `SANDBOX_MEMORY_LIMIT` | Container memory limit | `512m` |

### RAG (document search)

| Variable | Purpose | Default |
|----------|---------|---------|
| `RAG_INDEX_PATH` | File-based index path | `./data/rag-index.json` |
| `RAG_LLM_MODEL` | Model for RAG | e.g. `moonshotai/kimi-k2.5` |
| `RAG_VECTOR_STORE` | `memory`, `pinecone`, or `qdrant` | — |
| `PINECONE_API_KEY` | Pinecone API key | [pinecone.io](https://www.pinecone.io) |
| `PINECONE_INDEX` | Pinecone index name | — |
| `PINECONE_HOST` | Pinecone host | — |
| `PINECONE_NAMESPACE` | Namespace | — |
| `REINDEX_SECRET` | Secret to trigger reindex | — |
| `RAG_CONTEXT_ENABLED` | Enable RAG context | Optional |
| `RAG_RERANKER`, `RAG_RERANKER_URL` | Reranker model/URL | Optional |

### Voice (ASR / TTS via NVIDIA Build)

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `NVIDIA_BUILD_API_KEY` | NVIDIA Build / NVCF API key | [build.nvidia.com](https://build.nvidia.com) |
| `NVIDIA_ASR_FUNCTION_ID` | ASR function ID | NVCF catalog |
| `NVIDIA_TTS_FUNCTION_ID` | TTS function ID | NVCF catalog |
| `NVIDIA_ASR_URL`, `NVIDIA_TTS_URL` | Override full URLs | Optional |

Set `DISABLE_VOICE=true` to disable voice features.

### Intent compiler (NL → JSON)

| Variable | Purpose | Default |
|----------|---------|---------|
| `GRUMP_INTENT_PATH` | Path to intent compiler binary | — (LLM-only fallback) |
| `GRUMP_USE_WASM_INTENT` | Use WASM parser when available | Optional |
| `GRUMP_USE_WORKER_POOL_INTENT` | Offload to worker pool | Optional |
| `INTENT_COMPILER_MODE` | `hybrid`, `rust-first`, `llm-first` | `rust-first` |

### Agent governance

| Variable | Purpose | Default |
|----------|---------|---------|
| `AGENT_ACCESS_POLICY` | `block`, `allowlist`, `audit_only` | `block` |
| `AGENT_ALLOWLIST` | Comma-separated agent IDs (when allowlist) | — |
| `AGENT_RATE_LIMIT_PER_HOUR` | Max requests per allowlisted agent | `10` |
| `FREE_AGENT_ENABLED` | Full-agent mode (all tools, no approval gates) | `false` |

### Security (production)

| Variable | Purpose | Default |
|----------|---------|---------|
| `BLOCK_SUSPICIOUS_PROMPTS` | Block prompt injection patterns | `false` |
| `REQUIRE_AUTH_FOR_API` | Require auth for /api/chat, /api/ship, /api/codegen | `false` |
| `SECURITY_STRICT_PROD` | Enforce prod security checks | `true` |
| `ALLOWED_HOSTS` | Comma-separated host allowlist | `localhost,127.0.0.1` |
| `OUTPUT_FILTER_PII` | Redact PII in responses | `false` |
| `OUTPUT_FILTER_HARMFUL` | Flag harmful code patterns | `false` |
| `STRICT_COMMAND_ALLOWLIST` | Restrict bash_execute commands | `false` |
| `SECURITY_SCAN_ROOT` | Root path for /api/security/* | — |
| `MASTER_KEY` | 32+ char key for encryption (integrations) | — |

### Webhooks & jobs

| Variable | Purpose |
|----------|---------|
| `GRUMP_WEBHOOK_SECRET` | Webhook signature verification |
| `GRUMP_WEBHOOK_URLS` | Outbound webhook URLs |
| `QSTASH_TOKEN`, `QSTASH_URL` | Upstash QStash (serverless jobs) |
| `JOB_WORKER_SECRET` | Worker auth for jobs |

---

## NIM-specific (optional)

| Variable | Purpose | Default / notes |
|----------|---------|------------------|
| `NIM_EMBED_BATCH_SIZE` | Embedding batch size (1–512) | 256 |
| `NIM_EMBED_MAX_WAIT_MS` | Max wait to fill batch (ms) | 50 |
| `NIM_RETRY_ENABLED` | Retry on failure | `true` |
| `NIM_TIMEOUT_DEFAULT_MS` | Default request timeout (ms) | 120000 |
| `NIM_TIMEOUT_405B_MS` | Timeout for 405B models | 180000 |
| `NIM_TIMEOUT_ULTRA_MS`, `NIM_TIMEOUT_SUPER_MS` | Timeouts for Ultra/Super | 150000 / 120000 |
| `USE_NEMOTRON_SWARM`, `USE_NEMOTRON_3_FOR_RAG` | Feature flags for model routing | Optional |

---

## Quick start checklist

1. Copy `backend/.env.example` to `backend/.env`.
2. **Core AI:** Set `NVIDIA_NIM_API_KEY` (from [build.nvidia.com](https://build.nvidia.com)) **or** set `MOCK_AI_MODE=true` to skip keys.
3. **Server:** Set `CORS_ORIGINS` to your frontend origin (e.g. `http://localhost:5173`).
4. **Database:** Default SQLite (`DB_PATH`) is fine for local dev.
5. Run `npm run build:packages` then `npm run dev`.

All other variables are optional and only needed when you enable the corresponding feature (auth, Figma, Stripe, Twilio, RAG, etc.). See `backend/.env.example` and `backend/src/config/env.ts` for the full schema and validation.

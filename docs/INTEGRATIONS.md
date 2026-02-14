# G-Rump Integrations

> **Version:** 2.1.0 | **Last Updated:** February 11, 2026

G-Rump supports integrations with messaging platforms, version control, and productivity tools.

## AI Providers

| Provider | Status | Configuration |
|----------|--------|---------------|
| **NVIDIA NIM** | ✅ Active | `NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_URL` |
| **Anthropic Claude** | ✅ Active | `ANTHROPIC_API_KEY` |
| **OpenRouter** | ✅ Active | `OPENROUTER_API_KEY` |
| **Ollama** (local) | ✅ Active | Auto-detected when running locally |

## Messaging

| Platform | Status | Configuration |
|----------|--------|---------------|
| **Telegram** | ✅ Active | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL` |
| **Discord** | ✅ Active | `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| **Twilio** (SMS/WhatsApp) | ✅ Active | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| **Slack** | 🔜 Planned | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` |

## Version Control & Productivity

| Platform | Status | Configuration |
|----------|--------|---------------|
| **GitHub** | ✅ Active | `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` |
| **Notion** | 🔜 Planned | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` |
| **Jira** | 🔜 Planned | — |

## Authentication Providers

| Provider | Status |
|----------|--------|
| **Google OAuth** | ✅ Active |
| **GitHub OAuth** | ✅ Active |
| **Discord OAuth** | ✅ Active |

## Infrastructure

| Service | Status | Purpose |
|---------|--------|---------|
| **Supabase** | ✅ Active | Database + Auth (production) |
| **Redis** | ✅ Active | Cache, rate limiting, job queue |
| **Pinecone** | ✅ Active | Vector database for RAG |
| **Stripe** | ✅ Active | Billing and subscriptions |
| **Prometheus** | ✅ Active | Metrics collection |
| **OpenTelemetry** | ✅ Active | Distributed tracing |

## MCP (Model Context Protocol)

G-Rump consumes tools from external MCP servers. Configure via `MCP_SERVERS` environment variable. See backend `.env.example` for details.

## See Also

- [GETTING_STARTED.md](./GETTING_STARTED.md) — Setup instructions
- [BACKENDS.md](./BACKENDS.md) — Backend configuration
- [API.md](./API.md) — Complete API reference

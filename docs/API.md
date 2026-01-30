# G-Rump API Reference

Public API endpoints grouped by domain. For auth and env configuration in production, see [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

## Core

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/stream` | Streaming chat with AI (tools, plan mode, agent profile). |
| POST | `/api/ship/start` | Start SHIP workflow (design → spec → plan → code). |
| POST | `/api/plan/generate` | Generate a plan. |
| POST | `/api/spec/*` | Spec mode endpoints. |
| POST | `/api/diagram/*` | Diagram generation. |
| POST | `/api/intent/*` | Intent parsing. |
| POST | `/api/architecture/*` | Architecture generation. |
| POST | `/api/prd/*` | PRD generation. |
| POST | `/api/codegen/*` | Code generation (start, status, download). |

## Cost and analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cost/summary` | Cost summary. |
| GET | `/api/cost/budget` | Budget status. |
| POST | `/api/cost/budget` | Set budget. |
| GET | `/api/cost/recommendations` | Optimization tips. |
| GET | `/api/cost/stats` | System statistics. |

## Auth and billing

| Method | Path | Description |
|--------|------|-------------|
| * | `/auth/*` | Auth routes (login, logout, me, etc.). |
| GET/POST | `/api/billing/*` | Billing and usage. |
| POST | `/api/billing/webhook` | Stripe webhook (raw body; signature verified). |

## Webhooks and events

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/trigger` | Inbound trigger (ship/chat). Auth: X-Webhook-Secret or body.secret. |
| POST | `/api/webhooks/outbound` | Register outbound webhook URL. Auth: X-Webhook-Secret or body.secret. In production, URL must be https. |
| GET | `/api/events/stream` | SSE event stream (ship.completed, codegen.ready, etc.). |

## Agents, jobs, workspace

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/agents/*` | Agent endpoints. |
| * | `/api/jobs/*` | Job status and control. |
| * | `/api/workspace/*` | Workspace operations. |

## RAG, voice, memory, vision

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/rag/*` | RAG (retrieval) endpoints. |
| * | `/api/voice/*` | Voice (ASR/TTS) endpoints. |
| * | `/api/memory/*` | Memory endpoints. |
| * | `/api/vision/*` | Vision endpoints. |

## Security and compliance

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/security/scan` | Security scan. Body: workspacePath (must be under SECURITY_SCAN_ROOT or cwd), scanTypes, severity, excludePatterns. |
| POST | `/api/security/sbom` | Generate SBOM. Body: workspacePath, format, includeDevDeps. |
| POST | `/api/security/compliance` | Compliance report. Body: workspacePath, standard, projectType. |
| POST | `/api/security/secrets-audit` | Secrets audit. Body: workspacePath, excludePatterns, customPatterns. |
| GET | `/api/security/standards` | List compliance standards. |
| GET | `/api/security/health` | Security service health. |

## Other API

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/analyze/*` | Codebase analysis (e.g. architecture). |
| * | `/api/settings/*` | Settings. |
| * | `/api/skills-api/*` | Skills API. |
| * | `/api/messaging/*` | Messaging (e.g. Twilio inbound). |
| * | `/api/collaboration/*` | Collaboration (requires auth). |
| * | `/api/analytics/*` | Analytics (requires auth for usage/summary). |
| * | `/api/templates/*` | Templates. |
| * | `/api/github/*` | GitHub integration. |
| * | `/api/infra/*` | Infrastructure. |
| * | `/api/testing/*` | Testing. |
| * | `/api/expo-test/*` | Expo test. |

## Health and metrics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check. |
| GET | `/metrics` | Prometheus metrics. In production, protect with METRICS_AUTH (Basic). |

## Auth and production

- When `REQUIRE_AUTH_FOR_API=true`, `/api/chat`, `/api/ship`, and `/api/codegen` require a valid Bearer token (Supabase JWT).
- Webhook routes require `GRUMP_WEBHOOK_SECRET` in production; Stripe webhook requires `STRIPE_WEBHOOK_SECRET`; Twilio messaging requires `TWILIO_WEBHOOK_SECRET` when used.
- See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for env vars and security.

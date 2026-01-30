---
layout: doc
title: API Reference
---

# G-Rump API Reference

Public API endpoints grouped by domain. For auth and env configuration in production, see the [Production Checklist](/guide/production).

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

## Cost and Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cost/summary` | Cost summary. |
| GET | `/api/cost/budget` | Budget status. |
| POST | `/api/cost/budget` | Set budget. |
| GET | `/api/cost/recommendations` | Optimization tips. |
| GET | `/api/cost/stats` | System statistics. |

## Auth and Billing

| Method | Path | Description |
|--------|------|-------------|
| * | `/auth/*` | Auth routes (login, logout, me, etc.). |
| GET/POST | `/api/billing/*` | Billing and usage. |
| POST | `/api/billing/webhook` | Stripe webhook (raw body; signature verified). |

## Webhooks and Events

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/trigger` | Inbound trigger (ship/chat). Auth: X-Webhook-Secret or body.secret. |
| POST | `/api/webhooks/outbound` | Register outbound webhook URL. Auth: X-Webhook-Secret or body.secret. |
| GET | `/api/events/stream` | SSE event stream (ship.completed, codegen.ready, etc.). |

## Agents, Jobs, Workspace

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/agents/*` | Agent endpoints. |
| * | `/api/jobs/*` | Job status and control. |
| * | `/api/workspace/*` | Workspace operations. |

## RAG, Voice, Memory, Vision

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/rag/*` | RAG (retrieval) endpoints. |
| * | `/api/voice/*` | Voice (ASR/TTS) endpoints. |
| * | `/api/memory/*` | Memory endpoints. |
| * | `/api/vision/*` | Vision endpoints. |

## Security and Compliance

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/security/scan` | Security scan. |
| POST | `/api/security/sbom` | Generate SBOM. |
| POST | `/api/security/compliance` | Compliance report. |
| POST | `/api/security/secrets-audit` | Secrets audit. |
| GET | `/api/security/standards` | List compliance standards. |
| GET | `/api/security/health` | Security service health. |

## Health and Metrics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check. |
| GET | `/metrics` | Prometheus metrics. In production, protect with METRICS_AUTH (Basic). |

## Auth and Production

- When `REQUIRE_AUTH_FOR_API=true`, `/api/chat`, `/api/ship`, and `/api/codegen` require a valid Bearer token (Supabase JWT).
- Webhook routes require `GRUMP_WEBHOOK_SECRET` in production.
- See [Production Checklist](/guide/production) for env vars and security.

# G-Rump API Reference

> **Last Updated:** January 2026

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

### Example: Start SHIP Workflow

**Request:**
```bash
curl -X POST http://localhost:3000/api/ship/start \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "Build a todo app with user authentication",
    "constraints": {
      "techStack": ["React", "Node.js", "PostgreSQL"],
      "features": ["user-auth", "crud-operations"]
    }
  }'
```

**Response:**
```json
{
  "jobId": "ship-abc123",
  "status": "started",
  "message": "SHIP workflow initiated",
  "estimatedSteps": ["design", "spec", "plan", "code"]
}
```

### Example: Generate Architecture Diagram

**Request:**
```bash
curl -X POST http://localhost:3000/api/architecture/generate \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "E-commerce platform with payment processing",
    "diagramType": "c4-container"
  }'
```

**Response:**
```json
{
  "architectureId": "arch-xyz789",
  "diagram": "```mermaid\nC4Container\n  title E-commerce Platform...\n```",
  "summary": "3-tier architecture with React frontend, Node.js API, and PostgreSQL database",
  "components": ["Frontend", "API Gateway", "Auth Service", "Payment Service", "Database"]
}
```

### Example: Streaming Chat

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "messages": [{"role": "user", "content": "Explain the SHIP workflow"}],
    "agentProfile": "architect"
  }'
```

**Response (SSE stream):**
```
data: {"type":"chunk","content":"The SHIP workflow consists of..."}
data: {"type":"chunk","content":" four main phases:"}
data: {"type":"done","usage":{"promptTokens":50,"completionTokens":200}}
```

## Cost and analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cost/summary` | Cost summary. |
| GET | `/api/cost/budget` | Budget status. |
| POST | `/api/cost/budget` | Set budget. |
| GET | `/api/cost/recommendations` | Optimization tips. |
| GET | `/api/cost/stats` | System statistics. |

### Example: Get Cost Summary

**Request:**
```bash
curl http://localhost:3000/api/cost/summary \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "totalCost": 12.50,
  "currency": "USD",
  "period": "2026-01",
  "breakdown": {
    "chat": 5.20,
    "codegen": 4.80,
    "architecture": 2.50
  },
  "tokenUsage": {
    "prompt": 125000,
    "completion": 89000
  }
}
```

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

### Example: Health Check

**Request:**
```bash
curl http://localhost:3000/health/quick
```

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "api_key_configured": true,
    "server_responsive": true,
    "database_connected": true
  },
  "timestamp": "2026-01-30T12:00:00.000Z",
  "version": "1.0.0"
}
```

## Auth and production

- When `REQUIRE_AUTH_FOR_API=true`, `/api/chat`, `/api/ship`, and `/api/codegen` require a valid Bearer token (Supabase JWT).
- Webhook routes require `GRUMP_WEBHOOK_SECRET` in production; Stripe webhook requires `STRIPE_WEBHOOK_SECRET`; Twilio messaging requires `TWILIO_WEBHOOK_SECRET` when used.
- See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for env vars and security.

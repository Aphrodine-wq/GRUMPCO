# G-Rump API Reference

> **Version:** 2.1.0 | **Last Updated:** February 2026

Complete API reference for the G-Rump platform. For authentication details, see [Security](./SECURITY.md). For production deployment, see [Production](./PRODUCTION.md).

---

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Core APIs](#core-apis)
  - [SHIP Workflow](#ship-workflow)
  - [Chat](#chat)
  - [Code Generation](#code-generation)
  - [Architecture](#architecture)
  - [PRD Generation](#prd-generation)
- [Agent APIs](#agent-apis)
- [RAG APIs](#rag-apis)
- [Cost & Analytics](#cost--analytics)
- [Security APIs](#security-apis)
- [Webhook APIs](#webhook-apis)
- [Health & Metrics](#health--metrics)

---

## Authentication

### Bearer Token (JWT)

When `REQUIRE_AUTH_FOR_API=true`, protected endpoints require a valid Bearer token:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/ship/start
```

### Webhook Secrets

Webhook endpoints require secret validation:

```bash
curl -H "X-Webhook-Secret: <secret>" http://localhost:3000/api/webhooks/trigger
```

---

## Error Handling

All errors follow a standardized format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "projectDescription"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Core APIs

### SHIP Workflow

The SHIP workflow transforms natural language into production-ready code through four phases: **Design** → **Spec** → **Plan** → **Code**.

#### POST `/api/ship/start`

Start a new SHIP workflow session.

**Request:**
```bash
curl -X POST http://localhost:3000/api/ship/start \
  -H "Content-Type: application/json" \
  -d '{
    "projectDescription": "Build a todo app with user authentication and real-time sync",
    "preferences": {
      "techStack": ["React", "Node.js", "PostgreSQL", "Socket.io"],
      "features": ["user-auth", "real-time-sync", "offline-mode"],
      "diagramType": "c4-container"
    },
    "projectId": "proj-123"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectDescription` | string | Yes | Natural language description of the project |
| `preferences` | object | No | Configuration preferences |
| `preferences.techStack` | string[] | No | Preferred technologies |
| `preferences.features` | string[] | No | Required features |
| `preferences.diagramType` | string | No | Diagram type: `flowchart`, `c4-container`, `er`, `sequence` |
| `projectId` | string | No | Associated project ID |

**Response (200):**
```json
{
  "sessionId": "ship-abc123-def456",
  "phase": "design",
  "status": "pending",
  "createdAt": "2026-01-31T12:00:00.000Z"
}
```

#### GET `/api/ship/:sessionId`

Get SHIP session status and results.

**Response (200):**
```json
{
  "sessionId": "ship-abc123-def456",
  "projectDescription": "Build a todo app...",
  "preferences": { "techStack": ["React", "Node.js"] },
  "projectId": "proj-123",
  "phase": "code",
  "status": "completed",
  "designResult": {
    "diagram": "```mermaid\nC4Container...",
    "summary": "3-tier architecture with React frontend...",
    "components": ["Frontend", "API Gateway", "Auth Service"]
  },
  "specResult": {
    "prd": "# Product Requirements Document...",
    "features": [{ "name": "User Authentication", "priority": "high" }]
  },
  "planResult": {
    "tasks": [{ "id": 1, "description": "Setup React app", "status": "done" }]
  },
  "codeResult": {
    "files": 42,
    "downloadUrl": "/api/ship/ship-abc123/code/download"
  },
  "error": null,
  "createdAt": "2026-01-31T12:00:00Z",
  "updatedAt": "2026-01-31T12:05:30Z"
}
```

#### POST `/api/ship/:sessionId/execute`

Enqueue SHIP workflow for execution. Returns immediately.

**Response (202):**
```json
{
  "sessionId": "ship-abc123-def456",
  "jobId": "job-xyz789",
  "status": "running",
  "message": "SHIP mode workflow enqueued"
}
```

#### POST `/api/ship/:sessionId/execute/stream`

Execute SHIP workflow with real-time streaming updates via SSE.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resumeFromPhase` | string | Resume from: `design`, `spec`, `plan`, `code` |

**SSE Events:**

```
event: phase_start
data: {"phase": "design", "message": "Starting design phase"}

event: progress
data: {"phase": "design", "progress": 50, "message": "Generating architecture diagram"}

event: phase_complete
data: {"phase": "design", "result": {...}}

event: done
data: {"status": "completed", "sessionId": "ship-abc123"}
```

---

### Chat

#### POST `/api/chat/stream`

Streaming chat endpoint with tool calling support.

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create a React component for a user profile"}
    ],
    "workspaceRoot": "/path/to/workspace",
    "mode": "normal",
    "agentProfile": "frontend",
    "modelPreset": "quality"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | Message[] | Yes | Chat history |
| `messages[].role` | string | Yes | `user` or `assistant` |
| `messages[].content` | string/array | Yes | Text or multimodal content |
| `workspaceRoot` | string | No | Workspace path for tool execution |
| `mode` | string | No | `normal`, `plan`, `spec`, `execute`, `design` |
| `agentProfile` | string | No | `general`, `router`, `frontend`, `backend`, `devops`, `test` |
| `modelPreset` | string | No | `fast`, `quality`, `balanced` |
| `sessionType` | string | No | `chat`, `gAgent` |
| `toolAllowlist` | string[] | No | Allowed tool names |
| `toolDenylist` | string[] | No | Blocked tool names |
| `autonomous` | boolean | No | Enable autonomous mode |
| `includeRagContext` | boolean | No | Include RAG context |

**SSE Events:**

```
event: message
data: {"type": "chunk", "content": "I'll create a React component..."}

event: tool_call
data: {"type": "tool_call", "tool": "file_write", "args": {...}}

event: tool_result
data: {"type": "tool_result", "tool": "file_write", "result": {...}}

event: done
data: {"type": "done", "usage": {"promptTokens": 100, "completionTokens": 250}}
```

---

### Code Generation

#### POST `/api/codegen/start`

Start code generation from PRD or specification.

**Request:**
```bash
curl -X POST http://localhost:3000/api/codegen/start \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "# Product Requirements Document...",
    "techStack": {
      "frontend": "React",
      "backend": "Express",
      "database": "PostgreSQL"
    },
    "options": {
      "includeTests": true,
      "includeDevOps": true
    }
  }'
```

**Response (200):**
```json
{
  "sessionId": "codegen-abc123",
  "status": "started",
  "estimatedTime": "3-5 minutes"
}
```

#### GET `/api/codegen/:sessionId`

Get code generation status.

**Response (200):**
```json
{
  "sessionId": "codegen-abc123",
  "status": "generating",
  "progress": 65,
  "agents": {
    "architect": "completed",
    "frontend": "generating",
    "backend": "pending",
    "devops": "pending"
  }
}
```

#### GET `/api/codegen/:sessionId/download`

Download generated code as ZIP.

---

### Architecture

#### POST `/api/architecture/generate`

Generate architecture diagram from natural language.

**Request:**
```bash
curl -X POST http://localhost:3000/api/architecture/generate \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "E-commerce platform with payment processing",
    "diagramType": "c4-container",
    "techStack": ["React", "Node.js", "PostgreSQL"]
  }'
```

**Response (200):**
```json
{
  "architectureId": "arch-xyz789",
  "diagram": "```mermaid\nC4Container\n  title E-commerce Platform...",
  "summary": "3-tier architecture with React frontend, Node.js API, and PostgreSQL database",
  "components": [
    { "name": "Frontend", "type": "container", "tech": "React" },
    { "name": "API Gateway", "type": "container", "tech": "Express" },
    { "name": "Payment Service", "type": "container", "tech": "Node.js" }
  ]
}
```

---

### PRD Generation

#### POST `/api/prd/generate`

Generate Product Requirements Document from architecture.

**Request:**
```bash
curl -X POST http://localhost:3000/api/prd/generate \
  -H "Content-Type: application/json" \
  -d '{
    "architectureId": "arch-xyz789",
    "includeApiSpecs": true,
    "includeDataModel": true
  }'
```

**Response (200):**
```json
{
  "prdId": "prd-abc123",
  "content": "# Product Requirements Document...",
  "sections": ["Overview", "Features", "API Specs", "Data Model"]
}
```

---

## Agent APIs

### GET `/api/agents`

List available G-Agents.

**Response (200):**
```json
{
  "agents": [
    {
      "id": "architect",
      "name": "Architect Agent",
      "description": "Validates PRDs and creates generation plans",
      "capabilities": ["validation", "planning", "risk-analysis"]
    },
    {
      "id": "frontend",
      "name": "Frontend Agent",
      "description": "Generates UI components and routing",
      "capabilities": ["react", "vue", "styling", "routing"]
    }
  ]
}
```

### POST `/api/agents/:agentId/execute`

Execute a specific agent with a task.

**Request:**
```bash
curl -X POST http://localhost:3000/api/agents/frontend/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a login form component",
    "context": {
      "framework": "React",
      "styling": "TailwindCSS"
    }
  }'
```

---

## RAG APIs

#### POST `/api/rag/query`

Query the RAG system with intent-guided retrieval.

**Request:**
```bash
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does authentication work?",
    "namespace": "my-project",
    "intentGuided": true,
    "hybrid": true,
    "outputFormat": "structured"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `namespace` | string | No | Document namespace |
| `intentGuided` | boolean | No | Enable intent-guided expansion |
| `hybrid` | boolean | No | Combine vector + keyword search |
| `outputFormat` | string | No | `text`, `structured`, `context` |

**Response (200):**
```json
{
  "results": [
    {
      "content": "Authentication is handled via JWT tokens...",
      "score": 0.95,
      "source": "docs/auth.md",
      "metadata": { "page": 12 }
    }
  ],
  "intentExpansion": ["JWT", "OAuth", "session management"]
}
```

#### POST `/api/rag/index`

Index documents for RAG.

**Request:**
```bash
curl -X POST http://localhost:3000/api/rag/index \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "content": "Document content...",
        "metadata": { "source": "readme.md" }
      }
    ],
    "namespace": "my-project"
  }'
```

---

## Cost & Analytics

### GET `/api/cost/summary`

Get cost summary for current period.

**Response (200):**
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
  },
  "savings": {
    "fromCaching": 8.30,
    "fromRouting": 5.50
  }
}
```

### GET `/api/cost/recommendations`

Get optimization recommendations.

**Response (200):**
```json
{
  "recommendations": [
    {
      "type": "cache",
      "message": "Enable tiered caching to reduce costs by 40%",
      "potentialSavings": 15.00
    }
  ]
}
```

---

## Security APIs

### POST `/api/security/scan`

Run security scan on workspace.

**Request:**
```bash
curl -X POST http://localhost:3000/api/security/scan \
  -H "Content-Type: application/json" \
  -d '{
    "workspacePath": "./my-project",
    "scanTypes": ["secrets", "vulnerabilities", "dependencies"],
    "severity": "medium"
  }'
```

**Response (200):**
```json
{
  "scanId": "scan-abc123",
  "findings": [
    {
      "type": "secret",
      "severity": "high",
      "file": "config.js",
      "line": 45,
      "message": "Hardcoded API key detected"
    }
  ],
  "summary": {
    "critical": 0,
    "high": 1,
    "medium": 3,
    "low": 5
  }
}
```

### POST `/api/security/sbom`

Generate Software Bill of Materials.

**Response (200):**
```json
{
  "sbom": {
    "format": "SPDX",
    "packages": [
      { "name": "express", "version": "5.0.0", "license": "MIT" }
    ]
  }
}
```

---

## Webhook APIs

### POST `/api/webhooks/trigger`

Inbound webhook for external triggers.

**Headers:**
- `X-Webhook-Secret` - Webhook secret (or provide in body)

**Request:**
```bash
curl -X POST http://localhost:3000/api/webhooks/trigger \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: my-secret" \
  -d '{
    "action": "ship",
    "projectDescription": "Build a landing page",
    "callbackUrl": "https://example.com/webhook"
  }'
```

### POST `/api/webhooks/outbound`

Register outbound webhook URL.

**Request:**
```bash
curl -X POST http://localhost:3000/api/webhooks/outbound \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: my-secret" \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["ship.completed", "codegen.ready"]
  }'
```

---

## Health & Metrics

### GET `/health`

Basic health check.

**Response (200):**
```json
{
  "status": "healthy",
  "version": "2.1.0",
  "timestamp": "2026-01-31T12:00:00Z"
}
```

### GET `/health/quick`

Quick health check with key dependencies.

**Response (200):**
```json
{
  "status": "healthy",
  "checks": {
    "api_key_configured": true,
    "server_responsive": true,
    "database_connected": true,
    "redis_connected": false
  },
  "timestamp": "2026-01-31T12:00:00Z",
  "version": "2.1.0"
}
```

### GET `/health/detailed`

Detailed health check with all subsystems.

### GET `/metrics`

Prometheus metrics endpoint.

**Authentication:** Basic auth (if `METRICS_AUTH` configured)

---

## Rate Limiting

Default rate limits per endpoint:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/chat/stream` | 10 | 60 seconds |
| `/api/ship/start` | 5 | 60 seconds |
| `/api/codegen/start` | 3 | 60 seconds |
| `/api/architecture/generate` | 5 | 60 seconds |

Rate limit headers included in responses:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1706707200
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { G-RumpClient } from '@g-rump/sdk';

const client = new G-RumpClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Start SHIP workflow
const session = await client.ship.start({
  projectDescription: 'Build a blog platform',
  preferences: {
    techStack: ['Next.js', 'Prisma', 'PostgreSQL']
  }
});

// Stream execution
for await (const event of client.ship.streamExecute(session.sessionId)) {
  console.log(event.phase, event.progress);
}
```

### Python

```python
from grump import G-RumpClient

client = G-RumpClient(base_url='http://localhost:3000')

# Generate architecture
diagram = client.architecture.generate(
    intent="E-commerce platform",
    diagram_type="c4-container"
)
print(diagram['summary'])
```

### cURL

```bash
# Chat with streaming
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

---

## See Also

- [Getting Started](./GETTING_STARTED.md) - Quick start guide
- [Architecture](./ARCHITECTURE.md) - System design
- [Security](./SECURITY.md) - Security configuration
- [Production](./PRODUCTION.md) - Deployment guide

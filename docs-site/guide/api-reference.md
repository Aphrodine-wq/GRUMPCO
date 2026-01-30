# API Reference

The G-Rump API provides RESTful endpoints for AI-assisted development workflows. All APIs are accessible via the base URL `https://api.grump.dev` (or your self-hosted instance).

## Base URL

```
Production: https://api.grump.dev
Self-hosted: http://localhost:3000 (or your configured port)
```

## Authentication

All API requests require authentication using an API key in the header:

```http
Authorization: Bearer <your-api-key>
```

Or using the `X-API-Key` header:

```http
X-API-Key: <your-api-key>
```

### Getting an API Key

1. Sign up at [G-Rump Dashboard](https://grump.dev/dashboard)
2. Navigate to Settings → API Keys
3. Generate a new key

## Rate Limits

| Tier | Requests/Minute | Requests/Hour | Requests/Month |
|------|-----------------|---------------|----------------|
| Free | 10 | 100 | 50 |
| Pro | 60 | 1,000 | 1,000 |
| Team | 120 | 5,000 | 5,000 |
| Enterprise | Unlimited | Unlimited | Unlimited |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

## Response Format

All responses are JSON with a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "invalid_request",
    "message": "The request was invalid",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## SHIP Workflow Endpoints

The SHIP (Scope → Hypothesis → Implementation → Production) workflow is the core of G-Rump.

### Start SHIP Session

Start a new SHIP workflow session.

```http
POST /api/ship/start
```

**Request Body:**

```json
{
  "projectDescription": "Build a React e-commerce app with Stripe payments",
  "preferences": {
    "techStack": ["react", "node", "stripe"],
    "style": "modern",
    "complexity": "medium"
  },
  "projectId": "proj_123" // Optional
}
```

**Response:**

```json
{
  "sessionId": "ship_session_xyz789",
  "phase": "design",
  "status": "pending",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Get Session Status

Check the status and results of a SHIP session.

```http
GET /api/ship/:sessionId
```

**Response:**

```json
{
  "sessionId": "ship_session_xyz789",
  "projectDescription": "Build a React e-commerce app...",
  "preferences": { ... },
  "projectId": "proj_123",
  "phase": "code",
  "status": "completed",
  "designResult": {
    "status": "completed",
    "architecture": { ... },
    "components": [ ... ]
  },
  "specResult": {
    "status": "completed",
    "specifications": { ... }
  },
  "planResult": {
    "status": "completed",
    "tasks": [ ... ]
  },
  "codeResult": {
    "status": "completed",
    "files": [ ... ]
  },
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:35:00Z"
}
```

### Execute SHIP Workflow

Enqueue the SHIP workflow for execution.

```http
POST /api/ship/:sessionId/execute
```

**Response:**

```json
{
  "sessionId": "ship_session_xyz789",
  "jobId": "job_abc123",
  "status": "running",
  "message": "SHIP mode workflow enqueued"
}
```

### Execute with Streaming

Execute SHIP workflow with real-time streaming updates via SSE.

```http
POST /api/ship/:sessionId/execute/stream
Content-Type: application/json

{
  "resumeFromPhase": "design" // Optional: design, spec, plan, code
}
```

**Response (SSE):**

```
data: {"type": "start", "sessionId": "ship_session_xyz789", "phase": "design"}

data: {"type": "phase_start", "phase": "design"}

data: {"type": "phase_complete", "phase": "design", "result": {...}, "nextPhase": "spec"}

data: {"type": "phase_start", "phase": "spec"}

data: {"type": "complete", "sessionId": "ship_session_xyz789"}
```

## Chat Endpoints

### Streaming Chat

Send messages to the AI with tool calling support.

```http
POST /api/chat/stream
```

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "How do I implement JWT authentication?"
    }
  ],
  "workspaceRoot": "/path/to/project",
  "mode": "normal",
  "agentProfile": "backend",
  "provider": "nim",
  "modelId": "moonshotai/kimi-k2.5",
  "tier": "pro",
  "autonomous": false,
  "preferNim": true,
  "modelPreset": "balanced"
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | Array | Conversation history |
| `workspaceRoot` | String | Directory for file operations |
| `mode` | String | Chat mode: normal, plan, spec, execute, argument |
| `agentProfile` | String | Agent specialization: general, frontend, backend, devops, test |
| `provider` | String | LLM provider: nim, zhipu, copilot, openrouter |
| `modelId` | String | Specific model ID |
| `modelKey` | String | Provider prefix + model (e.g., "nim:moonshotai/kimi-k2.5") |
| `tier` | String | User tier: free, pro, team, enterprise |
| `autonomous` | Boolean | Skip confirmations (Yolo mode) |
| `preferNim` | Boolean | Prefer NVIDIA NIM routing |
| `modelPreset` | String | fast, quality, balanced |

**Response (SSE):**

```
data: {"type": "text", "content": "To implement JWT authentication..."}

data: {"type": "tool_call", "tool": "file_read", "args": {"path": "src/auth.ts"}}

data: {"type": "tool_result", "tool": "file_read", "result": "..."}

data: {"type": "complete"}
```

## Code Generation Endpoints

### Generate Code

Generate code from a completed SHIP session.

```http
POST /api/codegen/:sessionId
```

**Request Body:**

```json
{
  "format": "zip",
  "outputDir": "./generated",
  "includeTests": true,
  "includeDocs": false
}
```

**Response:**

```json
{
  "jobId": "job_codegen_123",
  "status": "queued",
  "estimatedTime": "2m"
}
```

### Get Generated Code

Download or retrieve generated code.

```http
GET /api/codegen/:sessionId/download
```

**Response:**

- If format is `zip`: Binary zip file
- If format is `json`: JSON with file contents
- If format is `files`: Array of file objects

## Architecture Endpoints

### Generate Architecture

Generate system architecture diagrams and specifications.

```http
POST /api/architecture/generate
```

**Request Body:**

```json
{
  "description": "Design a microservices architecture for a fintech app",
  "format": "mermaid",
  "includeC4": true,
  "techStack": ["kubernetes", "postgres", "redis"]
}
```

**Response:**

```json
{
  "diagram": "graph TB...",
  "components": [
    {
      "name": "API Gateway",
      "type": "service",
      "description": "..."
    }
  ],
  "c4Diagrams": {
    "context": "...",
    "container": "..."
  }
}
```

### Analyze Workspace

Analyze an existing codebase and generate architecture documentation.

```http
POST /api/architecture/analyze
```

**Request Body:**

```json
{
  "workspacePath": "./src",
  "includeMetrics": true,
  "outputFormat": "markdown"
}
```

## PRD Endpoints

### Generate PRD

Create a Product Requirements Document.

```http
POST /api/prd/generate
```

**Request Body:**

```json
{
  "description": "A mobile app for tracking daily water intake",
  "template": "default",
  "includeUserStories": true,
  "includeAcceptanceCriteria": true
}
```

**Response:**

```json
{
  "prd": "# Product Requirements Document...",
  "sections": {
    "overview": "...",
    "features": [...],
    "userStories": [...],
    "technicalRequirements": "..."
  }
}
```

## Intent Compiler Endpoints

### Compile Intent

Compile intent files into structured output.

```http
POST /api/intent/compile
```

**Request Body:**

```json
{
  "files": ["./features/*.intent"],
  "outputFormat": "json",
  "options": {
    "watch": false,
    "analyze": true,
    "parallel": true
  }
}
```

## Job Management Endpoints

### List Jobs

List all background jobs.

```http
GET /api/jobs
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | String | Filter by status: queued, running, completed, failed |
| `limit` | Number | Max results (default: 50) |
| `offset` | Number | Pagination offset |

**Response:**

```json
{
  "jobs": [
    {
      "id": "job_abc123",
      "type": "ship",
      "status": "running",
      "progress": 45,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 127,
  "limit": 50,
  "offset": 0
}
```

### Get Job Status

Check the status of a specific job.

```http
GET /api/jobs/:jobId
```

**Response:**

```json
{
  "id": "job_abc123",
  "type": "ship",
  "status": "completed",
  "progress": 100,
  "result": { ... },
  "logs": [...],
  "createdAt": "2025-01-15T10:30:00Z",
  "completedAt": "2025-01-15T10:32:00Z"
}
```

### Cancel Job

Cancel a running job.

```http
POST /api/jobs/:jobId/cancel
```

## Agent Endpoints

### List Agents

Get available AI agents and their capabilities.

```http
GET /api/agents
```

**Response:**

```json
{
  "agents": [
    {
      "id": "architect",
      "name": "Architect Agent",
      "description": "Designs system architecture",
      "capabilities": ["design", "modeling", "api-design"],
      "status": "available"
    },
    {
      "id": "coder",
      "name": "Coder Agent",
      "description": "Writes and modifies code",
      "capabilities": ["typescript", "python", "go", "rust"],
      "status": "available"
    }
  ]
}
```

### Run Agent

Execute a specific agent on a task.

```http
POST /api/agents/:agentId/run
```

**Request Body:**

```json
{
  "task": "Review this code for security issues",
  "context": {
    "code": "...",
    "language": "typescript"
  },
  "options": {
    "strictness": "high",
    "focusAreas": ["security", "performance"]
  }
}
```

## Billing Endpoints

### Get Tiers

Get available subscription tiers.

```http
GET /api/billing/tiers
```

**Response:**

```json
{
  "tiers": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "apiCalls": 50,
      "features": ["50 API calls/month", "Basic features"]
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": 2900,
      "apiCalls": 1000,
      "features": ["1,000 API calls/month", "Priority support"]
    }
  ]
}
```

### Get Usage

Get current usage statistics.

```http
GET /api/billing/usage
```

**Response:**

```json
{
  "currentMonth": {
    "apiCalls": 450,
    "limit": 1000,
    "percentage": 45
  },
  "history": [
    {
      "month": "2025-01",
      "calls": 450,
      "cost": 123.45
    }
  ]
}
```

## Webhook Endpoints

### Register Webhook

Register a webhook for async job notifications.

```http
POST /api/webhooks
```

**Request Body:**

```json
{
  "url": "https://myapp.com/webhooks/grump",
  "events": ["job.completed", "job.failed", "ship.phase_complete"],
  "secret": "my_webhook_secret"
}
```

### List Webhooks

```http
GET /api/webhooks
```

### Delete Webhook

```http
DELETE /api/webhooks/:webhookId
```

## Health & Status

### Health Check

Check API health status.

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "ai": "ready",
    "queue": "operational"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Metrics

Get Prometheus-compatible metrics (requires auth).

```http
GET /metrics
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_request` | 400 | The request was malformed |
| `unauthorized` | 401 | Missing or invalid API key |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `rate_limited` | 429 | Rate limit exceeded |
| `internal_error` | 500 | Server error |
| `service_unavailable` | 503 | Service temporarily unavailable |
| `timeout` | 504 | Request timeout |

## SDK Examples

### JavaScript/TypeScript

```typescript
import { GrumpClient } from '@grump/sdk';

const client = new GrumpClient({
  apiKey: 'grump_api_xxxxxx'
});

// Start SHIP workflow
const session = await client.ship.start({
  projectDescription: 'Build a React app'
});

// Stream results
for await (const event of client.ship.stream(session.sessionId)) {
  console.log(event.type, event);
}
```

### Python

```python
from grump import GrumpClient

client = GrumpClient(api_key="grump_api_xxxxxx")

# Start SHIP workflow
session = client.ship.start(
    project_description="Build a React app"
)

# Get status
status = client.ship.get_status(session.session_id)
print(status)
```

### cURL

```bash
# Start SHIP session
curl -X POST https://api.grump.dev/api/ship/start \
  -H "Authorization: Bearer grump_api_xxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "projectDescription": "Build a React app"
  }'

# Stream with cURL
curl -N https://api.grump.dev/api/ship/$SESSION_ID/execute/stream \
  -H "Authorization: Bearer grump_api_xxxxxx"
```

## WebSocket API

For real-time bidirectional communication:

```javascript
const ws = new WebSocket('wss://api.grump.dev/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    apiKey: 'grump_api_xxxxxx'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

## Next Steps

- [SHIP Workflow](/guide/ship-workflow) - Learn about the SHIP methodology
- [Authentication](/api/authentication) - Detailed auth setup
- [Error Handling](/api/errors) - Handling API errors
- [Webhooks](/api/webhooks) - Setting up webhooks

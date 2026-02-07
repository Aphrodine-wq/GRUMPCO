# SHIP Workflow API

The SHIP workflow transforms natural language into production-ready code through four phases: **Design** → **Spec** → **Plan** → **Code**.

---

## POST `/api/ship/start`

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

---

## GET `/api/ship/:sessionId`

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

---

## POST `/api/ship/:sessionId/execute`

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

---

## POST `/api/ship/:sessionId/execute/stream`

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

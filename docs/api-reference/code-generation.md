# Code Generation API

The Code Generation API allows you to generate code from a PRD or specification.

---

## POST `/api/codegen/start`

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

---

## GET `/api/codegen/:sessionId`

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

---

## GET `/api/codegen/:sessionId/download`

Download generated code as ZIP.

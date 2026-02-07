# Agent APIs

The Agent APIs allow you to list and execute G-Agents.

---

## GET `/api/agents`

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

---

## POST `/api/agents/:agentId/execute`

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

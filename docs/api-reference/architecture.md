# Architecture API

The Architecture API allows you to generate architecture diagrams from natural language.

---

## POST `/api/architecture/generate`

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

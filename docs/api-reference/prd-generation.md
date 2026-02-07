# PRD Generation API

The PRD Generation API allows you to generate a Product Requirements Document from an architecture.

---

## POST `/api/prd/generate`

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

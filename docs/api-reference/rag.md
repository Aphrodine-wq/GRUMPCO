# RAG APIs

The RAG APIs allow you to query and index documents for the RAG system.

---

## POST `/api/rag/query`

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

---

## POST `/api/rag/index`

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

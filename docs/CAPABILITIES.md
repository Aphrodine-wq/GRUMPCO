# G-Rump - Capabilities

## Core Workflow

1. **User Input** – Natural language intent + optional constraints
2. **AI Intent Understanding** – Rust Intent Compiler + Claude extract features, users, data flows, tech stack
3. **Mermaid Diagram** – Auto-create architecture (components, data flow, frontend/backend/DB)
4. **User Confirmation** – Interactive review/edit of diagram + summary (inline Mermaid + ASCII in chat)
5. **PRD Generation** – One PRD per major system/component (e.g. Auth, Core API, Frontend UI); AI suggests, user adds/removes
6. **Agent Orchestration** – Sub-agents (Backend, UI, Test, etc.) break PRDs into sub-tasks, build incrementally; each reads its PRD only
7. **Iteration & Completion** – Auto test, code download (ZIP), GitHub create + push

---

## API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/quick` | Health check |
| POST | `/api/intent/parse` | Parse NL + constraints via Intent Compiler, enrich with Claude |
| POST | `/api/architecture/generate-stream` | Generate architecture (SSE) |
| POST | `/api/prd/components-from-diagram` | Suggest major components from diagram |
| POST | `/api/prd/generate-for-component` | Generate one PRD per component |
| POST | `/api/prd/generate-stream` | Generate PRD (SSE) |
| POST | `/api/codegen/start` | Start multi-agent code generation |
| GET | `/api/codegen/status/:id` | Poll generation status |
| GET | `/api/codegen/download/:id` | Download generated ZIP |
| POST | `/api/github/auth` | GitHub OAuth |
| POST | `/api/github/create-and-push` | Create repo, push generated code |

---

## Requirements

- Node.js 20+
- Rust (Tauri + Intent Compiler)
- Anthropic API key
- Windows (standalone app target)

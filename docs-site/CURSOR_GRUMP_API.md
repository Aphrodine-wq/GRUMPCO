# Using G-Rump from Cursor

When you need **full app generation**, **SHIP mode** (Design → Spec → Plan → Code), or **batch codegen**, delegate to the G-Rump backend API instead of generating everything in-chat.

## When to call G-Rump

| User intent | Action | Endpoint |
|-------------|--------|----------|
| “Build a full app from …” / “Generate app from description” | Start SHIP, then execute | `POST /api/ship/start` → `POST /api/ship/:id/execute` |
| “Give me architecture for …” / “Diagram for …” | Architecture | `POST /api/architecture/generate` or `.../generate-stream` |
| “Parse this idea” / “Extract features from …” | Intent | `POST /api/intent/parse` with `{ "raw": "..." }` |
| “Generate PRD for …” | PRD | `POST /api/prd/generate` (needs architecture) |
| “Generate code from PRD/architecture” | Codegen | `POST /api/codegen/start` with `prdId`, `architectureId`, `prd`, `architecture` |
| “Chat with G-Rump” / code help | Chat | `POST /api/chat/stream` with `{ "messages": [...] }` |

**Claude Code / Codex:** Use the same endpoints. A Cursor rule or skill can wrap them so you can say “generate full app from this description”; the agent invokes SHIP, polls status, and reports back the session ID and download link.

## API base URL

- Default: `http://localhost:3000`
- Override with `GRUMP_API_URL` or the app’s configured API URL.

## Key endpoints

| Purpose              | Method | Endpoint             | Body / notes                                      |
|----------------------|--------|----------------------|---------------------------------------------------|
| Start SHIP session   | POST   | `/api/ship/start`    | `{ projectDescription: string }`                  |
| Run SHIP (async job) | POST   | `/api/ship/:id/execute` or `.../execute/stream` | Design→Spec→Plan→Code |
| SHIP status          | GET    | `/api/ship/:id`      | Session + phase results                           |
| Chat (streaming)     | POST   | `/api/chat/stream`   | `{ messages: [{ role, content }] }`               |
| Intent parse         | POST   | `/api/intent/parse`  | `{ raw: string }`                                 |
| Architecture         | POST   | `/api/architecture/generate` or `.../generate-stream` | project description, etc. |
| PRD generate         | POST   | `/api/prd/generate` or `.../generate-stream` | projectName, projectDescription, architecture |
| Codegen start        | POST   | `/api/codegen/start` | `{ prdId, architectureId, prd, architecture }` or multi-PRD |
| Codegen status       | GET    | `/api/codegen/status/:sessionId` | Progress, agents, generatedFileCount |
| Codegen download     | GET    | `/api/codegen/download/:sessionId` | ZIP of generated code |

## Desktop event stream and webhooks

The desktop (or any client) can receive `ship.completed`, `codegen.ready`, and failure events in real time via Server-Sent Events, without running a local server.

| Purpose | Method | Endpoint | Notes |
|---------|--------|----------|--------|
| Event stream (SSE) | GET | `/api/events/stream` | Optional `?sessionId=...` filters to that session. |

**Event payload shape** (each SSE `data` line is JSON):

- `event`: `ship.completed` \| `codegen.ready` \| `ship.failed` \| `codegen.failed`
- `payload`: `{ sessionId, ... }` (e.g. `phase`, `result`, `error` depending on event)
- `timestamp`: ISO string

Example: `{"event":"ship.completed","payload":{"sessionId":"abc",...},"timestamp":"2026-01-27T12:00:00.000Z"}`

Use `EventSource(API_BASE + '/api/events/stream' + (sessionId ? '?sessionId=' + sessionId : ''))` and handle `message` events to refresh UI or show download when `event === 'ship.completed'` or `'codegen.ready'`.

Outbound HTTP webhooks: `POST /api/webhooks/trigger` (inbound trigger) and `POST /api/webhooks/outbound` (register URL). Same event names and payload shape.

## Cursor rule snippet

Add this to `.cursor/rules` or your project rules:

```markdown
## G-Rump API

For full app generation (Design → Spec → Plan → Code), use the G-Rump backend. Set `API_URL` from env or user config (default `http://localhost:3000`).

- **Generate app from description:** `POST {API_URL}/api/ship/start` with `{ "projectDescription": "..." }` → get `sessionId` → `POST {API_URL}/api/ship/{sessionId}/execute` (or `.../execute/stream`). Poll `GET {API_URL}/api/ship/{sessionId}` for status. When complete, codegen `sessionId` is in `codeResult.session.sessionId`; download via `GET {API_URL}/api/codegen/download/{sessionId}`.
- **Architecture / PRD / codegen:** `POST {API_URL}/api/architecture/generate`, then `POST {API_URL}/api/prd/generate`, then `POST {API_URL}/api/codegen/start` with `prdId`, `architectureId`, `prd`, `architecture`.
- **Chat/code help:** `POST {API_URL}/api/chat/stream` with `{ "messages": [...] }`.
- **Intent parse:** `POST {API_URL}/api/intent/parse` with `{ "raw": "..." }`.
```

## G-Rump “skill” for agents

A Cursor **skill** can wrap these calls so the agent can say “generate full app from this description” and the skill:

1. Calls `POST /api/ship/start` with the description.
2. Calls `POST /api/ship/{sessionId}/execute` (or stream).
3. Polls `GET /api/ship/{sessionId}` until `status === 'completed'`.
4. Returns the session ID, status URL, and codegen download URL (using `codeResult.session.sessionId`).

See [integrations/moltbot-skill](../integrations/moltbot-skill) for a Moltbot skill that invokes G-Rump. A Cursor-oriented skill is in [docs/cursor-grump-skill.md](cursor-grump-skill.md): copy it into `.cursor/rules` or use as a skill so the agent can "generate full app from X" and invoke SHIP.

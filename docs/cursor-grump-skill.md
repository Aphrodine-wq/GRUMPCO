# G-Rump API Skill (Cursor)

Use this as a Cursor rule or skill so the agent can invoke G-Rump for full app generation, SHIP, codegen, and chat.

## When to use

- User says "generate full app from X", "build an app that does Y", "ship an app for Z" → Use SHIP.
- User wants architecture, PRD, or codegen from a description → Use architecture → PRD → codegen flow.
- User wants to "parse this idea" or "extract features" → Use intent parse.
- User wants to chat with G-Rump or get code help → Use chat stream.

## API base

- `API_URL`: default `http://localhost:3000`. Use `GRUMP_API_URL` from env if set.

## Actions

### 1. Generate full app from description (SHIP)

1. `POST {API_URL}/api/ship/start` with body `{ "projectDescription": "user's description" }`.
2. From response, take `sessionId`.
3. `POST {API_URL}/api/ship/{sessionId}/execute` (or `.../execute/stream` for SSE).
4. Poll `GET {API_URL}/api/ship/{sessionId}` until `status === "completed"`.
5. When complete, `codeResult.session.sessionId` is the codegen session. Download: `GET {API_URL}/api/codegen/download/{codeResult.session.sessionId}`.
6. Report to user: "SHIP complete. Session {sessionId}. Download: {API_URL}/api/codegen/download/{codegenSessionId}."

### 2. Architecture → PRD → Codegen

1. `POST {API_URL}/api/architecture/generate` with `{ "projectDescription": "..." }` → get `architecture`.
2. `POST {API_URL}/api/prd/generate` with `{ "projectName": "...", "projectDescription": "...", "architecture": ... }` → get PRD.
3. `POST {API_URL}/api/codegen/start` with `{ "prdId", "architectureId", "prd", "architecture" }` → get `sessionId`.
4. Poll `GET {API_URL}/api/codegen/status/{sessionId}` until `status === "completed"`.
5. Download: `GET {API_URL}/api/codegen/download/{sessionId}`.

### 3. Chat

- `POST {API_URL}/api/chat/stream` with `{ "messages": [ { "role": "user", "content": "..." } ] }`. Consume SSE `data: {"type":"text","text":"..."}` and `data: {"type":"done"}`.

### 4. Intent parse

- `POST {API_URL}/api/intent/parse` with `{ "raw": "user's idea" }`. Return the enriched intent to the user.

## Notes

- All POST bodies are `Content-Type: application/json`.
- Chat stream is SSE; parse `data: {...}` lines.
- See [CURSOR_GRUMP_API.md](CURSOR_GRUMP_API.md) for full endpoint reference.

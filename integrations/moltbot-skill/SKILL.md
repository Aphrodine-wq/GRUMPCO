# G-Rump Skill for Moltbot

This skill lets your Moltbot assistant invoke G-Rump: start SHIP mode, run design→spec→plan→code, chat with the API, start codegen, and check status. Use it from Telegram, WhatsApp, Discord, or any connected channel.

## Config

- **GRUMP_API_URL** (default: `http://localhost:3000`) – G-Rump backend base URL.
- **GRUMP_API_KEY** (optional) – API key if your G-Rump instance requires it.

Set these in your Moltbot workspace env or `moltbot.json` (see example below).

## Actions

### Start SHIP and run

1. **Start a SHIP session**
   - `POST {GRUMP_API_URL}/api/ship/start`
   - Body: `{ "projectDescription": "Your app idea here" }`
   - Returns `{ sessionId, phase, status }`.

2. **Execute SHIP** (design → spec → plan → code)
   - `POST {GRUMP_API_URL}/api/ship/{sessionId}/execute` – enqueue job, returns 202 + `jobId`.
   - Or `POST {GRUMP_API_URL}/api/ship/{sessionId}/execute/stream` – SSE stream of phase updates.

3. **Get SHIP status**
   - `GET {GRUMP_API_URL}/api/ship/{sessionId}`

When complete, use **Codegen download** (see below) to fetch the ZIP.

### Chat

- `POST {GRUMP_API_URL}/api/chat/stream`
- Body: `{ "messages": [ { "role": "user", "content": "…" } ] }`
- Response: SSE stream. Consume `data: {"type":"text","text":"…"}` events.

### Codegen (from PRD / architecture)

- **Start codegen**
  - `POST {GRUMP_API_URL}/api/codegen/start`
  - Body (legacy): `{ "prdId", "architectureId", "prd", "architecture", "preferences?" }`
  - Or (multi-PRD): `{ "prds": [...], "architecture", "preferences?", "componentMapping?" }`
  - Returns `{ sessionId, status, agents }`.

- **Status**
  - `GET {GRUMP_API_URL}/api/codegen/status/{sessionId}`

- **Download ZIP**
  - `GET {GRUMP_API_URL}/api/codegen/download/{sessionId}` → binary ZIP.

### Other endpoints

- **Intent parse**: `POST /api/intent/parse` – body `{ "raw": "…" }`.
- **Architecture**: `POST /api/architecture/generate` or `.../generate-stream`.
- **PRD**: `POST /api/prd/generate` or `.../generate-stream`.

## Output for the user

When you run these actions, summarize for the user, e.g.:

- “SHIP started: session `abc123`. I’ve kicked off the run; I’ll tell you when it’s done.”
- “Codegen complete. Download: `GET {GRUMP_API_URL}/api/codegen/download/{sessionId}`” or “You can download the project from the G-Rump UI.”

## Webhooks (optional)

- **Inbound**: Moltbot can trigger G-Rump via `POST {GRUMP_API_URL}/api/webhooks/trigger` with `{ "action": "ship", "params": { "sessionId": "…" } }`. Auth: `X-Webhook-Secret` or `body.secret` (use `GRUMP_WEBHOOK_SECRET`).

- **Outbound**: G-Rump sends `ship.completed`, `ship.failed`, `codegen.ready`, `codegen.failed` to URLs in `GRUMP_WEBHOOK_URLS` or registered via `POST /api/webhooks/outbound`. Point one of these at a Moltbot webhook or adapter to get notified when SHIP or codegen finishes.

See [README](./README.md) for curl examples and `moltbot.json` snippet.

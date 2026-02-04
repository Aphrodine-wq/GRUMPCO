# G-Rump × Moltbot integration

Use [G-Rump](https://github.com/your-org/milesproject) from [Moltbot](https://molt.bot) (Clawdbot): start SHIP, chat, run codegen, and poll status from Telegram, WhatsApp, Discord, etc.

## Quick setup

1. **G-Rump backend** running (e.g. `http://localhost:3000`).
2. **Moltbot** with this skill installed (see [SKILL.md](./SKILL.md) for behavior).
3. Set `GRUMP_API_URL` (and optional `GRUMP_API_KEY`) in your Moltbot workspace.

## Example `moltbot.json` snippet

```json
{
  "skills": {
    "grump": {
      "path": "/path/to/integrations/moltbot-skill",
      "env": {
        "GRUMP_API_URL": "http://localhost:3000",
        "GRUMP_API_KEY": ""
      }
    }
  }
}
```

Adjust `path` to where this folder lives (e.g. inside your repo).

## Example curl calls

**Start SHIP:**

```bash
curl -X POST http://localhost:3000/api/ship/start \
  -H "Content-Type: application/json" \
  -d '{"projectDescription": "A todo app with auth and React frontend"}'
```

**Run SHIP (after start):**

```bash
curl -X POST http://localhost:3000/api/ship/SESSION_ID/execute \
  -H "Content-Type: application/json"
```

**Get SHIP status:**

```bash
curl http://localhost:3000/api/ship/SESSION_ID
```

**Trigger via webhook (inbound):**

```bash
curl -X POST http://localhost:3000/api/webhooks/trigger \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_GRUMP_WEBHOOK_SECRET" \
  -d '{"action":"ship","params":{"sessionId":"SESSION_ID"}}'
```

**Register outbound webhook (Moltbot or adapter URL):**

```bash
curl -X POST http://localhost:3000/api/webhooks/outbound \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_GRUMP_WEBHOOK_SECRET" \
  -d '{"url":"https://your-moltbot-adapter.example.com/grump-events","events":["ship.completed","codegen.ready"]}'
```

## Smoke test

With G-Rump backend running:

1. `POST /api/ship/start` with a short `projectDescription` → expect 200 and `sessionId`.
2. `GET /api/ship/{sessionId}` → expect 200 and session details.
3. `POST /api/webhooks/trigger` with `action: "ship"` and `params.sessionId` → expect 202 and `jobId`. (If `GRUMP_WEBHOOK_SECRET` is set, send it via `X-Webhook-Secret` or `body.secret`.)

See [CAPABILITIES.md](../../docs/CAPABILITIES.md) and [webhooks](../../backend/src/routes/webhooks.ts) for full API details.

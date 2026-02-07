# Webhook APIs

The Webhook APIs allow you to trigger and manage webhooks.

---

## POST `/api/webhooks/trigger`

Inbound webhook for external triggers.

**Headers:**
- `X-Webhook-Secret` - Webhook secret (or provide in body)

**Request:**
```bash
curl -X POST http://localhost:3000/api/webhooks/trigger \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: my-secret" \
  -d '{
    "action": "ship",
    "projectDescription": "Build a landing page",
    "callbackUrl": "https://example.com/webhook"
  }'
```

---

## POST `/api/webhooks/outbound`

Register outbound webhook URL.

**Request:**
```bash
curl -X POST http://localhost:3000/api/webhooks/outbound \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: my-secret" \
  -d '{
    "url": "https://example.com/webhook",
    "events": ["ship.completed", "codegen.ready"]
  }'
```

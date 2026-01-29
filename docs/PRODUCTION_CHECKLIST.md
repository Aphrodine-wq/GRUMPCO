# Production Deployment Checklist

Use this checklist to get G-Rump up and running and ready for production.

## Environment and Secrets

- [ ] Set `NODE_ENV=production`.
- [ ] Set `CORS_ORIGINS` to the exact origins of your web/desktop clients (no wildcards in prod).
- [ ] Configure **Anthropic** API key and any other LLM/usage keys.
- **Backend (single service):**
  - [ ] Set `GRUMP_WEBHOOK_SECRET` if you use webhooks. When unset in production, webhook routes return 503.
  - [ ] Set `TWILIO_WEBHOOK_SECRET` when using Twilio inbound messaging (`MESSAGING_PROVIDER=twilio`). When unset in production, the messaging inbound route returns 503.
  - [ ] Configure Supabase URL and anon key (and service role only where needed) for auth.
  - [ ] Set `STRIPE_WEBHOOK_SECRET` (and `STRIPE_SECRET_KEY`) if you use Stripe billing. `POST /api/billing/webhook` uses raw body for signature verification.
  - [ ] Ensure auth redirect URLs and cookie settings match your production domain.

## Rate Limiting and Redis

- [ ] Set `REDIS_HOST` (and `REDIS_PORT` if not 6379) so rate limiting is shared across restarts and replicas (see [CAPABILITIES.md](CAPABILITIES.md)).
- [ ] Configure Upstash QStash for asynchronous tasks (see `backend/DEPLOY_VERCEL.md`).

## Abuse Prevention

- [ ] Set `BLOCK_SUSPICIOUS_PROMPTS=true` in production so that prompt-injection–style patterns in user input are rejected (see [validator](backend/src/middleware/validator.ts)). Diagram, ship, PRD, architecture, and codegen routes use the validator.
- [ ] Use Redis for rate limiting (see above). Ensure `REQUIRE_AUTH_FOR_API=true` when the backend is public so `/api/chat`, `/api/ship`, and `/api/codegen` require auth.

## Database

- [ ] Migrations run automatically on backend startup when using the default SQLite DB (see [database.ts](../backend/src/db/database.ts)). The build copies `src/db/migrations` into `dist/db/migrations`; no separate migration step is required.
- [ ] Use a dedicated DB (e.g. PostgreSQL if you switch from SQLite) for production and ensure backups and access control.

## Auth and Legal

- [ ] Ensure production signup/register flows require acceptance of ToS and Privacy (and optionally AUP). The web app Register flow includes required checkboxes when implemented as in [docs/legal](legal/).
- [ ] Host and link Terms, Privacy, and Acceptable Use from the web app (`/terms`, `/privacy`, `/acceptable-use`) and from any desktop in-app links. Legal text lives in [docs/legal](legal/).

## Observability and Hardening

- [ ] Ensure **log levels** and log sinks do not expose secrets or PII in production.
- [ ] Rely on centralized error sanitization: 500 and error SSE responses do not expose `err.message` in production (see [backend/src/utils/errorResponse.ts](../backend/src/utils/errorResponse.ts)).
- [ ] Optionally restrict **metrics** (`/metrics`) with `METRICS_AUTH` and firewall so only your monitoring can reach it.

## Optional: API Auth and Network Exposure

- **If the backend is public:** Set `REQUIRE_AUTH_FOR_API=true` to require auth for `/api/chat`, `/api/ship`, and `/api/codegen`. Unauthenticated requests to those paths will receive 401.
- **If the backend is only used by a desktop app or internal services:** Keep it off the public internet or behind a VPN/private network and document that as the production posture.

## Quick Reference

| Item | Env / Config |
|------|----------------|
| Webhook secret required in prod | `GRUMP_WEBHOOK_SECRET`; if unset, webhooks return 503 |
| Twilio webhook secret in prod | `TWILIO_WEBHOOK_SECRET` when `MESSAGING_PROVIDER=twilio` |
| Require auth for chat/ship/codegen | `REQUIRE_AUTH_FOR_API=true` |
| Shared rate limiting | `REDIS_HOST`, `REDIS_PORT` |
| Block suspicious prompts (prod) | `BLOCK_SUSPICIOUS_PROMPTS=true` |
| Metrics auth | `METRICS_AUTH` (Basic auth for `/metrics`) |

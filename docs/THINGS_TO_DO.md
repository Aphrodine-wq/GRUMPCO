# Things to Do

Actionable checklist from the Backend-on-Railway / Finish-Systems plan. Tick items as you complete them.

---

## Deploy backend to Railway

**Operator tasks** (you run these). The repo provides the app, Dockerfile, migrations, and [deploy workflow](../.github/workflows/deploy.yml). See **[RAILWAY_DEPLOY](RAILWAY_DEPLOY.md)** for step-by-step instructions.

- [ ] Create a Railway project and add a service for the backend. Set **root directory** to `backend` (or configure build to use `backend/`).
- [ ] Use **Dockerfile** build: [backend/railway.json](../backend/railway.json) already sets `builder: DOCKERFILE` and `healthcheckPath: /health/quick`.
- [ ] Add **Redis** via Railway plugin; set `REDIS_HOST` (and `REDIS_PORT` / `REDIS_PASSWORD` if needed) in the service env.
- [ ] Add a **Railway volume** for SQLite data (e.g. mount at `/app/data`); set `DB_PATH=/app/data/grump.db`. Otherwise plan PostgreSQL.
- [ ] Set all required **env vars** (see [PRODUCTION_CHECKLIST](PRODUCTION_CHECKLIST.md) and [backend/.env.example](../backend/.env.example)): `NODE_ENV`, `CORS_ORIGINS`, `PORT`, Anthropic key, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GRUMP_WEBHOOK_SECRET`, etc.
- [ ] For **CI deploy**: add `RAILWAY_TOKEN` (project token) and `RAILWAY_SERVICE_ID` / `RAILWAY_SERVICE_ID_PROD` as GitHub secrets/vars. Set `STAGING_URL` / `PRODUCTION_URL` for health checks.

---

## Remove mock auth (done)

- [x] Supabase required in production; mock only in dev. Backend and backend-web `supabaseClient` updated.
- [x] Auth routes no longer return `mock`; frontend `isMockMode` removed.
- [x] Auth middleware no longer logs or handles mock tokens.

---

## Migrations

- [x] Duplicate `004_` migration fixed: `004_intent_compiler_failures.sql` → `007_intent_compiler_failures.sql`.
- [x] Migrations run automatically on backend startup ([database.ts](../backend/src/db/database.ts)). Build copies `src/db/migrations` → `dist/db/migrations`; no separate migration step when using the default DB.

---

## Abuse prevention and scale

- [ ] Set `REDIS_HOST` in production so rate limiting uses Redis.
- [ ] Set `BLOCK_SUSPICIOUS_PROMPTS=true` in production.
- [ ] If the backend is public, set `REQUIRE_AUTH_FOR_API=true` for `/api/chat`, `/api/ship`, `/api/codegen`.
- [x] Diagram, ship, PRD, architecture, and codegen use the [validator](../backend/src/middleware/validator.ts).

---

## Finish systems

- [x] **Billing /me**: Resolves user from auth; returns tier (from `getTierForUser`) and limit. Usage remains null until usage tracking exists.
- [x] **Feature flags**: `getTierForUser(userKey)` wired; tier from `TIER_DEFAULT` or future billing lookup.
- [x] **Alerting**: Email send deferred; log updated to avoid implying “sent.”
- [x] **Stripe**: Backend implements Stripe checkout and webhooks; `POST /api/billing/webhook` uses raw body (see [backend/src/services/stripeService.ts](../backend/src/services/stripeService.ts)).
- [x] **GitHub create-and-push**: Backend route and service (see [backend/src/routes/github.ts](../backend/src/routes/github.ts)).
- [x] **Consolidated to one backend on Railway**: backend-web merged into backend and retired (see [archive/backend-web](../archive/backend-web)); desktop receives ship.completed / codegen.ready via `GET /api/events/stream` (SSE).

---

## Clean-up

- [x] Fly.io deploy removed; `backend/fly.toml` deleted; [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) updated for Railway.
- [x] No other Fly-specific config or dead code found.
- [x] Env and docs checked; no Fly-only env vars or doc references remain.

---

## Optional / later

- [ ] **backend-web deploy**: Deploy backend-web to Railway (or elsewhere) if you use the web app.
- [ ] **PostgreSQL**: Migrate off SQLite for horizontal scaling (see [SYSTEM_EVALUATION](SYSTEM_EVALUATION.md)).
- [ ] **Email alerting**: Integrate SendGrid, Resend, or SES in [backend alerting](../backend/src/services/alerting.ts) to enable email alerts.

---

## Quick reference

| Topic | Links |
|-------|--------|
| Railway deploy (operator) | [RAILWAY_DEPLOY](RAILWAY_DEPLOY.md) |
| Production checklist | [PRODUCTION_CHECKLIST](PRODUCTION_CHECKLIST.md) |
| One backend on Railway | [BACKENDS](BACKENDS.md) |
| Capabilities & architecture | [CAPABILITIES](CAPABILITIES.md) |
| System completeness | [SYSTEM_EVALUATION](SYSTEM_EVALUATION.md) |
| Codebase valuation | [CODEBASE_VALUATION](CODEBASE_VALUATION.md) |

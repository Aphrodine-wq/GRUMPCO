# Deploy G-Rump Backend to Railway

This guide covers **operator** tasks to deploy the **backend** (grump-backend) to Railway. This is the **only** backend; desktop and web app both use it. The repo provides the app, Dockerfile, and CI workflow; you configure the project, Redis, volume, and secrets.

## Prerequisites

- Railway account
- GitHub repo connected to Railway (or use Railway CLI)
- [Deploy workflow](.github/workflows/deploy.yml): staging on `develop`, production on release

## 1. Create Railway project and backend service

1. Create a new Railway project.
2. Add a service for the **backend**:
   - **Root directory:** `backend` (or configure build context to use `backend/`).
   - **Build:** Use **Dockerfile**. [backend/railway.json](backend/railway.json) sets `builder: DOCKERFILE` and `healthcheckPath: /health/quick`.
3. Ensure the service builds from the repo (e.g. via GitHub integration or `railway up`).

## 2. Redis

1. Add **Redis** via a Railway plugin (or a Redis service).
2. Set environment variables on the backend service:
   - `REDIS_HOST`: Redis hostname (e.g. from the plugin).
   - `REDIS_PORT`: `6379` unless different.
   - `REDIS_PASSWORD`: if required.

## 3. SQLite data volume

1. Add a **Railway volume** for SQLite persistence.
2. Mount it at `/app/data` for the backend service.
3. Set `DB_PATH=/app/data/grump.db` in the service environment.

Without a volume, SQLite data is lost on redeploy.

## 4. Environment variables

Set these on the backend service (see [backend/.env.example](../backend/.env.example) and [PRODUCTION_CHECKLIST](PRODUCTION_CHECKLIST.md)):

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (Railway often sets this) |
| `CORS_ORIGINS` | Exact origins of web/desktop clients (no wildcards in prod) |
| `ANTHROPIC_API_KEY` | Required for LLM |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | Auth; required in production |
| `DB_PATH` | `/app/data/grump.db` when using the volume |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | From Redis setup |
| `GRUMP_WEBHOOK_SECRET` | If using webhooks; unset → webhook routes 503 in prod |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | For billing; Stripe webhook at `POST /api/billing/webhook` |
| `BLOCK_SUSPICIOUS_PROMPTS` | `true` in production |
| `REQUIRE_AUTH_FOR_API` | `true` if backend is public |
| `TWILIO_*` | Only if using Twilio messaging |

Desktop clients receive `ship.completed` / `codegen.ready` in real time via `GET /api/events/stream` (SSE); no extra config.

Do not commit secrets. Use Railway’s (or your CI’s) secret store.

## 5. GitHub Actions (CI deploy)

To deploy via [.github/workflows/deploy.yml](../.github/workflows/deploy.yml):

1. **Staging (push to `develop`):**
   - Add **GitHub secrets** (or **vars**):
     - `RAILWAY_TOKEN`: Railway project token.
     - `RAILWAY_SERVICE_ID`: Railway service ID for staging (or use secret).
   - Optionally set `STAGING_URL` (default `https://staging.grump.app`) for health checks.

2. **Production (release published):**
   - `RAILWAY_TOKEN`: same project token.
   - `RAILWAY_SERVICE_ID_PROD`: Railway service ID for production.
   - Optionally set `PRODUCTION_URL` (default `https://grump.app`).

The workflow builds the backend (and frontend), pushes Docker images to GHCR, runs `railway up` for the backend when tokens/IDs are set, and hits `/health/quick` and `/health/ready`.

## 6. Verify

- Deploy the service and ensure it’s healthy.
- Call `https://<your-app>.railway.app/health/quick` and `/health/ready`.
- Confirm Redis and DB (SQLite volume) are used as intended.

## Summary

| Task | Owner |
|------|--------|
| Create Railway project, backend service, Redis, volume | **You** |
| Set env vars and secrets | **You** |
| Configure GitHub secrets for deploy workflow | **You** |
| App code, Dockerfile, migrations, health checks | **Repo** |

See [THINGS_TO_DO](THINGS_TO_DO.md) and [PRODUCTION_CHECKLIST](PRODUCTION_CHECKLIST.md) for the full production checklist.

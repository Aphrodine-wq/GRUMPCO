# G-Rump Backend

Express API for G-Rump: chat, ship, plan, spec, codegen, intent, architecture, PRD, security, webhooks, events, auth, billing, and more.

## Environment

Copy `.env.example` to `.env` and set at least `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY`. See [.env.example](.env.example) for all variables. For production, see [docs/PRODUCTION_CHECKLIST.md](../docs/PRODUCTION_CHECKLIST.md).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (tsx watch). |
| `npm run build` | Build with SWC (fast). |
| `npm run start` | Run from source (tsx). |
| `npm run start:prod` | Run built `dist/index.js`. |
| `npm run type-check` | TypeScript check. |
| `npm run lint` / `npm run lint:fix` | ESLint. |
| `npm run test` | Run tests (Vitest). |
| `npm run load-test` | K6 load test. |

## Key routes

- `/api/chat/stream` – Chat
- `/api/ship/*` – SHIP workflow
- `/api/plan/*`, `/api/spec/*` – Plan and spec
- `/api/codegen/*` – Code generation
- `/api/security/*` – Security scan, SBOM, compliance
- `/api/webhooks/*` – Inbound/outbound webhooks
- `/api/events/stream` – SSE events
- `/health`, `/metrics` – Health and Prometheus

Full API: [docs/API.md](../docs/API.md).

## Deployment

- **Vercel**: See [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).
- **Docker**: Use repo root `docker-compose` and [scripts/build-docker-optimized.sh](../scripts/build-docker-optimized.sh).
- **Linux**: See [docs/LINUX_SETUP.md](../docs/LINUX_SETUP.md).

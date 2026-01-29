# One Backend on Vercel

G-Rump uses a **single backend** (grump-backend) deployed on Vercel. Desktop and web app both use it via `VITE_API_URL` (the Vercel URL in production, or `http://localhost:3000` in development).

## Summary

| Service | Package | Used by | Purpose |
|---------|---------|---------|---------|
| **backend** | grump-backend | Desktop (Tauri), Web app, VS Code, CLI, Moltbot | Full API: intent, architecture, PRD, codegen, chat, plan, spec, ship, GitHub, health, auth, billing (Stripe webhook), collaboration, analytics, templates. SQLite + optional Redis. |

- **Desktop app** talks to **backend** via `VITE_API_URL` (default `http://localhost:3000`). Auth routes (`/auth/*`) and all product APIs live on backend.
- **Web app** talks to the same **backend** via its `VITE_API_URL` for auth, billing, chat, codegen, collaboration, and templates.

The former **backend-web** (grump-backend-web) was merged into backend in Jan 2026 and retired; its code lives in `archive/backend-web/` for reference only.

## See also

- [CAPABILITIES.md](CAPABILITIES.md) – architecture, data flow, API domains

- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) – env vars, Redis, migrations, auth

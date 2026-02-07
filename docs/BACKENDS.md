# One Backend

G-Rump uses a **single backend** (grump-backend). Deployment options include Docker, Kubernetes, and **NGC-ready cloud** (GCP/AWS) for NVIDIA Golden Developer compliance. The desktop app uses `VITE_API_URL` (default `http://localhost:3000` in development).

## Summary

| Service | Package | Used by | Purpose |
|---------|---------|---------|---------|
| **backend** | grump-backend | Desktop (Electron), VS Code, CLI, Moltbot | Full API: intent, architecture, PRD, codegen, chat, plan, spec, ship, GitHub, health, auth, billing (Stripe webhook), collaboration, analytics, templates. SQLite + optional Redis. |

- **Desktop app** talks to **backend** via `VITE_API_URL` (default `http://localhost:3000`). Auth routes (`/auth/*`) and all product APIs live on backend.

The former **backend-web** (grump-backend-web) was merged into backend in Jan 2026 and retired; its code lives in `archive/backend-web/` for reference only.

## See also

- [PRODUCTION.md](PRODUCTION.md) – env vars, Redis, migrations, auth, NGC deployment
- [deploy/ngc/](../deploy/ngc/) – NGC-ready deployment (GCP, AWS) for NVIDIA Golden Developer
- [NVIDIA_GOLDEN_DEVELOPER.md](NVIDIA_GOLDEN_DEVELOPER.md) – Award submission and checklist

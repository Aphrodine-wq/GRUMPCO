# One Backend

> **Version:** 2.1.0 | **Last Updated:** February 11, 2026

G-Rump uses a **single backend** (`grump-backend`). Deployment options include Docker, Kubernetes, and **NGC-ready cloud** (GCP/AWS) for NVIDIA Golden Developer compliance.

## Summary

| Service | Package | Clients | Purpose |
|---------|---------|---------|---------|
| **backend** | grump-backend | Desktop (Electron), VS Code, CLI, Bots | Full API: chat, SHIP, codegen, architecture, agents, integrations, auth, billing, health, analytics. SQLite (dev) + PostgreSQL/Supabase (prod), optional Redis. |

## Client → Backend Communication

- **Desktop app** → `VITE_API_URL` (default `http://localhost:3000`)
- **CLI** → configurable API endpoint
- **VS Code Extension** → configurable API endpoint
- **Messaging Bots** (Discord, Telegram) → webhook routes on backend

## Previous Architecture

The former `backend-web` (grump-backend-web) was merged into the unified backend in January 2026 and retired.

## See Also

- [PRODUCTION.md](PRODUCTION.md) — env vars, Redis, migrations, auth, NGC deployment
- [deploy/ngc/](../deploy/ngc/) — NGC-ready deployment (GCP, AWS)
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture overview

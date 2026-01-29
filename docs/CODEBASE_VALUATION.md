# Codebase Valuation

**Last updated:** Jan 2026

This document gives a concise, human-readable assessment of the G-Rump codebase: scope, size, tech stack, readiness, and a short narrative valuation. It is descriptive only and not a formal appraisal.

---

## 1. Scope

- **Single backend** (grump-backend): one Node/Express service deployed on Vercel. Serves desktop, web app, VS Code extension, CLI, and Moltbot. The former backend-web was merged into backend and retired (see [BACKENDS.md](BACKENDS.md)).
- **Desktop app:** Tauri + Svelte, full UX: chat, diagrams, PRD, codegen, ship, settings, GitHub. Receives `ship.completed` / `codegen.ready` via `GET /api/events/stream` (SSE).
- **Web app:** Svelte; uses the same backend for auth, billing, chat, codegen, collaboration, templates.
- **Integrations:** VS Code extension, grump-analyze CLI, Moltbot skill.
- **intent-compiler:** Rust binary for intent parsing; invoked by backend.

---

## 2. Size (indicative)

Approximate line counts (as of Jan 2026; run `cloc backend/src frontend/src integrations intent-compiler` for current numbers):

| Domain | Path | Approx. LOC | File count (TS/JS/Svelte/Rust) |
|--------|------|-------------|----------------------------------|
| Backend | `backend/src` | ~30,000 | ~156 TS |
| Frontend | `frontend/src` | ~16,000 | ~84 TS/Svelte |
| Integrations | `integrations/` | varies | VS Code extension, Moltbot skill |
| Intent compiler | `intent-compiler/` | varies | Rust |

Total application code (backend + frontend) is on the order of **45,000+ lines**. Integrations and intent-compiler add more. Use `cloc` or similar on the repo root for exact counts and by-language breakdown.

---

## 3. Tech stack

| Layer | Technologies |
|-------|----------------|
| **Backend** | Node.js, Express, TypeScript, SQLite (better-sqlite3), optional Redis (ioredis), Supabase (auth), Stripe (billing/webhook), Anthropic + LLM gateway (Zhipu, OpenRouter, Copilot), BullMQ (job queue when Redis set) |
| **Frontend** | Svelte, TypeScript, Tauri (desktop) |
| **Integrations** | VS Code extension (TS), Moltbot skill, grump-analyze CLI |
| **Intent parsing** | Rust (intent-compiler binary) |

---

## 4. Completeness and readiness

See [SYSTEM_EVALUATION.md](SYSTEM_EVALUATION.md) for “how done” each area is. Summary:

- **Core pipeline** (intent → diagram → PRD → codegen → ship): ~85–90% complete; chat, phase bar, SHIP all functional.
- **Desktop app:** ~90% complete; full UX and SSE for ship/codegen events.
- **Single backend on Vercel:** Implemented; Stripe webhook, collaboration, analytics, templates live in backend.
- **Production readiness:** ~50% per [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md); Redis, env/secrets, legal, and hardening still to be configured and verified.

---

## 5. Valuation summary (narrative)

Recreating this system from scratch would be a **multi‑month effort for a small team**. Main assets include: (1) the end‑to‑end “idea → diagram → PRD → code → ship” pipeline and multi‑agent codegen; (2) the Tauri + Svelte desktop app with real‑time events; (3) a single backend that serves all clients (desktop, web, VS Code, CLI, Moltbot); (4) skills (code‑review, refactoring, git), analytics, collaboration, and template surfaces. The codebase is structured, documented, and deployable to Vercel with one backend. This valuation is a qualitative assessment for stakeholders, not a formal appraisal or price estimate.

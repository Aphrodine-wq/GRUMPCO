# Upstate - Claude Handoff (milesproject)
Date: 2026-01-30
Updated: 2026-01-29

Goal: Provide current state, entry points, and next steps to continue work.

## Project snapshot
- G-Rump is an Architecture-as-Code and optional codegen platform.
- Clients: Desktop app (Tauri + Svelte) in `frontend/`, Web app in `web/`, VS Code extension in `integrations/vscode-extension`, CLI in `packages/cli`.
- Backend: Express + TypeScript in `backend/`, SSE streaming, job queues, Redis optional, SQLite default, Supabase for serverless.
- Intent compiler: Rust in `intent-compiler/` (optional).

## Key entry points
- `backend/src/index.ts`: app bootstrap, middleware, route registration.
- `backend/src/routes/*`: chat, ship, codegen, architecture, prd, plan/spec, webhooks, events, etc.
- `backend/src/services/*`: LLM gateway, agent orchestrator, intent compiler, cache, integrations.
- `frontend/src/App.svelte`: main desktop UI entry.
- `web/src/App.svelte`: web UI entry.
- `packages/*`: shared-types, ai-core, rag, memory, voice, kimi.

## LLM and model routing (current code)
- Kimi K2.5 via NVIDIA NIM is the default model in multiple services and features (search for `moonshotai/kimi-k2.5`).
- Kimi optimization middleware is mounted for `/api/chat`, `/api/ship`, `/api/codegen`, `/api/plan`.
- Providers supported in settings/types: `nim`, `zhipu`, `copilot`, `openrouter`.
- **Documentation has been updated to reflect Kimi/NVIDIA NIM as primary provider.**

## How to run (local dev)
- From repo root: `start-app.bat` (backend 3000 + frontend 5173).
- Backend: `cd backend && npm run dev` or `npm run build && npm run start:prod`.
- Frontend (desktop UI): `cd frontend && npm run dev` or `npm run tauri:dev`.
- Web app: `cd web && npm run dev` or `npm run build`.
- Intent compiler (optional): `cd intent-compiler && cargo build --release`, then set `GRUMP_INTENT_PATH`.

## Environment variables
- **Required:** `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY` (at least one).
- Validation in `backend/src/config/env.ts` enforces this (skips check in test mode).
- All `.env.example` files and deployment docs updated to reflect new provider requirements.

## Deployment status
- `docs/THINGS_TO_DO.md` and `DEPLOYMENT_SUMMARY.md` say "Ready for Deployment" as of 2026-01-30.
- Separate frontend/backend Vercel deployments are documented.
- Production safety flags: `BLOCK_SUSPICIOUS_PROMPTS=true` and `REQUIRE_AUTH_FOR_API=true` when exposed to untrusted users.
- Deployment scripts (`scripts/setup-vercel.sh`, `scripts/setup-vercel.bat`) updated for NVIDIA NIM/OpenRouter.

## Documentation reconciliation (COMPLETED)
The following updates have been made to reconcile docs with the Kimi migration:

### Updated files:
- `backend/.env.example`, `.env.example` (root) - NVIDIA NIM as primary
- `backend/src/routes/diagram.ts` - Error message updated
- `docs/SETUP.md`, `DEPLOYMENT_SUMMARY.md`, `README.md` - Updated providers
- `docs/OVERVIEW.md`, `docs/QUICK_REFERENCE.md`, `docs/PROJECT_STATUS.md` - Updated API key refs
- `docs/THINGS_TO_DO.md`, `docs/BUILD.md`, `docs/KNOWN_ISSUES.md` - Updated env vars
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` - Updated LLM references
- `docs/QUICK_START.md`, `docs/INTENT_COMPILER.md`, `docs/VIBECODE_API_REFERENCE.md` - Updated
- `CONTRIBUTING.md`, `backend/README.md`, `backend/DEPLOY_VERCEL.md` - Updated
- `scripts/setup-vercel.sh`, `scripts/setup-vercel.bat` - Updated for NVIDIA NIM
- `backend/tests/setup.ts` - Updated test mocks

### Legacy docs marked:
- `docs/SYSTEM_ARCHITECTURE.md` - Marked as legacy (Vue and Claude refs)
- `docs/COMPLETE_SYSTEM_GUIDE.md` - Marked as legacy

### Historical docs (kept as-is):
- `TRANSFORMATION_COMPLETE.md` - Documents the migration
- `KIMI_IMPLEMENTATION.md`, `KIMI_QUICK_REFERENCE.md`, `docs/KIMI_OPTIMIZATIONS.md` - Compare Kimi vs Claude

## Tests and checks
- Root: `npm run check-all`
- Backend: `npm run type-check`, `npm run lint`, `npm run test`
- Frontend: `npm run type-check`, `npm run lint`, `npm run test:run`
- E2E: `cd frontend && npm run test:e2e` (backend must be running)
- **Backend build and type-check pass successfully.**

## Remaining next steps
1. ~~Reconcile documentation with Kimi migration~~ ✅ DONE
2. ~~Confirm required env keys and validation in `backend/src/config/env.ts`~~ ✅ DONE
3. ~~Audit doc accuracy and mark or update legacy docs~~ ✅ DONE
4. ~~Validate deployment scripts and Vercel configs~~ ✅ DONE
5. Run smoke tests: `/health`, `/api/chat/stream`, architecture -> PRD flow.

## Useful docs to read
- `docs/OVERVIEW.md`, `docs/CAPABILITIES.md`, `docs/ROADMAP.md`, `docs/KNOWN_ISSUES.md`
- `docs/PRODUCTION_CHECKLIST.md`, `docs/THINGS_TO_DO.md`, `DEPLOYMENT_SUMMARY.md`
- `KIMI_IMPLEMENTATION.md`, `KIMI_QUICK_REFERENCE.md`, `docs/KIMI_OPTIMIZATIONS.md`

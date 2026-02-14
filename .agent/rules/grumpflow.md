---
trigger: always_on
---

# G-Rump — Project Context for Gemini

## Identity

**G-Rump** is an AI-powered development platform ("The AI Product Operating System") that transforms natural language descriptions into production-ready applications. Version **2.1.0**. MIT licensed.

Repository: `github.com/Aphrodine-wq/GRUMPCO`

---

## Monorepo Structure

```
grump/                          # pnpm workspace (pnpm 9+, Node 20+)
├── frontend/                   # Svelte 5 + Electron 28 desktop app (Vite 5, TailwindCSS 3.4)
│   ├── src/
│   │   ├── components/         # Svelte components (chat, settings, onboarding, etc.)
│   │   ├── lib/                # Utility modules, stores, chat managers
│   │   ├── stores/             # Svelte stores (newOnboardingStore, featuresStore, etc.)
│   │   └── electron/           # Electron main process (tray, shortcuts, notifications)
│   └── package.json
│
├── backend/                    # Express 5 API server (TypeScript, SWC, Pino logging)
│   ├── src/
│   │   ├── routes/             # ~60 route files (chat, ship, codegen, agents, integrations, etc.)
│   │   ├── services/           # Business logic (ai-providers/, integrations/, security/, ship/, caching/)
│   │   ├── gAgent/             # Agent orchestration (task executor, tool dispatch, work reports)
│   │   ├── middleware/         # Express middleware (auth, rateLimit, compression, security)
│   │   ├── config/             # env.ts (Zod-validated), modelRegistry, limits
│   │   ├── db/                 # Database layer (SQLite dev, PostgreSQL/Supabase prod)
│   │   ├── tools/              # Agent tools (bash, file read/write/edit, git, grep, search_and_replace)
│   │   ├── prompts/            # System prompts for chat modes and phases
│   │   ├── types/              # TypeScript type definitions (integrations.ts, etc.)
│   │   └── features/           # Feature modules (security-compliance, testing-qa, codebase analysis)
│   └── tests/                  # 118+ test files (vitest): integration/, e2e/, config/, mcp/, routes/, services/
│
├── packages/
│   ├── ai-core/                # Model router + registry (@grump/ai-core)
│   ├── cli/                    # @g-rump/cli (grump ship, grump chat, etc.)
│   ├── shared-types/           # Shared TypeScript types (@grump/shared-types)
│   ├── rag/                    # RAG engine (Pinecone, hybrid search, reranking)
│   ├── memory/                 # Conversation memory system
│   └── vscode-extension/       # VS Code extension
│
├── intent-compiler/            # Rust NL→JSON parser (SIMD, rayon, WASM target)
│   ├── src/                    # lib.rs, market_engine.rs (split into submodules), tasks.rs
│   └── Cargo.toml
│
├── services/
│   ├── nemo-curator/           # NVIDIA NeMo synthetic data pipeline (Python)
│   └── nemo-training/          # NVIDIA NeMo fine-tuning example
│
├── deploy/                     # Docker, Kubernetes, NGC (GCP/AWS) deployment configs
├── docs/                       # Documentation (ROADMAP, RELEASE_CHECKLIST, API, ARCHITECTURE, etc.)
├── scripts/                    # Build, benchmark, release, and setup scripts
└── infrastructure/             # Terraform/provisioning scaffolds
```

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Svelte 5, Electron 28, Vite 5, TailwindCSS 3.4, TypeScript 5.3, Mermaid.js, Shiki |
| **Backend** | Node.js 20+, Express 5, TypeScript, SWC, Pino, Zod, BullMQ |
| **AI/ML** | NVIDIA NIM (primary), Anthropic Claude, Kimi K2.5, OpenRouter, Ollama (local) |
| **Compiler** | Rust 1.77+ (rayon, SIMD, WASM) |
| **Database** | SQLite (dev), PostgreSQL/Supabase (prod), Redis (cache/queue), Pinecone (vectors) |
| **Infrastructure** | Docker, Kubernetes, NGC, Prometheus, OpenTelemetry, Grafana |

---

## Key Architectural Concepts

### Two Operating Modes
1. **Architecture Mode** (Design-First): `Describe → Architecture (Mermaid) → Spec (PRD) → Code`
2. **Code Mode** (Tool-Enabled Chat): AI chat with workspace-aware tools for interactive development

### SHIP Workflow
The flagship feature: `Design → Spec → Plan → Code` — generates full-stack apps from natural language.

### AI Provider Routing
- **G-CompN1 Model Mix** — smart routing layer across Anthropic Opus, Kimi K2.5, and Gemini
- Providers configured via `backend/.env` (see `backend/src/config/env.ts` for Zod schema)
- Provider list: `nvidia_nim`, `anthropic`, `openrouter`, `kimi`, `ollama`
- **Google was removed as a standalone AI provider** from `env.ts`/`ApiProvider` but remains as an integration provider ID in `IntegrationProviderId` (for user-stored API keys)

### G-Agent System
Multi-agent orchestration: Architect, Frontend, Backend, DevOps, Test, Docs, Security, WRunner agents. Tool dispatch through `gAgent/` directory. Agent tools: `bash_execute`, `file_read`, `file_write`, `file_edit`, `list_directory`, `git_*`, `grep_search`, `search_and_replace`.

### 3-Tier Caching
- L1: In-memory LRU (5 min TTL)
- L2: Redis (1 hour TTL)
- L3: Disk (24 hour TTL)

---

## Coding Conventions

### TypeScript
- **Strict mode** enabled (`strict: true`, `noImplicitAny`, `strictNullChecks`, etc.)
- **ESM modules** — use `.js` extension in imports (even for `.ts` files): `import { env } from "../config/env.js";`
- **Zod** for all input validation and env var schemas
- **Pino** for structured logging (never `console.log` in backend)
- Path aliases: `@/*`, `@middleware/*`, `@services/*`, `@routes/*`, `@db/*`, `@utils/*`, `@types/*`

### Svelte
- **Svelte 5** with runes mode (`$state`, `$derived`, `$effect`)
- Components in `frontend/src/components/`
- Stores in `frontend/src/stores/`
- Large components have been refactored into submodules (e.g., `ChatStreamManager.ts`, `ChatModeManager.ts`, `FileActivityTracker.ts`)

### Rust
- Edition 2021
- Modules organized by domain (`market_engine.rs` split into `market_segments.rs`, `market_competitors.rs`, `market_revenue.rs`, `market_risks.rs`, `market_analysis.rs`)
- Tests co-located in `#[cfg(test)]` modules

### Testing
- **Backend**: Vitest (118+ test files). Run: `cd backend && npm test`
- **Frontend**: Vitest + Playwright (14 E2E specs). Run: `cd frontend && npm run test:run`
- **Rust**: `cargo test` (190+ tests). Run: `cd intent-compiler && cargo test`
- **Full suite**: `npm test` from root
- **Type-check all**: `npm run check-all` from root

### Git
- Conventional Commits enforced via commitlint + husky
- Format: `type(scope): message` (e.g., `fix(backend): remove stale provider refs`)

---

## Important Files

| File | Purpose |
|------|---------|
| `backend/src/config/env.ts` | Zod-validated environment config — source of truth for all env vars |
| `backend/src/types/integrations.ts` | `IntegrationProviderId` union type — all supported integration providers |
| `packages/ai-core/src/modelRouter.ts` | LLM routing logic (cost, quality, speed tiers) |
| `packages/ai-core/src/modelRegistry.ts` | Full model registry (NIM, Ollama, etc.) |
| `backend/src/services/ai-providers/llmGateway.ts` | Unified LLM API gateway |
| `backend/src/routes/chat.ts` | Main chat streaming endpoint |
| `backend/src/gAgent/` | Agent orchestration system |
| `frontend/src/components/RefactoredChatInterface.svelte` | Main chat UI component |
| `docs/ROADMAP.md` | Feature roadmap and milestone tracking |
| `docs/RELEASE_CHECKLIST.md` | Release readiness checklist |
| `PRD.md` | Full product requirements document |

---

## Common Commands

```bash
# Install all dependencies
pnpm install

# Build shared packages (required before first run)
npm run build:packages

# Start dev servers (backend + frontend concurrently)
npm run dev

# Start backend only
npm run dev:backend

# Start Electron desktop app
cd frontend && npm run electron:dev

# Run all type-checks and linting
npm run check-all

# Run all tests
npm test

# Run backend tests only
cd backend && npx vitest run

# Run Rust tests
cd intent-compiler && cargo test

# Build Electron app
cd frontend && npm run electron:build

# Production environment check
node scripts/check-release-env.js
```

---

## Rules

1. **Never commit `.env` files** — only `.env.example` files belong in version control.
2. **Never hardcode API keys or secrets** — use `backend/src/config/env.ts` to add new env vars with Zod validation.
3. **Always use `.js` extensions in TypeScript imports** — the project uses ESM (`"module": "NodeNext"`).
4. **Use Pino logger, not console.log** — import from `../middleware/logger.js`.
5. **Keep `IntegrationProviderId` in sync** — if adding a new integration provider, update `backend/src/types/integrations.ts`, the Zod `providerSchema` in `backend/src/routes/integrations-v2.ts`, and the `OAUTH_PROVIDERS` record in `backend/src/services/integrations/integrationService.ts`.
6. **Removed AI providers** — GitHub Copilot, Jan, Mistral, and Google (as an `ApiProvider` in `env.ts`) have been removed. Do not re-add them. Google still exists as an `IntegrationProviderId` for user-stored API keys.
7. **Backend incremental builds** — after type changes, delete `.tsbuildinfo` in `backend/` if seeing stale errors: `Remove-Item backend/.tsbuildinfo`
8. **Frontend Svelte 5** — use runes (`$state`, `$derived`, `$effect`), avoid deprecated `createEventDispatcher` and `<svelte:component>`.
9. **Large files** — avoid letting any single component exceed ~500 lines. Extract logic into separate `.ts` modules.
10. **Security** — all production deployments must pass `scripts/check-release-env.js`. See `docs/SECURITY_BASELINE.md`.

---

## Current Status (Feb 2026)

- **Version**: 2.1.0 (NVIDIA Golden Developer pivot complete)
- **Build**: Clean (0 TypeScript errors backend, 0 frontend errors)
- **Next milestone**: v2.2 (Intent Optimizer, IDE integrations, codebase scanner)
- **Release readiness**: ~90% — deployment and production config remain

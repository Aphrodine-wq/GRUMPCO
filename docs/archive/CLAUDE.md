# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**G-Rump** is an enterprise AI development platform (v2.1.0) that transforms natural language into production-ready code. It's **Architecture-as-Code**: your diagram and spec are the source of truth, with code generation being optional.

**NVIDIA Golden Developer Award** — G-Rump targets full NVIDIA ecosystem compliance: Nemotron + NIM inference, NGC-ready cloud deployment (GCP/AWS), NeMo Curator synthetic data, NeMo Framework fine-tuning, and NIM-aligned observability.

This is an npm workspaces monorepo with:
- **Frontend**: Svelte 5 + Electron 28 desktop app
- **Backend**: Express 5 API server
- **Rust Intent Compiler**: Optional NL→JSON parser
- **Shared packages**: AI core, CLI, types, RAG, voice, memory, etc.

## Common Commands

### Development
```bash
npm run dev                # Run backend + frontend concurrently
npm run dev:backend        # Backend only (Express on port 3000)
npm run dev:frontend       # Frontend only (Vite on port 5173)
cd frontend && npm run electron:dev  # Desktop app
```

### Building
```bash
npm run build:packages     # Build shared packages (required first)
npm run build              # Build frontend
cd backend && npm run build  # Build backend with SWC
```

### Testing
```bash
npm test                   # All tests (frontend + backend)

# Backend
cd backend && npm test                              # All backend tests
cd backend && npm test -- tests/services/foo.test.ts  # Single file
cd backend && npm test -- -t "pattern"              # By name pattern
cd backend && npm run test:watch                    # Watch mode
cd backend && npm run evals                         # Agent evaluations

# Frontend
cd frontend && npm run test:run                     # All unit tests (once)
cd frontend && npm run test:run -- src/lib/foo.test.ts  # Single file
cd frontend && npm run test:e2e                     # Playwright E2E tests
cd frontend && npm run test:e2e -- e2e/foo.spec.ts  # Single E2E test
```

### Linting & Formatting
```bash
npm run check-all          # Type-check + lint (backend and frontend)
npm run lint:fix           # Auto-fix lint issues
npm run format             # Format with Prettier
```

## Architecture

### Request Flow
Frontend (Svelte 5 / Vite) → `/api` proxy → Backend (Express 5, port 3000) → AI providers (NVIDIA NIM/Kimi K2.5, OpenRouter, Ollama)

The backend uses SSE (Server-Sent Events) for streaming AI responses to the frontend.

### Two Primary Modes
1. **Architecture Mode** (Design-First): Describe → Architecture (Mermaid) → Spec (PRD) → Code
2. **Code Mode**: AI-powered chat with tools (bash, file read/write/edit, list_dir, git)

### Key Subsystems
- **Intent Compiler** (`intent-compiler/`): Rust-based parser that converts natural language to structured JSON. Has WASM and CLI modes. Falls back to LLM-only parsing if unavailable.
- **G-Agent**: Autonomous AI agent with specialized capabilities (architecture, frontend, backend, DevOps, testing, documentation, security, internationalization) orchestrated through `backend/src/routes/agents.ts`.
- **Model Router** (`packages/ai-core/`): Cost-aware LLM selection across providers.
- **Multi-tier Cache**: L1/L2/L3 caching with optional Redis. Content-addressed cache files in `backend/data/cache/`.
- **Tool Execution**: Sandboxed bash, file ops, git commands via `backend/src/services/`.
- **RAG Engine** (`packages/rag/`): Document-aware AI with Pinecone vector search.
- **Intent-RAG Fusion (IRF)**: Intent guides RAG retrieval (query expansion); RAG augments intent enrichment. See [docs/INTENT_RAG_FUSION.md](docs/INTENT_RAG_FUSION.md).

### Workspace Layout
| Workspace | Purpose | Key Tech |
|-----------|---------|----------|
| `frontend/` | Web UI + Electron host | Svelte 5, Vite 5, TailwindCSS, Playwright |
| `backend/` | API server | Express 5, SQLite/Supabase, SWC, Pino |
| `packages/ai-core/` | Model router & registry | TypeScript |
| `packages/cli/` | CLI tool (`grump` commands) | TypeScript, SWC, Commander |
| `packages/shared-types/` | Shared TypeScript types | TypeScript |
| `packages/utils/` | Shared utilities | TypeScript |
| `packages/rag/` | RAG engine | TypeScript, Pinecone |
| `packages/voice/` | Voice ASR/TTS | NVIDIA Build |
| `packages/memory/` | Conversation memory | TypeScript |
| `packages/kimi/` | Kimi K2.5 optimizations | TypeScript |
| `packages/compiler-enhanced/` | Incremental compilation | TypeScript |
| `packages/vscode-extension/` | VS Code extension | TypeScript |
| `infrastructure/` | Terraform and cloud configs | (optional) |
| `intent-compiler/` | NL→JSON parser | Rust, WASM |
| `services/nemo-curator/` | Synthetic data pipeline | Python, Nemotron/NIM |
| `services/nemo-training/` | NeMo Framework fine-tuning | Python, NeMo AutoModel |
| `deploy/` | Docker, Kubernetes, NGC (GCP/AWS) | Docker, K8s |
| `app-dashboard/` | Product dashboard | Web |
| `docs-site/` | User-facing docs | VitePress |

### Database
- **Development**: SQLite at `backend/data/grump.db` (via better-sqlite3)
- **Production/Serverless**: Supabase (PostgreSQL) — SQLite won't persist on Vercel

### Environment Setup
1. Copy `backend/.env.example` → `backend/.env`
2. Add at least one AI provider key (NVIDIA NIM recommended: `NVIDIA_NIM_API_KEY`)
3. `npm install` from root, then `npm run build:packages`

### Testing Configuration
- **Backend**: Vitest with Node environment, 50% coverage threshold, config in `backend/vitest.config.ts`
- **Frontend**: Vitest with jsdom environment, 80% coverage threshold, config in `frontend/vitest.config.ts`
- **E2E**: Playwright, config in `frontend/playwright.config.ts`, auto-starts dev server
- **G-Agent Evals**: `backend/tests/evals/` with LLM-as-judge via `judge.ts`

### Frontend Proxy
Vite proxies `/api` requests to `http://localhost:3000` (configured in `frontend/vite.config.js`).

## Documentation

Documentation is organized in `docs/`. See `docs/README.md` for the full index.

### NVIDIA Golden Developer
- `docs/NVIDIA_GOLDEN_DEVELOPER.md` — Award submission, checklist, demo script
- `docs/NVIDIA_OBSERVABILITY.md` — NIM-aligned metrics, OTEL config
- `deploy/ngc/` — NGC-ready deployment (GCP, AWS)
- `services/nemo-curator/` — Synthetic data pipeline
- `services/nemo-training/` — Fine-tuning example

### Core Docs (in `docs/`)
| Doc | Purpose |
|-----|---------|
| `OVERVIEW.md` | Complete system overview |
| `GETTING_STARTED.md` | Quick start guide |
| `SETUP.md` | Detailed setup for all platforms |
| `HOW_IT_WORKS.md` | Request pipeline and flows |
| `ARCHITECTURE.md` | System architecture |
| `API.md` | API reference |
| `AGENT_SYSTEM.md` | G-Agent orchestration |
| `CAPABILITIES.md` | Full feature list |
| `PRODUCTION.md` | Deployment readiness |
| `SECURITY.md` | Security requirements |
| `KNOWN_ISSUES.md` | Known issues and workarounds |
| `ROADMAP.md` | Future plans |

### Archived Docs
Older, superseded, or specialized docs are in `docs/archive/` for reference.

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Backend entry point |
| `backend/src/routes/` | API endpoints |
| `backend/src/services/` | Business logic |
| `backend/src/tools/` | LLM tool definitions |
| `backend/src/prompts/` | System prompts |
| `frontend/src/App.svelte` | Frontend root component |
| `frontend/src/components/` | UI components |
| `frontend/src/stores/` | Svelte stores (state) |
| `frontend/electron/main.cjs` | Electron main process |
| `packages/cli/src/index.ts` | CLI entry point |
| `packages/ai-core/src/` | Model router and registry |

## LLM Providers

| Provider | Purpose | Environment Variable |
|----------|---------|---------------------|
| NVIDIA NIM | Primary, GPU-accelerated | `NVIDIA_NIM_API_KEY` |
| OpenRouter | Multi-model fallback | `OPENROUTER_API_KEY` |
| Anthropic | Claude models | `ANTHROPIC_API_KEY` |
| Ollama | Local/offline | `OLLAMA_URL` |

## Version Information

- **Monorepo**: v2.1.0
- **Backend**: v2.0.0
- **Frontend**: v2.0.0
- **CLI**: v3.0.0

See `CHANGELOG.md` for version history.

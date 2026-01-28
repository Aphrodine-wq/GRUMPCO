# G-Rump - System Overview

## What is G-Rump?

**G-Rump is Architecture-as-Code: Terraform for application architecture.** Your diagram and spec are the source of truth; code generation is optional. Living documentation that can generate code—not an AI code generator. Teams can use the architecture output (Mermaid diagram, intent, tech stack, task breakdown) without ever generating code.

Built as a Tauri desktop app with Svelte frontend and Node.js/Express backend (plus a Rust Intent Compiler), G-Rump uses Claude and optional LLM providers to automate intent understanding, architecture diagrams, spec (PRD) generation, and optional multi-agent code generation. It combines spec-first architecture, full pipeline (SHIP: design → spec → plan → code), and tool-enabled code chat. Use it from Desktop, Web, VS Code, CLI, or chat bots. See [ARCHITECTURE_AS_CODE.md](ARCHITECTURE_AS_CODE.md) for philosophy and use-without-codegen workflows.

**Two modes:**
- **Architecture**: Describe → Architecture (Mermaid) → Spec (PRD) → (optional) Code. Phased workflow or full SHIP run. Lead with the diagram; code is optional.
- **Generate code**: Claude-Code-style chat with tools (bash, file read/write/edit, list_dir). Workspace, plan mode, specialist agents, save/load sessions.

### Why G-Rump

One app, one backend: Architecture-as-Code first (diagram + spec + plan), then optional code generation (SHIP or phase bar), and tool-enabled code chat. Use it from the desktop, web, VS Code, CLI, or chat bots (e.g. Moltbot). Generate architecture/spec from Cursor via the [G-Rump API](CURSOR_GRUMP_API.md); the VS Code extension offers "G-Rump: New from description" and "G-Rump: Open chat." Scheduled/24/7 agents, large context (200K+), autonomous (Yolo) mode, and an MCP server (for Cursor/Claude Code) are supported.

---

## Clients and backend

G-Rump uses **one backend** (grump-backend) for all clients. It is not only a standalone Windows desktop app: the same backend is used by the **Desktop app** (Tauri), **Web app**, **VS Code extension**, **CLI** (`grump-analyze`), and **Moltbot/Clawdbot** skill. The backend typically runs on Railway or locally at `VITE_API_URL` (default `http://localhost:3000`). It uses SQLite for persistence and optionally Redis for rate limiting, cache, session storage, and job queues. Optional integrations include Stripe (billing), Supabase (auth/collaboration), and an LLM gateway (Anthropic, OpenRouter, Zhipu, etc.). Clients receive ship and codegen completion events in real time via `GET /api/events/stream` (SSE).

---

## Flows

Three ways to go from idea to architecture (and optionally code):

| Flow | When to use | Path |
|------|-------------|------|
| **Chat-first** | Free-form exploration; architecture and diagrams appear in the chat thread. | User describes intent in Architecture mode → architecture in chat → (optional) move to phase bar for Spec → (optional) Code, or stop after spec. |
| **Phase bar** | You have (or will generate) architecture and want explicit Spec → (optional) Code steps. | Architecture → Spec → Code (optional) via WorkflowPhaseBar and workflowStore. You can stop after Spec. |
| **SHIP** | Fully automated pipeline: design → spec → plan → (optional) code in one run, no chat. | User chooses SHIP submode → single run design→spec→plan→code → outcome in ShipMode. Code is optional in messaging. |

SHIP and phase-bar codegen use different session types (ship_sessions vs codegen sessions); they do not share state. Chat sessions (localStorage) are not tied to ship or codegen sessions.

---

## Sessions

- **Chat session**: Frontend only (`sessionsStore`, localStorage key `mermaid-sessions`). One thread of messages; no backend persistence.
- **Ship session**: Backend table `ship_sessions`. One run of Design→Spec→Plan→Code.
- **Codegen session**: Backend table `sessions`, type `generation`. One code-generation job (start, status, download).

There is no shared project or workspace id linking chat, ship, and codegen today.

---

## Integrations

- **Cursor API / G-Rump skill**: Use G-Rump from Cursor for full app generation, SHIP, and batch codegen. See [CURSOR_GRUMP_API.md](CURSOR_GRUMP_API.md).
- **Webhooks**: Inbound `POST /api/webhooks/trigger`; outbound events (`ship.completed`, `codegen.ready`, etc.) to configured URLs or `POST /api/webhooks/outbound`.
- **Twilio**: Inbound SMS/voice via `POST /api/messaging/inbound`; backend runs chat pipeline and replies via Twilio when configured.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    G-RUMP TAURI DESKTOP APP                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 SVELTE FRONTEND (5178)                        │   │
│  │  Architecture | Generate code modes; Mermaid; workflow; tool call UI │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 NODE EXPRESS BACKEND (3000)                  │   │
│  │  /api/intent | /architecture | /prd | /codegen | /chat/stream │   │
│  │  Agent Orchestrator; tool-enabled chat (workspace, plan, etc) │   │
│  └──────────────────────────────────────────────────────────────┘   │
│              │                          │                            │
│              ▼                          ▼                            │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │ Rust Intent Compiler │    │    LLM (Claude / OpenRouter / etc)   │ │
│  │ grump-intent CLI     │    │  Diagrams, PRDs, agents, tools       │ │
│  └─────────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Tauri 2.x (Rust), Windows |
| Frontend | Svelte, TypeScript, Vite |
| Backend | Node.js 20+, Express, TypeScript |
| Intent | Rust Intent Compiler (grump-intent) |
| AI | Claude (Anthropic API); optional OpenRouter, Zhipu, Copilot via LLM gateway |
| Diagrams | Mermaid.js (C4 architecture) |

---

## Directory Structure

```
milesproject/
├── frontend/                 # Svelte + Vite (Tauri desktop)
│   ├── src/
│   │   ├── App.svelte
│   │   ├── lib/              # API client, stores
│   │   └── ...
│   └── src-tauri/            # Tauri config
├── web/                      # Svelte web app (same backend)
├── backend/                  # Node.js + Express (grump-backend)
│   ├── src/
│   │   ├── routes/           # intent, architecture, prd, codegen, chat, ship, github, etc.
│   │   ├── services/
│   │   └── types/
│   └── .env
├── intent-compiler/          # Rust Intent Compiler (grump-intent)
├── packages/cli/             # grump-analyze CLI
├── integrations/
│   └── vscode-extension/     # VS Code extension
└── start-app.bat             # Boot script (G-Rump desktop)
```

---

## How to Run

```bash
# 1. Ensure backend/.env has ANTHROPIC_API_KEY (and optional LLM gateway vars)
# 2. From project root:
.\start-app.bat
```

This opens:
- G-Rump Backend on `http://localhost:3000`
- G-Rump Frontend on `http://localhost:5178`
- G-Rump Tauri desktop window

---

## Agent evals (architecture, PRD, SHIP, codegen)

G-Rump includes an experimental **offline eval suite** for the main agents so you can measure quality and regressions over time:

- Golden-task definitions live in `backend/tests/evals/*Tasks.ts` for:
  - Architecture (`/api/architecture`)
  - PRD/spec (`/api/prd`)
  - SHIP (`/api/ship/start`)
  - Codegen (`/api/codegen/start`)
- The eval harness (`backend/tests/evals/runEvals.ts`) calls a running backend at `EVAL_BASE_URL` (default `http://localhost:3000`), uses an LLM-as-judge via `backend/tests/evals/judge.ts`, and writes results to `frontend/test-results/agent-evals.json`.
- From `backend/` you can run:

```bash
export ANTHROPIC_API_KEY=your_key_here
NODE_ENV=production PORT=3000 node dist/index.js  # in one terminal

# In another terminal, from backend/
npm run evals
```

This produces per-task scores and comments for architecture and PRD outputs, plus raw results for SHIP and codegen, which you can inspect locally or wire into CI.

---

## Authors

Built with Claude AI assistance for the G-Rump project.

# G-Rump - System Overview

## What is G-Rump?

G-Rump is a **standalone Windows desktop application** that transforms natural language intent into working software projects. Built as a Tauri app with Svelte frontend and Node.js/Express backend (plus a Rust Intent Compiler), it uses Claude AI to automate intent understanding, architecture diagrams, PRD generation, and multi-agent code generation.

**Two modes:**
- **Design**: Describe → Architecture (Mermaid) → PRD → Codegen (ZIP). Phased workflow.
- **Code**: Claude-Code-style chat with tools (bash, file read/write/edit, list_dir). Workspace, plan mode, specialist agents, save/load sessions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    G-RUMP TAURI DESKTOP APP                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 SVELTE FRONTEND (5178)                        │   │
│  │  Design | Code modes; Mermaid; workflow; tool call UI         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 NODE EXPRESS BACKEND (3000)                   │   │
│  │  /api/intent | /architecture | /prd | /codegen | /chat/stream │   │
│  │  Agent Orchestrator; tool-enabled chat (workspace, plan, etc) │   │
│  └──────────────────────────────────────────────────────────────┘   │
│              │                          │                            │
│              ▼                          ▼                            │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │ Rust Intent Compiler │    │         CLAUDE API (Anthropic)      │ │
│  │ grump-intent CLI     │    │  Diagrams, PRDs, agents, tools      │ │
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
| AI | Claude (Anthropic API) |
| Diagrams | Mermaid.js (C4 architecture) |

---

## Directory Structure

```
milesproject/
├── frontend/                 # Svelte + Vite (Tauri)
│   ├── src/
│   │   ├── App.svelte
│   │   ├── lib/              # API client, stores
│   │   └── ...
│   └── src-tauri/            # Tauri config
├── backend/                  # Node.js + Express
│   ├── src/
│   │   ├── routes/           # intent, architecture, prd, codegen, github
│   │   ├── services/
│   │   └── types/
│   └── .env
├── intent-compiler/          # Rust Intent Compiler (grump-intent)
└── start-app.bat             # Boot script (G-Rump)
```

---

## How to Run

```bash
# 1. Ensure backend/.env has ANTHROPIC_API_KEY
# 2. From project root:
.\start-app.bat
```

This opens:
- G-Rump Backend on `http://localhost:3000`
- G-Rump Frontend on `http://localhost:5178`
- G-Rump Tauri desktop window

---

## Authors

Built with Claude AI assistance for the G-Rump project.

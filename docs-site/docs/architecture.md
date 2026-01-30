---
layout: doc
title: Architecture
---

# G-Rump Architecture

## System Overview

G-Rump is a high-performance AI development platform (Architecture-as-Code) that combines:
- **Svelte 5** frontend for the UI (web and desktop)
- **Desktop runtime**: Electron
- **Node.js/Express** backend for API services (SWC-compiled)
- **Rust** intent compiler for natural language processing (parallel + SIMD)
- **NVIDIA NIM** (optional) for embeddings and inference (Kimi K2.5)
- **Multi-tier cache** (L1/L2/L3), **worker pool**, **model router** (cost-aware), **rate limiting**, **Supabase** auth, **Stripe** billing, **webhooks**, **SSE** events

For a file-level map of the codebase, see the [Codebase documentation](/docs/codebase).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│           G-Rump Desktop Application                │
│            (Electron + Svelte)                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐         ┌──────────────┐          │
│  │   Frontend   │────────▶│   Backend    │          │
│  │   (Svelte)   │  HTTP   │  (Bundled)   │          │
│  └──────────────┘         └──────┬───────┘          │
│                                  │                  │
│                         ┌────────▼────────┐         │
│                         │ Intent Compiler │         │
│                         │   (Rust CLI)    │         │
│                         └─────────────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend (Svelte)

**Stores:**
- `sessionsStore` - Session management
- `toastStore` - Toast notifications
- `connectionStatusStore` - Backend connection status
- `authStore` - Authentication state
- `clarificationStore` - Clarification modal state
- `workflowStore` - 3-phase workflow state
- `chatModeStore` - Design vs Code mode (tool-enabled chat)
- `workspaceStore` - Workspace root for file/bash tools
- `codeSessionsStore` - Save/load for Code-mode sessions

**Components:**
- `ChatInterface` - Main chat UI (Design + Code modes)
- `DiagramRenderer` - Mermaid diagram rendering
- `WorkflowPhaseBar` - Workflow progress indicator
- `WorkflowActions` - Phase transition buttons
- `ToolCallCard` / `ToolResultCard` - Tool use display in Code mode

### Backend (Node.js/Express)

**Key entry point:** `backend/src/index.ts` – mounts routes, middleware (auth, rate limit, timeout, metrics), DB, job worker, optional Redis.

**Services:**
- `claudeServiceWithTools` - Tool-enabled chat (bash, file read/write/edit, list_dir); streams via LLM gateway
- `llmGateway` - Unified streaming for OpenRouter, NIM, Zhipu (model router from `@grump/ai-core`)
- `toolExecutionService` - Tool execution (workspace-scoped); path policy via `pathPolicyService`
- `intentCompilerService` - Intent parsing via Rust CLI or WASM, with LLM enrichment
- `architectureService`, `prdGeneratorService`, `codeGeneratorService` - Architecture, PRD, codegen
- `agentOrchestrator`, `wrunnerService` - Multi-agent coordination and quality assurance
- `tieredCache`, `workerPool`, `batchProcessor`, `nimAccelerator` - Cache, workers, batching, NIM

### Intent Compiler (Rust)

CLI tool that:
- Parses natural language input
- Extracts actors, features, data flows, tech stack hints
- Returns structured JSON

## Resource Bundling

### Electron Production Build

1. **Frontend Bundle**
   - Built with Vite: `npm run build`
   - Output: `frontend/dist/` (static files)

2. **Electron Packaging**
   - Uses electron-builder
   - Creates portable executable
   - Output: `frontend/electron-dist/G-Rump.exe`

3. **Backend** (separate)
   - Run from source or bundle separately
   - Electron auto-starts backend from `../backend/dist/`

### Electron Resource Extraction Flow

```
App Launch
    │
    ├─▶ Load splash screen
    │
    ├─▶ Look for backend at ../backend/dist/index.js
    │
    ├─▶ Start backend process (if found)
    │
    ├─▶ Load frontend from localhost:5173 (dev) or dist/ (prod)
    │
    └─▶ Close splash, show main window
```

## Data Flow

### Message Flow

**Design mode** (diagram-first):
```
User Input → ChatInterface → /api/generate-diagram-stream
    ├─▶ Intent Compiler (if needed) → grump-intent.exe
    ├─▶ LLM API → Stream (text + Mermaid)
    └─▶ ChatInterface (updates in real-time)
```

**Code mode** (Claude-Code-style, tool-enabled):
```
User Input → ChatInterface → POST /api/chat/stream
    Body: { messages, workspaceRoot?, planMode?, agentProfile? }
    ├─▶ LLM API (tools: bash, file_read, file_write, file_edit, list_directory)
    ├─▶ Tool execution (workspace-scoped)
    └─▶ SSE: text, tool_call, tool_result, done → ChatInterface
```

### Workflow Flow

```
1. Architecture Phase
   User Input → Architecture Service → Mermaid Diagram
   
2. PRD Phase
   Architecture → PRD Generator → PRD Document
   
3. Code Generation Phase
   PRD → Agent Orchestrator → Generated Code (ZIP)
   ├─▶ Architect Agent (validation & planning)
   ├─▶ Frontend Agent (UI components)
   ├─▶ Backend Agent (APIs & services)
   ├─▶ DevOps Agent (Docker & CI/CD)
   ├─▶ Test Agent (test suites)
   ├─▶ Docs Agent (documentation)
   ├─▶ Work Report Generation (design mode)
   └─▶ WRunner Analysis (quality assurance & auto-fixes)
```

## Security

- Electron uses `contextIsolation: true` and `nodeIntegration: false` via BrowserWindow options
- Helmet middleware on backend
- API keys and secrets in `.env`
- Path validation for security scan (`workspacePath` under `SECURITY_SCAN_ROOT` or cwd)
- Outbound webhook URLs: https-only in production
- Auth: Supabase JWT; optional auth for API (`REQUIRE_AUTH_FOR_API`); webhook secrets required in prod

## Performance Considerations

- Backend build: SWC (fast); intent compiler: Rust with LTO/SIMD
- Tiered cache (L1/L2/L3), worker pool, model router (cost-aware), NIM batching
- See [Performance Guide](/docs/performance) for details

### NIM, Cost Dashboard, and Intent

- **Local NIM:** Set `NVIDIA_NIM_URL` (e.g. `http://nim:8000`) when using a self-hosted or local NIM stack. Omitting it uses the cloud default.
- **Cost dashboard:** The backend mounts `/api/cost`. The frontend exposes a lazy-loaded Cost dashboard (Settings → Cost dashboard).
- **WASM intent:** Optional. Set `GRUMP_USE_WASM_INTENT=true` to prefer the WASM intent parser when available.

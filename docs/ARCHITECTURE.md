# G-Rump Architecture

## System Overview

G-Rump is a high-performance AI development platform (Architecture-as-Code) that combines:
- **Svelte 5** frontend for the UI (web and Tauri desktop)
- **Node.js/Express** backend for API services (SWC-compiled)
- **Rust** intent compiler for natural language processing (parallel + SIMD)
- **NVIDIA NIM** (optional) for embeddings and inference (Kimi K2.5)
- **Multi-tier cache** (L1/L2/L3), **worker pool**, **model router** (cost-aware), **rate limiting**, **Supabase** auth, **Stripe** billing, **webhooks**, **SSE** events

For a file-level map of the codebase, see [CODEBASE.md](./CODEBASE.md).

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│           G-Rump Desktop Application            │
│                  (Tauri + Svelte)               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐         ┌──────────────┐      │
│  │   Frontend   │────────▶│   Backend    │      │
│  │   (Svelte)   │  HTTP   │  (Bundled)   │      │
│  └──────────────┘         └──────┬───────┘      │
│                                   │              │
│                          ┌────────▼────────┐    │
│                          │ Intent Compiler │    │
│                          │   (Rust CLI)    │    │
│                          └─────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
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

**Routes:** See [docs/API.md](./docs/API.md) and README. Core: `/api/chat/stream`, `/api/ship`, `/api/codegen`, `/api/plan`, `/api/spec`, `/api/diagram`, `/api/intent`, `/api/architecture`, `/api/prd`, `/api/security/*`, `/api/webhooks`, `/api/events`, `/health`, `/metrics`.

### Intent Compiler (Rust)

CLI tool that:
- Parses natural language input
- Extracts actors, features, data flows, tech stack hints
- Returns structured JSON

## Resource Bundling

### Production Build

1. **Backend Bundle**
   - Uses `pkg` to bundle Node.js backend
   - Includes embedded Node.js runtime
   - Output: `grump-backend.exe` (~50-100MB)

2. **Intent Compiler**
   - Built with `cargo build --release`
   - Target: `x86_64-pc-windows-msvc`
   - Output: `grump-intent.exe` (~5-10MB)

3. **Tauri Resources**
   - Both executables included as resources
   - Extracted to app data directory on first run
   - Windows: `%APPDATA%\com.grump.app\`

### Resource Extraction Flow

```
App Launch
    │
    ├─▶ Check app data directory
    │
    ├─▶ Extract grump-backend.exe (if not exists)
    │
    ├─▶ Extract grump-intent.exe (if not exists)
    │
    └─▶ Start backend process
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

### Code Mode (Tool-Enabled Chat)

- **Workspace**: User sets a project root; all file/bash tools run relative to it.
- **Plan mode**: Optional "Plan only" toggle; model outputs a plan, no tool use.
- **Agent profiles**: General, Router, Frontend, Backend, DevOps, Test (specialist system prompts).
- **Sessions**: Save/load Code-mode conversations (messages, workspace, agent profile).

## Environment Configuration

### Development

- Backend runs as Node.js process
- Intent compiler from `intent-compiler/target/release/`
- Frontend dev server on port 5178

### Production

- Backend runs as bundled executable
- Intent compiler from app data directory
- Frontend bundled in Tauri app

## Security

- CSP configured in `tauri.conf.json`; Helmet on backend
- API keys and secrets in `.env` (see [PRODUCTION_CHECKLIST](./docs/PRODUCTION_CHECKLIST.md))
- Path validation for security scan (`workspacePath` under `SECURITY_SCAN_ROOT` or cwd)
- Outbound webhook URLs: https-only in production
- Auth: Supabase JWT; optional auth for API (`REQUIRE_AUTH_FOR_API`); webhook secrets required in prod

## Performance Considerations

- Backend build: SWC (fast); intent compiler: Rust with LTO/SIMD
- Tiered cache (L1/L2/L3), worker pool, model router (cost-aware), NIM batching
- See [docs/PERFORMANCE_GUIDE.md](./docs/PERFORMANCE_GUIDE.md) and [docs/OPTIMIZATION_SUMMARY.md](./docs/OPTIMIZATION_SUMMARY.md)

### NIM, Cost Dashboard, and Intent

- **Local NIM:** Set `NVIDIA_NIM_URL` (e.g. `http://nim:8000`) when using a self-hosted or local NIM stack (e.g. `docker compose -f docker-compose.yml -f docker-compose.gpu.yml`). Omitting it uses the cloud default.
- **Cost dashboard:** The backend mounts `/api/cost` (see [costDashboard](../backend/src/routes/costDashboard.ts)). The frontend exposes a lazy-loaded Cost dashboard (Settings → Cost dashboard, or via the cost snippet in the sidebar).
- **WASM intent:** Optional. Set `GRUMP_USE_WASM_INTENT=true` to prefer the WASM intent parser when available; otherwise the CLI is used. Build the WASM module with `./build-wasm.sh` or `build-wasm.bat` in `intent-compiler/`.

## Future Improvements

- [ ] Code splitting for backend services
- [ ] Caching for generated architectures (architecture and PRD outputs are now cached via tiered cache)
- [ ] Offline mode support

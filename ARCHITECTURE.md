# G-Rump Architecture

## System Overview

G-Rump is a desktop application built with Tauri that combines:
- **Svelte 5** frontend for the UI
- **Node.js/Express** backend for API services
- **Rust** intent compiler for natural language processing

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

**Services:**
- `claudeService` - Anthropic API integration
- `claudeServiceWithTools` - Tool-enabled chat (bash, file read/write/edit, list_dir)
- `toolExecutionService` - Tool execution (workspace-scoped)
- `intentCompilerService` - Intent parsing via Rust CLI with Claude Code enrichment
- `architectureService` - Architecture generation
- `prdGeneratorService` - PRD generation
- `codeGeneratorService` - Code generation
- `agentOrchestrator` - Multi-agent coordination with work report generation
- `wrunnerService` - Quality assurance and auto-fix system

**Routes:**
- `/api/diagram` - Diagram generation
- `/api/intent` - Intent parsing
- `/api/architecture` - Architecture generation
- `/api/prd` - PRD generation
- `/api/codegen` - Code generation
- `POST /api/chat/stream` - Tool-enabled chat (workspaceRoot, planMode, agentProfile)

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
    ├─▶ Claude API → Stream (text + Mermaid)
    └─▶ ChatInterface (updates in real-time)
```

**Code mode** (Claude-Code-style, tool-enabled):
```
User Input → ChatInterface → POST /api/chat/stream
    Body: { messages, workspaceRoot?, planMode?, agentProfile? }
    ├─▶ Claude API (tools: bash, file_read, file_write, file_edit, list_directory)
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

- CSP configured in `tauri.conf.json`
- API keys stored in `.env` (not bundled)
- Backend runs locally (no external exposure)
- Tauri security model enforced

## Performance Considerations

- Backend bundling adds ~50-100MB (includes Node.js)
- Intent compiler is lightweight (~5-10MB)
- Frontend bundle optimized with code splitting
- Mermaid diagrams rendered client-side

## Future Improvements

- [ ] Code splitting for backend services
- [ ] Lazy loading for intent compiler
- [ ] Caching for generated architectures
- [ ] Offline mode support

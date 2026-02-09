# Implementation Plan: Claude Code-Style Generation & Enhanced ASCII Charts

> **Created**: 2026-02-07  
> **Status**: ✅ Implemented (Phase 1-6, partial Phase 3, 7, 8)  
> **Priority**: High

---

## Implementation Progress

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Agentic Loop Enhancement | ✅ Done |
| **Phase 2** | Prompt Hardening | ✅ Done |
| **Phase 3A** | CodeAgentTimeline Component | ✅ Done |
| **Phase 3C** | FilesChangedSummary Component | ✅ Done |
| **Phase 3D** | Workspace Path Indicator | ✅ Done |
| **Phase 3B** | Enhanced ToolResultCard | 🟡 Pending |
| **Phase 3E** | Quick Action Buttons | 🟡 Pending |
| **Phase 4** | Sequence Diagram ASCII | ✅ Done |
| **Phase 5** | Class Diagram ASCII | ✅ Done |
| **Phase 6A** | State Diagram ASCII | ✅ Done |
| **Phase 6B** | ER Diagram ASCII | ✅ Done |
| **Phase 6C** | Gantt Chart ASCII | ✅ Done |
| **Phase 6D** | Pie Chart ASCII | ✅ Done |
| **Phase 7** | Flowchart Improvements | 🟡 Pending |
| **Phase 8** | Integration & Polish | 🟡 Partial |

---

## What Was Implemented

### Backend Changes

1. **`backend/src/prompts/chat/code.ts`** — Complete rewrite with:
   - 5 CRITICAL RULES that must never be violated
   - Structured 5-step WORKFLOW (Explore → Plan → Execute → Verify → Summarize)
   - Fallback rules for when tools are unavailable
   - Formatting and iteration rules
   - Specialist-specific prompts (frontend, backend, devops, test)

2. **`backend/src/services/claudeServiceWithTools.ts`** — Enhanced with:
   - `FileChangeRecord` interface for tracking file operations
   - `agentic_progress` event type (currentTurn, maxTurns, toolCallCount)
   - `files_summary` event type (files changed, commands run/passed, total turns)
   - File change accumulator tracks all `file_write`, `file_edit`, `write_file`, etc.
   - Command execution tracking for `bash_execute`, `terminal_execute`, `run_command`
   - Progress events emitted each iteration for UI feedback
   - Files summary emitted at end of generation when file ops occurred

### Frontend Changes

3. **`frontend/src/types/index.ts`** — Added:
   - `FilesSummaryBlock` interface
   - Added to `ContentBlock` union type

4. **`frontend/src/lib/chatStreaming.ts`** — Enhanced with:
   - `files_summary` and `agentic_progress` event types
   - `filesSummary` and `agenticProgress` properties on `ChatStreamEvent`
   - Event handlers that push `files_summary` blocks into content array

5. **`frontend/src/components/chat/CodeAgentTimeline.svelte`** — NEW:
   - Vertical timeline showing Plan → Tool Call → Result → Summary
   - Status indicators (pending, running, success, error)
   - File paths with diff stats (+N / -N)
   - Iteration counter and active indicator
   - Monospace design with subtle animations

6. **`frontend/src/components/chat/FilesChangedSummary.svelte`** — NEW:
   - Collapsible summary card showing all modified files
   - Change type icons (+ created, ~ modified, - deleted)
   - Per-file line diff counts
   - Aggregate stats (total added/removed, commands passed/run, turns)
   - Dark terminal-like aesthetic

7. **`frontend/src/components/chat/ChatHeader.svelte`** — Enhanced with:
   - `chatMode` and `workspacePath` props
   - Code mode badge (⚡ CODE MODE pill)
   - Workspace path indicator (📂 …/path/to/project)

8. **`frontend/src/components/chat/MessageBubble.svelte`** — Enhanced with:
   - FilesChangedSummary import and rendering
   - Renders `files_summary` blocks inline in messages

9. **`frontend/src/components/chat/index.ts`** — Updated exports

### ASCII Diagram Renderers

10. **`frontend/src/lib/asciiDiagram.ts`** — Major expansion with 6 new renderers:

    - **Sequence Diagram**: Parses `sequenceDiagram`, renders participant boxes + lifelines + arrows with labels
    - **Class Diagram**: Parses `classDiagram`, renders UML-style boxes with properties/methods sections
    - **State Diagram**: Parses `stateDiagram`, renders rounded state boxes with transition arrows
    - **ER Diagram**: Parses `erDiagram`, renders entity boxes with attributes + relationship list
    - **Gantt Chart**: Parses `gantt`, renders titled bar chart with done/active/pending bars
    - **Pie Chart**: Parses `pie`, renders horizontal bar chart with percentages

    Updated `mermaidToAscii()` to route to correct renderer based on diagram type.
    Updated `canRenderAsAscii()` to recognize all 6 new diagram types.

---

## Remaining Work

### Phase 3B — Enhanced ToolResultCard (Inline File Preview)
- Show collapsible preview of first 20 lines for new files
- Show file size and line count

### Phase 3E — Quick Action Buttons
- "Run Tests", "Build Project", "View File Tree", "Continue Building" buttons after code gen

### Phase 7 — Flowchart Improvements
- Subgraph support
- Edge label overlap fix
- Cross-layer edge routing

### Phase 8 — Integration & Polish
- Unit tests for all ASCII renderers
- Better ASCII diagram styling in MessageBubble (monospace font, contrast)
- Smart fallback for unknown diagram types

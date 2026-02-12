# Agent Screen & Chat Provider Fixes

> **Priority:** High — These issues break core functionality.
> **Date:** 2026-02-09

---

## 1. Fix Broken AI Providers in Agent Chat (CRITICAL)

### Problem
`AgentScreen.svelte` hardcodes `openai` and `deepseek` as provider names, but the backend Zod schema only accepts: `nim`, `openrouter`, `ollama`, `jan`, `github-copilot`, `kimi`, `anthropic`, `mistral`, `google`, `grump`, `mock`.

Selecting OpenAI or DeepSeek → Zod 400 error → chat fails silently.

### Fix
**Option A (Recommended):** Replace the hardcoded `MODEL_OPTIONS` array with the dynamic `ModelPicker.svelte` component (same one used by the regular Chat screen). It loads from `/api/models/list` and only shows configured, valid providers.

**Option B (Quick fix):** Route OpenAI/DeepSeek through `openrouter`:

**File:** `frontend/src/components/AgentScreen.svelte` (lines 101–110)

```diff
 const MODEL_OPTIONS = [
   { provider: 'anthropic', id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
-  { provider: 'openai', id: 'gpt-4o', label: 'GPT-4o' },
-  { provider: 'openai', id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
+  { provider: 'openrouter', id: 'openai/gpt-4o', label: 'GPT-4o' },
+  { provider: 'openrouter', id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
-  { provider: 'google', id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
-  { provider: 'google', id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
+  { provider: 'google', id: 'gemini-3-pro', label: 'Gemini 3 Pro' },
+  { provider: 'google', id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash' },
-  { provider: 'deepseek', id: 'deepseek-chat', label: 'DeepSeek V3' },
-  { provider: 'deepseek', id: 'deepseek-reasoner', label: 'DeepSeek R1' },
+  { provider: 'openrouter', id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
+  { provider: 'openrouter', id: 'deepseek/deepseek-reasoner', label: 'DeepSeek R1' },
   { provider: 'nim', id: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5' },
   { provider: 'grump', id: 'g-compn1-auto', label: 'G-CompN1 Auto' },
 ];
```

Also fix `claude-sonnet-4-20250514` — this ID is not registered in `PROVIDER_CONFIGS`. Use `claude-3-5-sonnet-20241022` or `claude-opus-4-6-20260206`.

---

## 2. Fix XSS Vulnerability in Agent Chat (CRITICAL)

### Problem
**File:** `frontend/src/components/AgentScreen.svelte` (line 802)

```svelte
{@html (block as { content: string }).content?.replace?.(/\n/g, '<br>') || ''}
```

This renders raw HTML from AI responses. A prompt injection could inject `<script>` tags.

### Fix
Either:
- Use a sanitizer like DOMPurify: `{@html DOMPurify.sanitize(content.replace(/\n/g, '<br>'))}`
- Or render as plain text with `<pre>` / CSS `white-space: pre-wrap` (simpler and safer)
- Best: Use a markdown renderer (like the main Chat does) so code blocks render properly

---

## 3. Add Missing Agent Screen Settings

The backend already supports all of these — the frontend just doesn't expose them.

**File:** `frontend/src/components/AgentScreen.svelte`

### 3a. Budget Limit Control
Add a number input for max session budget (dollars). Wire to `gAgentBudgetStore`.

### 3b. Max Turns
Add a slider or number input (default: 25, range: 1–100). Send as part of chat config.

### 3c. Temperature
Add a slider (0.0–2.0, default: 0.7). Pass to `streamChat()` options.

### 3d. System Prompt / Custom Instructions
Add a textarea for custom agent instructions. Prepend to the system prompt.

### 3e. Workspace Root
Add a directory picker or text input. Pass as `workspaceRoot` in the chat request body.

### 3f. Tool Allowlist/Denylist
Add a checklist of available tools with enable/disable toggles. Send as `toolAllowlist`/`toolDenylist`.

### 3g. Guardrails — Allowed Directories
Add a list input for allowed filesystem directories. Send as `guardRailOptions.allowedDirs`.

### 3h. Agent Profile Selector
Add a dropdown: General, Router, Frontend, Backend, DevOps, Test. Send as `agentProfile`.

### 3i. RAG Context Toggle
Add a toggle: "Include document retrieval". Send as `includeRagContext: true`.

### 3j. Model Preset Quick Selector
Add 3 buttons: Fast / Balanced / Quality. Send as `modelPreset`.

### 3k. Large Context Mode Toggle
Add a toggle for extended message limits. Send as `largeContext: true`.

---

## 4. Improve Agent Chat Rendering

### Problem
Agent chat renders plain text — no markdown, no syntax-highlighted code blocks, no rich tool cards.

### Fix
Reuse existing components in the Agent chat panel:
- `CodeBlock.svelte` — for code syntax highlighting
- `ToolCallCard.svelte` — for rich tool call display
- `ToolResultCard.svelte` — for structured tool results
- `DiagramRenderer.svelte` — for mermaid charts
- Add a markdown renderer for text blocks (same as main Chat)

---

## 5. Clean Up Stale Artifacts

- [ ] Delete `backend/New folder (2)/` — accidental directory
- [ ] Reconcile model IDs across `PROVIDER_CONFIGS`, `DEFAULT_MODELS`, `MODEL_OPTIONS`, and any other hardcoded lists into a single source of truth
- [ ] Move channel config from `localStorage` to backend persistence (or at minimum document the limitation)

---

## 6. Component Size Reduction (Recommended)

These components are 40–50KB monoliths. Extract sub-components:

| File | Size | Suggested Extractions |
|------|------|-----------------------|
| `AgentScreen.svelte` | 48KB | `AgentConfigPanel.svelte`, `AgentChatPanel.svelte`, `AgentChannels.svelte`, `AgentModelSelector.svelte` |
| `RefactoredChatInterface.svelte` | 50KB | Already partially extracted — continue splitting |
| `KnowledgeBase.svelte` | 45KB | Extract tab panels into sub-components |

---

## Verification

After fixes, verify:
1. Select each provider in Agent chat → send a message → confirm no 400 errors
2. Select GPT-4o (via OpenRouter) → confirm streaming response works
3. Select DeepSeek (via OpenRouter) → confirm streaming response works
4. Confirm all new settings are sent in the `streamChat()` request body
5. Confirm no `{@html}` renders unsanitized content
6. Run `pnpm build` in `frontend/` — confirm no TypeScript errors

# Road to 100: Full Execution Plan

**Current Score: 77/100 → Target: 100/100**

---

## Phase 1: Code Quality (+5 pts → 82)

### 1A. `backend/src/services/ai-providers/llmGatewayStreams.ts` — Extract duplicated tool-call emission

The tool-call emission logic is copy-pasted 3 times (lines 193-214, lines 262-284, lines 291-313). Create a helper function `emitPendingToolCalls()` that yields the tool_use content blocks and clears the map, then replace all 3 blocks with `yield* emitPendingToolCalls(toolCalls)`.

### 1B. `frontend/src/components/RefactoredChatInterface.svelte` — Decompose from 2038 lines into ~400

Extract 5 new child components:

1. **`ChatStreamingStatus.svelte`** — Lines ~113-220: `streaming`, `streamingStatus`, `streamingBlocks`, `streamingThinking`, `streamingActiveFiles` derived state, `getFileAction()`, `getShortFilePath()`. The Claude Code-style file activity tracker.
2. **`ChatQuestionDetector.svelte`** — Lines ~255-410: `extractOptions()`, `detectNumberedQuestions()`, `ParsedQuestion` type, question modal trigger logic.
3. **`ChatMessageList.svelte`** — Lines ~410-900: message rendering loop, `visibleMessages` derived, `showAllMessages` toggle, hidden message count, scroll behavior, auto-scroll.
4. **`ChatModelSelector.svelte`** — Lines ~220-254 + model state: `expandedModelIndex`, `currentModelKey`, model switching logic.
5. **`ChatImageHandler.svelte`** — Image attachment state/UI: `pendingImages`, `MAX_PENDING_IMAGES`, image selection, NIM provider detection.

The parent becomes an orchestrator that imports these 5 + existing children, passes props/callbacks, and handles only top-level state (messages array, input text, send handler).

### 1C. `intent-compiler/src/lib.rs` — Reduce from 1291 lines

- Create `src/keywords.rs` — move `DATA_FLOW_KEYWORDS`, `TECH_STACK_KEYWORDS`, and other `const` keyword arrays (~100 lines)
- Create `src/prelude.rs` — move all `pub use` re-export blocks (~300 lines)
- Target: `lib.rs` down to ~400 lines (module declarations + core functions like `parse_intent`, `extract_actors`, `run_enrichment_pipeline`)

---

## Phase 2: Documentation Cleanup (+3 pts → 85)

### 2A. Move these to `docs/archive/`

- `DOCUMENTATION_OVERHAUL_REPORT.md`
- `CODE_GENERATION_AND_ASCII_CHARTS_PLAN.md`
- `IMPLEMENTATION_CHECKLIST.md`
- `IMPLEMENTATION_SUMMARY.md`
- `KIMI_OPTIMIZATIONS.md`
- `MOBILE_BLOB_FIXES.md`
- `NVIDIA_OPTIMIZATION_COMPLETE.md`
- `OPTIMIZATION_SUMMARY.md`
- `BEFORE_AFTER.md`
- `BRAND_ACTION_PLAN.md`
- `BRAND_AUDIT.md`

### 2B. Merge overlapping docs

| Keep | Merge Into It | Action |
|------|---------------|--------|
| `API.md` | `API_AND_EXTERNAL_SETUP.md`, `CURSOR_GRUMP_API.md` | Merge unique content, delete originals |
| `GETTING_STARTED.md` | `ENV_SETUP.md`, `LINUX_SETUP.md` | Merge platform-specific setup |
| `DEPLOYMENT.md` | `GPU_DEPLOYMENT.md` | Add GPU section |
| `INTEGRATIONS.md` | `INTEGRATIONS_SETUP.md`, `OAUTH_INTEGRATIONS_SETUP.md` | Merge setup instructions |
| `OVERVIEW.md` | `HOW_IT_WORKS.md` | Merge, delete duplicate |

### 2C. Create `docs/README.md`

Single index mapping each remaining doc to its purpose, audience, and last-updated date.

---

## Phase 3: Testing Hardening (+5 pts → 90)

### 3A. Run all test suites locally, fix any failures

```bash
cd backend && npm run test:coverage
cd frontend && npm run test:coverage
cd intent-compiler && cargo test --lib
cd frontend && npm run test:e2e:ci
```

### 3B. Add component tests for the new decomposed components

- `ChatStreamingStatus.test.ts`
- `ChatQuestionDetector.test.ts`
- `ChatMessageList.test.ts`

Use `@testing-library/svelte` + `vitest` (already configured).

### 3C. Add `proptest` property-based tests for Rust compiler

- Add `proptest` as dev-dependency in `Cargo.toml`
- Fuzz `parse_intent` with arbitrary strings (should never panic)
- Verify `extract_actors` is deterministic

```rust
#[cfg(test)]
mod property_tests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn parse_intent_never_panics(s in "\\PC{0,500}") {
            let _ = super::parse_intent(&s, serde_json::json!({}));
        }

        #[test]
        fn extract_actors_deterministic(s in "[a-zA-Z ]{0,200}") {
            let r1 = super::extract_actors(&s);
            let r2 = super::extract_actors(&s);
            assert_eq!(r1, r2);
        }
    }
}
```

### 3D. Add CI badge to `README.md`

```markdown
[![CI](https://github.com/your-org/grump/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/grump/actions/workflows/ci.yml)
```

---

## Phase 4: Production Readiness (+5 pts → 95)

### 4A. Close production checklist items

In `docs/PRODUCTION_CHECKLIST.md`, mark each of the ~25 items:
- `[x] Done` or `[N/A] Not applicable — <reason>`
- Implement missing: `BLOCK_SUSPICIOUS_PROMPTS`, `REQUIRE_AUTH_FOR_API`, `SECURITY_STRICT_PROD`, `CORS_ORIGINS` env defaults

### 4B. Replace in-memory session storage

Replace with Redis-backed (or SQLite-backed) session store for production scalability.

### 4C. Improve `/health` endpoint

Return meaningful status (DB connected, Redis reachable, key services alive) — not just `{ status: "ok" }`.

### 4D. Validate error sanitization

Start backend with `NODE_ENV=production`, trigger errors, verify no stack traces or internal details leak.

---

## Phase 5: Final Polish (+5 pts → 100)

### 5A. Create `docs/DEMO.md`

5-minute demo script:
1. Start the app
2. SHIP workflow (Design → Spec → Plan → Code)
3. Chat Mode with tool calling
4. Code gen from Mermaid diagram
5. Rust intent compiler in action

### 5B. Update README screenshots

Capture actual current UI post all the polish work.

### 5C. Add project metadata

- `.nvmrc` with `20`
- `engines` field in root `package.json`
- Verify LICENSE file exists

### 5D. Create `docs/ADR.md`

Architecture Decision Records:
- Why Rust for the intent compiler
- Why Svelte 5 over React
- Why multi-agent over single-agent
- Why Electron for desktop

---

## Verification (Run After All Phases)

```bash
pnpm run lint
pnpm run type-check
cd backend && npm run test:coverage
cd frontend && npm run test:coverage
cd intent-compiler && cargo test --lib
cd frontend && npm run test:e2e:ci
pnpm run build
```

Push to a branch, verify CI is all green, screenshot the GitHub Actions checks. That's 100.

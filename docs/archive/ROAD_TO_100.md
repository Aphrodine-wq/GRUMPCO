# Road to 100: Comprehensive Improvement Plan

## Revised Baseline Score: 76/100

After deeper analysis, the project is stronger than initially assessed (59 frontend tests, 14 E2E specs, 27 Rust test modules with 190+ tests). Here's every gap and how to close it.

---

## Phase 1: Quick Wins (+6 pts → 82)
*Estimated effort: 2-4 hours*

### 1.1 Cleanup Stale Artifacts (+1 pt)
- Delete `nul` file at project root (debug artifact)
- Remove duplicate workspace config — `pnpm-workspace.yaml` already exists, `package.json` `workspaces` array is redundant when using pnpm
- Remove `frontend/frontend/package.json` if it's a stale duplicate

### 1.2 Deduplicate Router Logic in modelRouter.ts (+1 pt)
The Nemotron 3 Nano / long-context check appears **3 separate times** (lines 229-237, 238-248, 311-330). Refactor into a single helper:
```typescript
function routeForLongContext(messageChars: number, requiredContext?: number): RouterResult | null
```

### 1.3 Consolidate Overlapping Docs (+2 pts)
Merge or archive these overlapping docs in `docs/`:
| Keep | Merge Into It / Archive |
|------|------------------------|
| `ARCHITECTURE.md` | Archive `ARCHITECTURE_AS_CODE.md` (subset) |
| `SYSTEM_RATING.md` | Archive `SYSTEM_EVALUATION.md` (duplicate assessment) |
| `DOCUMENTATION_OVERHAUL_REPORT.md` | Archive `DOCUMENTATION_IMPROVEMENT_REPORT.md` |
| `OVERVIEW.md` | Archive `COMPLETE_SYSTEM_GUIDE.md` (overlap) |
| `SETUP.md` | Archive `GETTING_STARTED.md` vs `QUICK_START.md` — keep one |
| N/A | Move `THINGS_TO_DO.md` to GitHub Issues |
| N/A | Move `CODEBASE_VALUATION.md` out of docs/ |

### 1.4 Fix Docker Compose Security (+1 pt)
- Remove hardcoded default credentials (`grump:grump`) from `docker-compose.yml`
- Require `.env` for all secrets with clear error if missing
- Add `# CHANGE THIS` comments for security-sensitive defaults

### 1.5 Remove `.env` from root (+1 pt)
Currently, `.env` is at the project root. Only `.env.example` should be in version control. Add `.env` to `.gitignore` if not already there.

---

## Phase 2: Component Decomposition (+6 pts → 88)
*Estimated effort: 6-10 hours*

### 2.1 Split RefactoredChatInterface.svelte (67KB, 2038 lines) (+3 pts)

This is the single biggest code quality issue. Split into ~8 focused modules:

| New Component | Lines | Responsibility |
|--------------|-------|----------------|
| `ChatStreamManager.ts` | ~100 | Stream lifecycle, abort handling, error recovery |
| `ChatModeManager.ts` | ~80 | Mode state (normal/plan/spec/ship/design/argument/code) |
| `FileActivityTracker.ts` | ~80 | Claude Code-style file tracking (`streamingActiveFiles`) |
| `QuestionDetector.ts` | ~110 | `detectNumberedQuestions()`, `extractOptions()` |
| `ChatAttachments.svelte` | ~70 | Session attachments UI + handlers |
| `ChatMessageList.svelte` | ~150 | Message rendering, visible messages, scroll |
| `ChatInputBar.svelte` | ~100 | Input, model picker, pending images/docs |
| `RefactoredChatInterface.svelte` | ~400 | Orchestrator importing the above |

### 2.2 Split market_engine.rs (67KB, ~1500 lines) (+2 pts)

| New Module | Structs/Functions |
|-----------|------------------|
| `market_analysis.rs` | `MarketAnalysis`, `analyze_market()`, scoring functions |
| `market_segments.rs` | `MarketSegment`, segmentation logic |
| `market_competitors.rs` | `Competitor`, `CompetitiveMoat`, competitive analysis |
| `market_revenue.rs` | `RevenueModel`, `UnitEconomics`, financial modeling |
| `market_risks.rs` | `RiskFactor`, `GoToMarketStrategy` |
| `market_engine.rs` | Re-exports + orchestration (thin coordinator) |

### 2.3 Split Other Large Components (+1 pt)
- `KnowledgeBase.svelte` (45KB) → Extract MCP tab, Skills tab into sub-components
- `DesignToCodeScreen.svelte` (42KB) → Extract code preview, design input, and settings panels
- `TabbedSettingsScreen.svelte` (40KB) → Extract each tab into its own component

---

## Phase 3: Testing Hardening (+6 pts → 94)
*Estimated effort: 8-12 hours*

### 3.1 Add Missing Frontend Component Tests (+2 pts)
Priority components that lack tests (sorted by importance):
1. `RefactoredChatInterface.svelte` — test message sending, mode switching, stream error handling
2. `SettingsScreen.svelte` / `TabbedSettingsScreen.svelte` — test settings persistence
3. `BootScreen.svelte` — test boot sequence completion
4. `FileExplorerPanel.svelte` — test file navigation
5. `KnowledgeBase.svelte` — test tab switching

### 3.2 Add Test Coverage Reporting & Threshold (+1 pt)
- Configure `vitest` coverage threshold (e.g., 60% minimum)
- Add `c8` or `istanbul` coverage to CI pipeline
- Configure Rust `cargo tarpaulin` or `llvm-cov` for Rust coverage
- Add coverage badges to README

### 3.3 Verify E2E Tests Are Wired Into CI (+1 pt)
- Confirm `frontend/e2e/*.spec.ts` are run by a CI workflow
- If not, add a Playwright step to `ci.yml`
- Add `playwright.config.ts` validation

### 3.4 Add Backend Service Integration Tests (+1 pt)
Current backend tests exist but add coverage for:
- Model router (`ai-core/modelRouter.ts`) — unit tests for all routing paths
- Agent orchestrator — test agent delegation logic
- Caching service — test 3-tier cache behavior

### 3.5 Add Rust Property-Based Tests (+1 pt)
Add `proptest` or `quickcheck` for the intent compiler:
- Fuzz `parse_intent` with random strings
- Property: `parse_intent` should never panic
- Property: `parse_intents_batch` results should equal sequential `parse_intent` calls

---

## Phase 4: Production Polish (+4 pts → 98)
*Estimated effort: 4-8 hours*

### 4.1 Performance Validation (+1 pt)
- Run and document current benchmark results from `cargo bench`
- Validate claimed performance numbers (18x build, 15x parsing) with current code
- Add benchmark assertions that fail if performance regresses beyond 10%

### 4.2 API Contract Testing (+1 pt)
- Ensure OpenAPI spec (`openapi.test.ts`) covers all endpoints listed in the README
- Add response schema validation for critical endpoints
- Ensure all API routes are documented in the generated spec

### 4.3 Observability Validation (+1 pt)
- Verify Prometheus `/metrics` endpoint returns actual metrics (not just a placeholder)
- Add OpenTelemetry traces to critical paths (model routing, streaming, code gen)
- Verify Grafana dashboards import correctly from `monitoring/` configs

### 4.4 Error Handling Polish (+1 pt)
- Add structured error responses across all API routes (consistent `{ error, code, message }` shape)
- Ensure graceful degradation when AI providers are down (not just mock mode)
- Add circuit breaker pattern for external API calls

---

## Phase 5: Final 2 Points → 100
*Estimated effort: 4-6 hours*

### 5.1 Developer Experience (+1 pt)
- Add `devcontainer.json` to `.devcontainer/` (directory exists but appears empty)
- Create a `Makefile` or `justfile` with common commands
- Add `npm run setup` that handles `build:packages` automatically
- Ensure `npm run dev` works from a fresh clone without manual steps

### 5.2 End-to-End Showcase (+1 pt)
- Record a working demo video (or link Loom/Asciinema) of the SHIP workflow
- Add screenshots that match the current UI (not stale placeholders)
- Verify the "Quick Install" section in README works on a fresh machine
- Add a `demo/` script that runs the full pipeline with mock data

---

## Summary: Point-by-Point Bridge from 76 → 100

| Phase | Points | Key Actions |
|-------|--------|-------------|
| **1. Quick Wins** | +6 | Cleanup, dedup, docs consolidation, Docker security |
| **2. Component Decomposition** | +6 | Split 5 mega-files across TypeScript/Svelte/Rust |
| **3. Testing Hardening** | +6 | Component tests, coverage gates, E2E in CI, property tests |
| **4. Production Polish** | +4 | Benchmarks, API contracts, observability, error handling |
| **5. Final Polish** | +2 | DevX, demo showcase |
| **Total** | **+24** | **76 → 100** |

---

## Verification Plan

### Automated Tests
- `npm run check-all` — type-check and lint across all packages
- `npm test` — runs frontend vitest + backend tests
- `cd intent-compiler && cargo test` — all Rust unit + integration tests
- `cd frontend && npx playwright test` — E2E tests (if configured)
- `npm run test:coverage` — coverage reports with thresholds

### Manual Verification
Since most changes in Phase 1-2 are refactors, the key manual check is:
1. **After Phase 1**: Run `npm run dev` and verify the app loads and chat works
2. **After Phase 2**: Verify the chat interface, knowledge base, and design-to-code screens all render correctly (same behavior, new internal structure)
3. **After Phase 3**: Check coverage reports show improved numbers
4. **After Phase 5**: Follow the README "Quick Install" from scratch on a clean directory

> [!IMPORTANT]
> I can start executing any of these phases immediately. Phase 1 (Quick Wins) is the fastest path to visible improvement — I can knock it out in a single session. Which phase(s) would you like me to tackle?

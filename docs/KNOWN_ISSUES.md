# Known Issues and Suppressions

This doc lists intentional suppressions and remaining work. Many lint/type items have been addressed (Phase 1.1).

## Backend

### TypeScript
- **logger.ts**: `@ts-expect-error` for pino-http callback types (documented; runtime behavior is correct).
- **tsconfig**: `strict: true`, `noEmitOnError: true` (backend).

### ESLint
- Backend lint passes with no errors; remaining optional improvements can be done incrementally.

## Frontend
- Some `any` and non-null assertions remain in stores and components; type-check and lint pass. Optional: replace with proper types and restrict `console` to warn/error.

## How to run checks
- **Backend**: `cd backend && npm run type-check && npm run lint && npm run build`
- **Frontend**: `cd frontend && npm run type-check && npm run lint && npm run build`
- **All**: From repo root: `npm run check-all` (runs backend + frontend type-check and lint).

## Timeouts
- Request timeout middleware ([backend/src/middleware/timeout.ts](backend/src/middleware/timeout.ts)): chat/stream 10 min, codegen 5 min, architecture 3 min (generate-stream 5 min). Streaming responses (Accept: text/event-stream) skip the middleware so long sessions are not cut off.

## Architecture and Codegen (manual verification)
- **Architecture mode**: If "describe → Mermaid → PRD" fails, check: (1) `ANTHROPIC_API_KEY` in backend/.env, (2) network/CORS, (3) backend logs for 4xx/5xx or timeout. Endpoints: `POST /api/architecture/generate`, `POST /api/prd/generate`.
- **Codegen / tool calls**: If timeouts or silent failures occur, verify: (1) timeout values in timeout middleware and toolExecutionService (bash default 30s), (2) chat stream timeout is skipped for SSE; (3) backend logs for tool execution errors.

## Verification (automated)
- **Backend unit tests**: `cd backend && npm test` — all pass.
- **Frontend unit tests**: `cd frontend && npm run test:run` — all pass.
- **CLI**: `cd packages/cli && npm run build` — builds successfully.
- **Web app**: `cd web && npm run build` — builds successfully (fixed missing `Dashboard` import in [web/src/App.svelte](web/src/App.svelte)).
- **CI**: [.github/workflows/ci.yml](.github/workflows/ci.yml) — E2E job now builds backend before starting server (`npm run build` then `npm run start:prod`).

## Screens
- **SetupScreen**: Wired into [frontend/src/App.svelte](frontend/src/App.svelte). Shown when `!$setupComplete`; completing or skipping calls `preferencesStore.completeSetup()` so the main chat is shown.

## Changelog
- Phase 1.1: Cleared backend lint/type suppressions (any → unknown, non-null fixes, empty object types, validator/logger documented). Backend strict, lint clean.
- E2E: global-setup waits for backend health in CI; Playwright config and waits hardened.
- Evals: parseEvalsSummary.mjs path fixed; CI publishes score summary when ANTHROPIC_API_KEY is set.
- UI: Keyboard shortcuts (Ctrl+B sidebar, Ctrl+Shift+L or / focus chat); demo note on SetupScreen; Export for plan/architecture/PRD.
- Deploy: README documents VITE_API_URL for production and Windows installer path.
- Removed unused `@ts-expect-error` in backend `rateLimiter.ts`. Added root `npm run check-all`. SQLite WAL in .gitignore. Timeouts tuned. CI E2E uses `start:prod`. SetupScreen on first load. Web app Dashboard import fixed.

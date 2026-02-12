# Known Issues and Limitations

> **Version:** 2.1.0 | **Last Updated:** February 11, 2026

This document lists intentional suppressions, known limitations, and remaining work items.

---

## Backend

### TypeScript
- **logger.ts**: `@ts-expect-error` for pino-http callback types — documented; runtime behavior is correct.
- **tsconfig**: `strict: true`, `noEmitOnError: true` enabled.
- **0 TypeScript errors** as of v2.1.0 release.

### ESLint
- Backend lint passes with no errors. Remaining optional improvements can be done incrementally.

### Test Infrastructure
- Backend test suite uses **vitest v1.6.x**. Some test files were removed in v2.1.0 because their source files were reorganized into subdirectories during the v2.0→v2.1 refactor.
- Logger mock in `tests/setup.ts` provides both default and named exports globally.

---

## Frontend

### TypeScript
- Some `any` and non-null assertions remain in stores and components; type-check and lint pass. Optional: replace with proper types.
- **0 TypeScript errors** via `svelte-check`. 173 warnings (CSS/a11y cosmetic) — non-blocking.

### Component Testing
- `ArchitecturePreview.test.ts` has one failing test due to a Svelte 5 snippet/runes compatibility issue with `@testing-library/svelte` in jsdom. This is a known limitation of the testing library, not a bug in the component.

---

## Timeouts
- Request timeout middleware: chat/stream 10 min, codegen 5 min, architecture 3 min (generate-stream 5 min). Streaming responses (`Accept: text/event-stream`) skip the middleware so long sessions are not cut off.

## Architecture and Codegen
- If "describe → Mermaid → PRD" fails, check: (1) `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY` in `backend/.env`, (2) network/CORS, (3) backend logs for 4xx/5xx or timeout.
- If tool call timeouts or silent failures occur, verify: (1) timeout values in timeout middleware and toolExecutionService (bash default 30s), (2) backend logs for tool execution errors.

## Redis
- When `REDIS_HOST` is set but Redis is unreachable, the app runs with in-memory rate limiting (not shared) and no L2 cache. `/health/detailed` reports `redis: degraded`. See [RUNBOOK_REDIS](RUNBOOK_REDIS.md).

---

## How to Run Checks

```bash
# All checks (from repo root)
npm run check-all

# Backend only
cd backend && npm run type-check && npm run lint

# Frontend only
cd frontend && npm run type-check && npm run lint

# Tests
npm test           # all
cd backend && npx vitest run    # backend only
cd frontend && npm run test:run # frontend only
cd intent-compiler && cargo test # Rust only
```

---

## See Also

- [TESTING.md](./TESTING.md) — Testing guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — Common issues and solutions
- [RUNBOOK.md](./RUNBOOK.md) — Operational runbooks

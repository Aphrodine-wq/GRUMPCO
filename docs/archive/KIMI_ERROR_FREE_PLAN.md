# 🛡️ G-Rump — Zero Errors Codebase Plan (Kimi Edition)

> **Goal:** Achieve and maintain **zero errors** across every layer of the G-Rump monorepo  
> **Owner:** Kimi  
> **Created:** Feb 10, 2026  
> **Status:** 🔴 Not Started

---

## Overview

This plan is a **systematic, repeatable checklist** to guarantee the entire G-Rump codebase is free of:

- TypeScript type errors (backend + frontend + packages)
- Svelte component warnings/errors
- Rust compiler errors and Clippy warnings
- ESLint violations
- Prettier formatting drift
- Failing unit, integration, and E2E tests
- Stale build artifacts causing phantom errors

Every section includes the **exact command** to run, what a **clean result** looks like, and what to do **when it fails**.

---

## Phase 0 — Clean Slate (Do This First, Every Time)

> Stale caches and incremental build artifacts are the #1 source of phantom errors.

```powershell
# 1. Kill stale TypeScript build info
Remove-Item backend\.tsbuildinfo -ErrorAction SilentlyContinue
Remove-Item frontend\.tsbuildinfo -ErrorAction SilentlyContinue

# 2. Clear Vite cache
Remove-Item frontend\node_modules\.vite -Recurse -Force -ErrorAction SilentlyContinue

# 3. Reinstall dependencies (only if package.json changed)
pnpm install

# 4. Rebuild shared packages (ai-core, shared-types, utils depend on each other)
npm run build:packages
```

### ✅ Clean Slate Exit Criteria
- [ ] No `.tsbuildinfo` files lingering
- [ ] `pnpm install` exits clean (no peer dep warnings that block builds)
- [ ] `npm run build:packages` succeeds with 0 errors

---

## Phase 1 — TypeScript: Zero Type Errors

### 1A. Backend Type-Check

```powershell
cd backend
npx tsc --noEmit
```

**Clean result:** Zero output, exit code 0.

**When it fails:**
| Error Pattern | Fix |
|---|---|
| `Cannot find module '...'` | Check `.js` extension in import path (ESM requires it) |
| `TS2307: Cannot find module '@grump/...'` | Rebuild shared packages: `npm run build:packages` |
| `TS2345: Argument of type X is not assignable` | Fix the type mismatch at the call site |
| `TS2304: Cannot find name` | Missing import or `@types/*` package not installed |
| `TS18046: 'x' is of type 'unknown'` | Add type guard or explicit cast |

### 1B. Frontend Type-Check (Svelte + TypeScript)

```powershell
cd frontend
npx svelte-check --tsconfig ./tsconfig.json
```

**Clean result:** `0 errors, 0 warnings` (some info-level hints are OK).

**When it fails:**
| Error Pattern | Fix |
|---|---|
| Svelte rune errors (`$state`, `$derived`) | Make sure component uses `<script lang="ts">` and Svelte 5 syntax |
| `A11y:` warnings | Add `aria-label`, `role`, or semantic HTML elements |
| `Type 'X' is not assignable to type 'Y'` in `.svelte` files | Fix the binding or prop type |
| `Cannot find module './Foo.svelte'` | Verify file exists and casing matches (Windows is case-insensitive, Linux is not) |

### 1C. Shared Packages Type-Check

```powershell
cd packages/shared-types && npx tsc --noEmit
cd ../ai-core && npx tsc --noEmit
cd ../utils && npx tsc --noEmit
```

### 1D. One-Command Full Type-Check

```powershell
# From monorepo root:
npm run type-check
```

This runs `svelte-check` (frontend) + `tsc --noEmit` (backend) sequentially.

### ✅ Phase 1 Exit Criteria
- [ ] `npm run type-check` — **0 errors across all packages**

---

## Phase 2 — Linting: Zero ESLint Violations

### 2A. Backend Lint

```powershell
cd backend
npx eslint src
```

**Clean result:** No output, exit code 0.

**Auto-fix what you can:**
```powershell
cd backend
npx eslint src --fix
```

### 2B. Frontend Lint

```powershell
cd frontend
npx eslint "src/**/*.ts" "src/**/*.js"
```

**Auto-fix:**
```powershell
cd frontend
npx eslint src --fix
```

### 2C. One-Command Full Lint

```powershell
# From monorepo root:
npm run lint
```

**Common ESLint issues and fixes:**

| Rule | Fix |
|---|---|
| `@typescript-eslint/no-unused-vars` | Remove the variable or prefix with `_` |
| `@typescript-eslint/no-explicit-any` | Replace `any` with a proper type or `unknown` |
| `prefer-const` | Change `let` to `const` where variable is never reassigned |
| `no-console` | Replace `console.log` with Pino logger (`import logger from '../middleware/logger.js'`) |

### ✅ Phase 2 Exit Criteria
- [ ] `npm run lint` — **0 errors, 0 warnings**

---

## Phase 3 — Formatting: Zero Prettier Drift

### 3A. Check Formatting (Non-Destructive)

```powershell
# From monorepo root:
npm run format:check
```

### 3B. Auto-Fix All Formatting

```powershell
# From monorepo root:
npm run format
```

### ✅ Phase 3 Exit Criteria
- [ ] `npm run format:check` — **All files formatted correctly**

---

## Phase 4 — Rust: Zero Compiler Errors + Clippy Clean

### 4A. Compile Check

```powershell
cd intent-compiler
cargo check
```

**Clean result:** `Finished` with 0 errors, 0 warnings.

### 4B. Clippy (Rust Linter)

```powershell
cd intent-compiler
cargo clippy -- -D warnings
```

The `-D warnings` flag treats all warnings as errors — this is the strictest setting.

**Common Clippy fixes:**

| Lint | Fix |
|---|---|
| `clippy::needless_return` | Remove explicit `return` at end of function |
| `clippy::redundant_clone` | Remove unnecessary `.clone()` |
| `clippy::match_single_binding` | Replace `match` with `let` |
| `clippy::too_many_arguments` | Refactor into a struct |
| `clippy::type_complexity` | Create a type alias |

### 4C. Rust Tests

```powershell
cd intent-compiler
cargo test --lib
```

### ✅ Phase 4 Exit Criteria
- [ ] `cargo check` — 0 errors
- [ ] `cargo clippy -- -D warnings` — 0 warnings
- [ ] `cargo test --lib` — all tests pass

---

## Phase 5 — Tests: 100% Pass Rate

### 5A. Backend Tests (Vitest — 118+ test files)

```powershell
cd backend
npx vitest run
```

**When tests fail:**
1. Read the failure message — is it a type error, assertion error, or timeout?
2. Check if the test depends on `.env` values (copy `.env.example` → `.env` if missing)
3. Check if the test depends on Redis or a database (some integration tests may need services running)
4. Run the single failing file in isolation:
   ```powershell
   cd backend
   npx vitest run tests/path/to/failing.test.ts
   ```

### 5B. Frontend Tests (Vitest — unit + component tests)

```powershell
cd frontend
npx vitest run
```

### 5C. Frontend E2E Tests (Playwright)

```powershell
cd frontend
npx playwright test
```

> **Note:** E2E tests require both backend and frontend dev servers running.
> Start them first: `npm run dev` from root.

### 5D. One-Command Full Test Suite

```powershell
# From monorepo root:
npm test
```

This runs frontend tests first, then backend tests.

### ✅ Phase 5 Exit Criteria
- [ ] `npm test` — **all tests passing**
- [ ] `cargo test --lib` — **all Rust tests passing**

---

## Phase 6 — Full Build Verification

> A passing type-check doesn't mean the build works. Verify the actual build output.

### 6A. Backend Build (SWC)

```powershell
cd backend
npm run build
```

### 6B. Frontend Build (Vite)

```powershell
cd frontend
npm run build
```

### 6C. Electron Build (Desktop App)

```powershell
cd frontend
npm run electron:build
```

> This one takes longer (~2-5 min). Only run when preparing a release.

### ✅ Phase 6 Exit Criteria
- [ ] `npm run build` (backend) — successful, `dist/` populated
- [ ] `npm run build` (frontend) — successful, `dist/` populated
- [ ] Electron build — `grump.exe` produced in `frontend/electron-dist/`

---

## Phase 7 — The Nuclear Option: `check-all`

This is the **single command** that runs type-checking AND linting across the entire monorepo:

```powershell
# From monorepo root:
npm run check-all
```

Under the hood this runs:
1. `backend/type-check` → `tsc --noEmit`
2. `frontend/type-check` → `svelte-check`
3. `backend/lint` → `eslint src`
4. `frontend/lint` → `eslint src`

### ✅ Phase 7 Exit Criteria
- [ ] `npm run check-all` — **ZERO errors across the entire monorepo**

---

## Phase 8 — Production Safety Checks

### 8A. Release Environment Check

```powershell
node scripts/check-release-env.js
```

Verifies all required production env vars are set and security flags are enabled.

### 8B. Ship-Ready Check

```powershell
node scripts/ship-ready-check.js
```

### ✅ Phase 8 Exit Criteria
- [ ] Both scripts exit with success
- [ ] No `CRITICAL` or `WARN` items remaining

---

## 🏆 The Master Checklist

Run this **in order** and don't skip steps. Copy this into your daily workflow.

```
DAILY ERROR-FREE ROUTINE
========================

[ ] Phase 0 — Clean Slate
    [ ] Remove .tsbuildinfo files
    [ ] pnpm install
    [ ] npm run build:packages

[ ] Phase 1 — TypeScript (npm run type-check)
    [ ] Backend: 0 errors
    [ ] Frontend: 0 errors
    [ ] Packages: 0 errors

[ ] Phase 2 — Linting (npm run lint)
    [ ] Backend: 0 errors
    [ ] Frontend: 0 errors

[ ] Phase 3 — Formatting (npm run format:check)
    [ ] All files clean

[ ] Phase 4 — Rust
    [ ] cargo check: 0 errors
    [ ] cargo clippy -- -D warnings: 0 warnings
    [ ] cargo test --lib: all pass

[ ] Phase 5 — Tests (npm test)
    [ ] Backend vitest: all pass
    [ ] Frontend vitest: all pass

[ ] Phase 6 — Builds
    [ ] Backend build: success
    [ ] Frontend build: success

[ ] Phase 7 — Nuclear (npm run check-all)
    [ ] ZERO errors monorepo-wide

[ ] Phase 8 — Production Safety
    [ ] check-release-env.js: pass
    [ ] ship-ready-check.js: pass
```

---

## Quick Reference: All Commands

| What | Command | Run From |
|------|---------|----------|
| **Clean slate** | `Remove-Item backend\.tsbuildinfo; pnpm install; npm run build:packages` | Root |
| **Type-check all** | `npm run type-check` | Root |
| **Lint all** | `npm run lint` | Root |
| **Lint + fix** | `npm run lint:fix` | Root |
| **Format check** | `npm run format:check` | Root |
| **Format fix** | `npm run format` | Root |
| **Test all (JS)** | `npm test` | Root |
| **Test Rust** | `cargo test --lib` | `intent-compiler/` |
| **Clippy** | `cargo clippy -- -D warnings` | `intent-compiler/` |
| **Check everything** | `npm run check-all` | Root |
| **Build backend** | `npm run build` | `backend/` |
| **Build frontend** | `npm run build` | `frontend/` |
| **Prod env check** | `node scripts/check-release-env.js` | Root |
| **Ship-ready** | `node scripts/ship-ready-check.js` | Root |

---

## Rules of Engagement

1. **Never push to `main` with errors** — run `npm run check-all && npm test` before every commit
2. **Fix errors at the source** — don't use `@ts-ignore`, `eslint-disable`, or `#[allow(...)]` unless there is a documented reason in a comment next to it
3. **One error introduced = one error fixed before moving on** — don't accumulate tech debt
4. **CI is the final judge** — if GitHub Actions is green, the codebase is clean. If it's red, stop what you're doing and fix it
5. **Morning ritual** — start every coding session with `npm run check-all`. No exceptions.

---

> **Kimi — run through this plan top to bottom. Fix everything you find. When every checkbox is checked, you've won. Let's ship clean.** 💪

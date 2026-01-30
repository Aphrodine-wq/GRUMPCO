# Contributing to G-Rump

Thank you for your interest in contributing. This document explains how to set up the project, run tests, and submit changes.

## Prerequisites

- **Node.js** 20+
- **npm** (workspaces)
- **Rust** 1.77+ (optional; for intent compiler)
- **Docker** (optional; for containerized runs)

## Getting started

### Clone and install

```bash
git clone https://github.com/your-org/grump.git
cd grump
npm install
```

This installs dependencies for the root workspace and all packages (`frontend`, `backend`, `packages/*`).

### Build

```bash
# Backend (uses SWC – fast)
cd backend && npm run build && cd ..

# Frontend
cd frontend && npm run build && cd ..

# Intent compiler (optional; Rust)
cd intent-compiler && cargo build --release && cd ..

# CLI (optional)
cd packages/cli && npm run build && cd ..
```

### Run locally

```bash
# Terminal 1: backend
cd backend && npm run dev

# Terminal 2: frontend
cd frontend && npm run dev
```

Backend: `http://localhost:3000`. Frontend: `http://localhost:5173` (or 5178). Copy `backend/.env.example` to `backend/.env` and set `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY` (and other keys as needed).

## Code quality

Before submitting a pull request:

```bash
# From repo root
npm run type-check   # TypeScript check (backend + frontend)
npm run lint         # Lint (backend + frontend)
npm run lint:fix     # Auto-fix lint where possible
npm run format       # Format code
npm test             # Run tests (frontend + backend)
```

Or use the combined check:

```bash
npm run check-all
```

## Branch naming and pull requests

- Create a **feature branch** from the default branch (e.g. `main` or `master`): `feature/short-description` or `fix/short-description`.
- Keep commits logical (e.g. one fix or one feature per commit).
- Open a **pull request** with a clear title and description. Link any related issues.
- Ensure CI passes (type-check, lint, tests). Maintainers may request changes.

## Code style

- **TypeScript/JavaScript**: Follow the project’s ESLint and Prettier config. Run `npm run lint:fix` and `npm run format` before committing.
- **Rust**: Use `cargo fmt` and `cargo clippy` in `intent-compiler/`.

## Where to look

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Codebase map**: [CODEBASE.md](./CODEBASE.md)
- **Documentation index**: [docs/README.md](./docs/README.md)
- **Production and security**: [docs/PRODUCTION_CHECKLIST.md](./docs/PRODUCTION_CHECKLIST.md)

## Push and sync (release flow)

When you are ready to push and sync with the remote:

1. **Branch**: Work on a feature branch (e.g. `open-source-readiness`) or your default branch (`main` / `master`).
2. **Commits**: Use logical commits so history is clear, e.g.:
   - `security: validate workspacePath in security scan`
   - `perf: add LLM response cache for plan mode`
   - `docs: add CONTRIBUTING and docs index`
   - `chore: update README and ARCHITECTURE`
3. **Pre-push**: From repo root run:
   ```bash
   npm run check-all
   npm test
   ```
4. **Push**: `git push origin <branch>` (replace with your default branch if different).
5. **Sync**: If you use multiple remotes or need to sync with upstream:
   ```bash
   git pull --rebase origin <branch>
   git push origin <branch>
   ```
   On GitHub/GitLab you can create a release or tag (e.g. `v1.0.0-open-source`) for this milestone. Document in CONTRIBUTING or README which branch to use when cloning.

## Questions

- Open a **GitHub Discussion** or **Issue** for questions, bugs, or feature ideas.
- For security issues, please report privately (e.g. security advisory or contact maintainers) rather than in a public issue.

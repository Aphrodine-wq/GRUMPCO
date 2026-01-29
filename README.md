# G-Rump

G-Rump is an AI-powered development assistant that helps you design architectures, generate PRDs, and create full-stack applications from natural language descriptions.

## Features

- **Architecture Generation**: Create comprehensive system architecture diagrams using Mermaid
- **PRD Generation**: Automatically generate Product Requirements Documents
- **Multi-Agent Code Generation**: Generate full-stack applications with specialized AI agents
- **Intent Compiler**: Parse natural language into structured, code-optimized project requirements
- **Design Mode**: Automatic work report generation for each agent
- **WRunner Quality Assurance**: Automatic issue detection and auto-fix capabilities
- **Claude Code Optimization**: All prompts optimized for Claude Code best practices
- **Windows Desktop App**: Native Tauri application with bundled backend

## Quick Start

**Fastest way to run (Windows):** Clone the repo, copy `backend/.env.example` to `backend/.env` and add your `ANTHROPIC_API_KEY`, then from the project root run `.\start-app.bat`. Backend: http://localhost:3000, frontend: http://localhost:5173. For desktop: `cd frontend && npm run tauri:dev`.

### Prerequisites

- Node.js 20+
- Rust (for building intent-compiler and Tauri app)
- Windows 10/11 (for production builds)

### Development Setup

1. **Install dependencies:**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   
   # Intent Compiler (Rust)
   cd ../intent-compiler
   cargo build --release
   ```

2. **Configure environment:**
   ```bash
   # Create backend/.env
   cd backend
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY
   ```

3. **Start development:**
   ```bash
   # From project root
   .\start-app.bat
   ```
   Backend runs on port 3000, frontend on 5173. Verify: http://localhost:3000/health and http://localhost:5173. See [docs/OVERVIEW.md](docs/OVERVIEW.md) for ship path and deploy options.

### Building for Windows

Run the build script:
```bash
build-windows.bat
```

This will:
1. Build the intent-compiler Rust binary
2. Bundle the backend with embedded Node.js
3. Build the Svelte frontend
4. Create Windows MSI/NSIS installers

Output will be in `frontend/src-tauri/target/release/bundle/`

## Keyboard shortcuts

- **Ctrl/Cmd+B**: Toggle sidebar
- **Ctrl/Cmd+Shift+L** or **/** (when not in an input): Focus chat input

### Deploy (hosted web)

- **Backend**: Deploy to Vercel with `CORS_ORIGINS`, `NODE_ENV=production`, and `ANTHROPIC_API_KEY`.
- **Frontend**: Build with `cd frontend && npm run build`. Set **`VITE_API_URL`** at build time to your backend URL (e.g. `https://your-backend.vercel.app`). Serve `dist/`. See [docs/OVERVIEW.md](docs/OVERVIEW.md).
- **Windows installer**: After `cd frontend && npm run tauri:build`, installers are in `frontend/src-tauri/target/release/bundle/`.

## Architecture

- **Frontend**: Svelte 5 + Tauri (Windows desktop app)
- **Backend**: Node.js/Express (bundled as executable)
- **Intent Compiler**: Rust CLI (bundled as executable)

## Running evals and E2E

- **E2E**: Backend must be running. From repo root: start backend (`cd backend && npm run start:prod`), then `cd frontend && npm run test:e2e` (or `npm run test:e2e:ci` in CI). In CI, E2E job starts the backend and sets `VITE_API_URL`; global-setup waits for backend health.
- **Evals**: Backend must be running. `cd backend && npm run evals`. Writes `frontend/test-results/agent-evals.json`. In CI (when `ANTHROPIC_API_KEY` is set), the agent-evals job runs evals and publishes a score summary to the job summary. Use `EVAL_CORRECTNESS_THRESHOLD` (default 3.0) to fail the job if average correctness is below threshold.

## Contributing / Development

- **Install**: Backend: `cd backend && npm install`. Frontend: `cd frontend && npm install`.
- **Env**: Copy `backend/.env.example` to `backend/.env` and set `ANTHROPIC_API_KEY`.
- **Type-check**: Backend: `cd backend && npm run type-check`. Frontend: `cd frontend && npm run type-check`.
- **Lint**: Backend: `cd backend && npm run lint`. Frontend: `cd frontend && npm run lint`.
- **Build**: Backend: `cd backend && npm run build`. Frontend: `cd frontend && npm run build`.
- **Run**: From project root: `.\start-app.bat` (Windows) starts backend on 3000 and frontend on 5173.
- **Check all**: From project root: `npm run check-all` runs backend + frontend type-check and lint.
- **Known issues**: See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) for suppressions and incremental fix strategy.

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup instructions
- [BUILD.md](BUILD.md) - Windows build guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [MIGRATION.md](MIGRATION.md) - Vue to Svelte migration notes
- [docs/AGENT_SYSTEM.md](docs/AGENT_SYSTEM.md) - Complete agent system documentation
- [docs/INTENT_COMPILER.md](docs/INTENT_COMPILER.md) - Intent compiler documentation
- [docs/AI_WORKFLOWS.md](docs/AI_WORKFLOWS.md) - AI workflow patterns and best practices
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) - Known issues and lint/type suppressions

## License

[Your License Here]

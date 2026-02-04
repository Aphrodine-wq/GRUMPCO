# G-Rump Frontend

Svelte 5 desktop UI (Electron + Vite). Chat, architecture, spec, plan, codegen, cost dashboard, settings. Backend uses NVIDIA NIM (Nemotron) for AI inference.

**Version:** 2.1.0

Uses Electron 28 as the desktop runtime:
- **Electron**: Cross-platform, easy setup. Press **Ctrl+Shift+G** to show G-Rump from anywhere; close hides to tray (Quit from tray to exit).

## Environment

Set `VITE_API_URL` to the backend base URL (default in dev: `http://localhost:3000`). See [backend README](../backend/README.md) and [docs/PRODUCTION.md](../docs/PRODUCTION.md) for backend env.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 5173). |
| `npm run build` | Production build. |
| `npm run build:fast` | Fast production build with terser. |
| `npm run preview` | Preview production build. |
| `npm run electron:dev` | Electron dev (Vite + Electron). |
| `npm run electron:fast` | Fast Electron dev (shorter timeout). |
| `npm run electron:build` | Build Electron portable app. |
| `npm run electron:pack` | Pack Electron (no installer). |
| `npm run type-check` | Svelte/TypeScript check. |
| `npm run lint` / `npm run lint:fix` | ESLint. |
| `npm run format` / `npm run format:check` | Prettier formatting. |
| `npm run test:unit` | Unit tests in watch mode (Vitest). |
| `npm run test:run` | Unit tests single run (Vitest). |
| `npm run test:coverage` | Unit tests with coverage. |
| `npm run test:e2e` | E2E tests (Playwright). |
| `npm run test:e2e:ui` | E2E tests with UI. |

## Structure

- `src/main.ts` – Entry.
- `src/App.svelte` – Root component.
- `src/components/` – ChatInterface, DiagramRenderer, ProjectsDashboard, SettingsScreen, SpecMode, ToolCallCard, ToolResultCard, etc.
- `src/stores/` – sessionsStore, authStore, workflowStore, specStore, chatModeStore, workspaceStore, codeSessionsStore, etc.
- `src/lib/` – Design system, API client, mermaid, shiki highlighting.
- `electron/` – Electron main process and preload scripts.
- `e2e/` – Playwright E2E tests.

## Key Dependencies

- **Svelte 5** – UI framework with runes
- **Vite 5** – Build tool
- **TailwindCSS 3** – Styling
- **Mermaid** – Diagram rendering
- **Shiki** – Syntax highlighting
- **Lucide Svelte** – Icons
- **Electron 28** – Desktop runtime

See [CODEBASE.md](../docs/CODEBASE.md) for the full map.

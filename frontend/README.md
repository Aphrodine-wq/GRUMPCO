# G-Rump Frontend

Svelte 5 web app (Vite). Chat, architecture, spec, plan, codegen, cost dashboard, settings.

Uses Electron as the desktop runtime:
- **Electron**: Cross-platform, easy setup

## Environment

Set `VITE_API_URL` to the backend base URL (default in dev: `http://localhost:3000`). See [backend README](../backend/README.md) and [docs/PRODUCTION_CHECKLIST.md](../docs/PRODUCTION_CHECKLIST.md) for backend env.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server. |
| `npm run build` | Production build. |
| `npm run preview` | Preview production build. |
| `npm run electron:dev` | Electron dev (Vite + Electron). |
| `npm run electron:build` | Build Electron portable app. |
| `npm run electron:pack` | Pack Electron (no installer). |
| `npm run type-check` | Svelte/TypeScript check. |
| `npm run lint` / `npm run lint:fix` | ESLint. |
| `npm run test:run` | Unit tests (Vitest). |
| `npm run test:e2e` | E2E tests (Playwright). |

## Structure

- `src/main.ts` – Entry.
- `src/App.svelte` – Root component.
- `src/components/` – ChatInterface, DiagramRenderer, ProjectsDashboard, SettingsScreen, SpecMode, etc.
- `src/stores/` – sessionsStore, authStore, workflowStore, specStore, etc.
- `src/lib/` – Design system, API client, mermaid.
- `electron/` – Electron main process and preload scripts.

See [CODEBASE.md](../CODEBASE.md) for the full map.

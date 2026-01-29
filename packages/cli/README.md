# grump CLI

Unified G-Rump CLI with subcommands: **ship**, **argument**, **plan**, **code**, **analyze**.

**Requires:** G-Rump backend running (default `http://localhost:3000`).

## Usage

```bash
grump <command> [options]
grump-analyze [options]   # alias for grump analyze (legacy)
```

## Commands

| Command   | Description                         | Example |
|----------|-------------------------------------|---------|
| **ship** | Start SHIP workflow                 | `grump ship --message "A todo app with React"` |
| **argument** | Chat in argument mode           | `grump argument --message "REST vs GraphQL?"` |
| **plan** | Generate a plan                     | `grump plan --message "Add auth to the API"` |
| **code** | Download codegen result             | `grump code --session <id> [--output <dir>]` |
| **analyze** | Analyze codebase, write Mermaid  | `grump analyze --workspace . --output ./arch.mmd` |

## Common options

- `--url <base>` – Backend API URL (default: `GRUMP_API_URL` or `http://localhost:3000`)

## Command options

- **ship**: `--message` / `-m` (required), `--stream` (use streaming execute)
- **argument**: `--message` / `-m`
- **plan**: `--message` / `-m` (required)
- **code**: `--session <id>` (required), `--output` / `-o` (default: cwd)
- **analyze**: `--workspace` (default: cwd), `--output` (default: `./architecture.mmd`), `--diagram-type` (default: `component`)

## Environment

- `GRUMP_API_URL` – Backend base URL when `--url` is not given
- `GRUMP_API_KEY` – Optional; sent as `Authorization: Bearer <key>` if set

## Codegen flow (grump code)

Code generation is started via the backend (e.g. SHIP or web/API). The CLI does not start codegen; it only fetches status and download:

1. **Poll status:** `GET /api/codegen/status/:sessionId` – returns `status`, `progress`, `agents`. Use this to wait until `status === 'completed'`.
2. **Download:** `GET /api/codegen/download/:sessionId` – returns a ZIP of generated files.

Example: after starting a SHIP run (or codegen via API), use the returned `sessionId` with `grump code --session <id> --output ./out` to download the result.

## Build and run

```bash
cd packages/cli && npm install && npm run build
node dist/index.js ship --message "A CRUD API with Express"
node dist/index.js analyze --workspace . --output ./docs/architecture.mmd
node dist/index.js code --session <sessionId> --output ./out
```

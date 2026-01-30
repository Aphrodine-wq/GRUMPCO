# G-Rump Roadmap

> **Last Updated:** January 2026

## Version Milestones

| Version | Target | Focus | Status |
|---------|--------|-------|--------|
| **v1.0** | Q1 2026 | Core SHIP workflow, Electron app, basic codegen | Current |
| **v1.1** | Q2 2026 | More AI models, Intent Optimizer, Agent evals | Planned |
| **v1.2** | Q3 2026 | IDE integrations, Codebase scanner, Webhooks | Planned |
| **v2.0** | Q4 2026 | Multi-agent orchestration, "Wow" features | Future |

## Priority Legend

- **P0** - Critical for next release
- **P1** - High priority, planned for upcoming versions
- **P2** - Medium priority, on roadmap
- **P3** - Nice to have, backlog

---

## 1. More AI models (P1 - v1.1)

G-Rump already supports multiple providers via the LLM gateway (`anthropic`, `zhipu`, `copilot`, `openrouter`) in `backend/src/services/llmGateway.ts`. Next steps:

- Add additional providers (e.g. Groq, Together, local Ollama).
- Expose a richer model picker in Desktop and Web (per-mode defaults, “fast” vs “quality” presets).
- Document model-specific limits (context window, tool support, streaming behaviour).

## 2. More IDE integrations (P1 - v1.2)

Current integrations:

- VS Code extension: `integrations/vscode-extension`
- Cursor and Claude Code via the REST API and MCP server

Planned:

- JetBrains plugins (IntelliJ/WebStorm) that reuse the same webview UI and backend.
- A generic LSP-style or CLI-based interface so any editor can trigger SHIP, architecture, and codegen.
- Deeper Cursor integration (beyond REST/MCP) with ready-made rules/skills.

## 3. Scan entire codebase → Mermaid chart (P1 - v1.2)

Backend support exists today:

- `POST /api/analyze/architecture` in `backend/src/features/codebase-analysis/routes.ts` accepts a `workspacePath`
  and returns a Mermaid diagram plus summary from the existing codebase.

Frontend support:

- `analyzeArchitecture(workspacePath)` in `frontend/src/stores/featuresStore.ts`.
- A Settings screen entry point in `frontend/src/components/SettingsScreen.svelte` (“Codebase Architecture (Mermaid)”)
  that uses the workspace root from Code mode and shows the generated summary + Mermaid diagram.

Future enhancements:

- Diagram type switch (C4 context, C4 container, component, flow).
- Optional focus filters (per package, feature, or service).
- Tight integration with the main Architecture mode viewer.

## 4. Intent Optimizer (P0 - v1.1)

Today, G-Rump uses the Rust Intent Compiler (`grump-intent`) plus LLM enrichment in
`backend/src/services/intentCompilerService.ts` to extract actors, features, data flows, and tech stack hints.

Planned “Intent Optimizer” capabilities:

- A dedicated endpoint that takes raw or parsed intent and returns a cleaned-up, design-ready version:
  clearer feature list, explicit constraints, and non-functional requirements.
- Optional “optimize for codegen” vs “optimize for architecture review” modes.
- UI hook in Architecture mode to review and tweak the optimized intent before diagram/spec generation.

## 5. AI integrated within the compiler (P2 - v2.0)

Current state:

- Intent parsing is handled by the Rust CLI (`grump-intent`), which the backend calls and then enriches with the LLM.

Directions to explore:

- Hybrid parsing: keep Rust for structural extraction but allow the LLM (or another model) to resolve ambiguity,
  infer missing business rules, and propose alternative formulations.
- Optional “LLM-first” parsing for very unstructured prompts, with Rust validating and normalizing the result.
- Long term: a small local model for fast, offline-ish intent compilation, with cloud models used for deeper reasoning.

## 6. “Wow” factor in the product

Ideas to make the experience feel more impressive, especially for demos and first impressions:

- Polished UI details: motion that respects “Reduced Motion”, subtle transitions, keyboard shortcuts, rich empty states.
- One-click “demo mode” that spins up a sample project and walks through Architecture → Spec → Plan → Code.
- Shareable artifacts: exportable links or bundles for diagrams, PRDs, plans, and agent work reports.
- One-click deploy for generated apps (e.g. opinionated Vercel presets for common stacks).
- A short, scripted end-to-end demo (recorded or live) that shows SHIP, agent reports, WRunner, and scheduled agents.

## 7. Webhooks for speed (P1 - v1.2)

Current capabilities:

- SSE event stream: `GET /api/events/stream` emits `ship.completed`, `codegen.ready`, `ship.failed`, `codegen.failed`
  with `{ event, payload, timestamp }` (see `backend/src/routes/events.ts` and `backend/src/services/webhookService.ts`).
- Inbound trigger: `POST /api/webhooks/trigger` can start SHIP or chat jobs and returns `202` with a `jobId`.
- Outbound registration: `POST /api/webhooks/outbound` and the `GRUMP_WEBHOOK_URLS` environment variable configure
  one or more webhook targets for events.

Design principles for “fast” workflows:

- Keep heavy work asynchronous: endpoints that start SHIP/codegen should return quickly (often `202`) while progress
  and results are delivered via SSE or webhooks.
- Use multiple outbound URLs for fan-out (CI, Slack, bots) without extra polling.

Future enhancements:

- Additional outbound events: `architecture.generated` and `prd.generated` are now emitted (payload: architectureId, projectName, hasDiagram/hasPrd) so external systems can chain pipelines on milestones. SSE `GET /api/events/stream` and `GRUMP_WEBHOOK_URLS` receive these events.
- Optional webhook signing and retry policies for production-grade consumers.
- Higher-level docs and examples for building webhook-driven flows (e.g. “when SHIP completes, auto-deploy and post to Slack”).

## 8. Agent evals (P0 - v1.1)

We are adding offline evaluation suites for the main agents so changes can be measured over time:

- Golden-task definitions in `backend/tests/evals/*Tasks.ts` for:
  - Architecture (`/api/architecture`)
  - PRD/spec (`/api/prd`)
  - SHIP (`/api/ship/start`)
  - Codegen (`/api/codegen/start`)
- An eval harness in `backend/tests/evals/runEvals.ts` that:
  - Calls the running backend at `EVAL_BASE_URL` (default `http://localhost:3000`).
  - Uses an LLM-as-judge (via OpenRouter or configured provider) via `backend/tests/evals/judge.ts`.
  - Writes aggregated results to `frontend/test-results/agent-evals.json`.
- A new script in `backend/package.json`:
  - `npm run evals` – run all eval suites against a local or remote backend.

Next steps:

- Wire `npm run evals` into CI as a separate workflow that runs on PRs and publishes score summaries.
- Expand safety/jailbreak prompts and scheduled-agent scenarios once the core eval path is stable.
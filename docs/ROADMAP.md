# G-Rump Roadmap

> **Version:** 2.1.0 | **Last Updated:** February 2026

## Current Focus: NVIDIA Golden Developer Award

G-Rump is pivoting to full NVIDIA Golden Developer Award compliance. All six checklist requirements are now addressed:

| Requirement | Implementation | Location |
|-------------|----------------|----------|
| **Cloud** | NGC-ready deployment on GCP/AWS | [deploy/ngc/](../deploy/ngc/) |
| **Data** | NeMo Curator synthetic data pipeline | [services/nemo-curator/](../services/nemo-curator/) |
| **Framework** | NVIDIA NIM for LLMs and RAG | Built-in |
| **Training** | NeMo Framework fine-tuning example | [services/nemo-training/](../services/nemo-training/) |
| **Inference** | NVIDIA NIM (Nemotron) | Built-in |
| **Observability** | NIM-aligned metrics, OTEL | [NVIDIA_OBSERVABILITY.md](NVIDIA_OBSERVABILITY.md) |

## Version Milestones

| Version | Target | Focus | Status |
|---------|--------|-------|--------|
| **v1.0** | Q1 2026 | Core SHIP workflow, Electron app, basic codegen | Shipped |
| **v2.0** | Q1 2026 | G-Agent orchestration, Express 5, enhanced caching | Shipped |
| **v2.1** | Q1 2026 | RAG, agent evals, VS Code extension | Shipped |
| **v2.1+** | Q1 2026 | NVIDIA Golden Developer pivot (NGC, NeMo, observability) | **Current** |
| **v2.2** | Q2 2026 | More IDE integrations, Intent Optimizer, codebase scanner | Planned |
| **v3.0** | Q3 2026 | Enhanced G-Agent, "Wow" features, offline support | Planned |

## Priority Legend

- **P0** - Critical for next release
- **P1** - High priority, planned for upcoming versions
- **P2** - Medium priority, on roadmap
- **P3** - Nice to have, backlog

---

## Completed (v2.1)

### RAG Integration (Shipped)
- RAG screen (Ask docs): types filter, hybrid search, workspace namespace, document upload/reindex
- Chat RAG context toggle: optional RAG context injection in main chat
- RAG onboarding slide and discoverability improvements
- Pinecone vector database integration

### Intent-RAG Fusion (Shipped)
- Intent-guided retrieval: parse intent from query, expand query with features/tech/data flows, then retrieve and rerank for architecture, spec, plan, chat, and ship
- RAG-augmented intent enrichment: inject knowledge-base excerpts into the intent enrichment prompt for consistency with existing docs/specs
- Optional `intentGuided: true` on `POST /api/rag/query`; env toggles `RAG_INTENT_GUIDED` and `INTENT_RAG_AUGMENT_ENRICH`

### G-Agent Evals (Shipped)
- Golden-task definitions in `backend/tests/evals/*Tasks.ts`
- LLM-as-judge via `backend/tests/evals/judge.ts`
- CI integration on PRs and main
- Results output to `frontend/test-results/g-agent-evals.json`

### VS Code Extension (Shipped)
- Chat interface in VS Code
- SHIP workflow integration
- Code intelligence features

---

## Completed (NVIDIA Golden Developer Pivot)

### NGC-Ready Cloud Deployment (Shipped)
- GCP and AWS provision scripts for NGC-certified VMs
- CPU-only and GPU (T4) options
- Docker Compose deploy scripts; documented in [deploy/ngc/](../deploy/ngc/)

### NeMo Curator Synthetic Data (Shipped)
- Python pipeline using Nemotron over NIM for Q&A generation
- Output JSONL for RAG indexing; `npm run data:synth`
- See [services/nemo-curator/](../services/nemo-curator/)

### NeMo Framework Fine-Tuning (Shipped)
- Example SFT/LoRA script for NGC GPU
- README with NGC run instructions
- See [services/nemo-training/](../services/nemo-training/)

### NVIDIA Observability (Shipped)
- NIM-aligned metrics: TTFB, tokens/sec, model labels
- OpenTelemetry with `nvidia.nim.*` span attributes
- [NVIDIA_OBSERVABILITY.md](NVIDIA_OBSERVABILITY.md)

---

## In Progress (v2.2)

### 0. TODOs triage (recommended before award)

Triage the ~41 TODO/FIXME matches across the repo (e.g. `RefactoredChatInterface.svelte`, backend services, CLI commands) into: **fix before award**, **fix in v2.2**, and **defer**. Fix or document high-impact ones (e.g. RefactoredChatInterface, agents routes) before the award deadline. See `npm run check-all` and test runs for regressions.

### 1. Intent Optimizer (P0)

Today, G-Rump uses the Rust Intent Compiler (`grump-intent`) plus LLM enrichment in `backend/src/services/intentCompilerService.ts` to extract actors, features, data flows, and tech stack hints.

Planned "Intent Optimizer" capabilities:
- A dedicated endpoint that takes raw or parsed intent and returns a cleaned-up, design-ready version: clearer feature list, explicit constraints, and non-functional requirements.
- Optional "optimize for codegen" vs "optimize for architecture review" modes.
- UI hook in Architecture mode to review and tweak the optimized intent before diagram/spec generation.

### 2. More IDE Integrations (P1)

Current integrations:
- VS Code extension: `packages/vscode-extension`
- Cursor and Claude Code via the REST API and MCP server

Planned:
- JetBrains plugins (IntelliJ/WebStorm) that reuse the same webview UI and backend.
- A generic LSP-style or CLI-based interface so any editor can trigger SHIP, architecture, and codegen.
- Deeper Cursor integration (beyond REST/MCP) with ready-made rules/skills.

### 3. Scan Entire Codebase → Mermaid Chart (P1)

Backend support exists today:
- `POST /api/analyze/architecture` accepts a `workspacePath` and returns a Mermaid diagram plus summary.

Frontend support:
- `analyzeArchitecture(workspacePath)` in `frontend/src/stores/featuresStore.ts`.
- Settings screen entry point ("Codebase Architecture (Mermaid)").

Future enhancements:
- Diagram type switch (C4 context, C4 container, component, flow).
- Optional focus filters (per package, feature, or service).
- Tight integration with the main Architecture mode viewer.

---

## Planned (v3.0)

### 4. AI Integrated Within the Compiler (P2)

Current state:
- Intent parsing is handled by the Rust CLI (`grump-intent`), which the backend calls and then enriches with the LLM.

Directions to explore:
- Hybrid parsing: keep Rust for structural extraction but allow the LLM (or another model) to resolve ambiguity, infer missing business rules, and propose alternative formulations.
- Optional "LLM-first" parsing for very unstructured prompts, with Rust validating and normalizing the result.
- Long term: a small local model for fast, offline-ish intent compilation, with cloud models used for deeper reasoning.

### 5. "Wow" Factor Features (P2)

Ideas to make the experience feel more impressive:
- Polished UI details: motion that respects "Reduced Motion", subtle transitions, keyboard shortcuts, rich empty states.
- One-click "demo mode" that spins up a sample project and walks through Architecture → Spec → Plan → Code.
- Shareable artifacts: exportable links or bundles for diagrams, PRDs, plans, and G-Agent work reports.
- A short, scripted end-to-end demo (recorded or live) that shows SHIP, G-Agent reports, quality analysis, and scheduled tasks.

### 6. Enhanced Webhooks (P1)

Current capabilities:
- SSE event stream: `GET /api/events/stream` emits `ship.completed`, `codegen.ready`, `ship.failed`, `codegen.failed`
- Inbound trigger: `POST /api/webhooks/trigger` can start SHIP or chat jobs
- Outbound registration: `POST /api/webhooks/outbound` and `GRUMP_WEBHOOK_URLS` environment variable

Future enhancements:
- Additional outbound events: `architecture.generated` and `prd.generated`
- Optional webhook signing and retry policies for production-grade consumers.
- Higher-level docs and examples for building webhook-driven flows.

### 7. Offline Mode (P2)

- Full offline support with local LLMs (Ollama)
- Local-first architecture with sync when online
- Desktop app works completely standalone

---

## Desktop Features (Windows) - Shipped

The Electron desktop app (Windows) includes:
- **OS notifications**: Ship/codegen complete and error toasts (click to focus app)
- **System tray**: Icon with Show, New chat, Settings, Open workspace folder, Quit
- **Global shortcut**: `Ctrl+Shift+G` to show G-Rump from anywhere
- **Open in Explorer**: Tray "Open workspace folder" and `grump.openPath(path)`
- **Always-on-top**: Toggle in the title bar (pin icon); preference persisted
- **Protocol**: `grump://` URLs for deep linking

---

## G-Agent System Enhancements

### Quality Assurance (Shipped)
- G-Agent Quality Analysis: Analyzes work reports, identifies issues
- Auto-Fix Engine: Automatically applies fixes for auto-fixable issues
- Work Reports: G-Agent generates detailed work reports

### Planned Enhancements
- Expand safety/jailbreak prompts in eval suite
- Scheduled G-Agent scenarios
- G-Agent performance benchmarking dashboard
- Custom capability creation UI

---

## Infrastructure

### Completed
- Docker support with GPU acceleration
- **NGC-ready cloud deployment** (GCP, AWS) for NVIDIA Golden Developer compliance
- Kubernetes manifests for production-scale deployments
- Prometheus + Grafana observability stack (NIM-aligned metrics)
- HAProxy configuration for load balancing
- ROCm Docker compose for AMD GPU support
- k6 load testing integration in CI

### Planned
- Terraform modules for major cloud providers
- Multi-region deployment support
- Auto-scaling based on queue depth

---

## Documentation

### Completed
- Streamlined documentation structure
- Comprehensive API reference
- Production checklist
- Security baseline
- G-Agent system documentation

### Planned
- Interactive API explorer
- Video tutorials
- Example project gallery

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to contribute to the roadmap.

For feature requests and discussions:
1. Open a GitHub issue with the `enhancement` label
2. Include use case and proposed implementation
3. Link to relevant roadmap items

---

**Last roadmap review:** January 2026

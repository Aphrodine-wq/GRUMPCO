# How It Works

> **Version:** 2.1.0 | **Last Updated:** February 11, 2026

This document explains the end-to-end flow in G-Rump v2.1.

## Request Pipeline

1. User submits a request from **Desktop**, **CLI**, **API**, or **VS Code extension**.
2. Backend validates auth, rate limits, and safety checks.
3. **Intent parsing** classifies the request (`chat`, `architecture`, `ship`, or `codegen`).
4. **Model router** selects provider based on cost, latency, and availability.
5. **Orchestrator** executes tools/skills when needed (filesystem, git, codebase, etc.).
6. Response is **streamed** back to the client with usage tracking and telemetry.

## Architecture-First Flow

```
Describe → Architecture (Mermaid/C4/ERD) → PRD/Spec → (optional) Code
```

1. Describe product intent in natural language.
2. Generate architecture diagrams (Mermaid C4, ERD, sequence, flowchart).
3. Generate PRD/spec from architecture.
4. Optionally generate full-stack code from the approved spec.

## SHIP Flow

```
Design → Spec → Plan → Code
```

1. **Design** — Generate architecture diagrams from description.
2. **Spec** — Create comprehensive technical specification (PRD).
3. **Plan** — Break down into executable tasks with dependencies.
4. **Code** — Multi-agent code generation (frontend, backend, DevOps, tests, docs).

## Code Mode

Interactive AI-powered development chat with workspace-aware tools:

- **File operations**: read, write, edit
- **Command execution**: sandboxed bash
- **Version control**: git operations
- **Directory exploration**: list and search files

## AI Provider Routing

The **G-CompN1 Model Mix** routes requests across providers:

| Provider | Strengths | Use Case |
|----------|-----------|----------|
| **NVIDIA NIM** | Fast inference, Nemotron | Primary, RAG embeddings |
| **Anthropic Claude** | High-quality reasoning | Complex architecture, code review |
| **OpenRouter** | Multi-model access | Fallback, variety |
| **Ollama** | Local, private | Offline development |

## Reliability and Safety

- **Validation**: Request schema and payload checks (Zod).
- **Security**: Guardrails, command allowlists, output filtering, path policy.
- **Cost controls**: Model routing and token/cost accounting.
- **Caching**: 3-tier (LRU → Redis → Disk) for fast repeated queries.
- **Observability**: Health metrics, OpenTelemetry traces, and Pino structured logs.

## Related Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture
- [AGENT_SYSTEM.md](./AGENT_SYSTEM.md) — G-Agent orchestration
- [INTENT_COMPILER.md](./INTENT_COMPILER.md) — Rust intent parser
- [API.md](./API.md) — Complete API reference
- [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md) — Performance tuning

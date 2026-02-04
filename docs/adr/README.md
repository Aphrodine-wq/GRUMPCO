# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) that document significant architectural decisions made in the G-Rump project.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences. ADRs help teams:
- Understand why decisions were made
- Onboard new team members faster
- Avoid revisiting decisions unnecessarily
- Learn from past decisions

## Format

Each ADR follows this structure:
- **Title**: Decision name and date
- **Status**: Proposed, Accepted, Deprecated, Superseded
- **Context**: Problem we're solving
- **Decision**: What we decided
- **Consequences**: Trade-offs and implications
- **References**: Related docs, issues, PRs

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](./0001-use-swc-for-compilation.md) | Use SWC for TypeScript Compilation | Accepted | 2024-01 |
| [0002](./0002-rust-intent-compiler.md) | Rust-Based Intent Compiler | Accepted | 2024-02 |
| [0003](./0003-multi-tier-caching.md) | Multi-Tier Caching Strategy | Accepted | 2024-02 |
| [0004](./0004-svelte-5-frontend.md) | Svelte 5 for Frontend Framework | Accepted | 2024-03 |
| [0005](./0005-npm-workspaces.md) | NPM Workspaces for Monorepo | Accepted | 2024-01 |
| [0006](./0006-multi-agent-architecture.md) | Multi-Agent Orchestration System | Accepted | 2024-03 |
| [0007](./0007-secure-api-key-storage.md) | OS Keychain for API Key Storage | Accepted | 2026-01 |
| [0008](./0008-sqlite-supabase-hybrid.md) | SQLite + Supabase Hybrid Database | Accepted | 2024-03 |
| [0009](./0009-sse-streaming.md) | Server-Sent Events for AI Streaming | Accepted | 2024-02 |
| [0010](./0010-vitest-playwright-testing.md) | Vitest + Playwright Testing Strategy | Accepted | 2024-03 |
| [005](./005-intent-rag-fusion.md) | Intent-RAG Fusion Workflow | Accepted | 2026-02 |

---

*Last Updated: February 2026*
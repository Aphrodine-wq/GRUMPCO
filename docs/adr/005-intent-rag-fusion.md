# ADR-005: Intent-RAG Fusion Workflow

## Status

**Accepted**

**Date:** 2026-02  
**Author:** G-Rump Core Team

## Context

The Intent Compiler (Rust-based NL to structured JSON) and the RAG system (embed, vector store, optional hybrid/rerank, LLM generate) were independent. Architecture, spec, plan, and chat used intent and RAG separately: they obtained enriched intent and optionally called `getRagContextForPrompt(projectDescription, { namespace, maxChunks })` with no use of intent to guide retrieval, and no use of RAG to improve intent enrichment. This left relevance and consistency on the table.

## Decision

Introduce an **Intent-RAG Fusion (IRF)** workflow:

1. **Intent-guided retrieval**: Before RAG retrieval, run fast intent extraction (Rust or cached) on the user query or project description. Build an expanded query from features, tech stack hints, and data flows. Embed the expanded query (or use it in a multi-query RRF path) and run the existing vector + optional rerank pipeline. Expose this via `getIntentGuidedRagContext(query, options)` with fallback to `getRagContextForPrompt` when intent parsing is disabled, times out, or returns empty intent.
2. **RAG-augmented intent enrichment**: When the backend enriches intent via LLM, call `getRagContextForPrompt(rawText, { maxChunks: 4 })` and inject the retrieved context into the enrichment system prompt so the model can align with existing docs/specs.
3. **Unified pipeline**: Use intent-guided RAG in architecture, spec, plan, chat (when RAG is on), and ship. Allow the RAG API to opt in via `intentGuided: true` in the request body.
4. **Configuration**: Add env flags `RAG_INTENT_GUIDED` (default enabled) and `INTENT_RAG_AUGMENT_ENRICH` (default enabled) so rollout and testing are controllable.

## Consequences

### Positive

- **Better relevance**: Intent-guided retrieval improves recall/precision for feature + tech queries (e.g. "auth with React") vs. raw query embedding alone.
- **Better consistency**: RAG-augmented enrichment yields intents that align better with existing docs/specs (fewer contradictory tech/features).
- **Single story**: One IRF path used across architecture, spec, plan, chat, and RAG API so behavior and caching are consistent and docs describe one workflow.

### Negative

- **Extra latency**: Intent parse adds ~3s timeout and typically a few hundred ms when Rust succeeds; fallback to plain RAG limits impact.
- **Dependency**: RAG context quality for enrichment depends on index content; empty or stale index reduces benefit.

### Neutral

- **Optional toggles**: Operators can disable intent-guided retrieval or RAG-augmented enrichment via env for debugging or A/B testing.

## References

- [INTENT_RAG_FUSION.md](../INTENT_RAG_FUSION.md) — User-facing IRF documentation.
- [ADR-001: Rust Intent Compiler](./001-rust-intent-compiler.md) — Intent compiler baseline.

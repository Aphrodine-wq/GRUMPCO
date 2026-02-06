# ADR-001: Multi-Provider AI Architecture

**Status:** Accepted
**Date:** 2026-02-05
**Deciders:** G-Rump Core Team
**Tags:** ai, architecture, providers

## Context

G-Rump requires reliable AI infer costs, single points of failure, and varying capabilities across different AI models. We needed a strategy to:

1. Avoid vendor lock-in
2. Optimize costs by routing requests intelligently  
3. Provide failover mechanisms
4. Access specialized capabilities (long context, code generation, vision)
5. Support both cloud and local deployments

## Decision

Implement a multi-provider architecture with **7 AI providers** and an intelligent routing system:

- **NVIDIA NIM**: Primary provider (balanced speed/quality/cost)
- **Anthropic**: Best quality (Claude 3.5 Sonnet)
- **OpenRouter**: Multi-model gateway
- **GitHub Copilot**: Code generation specialist
- **Kimi K2.5**: Long context (128k tokens)
- **Mistral AI**: European compliance, multilingual
- **Ollama**: Local/offline deployment

**Routing Strategy:**
- Classify requests by type (simple, complex, coding, vision, creative, long-context)
- Route based on provider rankings: speed, quality, cost, coding capability
- Automatic failover with circuit breakers
- 3-tier caching to reduce API calls

## Consequences

### Positive
- **Reliability**: Automatic failover prevents single point of failure
- **Cost Optimization**: 60-70% cost savings through intelligent routing
- **Flexibility**: Choose best provider for each task
- **Offline Support**: Ollama enables local deployment
- **Specialization**: Access to specialized models (code, vision, long-context)
- **Vendor Independence**: Not locked into single provider

### Negative
- **Complexity**: More code to maintain across 7 provider integrations
- **Testing Overhead**: Need to test with multiple providers
- **API Key Management**: Requires managing 6+ API keys
- **Monitoring Complexity**: Track costs/usage across multiple providers
- **Debugging Difficulty**: Issues may be provider-specific

### Neutral
- **Configuration**: Requires environment variables for each provider
- **Documentation**: Need comprehensive docs for each provider setup

## Alternatives Considered

### Alternative 1: Single Provider (OpenAI only)
- **Pros**: Simpler, well-documented, reliable
- **Cons**: Expensive, vendor lock-in, single point of failure, limited specialization
- **Rejected**: Too risky for production, high costs

### Alternative 2: Dual Provider (OpenAI + Anthropic)
- **Pros**: Simpler than 7 providers, good quality
- **Cons**: Still expensive, limited specialization, no local option
- **Rejected**: Didn't address cost optimization goals

### Alternative 3: Open Source Only (Ollama + vLLM)
- **Pros**: Zero API costs, full control
- **Cons**: Lower quality, requires GPU infrastructure, maintenance burden
- **Rejected**: Quality/reliability trade-offs too significant

## Implementation Details

**Provider Registry** (`backend/src/services/llmGateway.ts`):
```typescript
const PROVIDERS = {
  nim: { baseUrl: '...', models: [...], capabilities: [...] },
  anthropic: { baseUrl: '...', models: [...], capabilities: [...] },
  // ... 5 more providers
}
```

**Intelligent Router** (`backend/src/services/modelRouter.ts`):
- Request classification
- Provider ranking by capability
- Cost-aware routing
- Failover logic

**Cost Tracking** (`backend/src/config/metrics.ts`):
- Track tokens per provider/model
- Calculate costs in real-time
- Expose Prometheus metrics

## References

- [Provider Comparison (IMPROVEMENTS.md)](../../IMPROVEMENTS.md#2-provider-architecture-overhaul)
- [LLM Gateway Implementation](../../backend/src/services/llmGateway.ts)
- [Model Router](../../backend/src/services/modelRouter.ts)
- [Cost Metrics](../../backend/src/config/metrics.ts)
- [Grafana Cost Dashboard](../../deploy/observability/grafana/dashboards/ai-costs.json)

---

**Review Notes:**
- Approved 2026-02-05 after removing Groq/Grok/direct OpenAI
- Added Mistral AI for European compliance
- Added GitHub Copilot for code specialization

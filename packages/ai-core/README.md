# @grump/ai-core

Model router and model registry for G-Rump. Used by the backend to select provider and model by request context (message length, mode, tools, multimodal, cost optimization).

**Version:** 2.1.0

**NVIDIA Golden Developer** — Primary provider is NVIDIA NIM (Nemotron). See [docs/NVIDIA_GOLDEN_DEVELOPER.md](../../docs/NVIDIA_GOLDEN_DEVELOPER.md).

## Supported Providers

- **NVIDIA NIM** – Nemotron, Kimi K2.5, Llama models (primary for NVIDIA Golden Developer)
- **OpenRouter** – Claude, GPT, Gemini, and more
- **Groq** – Fast inference (Llama, Mixtral)
- **Together AI** – Open source models
- **Zhipu** – Chinese models
- **Ollama** – Local models

## Exports

- **`route(context: RouterContext): RouterResult`** – Select provider and model from context (messageChars, messageCount, mode, toolsRequested, multimodal, costOptimization, etc.).
- **`RouterContext`** – Input type for routing.
- **`RouterResult`** – `{ provider, modelId, estimatedCost?, reasoning? }`.
- **`MODEL_REGISTRY`** – Array of model configs (id, provider, capabilities, contextWindow, costPerMillionInput/Output).
- **`getModelById(id)`**, **`getModelsByCapability(cap)`**, **`getModelsByProvider(provider)`** – Lookup helpers.

## Usage from backend

```ts
import { route } from '../services/modelRouter.js'; // re-export from @grump/ai-core

const result = route({
  messageChars: 1000,
  messageCount: 5,
  mode: 'plan',
  toolsRequested: false,
  multimodal: false,
  costOptimization: true,
});
// result.provider === 'nim' | 'zhipu' | 'copilot' | 'openrouter' | 'groq' | 'together'
// result.modelId === 'moonshotai/kimi-k2.5' | 'claude-sonnet-4-20250514' | ...
```

## Build

```bash
cd packages/ai-core && npm install && npm run build
```

The backend depends on this package via workspace; build from repo root (`npm run build:packages`) or from `packages/ai-core`. For production env and security, see [docs/PRODUCTION.md](../../docs/PRODUCTION.md).

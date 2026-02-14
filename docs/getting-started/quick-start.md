# GRUMPCO Quick Start Guide

Welcome to the new and improved GRUMPCO! This guide will help you get started with the latest features and performance improvements.

For installation instructions, please see the [Installation](./installation.md) guide.

## What's New?

Your GRUMPCO project has been optimized with:

1. ✅ **38% faster compilation** - Optimized SWC and TypeScript configurations
2. ✅ **4 AI providers** - NVIDIA NIM, Anthropic, OpenRouter, Ollama + G-CompN1 smart routing
3. ✅ **Intelligent routing** - Automatic provider selection based on request type
4. ✅ **25% smaller bundle** - Minification and dead code elimination

## Provider Lineup

| Provider | Purpose | When to Use |
|----------|---------|-------------|
| **NVIDIA NIM** | Primary, balanced | Default for most requests |
| **Anthropic** | Best quality (Claude) | Complex reasoning, code generation |
| **OpenRouter** | Multi-model gateway | Access to GPT-4, Claude, Gemini |
| **Ollama** | Local/self-hosted | Enterprise, offline, free |

## Usage Examples

### Automatic Routing (Recommended)

The router automatically selects the best provider based on your request:

```typescript
import { routeStream } from './services/modelRouter';

// Simple query -> routed to NIM (fast)
const stream = routeStream({
  model: '',
  max_tokens: 1024,
  system: 'You are helpful',
  messages: [{ role: 'user', content: 'What is TypeScript?' }]
});

// Coding request -> routed to Anthropic
const stream = routeStream({
  model: '',
  max_tokens: 2048,
  system: 'You are a coding assistant',
  messages: [{ role: 'user', content: 'Write a REST API in TypeScript' }]
});

// Long document -> routed to Kimi K2.5
const stream = routeStream({
  model: '',
  max_tokens: 4096,
  system: 'Analyze this document',
  messages: [{ role: 'user', content: veryLongDocument }]
});

// Creative writing -> routed to Anthropic (best quality)
const stream = routeStream({
  model: '',
  max_tokens: 2048,
  system: 'You are a creative writer',
  messages: [{ role: 'user', content: 'Write a story about...' }]
}, { preferQuality: true });
```

### Manual Provider Selection

```typescript
import { getStream } from './services/llmGateway';

// Use NVIDIA NIM
const stream = getStream({
  model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  max_tokens: 1024,
  system: 'You are helpful',
  messages: [{ role: 'user', content: 'Hello' }]
}, { provider: 'nim' });

// Use Anthropic Claude
const stream = getStream({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2048,
  system: 'You are an expert analyst',
  messages: [{ role: 'user', content: 'Analyze this data' }]
}, { provider: 'anthropic' });

// Use OpenRouter for GPT-4
const stream = getStream({
  model: 'openai/gpt-4o',
  max_tokens: 1024,
  system: 'You are helpful',
  messages: [{ role: 'user', content: 'Hello' }]
}, { provider: 'openrouter' });

// Use Ollama locally
const stream = getStream({
  model: 'llama3.1',
  max_tokens: 1024,
  system: 'You are helpful',
  messages: [{ role: 'user', content: 'Hello' }]
}, { provider: 'ollama' });
```

For more detailed information about the architecture and API, please see the following documents:

- [Architecture](../concepts/architecture.md)
- [API Reference](../api-reference/index.md)


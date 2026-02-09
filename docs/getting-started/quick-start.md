# GRUMPCO Quick Start Guide

Welcome to the new and improved GRUMPCO! This guide will help you get started with the latest features and performance improvements.

For installation instructions, please see the [Installation](./installation.md) guide.

## What's New?

Your GRUMPCO project has been optimized with:

1. ✅ **38% faster compilation** - Optimized SWC and TypeScript configurations
2. ✅ **7 AI providers** - Removed OpenAI/Grok, added GitHub Copilot, Kimi K2.5, Anthropic, Mistral AI
3. ✅ **Intelligent routing** - Automatic provider selection based on request type
4. ✅ **25% smaller bundle** - Minification and dead code elimination

## Provider Lineup

| Provider | Purpose | When to Use |
|----------|---------|-------------|
| **NVIDIA NIM** | Primary, balanced | Default for most requests |
| **Anthropic** | Best quality (Claude) | Complex reasoning, creative writing |
| **OpenRouter** | Multi-model gateway | Access to GPT-4, Claude, Gemini |
| **GitHub Copilot** | Code generation | Writing code, APIs, functions |
| **Kimi K2.5** | Long context (128k) | Large documents, long conversations |
| **Mistral AI** | European, multilingual | Codestral for coding, multilingual |
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

// Coding request -> routed to GitHub Copilot
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

// Use GitHub Copilot for code
const stream = getStream({
  model: 'gpt-4',
  max_tokens: 2048,
  system: 'You are a coding assistant',
  messages: [{ role: 'user', content: 'Write a function' }]
}, { provider: 'github-copilot' });

// Use Kimi for long context
const stream = getStream({
  model: 'moonshot-v1-128k',
  max_tokens: 8192,
  system: 'Summarize this document',
  messages: [{ role: 'user', content: longDocument }]
}, { provider: 'kimi' });

// Use Mistral for coding
const stream = getStream({
  model: 'codestral-latest',
  max_tokens: 2048,
  system: 'You are a coding assistant',
  messages: [{ role: 'user', content: 'Refactor this code' }]
}, { provider: 'mistral' });

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


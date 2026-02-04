# @grump/kimi

Kimi K2.5 optimization and integration package for G-Rump. Provides utilities for leveraging NVIDIA NIM's Kimi K2.5 model with its 256K context window and cost advantages.

## Installation

```bash
pnpm add @grump/kimi
```

## Overview

Kimi K2.5 (via NVIDIA NIM) offers:
- **256K context window** (vs Claude's 200K = 56K extra tokens)
- **5x cheaper pricing** ($0.6/M vs $3/M input)
- **Superior multilingual support** (especially Chinese/Japanese/Korean)
- **Strong coding capabilities**
- **Vision/multimodal support**
- **OpenAI-compatible API**

## Features

### Model Configuration

```typescript
import { KIMI_K25_CONFIG } from '@grump/kimi';

console.log(KIMI_K25_CONFIG.modelId);        // 'moonshotai/kimi-k2.5'
console.log(KIMI_K25_CONFIG.contextWindow);  // 256,000
console.log(KIMI_K25_CONFIG.contextAdvantage); // 56,000 extra tokens
```

### Task-Optimized Configuration

```typescript
import { getTaskConfig, type TaskType } from '@grump/kimi';

const config = getTaskConfig('coding');
// { temperature: 0.1, maxTokens: 8192, topP: 0.95, ... }

const chatConfig = getTaskConfig('chat');
// { temperature: 0.7, maxTokens: 4096, ... }
```

### Language Detection

Kimi excels at multilingual content:

```typescript
import { containsNonEnglish, detectLanguage } from '@grump/kimi';

if (containsNonEnglish(userMessage)) {
  // Route to Kimi for better multilingual handling
}

const langs = detectLanguage(text);
// { hasChinese: true, hasJapanese: false, isMultilingual: true, ... }
```

### Routing Decisions

Automatically decide whether to use Kimi or Claude:

```typescript
import { shouldRouteToKimi, getEnhancedRoutingDecision } from '@grump/kimi';

// Simple routing
const decision = shouldRouteToKimi({
  content: userMessage,
  requiresTools: false,
  isComplex: false,
  hasImage: false,
  isCodeGeneration: true
});

if (decision.useKimi) {
  console.log('Using Kimi:', decision.reasons.join(', '));
  console.log('Estimated savings:', decision.estimatedSavings?.summary);
}

// Enhanced routing with detailed analysis
const enhanced = getEnhancedRoutingDecision({
  messageChars: content.length,
  messageCount: messages.length,
  toolsRequested: false,
  multimodal: false,
  isComplex: false,
  hasCode: true,
  contextSize: estimateTokens(content.length)
});

console.log(enhanced.recommendedModel);  // 'kimi' | 'claude' | 'either'
console.log(enhanced.confidence);        // 0.0 - 1.0
console.log(enhanced.rationale);         // ['Code generation - Kimi is 5x cheaper']
```

### Cost Estimation

```typescript
import { estimateSavings, estimateTokens, formatCost } from '@grump/kimi';

const tokens = estimateTokens(content.length);
const savings = estimateSavings(inputTokens, outputTokens, requestCount);

console.log(savings.summary);
// "Kimi: $0.0012 vs Claude: $0.0060 (80.0% savings)"

console.log(formatCost(savings.savings)); // "$0.0048"
```

### Context Management

Leverage Kimi's extra context capacity:

```typescript
import { calculateContextRetention } from '@grump/kimi';

const retention = calculateContextRetention(220000);
// {
//   retainTokens: 220000,
//   advantageUsed: 20000,
//   recommendation: "Using 20,000 of 56,000 extra tokens",
//   usingExtendedContext: true
// }
```

### Prompt Optimization

```typescript
import { optimizePromptForKimi } from '@grump/kimi';

const { optimizedSystem, optimizedUser, optimizations } = optimizePromptForKimi(
  systemPrompt,
  userContent
);

console.log(optimizations);
// ['Added multilingual support instruction', 'Added output format guidance']
```

### Swarm Agents

For multi-agent orchestration:

```typescript
import { getSwarmAgents, SWARM_AGENT_IDS, type SwarmAgentId } from '@grump/kimi';

const agents = getSwarmAgents();
// [{ id: 'arch', name: 'Architect', capabilities: [...] }, ...]

const agentId: SwarmAgentId = 'frontend';
```

## Design-to-Code Types

```typescript
import type { DesignToCodeInput, DesignToCodeResult } from '@grump/kimi';

const input: DesignToCodeInput = {
  image: base64Image,
  description: 'Convert this wireframe to a Svelte component',
  targetFramework: 'svelte'
};
```

## API Summary

| Function | Description |
|----------|-------------|
| `getTaskConfig(type)` | Get optimal config for task type |
| `containsNonEnglish(text)` | Check for non-English content |
| `detectLanguage(text)` | Detect specific languages |
| `shouldRouteToKimi(input)` | Simple routing decision |
| `getEnhancedRoutingDecision(input)` | Detailed routing analysis |
| `estimateSavings(in, out, count)` | Compare costs vs Claude |
| `calculateContextRetention(tokens)` | Manage extended context |
| `optimizePromptForKimi(sys, user)` | Optimize prompts for Kimi |
| `getSwarmAgents()` | Get swarm agent definitions |
| `formatTokens(n)` | Format token count (e.g., "256K") |
| `formatCost(n)` | Format cost (e.g., "$0.0012") |

## License

MIT

# Hybrid Intent Compiler

AI-integrated compiler combining Rust's speed with LLM intelligence for intent parsing.

## Features

- **Hybrid Parsing**: Uses Rust for structural extraction, LLM for ambiguity resolution
- **Multiple Modes**:
  - `rust-first`: Fast Rust parsing with LLM fallback for low confidence results
  - `llm-first`: LLM for unstructured prompts with Rust validation
  - `hybrid`: Parallel processing using both methods simultaneously
- **Confidence Scoring**: Automatically determines when to use LLM vs Rust
- **Ambiguity Detection**: Analyzes input complexity to route appropriately
- **Caching Layer**: Redis-based caching for parsed intents
- **Fallback Mechanisms**: Automatic fallback if one method fails
- **Batch Processing**: Parse multiple intents efficiently
- **Provider Support**: Works with NIM, Groq, Ollama, and more

## Quick Start

```typescript
import { parseIntentHybrid, parseIntentHybridWithCache } from './services/hybridIntentCompiler';

// Parse a single intent
const result = await parseIntentHybrid(
  'Create a REST API for user authentication with JWT',
  { security: 'high' }
);

console.log(result.intent.actors);      // ['user', 'system']
console.log(result.intent.features);    // ['authentication', 'jwt']
console.log(result.confidence);         // 0.85
console.log(result.method);             // 'hybrid'
```

## Configuration

Environment variables for customization:

```bash
# Parsing mode: 'hybrid' | 'rust-first' | 'llm-first'
HYBRID_INTENT_MODE=hybrid

# Confidence threshold for LLM enhancement (0.0-1.0)
HYBRID_CONFIDENCE_THRESHOLD=0.7

# Enable parallel processing
HYBRID_PARALLEL_PROCESSING=true

# Enable caching
HYBRID_CACHING_ENABLED=true

# LLM provider selection
HYBRID_LLM_PROVIDER=nim  # nim, groq, ollama, openrouter, zhipu

# LLM model
HYBRID_LLM_MODEL=moonshotai/kimi-k2.5

# Timeouts
HYBRID_LLM_TIMEOUT=30000
HYBRID_RUST_TIMEOUT=5000

# Max tokens for LLM
HYBRID_MAX_TOKENS=4096

# Enable fallback on failure
HYBRID_FALLBACK_ENABLED=true
```

## API Reference

### `parseIntentHybrid(raw, constraints?, config?)`

Main parsing function with automatic mode selection.

**Parameters:**
- `raw` (string): Natural language input to parse
- `constraints` (object, optional): Additional constraints for parsing
- `config` (Partial<HybridCompilerConfig>, optional): Override default configuration

**Returns:** `ParseResult`
```typescript
{
  intent: EnrichedIntent;
  confidence: number;
  method: 'rust' | 'llm' | 'hybrid';
  processingTimeMs: number;
  cacheHit: boolean;
  ambiguityScore: number;
  fallbackUsed: boolean;
}
```

### `parseIntentHybridWithCache(raw, constraints?, config?)`

Same as `parseIntentHybrid` but with Redis caching.

### `parseIntentsBatch(inputs, config?)`

Parse multiple intents efficiently with batching.

```typescript
const inputs = [
  { raw: 'Create login API' },
  { raw: 'Build user dashboard' },
];

const results = await parseIntentsBatch(inputs);
```

### `detectAmbiguity(raw)`

Analyze input to determine if it needs LLM processing.

```typescript
const ambiguity = detectAmbiguity('Make it better');
// Returns: { score: 0.8, reasons: [...], needsLLM: true }
```

### `getHybridConfig()`

Get current configuration from environment variables.

## Modes Explained

### Rust-First Mode
1. Parse with Rust compiler (fast)
2. Score confidence
3. If confidence < threshold OR high ambiguity, enhance with LLM
4. Return merged results

**Best for:** Structured, technical requests with clear intent

### LLM-First Mode
1. Parse with LLM (intelligent)
2. Validate with Rust compiler
3. Return LLM result with Rust validation

**Best for:** Unstructured, ambiguous, or complex natural language

### Hybrid Mode (Parallel)
1. Parse with both Rust AND LLM simultaneously
2. Wait for both to complete
3. Merge results intelligently
4. Return combined output

**Best for:** Production use when you want maximum accuracy

## Confidence Scoring

### Rust Confidence
- Base: 0.5
- Features present: +0.1 per feature (max 0.3)
- Actors present: +0.05 per actor (max 0.2)
- Data flows present: +0.15
- Tech hints present: +0.1
- Empty arrays penalty: -0.4

### LLM Confidence
- Base: 0.6
- Reasoning present: +0.1
- Ambiguity detected: -0.3 × ambiguity score
- Features present: +0.05 per feature (max 0.2)
- Architecture hints: +0.1
- Averaged with base Rust score

## Caching

Uses Redis with configurable TTL:
- Intent cache: 1 hour (3600s)
- Key format: `cache:intent:<sha256_hash>`
- Automatic cache warming for batch operations

## Error Handling

- **Timeout Handling**: Each method respects configured timeouts
- **Circuit Breaker**: Resilience pattern via `withResilience()`
- **Graceful Degradation**: Falls back to alternative method on failure
- **Batch Resilience**: Individual failures don't fail entire batch

## Testing

```bash
# Run all hybrid compiler tests
npm test -- hybridIntentCompiler.test.ts

# Run with verbose output
npm test -- hybridIntentCompiler.test.ts --reporter=verbose

# Run specific test
npm test -- -t "should detect vague nouns"
```

## Integration Example

```typescript
import { parseIntentHybrid, detectAmbiguity } from './services/hybridIntentCompiler';

async function processUserRequest(userInput: string) {
  // Check ambiguity first
  const ambiguity = detectAmbiguity(userInput);
  
  if (ambiguity.needsLLM) {
    console.log('Complex request detected, using AI assistance...');
  }
  
  // Parse intent
  const result = await parseIntentHybrid(userInput, {
    complexity: 'high',
    priority: 'urgent'
  });
  
  if (result.confidence < 0.6) {
    // Low confidence - may need clarification
    return {
      needsClarification: true,
      questions: result.intent.enriched?.ambiguity_analysis?.clarification_questions
    };
  }
  
  return {
    actors: result.intent.actors,
    features: result.intent.features,
    techStack: result.intent.enriched?.tech_stack,
    patterns: result.intent.enriched?.code_patterns,
  };
}
```

## Performance

Typical processing times:
- Rust-only: 10-50ms
- LLM-only: 500-2000ms
- Hybrid (parallel): 600-2500ms (gets best of both)
- Cached result: <5ms

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Hybrid Intent Compiler                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Cache      │  │  Ambiguity   │  │  Confidence  │       │
│  │   Layer      │  │  Detection   │  │   Scoring    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  Rust Compiler  │◄──►│   LLM Gateway   │                 │
│  │  (Structural)   │    │  (Semantic)     │                 │
│  └─────────────────┘    └─────────────────┘                 │
│           │                       │                         │
│           └───────────┬───────────┘                         │
│                       ▼                                      │
│              ┌─────────────────┐                            │
│              │  Result Merger  │                            │
│              └─────────────────┘                            │
│                       │                                      │
│                       ▼                                      │
│              ┌─────────────────┐                            │
│              │  EnrichedIntent │                            │
│              └─────────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## License

Part of the G-Rump AI-powered development platform.

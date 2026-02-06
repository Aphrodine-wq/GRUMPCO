# G-Rump Improvement Plan

## Execution Order: Compilers First, Then Everything Else

---

## PHASE 5: Rust Intent-Compiler (HIGH PRIORITY)

### 5d. Fix Compilation Issues

**File: `intent-compiler/src/founder_data_engine.rs` line 137**
- Duplicate `FounderBurnout` variant in `OutcomeEventType` enum (lines 118 and 137)
- Fix: Rename line 137's `FounderBurnout` to `FounderMentalBurnout` to distinguish from team-level burnout

**File: `intent-compiler/src/lib.rs` lines 166-171**
- `FounderProfile` re-exported from both `moat_engine` (line 146) and `market_data_feeds` (line 168) -- namespace collision
- Fix: Remove the `market_data_feeds::FounderProfile` re-export (or alias it as `MarketFounderProfile`)

**File: `intent-compiler/src/ml_training_engine.rs`**
- Uses mock `chrono` module instead of real chrono crate
- Fix: Add `chrono = "0.4"` to Cargo.toml dependencies, remove mock module

### 5a. Integrate hyper_cache into parse_intent()

**File: `intent-compiler/src/lib.rs`**
- Add a module-level `Lazy<HyperCache<IntentOutput>>` static
- In `parse_intent()`, hash the input text+constraints to a u64 key
- Check cache before running the pipeline, store result after
- This gives instant returns for repeated queries

```rust
// Add to lib.rs after existing Lazy statics:
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

static INTENT_CACHE: Lazy<hyper_cache::HyperCache<IntentOutput>> = Lazy::new(|| {
    hyper_cache::HyperCache::new(hyper_cache::CacheConfig::default())
});

fn hash_intent(text: &str, constraints: &serde_json::Value) -> u64 {
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    constraints.to_string().hash(&mut hasher);
    hasher.finish()
}

// Modify parse_intent to check cache first:
pub fn parse_intent(text: &str, constraints: serde_json::Value) -> IntentOutput {
    let cache_key = hash_intent(text, &constraints);
    
    // Check cache
    if let Some(cached) = INTENT_CACHE.get(cache_key) {
        return cached;
    }
    
    // ... existing pipeline code ...
    
    // Store in cache before returning
    INTENT_CACHE.put(cache_key, output.clone());
    // return the final output with verification
}
```

### 5b. Integrate parallel_engine into batch parsing

**File: `intent-compiler/src/lib.rs`**
- Replace the existing `parse_intents_batch` with `parallel_engine::ParallelEngine` for adaptive batch processing
- Use `process_adaptive` which auto-selects sequential/parallel/chunked based on batch size

```rust
#[cfg(not(target_arch = "wasm32"))]
pub fn parse_intents_batch(texts: &[&str], constraints: serde_json::Value) -> Vec<IntentOutput> {
    let engine = parallel_engine::ParallelEngine::default();
    let items: Vec<String> = texts.iter().map(|t| t.to_string()).collect();
    let constraints_clone = constraints.clone();
    
    let results = engine.process_adaptive(items, move |text| {
        parse_intent(text, constraints_clone.clone())
    });
    
    results.into_iter().map(|r| r.result).collect()
}
```

### 5c. Wire market_engine + context_engine + nlp_engine into exposed API

**File: `intent-compiler/src/lib.rs`**
- Add new public functions that compose intent parsing with market/context/nlp analysis:

```rust
/// Full analysis: parse intent + market analysis + context assessment
pub fn analyze_intent_full(text: &str, constraints: serde_json::Value) -> FullAnalysis {
    let intent = parse_intent(text, constraints);
    let market = market_engine::analyze_market(
        text,
        intent.features.clone(),
        intent.tech_stack_hints.clone(),
    );
    let context = context_engine::analyze_context(text);
    let nlp = nlp_engine::parse_linguistically(text);
    
    FullAnalysis { intent, market, context, nlp }
}
```

- Add `FullAnalysis` struct to `types.rs`
- Add WASM binding `analyze_intent_full_wasm`

### 5e. Make gpu_accelerator real

**File: `intent-compiler/src/gpu_accelerator.rs`**
- Replace fake GPU operations with real CPU-vectorized batch processing using SIMD
- `gpu_tokenize` -> use the existing `tokenizer::tokenize_words`
- `gpu_embed` -> generate simple TF-IDF or bag-of-words vectors using the lexicon (not fake `vec![0.1; 768]`)
- `gpu_score` -> use the existing `scoring::compute_complexity` and `scoring::compute_confidence` functions
- Keep the same API surface but make the implementations call real code

```rust
fn gpu_tokenize(&self, text: &str) -> Vec<String> {
    crate::tokenizer::tokenize_words(text)
}

fn gpu_embed(&self, text: &str) -> Vec<f32> {
    // Generate a simple bag-of-words embedding using the lexicon
    let words = crate::tokenizer::tokenize_words(text);
    let mut embedding = vec![0.0f32; 768];
    for (i, word) in words.iter().enumerate() {
        let hash = {
            let mut h = std::collections::hash_map::DefaultHasher::new();
            word.hash(&mut h);
            h.finish()
        };
        let idx = (hash as usize) % 768;
        embedding[idx] += 1.0;
    }
    // L2 normalize
    let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        embedding.iter_mut().for_each(|x| *x /= norm);
    }
    embedding
}

fn gpu_score(&self, text: &str) -> f32 {
    let enrichment = crate::run_enrichment_pipeline(text);
    enrichment.complexity_score
}
```

### 5f. Make jit_engine real

**File: `intent-compiler/src/jit_engine.rs`**
- Replace the fake `compile_function` with actual result memoization
- When a function_id is "compiled" (executed > threshold times), cache its result
- On subsequent calls, if input matches a cached result, return it directly
- This gives real JIT-like behavior: repeated calls get faster

```rust
fn compile_function(&self, function_id: u64) {
    // Mark as compiled - subsequent calls via profile_and_execute
    // will track execution time improvement
    let compiled = CompiledFunction {
        bytecode: vec![], // No fake bytecode
        native_code: vec![], // No fake native code
        execution_count: 0,
        avg_execution_time_ns: 0,
    };
    self.code_cache.lock().unwrap().insert(function_id, compiled);
    if let Some(stats) = self.hot_paths.lock().unwrap().get_mut(&function_id) {
        stats.is_compiled = true;
    }
}
```

- Add a result cache (FxHashMap<u64, Box<dyn Any + Send>>) for memoization of hot-path results
- The real value: `profile_and_execute` for hot functions skips re-computation

### 5g. Expand market_engine beyond hardcoded data

**File: `intent-compiler/src/market_engine.rs`**
- Add keyword-based market segment detection for common project types:
  - `saas`, `subscription`, `platform` -> "B2B SaaS" segment
  - `ecommerce`, `shop`, `store`, `marketplace` -> "E-Commerce" segment
  - `social`, `community`, `network` -> "Social/Community" segment
  - `ai`, `ml`, `machine learning` -> "AI/ML Tools" segment
  - `health`, `medical`, `clinical` -> "HealthTech" segment
  - `finance`, `banking`, `payment` -> "FinTech" segment
  - `education`, `learning`, `course` -> "EdTech" segment
  - `devtool`, `developer`, `api` -> "Developer Tools" segment
- Each gets realistic TAM/SAM/SOM, competition level, and competitor data
- The `identify_competitors` function should return relevant competitors per segment
- Expand `identify_risks` to be segment-aware

---

## PHASE 6: TypeScript Compiler-Enhanced (HIGH PRIORITY)

### 6a. Implement JIT optimization passes

**File: `packages/compiler-enhanced/src/hyper/jit.ts`**
- The 6 identity functions (lines ~361-410) need real implementations
- Strategy: delegate to SWC for AST-level transforms

```typescript
private applyConstantFolding(code: string): string {
    // Use regex-based constant folding for simple cases:
    // 1 + 2 -> 3, true && false -> false, "a" + "b" -> "ab"
    return code
        .replace(/(\d+)\s*\+\s*(\d+)/g, (_, a, b) => String(Number(a) + Number(b)))
        .replace(/(\d+)\s*\*\s*(\d+)/g, (_, a, b) => String(Number(a) * Number(b)))
        .replace(/true\s*&&\s*false/g, 'false')
        .replace(/false\s*\|\|\s*true/g, 'true');
}

private applyDeadCodeElimination(code: string): string {
    // Remove unreachable code after return statements
    // Remove unused variable declarations
    // Remove empty blocks
    return code
        .replace(/return\s+[^;]+;\s*[^}]+(?=\})/g, (match) => {
            const returnIdx = match.indexOf(';');
            return match.substring(0, returnIdx + 1);
        })
        .replace(/\{\s*\}/g, '{}');
}

private applyInlining(code: string): string {
    // For hot paths: inline small function calls
    // Track function sizes, inline those under threshold
    return code; // Start conservative, expand later
}
```

### 6b. Connect HyperCompiler.compileFile() to real compilation

**File: `packages/compiler-enhanced/src/hyper/index.ts` ~line 1620**
- Replace `content.toString('utf-8')` passthrough with actual compilation pipeline
- Call into the parent EnhancedCompiler's transform logic
- Apply the hyper pipeline: cache check -> JIT optimization -> quantum optimization -> code splitting

### 6c. Connect applyCodeSplitting()

**File: `packages/compiler-enhanced/src/hyper/index.ts` ~line 1763**
- Replace `return { chunks: [] }` with actual call to `CodeSplittingEngine`
- Import and instantiate the splitting engine
- Pass compiled output through `engine.split()` -> return real chunks

### 6d. Wire distributed.ts compileContent()

**File: `packages/compiler-enhanced/src/hyper/distributed.ts` ~line 256**
- Replace passthrough with actual compilation
- The BullMQ job processor should call the HyperCompiler's single-file compile
- This creates a real distributed compilation pipeline

---

## PHASE 1: Security & CI/CD Foundation

### 1a. Create `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run type-check
      - run: pnpm run lint

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build:packages
      - run: npm test --prefix backend

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build:packages
      - run: npm run test:run --prefix frontend

  test-rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: intent-compiler
      - run: cargo test --manifest-path intent-compiler/Cargo.toml

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test-backend, test-frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build:packages
      - run: pnpm run build
```

### 1b. Fix .gitignore

Add these lines:
```
coverage/
*.bak
*.vsix
target/
.vscode/
```

### 1c. Replace deprecated csurf

- Remove `csurf` dependency
- Install `csrf-csrf`
- Rewrite `backend/src/middleware/csrf.ts` to use double-submit cookie pattern

### 1d. Fix CORS null origin

**File: `backend/src/middleware/security.ts` ~line 144**
- Remove the `origin === "null"` check from CORS origin validation
- `null` origin is sent by sandboxed iframes, data: URLs, and can be spoofed

### 1e. Update deprecated GitHub Actions

**File: `.github/workflows/security.yml`**
- `actions/upload-artifact@v3` -> `@v4`
- `github/codeql-action/*@v2` -> `@v3`
- `returntocorp/semgrep-action@v1` -> `semgrep/semgrep-action@v1`

**File: `.github/workflows/release.yml`**
- `actions/create-release@v1` -> `softprops/action-gh-release@v2`
- `actions/upload-release-asset@v1` -> included in softprops/action-gh-release
- `actions/upload-artifact@v3` -> `@v4`

---

## PHASE 2: Code Quality & Strictness

### 2a. Fix backend/tsconfig.json

```json
// Change these:
"noEmitOnError": true,        // was false
"noUnusedLocals": true,       // was false
"noUnusedParameters": true,   // was false
// Add:
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
// Remove "DOM" from lib array (backend doesn't need it)
"lib": ["ES2022"]
```

### 2b. Fix backend/eslint.config.js

```javascript
// Add parserOptions.project for type-aware rules:
parserOptions: {
    project: './tsconfig.json',
},
// Change rules:
'@typescript-eslint/no-explicit-any': 'error',  // was 'warn'
'@typescript-eslint/no-non-null-assertion': 'error', // was 'warn'
'prefer-const': 'error',  // was 'warn'
// Add type-aware rules:
'@typescript-eslint/no-floating-promises': 'error',
'@typescript-eslint/no-misused-promises': 'error',
'@typescript-eslint/await-thenable': 'error',
'@typescript-eslint/require-await': 'warn',
```

### 2c. Fix vitest.config.ts coverage

- Keep the 100% goal as aspiration but set interim thresholds:
  - statements: 80, branches: 75, functions: 80, lines: 80
- Remove at least 10 files from the exclusion list that should have coverage
- Priority files to un-exclude: `schemas/index.ts`, `config/rateLimits.ts`, `services/errorTracking.ts`, `db/schema.ts`

---

## PHASE 3: Dead Code & Frontend Cleanup

### 3a. Delete dead files

- Delete `frontend/src/components/ChatInterface.svelte.bak`
- Update or delete `frontend/src/components/ChatInterface.test.ts` (imports dead component)
- Note: ChatInterface.svelte itself is NOT dead (correction from initial assessment)

### 3b. Fix Svelte 4->5 migration in RefactoredChatInterface

**File: `frontend/src/components/RefactoredChatInterface.svelte`**
- Remove `import { createEventDispatcher } from 'svelte'`
- Remove `const dispatch = createEventDispatcher<...>()`
- Replace `dispatch('messages-updated', messages)` with `onmessagesUpdated?.(messages)`
- The `onmessagesUpdated` callback prop is already defined in the Props interface

### 3c. Move @types/dompurify

**File: `frontend/package.json`**
- Move `@types/dompurify` from `dependencies` to `devDependencies`

---

## PHASE 4: Backend Architecture Cleanup

### 4a. Extract shared SSE utility

**New file: `backend/src/utils/sse.ts`**

```typescript
import { Response, Request } from 'express';

export function setupSSE(req: Request, res: Response): { cleanup: () => void } {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    let clientDisconnected = false;
    
    req.on('close', () => {
        clientDisconnected = true;
    });

    return {
        cleanup: () => { clientDisconnected = true; },
    };
}

export function sendSSE(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
```

Then replace the repeated SSE boilerplate in `chat.ts`, `ship.ts`, `plan.ts` with calls to this utility.

### 4b. Extract async route wrapper

**New file: `backend/src/utils/asyncHandler.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { getRequestLogger } from '../utils/logger';
import { sendServerError } from '../utils/response';

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
        const log = getRequestLogger(req);
        Promise.resolve(fn(req, res, next)).catch((error) => {
            log.error({ err: error }, 'Unhandled route error');
            sendServerError(res, error);
        });
    };
}
```

### 4c. Fix deprecated substr()

**File: `backend/src/services/planService.ts` ~line 25**
- Change `.substr(2, 9)` to `.slice(2, 11)`

**File: `backend/src/services/shipModeService.ts` ~line 154**
- Change `.substr(2, 9)` to `.slice(2, 11)`

---

## Summary

| Phase | Tasks | Priority | Est. Effort |
|-------|-------|----------|-------------|
| 5: Rust Compiler | 7 tasks | High | Large |
| 6: TS Compiler | 4 tasks | High | Large |
| 1: Security/CI | 5 tasks | High | Medium |
| 2: Code Quality | 3 tasks | High | Small |
| 3: Frontend | 3 tasks | Medium | Small |
| 4: Backend | 3 tasks | Medium | Small |

Total: 25 tasks across 6 phases.

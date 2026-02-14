# ADR-001: Rust Intent Compiler

## Status

**Accepted**

**Date:** 2025-08-15  
**Author:** G-Rump Core Team  
**Reviewers:** Architecture Team

## Context

G-Rump processes natural language intents and converts them into structured data (PRDs, architectures, code). The intent parsing step needs to be:

1. **Fast**: Processing should be < 10ms for real-time UX
2. **Reliable**: Consistent parsing across different input formats
3. **Portable**: Must work in CLI, Desktop, and Web environments
4. **Efficient**: Minimal CPU and memory footprint

The original TypeScript intent parser was taking 120ms per request, which felt sluggish during chat interactions. We needed 10-15x performance improvement to achieve sub-10ms latency.

### Requirements

- Parse natural language intents into structured JSON
- Support WASM compilation for browser usage
- Achieve < 10ms parsing time
- Zero external dependencies (for security)
- SIMD optimization support for x86_64

## Decision

We will build a dedicated intent compiler in Rust with the following components:

1. **Core Parser**: Rust-based parser using nom for parsing combinators
2. **WASM Target**: Compile to WebAssembly for browser usage
3. **SIMD Optimizations**: Use AVX2/AVX-512 instructions on x86_64 for vector operations
4. **CLI Binary**: Standalone binary for server-side usage
5. **Parallel Processing**: Use rayon for multi-core parsing of batch requests

### Architecture

```
intent-compiler/
├── src/
│   ├── lib.rs           # WASM/library interface
│   ├── main.rs          # CLI binary
│   ├── parser.rs        # Core parsing logic
│   ├── simd.rs          # SIMD optimizations
│   └── types.rs         # Data structures
├── benches/             # Criterion benchmarks
└── tests/               # Integration tests
```

## Consequences

### Positive

- **15x Faster**: Reduced parsing time from 120ms to 8ms
- **Memory Efficient**: 90% less memory usage vs TypeScript
- **WASM Support**: Can run in browser with near-native performance
- **Type Safety**: Rust's type system catches errors at compile time
- **SIMD Performance**: 2-3x additional speedup on modern CPUs
- **Zero Runtime Dependencies**: Smaller attack surface, faster startup

### Negative

- **Build Complexity**: Requires Rust toolchain (1.77+) for development
- **Learning Curve**: Team needs Rust knowledge for modifications
- **Binary Distribution**: Need to distribute platform-specific binaries
- **Debugging**: Stack traces are less friendly than TypeScript
- **WASM Size**: ~500KB WASM binary (minified) vs ~100KB TS bundle

### Neutral

- Need to maintain both CLI and WASM builds
- Benchmarking infrastructure required (Criterion)
- Cross-compilation needed for Windows/macOS/Linux

## Alternatives Considered

### Alternative 1: Optimize TypeScript Parser

**Pros:**
- No new language/toolchain required
- Easier to maintain for existing team
- Simpler deployment (just Node.js)

**Cons:**
- Benchmarked improvements only reached 60ms (2x, not 15x)
- V8 JIT warmup time adds latency
- Difficult to achieve SIMD optimizations
- WASM compilation not practical

**Why not chosen:** Could not achieve performance targets

### Alternative 2: Go Parser

**Pros:**
- Fast compilation and execution
- Good concurrency primitives
- Static binary distribution

**Cons:**
- No mature WASM tooling at the time
- GC pauses affect latency predictability
- Larger binary sizes than Rust
- Less mature SIMD support

**Why not chosen:** WASM support was critical for web deployment

### Alternative 3: C/C++ Parser

**Pros:**
- Maximum performance potential
- Excellent SIMD support
- Small binary size

**Cons:**
- Memory safety concerns
- Harder to maintain
- No WASM first-class support
- Longer development time

**Why not chosen:** Rust offers similar performance with better safety

## Implementation Notes

### Key Steps

1. ✅ Set up Rust project with wasm-pack
2. ✅ Implement core parser with nom
3. ✅ Add SIMD optimizations for x86_64
4. ✅ Create CLI binary with clap
5. ✅ Set up Criterion benchmarking
6. ✅ Implement WASM bindings
7. ✅ Integrate with backend via child_process
8. ✅ Add CI builds for all platforms

### Performance Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| Parse Time | < 10ms | 8ms |
| Memory Usage | < 10MB | 4MB |
| Binary Size | < 5MB | 2.1MB |
| WASM Size | < 1MB | 500KB |

### Risks

- **Platform Compatibility**: SIMD may not work on all CPUs → Fallback to scalar code
- **WASM Performance**: Browser may be slower → Still 10x faster than TS
- **Build Times**: Rust compilation can be slow → Use sccache for caching

## References

- [Rust Performance Book](https://nnethercote.github.io/perf-book/)
- [wasm-pack Documentation](https://rustwasm.github.io/docs/wasm-pack/)
- [rayon Parallel Processing](https://docs.rs/rayon/)
- [Criterion Benchmarking](https://github.com/bheisler/criterion.rs)
- [Performance Comparison PR](https://github.com/Aphrodine-wq/GRUMPCO/pull/42)

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2025-08-15 | Initial draft | Core Team |
| 2025-08-20 | Added benchmarks | Core Team |
| 2025-09-01 | Accepted after review | Architecture Team |


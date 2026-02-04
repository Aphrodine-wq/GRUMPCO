# ADR 0001: Use SWC for TypeScript Compilation

**Status:** Accepted

**Date:** January 2024

## Context

The G-Rump project requires fast compilation times for both development velocity and CI/CD pipeline efficiency. Traditional TypeScript compilation (tsc) was taking 45+ seconds for the backend, which significantly impacted:
- Developer experience (slow feedback loops)
- CI pipeline duration
- Hot reload performance

## Decision

We will use SWC (Speedy Web Compiler) for TypeScript compilation instead of the standard tsc compiler.

### Implementation Details

1. **SWC Configuration** (`.swcrc`):
   - Target: ES2022
   - Module: ES6
   - Strict mode enabled
   - Source maps for debugging

2. **Build Pipeline**:
   - Development: `swc --watch` for instant rebuilds
   - Production: Optimized builds with minification
   - Type checking: Parallel `tsc --noEmit` for type safety without blocking builds

3. **Integration Points**:
   - CLI builds via `@swc/cli`
   - Programmatic usage via `@swc/core`
   - Source map support for debugging

## Consequences

### Positive

- **18x faster builds**: 45s → 2.5s for backend compilation
- **Better DX**: Instant feedback during development
- **CI/CD savings**: Shorter pipeline runs, faster deployments
- **Rust-based**: Memory-safe, parallel processing built-in
- **Compatible**: Drop-in replacement with minimal code changes

### Negative

- **Type checking separate**: Must run `tsc --noEmit` separately for type errors
- **Smaller ecosystem**: Fewer plugins than Babel
- **Debugging complexity**: Source maps required for stack traces

### Neutral

- **Migration effort**: Required updating all build scripts
- **Team learning**: Developers needed to understand SWC-specific configuration

## References

- [SWC Documentation](https://swc.rs/)
- [Performance benchmarks](./docs/PERFORMANCE_GUIDE.md)
- [Backend build configuration](./backend/.swcrc)

---

*Supersedes: N/A*

*Superseded by: N/A*
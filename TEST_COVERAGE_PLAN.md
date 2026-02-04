# Test Coverage Plan - Path to 100%

**Project**: GRUMPCO  
**Target**: 100% Test Coverage  
**Current Status**: Infrastructure Ready  
**Date**: February 4, 2026

---

## Overview

This document outlines the comprehensive plan to achieve **100% test coverage** across the GRUMPCO codebase. The vitest configuration is already set to require 100% coverage on all non-excluded files.

---

## Current State

### Test Infrastructure

- ✅ **Test Framework**: Vitest configured and ready
- ✅ **Coverage Provider**: V8
- ✅ **Coverage Thresholds**: Set to 100% (statements, branches, functions, lines)
- ✅ **Existing Tests**: 280 test files already in place
- ✅ **Coverage Reports**: Text, JSON, HTML, LCOV formats configured

### Configuration

**File**: `backend/vitest.config.ts`

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  reportsDirectory: './coverage',
  thresholds: {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
}
```

---

## Phase 1: Core Services (Week 1-2)

### Priority 1: Provider Services

#### 1.1 llmGateway.ts
**Status**: ⏳ Needs comprehensive tests  
**Complexity**: High  
**Estimated Time**: 2 days

**Test Cases Needed**:
- [ ] Provider configuration loading
- [ ] Stream generation for NIM provider
- [ ] Stream generation for GitHub Copilot provider
- [ ] Error handling for missing API keys
- [ ] Timeout handling
- [ ] Tool/function calling support
- [ ] Multimodal content handling
- [ ] Metrics recording
- [ ] Circuit breaker integration
- [ ] Provider fallback logic

**Example Test Structure**:
```typescript
describe('llmGateway', () => {
  describe('streamNim', () => {
    it('should stream content from NIM successfully', async () => {
      // Mock fetch
      // Call streamNim
      // Assert stream events
    });

    it('should handle API errors gracefully', async () => {
      // Mock failed fetch
      // Assert error event emitted
    });

    it('should emit tool use events when tools are provided', async () => {
      // Mock response with tool calls
      // Assert tool_use events
    });
  });

  describe('streamGitHubCopilot', () => {
    it('should stream content from GitHub Copilot', async () => {
      // Similar to NIM tests
    });

    it('should include editor headers', async () => {
      // Assert headers are sent
    });
  });

  describe('getStream', () => {
    it('should default to NIM provider', async () => {
      // Assert NIM is used
    });

    it('should use specified provider', async () => {
      // Assert correct provider used
    });

    it('should enable retry by default', async () => {
      // Assert retry wrapper is applied
    });
  });
});
```

#### 1.2 modelRouter.ts
**Status**: ⏳ Needs comprehensive tests  
**Complexity**: Medium  
**Estimated Time**: 1.5 days

**Test Cases Needed**:
- [ ] Request classification (simple, complex, coding, vision, creative)
- [ ] Provider selection logic
- [ ] Routing decisions for each request type
- [ ] Fallback chain generation
- [ ] Cost estimation
- [ ] User preference handling
- [ ] Force provider option
- [ ] Force model option

**Example Test Structure**:
```typescript
describe('modelRouter', () => {
  describe('classifyRequest', () => {
    it('should classify coding requests', () => {
      const params = {
        model: '',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user', content: 'Write a TypeScript function' }],
      };
      expect(classifyRequest(params)).toBe('coding');
    });

    it('should classify vision requests', () => {
      const params = {
        model: '',
        max_tokens: 100,
        system: '',
        messages: [{ 
          role: 'user', 
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: { url: 'https://...' } }
          ]
        }],
      };
      expect(classifyRequest(params)).toBe('vision');
    });
  });

  describe('selectProvider', () => {
    it('should select GitHub Copilot for coding requests', () => {
      const decision = selectProvider('coding');
      expect(decision.provider).toBe('github-copilot');
    });

    it('should select NIM for general requests', () => {
      const decision = selectProvider('default');
      expect(decision.provider).toBe('nim');
    });

    it('should respect user preference', () => {
      const decision = selectProvider('default', { 
        userPreference: 'github-copilot' 
      });
      expect(decision.provider).toBe('github-copilot');
    });
  });

  describe('routeStream', () => {
    it('should route coding requests to GitHub Copilot', async () => {
      // Mock getStream
      // Assert correct provider used
    });
  });
});
```

#### 1.3 smartRetry.ts
**Status**: ⏳ Needs comprehensive tests  
**Complexity**: High  
**Estimated Time**: 2 days

**Test Cases Needed**:
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker functionality
- [ ] Provider fallback chain
- [ ] Max retry attempts
- [ ] Error classification (retryable vs non-retryable)
- [ ] Metrics recording
- [ ] Timeout handling

#### 1.4 providerHealth.ts
**Status**: ⏳ Needs comprehensive tests  
**Complexity**: Medium  
**Estimated Time**: 1.5 days

**Test Cases Needed**:
- [ ] Health check execution
- [ ] Provider status tracking
- [ ] Failure threshold detection
- [ ] Auto-disable functionality
- [ ] Auto-enable functionality
- [ ] Latency monitoring
- [ ] Error rate calculation

---

## Phase 2: Middleware (Week 3)

### 2.1 logger.ts
**Estimated Time**: 1 day

**Test Cases Needed**:
- [ ] Log level filtering
- [ ] Request ID tracking
- [ ] Structured logging format
- [ ] Error logging with stack traces
- [ ] Performance logging

### 2.2 metrics.ts
**Estimated Time**: 1 day

**Test Cases Needed**:
- [ ] LLM stream metrics recording
- [ ] Cost tracking
- [ ] Latency measurement
- [ ] Token counting
- [ ] Prometheus format export

### 2.3 tracing.ts
**Estimated Time**: 1 day

**Test Cases Needed**:
- [ ] Span creation
- [ ] Attribute setting
- [ ] Trace context propagation
- [ ] OpenTelemetry integration

### 2.4 auth.ts
**Estimated Time**: 1.5 days

**Test Cases Needed**:
- [ ] JWT validation
- [ ] API key validation
- [ ] Session management
- [ ] Permission checking
- [ ] Rate limiting

---

## Phase 3: Features (Week 4-5)

### 3.1 codebase-analysis
**Estimated Time**: 2 days

**Test Cases Needed**:
- [ ] Code parsing
- [ ] Dependency analysis
- [ ] Complexity calculation
- [ ] Security scanning
- [ ] Report generation

### 3.2 intent-optimizer
**Estimated Time**: 2 days

**Test Cases Needed**:
- [ ] Intent parsing
- [ ] Optimization suggestions
- [ ] Intent validation
- [ ] Performance metrics

### 3.3 security-compliance
**Estimated Time**: 2 days

**Test Cases Needed**:
- [ ] Security checks
- [ ] Compliance validation
- [ ] Vulnerability scanning
- [ ] Report generation

---

## Phase 4: Utilities (Week 6)

### 4.1 Utils Directory
**Estimated Time**: 3 days

**Test Cases for Each Utility**:
- [ ] Input validation
- [ ] Edge cases
- [ ] Error handling
- [ ] Performance benchmarks

---

## Testing Best Practices

### 1. Test Structure

```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    // Setup
    beforeEach(() => {
      // Reset mocks, initialize state
    });

    afterEach(() => {
      // Cleanup
    });

    // Happy path
    it('should do X when Y', () => {
      // Arrange
      // Act
      // Assert
    });

    // Edge cases
    it('should handle empty input', () => {});
    it('should handle null input', () => {});
    it('should handle invalid input', () => {});

    // Error cases
    it('should throw error when Z', () => {});
    it('should handle network errors', () => {});
  });
});
```

### 2. Mocking Strategy

```typescript
import { vi } from 'vitest';

// Mock external dependencies
vi.mock('../services/llmGateway', () => ({
  getStream: vi.fn(),
  getProviderConfig: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock environment variables
vi.stubEnv('NVIDIA_NIM_API_KEY', 'test-key');
```

### 3. Coverage Commands

```bash
# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- path/to/test.test.ts

# Watch mode
npm run test:watch

# Generate HTML report
npm run test:coverage:report
```

### 4. Coverage Verification

```bash
# Check coverage thresholds
npm run test:coverage

# View detailed coverage report
open coverage/index.html

# CI integration
npm run test:coverage:ci
```

---

## Test Writing Guidelines

### 1. Naming Conventions

- **Test files**: `*.test.ts`
- **Integration tests**: `*.integration.test.ts`
- **Contract tests**: `*.contract.test.ts`
- **E2E tests**: `*.e2e.test.ts`

### 2. Test Organization

```
backend/
├── src/
│   ├── services/
│   │   ├── llmGateway.ts
│   │   └── modelRouter.ts
│   └── middleware/
│       └── auth.ts
└── tests/
    ├── services/
    │   ├── llmGateway.test.ts
    │   └── modelRouter.test.ts
    └── middleware/
        └── auth.test.ts
```

### 3. Test Coverage Metrics

- **Statements**: Every line of code executed
- **Branches**: Every conditional path taken
- **Functions**: Every function called
- **Lines**: Every line with code executed

### 4. Common Patterns

#### Testing Async Generators

```typescript
it('should stream events', async () => {
  const stream = getStream(params);
  const events: StreamEvent[] = [];
  
  for await (const event of stream) {
    events.push(event);
  }
  
  expect(events).toHaveLength(3);
  expect(events[0].type).toBe('content_block_delta');
  expect(events[2].type).toBe('message_stop');
});
```

#### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  
  const stream = getStream(params);
  const events: StreamEvent[] = [];
  
  for await (const event of stream) {
    events.push(event);
  }
  
  expect(events.some(e => e.type === 'error')).toBe(true);
});
```

#### Testing with Mocks

```typescript
it('should call provider with correct parameters', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    body: mockReadableStream,
  });
  global.fetch = mockFetch;
  
  await getStream(params);
  
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('api.nvidia.com'),
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Authorization': expect.stringContaining('Bearer'),
      }),
    })
  );
});
```

---

## Coverage Exclusions

The following are **intentionally excluded** from coverage requirements:

### Infrastructure
- Configuration files (`*.config.ts`)
- Type definitions (`*.d.ts`)
- Build scripts
- Migration scripts

### Optional Features
- Discord integration
- Obsidian integration
- Slack integration
- Spotify integration

### Large Optional Modules
- Deploy service
- JIRA service
- Cost estimator
- Performance monitor
- Session storage
- BaaS service
- Cache warmer
- Advanced orchestration services

### Reasoning
These modules are either:
1. **Infrastructure** - Not application logic
2. **Optional** - Not required for core functionality
3. **External** - Third-party integrations
4. **Advanced** - Complex features with separate testing strategies

---

## Success Metrics

### Coverage Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Statements** | 100% | TBD | ⏳ |
| **Branches** | 100% | TBD | ⏳ |
| **Functions** | 100% | TBD | ⏳ |
| **Lines** | 100% | TBD | ⏳ |

### Quality Metrics

- **Test Execution Time**: < 30 seconds
- **Test Reliability**: 100% pass rate
- **Code Maintainability**: A grade
- **Test Maintainability**: A grade

---

## Timeline

### Week 1-2: Core Services
- Day 1-2: llmGateway.ts
- Day 3-4: modelRouter.ts
- Day 5-6: smartRetry.ts
- Day 7-8: providerHealth.ts

### Week 3: Middleware
- Day 1: logger.ts
- Day 2: metrics.ts
- Day 3: tracing.ts
- Day 4-5: auth.ts

### Week 4-5: Features
- Day 1-2: codebase-analysis
- Day 3-4: intent-optimizer
- Day 5-6: security-compliance

### Week 6: Utilities
- Day 1-3: Utils directory
- Day 4-5: Integration tests
- Day 6: Final coverage verification

---

## Continuous Integration

### Pre-commit Hooks

```bash
# .husky/pre-commit
npm run test
npm run lint
npm run type-check
```

### CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test Coverage
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: pnpm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Troubleshooting

### Common Issues

#### 1. Coverage Not Reaching 100%

**Problem**: Some lines not covered  
**Solution**: 
- Check coverage report: `open coverage/index.html`
- Identify uncovered lines
- Write tests for those specific cases

#### 2. Flaky Tests

**Problem**: Tests pass/fail randomly  
**Solution**:
- Use proper async/await
- Mock time-dependent functions
- Reset mocks between tests

#### 3. Slow Tests

**Problem**: Test suite takes too long  
**Solution**:
- Parallelize tests
- Mock expensive operations
- Use test.concurrent for independent tests

---

## Resources

### Documentation
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [V8 Coverage](https://v8.dev/blog/javascript-code-coverage)

### Tools
- **Vitest**: Test runner
- **V8**: Coverage provider
- **Codecov**: Coverage tracking
- **SonarQube**: Code quality analysis

### Commands Reference

```bash
# Install dependencies
pnpm install

# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Run specific test
npm run test -- llmGateway.test.ts

# Generate HTML report
npm run test:coverage:report

# CI mode
npm run test:coverage:ci
```

---

## Conclusion

Achieving 100% test coverage requires:

1. **Systematic approach** - Follow the phased plan
2. **Comprehensive testing** - Cover all code paths
3. **Quality over quantity** - Write meaningful tests
4. **Continuous monitoring** - Track coverage metrics
5. **Team collaboration** - Share knowledge and best practices

**Estimated Total Time**: 6 weeks  
**Team Size**: 2-3 developers  
**Expected Outcome**: 100% test coverage on all core services

---

**Document Version**: 1.0  
**Last Updated**: February 4, 2026  
**Maintained By**: Development Team

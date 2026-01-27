# Testing Guide

This document describes the testing strategy, structure, and requirements for the G-Rump project.

## Test Structure

### Backend Tests

Located in `backend/tests/`:

- **Unit Tests** (`backend/tests/services/`): Test individual services in isolation
- **Integration Tests** (`backend/tests/integration/`): Test API endpoints and workflows
- **Middleware Tests** (`backend/tests/middleware/`): Test Express middleware
- **Load Tests** (`backend/tests/load/`): k6 performance and stress tests

### Frontend Tests

Located in `frontend/`:

- **Unit Tests**: Component and utility tests using Vitest (setup in `src/test/setup.ts`; Vitest excludes `e2e/` so Playwright specs are not run as unit tests).
- **E2E Tests** (`frontend/e2e/`): End-to-end tests using Playwright (run with `npm run test:e2e`).

Frontend coverage thresholds are currently set to 0 in `frontend/vitest.config.ts` so CI passes with minimal unit tests. Increase them (e.g. toward 80% lines) as more tests are added.

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Generate coverage report (opens in browser)
npm run test:coverage:report

# Coverage for CI (JSON output)
npm run test:coverage:ci

# Run load tests (requires k6)
npm run load-test
```

### Frontend Tests

```bash
cd frontend

# Run unit tests
npm run test:run

# Run unit tests in watch mode
npm run test:unit

# Run tests with coverage
npm run test:coverage

# Generate coverage report
npm run test:coverage:report

# Coverage for CI
npm run test:coverage:ci

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in CI mode
npm run test:e2e:ci
```

## Coverage Requirements

### Minimum Coverage Thresholds

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

These thresholds are enforced in CI. If coverage falls below these levels, the build will fail.

### Coverage Exclusions

The following are excluded from coverage:

- Test files themselves
- Configuration files
- Type definitions
- Build outputs
- E2E test directories

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myService } from '../src/services/myService';

describe('MyService', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    const result = myService.doSomething();
    expect(result).toBe(expected);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('POST /api/endpoint', () => {
  it('should return 200 with valid input', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ data: 'test' })
      .expect(200);

    expect(response.body).toHaveProperty('result');
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('user can complete workflow', async ({ page }) => {
  await page.goto('/');
  
  // Interact with UI
  await page.fill('input[name="query"]', 'test');
  await page.click('button[type="submit"]');
  
  // Verify result
  await expect(page.locator('.result')).toBeVisible();
});
```

## Test Best Practices

### 1. Test Organization

- Group related tests using `describe` blocks
- Use descriptive test names that explain what is being tested
- Follow the Arrange-Act-Assert pattern

### 2. Mocking

- Mock external dependencies (APIs, databases, file system)
- Use Vitest's `vi.mock()` for module mocking
- Mock at the appropriate level (unit vs integration)

### 3. Test Data

- Use factories or fixtures for test data
- Keep test data minimal and focused
- Clean up test data after tests

### 4. Async Testing

- Always await async operations
- Use proper timeout values for slow operations
- Handle errors appropriately

### 5. Coverage

- Aim for high coverage but focus on critical paths
- Don't sacrifice test quality for coverage percentage
- Test edge cases and error conditions

## Load Testing

### k6 Setup

1. Install k6: https://k6.io/docs/getting-started/installation/
2. Configure environment variables:
   ```bash
   export K6_BASE_URL=http://localhost:3000
   export K6_VUS=10
   export K6_DURATION=30s
   ```
3. Run load tests:
   ```bash
   npm run load-test
   ```

### Load Test Scenarios

- **Health Check**: Basic API availability
- **Intent Parsing**: Parse natural language intents
- **Architecture Generation**: Generate system architectures
- **Session Creation**: Create code generation sessions
- **Rate Limiting**: Validate rate limiting behavior

## CI Integration

Tests run automatically in CI on:

- Every push to main/develop branches
- Every pull request
- Coverage reports are uploaded and tracked
- E2E tests run in headless mode
- Load tests can be scheduled (optional)

## Debugging Tests

### Backend

```bash
# Run specific test file
npm test -- tests/services/myService.test.ts

# Run tests matching pattern
npm test -- -t "should do something"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/vitest
```

### Frontend

```bash
# Run E2E tests in debug mode
npm run test:e2e:debug

# Run E2E tests with UI
npm run test:e2e:ui
```

## Performance Benchmarks

Performance benchmarks are included in load tests:

- **API Response Time**: p95 < 5s
- **Error Rate**: < 5%
- **Concurrent Users**: Tested up to 20 VUs

## Troubleshooting

### Tests Fail in CI but Pass Locally

- Check environment variables
- Verify test data is available
- Check for timing issues (add appropriate waits)
- Ensure all dependencies are installed

### Coverage Not Increasing

- Verify files aren't excluded in `vitest.config.ts`
- Check that tests are actually executing code paths
- Ensure test files are in the correct location

### E2E Tests Flaky

- Add explicit waits instead of fixed timeouts
- Use `waitFor` for dynamic content
- Verify test isolation (clean state between tests)
- Check for race conditions

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [k6 Documentation](https://k6.io/docs/)
- [Testing Best Practices](https://testingjavascript.com/)

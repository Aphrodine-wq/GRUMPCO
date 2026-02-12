# Contributing to G-Rump

Thank you for your interest in contributing to G-Rump! This document provides guidelines and standards to ensure code quality and consistency.

**NVIDIA Golden Developer** — G-Rump targets full NVIDIA ecosystem compliance. See [docs/NVIDIA_GOLDEN_DEVELOPER.md](docs/NVIDIA_GOLDEN_DEVELOPER.md) for current focus areas.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Code Quality Standards](#code-quality-standards)
- [Git Workflow](#git-workflow)
- [Development Guidelines](#development-guidelines)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Getting Help](#getting-help)

---

## Quick Start

### 1. Fork & Clone

```bash
git clone https://github.com/your-username/GRUMPCO.git
cd GRUMPCO
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Build shared packages (required)
npm run build:packages

# Install backend dependencies
cd backend && npm install
cd ..

# Install frontend dependencies
cd frontend && npm install
cd ..
```

### 3. Set Up Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys (or use MOCK_AI_MODE=true)
```

### 4. Run Checks

```bash
npm run check-all
npm test
```

---

## Code Quality Standards

### TypeScript Requirements

**Strict Mode Enabled:**
- No `any` types unless absolutely necessary
- Explicit return types on public functions
- Proper error typing with `unknown` instead of `any`

**Example - Good vs Bad:**

```typescript
// ❌ Bad
function process(data: any): any {
  return data.value;
}

// ✅ Good
interface ProcessData {
  value: string;
  timestamp: number;
}

interface ProcessResult {
  value: string;
  processedAt: Date;
}

function process(data: ProcessData): ProcessResult {
  return {
    value: data.value.toUpperCase(),
    processedAt: new Date()
  };
}
```

### Error Handling Standards

**Always use standardized error handling:**

```typescript
// ❌ Bad - Inconsistent
res.status(500).json({ error: err.message });

// ✅ Good - Standardized
import { sendErrorResponse, ErrorCode } from '../utils/errorResponse.js';

function handleRequest(req: Request, res: Response) {
  try {
    const result = await processData(req.body);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Operation failed');
    sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Operation failed');
  }
}
```

**Production Safety:**
- Never expose stack traces in production
- Use generic error messages for 500 errors
- Log full details server-side only

---

## Git Workflow

### Branch Naming

```
feature/description     # New features
fix/description         # Bug fixes
docs/description        # Documentation
refactor/description    # Code refactoring
test/description        # Test additions
security/description    # Security fixes
perf/description        # Performance improvements
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Tests |
| `build` | Build system |
| `ci` | CI/CD changes |
| `chore` | Maintenance |
| `security` | Security fix |

**Scopes:**
`backend`, `frontend`, `cli`, `ai-core`, `rag`, `voice`, `memory`, `kimi`, `compiler`, `vscode`, `intent-compiler`, `deploy`, `docs`, `ci`, `deps`, `security`

**Examples:**

```bash
feat(backend): add OAuth support for GitHub

fix(frontend): resolve memory leak in chat component

docs(readme): update installation instructions

test(utils): add coverage for errorHandler

perf(cache): implement tiered caching for 40% cost reduction
```

### Commitlint

Commits are validated by commitlint:

```bash
npm run prepare  # Sets up Husky hooks
```

---

## Development Guidelines

### Project Structure

```
grump/
├── frontend/          # Svelte 5 frontend + Electron desktop
│   ├── src/
│   │   ├── lib/      # Shared utilities
│   │   ├── stores/   # Svelte stores
│   │   ├── utils/    # Helper functions
│   │   └── types/    # Type definitions
│   ├── electron/     # Electron main process
│   └── e2e/          # Playwright E2E tests
├── backend/          # Express 5 backend
│   ├── src/
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── db/          # Database layer
│   │   └── mcp/         # MCP server
│   └── tests/        # Vitest unit tests
├── packages/         # Shared packages
│   ├── shared-types/ # Common types
│   ├── ai-core/      # AI utilities & model router
│   ├── cli/          # CLI tool (grump-cli)
│   └── ...
└── docs/             # Developer documentation
```

### Frontend (Svelte 5)

**Component Structure:**

```svelte
<script lang="ts">
  // Imports first
  import { onMount } from 'svelte';
  import type { ComponentProps } from './types';
  
  // Props with types
  interface Props {
    title: string;
    onAction?: () => void;
    variant?: 'primary' | 'secondary';
  }
  
  let { 
    title, 
    onAction,
    variant = 'primary' 
  }: Props = $props();
  
  // State
  let count = $state(0);
  let isLoading = $state(false);
  
  // Derived state
  let doubled = $derived(count * 2);
  
  // Effects
  $effect(() => {
    console.log('Count changed:', count);
  });
  
  // Event handlers
  function handleClick() {
    count++;
    onAction?.();
  }
</script>

<div class="component" class:primary={variant === 'primary'}>
  <h1>{title}</h1>
  <p>Count: {count} (doubled: {doubled})</p>
  <button onclick={handleClick} disabled={isLoading}>
    {isLoading ? 'Loading...' : 'Increment'}
  </button>
</div>

<style>
  .component {
    padding: 1rem;
  }
  
  .primary {
    background: var(--color-primary);
  }
  
  button {
    cursor: pointer;
  }
  
  button:disabled {
    opacity: 0.5;
  }
</style>
```

**Store Usage:**

```typescript
// stores/counter.ts
import { writable, derived } from 'svelte/store';

export const count = writable(0);

export const doubled = derived(count, $count => $count * 2);

export function increment() {
  count.update(n => n + 1);
}
```

### Backend (Express 5)

**Route Structure:**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { sendErrorResponse, ErrorCode } from '../utils/errorResponse.js';
import logger from '../middleware/logger.js';
import { zodValidator } from '../middleware/validator.js';
import { createUserSchema } from '../schemas/user.js';

const router = Router();

/**
 * Create a new user
 * POST /api/users
 */
router.post(
  '/',
  requireAuth,
  zodValidator(createUserSchema),
  async (req, res) => {
    try {
      const user = await createUser(req.body);
      logger.info({ userId: user.id }, 'User created');
      res.status(201).json(user);
    } catch (err) {
      logger.error({ err }, 'Failed to create user');
      sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Failed to create user');
    }
  }
);

export default router;
```

**Service Structure:**

```typescript
// services/userService.ts
import logger from '../middleware/logger.js';

export interface CreateUserInput {
  email: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createUser(
  input: CreateUserInput
): Promise<ServiceResult<User>> {
  try {
    // Validation
    if (!input.email.includes('@')) {
      return { success: false, error: 'Invalid email' };
    }
    
    // Database operation
    const user = await db.users.create(input);
    
    logger.info({ userId: user.id }, 'User created');
    
    return { success: true, data: user };
  } catch (err) {
    logger.error({ err }, 'Failed to create user');
    return { success: false, error: 'Failed to create user' };
  }
}
```

---

## Testing Requirements

### Coverage Requirements

| Metric | Target |
|--------|--------|
| Statements | 100% |
| Branches | 100% |
| Functions | 100% |
| Lines | 100% |

> Note: Excluded paths include integration modules, UI components, infrastructure (see vitest.config.ts)

### Running Tests

```bash
# All tests
npm test

# Backend only
cd backend && npm test

# Frontend only
cd frontend && npm run test:run

# E2E tests
cd frontend && npm run test:e2e

# With coverage
npm run test:coverage

# Watch mode
cd backend && npm run test:watch
```

### Writing Tests

**Unit Test Example:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { processData } from './utils.js';

describe('processData', () => {
  it('should process valid data', () => {
    const result = processData({ value: 'test' });
    expect(result).toBe('processed: test');
  });

  it('should handle empty input', () => {
    expect(() => processData(null)).toThrow('Invalid input');
  });

  it('should trim whitespace', () => {
    const result = processData({ value: '  test  ' });
    expect(result).toBe('processed: test');
  });
});
```

**Test Naming:**
- Use descriptive test names
- Follow pattern: "should [expected behavior] when [condition]"

### Mocking

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('../services/api.js', () => ({
  fetchData: vi.fn().mockResolvedValue({ id: 1, name: 'Test' })
}));

// Spy on a function
const spy = vi.spyOn(console, 'log');
expect(spy).toHaveBeenCalledWith('expected message');
```

---

## Documentation

### Code Comments

**JSDoc for Public APIs:**

```typescript
/**
 * Creates a new user in the system.
 * 
 * @param userData - The user data to create
 * @returns The created user with generated ID
 * @throws {ValidationError} If user data is invalid
 * 
 * @example
 * ```typescript
 * const user = await createUser({ 
 *   name: 'John', 
 *   email: 'john@example.com' 
 * });
 * console.log(user.id); // 'usr-abc123'
 * ```
 */
export async function createUser(
  userData: CreateUserInput
): Promise<User> {
  // implementation
}
```

### README Updates

When adding features:
- Update relevant documentation in `docs/`
- Add examples if applicable
- Update CHANGELOG.md

---

## Pull Request Process

### Before Submitting

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiling (`npm run type-check`)
- [ ] ESLint passing (`npm run lint`)
- [ ] Coverage maintained (100%)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated for significant changes

### PR Template

```markdown
## Summary
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Screenshots
If UI changes, include screenshots.

## Checklist
- [ ] Tests pass
- [ ] Linting passes
- [ ] Documentation updated
```

### Review Process

1. **Automated checks must pass:**
   - CI build
   - Tests
   - Linting
   - Type checking

2. **Code review:**
   - At least one approval for most changes
   - Two approvals for core/infrastructure changes
   - All conversations resolved

3. **Merge requirements:**
   - Branch is up to date with target
   - No merge conflicts
   - PR title follows conventional commits

---

## Getting Help

- **Discord:** [Join our community](https://discord.gg/grump)
- **Issues:** [GitHub Issues](https://github.com/Aphrodine-wq/GRUMPCO/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Aphrodine-wq/GRUMPCO/discussions)

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Added to the hall of fame

---

**Thank you for contributing to G-Rump!** 🚀

**Last Updated:** February 2026



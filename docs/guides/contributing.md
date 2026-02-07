# Contributing to G-Rump

Thank you for your interest in contributing to G-Rump! This document provides guidelines and standards to ensure code quality and consistency.

---

## Quick Start

1. **Fork & Clone**
   ```bash
   git clone https://github.com/your-username/grump.git
   cd grump
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. **Set Up Environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API keys
   ```

4. **Run Checks**
   ```bash
   npm run check-all
   ```

---

## Code Quality Standards

### TypeScript Requirements

1. **Strict Mode Enabled**
   - No `any` types unless absolutely necessary
   - Explicit return types on public functions
   - Proper error typing with `unknown` instead of `any`

2. **Example - Good vs Bad**
   ```typescript
   // ❌ Bad
   function process(data: any): any {
     return data.value;
   }

   // ✅ Good
   interface ProcessData {
     value: string;
   }
   
   function process(data: ProcessData): string {
     return data.value;
   }
   ```

### Error Handling Standards

1. **Always Use Standardized Error Handling**
   ```typescript
   // ❌ Bad - Inconsistent
   res.status(500).json({ error: err.message });

   // ✅ Good - Standardized
   import { sendErrorResponse, ErrorCode } from '../utils/errorResponse.js';
   sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Operation failed');
   ```

2. **Log Before Sending Error**
   ```typescript
   try {
     await riskyOperation();
   } catch (err) {
     logger.error({ err }, 'Operation failed');
     sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Operation failed');
   }
   ```

3. **Production Safety**
   - Never expose stack traces in production
   - Use generic error messages for 500 errors
   - Log full details server-side only

### Testing Requirements

1. **Minimum Coverage**
   - Backend: 80% (currently 65%)
   - Frontend: 60% (currently 35%)
   - New code: 80% minimum

2. **Test Structure**
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { processData } from './utils.js';

   describe('processData', () => {
     it('should process valid data', () => {
       const result = processData({ value: 'test' });
       expect(result).toBe('processed: test');
     });

     it('should handle errors gracefully', () => {
       expect(() => processData(null)).toThrow();
     });
   });
   ```

3. **Test Naming**
   - Use descriptive test names
   - Follow pattern: "should [expected behavior] when [condition]"

### Security Guidelines

1. **Environment Variables**
   - All env vars must be validated in `env.ts`
   - Never log secrets or API keys
   - Use Zod schemas for validation

2. **Input Validation**
   - Validate all user inputs with Zod or express-validator
   - Sanitize data before database insertion
   - Use parameterized queries (prevent SQL injection)

3. **Authentication**
   - Always use `requireAuth` middleware for protected routes
   - Check admin status with `requireAdmin` where appropriate
   - Validate JWT tokens properly

---

## Git Workflow

### Branch Naming

```
feature/description    # New features
fix/description        # Bug fixes
docs/description       # Documentation
refactor/description   # Code refactoring
test/description       # Test additions
security/description   # Security fixes
```

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

**Examples:**
```
feat(auth): add OAuth support for GitHub

fix(api): resolve race condition in rate limiting

docs(readme): update installation instructions

test(utils): add coverage for errorHandler
```

### Pull Request Process

1. **Before Submitting**
   - [ ] All tests passing
   - [ ] TypeScript compiling
   - [ ] ESLint passing
   - [ ] Coverage maintained
   - [ ] Documentation updated

2. **PR Template**
   - Describe what changed and why
   - Link related issues
   - Include screenshots for UI changes
   - Note breaking changes

3. **Review Process**
   - Requires 2 approvals for core changes
   - All CI checks must pass
   - Address review comments promptly

---

## Project Structure

```
grump/
├── frontend/          # Svelte frontend
│   ├── src/
│   │   ├── lib/      # Shared utilities
│   │   ├── stores/   # Svelte stores
│   │   ├── utils/    # Helper functions
│   │   └── types/    # Type definitions
│   └── tests/        # E2E tests
├── backend/          # Express backend
│   ├── src/
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── db/          # Database layer
│   │   └── skills/      # Skill system
│   └── tests/        # Unit tests
└── packages/         # Shared packages
    ├── shared-types/ # Common types
    └── ai-core/      # AI utilities
```

---

## Development Guidelines

### Frontend (Svelte)

1. **Component Structure**
   ```svelte
   <script lang="ts">
     // Imports first
     import { onMount } from 'svelte';
     
     // Props with types
     interface Props {
       title: string;
       onAction?: () => void;
     }
     let { title, onAction }: Props = $props();
     
     // State
     let count = $state(0);
     
     // Effects
     $effect(() => {
       console.log('Count changed:', count);
     });
   </script>

   <div class="component">
     <h1>{title}</h1>
     <button onclick={() => count++}>Count: {count}</button>
   </div>

   <style>
     .component {
       padding: 1rem;
     }
   </style>
   ```

2. **Store Usage**
   - Use stores for global state
   - Prefer derived stores for computed values
   - Clean up subscriptions on destroy

### Backend (Express)

1. **Route Structure**
   ```typescript
   import { Router } from 'express';
   import { requireAuth } from '../middleware/authMiddleware.js';
   import { sendErrorResponse, ErrorCode } from '../utils/errorResponse.js';
   import logger from '../middleware/logger.js';

   const router = Router();

   router.post('/endpoint', requireAuth, async (req, res) => {
     try {
       const result = await processRequest(req.body);
       res.json(result);
     } catch (err) {
       logger.error({ err }, 'Endpoint failed');
       sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Processing failed');
     }
   });

   export default router;
   ```

2. **Service Structure**
   ```typescript
   export interface ServiceResult {
     success: boolean;
     data?: unknown;
     error?: string;
   }

   export async function performOperation(input: string): Promise<ServiceResult> {
     try {
       const result = await db.query(input);
       return { success: true, data: result };
     } catch (err) {
       logger.error({ err }, 'Operation failed');
       return { success: false, error: 'Operation failed' };
     }
   }
   ```

---

## Performance Guidelines

1. **Frontend**
   - Lazy load routes with `import()`
   - Use Svelte's built-in optimizations
   - Implement virtual scrolling for long lists
   - Optimize images and assets

2. **Backend**
   - Use compression middleware
   - Implement caching with proper TTL
   - Use connection pooling for DB
   - Offload CPU work to worker threads

---

## Documentation

1. **Code Comments**
   - Use JSDoc for public APIs
   - Explain complex logic
   - Note security considerations

2. **README Updates**
   - Keep installation instructions current
   - Document environment variables
   - Add troubleshooting tips

---

## Getting Help

- **Discord:** [Join our community](https://discord.gg/grump)
- **Issues:** [GitHub Issues](https://github.com/grump/issues)
- **Discussions:** [GitHub Discussions](https://github.com/grump/discussions)

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Added to the hall of fame

---

Thank you for contributing to G-Rump! 🚀

---

**Last Updated:** 2026-01-30

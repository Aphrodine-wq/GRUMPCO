# Development Guide

This guide covers the development workflow, coding standards, and best practices for contributing to G-Rump.

**NVIDIA Golden Developer** — G-Rump targets full NVIDIA ecosystem compliance. See [docs/NVIDIA_GOLDEN_DEVELOPER.md](docs/NVIDIA_GOLDEN_DEVELOPER.md) for the award submission and [docs/ROADMAP.md](docs/ROADMAP.md) for current focus.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Architecture Overview](#architecture-overview)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime (check `.nvmrc`) |
| pnpm/npm | Latest | Package management |
| Rust | 1.77+ | Intent compiler (optional) |
| Docker | Latest | Containerized development |
| Git | 2.30+ | Version control |

### Recommended VS Code Extensions

- ESLint
- Prettier
- Svelte for VS Code
- TypeScript Importer
- Error Lens
- GitLens

---

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/Aphrodine-wq/GRUMPCO.git
cd GRUMPCO

# Use correct Node version
nvm use  # or check .nvmrc

# Install dependencies
npm install

# Build shared packages (required first)
npm run build:packages
```

### 2. Configure Environment

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Required: Add at least one AI provider key
# NVIDIA_NIM_API_KEY=your-key-here
```

### 3. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or individually
npm run dev:backend
npm run dev:frontend

# Desktop app development
cd frontend && npm run electron:dev
```

---

## Development Workflow

### Branch Strategy

```
main           # Production-ready code
├── develop    # Integration branch
├── feature/*  # New features
├── fix/*      # Bug fixes
├── docs/*     # Documentation
└── chore/*    # Maintenance tasks
```

### Typical Workflow

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make changes with atomic commits
3. Run checks: `npm run check-all`
4. Run tests: `npm test`
5. Push and create PR

---

## Code Standards

### TypeScript

- Strict mode enabled (`strict: true`)
- Use explicit types for function parameters and returns
- Prefer interfaces over type aliases for object shapes
- Use `readonly` for immutable properties

```typescript
// Good
interface UserConfig {
  readonly apiKey: string;
  timeout: number;
}

function createClient(config: UserConfig): Client {
  return new Client(config);
}

// Avoid
function createClient(config: any) {
  return new Client(config);
}
```

### File Organization

```
src/
├── config/       # Environment and configuration
├── middleware/   # Express middleware
├── routes/       # API endpoints
├── services/     # Business logic
├── schemas/      # Zod validation schemas
├── types/        # TypeScript type definitions
└── utils/        # Utility functions
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | camelCase | `userService.ts` |
| Classes | PascalCase | `UserService` |
| Functions | camelCase | `createUser()` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `UserConfig` |

### Documentation

All public APIs must have JSDoc:

```typescript
/**
 * Creates a new user in the system.
 * 
 * @param userData - The user data to create
 * @returns The created user with generated ID
 * @throws {ValidationError} If user data is invalid
 * @example
 * ```typescript
 * const user = await createUser({ name: 'John', email: 'john@example.com' });
 * ```
 */
export async function createUser(userData: CreateUserInput): Promise<User> {
  // implementation
}
```

---

## Testing

### Test Structure

```
tests/
├── unit/           # Isolated unit tests
├── integration/    # API integration tests
├── e2e/            # End-to-end tests
├── contract/       # OpenAPI contract tests
├── evals/          # AI agent evaluations
└── load/           # k6 load tests
```

### Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Contract tests
npm run test:contract

# Watch mode
npm run test:watch

# Load tests
npm run load-test
```

### Coverage Requirements

- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const result = await createUser({ name: 'John' });
      expect(result.id).toBeDefined();
      expect(result.name).toBe('John');
    });

    it('should throw on invalid data', async () => {
      await expect(createUser({})).rejects.toThrow('Name is required');
    });
  });
});
```

---

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, etc.) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependencies |
| `ci` | CI/CD changes |
| `chore` | Other changes |
| `revert` | Revert previous commit |
| `security` | Security fix |
| `deps` | Dependency updates |

### Scopes

`backend`, `frontend`, `cli`, `ai-core`, `rag`, `voice`, `memory`, `kimi`, `compiler`, `vscode`, `intent-compiler`, `deploy`, `docs`, `ci`, `deps`, `security`

### Examples

```bash
feat(backend): add OAuth2 authentication support

fix(frontend): resolve memory leak in chat component

docs(readme): update installation instructions

chore(deps): upgrade TypeScript to 5.3
```

### Commitlint

Commits are validated by commitlint. Install the hook:

```bash
npm run prepare  # Sets up Husky hooks
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Type checking passes: `npm run type-check`
- [ ] Documentation updated if needed
- [ ] Changelog updated for significant changes

### PR Template

PRs should include:

1. **Summary**: What does this PR do?
2. **Type of Change**: Feature, bug fix, etc.
3. **Testing**: How was this tested?
4. **Screenshots**: If UI changes

### Review Process

1. Automated CI checks must pass
2. At least one approval from code owner
3. All conversations resolved
4. Branch is up to date with target

---

## Architecture Overview

### Monorepo Structure

```
grump-monorepo/
├── frontend/          # Svelte 5 + Electron desktop app
├── backend/           # Express 5 API server
├── packages/          # Shared packages
│   ├── ai-core/       # LLM routing and providers
│   ├── cli/           # grump-cli
│   ├── shared-types/  # TypeScript types
│   └── ...
├── intent-compiler/   # Rust NL parser
└── deploy/            # Infrastructure configs
```

### Request Flow

```
Client → Express → Middleware → Route → Service → LLM Provider
                      ↓
              Validation (Zod)
                      ↓
              Rate Limiting
                      ↓
              Authentication
```

### API Versioning

All API routes support versioning:

- **Recommended**: `/api/v1/chat`, `/api/v1/codegen`, etc.
- **Legacy (backwards compatible)**: `/api/chat`, `/api/codegen`, etc.

To disable legacy unversioned routes, set `API_DISABLE_LEGACY_ROUTES=true`.

### Rate Limiting Configuration

Rate limits are externalized and can be configured via environment variables:

```bash
# Global rate limits
RATE_LIMIT_GLOBAL_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_GLOBAL_MAX=100           # Max requests per window

# Tier multipliers (scale limits by subscription tier)
RATE_LIMIT_TIER_MULTIPLIER_PRO=4
RATE_LIMIT_TIER_MULTIPLIER_TEAM=8
RATE_LIMIT_TIER_MULTIPLIER_ENTERPRISE=20

# Or provide full JSON config
RATE_LIMIT_CONFIG='{"global":{"windowMs":60000,"maxRequests":50},...}'
```

### Error Tracking (Sentry)

Production error tracking is available via Sentry integration:

```bash
# Enable Sentry error tracking
SENTRY_DSN=https://your-dsn@sentry.io/project

# Optional: Enable debug mode for development testing
SENTRY_DEBUG=true
```

Features:
- Automatic exception capture with context
- Request correlation IDs
- Performance monitoring
- User context tracking
- Breadcrumb trails

### Key Patterns

1. **Middleware Chain**: Auth → Rate Limit → Validation → Handler
2. **Service Layer**: Business logic separate from routes
3. **Schema Validation**: Zod for all inputs
4. **Error Handling**: Centralized error middleware

---

## Troubleshooting

### Common Issues

**Port already in use**
```bash
# Find and kill process on port 3000
npx kill-port 3000
```

**TypeScript errors after package update**
```bash
# Clean and rebuild
rm -rf node_modules/.cache
npm run build:packages
```

**Tests failing on CI but passing locally**
```bash
# Run with same config as CI
npm run test:coverage:ci
```

---

## Getting Help

- 📖 [Documentation](https://docs.g-rump.com)
- 🐛 [Issue Tracker](https://github.com/Aphrodine-wq/GRUMPCO/issues)
- 💬 [Discussions](https://github.com/Aphrodine-wq/GRUMPCO/discussions)

---

Made with ❤️ by the G-Rump Team



# @grump/utils

Shared utility functions for G-Rump packages to eliminate code duplication and ensure consistency.

## Installation

```bash
pnpm add @grump/utils
```

## Features

### Error Classes

A hierarchy of error classes for consistent error handling:

```typescript
import { 
  GrumpError, 
  NotFoundError, 
  ValidationError,
  RateLimitError,
  TimeoutError 
} from '@grump/utils';

// Base error with context
throw new GrumpError('Operation failed', {
  code: 'CUSTOM_ERROR',
  statusCode: 500,
  retryable: true,
  context: { operation: 'sync' }
});

// Resource not found
throw new NotFoundError('User', userId);

// Validation errors
throw new ValidationError('Invalid input', {
  field: 'email',
  errors: { email: ['Invalid format'] }
});

// Rate limiting
throw new RateLimitError('Too many requests', { retryAfter: 60 });
```

### Error Utilities

```typescript
import { getErrorMessage, isGrumpError, wrapError } from '@grump/utils';

// Safely extract message from unknown error
const message = getErrorMessage(error);

// Type guard
if (isGrumpError(error)) {
  console.log(error.code, error.retryable);
}

// Wrap unknown errors
const wrapped = wrapError(error, 'Fallback message');
```

### ID Generation

```typescript
import { generateId, generateSessionId } from '@grump/utils/id';

const id = generateId('user');  // user_1704067200000_abc123
const sessionId = generateSessionId();  // sess_1704067200000_xyz789
```

### Retry Logic

```typescript
import { retry, withTimeout } from '@grump/utils/retry';

// Retry with exponential backoff
const result = await retry(
  () => fetchData(),
  { maxRetries: 3, backoffMs: 1000 }
);

// Add timeout to any async operation
const data = await withTimeout(
  fetchData(),
  5000,
  'Data fetch timed out'
);
```

### Validation

```typescript
import { assertDefined, assertString, isNonEmptyString } from '@grump/utils/validation';

assertDefined(value, 'Value is required');
assertString(input, 'Input must be a string');

if (isNonEmptyString(name)) {
  // TypeScript knows name is string
}
```

## Error Classes Reference

| Class | HTTP Status | Use Case |
|-------|-------------|----------|
| `GrumpError` | - | Base class for all errors |
| `NotFoundError` | 404 | Resource not found |
| `ValidationError` | 400 | Input validation failed |
| `ModelNotFoundError` | 404 | AI model not available |
| `RateLimitError` | 429 | Rate limit exceeded |
| `AuthenticationError` | 401 | Auth required |
| `AuthorizationError` | 403 | Permission denied |
| `TimeoutError` | 408 | Operation timed out |
| `ConfigurationError` | 500 | Invalid config |

## API Reference

See the TypeScript definitions for complete API documentation.

## License

MIT

# TypeScript Best Practices for G-Rump

**Internal Guide - Type Safety Standards**

---

## 1. Type Safety Rules

### ❌ Never Use `any`

```typescript
// ❌ Bad - No type safety
function process(data: any): any {
  return data.value;
}

// ✅ Good - Fully typed
interface ProcessData {
  value: string;
  metadata?: Record<string, unknown>;
}

function process(data: ProcessData): string {
  return data.value;
}
```

### ✅ Use `unknown` for Unknown Data

```typescript
// ❌ Bad - Implicit any
function parseInput(input: any) {
  return JSON.parse(input);
}

// ✅ Good - Explicit unknown
function parseInput(input: unknown): unknown {
  if (typeof input === 'string') {
    return JSON.parse(input);
  }
  throw new Error('Input must be a string');
}
```

---

## 2. Function Types

### Always Use Explicit Return Types

```typescript
// ❌ Bad - Inferred return type
async function fetchUser(id: string) {
  const res = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return res[0];
}

// ✅ Good - Explicit return type
interface User {
  id: string;
  email: string;
  name: string;
}

async function fetchUser(id: string): Promise<User | null> {
  const res = await db.query<User[]>('SELECT * FROM users WHERE id = ?', [id]);
  return res[0] ?? null;
}
```

### Type Async Functions Properly

```typescript
// ❌ Bad - Missing Promise wrapper
function delay(ms: number): void {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ Good - Proper Promise type
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 3. Error Handling Types

### Proper Error Typing

```typescript
// ❌ Bad - Catching as any
try {
  await riskyOperation();
} catch (err: any) {
  console.error(err.message);
}

// ✅ Good - Using unknown
try {
  await riskyOperation();
} catch (err: unknown) {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error('Unknown error:', err);
  }
}
```

### Custom Error Classes

```typescript
// ✅ Good - Typed error hierarchy
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Usage
function handleError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    return err;
  }
  return new ApiError(ErrorCode.INTERNAL_ERROR, 'Unknown error', 500);
}
```

---

## 4. API Types

### Request/Response Types

```typescript
// ✅ Good - Separate types for request/response
export interface CreateUserRequest {
  email: string;
  password: string;
  name?: string;
}

export interface CreateUserResponse {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

// API function with typed request/response
export async function createUser(
  data: CreateUserRequest
): Promise<CreateUserResponse> {
  const res = await fetchApi('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Failed to create user', res.status);
  }
  
  return res.json();
}
```

### Type Guards

```typescript
// ✅ Good - Type guard for runtime validation
function isValidUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data &&
    typeof (data as User).id === 'string' &&
    typeof (data as User).email === 'string'
  );
}

// Usage
const response = await fetchUser('123');
if (isValidUser(response)) {
  // TypeScript knows this is User
  console.log(response.email);
}
```

---

## 5. Generic Types

### Use Generics for Reusable Code

```typescript
// ✅ Good - Generic cache implementation
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  
  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      data: value,
      expiresAt: Date.now() + ttlMs,
    });
  }
  
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }
}

// Usage with specific types
const userCache = new Cache<User>();
userCache.set('user:1', userData, 60000);
```

---

## 6. Utility Types

### Use TypeScript Utility Types

```typescript
// ✅ Good - Using built-in utilities
interface User {
  id: string;
  email: string;
  name: string;
  password: string; // Sensitive field
  createdAt: Date;
}

// Pick specific fields
type UserPublic = Pick<User, 'id' | 'email' | 'name'>;

// Omit sensitive fields
type UserSafe = Omit<User, 'password'>;

// Partial for updates
type UserUpdate = Partial<UserSafe>;

// Readonly for immutable data
type ImmutableUser = Readonly<User>;

// Record for key-value maps
type UserMap = Record<string, User>;

// Usage
function updateUser(id: string, updates: UserUpdate): Promise<User> {
  // Only allowed to update non-sensitive fields
  return db.update(id, updates);
}
```

---

## 7. Zod Schema Integration

### Validate at Runtime with Zod

```typescript
import { z } from 'zod';

// ✅ Good - Zod schema with TypeScript inference
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).optional(),
  role: z.enum(['user', 'admin']),
});

// Infer TypeScript type from schema
type User = z.infer<typeof UserSchema>;

// Runtime validation
function parseUser(data: unknown): User {
  return UserSchema.parse(data);
}

// Safe parsing with error handling
function safeParseUser(data: unknown): User | null {
  const result = UserSchema.safeParse(data);
  return result.success ? result.data : null;
}
```

---

## 8. Environment Variables

### Type-Safe Environment

```typescript
// ✅ Good - Validated env with Zod
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(32),
  ENABLE_CACHE: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

// Now env is fully typed
// env.NODE_ENV is 'development' | 'production' | 'test'
// env.PORT is number
```

---

## 9. Store Types (Svelte)

### Typed Stores

```typescript
import { writable, derived } from 'svelte/store';

// ✅ Good - Typed writable store
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    loading: false,
    error: null,
  });

  return {
    subscribe,
    setUser: (user: User) => update(s => ({ ...s, user, error: null })),
    setLoading: (loading: boolean) => update(s => ({ ...s, loading })),
    setError: (error: string) => update(s => ({ ...s, error, loading: false })),
    reset: () => set({ user: null, loading: false, error: null }),
  };
}

export const auth = createAuthStore();

// ✅ Good - Typed derived store
export const isAuthenticated = derived(
  auth,
  $auth => $auth.user !== null && !$auth.loading
);
```

---

## 10. Common Patterns

### Nullable Handling

```typescript
// ❌ Bad - Risky null assertion
function getUserName(user: User | null): string {
  return user!.name; // Runtime error if null
}

// ✅ Good - Safe null handling
function getUserName(user: User | null): string {
  return user?.name ?? 'Anonymous';
}

// ✅ Good - Early return pattern
function processUser(user: User | null): void {
  if (!user) {
    console.log('No user');
    return;
  }
  
  // TypeScript knows user is not null here
  console.log(user.name);
}
```

### Array Operations

```typescript
// ✅ Good - Typed array operations
const users: User[] = await fetchUsers();

// Map with proper types
const emails = users.map(user => user.email); // string[]

// Filter with type guard
const admins = users.filter((user): user is AdminUser => 
  user.role === 'admin'
);

// Reduce with accumulator type
const userMap = users.reduce<Record<string, User>>(
  (acc, user) => ({ ...acc, [user.id]: user }),
  {}
);
```

---

## Quick Reference

| Pattern | ✅ Do | ❌ Don't |
|---------|-------|----------|
| Unknown data | Use `unknown` | Use `any` |
| Functions | Explicit return types | Implicit return types |
| Errors | Use `unknown` in catch | Use `any` in catch |
| Nullables | Use `??` operator | Use `!` assertion |
| APIs | Define request/response types | Use `any` for API data |
| Generics | Use for reusable code | Copy-paste similar code |
| Validation | Use Zod schemas | Manual type checking |

---

## ESLint Rules

Enable these rules in your ESLint config:

```javascript
{
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/explicit-function-return-type': 'warn',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
}
```

---

**Last Updated:** 2026-01-30

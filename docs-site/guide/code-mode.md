# Code Mode

Code Mode is G-Rump's interactive coding environment where AI assists you in writing, modifying, and refactoring code.

## Overview

Code Mode provides:

- Context-aware code generation
- Intelligent code completion
- Refactoring assistance
- Test generation
- Code explanation

## Entering Code Mode

### CLI

```bash
# Start interactive code mode
grump code

# Code mode with specific file
grump code src/services/auth.ts

# Code mode with context
grump code --context src/services/
```

### Desktop App

Click the **Code** tab or press `Cmd/Ctrl + 3`.

## Core Features

### Code Generation

Describe what you want, G-Rump writes the code:

```
You: Create a rate limiter middleware that allows 100 requests per minute per IP

G-Rump generates:
```

```typescript
// src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

const redis = new Redis(process.env.REDIS_URL);

export function rateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = config;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    
    try {
      const current = await redis.incr(key);
      
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }
      
      const ttl = await redis.pttl(key);
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + ttl);
      
      if (current > maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(ttl / 1000)
        });
      }
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      next(); // Fail open
    }
  };
}

// Usage
export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100
});
```

### Context-Aware Suggestions

G-Rump understands your codebase:

```
You: Add a method to UserService that finds users by email domain

G-Rump analyzes:
- Existing UserService class structure
- Repository patterns in use
- Error handling conventions
- Naming conventions

Generates:
```

```typescript
// Added to src/services/user.service.ts

/**
 * Find all users with emails from a specific domain
 * @param domain - Email domain (e.g., "company.com")
 * @returns Array of users matching the domain
 */
async findByEmailDomain(domain: string): Promise<User[]> {
  if (!domain || !domain.includes('.')) {
    throw new ValidationError('Invalid email domain');
  }
  
  const normalizedDomain = domain.toLowerCase().trim();
  
  return this.userRepository.findMany({
    where: {
      email: {
        endsWith: `@${normalizedDomain}`
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}
```

### Code Modification

Modify existing code with natural language:

```
You: Add input validation to the createUser function

Before:
```

```typescript
async createUser(data: CreateUserDto) {
  const user = await this.userRepository.create(data);
  return user;
}
```

```
After (G-Rump modified):
```

```typescript
async createUser(data: CreateUserDto) {
  // Validate email format
  if (!this.isValidEmail(data.email)) {
    throw new ValidationError('Invalid email format');
  }
  
  // Check for existing user
  const existing = await this.userRepository.findByEmail(data.email);
  if (existing) {
    throw new ConflictError('User with this email already exists');
  }
  
  // Validate password strength
  if (!this.isStrongPassword(data.password)) {
    throw new ValidationError(
      'Password must be at least 8 characters with uppercase, lowercase, and number'
    );
  }
  
  // Hash password before storage
  const hashedPassword = await this.hashPassword(data.password);
  
  const user = await this.userRepository.create({
    ...data,
    password: hashedPassword
  });
  
  return this.sanitizeUser(user);
}
```

### Refactoring

Improve code structure:

```
You: Refactor this to use the strategy pattern

Before:
```

```typescript
function calculatePrice(type: string, basePrice: number) {
  if (type === 'premium') {
    return basePrice * 0.8;
  } else if (type === 'business') {
    return basePrice * 0.7;
  } else if (type === 'enterprise') {
    return basePrice * 0.5;
  }
  return basePrice;
}
```

```
After (G-Rump refactored):
```

```typescript
// Pricing strategies
interface PricingStrategy {
  calculate(basePrice: number): number;
}

class StandardPricing implements PricingStrategy {
  calculate(basePrice: number): number {
    return basePrice;
  }
}

class PremiumPricing implements PricingStrategy {
  private readonly discount = 0.2;
  
  calculate(basePrice: number): number {
    return basePrice * (1 - this.discount);
  }
}

class BusinessPricing implements PricingStrategy {
  private readonly discount = 0.3;
  
  calculate(basePrice: number): number {
    return basePrice * (1 - this.discount);
  }
}

class EnterprisePricing implements PricingStrategy {
  private readonly discount = 0.5;
  
  calculate(basePrice: number): number {
    return basePrice * (1 - this.discount);
  }
}

// Strategy registry
const pricingStrategies: Record<string, PricingStrategy> = {
  standard: new StandardPricing(),
  premium: new PremiumPricing(),
  business: new BusinessPricing(),
  enterprise: new EnterprisePricing()
};

function calculatePrice(type: string, basePrice: number): number {
  const strategy = pricingStrategies[type] || pricingStrategies.standard;
  return strategy.calculate(basePrice);
}
```

### Test Generation

Generate comprehensive tests:

```
You: Write tests for the rate limiter middleware

G-Rump generates:
```

```typescript
// tests/middleware/rateLimiter.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { rateLimiter } from '../../src/middleware/rateLimiter';

// Mock Redis
vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    incr: vi.fn(),
    pexpire: vi.fn(),
    pttl: vi.fn()
  }))
}));

describe('rateLimiter', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: vi.Mock;
  
  beforeEach(() => {
    mockReq = { ip: '127.0.0.1' };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    };
    nextFn = vi.fn();
  });
  
  it('should allow requests under the limit', async () => {
    const middleware = rateLimiter({ windowMs: 60000, maxRequests: 100 });
    
    // Mock Redis to return count under limit
    const redis = require('ioredis').default();
    redis.incr.mockResolvedValue(50);
    redis.pttl.mockResolvedValue(30000);
    
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    
    expect(nextFn).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 50);
  });
  
  it('should block requests over the limit', async () => {
    const middleware = rateLimiter({ windowMs: 60000, maxRequests: 100 });
    
    const redis = require('ioredis').default();
    redis.incr.mockResolvedValue(101);
    redis.pttl.mockResolvedValue(30000);
    
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Too many requests' })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });
  
  it('should set TTL on first request', async () => {
    const middleware = rateLimiter({ windowMs: 60000, maxRequests: 100 });
    
    const redis = require('ioredis').default();
    redis.incr.mockResolvedValue(1); // First request
    redis.pttl.mockResolvedValue(60000);
    
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    
    expect(redis.pexpire).toHaveBeenCalled();
  });
  
  it('should fail open on Redis error', async () => {
    const middleware = rateLimiter({ windowMs: 60000, maxRequests: 100 });
    
    const redis = require('ioredis').default();
    redis.incr.mockRejectedValue(new Error('Redis connection failed'));
    
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    
    expect(nextFn).toHaveBeenCalled(); // Should continue despite error
  });
});
```

### Code Explanation

Understand unfamiliar code:

```
You: Explain this code

Code:
const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

G-Rump explains:

This is a TypeScript debounce function that delays executing a function
until after a specified time has passed since the last call.

## How it works:

1. **Generic Type `T`**: Accepts any function type
2. **Parameters**:
   - `fn`: The function to debounce
   - `delay`: Milliseconds to wait
3. **Closure**: Uses `timeoutId` to track the pending timeout
4. **Returned Function**:
   - Clears any existing timeout (cancels pending execution)
   - Sets a new timeout to execute `fn` after `delay` ms

## Use Case:
Commonly used for search inputs - only searches after user stops typing:

```typescript
const search = debounce((query: string) => {
  api.search(query);
}, 300);

input.addEventListener('input', (e) => search(e.target.value));
```
```

## Configuration

### Code Style

```json
// .grumprc.json
{
  "codeMode": {
    "language": "typescript",
    "style": {
      "quotes": "single",
      "semicolons": true,
      "tabWidth": 2,
      "trailingComma": "es5"
    },
    "patterns": {
      "preferFunctional": true,
      "useAsyncAwait": true,
      "errorHandling": "exceptions"
    }
  }
}
```

### Context Settings

```json
{
  "codeMode": {
    "context": {
      "includePatterns": ["src/**/*.ts"],
      "excludePatterns": ["**/*.test.ts", "**/node_modules/**"],
      "maxContextFiles": 20
    }
  }
}
```

## Keyboard Shortcuts (Desktop)

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Execute current prompt |
| `Cmd/Ctrl + K` | Quick code action |
| `Cmd/Ctrl + L` | Clear conversation |
| `Cmd/Ctrl + /` | Toggle comment |
| `Cmd/Ctrl + D` | Explain selected code |
| `Cmd/Ctrl + R` | Refactor selected code |

## Best Practices

1. **Be specific** - "Add null check" vs "Add null check for user.email in line 45"
2. **Provide context** - Mention related files or patterns
3. **Iterate** - Start simple, refine with follow-up requests
4. **Review generated code** - Always verify before committing
5. **Use file references** - "Like we did in userService.ts"

## Next Steps

- [Architecture Mode](/guide/architecture-mode) - Design before coding
- [Multi-Agent System](/guide/agents) - How agents collaborate
- [API Reference](/api/codegen) - Codegen API endpoints

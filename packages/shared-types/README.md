# @grump/shared-types

Shared TypeScript type definitions for the G-Rump monorepo.

## Installation

```bash
npm install @grump/shared-types
```

## Usage

### Import Types

```typescript
// Backend
import type { ShipSession, Plan, SpecSession } from '@grump/shared-types';

// Frontend
import type { User, AgentTask, PRD } from '@grump/shared-types';
```

## Available Types

### Architecture

Types for C4 architecture diagrams and system design:

```typescript
import type {
  C4Level,
  ProjectType,
  Complexity,
  Component,
  Integration,
  SystemArchitecture,
} from '@grump/shared-types';
```

### Product Requirements (PRD)

```typescript
import type {
  Persona,
  Feature,
  UserStory,
  PRD,
} from '@grump/shared-types';
```

### Specification

```typescript
import type {
  SpecStatus,
  SpecQuestion,
  Requirement,
  Specification,
  SpecSession,
} from '@grump/shared-types';
```

### Planning

```typescript
import type {
  PlanStatus,
  PlanPhase,
  RiskLevel,
  FileChange,
  Plan,
} from '@grump/shared-types';
```

### Agents

```typescript
import type {
  AgentType,
  AgentStatus,
  AgentMessage,
  AgentTask,
  GenerationSession,
} from '@grump/shared-types';
```

### Ship Mode

```typescript
import type {
  ShipPhase,
  ShipPreferences,
  ShipSession,
  ShipStartRequest,
  ShipStreamEvent,
} from '@grump/shared-types';
```

### Clarification

```typescript
import type {
  ClarificationQuestion,
  ClarificationAnswer,
  ClarificationResponse,
} from '@grump/shared-types';
```

## Type Hierarchy

```
Architecture
├── C4Level
├── ProjectType
├── Complexity
├── Component
├── Integration
├── DataModel
└── SystemArchitecture

PRD
├── Persona
├── Feature
├── UserStory
├── APIEndpointSpec
└── PRD

Specification
├── SpecStatus
├── SpecQuestion
├── Requirement
├── TechnicalSpec
└── Specification

Planning
├── PlanStatus
├── PlanPhase
├── RiskLevel
├── FileChange
└── Plan

Agents
├── AgentType
├── AgentStatus
├── AgentMessage
├── AgentTask
└── GenerationSession
```

## Best Practices

### 1. Use Type Imports

```typescript
// ✅ Good - Type-only import
import type { User } from '@grump/shared-types';

// ❌ Bad - Value import (unnecessary)
import { User } from '@grump/shared-types';
```

### 2. Extend Types When Needed

```typescript
import type { User } from '@grump/shared-types';

// Extend for backend-specific needs
interface UserWithMetadata extends User {
  metadata: Record<string, unknown>;
  createdAt: Date;
}
```

### 3. Use in API Contracts

```typescript
import type { ShipSession } from '@grump/shared-types';

// Frontend
async function startShip(data: ShipStartRequest): Promise<ShipSession> {
  const res = await fetch('/api/ship/start', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

// Backend
app.post('/api/ship/start', async (req, res) => {
  const data: ShipStartRequest = req.body;
  const session: ShipSession = await createShipSession(data);
  res.json(session);
});
```

## Adding New Types

1. Create type definition in `src/<category>.ts`
2. Export from `src/index.ts`
3. Add JSDoc comments
4. Update this README

### Example

```typescript
// src/payments.ts
/**
 * Payment method types supported
 */
export type PaymentMethod = 'card' | 'paypal' | 'crypto';

/**
 * Payment transaction record
 */
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}
```

```typescript
// src/index.ts
export type {
  Payment,
  PaymentMethod,
} from './payments.js';
```

## Type Safety Guidelines

- All types should be strict (no `any`)
- Use `unknown` for dynamic data
- Prefer interfaces over type aliases for objects
- Use enums only for string literal unions
- Document all public types with JSDoc

## Versioning

This package follows semantic versioning:

- **Major**: Breaking type changes
- **Minor**: New types added
- **Patch**: Type fixes/improvements

## Contributing

When adding types:
1. Ensure they're used in both frontend and backend
2. Add comprehensive JSDoc
3. Export from index.ts
4. Update documentation

---

**Part of the G-Rump Monorepo**

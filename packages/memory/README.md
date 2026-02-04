# @grump/memory

Long-term memory management for G-Rump. Provides persistent memory storage, retrieval, and summarization for personalized AI interactions.

## Installation

```bash
pnpm add @grump/memory
```

## Features

- **Persistent Memory** - Store and retrieve user interactions, preferences, and facts
- **Memory Types** - Categorize memories (interaction, correction, preference, fact, context, feedback)
- **Priority System** - Low, medium, high, and critical priority levels
- **Auto-Expiration** - TTL-based memory cleanup
- **Query System** - Search, filter, and paginate memories
- **Context Building** - Generate LLM context from relevant memories
- **GDPR Compliance** - Easy user data deletion

## Quick Start

```typescript
import { MemoryManager, InMemoryStore, MemoryContextBuilder } from '@grump/memory';

// Create manager (in-memory for development)
const manager = new MemoryManager({
  store: new InMemoryStore(),
  maxMemoriesPerUser: 1000,
  defaultTTL: 86400 * 30, // 30 days
});

// Store a memory
await manager.remember('user123', 'preference', 'User prefers TypeScript over JavaScript', {
  priority: 'high',
  metadata: { source: 'explicit' }
});

// Recall memories
const memories = await manager.recall({
  userId: 'user123',
  types: ['preference', 'fact'],
  limit: 10,
});

// Build context for LLM
const contextBuilder = new MemoryContextBuilder(manager);
const context = await contextBuilder.buildContext(
  'user123',
  'current conversation topic',
  { maxTokens: 1000 }
);
```

## Memory Types

| Type | Description |
|------|-------------|
| `interaction` | User interaction history |
| `correction` | User corrections to AI responses |
| `preference` | User preferences and settings |
| `fact` | Learned facts about user/project |
| `context` | Contextual information |
| `feedback` | User feedback on responses |

## API Reference

### MemoryManager

```typescript
interface MemoryManager {
  // Store a new memory
  remember(userId: string, type: MemoryType, content: string, options?: {
    priority?: MemoryPriority;
    metadata?: Record<string, unknown>;
    ttl?: number;
  }): Promise<MemoryRecord>;

  // Query memories
  recall(query: MemoryQuery): Promise<MemoryRecord[]>;

  // Find relevant memories for context
  recallRelevant(userId: string, context: string, options?: {
    types?: MemoryType[];
    limit?: number;
  }): Promise<MemoryRecord[]>;

  // Delete a specific memory
  forget(id: string): Promise<boolean>;

  // Delete all memories for a user (GDPR)
  forgetUser(userId: string): Promise<number>;

  // Get statistics
  getStats(userId: string): Promise<MemoryStats>;

  // Cleanup expired memories
  cleanup(): Promise<number>;
}
```

### MemoryQuery

```typescript
interface MemoryQuery {
  userId: string;
  types?: MemoryType[];
  priority?: MemoryPriority[];
  search?: string;
  limit?: number;
  offset?: number;
  includeExpired?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
}
```

### IMemoryStore Interface

Implement this interface for custom storage backends (e.g., Redis, PostgreSQL):

```typescript
interface IMemoryStore {
  store(record: Omit<MemoryRecord, 'id' | 'createdAt'>): Promise<MemoryRecord>;
  get(id: string): Promise<MemoryRecord | null>;
  query(query: MemoryQuery): Promise<MemoryRecord[]>;
  update(id: string, updates: Partial<MemoryRecord>): Promise<MemoryRecord | null>;
  delete(id: string): Promise<boolean>;
  deleteByUser(userId: string): Promise<number>;
  getStats(userId: string): Promise<MemoryStats>;
  cleanupExpired(): Promise<number>;
}
```

## Factory Functions

```typescript
import { createInMemoryManager } from '@grump/memory';

// Quick setup for development
const manager = createInMemoryManager({
  maxMemoriesPerUser: 500,
  defaultTTL: 86400 * 7, // 7 days
  summarizer: async (content) => {
    // Optional: use LLM to summarize long content
    return content.slice(0, 200) + '...';
  }
});
```

## License

MIT

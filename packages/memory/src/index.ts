/**
 * @grump/memory - Long-term memory management for G-Rump.
 * Provides persistent memory storage, retrieval, and summarization.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type MemoryType =
  | 'interaction'  // User interaction history
  | 'correction'   // User corrections to AI responses
  | 'preference'   // User preferences and settings
  | 'fact'         // Learned facts about the user/project
  | 'context'      // Contextual information
  | 'feedback';    // User feedback on responses

export type MemoryPriority = 'low' | 'medium' | 'high' | 'critical';

export interface MemoryRecord {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  priority?: MemoryPriority;
  embedding?: number[];
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  accessCount?: number;
  lastAccessedAt?: string;
}

export interface MemoryQuery {
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

export interface MemoryStats {
  totalRecords: number;
  byType: Record<MemoryType, number>;
  byPriority: Record<MemoryPriority, number>;
  oldestRecord?: string;
  newestRecord?: string;
  averageAccessCount: number;
}

// ============================================================================
// Memory Store Interface
// ============================================================================

export interface IMemoryStore {
  /** Store a new memory */
  store(record: Omit<MemoryRecord, 'id' | 'createdAt'>): Promise<MemoryRecord>;

  /** Retrieve a memory by ID */
  get(id: string): Promise<MemoryRecord | null>;

  /** Query memories */
  query(query: MemoryQuery): Promise<MemoryRecord[]>;

  /** Update a memory */
  update(id: string, updates: Partial<MemoryRecord>): Promise<MemoryRecord | null>;

  /** Delete a memory */
  delete(id: string): Promise<boolean>;

  /** Delete all memories for a user */
  deleteByUser(userId: string): Promise<number>;

  /** Get memory statistics */
  getStats(userId: string): Promise<MemoryStats>;

  /** Clean up expired memories */
  cleanupExpired(): Promise<number>;
}

// ============================================================================
// In-Memory Store Implementation
// ============================================================================

/**
 * Simple in-memory store for development and testing.
 */
export class InMemoryStore implements IMemoryStore {
  private records: Map<string, MemoryRecord> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();

  async store(record: Omit<MemoryRecord, 'id' | 'createdAt'>): Promise<MemoryRecord> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const fullRecord: MemoryRecord = {
      ...record,
      id,
      createdAt: now,
      accessCount: 0,
    };

    this.records.set(id, fullRecord);

    // Update user index
    if (!this.userIndex.has(record.userId)) {
      this.userIndex.set(record.userId, new Set());
    }
    this.userIndex.get(record.userId)!.add(id);

    return fullRecord;
  }

  async get(id: string): Promise<MemoryRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;

    // Update access tracking
    record.accessCount = (record.accessCount || 0) + 1;
    record.lastAccessedAt = new Date().toISOString();

    return { ...record };
  }

  async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    const userRecordIds = this.userIndex.get(query.userId);
    if (!userRecordIds) return [];

    let results: MemoryRecord[] = [];

    for (const id of userRecordIds) {
      const record = this.records.get(id);
      if (!record) continue;

      // Check expiration
      if (!query.includeExpired && record.expiresAt) {
        if (new Date(record.expiresAt) < new Date()) continue;
      }

      // Filter by type
      if (query.types && !query.types.includes(record.type)) continue;

      // Filter by priority
      if (query.priority && record.priority && !query.priority.includes(record.priority)) continue;

      // Search in content/summary
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        const inContent = record.content.toLowerCase().includes(searchLower);
        const inSummary = record.summary?.toLowerCase().includes(searchLower);
        if (!inContent && !inSummary) continue;
      }

      results.push({ ...record });
    }

    // Sort
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    results.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortBy) {
        case 'accessCount':
          aVal = a.accessCount || 0;
          bVal = b.accessCount || 0;
          break;
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          aVal = priorityOrder[a.priority || 'medium'];
          bVal = priorityOrder[b.priority || 'medium'];
          break;
        case 'updatedAt':
          aVal = a.updatedAt || a.createdAt;
          bVal = b.updatedAt || b.createdAt;
          break;
        default:
          aVal = a.createdAt;
          bVal = b.createdAt;
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    return results.slice(offset, offset + limit);
  }

  async update(id: string, updates: Partial<MemoryRecord>): Promise<MemoryRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;

    const updated: MemoryRecord = {
      ...record,
      ...updates,
      id: record.id, // Prevent ID change
      createdAt: record.createdAt, // Prevent creation date change
      updatedAt: new Date().toISOString(),
    };

    this.records.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const record = this.records.get(id);
    if (!record) return false;

    this.records.delete(id);
    this.userIndex.get(record.userId)?.delete(id);
    return true;
  }

  async deleteByUser(userId: string): Promise<number> {
    const ids = this.userIndex.get(userId);
    if (!ids) return 0;

    const count = ids.size;
    for (const id of ids) {
      this.records.delete(id);
    }
    this.userIndex.delete(userId);
    return count;
  }

  async getStats(userId: string): Promise<MemoryStats> {
    const ids = this.userIndex.get(userId);
    if (!ids || ids.size === 0) {
      return {
        totalRecords: 0,
        byType: { interaction: 0, correction: 0, preference: 0, fact: 0, context: 0, feedback: 0 },
        byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
        averageAccessCount: 0,
      };
    }

    const byType: Record<MemoryType, number> = {
      interaction: 0,
      correction: 0,
      preference: 0,
      fact: 0,
      context: 0,
      feedback: 0,
    };
    const byPriority: Record<MemoryPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let oldest: string | undefined;
    let newest: string | undefined;
    let totalAccess = 0;

    for (const id of ids) {
      const record = this.records.get(id);
      if (!record) continue;

      byType[record.type]++;
      byPriority[record.priority || 'medium']++;
      totalAccess += record.accessCount || 0;

      if (!oldest || record.createdAt < oldest) oldest = record.createdAt;
      if (!newest || record.createdAt > newest) newest = record.createdAt;
    }

    return {
      totalRecords: ids.size,
      byType,
      byPriority,
      oldestRecord: oldest,
      newestRecord: newest,
      averageAccessCount: totalAccess / ids.size,
    };
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [id, record] of this.records) {
      if (record.expiresAt && new Date(record.expiresAt) < now) {
        this.records.delete(id);
        this.userIndex.get(record.userId)?.delete(id);
        count++;
      }
    }

    return count;
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ============================================================================
// Memory Manager
// ============================================================================

export interface MemoryManagerOptions {
  store: IMemoryStore;
  /** Maximum memories per user */
  maxMemoriesPerUser?: number;
  /** Default TTL for memories in seconds */
  defaultTTL?: number;
  /** Summarization function for long content */
  summarizer?: (content: string) => Promise<string>;
}

/**
 * High-level memory management with automatic cleanup and summarization.
 */
export class MemoryManager {
  private store: IMemoryStore;
  private maxMemoriesPerUser: number;
  private defaultTTL?: number;
  private summarizer?: (content: string) => Promise<string>;

  constructor(options: MemoryManagerOptions) {
    this.store = options.store;
    this.maxMemoriesPerUser = options.maxMemoriesPerUser ?? 1000;
    this.defaultTTL = options.defaultTTL;
    this.summarizer = options.summarizer;
  }

  /**
   * Remember something about a user.
   */
  async remember(
    userId: string,
    type: MemoryType,
    content: string,
    options?: {
      priority?: MemoryPriority;
      metadata?: Record<string, unknown>;
      ttl?: number;
    }
  ): Promise<MemoryRecord> {
    // Auto-summarize long content
    let summary: string | undefined;
    if (this.summarizer && content.length > 500) {
      summary = await this.summarizer(content);
    }

    // Calculate expiration
    let expiresAt: string | undefined;
    const ttl = options?.ttl ?? this.defaultTTL;
    if (ttl) {
      expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    }

    const record = await this.store.store({
      userId,
      type,
      content,
      summary,
      priority: options?.priority ?? 'medium',
      metadata: options?.metadata,
      expiresAt,
    });

    // Enforce memory limit
    await this.enforceLimit(userId);

    return record;
  }

  /**
   * Recall memories matching a query.
   */
  async recall(query: MemoryQuery): Promise<MemoryRecord[]> {
    return this.store.query(query);
  }

  /**
   * Recall relevant memories for a given context.
   */
  async recallRelevant(
    userId: string,
    context: string,
    options?: { types?: MemoryType[]; limit?: number }
  ): Promise<MemoryRecord[]> {
    // Simple keyword-based relevance (would use embeddings in production)
    return this.store.query({
      userId,
      types: options?.types,
      search: context,
      limit: options?.limit ?? 10,
      sortBy: 'accessCount',
      sortOrder: 'desc',
    });
  }

  /**
   * Forget a specific memory.
   */
  async forget(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * Forget all memories of a specific type for a user.
   */
  async forgetByType(userId: string, type: MemoryType): Promise<number> {
    const memories = await this.store.query({ userId, types: [type], limit: 10000 });
    let count = 0;
    for (const memory of memories) {
      if (await this.store.delete(memory.id)) count++;
    }
    return count;
  }

  /**
   * Forget all memories for a user (GDPR compliance).
   */
  async forgetUser(userId: string): Promise<number> {
    return this.store.deleteByUser(userId);
  }

  /**
   * Update a memory's priority.
   */
  async updatePriority(id: string, priority: MemoryPriority): Promise<boolean> {
    const result = await this.store.update(id, { priority });
    return result !== null;
  }

  /**
   * Get memory statistics.
   */
  async getStats(userId: string): Promise<MemoryStats> {
    return this.store.getStats(userId);
  }

  /**
   * Run cleanup of expired memories.
   */
  async cleanup(): Promise<number> {
    return this.store.cleanupExpired();
  }

  private async enforceLimit(userId: string): Promise<void> {
    const stats = await this.store.getStats(userId);
    if (stats.totalRecords <= this.maxMemoriesPerUser) return;

    // Delete oldest low-priority memories first
    const toDelete = stats.totalRecords - this.maxMemoriesPerUser;
    const oldMemories = await this.store.query({
      userId,
      priority: ['low'],
      sortBy: 'createdAt',
      sortOrder: 'asc',
      limit: toDelete,
    });

    for (const memory of oldMemories) {
      await this.store.delete(memory.id);
    }
  }
}

// ============================================================================
// Memory Context Builder
// ============================================================================

/**
 * Builds context from memories for LLM prompts.
 */
export class MemoryContextBuilder {
  private manager: MemoryManager;

  constructor(manager: MemoryManager) {
    this.manager = manager;
  }

  /**
   * Build a context string from relevant memories.
   */
  async buildContext(
    userId: string,
    currentContext: string,
    options?: {
      maxTokens?: number;
      includeTypes?: MemoryType[];
    }
  ): Promise<string> {
    const memories = await this.manager.recallRelevant(userId, currentContext, {
      types: options?.includeTypes,
      limit: 20,
    });

    if (memories.length === 0) return '';

    const sections: string[] = [];
    let tokenEstimate = 0;
    const maxTokens = options?.maxTokens ?? 1000;

    // Group by type
    const byType = new Map<MemoryType, MemoryRecord[]>();
    for (const memory of memories) {
      if (!byType.has(memory.type)) byType.set(memory.type, []);
      byType.get(memory.type)!.push(memory);
    }

    // Build context by type
    const typeLabels: Record<MemoryType, string> = {
      preference: 'User Preferences',
      correction: 'Previous Corrections',
      fact: 'Known Facts',
      interaction: 'Recent Interactions',
      context: 'Contextual Information',
      feedback: 'User Feedback',
    };

    for (const [type, records] of byType) {
      const label = typeLabels[type];
      const items: string[] = [];

      for (const record of records) {
        const text = record.summary || record.content;
        const estimatedTokens = text.length / 4;

        if (tokenEstimate + estimatedTokens > maxTokens) break;

        items.push(`- ${text}`);
        tokenEstimate += estimatedTokens;
      }

      if (items.length > 0) {
        sections.push(`## ${label}\n${items.join('\n')}`);
      }
    }

    return sections.join('\n\n');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an in-memory manager for development.
 */
export function createInMemoryManager(
  options?: Omit<MemoryManagerOptions, 'store'>
): MemoryManager {
  return new MemoryManager({
    ...options,
    store: new InMemoryStore(),
  });
}

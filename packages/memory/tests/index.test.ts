/**
 * @grump/memory - Test Suite
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InMemoryStore,
  MemoryManager,
  MemoryContextBuilder,
  createInMemoryManager,
  type MemoryRecord,
  type MemoryType,
  type MemoryPriority,
} from '../src/index.js';

// ============================================================================
// InMemoryStore Tests
// ============================================================================

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('store()', () => {
    it('should store a memory record and return it with id and createdAt', async () => {
      const record = await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'User prefers dark mode',
        priority: 'high',
      });

      expect(record.id).toMatch(/^mem_\d+_/);
      expect(record.userId).toBe('user-1');
      expect(record.type).toBe('fact');
      expect(record.content).toBe('User prefers dark mode');
      expect(record.priority).toBe('high');
      expect(record.createdAt).toBeDefined();
      expect(record.accessCount).toBe(0);
    });

    it('should store multiple records for different users', async () => {
      await store.store({ userId: 'user-1', type: 'fact', content: 'Fact 1' });
      await store.store({ userId: 'user-2', type: 'fact', content: 'Fact 2' });
      await store.store({ userId: 'user-1', type: 'preference', content: 'Pref 1' });

      const user1Records = await store.query({ userId: 'user-1' });
      const user2Records = await store.query({ userId: 'user-2' });

      expect(user1Records).toHaveLength(2);
      expect(user2Records).toHaveLength(1);
    });
  });

  describe('get()', () => {
    it('should retrieve a record by ID and increment accessCount', async () => {
      const stored = await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'Test content',
      });

      const retrieved = await store.get(stored.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(stored.id);
      expect(retrieved!.accessCount).toBe(1);
      expect(retrieved!.lastAccessedAt).toBeDefined();
    });

    it('should return null for non-existent ID', async () => {
      const result = await store.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('query()', () => {
    beforeEach(async () => {
      // Seed test data
      await store.store({ userId: 'user-1', type: 'fact', content: 'Fact A', priority: 'high' });
      await store.store({ userId: 'user-1', type: 'fact', content: 'Fact B', priority: 'low' });
      await store.store({ userId: 'user-1', type: 'preference', content: 'Pref A', priority: 'medium' });
      await store.store({ userId: 'user-1', type: 'correction', content: 'Correction A' });
    });

    it('should filter by type', async () => {
      const results = await store.query({ userId: 'user-1', types: ['fact'] });
      expect(results).toHaveLength(2);
      expect(results.every(r => r.type === 'fact')).toBe(true);
    });

    it('should filter by priority', async () => {
      // Note: Records without priority are NOT excluded (they don't match the skip condition)
      // Only records WITH a different priority are excluded
      const results = await store.query({ userId: 'user-1', priority: ['high'] });
      // Expect high priority record + correction record (no priority set)
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.priority === 'high')).toBe(true);
      // No low or medium priority records
      expect(results.every(r => r.priority !== 'low' && r.priority !== 'medium')).toBe(true);
    });

    it('should search in content', async () => {
      const results = await store.query({ userId: 'user-1', search: 'Correction' });
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Correction A');
    });

    it('should search in summary', async () => {
      await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'Long content here',
        summary: 'Short summary keyword',
      });

      const results = await store.query({ userId: 'user-1', search: 'keyword' });
      expect(results).toHaveLength(1);
    });

    it('should apply pagination', async () => {
      const results = await store.query({ userId: 'user-1', limit: 2, offset: 0 });
      expect(results).toHaveLength(2);

      const page2 = await store.query({ userId: 'user-1', limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
    });

    it('should sort by priority', async () => {
      const results = await store.query({
        userId: 'user-1',
        sortBy: 'priority',
        sortOrder: 'desc',
      });

      expect(results[0].priority).toBe('high');
    });

    it('should exclude expired records by default', async () => {
      await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'Expired fact',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Already expired
      });

      const results = await store.query({ userId: 'user-1', types: ['fact'] });
      expect(results.find(r => r.content === 'Expired fact')).toBeUndefined();
    });

    it('should include expired records when requested', async () => {
      await store.store({
        userId: 'user-1',
        type: 'interaction',
        content: 'Expired interaction',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      const results = await store.query({
        userId: 'user-1',
        types: ['interaction'],
        includeExpired: true,
      });
      expect(results.find(r => r.content === 'Expired interaction')).toBeDefined();
    });

    it('should return empty array for unknown user', async () => {
      const results = await store.query({ userId: 'unknown-user' });
      expect(results).toHaveLength(0);
    });
  });

  describe('update()', () => {
    it('should update a record and set updatedAt', async () => {
      const stored = await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'Original content',
      });

      const updated = await store.update(stored.id, { content: 'Updated content' });

      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Updated content');
      expect(updated!.updatedAt).toBeDefined();
      expect(updated!.id).toBe(stored.id); // ID should not change
      expect(updated!.createdAt).toBe(stored.createdAt); // createdAt should not change
    });

    it('should return null for non-existent ID', async () => {
      const result = await store.update('non-existent', { content: 'test' });
      expect(result).toBeNull();
    });
  });

  describe('delete()', () => {
    it('should delete a record and return true', async () => {
      const stored = await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'To be deleted',
      });

      const deleted = await store.delete(stored.id);
      expect(deleted).toBe(true);

      const retrieved = await store.get(stored.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const result = await store.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('deleteByUser()', () => {
    it('should delete all records for a user', async () => {
      await store.store({ userId: 'user-1', type: 'fact', content: 'Fact 1' });
      await store.store({ userId: 'user-1', type: 'fact', content: 'Fact 2' });
      await store.store({ userId: 'user-2', type: 'fact', content: 'Other user fact' });

      const count = await store.deleteByUser('user-1');
      expect(count).toBe(2);

      const user1Records = await store.query({ userId: 'user-1' });
      expect(user1Records).toHaveLength(0);

      const user2Records = await store.query({ userId: 'user-2' });
      expect(user2Records).toHaveLength(1);
    });

    it('should return 0 for unknown user', async () => {
      const count = await store.deleteByUser('unknown');
      expect(count).toBe(0);
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', async () => {
      await store.store({ userId: 'user-1', type: 'fact', content: 'F1', priority: 'high' });
      await store.store({ userId: 'user-1', type: 'fact', content: 'F2', priority: 'low' });
      await store.store({ userId: 'user-1', type: 'preference', content: 'P1', priority: 'medium' });

      const stats = await store.getStats('user-1');

      expect(stats.totalRecords).toBe(3);
      expect(stats.byType.fact).toBe(2);
      expect(stats.byType.preference).toBe(1);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.low).toBe(1);
      expect(stats.byPriority.medium).toBe(1);
      expect(stats.oldestRecord).toBeDefined();
      expect(stats.newestRecord).toBeDefined();
    });

    it('should return empty stats for unknown user', async () => {
      const stats = await store.getStats('unknown');

      expect(stats.totalRecords).toBe(0);
      expect(stats.averageAccessCount).toBe(0);
    });
  });

  describe('cleanupExpired()', () => {
    it('should remove expired records', async () => {
      await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'Expired',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'Still valid',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });
      await store.store({
        userId: 'user-1',
        type: 'fact',
        content: 'No expiry',
      });

      const count = await store.cleanupExpired();
      expect(count).toBe(1);

      const remaining = await store.query({ userId: 'user-1', includeExpired: true });
      expect(remaining).toHaveLength(2);
    });
  });
});

// ============================================================================
// MemoryManager Tests
// ============================================================================

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    manager = new MemoryManager({ store });
  });

  describe('remember()', () => {
    it('should store a memory with defaults', async () => {
      const record = await manager.remember('user-1', 'fact', 'User likes TypeScript');

      expect(record.userId).toBe('user-1');
      expect(record.type).toBe('fact');
      expect(record.content).toBe('User likes TypeScript');
      expect(record.priority).toBe('medium');
    });

    it('should store with custom priority and metadata', async () => {
      const record = await manager.remember('user-1', 'preference', 'Dark mode', {
        priority: 'critical',
        metadata: { source: 'settings' },
      });

      expect(record.priority).toBe('critical');
      expect(record.metadata).toEqual({ source: 'settings' });
    });

    it('should auto-summarize long content', async () => {
      const summarizer = vi.fn().mockResolvedValue('Short summary');
      manager = new MemoryManager({ store, summarizer });

      const longContent = 'x'.repeat(600);
      const record = await manager.remember('user-1', 'fact', longContent);

      expect(summarizer).toHaveBeenCalledWith(longContent);
      expect(record.summary).toBe('Short summary');
    });

    it('should not summarize short content', async () => {
      const summarizer = vi.fn().mockResolvedValue('Summary');
      manager = new MemoryManager({ store, summarizer });

      await manager.remember('user-1', 'fact', 'Short content');
      expect(summarizer).not.toHaveBeenCalled();
    });

    it('should set expiration based on TTL', async () => {
      const record = await manager.remember('user-1', 'fact', 'Temporary', { ttl: 3600 });

      expect(record.expiresAt).toBeDefined();
      const expiresAt = new Date(record.expiresAt!);
      const expectedExpiry = Date.now() + 3600 * 1000;
      expect(Math.abs(expiresAt.getTime() - expectedExpiry)).toBeLessThan(1000);
    });

    it('should enforce memory limit', async () => {
      manager = new MemoryManager({ store, maxMemoriesPerUser: 3 });

      // Store 5 low-priority memories
      for (let i = 0; i < 5; i++) {
        await manager.remember('user-1', 'fact', `Fact ${i}`, { priority: 'low' });
      }

      const stats = await manager.getStats('user-1');
      expect(stats.totalRecords).toBeLessThanOrEqual(3);
    });
  });

  describe('recall()', () => {
    it('should query memories', async () => {
      await manager.remember('user-1', 'fact', 'Fact 1');
      await manager.remember('user-1', 'preference', 'Pref 1');

      const facts = await manager.recall({ userId: 'user-1', types: ['fact'] });
      expect(facts).toHaveLength(1);
      expect(facts[0].type).toBe('fact');
    });
  });

  describe('recallRelevant()', () => {
    it('should find memories matching context', async () => {
      await manager.remember('user-1', 'fact', 'User prefers TypeScript');
      await manager.remember('user-1', 'fact', 'User uses Python for ML');

      const relevant = await manager.recallRelevant('user-1', 'TypeScript');
      expect(relevant.some(r => r.content.includes('TypeScript'))).toBe(true);
    });
  });

  describe('forget()', () => {
    it('should delete a specific memory', async () => {
      const record = await manager.remember('user-1', 'fact', 'To forget');
      const deleted = await manager.forget(record.id);

      expect(deleted).toBe(true);

      const remaining = await manager.recall({ userId: 'user-1' });
      expect(remaining).toHaveLength(0);
    });
  });

  describe('forgetByType()', () => {
    it('should delete all memories of a type', async () => {
      await manager.remember('user-1', 'fact', 'Fact 1');
      await manager.remember('user-1', 'fact', 'Fact 2');
      await manager.remember('user-1', 'preference', 'Pref 1');

      const count = await manager.forgetByType('user-1', 'fact');
      expect(count).toBe(2);

      const remaining = await manager.recall({ userId: 'user-1' });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].type).toBe('preference');
    });
  });

  describe('forgetUser()', () => {
    it('should delete all memories for GDPR compliance', async () => {
      await manager.remember('user-1', 'fact', 'Fact 1');
      await manager.remember('user-1', 'preference', 'Pref 1');
      await manager.remember('user-1', 'correction', 'Corr 1');

      const count = await manager.forgetUser('user-1');
      expect(count).toBe(3);

      const remaining = await manager.recall({ userId: 'user-1' });
      expect(remaining).toHaveLength(0);
    });
  });

  describe('updatePriority()', () => {
    it('should update memory priority', async () => {
      const record = await manager.remember('user-1', 'fact', 'Important fact');
      const updated = await manager.updatePriority(record.id, 'critical');

      expect(updated).toBe(true);

      const retrieved = await store.get(record.id);
      expect(retrieved!.priority).toBe('critical');
    });
  });
});

// ============================================================================
// MemoryContextBuilder Tests
// ============================================================================

describe('MemoryContextBuilder', () => {
  let manager: MemoryManager;
  let builder: MemoryContextBuilder;

  beforeEach(() => {
    manager = createInMemoryManager();
    builder = new MemoryContextBuilder(manager);
  });

  describe('buildContext()', () => {
    it('should return empty string when no memories', async () => {
      const context = await builder.buildContext('user-1', 'some query');
      expect(context).toBe('');
    });

    it('should build context from relevant memories', async () => {
      await manager.remember('user-1', 'preference', 'Prefers TypeScript');
      await manager.remember('user-1', 'fact', 'Works on a TypeScript project');

      const context = await builder.buildContext('user-1', 'TypeScript');

      expect(context).toContain('TypeScript');
      expect(context).toMatch(/##/); // Should have section headers
    });

    it('should filter by type when specified', async () => {
      await manager.remember('user-1', 'preference', 'Dark mode preference setting');
      await manager.remember('user-1', 'fact', 'Uses VS Code editor');

      // Search for "mode" which should match "Dark mode preference"
      const context = await builder.buildContext('user-1', 'mode', {
        includeTypes: ['preference'],
      });

      expect(context).toContain('Dark mode');
    });

    it('should respect maxTokens limit', async () => {
      // Store many memories
      for (let i = 0; i < 20; i++) {
        await manager.remember('user-1', 'fact', `Fact number ${i} with some content`);
      }

      const context = await builder.buildContext('user-1', 'fact', {
        maxTokens: 100,
      });

      // Should be limited
      expect(context.length).toBeLessThan(1000);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createInMemoryManager()', () => {
  it('should create a working manager', async () => {
    const manager = createInMemoryManager();

    const record = await manager.remember('user-1', 'fact', 'Test fact');
    expect(record.id).toBeDefined();

    const recalled = await manager.recall({ userId: 'user-1' });
    expect(recalled).toHaveLength(1);
  });

  it('should accept options', async () => {
    const manager = createInMemoryManager({
      maxMemoriesPerUser: 5,
      defaultTTL: 3600,
    });

    const record = await manager.remember('user-1', 'fact', 'Test');
    expect(record.expiresAt).toBeDefined();
  });
});

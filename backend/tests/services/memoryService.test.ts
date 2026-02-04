/**
 * Memory Service unit tests.
 * Run: npm test -- memoryService.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock embeddingService
const mockEmbed = vi.fn();
vi.mock('../../src/services/embeddingService.js', () => ({
  embed: mockEmbed,
}));

// Mock vectorStoreAdapter
const mockUpsert = vi.fn();
const mockQuery = vi.fn();
const mockStore = {
  upsert: mockUpsert,
  query: mockQuery,
};

vi.mock('../../src/services/vectorStoreAdapter.js', () => ({
  getMemoryStore: vi.fn(() => mockStore),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Memory Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbed.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockUpsert.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue([]);
  });

  describe('remember', () => {
    it('embeds content and upserts to vector store', async () => {
      const { remember } = await import('../../src/services/memoryService.js');

      await remember({
        userId: 'user-123',
        type: 'interaction',
        content: 'User asked about authentication',
      });

      expect(mockEmbed).toHaveBeenCalledWith(['User asked about authentication'], { inputType: 'passage' });
      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          content: 'User asked about authentication',
          embedding: [0.1, 0.2, 0.3],
          source: 'user-123',
          type: 'doc',
          metadata: expect.objectContaining({
            namespace: 'grump-memory',
            userId: 'user-123',
            memoryType: 'interaction',
            content: 'User asked about authentication',
          }),
        }),
      ]);
    });

    it('uses summary as content when provided', async () => {
      const { remember } = await import('../../src/services/memoryService.js');

      await remember({
        userId: 'user-123',
        type: 'preference',
        content: 'Full content here with lots of details',
        summary: 'Short summary',
      });

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          content: 'Short summary',
          metadata: expect.objectContaining({
            content: 'Full content here with lots of details',
            summary: 'Short summary',
          }),
        }),
      ]);
    });

    it('generates unique ID with timestamp', async () => {
      const { remember } = await import('../../src/services/memoryService.js');

      await remember({
        userId: 'user-456',
        type: 'correction',
        content: 'Some correction',
      });

      const upsertCall = mockUpsert.mock.calls[0]?.[0]?.[0];
      expect(upsertCall.id).toMatch(/^mem-user-456-\d+-[a-z0-9]+$/);
    });

    it('includes createdAt timestamp in metadata', async () => {
      const { remember } = await import('../../src/services/memoryService.js');
      const before = new Date().toISOString();

      await remember({
        userId: 'user-123',
        type: 'interaction',
        content: 'Test content',
      });

      const after = new Date().toISOString();
      const upsertCall = mockUpsert.mock.calls[0]?.[0]?.[0];
      expect(upsertCall.metadata.createdAt).toBeDefined();
      expect(upsertCall.metadata.createdAt >= before).toBe(true);
      expect(upsertCall.metadata.createdAt <= after).toBe(true);
    });

    it('includes additional metadata when provided', async () => {
      const { remember } = await import('../../src/services/memoryService.js');

      await remember({
        userId: 'user-123',
        type: 'interaction',
        content: 'Test',
        metadata: { sessionId: 'sess-abc', topic: 'auth' },
      });

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({
            sessionId: 'sess-abc',
            topic: 'auth',
          }),
        }),
      ]);
    });

    it('logs debug message on success', async () => {
      const { remember } = await import('../../src/services/memoryService.js');
      const logger = await import('../../src/middleware/logger.js');

      await remember({
        userId: 'user-123',
        type: 'interaction',
        content: 'Test',
      });

      expect(logger.default.debug).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', type: 'interaction' }),
        'Memory remembered'
      );
    });

    it('throws and logs warning on embed failure', async () => {
      mockEmbed.mockRejectedValue(new Error('Embedding API failed'));
      const { remember } = await import('../../src/services/memoryService.js');
      const logger = await import('../../src/middleware/logger.js');

      await expect(
        remember({
          userId: 'user-123',
          type: 'interaction',
          content: 'Test',
        })
      ).rejects.toThrow('Embedding API failed');

      expect(logger.default.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Embedding API failed' }),
        'Memory remember failed'
      );
    });

    it('throws and logs warning on upsert failure', async () => {
      mockUpsert.mockRejectedValue(new Error('Vector store unavailable'));
      const { remember } = await import('../../src/services/memoryService.js');
      const logger = await import('../../src/middleware/logger.js');

      await expect(
        remember({
          userId: 'user-123',
          type: 'interaction',
          content: 'Test',
        })
      ).rejects.toThrow('Vector store unavailable');

      expect(logger.default.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Vector store unavailable' }),
        'Memory remember failed'
      );
    });
  });

  describe('recall', () => {
    it('embeds query and searches vector store', async () => {
      mockEmbed.mockResolvedValue([[0.4, 0.5, 0.6]]);
      mockQuery.mockResolvedValue([]);
      const { recall } = await import('../../src/services/memoryService.js');

      await recall('user-123', 'What did I ask about auth?');

      expect(mockEmbed).toHaveBeenCalledWith(['What did I ask about auth?'], { inputType: 'query' });
      expect(mockQuery).toHaveBeenCalledWith([0.4, 0.5, 0.6], { topK: 10 });
    });

    it('filters results by userId', async () => {
      mockQuery.mockResolvedValue([
        {
          chunk: {
            id: 'mem-1',
            content: 'Memory 1',
            embedding: [],
            source: 'user-123',
            type: 'doc',
            metadata: { userId: 'user-123', memoryType: 'interaction', createdAt: '2024-01-01' },
          },
          score: 0.9,
        },
        {
          chunk: {
            id: 'mem-2',
            content: 'Memory 2',
            embedding: [],
            source: 'user-456',
            type: 'doc',
            metadata: { userId: 'user-456', memoryType: 'interaction', createdAt: '2024-01-02' },
          },
          score: 0.8,
        },
        {
          chunk: {
            id: 'mem-3',
            content: 'Memory 3',
            embedding: [],
            source: 'user-123',
            type: 'doc',
            metadata: { userId: 'user-123', memoryType: 'preference', createdAt: '2024-01-03' },
          },
          score: 0.7,
        },
      ]);
      const { recall } = await import('../../src/services/memoryService.js');

      const results = await recall('user-123', 'test query');

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.userId === 'user-123')).toBe(true);
    });

    it('returns at most 5 results (MEMORY_TOP_K)', async () => {
      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        chunk: {
          id: `mem-${i}`,
          content: `Memory ${i}`,
          embedding: [],
          source: 'user-123',
          type: 'doc',
          metadata: { userId: 'user-123', memoryType: 'interaction', createdAt: '2024-01-01' },
        },
        score: 1 - i * 0.05,
      }));
      mockQuery.mockResolvedValue(manyResults);
      const { recall } = await import('../../src/services/memoryService.js');

      const results = await recall('user-123', 'test');

      expect(results).toHaveLength(5);
    });

    it('converts VectorChunk to MemoryRecord format', async () => {
      mockQuery.mockResolvedValue([
        {
          chunk: {
            id: 'mem-123',
            content: 'Memory content',
            embedding: [],
            source: 'user-abc',
            type: 'doc',
            metadata: {
              userId: 'user-abc',
              memoryType: 'correction',
              summary: 'A correction summary',
              createdAt: '2024-06-15T10:30:00Z',
              customField: 'custom value',
            },
          },
          score: 0.95,
        },
      ]);
      const { recall } = await import('../../src/services/memoryService.js');

      const results = await recall('user-abc', 'query');

      expect(results[0]).toEqual({
        id: 'mem-123',
        userId: 'user-abc',
        type: 'correction',
        content: 'Memory content',
        summary: 'A correction summary',
        createdAt: '2024-06-15T10:30:00Z',
        metadata: expect.objectContaining({
          userId: 'user-abc',
          memoryType: 'correction',
          customField: 'custom value',
        }),
      });
    });

    it('handles missing metadata gracefully', async () => {
      mockQuery.mockResolvedValue([
        {
          chunk: {
            id: 'mem-minimal',
            content: 'Minimal content',
            embedding: [],
            source: 'user-xyz',
            type: 'doc',
            metadata: { userId: 'user-xyz' },
          },
          score: 0.5,
        },
      ]);
      const { recall } = await import('../../src/services/memoryService.js');

      const results = await recall('user-xyz', 'query');

      expect(results[0]).toEqual(
        expect.objectContaining({
          id: 'mem-minimal',
          userId: 'user-xyz',
          type: 'interaction', // default
          createdAt: '', // default
        })
      );
    });

    it('returns empty array on embed failure', async () => {
      mockEmbed.mockRejectedValue(new Error('Embed failed'));
      const { recall } = await import('../../src/services/memoryService.js');
      const logger = await import('../../src/middleware/logger.js');

      const results = await recall('user-123', 'query');

      expect(results).toEqual([]);
      expect(logger.default.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Embed failed' }),
        'Memory recall failed'
      );
    });

    it('returns empty array on query failure', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));
      const { recall } = await import('../../src/services/memoryService.js');
      const logger = await import('../../src/middleware/logger.js');

      const results = await recall('user-123', 'query');

      expect(results).toEqual([]);
      expect(logger.default.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Query failed' }),
        'Memory recall failed'
      );
    });

    it('returns empty array for user with no memories', async () => {
      mockQuery.mockResolvedValue([
        {
          chunk: {
            id: 'mem-other',
            content: 'Other user memory',
            embedding: [],
            source: 'other-user',
            type: 'doc',
            metadata: { userId: 'other-user' },
          },
          score: 0.9,
        },
      ]);
      const { recall } = await import('../../src/services/memoryService.js');

      const results = await recall('user-123', 'query');

      expect(results).toEqual([]);
    });
  });

  describe('learnFromFeedback', () => {
    it('stores correction type memory with feedback details', async () => {
      const { learnFromFeedback } = await import('../../src/services/memoryService.js');

      await learnFromFeedback({
        userId: 'user-123',
        originalResponse: 'The answer is 42',
        correctedResponse: 'Actually the answer is 43',
        context: 'Math calculation',
      });

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          content: expect.stringContaining('Correction:'),
          metadata: expect.objectContaining({
            memoryType: 'correction',
            originalResponse: 'The answer is 42',
            context: 'Math calculation',
          }),
        }),
      ]);
    });

    it('creates summary from original and corrected responses', async () => {
      const { learnFromFeedback } = await import('../../src/services/memoryService.js');

      await learnFromFeedback({
        userId: 'user-123',
        originalResponse: 'Original text here',
        correctedResponse: 'Corrected text here',
      });

      const upsertCall = mockUpsert.mock.calls[0]?.[0]?.[0];
      expect(upsertCall.content).toContain('Correction:');
      expect(upsertCall.content).toContain('Original text here');
      expect(upsertCall.content).toContain('Corrected text here');
    });

    it('truncates long responses in summary', async () => {
      const longOriginal = 'A'.repeat(200);
      const longCorrected = 'B'.repeat(200);
      const { learnFromFeedback } = await import('../../src/services/memoryService.js');

      await learnFromFeedback({
        userId: 'user-123',
        originalResponse: longOriginal,
        correctedResponse: longCorrected,
      });

      const upsertCall = mockUpsert.mock.calls[0]?.[0]?.[0];
      // Summary should contain truncated versions (100 chars each)
      expect(upsertCall.content.length).toBeLessThan(250);
    });

    it('handles undefined context', async () => {
      const { learnFromFeedback } = await import('../../src/services/memoryService.js');

      await learnFromFeedback({
        userId: 'user-123',
        originalResponse: 'Original',
        correctedResponse: 'Corrected',
      });

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({
            context: undefined,
          }),
        }),
      ]);
    });

    it('throws on remember failure', async () => {
      mockEmbed.mockRejectedValue(new Error('Embedding failed'));
      const { learnFromFeedback } = await import('../../src/services/memoryService.js');

      await expect(
        learnFromFeedback({
          userId: 'user-123',
          originalResponse: 'Original',
          correctedResponse: 'Corrected',
        })
      ).rejects.toThrow('Embedding failed');
    });
  });

  describe('MemoryType enum values', () => {
    it('supports interaction type', async () => {
      const { remember } = await import('../../src/services/memoryService.js');

      await remember({
        userId: 'user-1',
        type: 'interaction',
        content: 'Test',
      });

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({ memoryType: 'interaction' }),
        }),
      ]);
    });

    it('supports correction type', async () => {
      const { remember } = await import('../../src/services/memoryService.js');

      await remember({
        userId: 'user-1',
        type: 'correction',
        content: 'Test',
      });

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({ memoryType: 'correction' }),
        }),
      ]);
    });

    it('supports preference type', async () => {
      const { remember } = await import('../../src/services/memoryService.js');

      await remember({
        userId: 'user-1',
        type: 'preference',
        content: 'Test',
      });

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({ memoryType: 'preference' }),
        }),
      ]);
    });
  });
});

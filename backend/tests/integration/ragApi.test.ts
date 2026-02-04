/**
 * RAG API integration tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';

const mockRagQuery = vi.fn();
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('../../src/services/ragService.js', () => ({
  ragQuery: (...args: unknown[]) => mockRagQuery(...args),
  runIndexer: vi.fn(),
}));

vi.mock('../../src/services/tieredCache.js', () => ({
  getTieredCache: vi.fn(() => ({
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
  })),
}));

const ragRoutes = (await import('../../src/routes/rag.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/rag', ragRoutes);

describe('RAG API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockRagQuery.mockResolvedValue({ answer: 'Test answer', sources: [] });
  });

  describe('POST /api/rag/query', () => {
    it('returns 400 when query missing', async () => {
      const res = await request(app)
        .post('/api/rag/query')
        .send({})
        .expect(400);
      expect(res.body.error).toContain('query');
    });

    it('returns 400 when query is empty string', async () => {
      await request(app)
        .post('/api/rag/query')
        .send({ query: '   ' })
        .expect(400);
    });

    it('returns 200 with answer from ragQuery', async () => {
      mockRagQuery.mockResolvedValue({
        answer: 'How to use Express',
        sources: [{ title: 'Express docs', url: 'https://expressjs.com' }],
      });

      const res = await request(app)
        .post('/api/rag/query')
        .send({ query: 'How do I create an Express app?' })
        .expect(200);
      expect(res.body).toHaveProperty('answer', 'How to use Express');
      expect(res.body).toHaveProperty('sources');
      expect(res.body.fromCache).toBe(false);
    });

    it('returns cached result when available', async () => {
      mockCacheGet.mockResolvedValue({
        answer: 'Cached answer',
        sources: [],
      });

      const res = await request(app)
        .post('/api/rag/query')
        .send({ query: 'cached query' })
        .expect(200);
      expect(res.body.answer).toBe('Cached answer');
      expect(res.body.fromCache).toBe(true);
      expect(mockRagQuery).not.toHaveBeenCalled();
    });
  });
});

/**
 * Memory API integration tests.
 * Tests GET /api/memory, POST /api/memory/recall, remember, feedback.
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';

vi.mock('../../src/services/memoryService.js', () => ({
  recall: vi.fn().mockResolvedValue([]),
  remember: vi.fn().mockResolvedValue(undefined),
  learnFromFeedback: vi.fn().mockResolvedValue(undefined),
}));

const memoryRoutes = (await import('../../src/routes/memory.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/memory', memoryRoutes);

describe('Memory API', () => {
  describe('GET /api/memory', () => {
    it('returns 200 with empty memories list', async () => {
      const res = await request(app).get('/api/memory').expect(200);
      expect(res.body).toEqual({ memories: [] });
    });
  });

  describe('POST /api/memory/recall', () => {
    it('returns 400 when userId is missing', async () => {
      const res = await request(app)
        .post('/api/memory/recall')
        .send({ query: 'test' })
        .expect(400);
      expect(res.body.error).toContain('userId');
    });

    it('returns 400 when query is missing', async () => {
      const res = await request(app)
        .post('/api/memory/recall')
        .send({ userId: 'u1' })
        .expect(400);
      expect(res.body.error).toContain('query');
    });

    it('returns 200 with memories', async () => {
      const res = await request(app)
        .post('/api/memory/recall')
        .send({ userId: 'u1', query: 'what did I ask' })
        .expect(200);
      expect(res.body).toHaveProperty('memories');
      expect(Array.isArray(res.body.memories)).toBe(true);
    });
  });

  describe('POST /api/memory/remember', () => {
    it('returns 400 when userId or content missing', async () => {
      await request(app)
        .post('/api/memory/remember')
        .send({ content: 'test' })
        .expect(400);
      await request(app)
        .post('/api/memory/remember')
        .send({ userId: 'u1' })
        .expect(400);
    });

    it('returns 201 when valid', async () => {
      const res = await request(app)
        .post('/api/memory/remember')
        .send({ userId: 'u1', content: 'I prefer dark mode' })
        .expect(201);
      expect(res.body).toEqual({ ok: true });
    });

    it('accepts type correction and preference', async () => {
      await request(app)
        .post('/api/memory/remember')
        .send({ userId: 'u1', content: 'fix', type: 'correction' })
        .expect(201);
      await request(app)
        .post('/api/memory/remember')
        .send({ userId: 'u1', content: 'pref', type: 'preference' })
        .expect(201);
    });
  });

  describe('POST /api/memory/feedback', () => {
    it('returns 400 when required fields missing', async () => {
      await request(app)
        .post('/api/memory/feedback')
        .send({ originalResponse: 'a', correctedResponse: 'b' })
        .expect(400);
    });

    it('returns 201 when valid', async () => {
      const res = await request(app)
        .post('/api/memory/feedback')
        .send({
          userId: 'u1',
          originalResponse: 'wrong',
          correctedResponse: 'right',
        })
        .expect(201);
      expect(res.body).toEqual({ ok: true });
    });
  });
});

/**
 * Spec API integration tests.
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';

const mockSession = {
  id: 'spec-1',
  userRequest: 'Todo app',
  questions: [],
  answers: {},
  status: 'in_progress',
};

vi.mock('../../src/services/specService.js', () => ({
  startSpecSession: vi.fn().mockResolvedValue(mockSession),
  getSpecSession: vi.fn().mockImplementation((id: string) =>
    id === 'spec-1' ? Promise.resolve(mockSession) : Promise.resolve(null)
  ),
  submitAnswer: vi.fn().mockResolvedValue(mockSession),
  generateSpecification: vi.fn().mockResolvedValue({ specification: 'doc', session: mockSession }),
  isSessionComplete: vi.fn().mockImplementation((id: string) =>
    Promise.resolve(id === 'spec-1')
  ),
  getNextQuestion: vi.fn().mockResolvedValue(null),
}));

const specRoutes = (await import('../../src/routes/spec.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/spec', specRoutes);

describe('Spec API', () => {
  describe('POST /api/spec/start', () => {
    it('returns 400 when userRequest missing', async () => {
      const res = await request(app)
        .post('/api/spec/start')
        .send({})
        .expect(400);
      expect(res.body.message).toContain('userRequest');
    });

    it('returns 200 with session', async () => {
      const res = await request(app)
        .post('/api/spec/start')
        .send({ userRequest: 'Build a blog' })
        .expect(200);
      expect(res.body).toHaveProperty('session');
      expect(res.body.session.id).toBe('spec-1');
    });
  });

  describe('GET /api/spec/:id', () => {
    it('returns 404 for unknown session', async () => {
      await request(app).get('/api/spec/unknown').expect(404);
    });

    it('returns 200 for existing session', async () => {
      const res = await request(app).get('/api/spec/spec-1').expect(200);
      expect(res.body.session.id).toBe('spec-1');
      expect(res.body).toHaveProperty('isComplete');
      expect(res.body).toHaveProperty('nextQuestion');
    });
  });

  describe('POST /api/spec/:id/answer', () => {
    it('returns 400 when questionId or value missing', async () => {
      await request(app)
        .post('/api/spec/spec-1/answer')
        .send({})
        .expect(400);
    });

    it('returns 200 when valid', async () => {
      const res = await request(app)
        .post('/api/spec/spec-1/answer')
        .send({ questionId: 'q1', value: 'answer' })
        .expect(200);
      expect(res.body).toHaveProperty('session');
    });
  });

  describe('POST /api/spec/:id/generate', () => {
    it('returns 200 with specification when session complete', async () => {
      const res = await request(app)
        .post('/api/spec/spec-1/generate')
        .send({})
        .expect(200);
      expect(res.body).toHaveProperty('specification');
      expect(res.body).toHaveProperty('session');
    });
  });
});

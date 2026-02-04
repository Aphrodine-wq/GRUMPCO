/**
 * Plan API integration tests.
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';

const mockPlan = {
  id: 'plan-1',
  userRequest: 'Build a todo app',
  phases: [],
  status: 'draft',
};

vi.mock('../../src/services/planService.js', () => ({
  generatePlan: vi.fn().mockResolvedValue(mockPlan),
  getPlan: vi.fn().mockImplementation((id: string) =>
    id === 'plan-1' ? Promise.resolve(mockPlan) : Promise.resolve(null)
  ),
  approvePlan: vi.fn().mockResolvedValue({ ...mockPlan, status: 'approved' }),
  rejectPlan: vi.fn().mockResolvedValue({ ...mockPlan, status: 'rejected' }),
  editPlan: vi.fn().mockResolvedValue(mockPlan),
  startPlanExecution: vi.fn().mockResolvedValue(mockPlan),
  completePlanExecution: vi.fn().mockResolvedValue(mockPlan),
  updatePhaseStatus: vi.fn().mockResolvedValue(mockPlan),
}));

const planRoutes = (await import('../../src/routes/plan.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/plan', planRoutes);

describe('Plan API', () => {
  describe('POST /api/plan/generate', () => {
    it('returns 400 when userRequest missing', async () => {
      const res = await request(app)
        .post('/api/plan/generate')
        .send({})
        .expect(400);
      expect(res.body.message).toContain('userRequest');
    });

    it('returns 200 with plan', async () => {
      const res = await request(app)
        .post('/api/plan/generate')
        .send({ userRequest: 'Build a blog' })
        .expect(200);
      expect(res.body).toHaveProperty('plan');
      expect(res.body.plan).toHaveProperty('id');
    });
  });

  describe('GET /api/plan/:id', () => {
    it('returns 404 for unknown plan', async () => {
      await request(app).get('/api/plan/unknown').expect(404);
    });

    it('returns 200 for existing plan', async () => {
      const res = await request(app).get('/api/plan/plan-1').expect(200);
      expect(res.body.plan.id).toBe('plan-1');
    });
  });

  describe('POST /api/plan/:id/approve', () => {
    it('returns 200 when approving', async () => {
      const res = await request(app)
        .post('/api/plan/plan-1/approve')
        .send({ approved: true })
        .expect(200);
      expect(res.body.plan.status).toBe('approved');
    });

    it('returns 200 when rejecting', async () => {
      const res = await request(app)
        .post('/api/plan/plan-1/approve')
        .send({ approved: false, comments: 'no' })
        .expect(200);
      expect(res.body.plan.status).toBe('rejected');
    });
  });
});

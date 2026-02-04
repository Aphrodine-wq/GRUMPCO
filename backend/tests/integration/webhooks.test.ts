/**
 * Webhooks API – trigger (ship), outbound registration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock job queue before importing webhook routes
const mockEnqueueShipJob = vi.fn();
vi.mock('../../src/services/jobQueue.js', () => ({
  enqueueShipJob: (id: string) => mockEnqueueShipJob(id),
}));

const mockRegisterWebhook = vi.fn();
vi.mock('../../src/services/webhookService.js', () => ({
  registerWebhook: (url: string, events?: string[]) => mockRegisterWebhook(url, events),
}));

describe('Webhooks API', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.GRUMP_WEBHOOK_SECRET = '';
    app = express();
    app.use(express.json());
    const webhookRoutes = (await import('../../src/routes/webhooks.js')).default;
    app.use('/api/webhooks', webhookRoutes);
  });

  describe('POST /api/webhooks/trigger', () => {
    it('returns 400 when action is missing', async () => {
      const res = await request(app)
        .post('/api/webhooks/trigger')
        .send({})
        .expect(400);
      expect(res.body.error).toMatch(/invalid action|missing/i);
    });

    it('returns 400 when action is not ship or chat', async () => {
      const res = await request(app)
        .post('/api/webhooks/trigger')
        .send({ action: 'other' })
        .expect(400);
      expect(res.body.error).toMatch(/invalid action|missing/i);
    });

    it('returns 400 for ship action without params.sessionId', async () => {
      const res = await request(app)
        .post('/api/webhooks/trigger')
        .send({ action: 'ship' })
        .expect(400);
      expect(res.body.error).toMatch(/sessionId/);
    });

    it('returns 202 and jobId for valid ship trigger', async () => {
      mockEnqueueShipJob.mockResolvedValue('job-123');
      const res = await request(app)
        .post('/api/webhooks/trigger')
        .send({ action: 'ship', params: { sessionId: 'sess-1' } })
        .expect(202);
      expect(res.body.jobId).toBe('job-123');
      expect(res.body.action).toBe('ship');
      expect(mockEnqueueShipJob).toHaveBeenCalledWith('sess-1');
    });
  });

  describe('POST /api/webhooks/outbound', () => {
    it('returns 400 when url is missing', async () => {
      const res = await request(app)
        .post('/api/webhooks/outbound')
        .send({})
        .expect(400);
      expect(res.body.error).toMatch(/url/i);
    });

    it('returns 200 and ok when url provided', async () => {
      const res = await request(app)
        .post('/api/webhooks/outbound')
        .send({ url: 'https://example.com/hook', events: ['ship.completed'] })
        .expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.url).toBe('https://example.com/hook');
      expect(mockRegisterWebhook).toHaveBeenCalledWith('https://example.com/hook', ['ship.completed']);
    });
  });
});

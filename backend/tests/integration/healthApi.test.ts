/**
 * Health API integration tests.
 * Tests /health, /health/quick, /health/live, /health/ready, /health/detailed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.NVIDIA_NIM_API_KEY = 'test_key';

vi.mock('globalThis.fetch', () => vi.fn().mockResolvedValue({ ok: true }));

vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    getDb: () => ({
      prepare: () => ({ get: () => ({}), run: () => ({}) }),
    }),
  })),
}));

vi.mock('../../src/services/bulkheads.js', () => ({
  getAllServiceStates: vi.fn().mockReturnValue({}),
}));

vi.mock('../../src/services/alerting.js', () => ({
  getAlertingService: vi.fn(() => ({
    getStatus: vi.fn().mockReturnValue({ healthy: true }),
  })),
}));

vi.mock('../../src/services/redis.js', () => ({
  isRedisConnected: vi.fn().mockReturnValue(false),
}));

const healthRoutes = (await import('../../src/routes/health.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/health', healthRoutes);

describe('Health API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/quick', () => {
    it('returns 200 with status and checks', async () => {
      const res = await request(app).get('/health/quick').expect(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('checks');
      expect(res.body.checks).toHaveProperty('api_key_configured', true);
      expect(res.body.checks).toHaveProperty('server_responsive', true);
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/live', () => {
    it('returns 200 with memory info when heap is normal', async () => {
      const res = await request(app).get('/health/live').expect(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('memory');
      expect(res.body.memory).toHaveProperty('heapUsedMB');
      expect(res.body.memory).toHaveProperty('heapTotalMB');
      expect(res.body.memory).toHaveProperty('heapPercentage');
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 or 503 with readiness checks', async () => {
      const res = await request(app).get('/health/ready');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('checks');
    });
  });

  describe('GET /health/detailed', () => {
    it('returns 200 with detailed health info', async () => {
      const res = await request(app).get('/health/detailed');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});

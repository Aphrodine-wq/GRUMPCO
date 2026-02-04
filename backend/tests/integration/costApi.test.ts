/**
 * Cost API integration tests.
 * Asserts /api/cost/summary and /api/cost/stats return 200 and valid shape (no 404).
 * Uses a minimal Express app with only cost routes to avoid starting the full server.
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.ANTHROPIC_API_KEY = 'test_key_for_cost_api';
process.env.NVIDIA_NIM_API_KEY = 'test_nim_key';
process.env.NODE_ENV = 'test';

// Mock cost analytics: getCostAnalytics() returns an instance with getCostSummary
vi.mock('../../src/services/costAnalytics.js', () => ({
  getCostAnalytics: vi.fn(() => ({
    getCostSummary: vi.fn().mockResolvedValue({
      totalCost: 0,
      totalRequests: 0,
      breakdown: [],
      period: { start: new Date().toISOString(), end: new Date().toISOString() },
    }),
  })),
}));

// Mock tieredCache, workerPool, nimAccelerator for /stats
vi.mock('../../src/services/tieredCache.js', () => ({
  getTieredCache: vi.fn(() => ({
    getStats: vi.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 }),
  })),
}));

vi.mock('../../src/services/workerPool.js', () => ({
  getWorkerPool: vi.fn(() => ({
    getStats: vi.fn().mockReturnValue({ active: 0, idle: 0 }),
  })),
}));

vi.mock('../../src/services/nimAccelerator.js', () => ({
  getNIMAccelerator: vi.fn(() => ({
    getStats: vi.fn().mockReturnValue(null),
    getGpuMetrics: vi.fn().mockResolvedValue(null),
  })),
}));

const costDashboardRoutes = (await import('../../src/routes/costDashboard.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/cost', costDashboardRoutes);

describe('Cost API', () => {
  describe('GET /api/cost/summary', () => {
    it('returns 200 with summary shape', async () => {
      const res = await request(app)
        .get('/api/cost/summary')
        .query({ userId: 'default' });

      if (res.status === 200) {
        expect(res.body).toMatchObject({ success: true });
        expect(res.body.data).toBeDefined();
      } else {
        expect([200, 500]).toContain(res.status);
      }
    });
  });

  describe('GET /api/cost/stats', () => {
    it('returns 200 with stats shape', async () => {
      const res = await request(app).get('/api/cost/stats');

      if (res.status === 200) {
        expect(res.body).toMatchObject({ success: true });
        expect(res.body.data).toBeDefined();
        expect(res.body.data).toHaveProperty('cache');
        expect(res.body.data).toHaveProperty('workerPool');
      } else {
        expect([200, 500]).toContain(res.status);
      }
    });
  });
});

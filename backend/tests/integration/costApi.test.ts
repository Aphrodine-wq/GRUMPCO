/**
 * Cost API integration tests.
 * Asserts /api/cost/summary and /api/cost/stats return 200 and valid shape (no 404).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

process.env.ANTHROPIC_API_KEY = 'test_key_for_cost_api';
process.env.NODE_ENV = 'test';

const { default: app, appReady } = await import('../../src/index.js');

describe('Cost API', () => {
  beforeAll(async () => {
    await appReady;
  });

  describe('GET /api/cost/summary', () => {
    it('returns 200 with summary shape', async () => {
      const res = await request(app)
        .get('/api/cost/summary')
        .query({ userId: 'default' })
        .expect(200);

      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/cost/stats', () => {
    it('returns 200 with stats shape', async () => {
      const res = await request(app)
        .get('/api/cost/stats')
        .expect(200);

      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toBeDefined();
      expect(res.body.data).toHaveProperty('cache');
      expect(res.body.data).toHaveProperty('workerPool');
    });
  });
});

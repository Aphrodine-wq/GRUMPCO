/**
 * Settings API integration tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';

const mockSettings = { user: { apiKey: 'test' }, tier: 'free' as const };
const mockDb = {
  getSettings: vi.fn().mockResolvedValue(mockSettings),
  saveSettings: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

const settingsRoutes = (await import('../../src/routes/settings.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/settings', settingsRoutes);

describe('Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getSettings.mockResolvedValue(mockSettings);
    mockDb.saveSettings.mockResolvedValue(undefined);
  });

  describe('GET /api/settings', () => {
    it('returns 200 with settings for default user', async () => {
      const res = await request(app).get('/api/settings').expect(200);
      expect(res.body).toHaveProperty('settings');
      expect(mockDb.getSettings).toHaveBeenCalledWith('default');
    });

    it('returns 200 with empty settings when none exist', async () => {
      mockDb.getSettings.mockResolvedValue(null);
      const res = await request(app).get('/api/settings').expect(200);
      expect(res.body.settings).toEqual({});
    });

    it('uses X-User-Id header when provided', async () => {
      await request(app)
        .get('/api/settings')
        .set('X-User-Id', 'user-123')
        .expect(200);
      expect(mockDb.getSettings).toHaveBeenCalledWith('user-123');
    });

    it('uses user query param when provided', async () => {
      await request(app)
        .get('/api/settings')
        .query({ user: 'query-user' })
        .expect(200);
      expect(mockDb.getSettings).toHaveBeenCalledWith('query-user');
    });
  });

  describe('PUT /api/settings', () => {
    it('returns 400 when body is null', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Content-Type', 'application/json')
        .send('null');
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is not an object', async () => {
      await request(app)
        .put('/api/settings')
        .send('invalid')
        .expect(400);
    });

    it('returns 200 and merges settings', async () => {
      mockDb.getSettings.mockResolvedValue({ tier: 'free' });
      mockDb.saveSettings.mockResolvedValue(undefined);
      mockDb.getSettings
        .mockResolvedValueOnce({ tier: 'free' })
        .mockResolvedValueOnce({ tier: 'pro', user: {} });

      const res = await request(app)
        .put('/api/settings')
        .send({ tier: 'pro' })
        .expect(200);
      expect(res.body).toHaveProperty('settings');
      expect(mockDb.saveSettings).toHaveBeenCalled();
    });
  });
});

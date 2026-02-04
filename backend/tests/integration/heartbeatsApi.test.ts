/**
 * Heartbeats API integration tests.
 * Tests /api/heartbeats endpoints for managing scheduled tasks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.NVIDIA_NIM_API_KEY = 'test_key';

// Mock heartbeat storage
const mockHeartbeats: Array<{
  id: string;
  userId: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  payload?: string | null;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}> = [];

// Mock heartbeat service with correct export names from heartbeatService.js
vi.mock('../../src/services/heartbeatService.js', () => ({
  // createHeartbeat is called with an object: { userId, name, cronExpression, payload }
  createHeartbeat: vi.fn().mockImplementation(({ userId, name, cronExpression, payload }) => {
    const heartbeat = {
      id: `hb_${Date.now()}`,
      userId,
      name,
      cronExpression,
      enabled: true,
      payload: payload ? JSON.stringify(payload) : null,
      createdAt: new Date().toISOString(),
    };
    mockHeartbeats.push(heartbeat);
    return Promise.resolve(heartbeat);
  }),
  getHeartbeatsForUser: vi.fn().mockImplementation((_userId) => Promise.resolve([...mockHeartbeats])),
  getHeartbeat: vi.fn().mockImplementation((id) => 
    Promise.resolve(mockHeartbeats.find(h => h.id === id) || null)
  ),
  updateHeartbeatSchedule: vi.fn().mockImplementation((id, cronExpression, _userId) => {
    const heartbeat = mockHeartbeats.find(h => h.id === id);
    if (heartbeat) {
      heartbeat.cronExpression = cronExpression;
      return Promise.resolve(heartbeat);
    }
    throw new Error('Heartbeat not found');
  }),
  deleteHeartbeat: vi.fn().mockImplementation((id, _userId) => {
    const idx = mockHeartbeats.findIndex(h => h.id === id);
    if (idx >= 0) {
      mockHeartbeats.splice(idx, 1);
    }
    // deleteHeartbeat doesn't throw, just returns undefined
    return Promise.resolve(undefined);
  }),
  setHeartbeatEnabled: vi.fn().mockImplementation((id, enabled, _userId) => {
    const heartbeat = mockHeartbeats.find(h => h.id === id);
    if (heartbeat) {
      heartbeat.enabled = enabled;
      return Promise.resolve(heartbeat);
    }
    throw new Error('Heartbeat not found');
  }),
  HEARTBEAT_TEMPLATES: [
    { id: 'HOURLY_SUMMARY', name: 'Hourly Summary', cronExpression: '0 * * * *', description: 'Run every hour' },
    { id: 'DAILY_DIGEST', name: 'Daily Digest', cronExpression: '0 9 * * *', description: 'Run daily at 9 AM' },
    { id: 'WEEKLY_REVIEW', name: 'Weekly Review', cronExpression: '0 10 * * 1', description: 'Run weekly on Mondays' },
    { id: 'HEALTH_CHECK', name: 'Health Check', cronExpression: '*/5 * * * *', description: 'Run every 5 minutes' },
    { id: 'MEMORY_CLEANUP', name: 'Memory Cleanup', cronExpression: '0 2 * * *', description: 'Run daily at 2 AM' },
  ],
  createHeartbeatFromTemplate: vi.fn().mockImplementation((userId, template, payload) => {
    const templates: Record<string, { cronExpression: string }> = {
      HOURLY_SUMMARY: { cronExpression: '0 * * * *' },
      DAILY_DIGEST: { cronExpression: '0 9 * * *' },
      WEEKLY_REVIEW: { cronExpression: '0 10 * * 1' },
      HEALTH_CHECK: { cronExpression: '*/5 * * * *' },
      MEMORY_CLEANUP: { cronExpression: '0 2 * * *' },
    };
    const heartbeat = {
      id: `hb_${Date.now()}`,
      userId,
      name: template,
      cronExpression: templates[template]?.cronExpression || '0 * * * *',
      enabled: true,
      payload: payload ? JSON.stringify(payload) : null,
      createdAt: new Date().toISOString(),
    };
    mockHeartbeats.push(heartbeat);
    return Promise.resolve(heartbeat);
  }),
}));

// Mock the database
vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    getDb: () => ({
      prepare: () => ({
        get: () => null,
        run: () => ({ changes: 1 }),
        all: () => [],
      }),
    }),
  })),
}));

// Import and setup
const heartbeatsRoutes = (await import('../../src/routes/heartbeats.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/heartbeats', heartbeatsRoutes);

describe('Heartbeats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeartbeats.length = 0;
  });

  describe('GET /api/heartbeats', () => {
    it('returns 200 with heartbeats array', async () => {
      const res = await request(app).get('/api/heartbeats').expect(200);
      expect(res.body).toHaveProperty('heartbeats');
      expect(Array.isArray(res.body.heartbeats)).toBe(true);
    });

    it('returns empty array when no heartbeats exist', async () => {
      const res = await request(app).get('/api/heartbeats').expect(200);
      expect(res.body.heartbeats).toHaveLength(0);
    });
  });

  describe('GET /api/heartbeats/templates', () => {
    it('returns 200 with templates array', async () => {
      const res = await request(app)
        .get('/api/heartbeats/templates')
        .expect(200);
      expect(res.body).toHaveProperty('templates');
      expect(Array.isArray(res.body.templates)).toBe(true);
    });

    it('templates have required properties', async () => {
      const res = await request(app)
        .get('/api/heartbeats/templates')
        .expect(200);
      res.body.templates.forEach((template: { id: string; name: string; cronExpression: string }) => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('cronExpression');
      });
    });
  });

  describe('POST /api/heartbeats', () => {
    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/heartbeats')
        .send({ cronExpression: '0 * * * *' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when cronExpression is missing', async () => {
      const res = await request(app)
        .post('/api/heartbeats')
        .send({ name: 'Test Heartbeat' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('creates heartbeat with valid payload', async () => {
      const res = await request(app)
        .post('/api/heartbeats')
        .send({
          name: 'Daily Reminder',
          cronExpression: '0 9 * * *',
          payload: { message: 'Time to check emails!' },
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'Daily Reminder');
      expect(res.body).toHaveProperty('cronExpression', '0 9 * * *');
      expect(res.body).toHaveProperty('enabled', true);
    });
  });

  describe('GET /api/heartbeats/:id', () => {
    it('returns 404 for non-existent heartbeat', async () => {
      const res = await request(app)
        .get('/api/heartbeats/non-existent-id')
        .expect(404);
      expect(res.body).toHaveProperty('error');
    });

    it('returns heartbeat details for valid ID', async () => {
      // First create a heartbeat
      mockHeartbeats.push({
        id: 'hb_test123',
        userId: 'default',
        name: 'Test Heartbeat',
        cronExpression: '0 * * * *',
        enabled: true,
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .get('/api/heartbeats/hb_test123')
        .expect(200);
      expect(res.body).toHaveProperty('id', 'hb_test123');
      expect(res.body).toHaveProperty('name', 'Test Heartbeat');
    });
  });

  describe('POST /api/heartbeats/:id/enable', () => {
    it('enables a disabled heartbeat', async () => {
      // First create a disabled heartbeat
      mockHeartbeats.push({
        id: 'hb_enable_test',
        userId: 'default',
        name: 'Disabled Heartbeat',
        cronExpression: '0 * * * *',
        enabled: false,
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/heartbeats/hb_enable_test/enable')
        .expect(200);
      expect(res.body).toHaveProperty('enabled', true);
    });
  });

  describe('POST /api/heartbeats/:id/disable', () => {
    it('disables an enabled heartbeat', async () => {
      // First create an enabled heartbeat
      mockHeartbeats.push({
        id: 'hb_disable_test',
        userId: 'default',
        name: 'Enabled Heartbeat',
        cronExpression: '0 * * * *',
        enabled: true,
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/heartbeats/hb_disable_test/disable')
        .expect(200);
      expect(res.body).toHaveProperty('enabled', false);
    });
  });

  describe('DELETE /api/heartbeats/:id', () => {
    // NOTE: The actual route returns 204 No Content for all DELETE requests
    // (both existing and non-existing heartbeats). It doesn't check if the heartbeat exists.
    it('returns 204 No Content when deleting', async () => {
      await request(app)
        .delete('/api/heartbeats/any-id')
        .expect(204);
    });

    it('deletes existing heartbeat and returns 204', async () => {
      // First create a heartbeat
      mockHeartbeats.push({
        id: 'hb_delete_test',
        userId: 'default',
        name: 'To Delete',
        cronExpression: '0 * * * *',
        enabled: true,
        createdAt: new Date().toISOString(),
      });

      await request(app)
        .delete('/api/heartbeats/hb_delete_test')
        .expect(204);
    });
  });
});

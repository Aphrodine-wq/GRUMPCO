/**
 * Heartbeats Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the heartbeat service
vi.mock('../../src/services/heartbeatService.js', () => ({
  createHeartbeat: vi.fn(),
  getHeartbeat: vi.fn(),
  getHeartbeatsForUser: vi.fn(),
  setHeartbeatEnabled: vi.fn(),
  updateHeartbeatSchedule: vi.fn(),
  deleteHeartbeat: vi.fn(),
  createHeartbeatFromTemplate: vi.fn(),
  HEARTBEAT_TEMPLATES: {
    HOURLY_SUMMARY: {
      name: 'Hourly Summary',
      cronExpression: '0 * * * *',
      description: 'Generate a summary of recent activity',
    },
    DAILY_DIGEST: {
      name: 'Daily Digest',
      cronExpression: '0 9 * * *',
      description: 'Send daily digest of tasks and updates',
    },
    WEEKLY_REVIEW: {
      name: 'Weekly Review',
      cronExpression: '0 10 * * 1',
      description: 'Weekly progress review and planning',
    },
    HEALTH_CHECK: {
      name: 'System Health Check',
      cronExpression: '*/15 * * * *',
      description: 'Check system health and integrations',
    },
    MEMORY_CLEANUP: {
      name: 'Memory Cleanup',
      cronExpression: '0 3 * * *',
      description: 'Clean up expired memories and optimize storage',
    },
  },
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import heartbeatsRouter from '../../src/routes/heartbeats.js';
import {
  createHeartbeat,
  getHeartbeat,
  getHeartbeatsForUser,
  setHeartbeatEnabled,
  updateHeartbeatSchedule,
  deleteHeartbeat,
  createHeartbeatFromTemplate,
  HEARTBEAT_TEMPLATES,
} from '../../src/services/heartbeatService.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/heartbeats', heartbeatsRouter);
  return app;
}

describe('Heartbeats Route', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /heartbeats', () => {
    it('should return list of heartbeats for user', async () => {
      const mockHeartbeats = [
        {
          id: 'hb_1',
          user_id: 'default',
          name: 'Test Heartbeat',
          cron_expression: '0 * * * *',
          enabled: true,
          payload: JSON.stringify({ foo: 'bar' }),
          last_run_at: null,
          next_run_at: '2025-01-31T12:00:00.000Z',
          created_at: '2025-01-31T10:00:00.000Z',
          updated_at: '2025-01-31T10:00:00.000Z',
        },
      ];

      vi.mocked(getHeartbeatsForUser).mockResolvedValue(mockHeartbeats);

      const response = await request(app).get('/heartbeats');

      expect(response.status).toBe(200);
      expect(response.body.heartbeats).toHaveLength(1);
      expect(response.body.heartbeats[0].name).toBe('Test Heartbeat');
      expect(response.body.heartbeats[0].payload).toEqual({ foo: 'bar' });
      expect(getHeartbeatsForUser).toHaveBeenCalledWith('default');
    });

    it('should handle empty list', async () => {
      vi.mocked(getHeartbeatsForUser).mockResolvedValue([]);

      const response = await request(app).get('/heartbeats');

      expect(response.status).toBe(200);
      expect(response.body.heartbeats).toEqual([]);
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getHeartbeatsForUser).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/heartbeats');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to list heartbeats');
    });
  });

  describe('GET /heartbeats/templates', () => {
    it('should return available templates', async () => {
      const response = await request(app).get('/heartbeats/templates');

      expect(response.status).toBe(200);
      expect(response.body.templates).toEqual(HEARTBEAT_TEMPLATES);
      expect(response.body.templates.HOURLY_SUMMARY).toBeDefined();
      expect(response.body.templates.DAILY_DIGEST).toBeDefined();
    });
  });

  describe('GET /heartbeats/:id', () => {
    it('should return heartbeat by id', async () => {
      const mockHeartbeat = {
        id: 'hb_123',
        user_id: 'default',
        name: 'Test Heartbeat',
        cron_expression: '0 * * * *',
        enabled: true,
        payload: JSON.stringify({ config: 'value' }),
        last_run_at: null,
        next_run_at: '2025-01-31T12:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      };

      vi.mocked(getHeartbeat).mockResolvedValue(mockHeartbeat);

      const response = await request(app).get('/heartbeats/hb_123');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('hb_123');
      expect(response.body.payload).toEqual({ config: 'value' });
      expect(getHeartbeat).toHaveBeenCalledWith('hb_123');
    });

    it('should return 404 if heartbeat not found', async () => {
      vi.mocked(getHeartbeat).mockResolvedValue(null);

      const response = await request(app).get('/heartbeats/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Heartbeat not found');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getHeartbeat).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/heartbeats/hb_123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get heartbeat');
    });
  });

  describe('POST /heartbeats', () => {
    it('should create a new heartbeat', async () => {
      const mockHeartbeat = {
        id: 'hb_new',
        user_id: 'default',
        name: 'New Heartbeat',
        cron_expression: '0 */2 * * *',
        enabled: true,
        payload: JSON.stringify({ data: 'test' }),
        last_run_at: null,
        next_run_at: '2025-01-31T14:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      };

      vi.mocked(createHeartbeat).mockResolvedValue(mockHeartbeat);

      const response = await request(app)
        .post('/heartbeats')
        .send({
          name: 'New Heartbeat',
          cronExpression: '0 */2 * * *',
          payload: { data: 'test' },
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('hb_new');
      expect(response.body.name).toBe('New Heartbeat');
      expect(createHeartbeat).toHaveBeenCalledWith({
        userId: 'default',
        name: 'New Heartbeat',
        cronExpression: '0 */2 * * *',
        payload: { data: 'test' },
      });
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/heartbeats')
        .send({
          cronExpression: '0 * * * *',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 for missing cronExpression', async () => {
      const response = await request(app)
        .post('/heartbeats')
        .send({
          name: 'Test',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(createHeartbeat).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/heartbeats')
        .send({
          name: 'Test',
          cronExpression: '0 * * * *',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create heartbeat');
    });
  });

  describe('POST /heartbeats/from-template', () => {
    it('should create heartbeat from template', async () => {
      const mockHeartbeat = {
        id: 'hb_template',
        user_id: 'default',
        name: 'Hourly Summary',
        cron_expression: '0 * * * *',
        enabled: true,
        payload: JSON.stringify({ template: 'HOURLY_SUMMARY' }),
        last_run_at: null,
        next_run_at: '2025-01-31T12:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      };

      vi.mocked(createHeartbeatFromTemplate).mockResolvedValue(mockHeartbeat);

      const response = await request(app)
        .post('/heartbeats/from-template')
        .send({
          template: 'HOURLY_SUMMARY',
          payload: { extra: 'data' },
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('hb_template');
      expect(createHeartbeatFromTemplate).toHaveBeenCalledWith(
        'default',
        'HOURLY_SUMMARY',
        { extra: 'data' }
      );
    });

    it('should return 400 for invalid template', async () => {
      const response = await request(app)
        .post('/heartbeats/from-template')
        .send({
          template: 'INVALID_TEMPLATE',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(createHeartbeatFromTemplate).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/heartbeats/from-template')
        .send({
          template: 'DAILY_DIGEST',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create heartbeat');
    });
  });

  describe('PATCH /heartbeats/:id/schedule', () => {
    it('should update heartbeat schedule', async () => {
      const updatedHeartbeat = {
        id: 'hb_123',
        user_id: 'default',
        name: 'Updated Heartbeat',
        cron_expression: '0 */4 * * *',
        enabled: true,
        payload: null,
        last_run_at: null,
        next_run_at: '2025-01-31T16:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T11:00:00.000Z',
      };

      vi.mocked(updateHeartbeatSchedule).mockResolvedValue(undefined);
      vi.mocked(getHeartbeat).mockResolvedValue(updatedHeartbeat);

      const response = await request(app)
        .patch('/heartbeats/hb_123/schedule')
        .send({
          cronExpression: '0 */4 * * *',
        });

      expect(response.status).toBe(200);
      expect(response.body.cron_expression).toBe('0 */4 * * *');
      expect(updateHeartbeatSchedule).toHaveBeenCalledWith('hb_123', '0 */4 * * *', 'default');
    });

    it('should return 400 for missing cronExpression', async () => {
      const response = await request(app)
        .patch('/heartbeats/hb_123/schedule')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 404 if heartbeat not found', async () => {
      vi.mocked(updateHeartbeatSchedule).mockRejectedValue(
        new Error('Heartbeat not found: hb_123')
      );

      const response = await request(app)
        .patch('/heartbeats/hb_123/schedule')
        .send({
          cronExpression: '0 * * * *',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Heartbeat not found');
    });

    it('should return 400 for invalid cron expression', async () => {
      vi.mocked(updateHeartbeatSchedule).mockRejectedValue(
        new Error('Invalid cron expression: bad-cron')
      );

      const response = await request(app)
        .patch('/heartbeats/hb_123/schedule')
        .send({
          cronExpression: 'bad-cron',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid cron');
    });

    it('should return 500 on other service errors', async () => {
      vi.mocked(updateHeartbeatSchedule).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .patch('/heartbeats/hb_123/schedule')
        .send({
          cronExpression: '0 * * * *',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update schedule');
    });
  });

  describe('POST /heartbeats/:id/enable', () => {
    it('should enable heartbeat', async () => {
      const enabledHeartbeat = {
        id: 'hb_123',
        user_id: 'default',
        name: 'Enabled Heartbeat',
        cron_expression: '0 * * * *',
        enabled: true,
        payload: null,
        last_run_at: null,
        next_run_at: '2025-01-31T12:00:00.000Z',
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T11:00:00.000Z',
      };

      vi.mocked(setHeartbeatEnabled).mockResolvedValue(undefined);
      vi.mocked(getHeartbeat).mockResolvedValue(enabledHeartbeat);

      const response = await request(app).post('/heartbeats/hb_123/enable');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(true);
      expect(setHeartbeatEnabled).toHaveBeenCalledWith('hb_123', true, 'default');
    });

    it('should return 404 if heartbeat not found', async () => {
      vi.mocked(setHeartbeatEnabled).mockRejectedValue(
        new Error('Heartbeat not found: hb_123')
      );

      const response = await request(app).post('/heartbeats/hb_123/enable');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Heartbeat not found');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(setHeartbeatEnabled).mockRejectedValue(new Error('DB error'));

      const response = await request(app).post('/heartbeats/hb_123/enable');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to enable heartbeat');
    });
  });

  describe('POST /heartbeats/:id/disable', () => {
    it('should disable heartbeat', async () => {
      const disabledHeartbeat = {
        id: 'hb_123',
        user_id: 'default',
        name: 'Disabled Heartbeat',
        cron_expression: '0 * * * *',
        enabled: false,
        payload: null,
        last_run_at: null,
        next_run_at: null,
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T11:00:00.000Z',
      };

      vi.mocked(setHeartbeatEnabled).mockResolvedValue(undefined);
      vi.mocked(getHeartbeat).mockResolvedValue(disabledHeartbeat);

      const response = await request(app).post('/heartbeats/hb_123/disable');

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
      expect(setHeartbeatEnabled).toHaveBeenCalledWith('hb_123', false, 'default');
    });

    it('should return 404 if heartbeat not found', async () => {
      vi.mocked(setHeartbeatEnabled).mockRejectedValue(
        new Error('Heartbeat not found: hb_123')
      );

      const response = await request(app).post('/heartbeats/hb_123/disable');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Heartbeat not found');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(setHeartbeatEnabled).mockRejectedValue(new Error('DB error'));

      const response = await request(app).post('/heartbeats/hb_123/disable');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to disable heartbeat');
    });
  });

  describe('DELETE /heartbeats/:id', () => {
    it('should delete heartbeat', async () => {
      vi.mocked(deleteHeartbeat).mockResolvedValue(undefined);

      const response = await request(app).delete('/heartbeats/hb_123');

      expect(response.status).toBe(204);
      expect(deleteHeartbeat).toHaveBeenCalledWith('hb_123', 'default');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(deleteHeartbeat).mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/heartbeats/hb_123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete heartbeat');
    });
  });
});

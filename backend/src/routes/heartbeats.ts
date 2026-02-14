/**
 * Heartbeats API Routes
 * Proactive scheduled tasks management
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createHeartbeat,
  getHeartbeat,
  getHeartbeatsForUser,
  setHeartbeatEnabled,
  updateHeartbeatSchedule,
  deleteHeartbeat,
  HEARTBEAT_TEMPLATES,
  createHeartbeatFromTemplate,
} from '../services/infra/heartbeatService.js';
import logger from '../middleware/logger.js';

const router = Router();

// Validation schemas
const createHeartbeatSchema = z.object({
  name: z.string().min(1).max(100),
  cronExpression: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

const updateScheduleSchema = z.object({
  cronExpression: z.string().min(1),
});

const templateSchema = z.object({
  template: z.enum([
    'HOURLY_SUMMARY',
    'DAILY_DIGEST',
    'WEEKLY_REVIEW',
    'HEALTH_CHECK',
    'MEMORY_CLEANUP',
    'REMINDER_CHECK',
    'INBOX_SUMMARY',
    'CALENDAR_REMINDER',
    'CUSTOM_REMINDER',
  ]),
  payload: z.record(z.unknown()).optional(),
});

// ========== Heartbeat CRUD ==========

/**
 * GET /heartbeats
 * List all heartbeats for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const heartbeats = await getHeartbeatsForUser(userId);

    const parsed = heartbeats.map((hb) => ({
      ...hb,
      payload: hb.payload ? JSON.parse(hb.payload) : null,
    }));

    res.json({ heartbeats: parsed });
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Failed to list heartbeats');
    res.status(500).json({ error: 'Failed to list heartbeats' });
  }
});

/**
 * GET /heartbeats/templates
 * Get available heartbeat templates
 */
router.get('/templates', (_req: Request, res: Response) => {
  res.json({ templates: HEARTBEAT_TEMPLATES });
});

/**
 * GET /heartbeats/:id
 * Get a specific heartbeat
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const heartbeat = await getHeartbeat(id);

    if (!heartbeat) {
      res.status(404).json({ error: 'Heartbeat not found' });
      return;
    }

    res.json({
      ...heartbeat,
      payload: heartbeat.payload ? JSON.parse(heartbeat.payload) : null,
    });
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Failed to get heartbeat');
    res.status(500).json({ error: 'Failed to get heartbeat' });
  }
});

/**
 * POST /heartbeats
 * Create a new heartbeat
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const data = createHeartbeatSchema.parse(req.body);

    const heartbeat = await createHeartbeat({
      userId,
      name: data.name,
      cronExpression: data.cronExpression,
      payload: data.payload,
    });

    res.status(201).json({
      ...heartbeat,
      payload: heartbeat.payload ? JSON.parse(heartbeat.payload) : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to create heartbeat');
    res.status(500).json({ error: 'Failed to create heartbeat' });
  }
});

/**
 * POST /heartbeats/from-template
 * Create a heartbeat from a template
 */
router.post('/from-template', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const { template, payload } = templateSchema.parse(req.body);

    const heartbeat = await createHeartbeatFromTemplate(userId, template, payload);

    res.status(201).json({
      ...heartbeat,
      payload: heartbeat.payload ? JSON.parse(heartbeat.payload) : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to create heartbeat from template');
    res.status(500).json({ error: 'Failed to create heartbeat' });
  }
});

/**
 * PATCH /heartbeats/:id/schedule
 * Update heartbeat schedule
 */
router.patch('/:id/schedule', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const { cronExpression } = updateScheduleSchema.parse(req.body);
    const { id } = req.params as { id: string };

    await updateHeartbeatSchedule(id, cronExpression, userId);

    const updated = await getHeartbeat(id);
    res.json({
      ...updated,
      payload: updated?.payload ? JSON.parse(updated.payload) : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
      return;
    }
    if ((err as Error).message.includes('not found')) {
      res.status(404).json({ error: 'Heartbeat not found' });
      return;
    }
    if ((err as Error).message.includes('Invalid cron')) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to update schedule');
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

/**
 * POST /heartbeats/:id/enable
 * Enable a heartbeat
 */
router.post('/:id/enable', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const { id } = req.params as { id: string };

    await setHeartbeatEnabled(id, true, userId);

    const updated = await getHeartbeat(id);
    res.json({
      ...updated,
      payload: updated?.payload ? JSON.parse(updated.payload) : null,
    });
  } catch (err) {
    if ((err as Error).message.includes('not found')) {
      res.status(404).json({ error: 'Heartbeat not found' });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to enable heartbeat');
    res.status(500).json({ error: 'Failed to enable heartbeat' });
  }
});

/**
 * POST /heartbeats/:id/disable
 * Disable a heartbeat
 */
router.post('/:id/disable', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const { id } = req.params as { id: string };

    await setHeartbeatEnabled(id, false, userId);

    const updated = await getHeartbeat(id);
    res.json({
      ...updated,
      payload: updated?.payload ? JSON.parse(updated.payload) : null,
    });
  } catch (err) {
    if ((err as Error).message.includes('not found')) {
      res.status(404).json({ error: 'Heartbeat not found' });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to disable heartbeat');
    res.status(500).json({ error: 'Failed to disable heartbeat' });
  }
});

/**
 * DELETE /heartbeats/:id
 * Delete a heartbeat
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const { id } = req.params as { id: string };

    await deleteHeartbeat(id, userId);
    res.status(204).send();
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Failed to delete heartbeat');
    res.status(500).json({ error: 'Failed to delete heartbeat' });
  }
});

export default router;

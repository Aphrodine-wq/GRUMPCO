/**
 * Settings API Routes
 * GET /api/settings – load settings (optional ?user= or X-User-Id)
 * PUT /api/settings – save settings (body: partial Settings)
 * POST /api/settings/zero-config – auto-detect and apply zero-config
 * GET /api/settings/templates – list quick-start templates
 * POST /api/settings/templates/:id – apply a template
 */

import { Router, type Request, type Response } from 'express';
import { getDatabase } from '../db/database.js';
import type { Settings } from '../types/settings.js';
import logger from '../middleware/logger.js';
import { sendServerError } from '../utils/errorResponse.js';
import {
  performZeroConfig,
  getZeroConfigHealth,
  QUICK_START_TEMPLATES,
  applyQuickStartTemplate,
  getProgressiveConfig,
} from '../services/zeroConfigService.js';

const router = Router();
const DEFAULT_USER_KEY = 'default';

function getUserKey(req: Request): string {
  const header = req.headers['x-user-id'];
  const query = req.query.user;
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (typeof query === 'string' && query.trim()) return query.trim();
  return DEFAULT_USER_KEY;
}

/**
 * GET /api/settings
 * Returns settings for the current user key.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userKey = getUserKey(req);
    const db = getDatabase();
    const settings = await db.getSettings(userKey);

    if (!settings) {
      res.json({ settings: {} as Settings });
      return;
    }

    res.json({ settings });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Settings GET failed');
    sendServerError(res, err, { type: 'settings_error' });
  }
});

/**
 * PUT /api/settings
 * Upserts settings. Body can be full Settings or a partial (merged with existing).
 */
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userKey = getUserKey(req);
    const body = req.body as Partial<Settings>;

    if (!body || typeof body !== 'object') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Request body must be a Settings object (or partial)',
      });
      return;
    }

    const db = getDatabase();
    const existing = await db.getSettings(userKey);
    const merged: Settings = {
      ...(existing ?? {}),
      ...(body.user !== undefined && { user: { ...existing?.user, ...body.user } }),
      ...(body.models !== undefined && { models: { ...existing?.models, ...body.models } }),
      ...(body.mcp !== undefined && { mcp: { ...existing?.mcp, ...body.mcp } }),
      ...(body.skills !== undefined && { skills: { ...existing?.skills, ...body.skills } }),
      ...(body.accessibility !== undefined && {
        accessibility: { ...existing?.accessibility, ...body.accessibility },
      }),
      ...(body.integrations !== undefined && {
        integrations: { ...existing?.integrations, ...body.integrations },
      }),
      ...(body.guardRails !== undefined && {
        guardRails: { ...existing?.guardRails, ...body.guardRails },
      }),
      ...(body.preferences !== undefined && {
        preferences: { ...existing?.preferences, ...body.preferences },
      }),
      ...(body.tier !== undefined && { tier: body.tier }),
    };

    await db.saveSettings(userKey, merged);
    const updated = await db.getSettings(userKey);
    res.json({ settings: updated ?? merged });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Settings PUT failed');
    sendServerError(res, err, { type: 'settings_error' });
  }
});

// ========== Zero-Config Routes ==========

/**
 * POST /api/settings/zero-config
 * Perform zero-config detection and setup
 */
router.post('/zero-config', async (req: Request, res: Response): Promise<void> => {
  try {
    const userKey = getUserKey(req);
    const result = await performZeroConfig(userKey);
    res.json(result);
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Zero-config failed');
    sendServerError(res, err, { type: 'settings_error' });
  }
});

/**
 * GET /api/settings/zero-config/health
 * Get zero-config health status
 */
router.get('/zero-config/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const health = await getZeroConfigHealth();
    res.json(health);
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Zero-config health check failed');
    sendServerError(res, err, { type: 'settings_error' });
  }
});

// ========== Template Routes ==========

/**
 * GET /api/settings/templates
 * List available quick-start templates
 */
router.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ templates: QUICK_START_TEMPLATES });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Templates list failed');
    sendServerError(res, err, { type: 'settings_error' });
  }
});

/**
 * POST /api/settings/templates/:id
 * Apply a quick-start template
 */
router.post('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userKey = getUserKey(req);
    const templateId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id ?? '');

    const success = await applyQuickStartTemplate(userKey, templateId);

    if (!success) {
      res.status(404).json({
        error: 'Template not found',
        message: `Template "${templateId}" does not exist`,
      });
      return;
    }

    res.json({ success: true, templateId });
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Template apply failed');
    sendServerError(res, err, { type: 'settings_error' });
  }
});

// ========== Progressive Disclosure Routes ==========

/**
 * GET /api/settings/progressive
 * Get progressive disclosure config for user
 */
router.get('/progressive', async (req: Request, res: Response): Promise<void> => {
  try {
    const userKey = getUserKey(req);
    const config = await getProgressiveConfig(userKey);
    res.json(config);
  } catch (error) {
    const err = error as Error;
    logger.error({ error: err.message }, 'Progressive config failed');
    sendServerError(res, err, { type: 'settings_error' });
  }
});

export default router;

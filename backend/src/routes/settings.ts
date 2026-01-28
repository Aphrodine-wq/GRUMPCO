/**
 * Settings API Routes
 * GET /api/settings – load settings (optional ?user= or X-User-Id)
 * PUT /api/settings – save settings (body: partial Settings)
 */

import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import type { Settings } from '../types/settings.js';
import { logger } from '../utils/logger.js';
import { sendServerError } from '../utils/errorResponse.js';

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
router.get('/', async (req: Request, res: Response) => {
  try {
    const userKey = getUserKey(req);
    const db = getDatabase();
    const settings = await db.getSettings(userKey);

    if (!settings) {
      return res.json({ settings: {} as Settings });
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
router.put('/', async (req: Request, res: Response) => {
  try {
    const userKey = getUserKey(req);
    const body = req.body as Partial<Settings>;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Request body must be a Settings object (or partial)',
      });
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

export default router;

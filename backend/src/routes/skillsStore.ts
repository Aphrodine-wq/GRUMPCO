/**
 * Skills Store API - install, uninstall, enable/disable
 * Complements /api/skills (registry) with install gating and state.
 */

import { Router, type Request, type Response } from 'express';
import {
  listSkillStore,
  installSkill,
  uninstallSkill,
  setSkillEnabled,
} from '../services/skillStoreService.js';
import { getErrorMessage } from '../utils/errorResponse.js';

const router = Router();

function getUserId(req: Request): string | undefined {
  const header = req.headers['x-user-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return (req as { user?: { id?: string } }).user?.id;
}

/**
 * GET /api/skills-store
 * List skills with install/enabled state
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const skills = await listSkillStore(userId);
    return res.json({ skills });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
});

/**
 * POST /api/skills-store/:id/install
 */
router.post('/:id/install', async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : (req.params.id?.[0] ?? '');
    const userId = getUserId(req);
    const result = await installSkill(id, userId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
});

/**
 * DELETE /api/skills-store/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : (req.params.id?.[0] ?? '');
    const userId = getUserId(req);
    const result = await uninstallSkill(id, userId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
});

/**
 * POST /api/skills-store/:id/enable
 * Body: { enabled: boolean }
 */
router.post('/:id/enable', async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : (req.params.id?.[0] ?? '');
    const { enabled } = req.body as { enabled?: boolean };
    const userId = getUserId(req);
    const result = await setSkillEnabled(id, enabled === true, userId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: getErrorMessage(e) });
  }
});

export default router;

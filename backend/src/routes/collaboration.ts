/**
 * Collaboration routes – project members and sharing.
 */

import { Response, Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import {
  addMember,
  getMembers,
  removeMember,
  canAccess,
  type ProjectRole,
} from '../services/collaborationService.js';

const router = Router();

router.get('/projects/:projectId/members', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!canAccess(userId, projectId, 'viewer')) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ members: getMembers(projectId) });
});

router.post('/projects/:projectId/members', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { userId: targetUserId, role } = (req.body ?? {}) as { userId?: string; role?: ProjectRole };
  const userId = req.user?.id;
  if (!userId || !targetUserId || !role) {
    res.status(400).json({ error: 'userId and role required' });
    return;
  }
  if (!canAccess(userId, projectId, 'owner')) {
    res.status(403).json({ error: 'Only owners can add members' });
    return;
  }
  addMember(projectId, targetUserId, role);
  res.status(201).json({ success: true });
});

router.delete(
  '/projects/:projectId/members/:userId',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { projectId, userId: targetUserId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!canAccess(userId, projectId, 'owner') && userId !== targetUserId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const ok = removeMember(projectId, targetUserId);
    res.status(ok ? 200 : 404).json({ success: ok });
  }
);

export default router;

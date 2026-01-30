/**
 * Collaboration routes – project members, sharing, comments, and version history.
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
import {
  addComment,
  listComments,
  addVersion,
  listVersions,
  type EntityType,
} from '../services/commentsService.js';

const router = Router();

const COMMENT_ENTITY_TYPES: EntityType[] = ['diagram', 'spec', 'plan', 'code', 'session'];
const VERSION_ENTITY_TYPES: ('spec' | 'plan' | 'diagram')[] = ['spec', 'plan', 'diagram'];

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

// Comment threads on entities
router.get(
  '/projects/:projectId/entities/:entityType/:entityId/comments',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { projectId, entityType, entityId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!canAccess(userId, projectId, 'viewer')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!COMMENT_ENTITY_TYPES.includes(entityType as EntityType)) {
      res.status(400).json({ error: 'Invalid entityType' });
      return;
    }
    const comments = listComments(entityType, entityId);
    res.json({ comments });
  }
);

router.post(
  '/projects/:projectId/entities/:entityType/:entityId/comments',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { projectId, entityType, entityId } = req.params;
    const userId = req.user?.id;
    const body = (req.body ?? {}).body as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!canAccess(userId, projectId, 'editor')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!COMMENT_ENTITY_TYPES.includes(entityType as EntityType) || typeof body !== 'string' || !body.trim()) {
      res.status(400).json({ error: 'Invalid entityType or body required' });
      return;
    }
    const parent_id = (req.body?.parent_id as string) || null;
    const comment = addComment({
      project_id: projectId,
      entity_type: entityType as EntityType,
      entity_id: entityId,
      user_id: userId,
      parent_id: parent_id || undefined,
      body: body.trim(),
    });
    res.status(201).json(comment);
  }
);

// Version history for specs, plans, diagrams
router.get(
  '/projects/:projectId/entities/:entityType/:entityId/versions',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { projectId, entityType, entityId } = req.params;
    const userId = req.user?.id;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!canAccess(userId, projectId, 'viewer')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!VERSION_ENTITY_TYPES.includes(entityType as 'spec' | 'plan' | 'diagram')) {
      res.status(400).json({ error: 'Invalid entityType for versions' });
      return;
    }
    const versions = listVersions(entityType, entityId, limit);
    res.json({ versions });
  }
);

router.post(
  '/projects/:projectId/entities/:entityType/:entityId/versions',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    const { projectId, entityType, entityId } = req.params;
    const userId = req.user?.id;
    const data = typeof (req.body ?? {}).data === 'string' ? (req.body as { data: string }).data : JSON.stringify(req.body ?? {});
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!canAccess(userId, projectId, 'editor')) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!VERSION_ENTITY_TYPES.includes(entityType as 'spec' | 'plan' | 'diagram')) {
      res.status(400).json({ error: 'Invalid entityType for versions' });
      return;
    }
    const snapshot = addVersion({
      project_id: projectId,
      entity_type: entityType as 'spec' | 'plan' | 'diagram',
      entity_id: entityId,
      data,
      created_by: userId,
    });
    res.status(201).json(snapshot);
  }
);

export default router;

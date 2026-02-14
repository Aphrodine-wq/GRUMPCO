/**
 * G-Agent Goals Sub-Router
 *
 * Goal CRUD, recurring goals, queue management, and follow-up goals.
 *
 * @module routes/gagent/gagentGoals
 */

import { Router, type Request, type Response } from 'express';
import { gAgentGoalQueue, type GoalStatus } from '../../services/agents/gAgentGoalQueue.js';
import { goalRepository } from '../../gAgent/goalRepository.js';
import logger from '../../middleware/logger.js';
import {
  validateGoalCreateRequest,
  validateRecurringGoalRequest,
  validateFollowUpGoalRequest,
  type ValidatedRequest,
  type GoalCreateRequest,
  type RecurringGoalRequest,
  type FollowUpGoalRequest,
} from '../../gAgent/security.js';

const router = Router();

// ============================================================================
// GOAL CRUD
// ============================================================================

/** POST /goals — Create a new goal */
router.post('/goals', validateGoalCreateRequest, async (req: Request, res: Response) => {
  try {
    const validatedReq = req as ValidatedRequest<GoalCreateRequest>;
    const {
      description,
      priority,
      triggerType,
      scheduledAt,
      cronExpression,
      workspaceRoot,
      tags,
      maxRetries,
    } = validatedReq.validatedBody;

    const userId = (req as Request & { userId?: string }).userId || 'default';

    const goal = await gAgentGoalQueue.createGoal({
      userId,
      description,
      priority: priority ?? 'normal',
      triggerType,
      scheduledAt,
      cronExpression,
      workspaceRoot,
      tags,
      maxRetries,
    });

    return res.status(201).json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to create goal');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /goals — List all goals for a user */
router.get('/goals', async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query as { status?: string; limit?: string };
    const userId = (req as Request & { userId?: string }).userId || 'default';

    const statusFilter = status ? (status.split(',') as GoalStatus[]) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    const goals = await gAgentGoalQueue.getUserGoals(userId, {
      status: statusFilter,
      limit: limitNum,
    });

    return res.json({ goals });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to list goals');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /history — Generation history / audit log */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    const { limit } = req.query as { limit?: string };
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;

    const goals = await goalRepository.list({
      status: ['completed'],
      userId: userId,
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: limitNum,
    });

    const history = goals.map((g) => ({
      id: g.id,
      userId: g.userId,
      description: g.description?.slice(0, 500),
      result: g.result?.slice(0, 1000),
      artifactsCount: g.artifacts?.length ?? 0,
      completedAt: g.completedAt,
      createdAt: g.createdAt,
    }));

    return res.json({ history });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get generation history');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /goals/:id — Get a specific goal */
router.get('/goals/:id', async (req: Request, res: Response) => {
  try {
    const goalId = req.params.id as string;
    const goal = await gAgentGoalQueue.getGoal(goalId);

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    return res.json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get goal');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /goals/:id/cancel — Cancel a goal */
router.post('/goals/:id/cancel', async (req: Request, res: Response) => {
  try {
    const goalId = req.params.id as string;
    const goal = await gAgentGoalQueue.cancelGoal(goalId);

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    return res.json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to cancel goal');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /goals/:id/retry — Retry a failed goal */
router.post('/goals/:id/retry', async (req: Request, res: Response) => {
  try {
    const goalId = req.params.id as string;
    const goal = await gAgentGoalQueue.retryGoal(goalId);

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found or not in failed state' });
    }

    return res.json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to retry goal');
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// RECURRING GOALS
// ============================================================================

/** POST /recurring — Create a recurring goal */
router.post('/recurring', validateRecurringGoalRequest, async (req: Request, res: Response) => {
  try {
    const validatedReq = req as ValidatedRequest<RecurringGoalRequest>;
    const { description, cronExpression, workspaceRoot, priority, tags } =
      validatedReq.validatedBody;

    const userId = (req as Request & { userId?: string }).userId || 'default';

    const goal = await gAgentGoalQueue.scheduleRecurringGoal(userId, description, cronExpression, {
      workspaceRoot,
      priority,
      tags,
    });

    return res.status(201).json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to create recurring goal');
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/** POST /queue/start — Start the goal queue processor */
router.post('/queue/start', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || 'default';
    gAgentGoalQueue.startGoalQueue(userId);
    return res.json({ started: true, userId });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to start queue');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /queue/stop — Stop the goal queue processor */
router.post('/queue/stop', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || 'default';
    gAgentGoalQueue.stopGoalQueue(userId);
    return res.json({ stopped: true, userId });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to stop queue');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /queue/stats — Get queue statistics */
router.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || 'default';
    const stats = gAgentGoalQueue.getQueueStats(userId);
    return res.json(stats);
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get queue stats');
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ============================================================================
// SELF-SCHEDULING (Follow-up goals)
// ============================================================================

/** POST /follow-up — Create a follow-up goal */
router.post('/follow-up', validateFollowUpGoalRequest, async (req: Request, res: Response) => {
  try {
    const validatedReq = req as ValidatedRequest<FollowUpGoalRequest>;
    const { parentGoalId, description, scheduledAt, priority, tags } = validatedReq.validatedBody;

    const goal = await gAgentGoalQueue.createFollowUpGoal(parentGoalId, description, {
      scheduledAt,
      priority,
      tags,
    });

    if (!goal) {
      return res.status(404).json({ error: 'Parent goal not found' });
    }

    return res.status(201).json({ goal });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to create follow-up goal');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;

/**
 * G-Agent Budget Sub-Router
 *
 * Budget status, configuration, cost estimation, session start/end.
 *
 * @module routes/gagent/gagentBudget
 */

import { Router, type Request, type Response } from 'express';
import { budgetManager, type BudgetConfig } from '../../gAgent/index.js';
import logger from '../../middleware/logger.js';

const router = Router();

/** GET /budget/status — Get current budget status */
router.get('/budget/status', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || 'default';

    const tracker = budgetManager.getTracker(sessionId);
    const status = tracker ? budgetManager.getBudgetStatus(sessionId) : null;

    let message = 'No active session';
    if (status) {
      if (status.status === 'ok') {
        message = `Budget OK - ${Math.round(status.sessionPercent * 100)}% used`;
      } else if (status.status === 'warning') {
        message = status.message || 'Budget warning';
      } else if (status.status === 'critical') {
        message = status.message || 'Budget critical';
      } else if (status.status === 'exceeded') {
        message = status.message || 'Budget exceeded';
      }
    }

    return res.json({ tracker: tracker || null, status, message });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get budget status');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /budget/config — Update budget configuration */
router.post('/budget/config', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId || 'default';
    const config: Partial<BudgetConfig> = req.body;

    if (config.sessionLimit !== undefined && config.sessionLimit < 0) {
      return res.status(400).json({ error: 'Session limit must be positive' });
    }
    if (config.dailyLimit !== undefined && config.dailyLimit < 0) {
      return res.status(400).json({ error: 'Daily limit must be positive' });
    }
    if (config.monthlyLimit !== undefined && config.monthlyLimit < 0) {
      return res.status(400).json({ error: 'Monthly limit must be positive' });
    }

    const updatedConfig = budgetManager.setConfig(userId, config);

    return res.json({ config: updatedConfig });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to update budget config');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /budget/estimate — Estimate cost for planned operations */
router.post('/budget/estimate', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || 'default';
    const operations = req.body.operations || [];

    const estimate = budgetManager.estimateCost(operations, sessionId);

    return res.json({
      estimate,
      formatted: `Estimated cost: $${(estimate.estimatedCost / 100).toFixed(2)}`,
      requiresApproval: estimate.requiresApproval,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to estimate cost');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /budget/session/start — Start cost tracking */
router.post('/budget/session/start', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const userId = (req as Request & { userId?: string }).userId || 'default';

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const tracker = budgetManager.startSession(sessionId, userId);

    return res.status(201).json({ tracker });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to start budget session');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /budget/session/end — End cost tracking */
router.post('/budget/session/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const tracker = budgetManager.endSession(sessionId);

    if (!tracker) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json({ tracker });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to end budget session');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /budget/check — Check if an operation can proceed */
router.post('/budget/check', async (req: Request, res: Response) => {
  try {
    const { sessionId, estimatedCost } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const result = budgetManager.canProceed(sessionId, estimatedCost || 0);

    return res.json(result);
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to check budget');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;

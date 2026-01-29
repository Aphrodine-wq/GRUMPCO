/**
 * Plan API Routes
 * Handles plan generation, approval, editing, and execution
 */

import { Router, Request, Response } from 'express';
import {
  generatePlan,
  getPlan,
  approvePlan,
  rejectPlan,
  editPlan,
  startPlanExecution,
  completePlanExecution,
  updatePhaseStatus,
} from '../services/planService.js';
import type {
  PlanGenerationRequest,
  PlanApprovalRequest,
  PlanEditRequest,
  PlanExecutionRequest,
  PlanPhase,
} from '../types/plan.js';
import { logger } from '../utils/logger.js';
import { sendServerError } from '../utils/errorResponse.js';

const router = Router();

/**
 * POST /api/plan/generate
 * Generate a structured plan from user request
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const request: PlanGenerationRequest = req.body;

    if (!request.userRequest) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userRequest is required',
      });
    }

    logger.debug({ requestId: req.id }, 'Plan generation request');

    const plan = await generatePlan(request);

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, 'Plan generation failed');
    sendServerError(res, error);
  }
});

/**
 * GET /api/plan/:id
 * Get plan details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await getPlan(id);

    if (!plan) {
      return res.status(404).json({
        error: 'Plan not found',
        message: `Plan ${id} does not exist`,
      });
    }

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, 'Get plan failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/:id/approve
 * Approve plan for execution
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, comments }: PlanApprovalRequest = req.body;

    if (approved === false) {
      const plan = await rejectPlan(id, comments);
      return res.json({ plan });
    }

    const plan = await approvePlan(id, req.headers['x-user-id'] as string);

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, 'Plan approval failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/:id/reject
 * Reject plan
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comments }: { comments?: string } = req.body;

    const plan = await rejectPlan(id, comments);

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, 'Plan rejection failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/:id/edit
 * Edit plan before approval
 */
router.post('/:id/edit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const edits: PlanEditRequest = req.body;

    const plan = await editPlan(id, edits);

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, 'Plan edit failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/:id/execute
 * Start plan execution
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const executionRequest: PlanExecutionRequest = req.body;

    if (executionRequest.planId !== id) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'planId in body must match URL parameter',
      });
    }

    const plan = await startPlanExecution(id);

    // If starting from a specific phase, update phase statuses
    if (executionRequest.startFromPhase) {
      const phaseIndex = plan.phases.findIndex(p => p.id === executionRequest.startFromPhase);
      if (phaseIndex > 0) {
        // Mark previous phases as completed
        for (let i = 0; i < phaseIndex; i++) {
          if (!executionRequest.skipPhases?.includes(plan.phases[i].id)) {
            await updatePhaseStatus(id, plan.phases[i].id, 'completed');
          }
        }
      }
    }

    // Skip specified phases
    if (executionRequest.skipPhases) {
      for (const phaseId of executionRequest.skipPhases) {
        await updatePhaseStatus(id, phaseId as PlanPhase, 'skipped');
      }
    }

    const updatedPlan = await getPlan(id);
    res.json({ plan: updatedPlan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, 'Plan execution start failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/:id/complete
 * Complete plan execution
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = completePlanExecution(id);

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, 'Plan completion failed');
    sendServerError(res, error);
  }
});

/**
 * POST /api/plan/:id/phase/:phaseId/status
 * Update phase status
 */
router.post('/:id/phase/:phaseId/status', async (req: Request, res: Response) => {
  try {
    const { id, phaseId } = req.params;
    const { status }: { status: 'pending' | 'in_progress' | 'completed' | 'skipped' } = req.body;

    if (!['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be one of: pending, in_progress, completed, skipped',
      });
    }

    const plan = await updatePhaseStatus(id, phaseId as PlanPhase, status);

    res.json({ plan });
  } catch (error: unknown) {
    logger.error({ error, requestId: req.id }, 'Phase status update failed');
    sendServerError(res, error);
  }
});

export default router;

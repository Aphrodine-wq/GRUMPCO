/**
 * Chat API - Design Workflow Endpoints
 *
 * Extracted from chat.ts for better modularity.
 * Contains the design workflow endpoints: start, execute, approve, complete.
 *
 * @module routes/chatDesignWorkflow
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/database.js';
import logger from '../middleware/logger.js';
import { sendErrorResponse, ErrorCode } from '../utils/errorResponse.js';
import {
  generateArchitectureForChat,
  generatePRDForChat,
  generatePlanForChat,
  generateCodeForChat,
  iteratePhase,
  type DesignWorkflowState,
  type DesignPhase,
} from '../services/ship/designWorkflowService.js';

const router = Router();

// ============================================================================
// DESIGN WORKFLOW ENDPOINTS
// ============================================================================

/**
 * POST /api/chat/design/start
 * Start a new design workflow session
 */
router.post('/start', async (req: Request, res: Response) => {
  const startSchema = z.object({
    projectDescription: z.string().min(1),
    sessionId: z.string().optional(),
  });

  try {
    const { projectDescription, sessionId } = startSchema.parse(req.body);

    const workflowState: DesignWorkflowState = {
      currentPhase: 'architecture',
      phaseData: {},
      userApprovals: {
        architecture: false,
        prd: false,
        plan: false,
        code: false,
        completed: false,
      },
      isActive: true,
      projectDescription,
    };

    // If sessionId provided, store workflow state with session
    if (sessionId) {
      const db = getDatabase();
      const session = await db.getSession(sessionId);
      if (session) {
        session.designWorkflow = workflowState;
        await db.saveSession(session);
      }
    }

    res.json({
      success: true,
      workflowState,
      message: 'Design workflow started. Begin by describing your project.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'Invalid request: ' + error.errors.map((e) => e.message).join(', ')
      );
    } else {
      logger.error({ error }, 'Failed to start design workflow');
      sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Failed to start design workflow');
    }
  }
});

/**
 * POST /api/chat/design/execute
 * Execute current design phase
 */
router.post('/execute', async (req: Request, res: Response) => {
  const executeSchema = z.object({
    sessionId: z.string(),
    phase: z.enum(['architecture', 'prd', 'plan', 'code']),
    feedback: z.string().optional(),
    existingProject: z.boolean().optional(),
  });

  try {
    const { sessionId, phase, feedback, existingProject } = executeSchema.parse(req.body);

    const db = getDatabase();
    const session = await db.getSession(sessionId);

    if (!session) {
      sendErrorResponse(res, ErrorCode.NOT_FOUND, 'Session not found');
      return;
    }

    if (!session.designWorkflow?.isActive) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'Design workflow not active');
      return;
    }

    const workflow = session.designWorkflow;

    // Handle iteration if feedback provided
    if (feedback && workflow.phaseData[phase]) {
      await iteratePhase(
        phase,
        workflow.phaseData[phase]!,
        feedback,
        workflow.projectDescription || ''
      );
    }

    let result;
    switch (phase) {
      case 'architecture':
        result = await generateArchitectureForChat(
          workflow.projectDescription || '',
          existingProject || false
        );
        break;
      case 'prd':
        if (!workflow.phaseData.architecture) {
          sendErrorResponse(
            res,
            ErrorCode.VALIDATION_ERROR,
            'Architecture phase must be completed first'
          );
          return;
        }
        result = await generatePRDForChat(
          workflow.projectDescription || '',
          workflow.phaseData.architecture
        );
        break;
      case 'plan':
        if (!workflow.phaseData.prd) {
          sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'PRD phase must be completed first');
          return;
        }
        result = await generatePlanForChat(
          workflow.projectDescription || '',
          workflow.phaseData.prd
        );
        break;
      case 'code':
        if (!workflow.phaseData.plan) {
          sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'Plan phase must be completed first');
          return;
        }
        result = await generateCodeForChat(
          workflow.projectDescription || '',
          workflow.phaseData.plan
        );
        break;
    }

    // Store result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (workflow.phaseData as any)[phase] = result;
    await db.saveSession(session);

    res.json({
      success: true,
      phase,
      result,
      message: `${phase} phase completed. Review the result and approve to continue or provide feedback for changes.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'Invalid request: ' + error.errors.map((e) => e.message).join(', ')
      );
    } else {
      logger.error({ error }, 'Design workflow execution failed');
      sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Design workflow execution failed');
    }
  }
});

/**
 * POST /api/chat/design/approve
 * Approve current phase and advance to next
 */
router.post('/approve', async (req: Request, res: Response) => {
  const approveSchema = z.object({
    sessionId: z.string(),
    approved: z.boolean(),
    feedback: z.string().optional(),
  });

  try {
    const { sessionId, approved, feedback } = approveSchema.parse(req.body);

    const db = getDatabase();
    const session = await db.getSession(sessionId);

    if (!session) {
      sendErrorResponse(res, ErrorCode.NOT_FOUND, 'Session not found');
      return;
    }

    if (!session.designWorkflow?.isActive) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'Design workflow not active');
      return;
    }

    const workflow = session.designWorkflow;
    const currentPhase = workflow.currentPhase;

    if (currentPhase === 'completed') {
      res.json({
        success: true,
        message: 'Workflow already completed',
        workflowState: workflow,
      });
      return;
    }

    if (!approved && feedback) {
      // Store feedback for iteration
      (workflow.phaseData as Record<string, unknown>)[`${currentPhase}Feedback`] = feedback;
      await db.saveSession(session);

      res.json({
        success: true,
        message: `Feedback received for ${currentPhase}. The AI will iterate based on your feedback.`,
        workflowState: workflow,
        needsIteration: true,
      });
      return;
    }

    if (approved) {
      // Mark current phase as approved and advance
      workflow.userApprovals[currentPhase] = true;

      const phases: DesignPhase[] = ['architecture', 'prd', 'plan', 'code', 'completed'];
      const currentIndex = phases.indexOf(currentPhase);
      workflow.currentPhase = phases[currentIndex + 1] || 'completed';

      await db.saveSession(session);

      const nextPhaseName =
        workflow.currentPhase === 'completed' ? 'completion' : phases[currentIndex + 1];

      res.json({
        success: true,
        message: `${currentPhase} approved! Moving to ${nextPhaseName}.`,
        workflowState: workflow,
        nextPhase: workflow.currentPhase,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Waiting for approval or feedback',
      workflowState: workflow,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'Invalid request: ' + error.errors.map((e) => e.message).join(', ')
      );
    } else {
      logger.error({ error }, 'Design workflow approval failed');
      sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Design workflow approval failed');
    }
  }
});

/**
 * POST /api/chat/design/complete
 * Mark design workflow as completed
 */
router.post('/complete', async (req: Request, res: Response) => {
  const completeSchema = z.object({
    sessionId: z.string(),
  });

  try {
    const { sessionId } = completeSchema.parse(req.body);

    const db = getDatabase();
    const session = await db.getSession(sessionId);

    if (!session) {
      sendErrorResponse(res, ErrorCode.NOT_FOUND, 'Session not found');
      return;
    }

    if (session.designWorkflow) {
      session.designWorkflow.isActive = false;
      session.designWorkflow.currentPhase = 'completed';
      session.designWorkflow.userApprovals.completed = true;
      await db.saveSession(session);
    }

    res.json({
      success: true,
      message: 'Design workflow completed successfully!',
      workflowState: session.designWorkflow,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'Invalid request: ' + error.errors.map((e) => e.message).join(', ')
      );
    } else {
      logger.error({ error }, 'Failed to complete design workflow');
      sendErrorResponse(res, ErrorCode.INTERNAL_ERROR, 'Failed to complete design workflow');
    }
  }
});

export default router;

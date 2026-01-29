/**
 * SHIP Mode Routes
 * API endpoints for SHIP mode workflow
 */

import { Router, Request, Response } from 'express';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError, writeSSEError } from '../utils/errorResponse.js';
import { validateShipRequest, handleShipValidationErrors } from '../middleware/validator.js';
import {
  startShipMode,
  getShipSession,
  executeDesignPhase,
  executeSpecPhase,
  executePlanPhase,
  executeCodePhase,
} from '../services/shipModeService.js';
import { enqueueShipJob } from '../services/jobQueue.js';
import { isServerlessRuntime } from '../config/runtime.js';
import type { ShipStartRequest, ShipPhase } from '../types/ship.js';

const router = Router();
const log = getRequestLogger();

const PHASE_ORDER: ShipPhase[] = ['design', 'spec', 'plan', 'code'];

/**
 * POST /api/ship/start
 * Start a new SHIP mode session
 */
router.post(
  '/start',
  validateShipRequest,
  handleShipValidationErrors,
  async (req: Request, res: Response) => {
  try {
    const desc = (req.body.projectDescription as string).trim();
    const request: ShipStartRequest = {
      projectDescription: desc,
      preferences: req.body.preferences,
      projectId: req.body.projectId,
    };
    const session = await startShipMode(request);
    
    log.info({ sessionId: session.id }, 'SHIP mode session started');
    
    res.json({
      sessionId: session.id,
      phase: session.phase,
      status: session.status,
      createdAt: session.createdAt,
    });
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to start SHIP mode session');
    sendServerError(res, error);
  }
});

/**
 * GET /api/ship/:sessionId
 * Get SHIP mode session status
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getShipSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      sessionId: session.id,
      projectDescription: session.projectDescription,
      preferences: session.preferences,
      projectId: session.projectId,
      phase: session.phase,
      status: session.status,
      designResult: session.designResult,
      specResult: session.specResult,
      planResult: session.planResult,
      codeResult: session.codeResult,
      error: session.error,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to get SHIP mode session');
    sendServerError(res, error);
  }
});

/**
 * POST /api/ship/:sessionId/execute
 * Enqueue SHIP mode workflow; worker runs it. Returns immediately.
 */
router.post('/:sessionId/execute', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getShipSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const jobId = await enqueueShipJob(sessionId);
    log.info({ sessionId, jobId }, 'SHIP mode job enqueued');
    res.status(202).json({
      sessionId,
      jobId,
      status: 'running',
      message: 'SHIP mode workflow enqueued',
    });
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to enqueue SHIP mode');
    sendServerError(res, error);
  }
});

/**
 * POST /api/ship/:sessionId/execute/stream
 * Execute SHIP mode workflow with streaming updates.
 * Optional query or body: resumeFromPhase = 'design' | 'spec' | 'plan' | 'code' to start from a given phase (previous phases must be completed).
 */
router.post('/:sessionId/execute/stream', async (req, res) => {
  try {
    if (isServerlessRuntime) {
      res.status(400).json({ error: 'Streaming execution is not supported in serverless mode. Use /execute and poll.' });
      return;
    }
    const { sessionId } = req.params;
    const resumeFromPhase = (req.query.resumeFromPhase as ShipPhase) || (req.body?.resumeFromPhase as ShipPhase);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    log.info({ sessionId, resumeFromPhase }, 'Starting SHIP mode streaming execution');

    const startPhase: ShipPhase = PHASE_ORDER.includes(resumeFromPhase) ? resumeFromPhase : 'design';
    res.write(`data: ${JSON.stringify({ type: 'start', sessionId, phase: startPhase })}\n\n`);

    try {
      let session = await getShipSession(sessionId);
      if (!session) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Session not found' })}\n\n`);
        res.end();
        return;
      }

      const initialSession = session;
      function canResumeFrom(phase: ShipPhase): boolean {
        if (phase === 'design') return true;
        if (phase === 'spec') return initialSession.designResult?.status === 'completed';
        if (phase === 'plan') return initialSession.designResult?.status === 'completed' && initialSession.specResult?.status === 'completed';
        if (phase === 'code') return initialSession.designResult?.status === 'completed' && initialSession.specResult?.status === 'completed' && initialSession.planResult?.status === 'completed';
        return false;
      }

      if (startPhase !== 'design' && !canResumeFrom(startPhase)) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Cannot resume: previous phase(s) not completed' })}\n\n`);
        res.end();
        return;
      }

      const startIndex = PHASE_ORDER.indexOf(startPhase);
      const runDesign = startIndex <= 0 && (!session.designResult || startPhase === 'design');
      const runSpec = startIndex <= 1 && session.designResult?.status === 'completed' && (!session.specResult || startPhase === 'spec');
      const runPlan = startIndex <= 2 && session.specResult?.status === 'completed' && (!session.planResult || startPhase === 'plan' || startPhase === 'spec');
      const runCode = startIndex <= 3 && session.planResult?.status === 'completed' && session.designResult?.status === 'completed' && (!session.codeResult || startPhase === 'code' || startPhase === 'plan' || startPhase === 'spec');

      if (runDesign) {
        res.write(`data: ${JSON.stringify({ type: 'phase_start', phase: 'design' })}\n\n`);
        const designResult = await executeDesignPhase(session);
        const nextSession = await getShipSession(sessionId);
        if (!nextSession) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Session not found after design' })}\n\n`);
          res.end();
          return;
        }
        session = nextSession;
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'design', result: designResult, nextPhase: 'spec' })}\n\n`);
        if (designResult.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'error', phase: 'design', error: designResult.error })}\n\n`);
          res.end();
          return;
        }
      }

      if (runSpec) {
        res.write(`data: ${JSON.stringify({ type: 'phase_start', phase: 'spec' })}\n\n`);
        const designResult = session.designResult;
        if (!designResult) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Design result missing' })}\n\n`);
          res.end();
          return;
        }
        const specResult = await executeSpecPhase(session, designResult);
        const nextSession = await getShipSession(sessionId);
        if (!nextSession) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Session not found after spec' })}\n\n`);
          res.end();
          return;
        }
        session = nextSession;
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'spec', result: specResult, nextPhase: 'plan' })}\n\n`);
        if (specResult.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'error', phase: 'spec', error: specResult.error })}\n\n`);
          res.end();
          return;
        }
      }

      if (runPlan) {
        res.write(`data: ${JSON.stringify({ type: 'phase_start', phase: 'plan' })}\n\n`);
        const specResultForPlan = session.specResult;
        if (!specResultForPlan) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Spec result missing for plan' })}\n\n`);
          res.end();
          return;
        }
        const planResult = await executePlanPhase(session, specResultForPlan);
        const nextSession = await getShipSession(sessionId);
        if (!nextSession) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Session not found after plan' })}\n\n`);
          res.end();
          return;
        }
        session = nextSession;
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'plan', result: planResult, nextPhase: 'code' })}\n\n`);
        if (planResult.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'error', phase: 'plan', error: planResult.error })}\n\n`);
          res.end();
          return;
        }
      }

      if (runCode) {
        res.write(`data: ${JSON.stringify({ type: 'phase_start', phase: 'code' })}\n\n`);
        const planResult = session.planResult;
        const designResult = session.designResult;
        if (!planResult || !designResult) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Plan or design result missing' })}\n\n`);
          res.end();
          return;
        }
        const codeResult = await executeCodePhase(session, planResult, designResult);
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'code', result: codeResult, nextPhase: 'completed' })}\n\n`);
        if (codeResult.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'error', phase: 'code', error: codeResult.error })}\n\n`);
          res.end();
          return;
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'complete', sessionId })}\n\n`);
      res.end();
    } catch (error) {
      const err = error as Error;
      log.error({ sessionId, error: err.message }, 'SHIP mode streaming execution error');
      writeSSEError(res, err);
      res.end();
    }
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to start SHIP mode streaming');
    sendServerError(res, error);
  }
});

export default router;

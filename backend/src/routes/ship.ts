/**
 * SHIP Mode Routes
 * API endpoints for SHIP mode workflow
 */

import { Router } from 'express';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError, writeSSEError } from '../utils/errorResponse.js';
import { validateShipRequest, handleShipValidationErrors } from '../middleware/validator.js';
import {
  startShipMode,
  getShipSession,
  executeShipMode,
  executeDesignPhase,
  executeSpecPhase,
  executePlanPhase,
  executeCodePhase,
} from '../services/shipModeService.js';
import { enqueueShipJob } from '../services/jobQueue.js';
import type { ShipStartRequest } from '../types/ship.js';

const router = Router();
const log = getRequestLogger();

/**
 * POST /api/ship/start
 * Start a new SHIP mode session
 */
router.post(
  '/start',
  validateShipRequest,
  handleShipValidationErrors,
  async (req, res) => {
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
 * Execute SHIP mode workflow with streaming updates
 */
router.post('/:sessionId/execute/stream', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    log.info({ sessionId }, 'Starting SHIP mode streaming execution');
    
    // Send initial status
    res.write(`data: ${JSON.stringify({ type: 'start', sessionId, phase: 'design' })}\n\n`);
    
    // Execute phases sequentially with streaming updates
    try {
      const session = await getShipSession(sessionId);
      if (!session) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Session not found' })}\n\n`);
        res.end();
        return;
      }
      
      // Phase 1: Design
      if (!session.designResult) {
        res.write(`data: ${JSON.stringify({ type: 'phase_start', phase: 'design' })}\n\n`);
        const designResult = await executeDesignPhase(session);
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'design', result: designResult, nextPhase: 'spec' })}\n\n`);
        
        if (designResult.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'error', phase: 'design', error: designResult.error })}\n\n`);
          res.end();
          return;
        }
      }
      
      // Phase 2: Spec
      if (!session.specResult && session.designResult?.status === 'completed') {
        res.write(`data: ${JSON.stringify({ type: 'phase_start', phase: 'spec' })}\n\n`);
        const specResult = await executeSpecPhase(session, session.designResult);
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'spec', result: specResult, nextPhase: 'plan' })}\n\n`);
        
        if (specResult.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'error', phase: 'spec', error: specResult.error })}\n\n`);
          res.end();
          return;
        }
      }
      
      // Phase 3: Plan
      if (!session.planResult && session.specResult?.status === 'completed') {
        res.write(`data: ${JSON.stringify({ type: 'phase_start', phase: 'plan' })}\n\n`);
        const planResult = await executePlanPhase(session, session.specResult);
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'plan', result: planResult, nextPhase: 'code' })}\n\n`);
        
        if (planResult.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'error', phase: 'plan', error: planResult.error })}\n\n`);
          res.end();
          return;
        }
      }
      
      // Phase 4: Code
      if (!session.codeResult && session.planResult?.status === 'completed' && session.designResult?.status === 'completed') {
        res.write(`data: ${JSON.stringify({ type: 'phase_start', phase: 'code' })}\n\n`);
        const codeResult = await executeCodePhase(session, session.planResult, session.designResult);
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'code', result: codeResult, nextPhase: 'completed' })}\n\n`);
        
        if (codeResult.status === 'failed') {
          res.write(`data: ${JSON.stringify({ type: 'error', phase: 'code', error: codeResult.error })}\n\n`);
          res.end();
          return;
        }
      }
      
      // Complete
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

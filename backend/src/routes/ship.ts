/**
 * SHIP Mode Routes
 * API endpoints for SHIP mode workflow
 */

import { Router } from 'express';
import { getRequestLogger } from '../middleware/logger.js';
import {
  startShipMode,
  getShipSession,
  executeShipMode,
  executeDesignPhase,
  executeSpecPhase,
  executePlanPhase,
  executeCodePhase,
} from '../services/shipModeService.js';
import type { ShipStartRequest } from '../types/ship.js';

const router = Router();
const log = getRequestLogger();

/**
 * POST /api/ship/start
 * Start a new SHIP mode session
 */
router.post('/start', async (req, res) => {
  try {
    const request: ShipStartRequest = {
      projectDescription: req.body.projectDescription,
      preferences: req.body.preferences,
    };
    
    if (!request.projectDescription) {
      return res.status(400).json({ error: 'projectDescription is required' });
    }
    
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
    res.status(500).json({ error: (error as Error).message });
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
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/ship/:sessionId/execute
 * Execute SHIP mode workflow (runs all phases sequentially)
 */
router.post('/:sessionId/execute', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    log.info({ sessionId }, 'Executing SHIP mode workflow');
    
    // Execute asynchronously and return immediately
    executeShipMode(sessionId).catch((error) => {
      log.error({ sessionId, error: (error as Error).message }, 'SHIP mode execution error');
    });
    
    res.json({
      sessionId,
      status: 'running',
      message: 'SHIP mode workflow started',
    });
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to execute SHIP mode');
    res.status(500).json({ error: (error as Error).message });
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
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'design', result: designResult })}\n\n`);
        
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
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'spec', result: specResult })}\n\n`);
        
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
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'plan', result: planResult })}\n\n`);
        
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
        res.write(`data: ${JSON.stringify({ type: 'phase_complete', phase: 'code', result: codeResult })}\n\n`);
        
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
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    log.error({ error: (error as Error).message }, 'Failed to start SHIP mode streaming');
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

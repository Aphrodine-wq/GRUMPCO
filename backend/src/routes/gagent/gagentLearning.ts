/**
 * G-Agent Learning Sub-Router
 *
 * Real-time learning API: feedback processing and metrics.
 *
 * @module routes/gagent/gagentLearning
 */

import { Router, type Request, type Response } from 'express';
import { getSemanticCompiler } from '../../gAgent/index.js';
import logger from '../../middleware/logger.js';

const router = Router();

/** POST /compiler/learning/feedback — Process user feedback */
router.post('/compiler/learning/feedback', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || 'default';
    const {
      query,
      compiledContext,
      includedUnits,
      type,
      rating,
      correction,
      missingFiles,
      unwantedFiles,
      userComment,
    } = req.body;

    if (!query || !type) {
      return res.status(400).json({ error: 'query and type are required' });
    }

    const compiler = getSemanticCompiler(sessionId);
    const signals = compiler.processFeedback({
      query,
      compiledContext: compiledContext || '',
      includedUnits: includedUnits || [],
      type,
      rating,
      correction,
      missingFiles,
      unwantedFiles,
      userComment,
    });

    logger.info(
      { sessionId, feedbackType: type, signalsGenerated: signals.length },
      'User feedback processed'
    );

    return res.json({
      success: true,
      signals,
      message: `Generated ${signals.length} learning signals`,
    });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Feedback processing failed');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /compiler/learning/metrics — Get learning metrics */
router.get('/compiler/learning/metrics', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || 'default';
    const compiler = getSemanticCompiler(sessionId);
    const metrics = compiler.getLearningMetrics();

    return res.json({ success: true, sessionId, metrics });
  } catch (e) {
    logger.error({ error: (e as Error).message }, 'Failed to get learning metrics');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;

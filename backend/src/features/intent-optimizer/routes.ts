/**
 * Intent Optimizer Routes
 *
 * API endpoints for intent optimization
 * POST /api/intent/optimize - Optimize raw intent for codegen or architecture mode
 */

import { Router, type Request, type Response } from 'express';
import logger from '../../middleware/logger.js';
import { sendServerError } from '../../utils/errorResponse.js';
import { optimizeIntentWithMetadata } from './intentOptimizer.js';
import { type OptimizationMode, type OptimizationRequest } from './types.js';

const router = Router();

interface OptimizeBody {
  intent: string;
  mode: OptimizationMode;
  projectContext?: {
    name?: string;
    existingTechStack?: string[];
    phase?: 'greenfield' | 'maintenance' | 'migration';
    teamSize?: number;
    timeline?: string;
    budget?: string;
  };
  options?: {
    includeImplementationDetails?: boolean;
    includeDesignPatterns?: boolean;
    clarificationQuestionsCount?: number;
    includeNFRs?: boolean;
    maxFeatures?: number;
  };
}

/**
 * POST /api/intent/optimize
 * Body: { intent: string, mode: 'codegen' | 'architecture', projectContext?: object, options?: object }
 * Response: { optimized: OptimizedIntent, original: string, confidence: number, metadata: {...} }
 *
 * Optimizes raw or parsed intent and returns a cleaned, design-ready version.
 */
router.post(
  '/optimize',
  async (req: Request<Record<string, never>, object, OptimizeBody>, res: Response) => {
    const log = logger.child({ requestId: req.headers['x-request-id'] || 'unknown' });
    const { intent, mode, projectContext, options } = req.body;

    // Validate required fields
    if (!intent || typeof intent !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid "intent" field - must be a non-empty string',
        type: 'validation_error',
      });
      return;
    }

    if (!mode || !['codegen', 'architecture'].includes(mode)) {
      res.status(400).json({
        error: 'Missing or invalid "mode" field - must be "codegen" or "architecture"',
        type: 'validation_error',
      });
      return;
    }

    // Validate intent length
    if (intent.trim().length === 0) {
      res.status(400).json({
        error: 'Intent cannot be empty',
        type: 'validation_error',
      });
      return;
    }

    if (intent.length > 10000) {
      res.status(400).json({
        error: 'Intent exceeds maximum length of 10000 characters',
        type: 'validation_error',
      });
      return;
    }

    try {
      log.info(
        {
          rawLength: intent.length,
          mode,
          hasContext: !!projectContext,
        },
        'Intent optimization API requested'
      );

      const request: OptimizationRequest = {
        intent: intent.trim(),
        mode,
        projectContext,
        options,
      };

      const result = await optimizeIntentWithMetadata(request);

      res.json({
        success: true,
        data: result,
      });
    } catch (e) {
      const err = e as Error;
      log.error({ error: err.message, stack: err.stack }, 'Intent optimization failed');
      sendServerError(res, err);
    }
  }
);

/**
 * POST /api/intent/optimize/batch
 * Body: { intents: Array<{ intent: string, mode: OptimizationMode }>, projectContext?: object }
 * Response: Array of optimization results
 *
 * Batch optimization endpoint for multiple intents
 */
router.post('/optimize/batch', async (req: Request, res: Response) => {
  const log = logger.child({ requestId: req.headers['x-request-id'] || 'unknown' });
  const { intents, projectContext } = req.body;

  if (!Array.isArray(intents) || intents.length === 0) {
    res.status(400).json({
      error: 'Missing or invalid "intents" field - must be a non-empty array',
      type: 'validation_error',
    });
    return;
  }

  if (intents.length > 10) {
    res.status(400).json({
      error: 'Batch size exceeds maximum of 10 intents',
      type: 'validation_error',
    });
    return;
  }

  try {
    log.info({ batchSize: intents.length }, 'Batch intent optimization requested');

    const results = await Promise.all(
      intents.map(async (item: { intent: string; mode: OptimizationMode; options?: object }) => {
        const request: OptimizationRequest = {
          intent: item.intent.trim(),
          mode: item.mode,
          projectContext,
          options: item.options,
        };
        return optimizeIntentWithMetadata(request);
      })
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (e) {
    const err = e as Error;
    log.error({ error: err.message }, 'Batch intent optimization failed');
    sendServerError(res, err);
  }
});

/**
 * GET /api/intent/optimize/health
 * Health check for intent optimizer service
 */
router.get('/optimize/health', (_req: Request, res: Response) => {
  const nimConfigured = !!process.env.NVIDIA_NIM_API_KEY;

  res.json({
    status: nimConfigured ? 'ok' : 'degraded',
    service: 'intent-optimizer',
    version: '1.0.0',
    nimConfigured,
  });
});

/**
 * GET /api/intent/optimize/modes
 * Get available optimization modes and their descriptions
 */
router.get('/optimize/modes', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      modes: [
        {
          id: 'codegen',
          name: 'Code Generation',
          description:
            'Optimize intent for code generation with focus on implementation details, code patterns, and specific libraries',
          bestFor: [
            'Generating production code',
            'Creating test suites',
            'Refactoring existing code',
          ],
        },
        {
          id: 'architecture',
          name: 'Architecture Review',
          description:
            'Optimize intent for architecture review with focus on high-level design, system structure, and scalability',
          bestFor: ['System design reviews', 'Architecture planning', 'Component modeling'],
        },
      ],
    },
  });
});

export default router;

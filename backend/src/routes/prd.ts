/**
 * PRD Routes
 * Endpoints for PRD generation
 */

import express, { Request, Response, Router } from 'express';
import {
  generatePRD,
  generatePRDStream,
  suggestComponentsFromArchitecture,
  generatePRDForComponent,
} from '../services/prdGeneratorService.js';
import { getRequestLogger } from '../middleware/logger.js';
import type { PRDRequest, ConversationMessage } from '../types/index.js';
import type { SystemArchitecture } from '../types/architecture.js';

const router: Router = express.Router();

interface PRDRequestBody extends PRDRequest {
  conversationHistory?: ConversationMessage[];
  architecture?: SystemArchitecture;
}

/**
 * POST /api/prd/generate
 * Generate PRD from architecture
 */
router.post('/generate', async (req: Request<{}, {}, PRDRequestBody>, res: Response) => {
  const log = getRequestLogger();

  try {
    const { projectName, projectDescription, architecture, refinements, conversationHistory } = req.body;

    if (!projectName || typeof projectName !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid projectName',
        type: 'validation_error',
      });
      return;
    }

    if (!projectDescription || typeof projectDescription !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid projectDescription',
        type: 'validation_error',
      });
      return;
    }

    if (!architecture) {
      res.status(400).json({
        error: 'Missing architecture. Please provide architecture from previous phase.',
        type: 'validation_error',
      });
      return;
    }

    log.info(
      {
        projectName,
        architectureId: architecture.id,
        refinementsLength: refinements?.length,
      },
      'PRD generation requested'
    );

    const response = await generatePRD(
      {
        architectureId: architecture.id,
        projectName,
        projectDescription,
        refinements,
      },
      architecture,
      conversationHistory
    );

    if (response.status === 'error') {
      res.status(400).json(response);
      return;
    }

    res.json(response);
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'PRD generation endpoint error');
    res.status(500).json({
      error: 'Failed to generate PRD',
      type: 'internal_error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * POST /api/prd/generate-stream
 * Generate PRD with streaming response
 */
router.post('/generate-stream', async (req: Request<{}, {}, PRDRequestBody>, res: Response) => {
  const log = getRequestLogger();

  try {
    const { projectName, projectDescription, architecture, refinements, conversationHistory } = req.body;

    if (!projectName || typeof projectName !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid projectName',
        type: 'validation_error',
      });
      return;
    }

    if (!architecture) {
      res.status(400).json({
        error: 'Missing architecture',
        type: 'validation_error',
      });
      return;
    }

    log.info({}, 'PRD stream generation requested');

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const generator = generatePRDStream(
      {
        architectureId: architecture.id,
        projectName,
        projectDescription,
        refinements,
      },
      architecture,
      conversationHistory
    );

    for await (const chunk of generator) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'PRD stream endpoint error');
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/prd/components-from-diagram
 * Suggest major components from architecture for PRD-per-component.
 * Body: { architecture: SystemArchitecture }
 */
router.post(
  '/components-from-diagram',
  async (req: Request<{}, {}, { architecture: SystemArchitecture }>, res: Response) => {
    const log = getRequestLogger();
    try {
      const { architecture } = req.body;
      if (!architecture?.metadata) {
        res.status(400).json({
          error: 'Missing or invalid architecture',
          type: 'validation_error',
        });
        return;
      }
      log.info({ architectureId: architecture.id }, 'Components-from-diagram requested');
      const components = await suggestComponentsFromArchitecture(architecture);
      res.json({ components });
    } catch (e) {
      const err = e as Error;
      log.error({ error: err.message }, 'Components-from-diagram failed');
      res.status(500).json({
        error: err.message || 'Failed to suggest components',
        type: 'internal_error',
      });
    }
  }
);

/**
 * POST /api/prd/generate-for-component
 * Generate one PRD for a single component.
 * Body: { componentId: string; componentLabel?: string; architecture: SystemArchitecture; projectName?: string; projectDescription?: string }
 */
router.post(
  '/generate-for-component',
  async (
    req: Request<
      {},
      {},
      {
        componentId: string;
        componentLabel?: string;
        architecture: SystemArchitecture;
        projectName?: string;
        projectDescription?: string;
      }
    >,
    res: Response
  ) => {
    const log = getRequestLogger();
    try {
      const { componentId, componentLabel, architecture, projectName, projectDescription } = req.body;
      if (!componentId || !architecture?.metadata) {
        res.status(400).json({
          error: 'Missing componentId or architecture',
          type: 'validation_error',
        });
        return;
      }
      const pn = projectName ?? architecture.projectName ?? 'Project';
      const pd = projectDescription ?? architecture.projectDescription ?? '';
      log.info({ componentId, componentLabel }, 'Generate PRD for component requested');
      const prd = await generatePRDForComponent(
        componentId,
        componentLabel,
        architecture,
        pn,
        pd
      );
      res.json({ prd });
    } catch (e) {
      const err = e as Error;
      log.error({ error: err.message, componentId: req.body?.componentId }, 'Generate-for-component failed');
      res.status(500).json({
        error: err.message || 'Failed to generate PRD for component',
        type: 'internal_error',
      });
    }
  }
);

/**
 * POST /api/prd/refine
 * Refine existing PRD
 */
router.post('/refine', async (req: Request<{}, {}, { prdId?: string; refinements: string[] }>, res: Response) => {
  const log = getRequestLogger();

  try {
    const { prdId, refinements } = req.body;

    if (!refinements || !Array.isArray(refinements) || refinements.length === 0) {
      res.status(400).json({
        error: 'Missing or invalid refinements',
        type: 'validation_error',
      });
      return;
    }

    log.info(
      { prdId, refinementCount: refinements.length },
      'PRD refinement requested'
    );

    res.json({
      id: prdId,
      status: 'refined',
      message: 'PRD refinement noted. Use in code generation phase.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'PRD refine endpoint error');
    res.status(500).json({
      error: 'Failed to refine PRD',
      type: 'internal_error',
    });
  }
});

export default router;

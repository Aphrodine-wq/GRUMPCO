/**
 * Architecture Routes
 * Endpoints for system architecture generation
 */

import express, { Request, Response, Router } from 'express';
import { generateArchitecture, generateArchitectureStream } from '../services/architectureService.js';
import { getRequestLogger } from '../middleware/logger.js';
import type { ArchitectureRequest, ConversationMessage } from '../types/index.js';
import type { EnrichedIntent } from '../services/intentCompilerService.js';

const router: Router = express.Router();

interface ArchitectureRequestBody extends ArchitectureRequest {
  conversationHistory?: ConversationMessage[];
  enrichedIntent?: EnrichedIntent;
}

/**
 * POST /api/architecture/generate
 * Generate system architecture from project description
 */
router.post('/generate', async (req: Request<{}, {}, ArchitectureRequestBody>, res: Response) => {
  const log = getRequestLogger();

  try {
    const { projectDescription, projectType, techStack, complexity, refinements, conversationHistory, enrichedIntent } = req.body;

    const desc = projectDescription ?? enrichedIntent?.raw;
    if (!desc || typeof desc !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid projectDescription or enrichedIntent.raw',
        type: 'validation_error',
      });
      return;
    }

    log.info(
      {
        projectType,
        techStackLength: techStack?.length,
        complexity,
        refinementsLength: refinements?.length,
        hasEnrichedIntent: !!enrichedIntent,
      },
      'Architecture generation requested'
    );

    const response = await generateArchitecture(
      {
        projectDescription: desc,
        projectType,
        techStack,
        complexity,
        refinements,
      },
      conversationHistory,
      enrichedIntent
    );

    if (response.status === 'error') {
      res.status(400).json(response);
      return;
    }

    res.json(response);
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'Architecture generation endpoint error');
    res.status(500).json({
      error: 'Failed to generate architecture',
      type: 'internal_error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * POST /api/architecture/generate-stream
 * Generate architecture with streaming response
 */
router.post('/generate-stream', async (req: Request<{}, {}, ArchitectureRequestBody>, res: Response) => {
  const log = getRequestLogger();

  try {
    const { projectDescription, projectType, techStack, complexity, refinements, conversationHistory, enrichedIntent } = req.body;

    const desc = projectDescription ?? enrichedIntent?.raw;
    if (!desc || typeof desc !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid projectDescription or enrichedIntent.raw',
        type: 'validation_error',
      });
      return;
    }

    log.info({ hasEnrichedIntent: !!enrichedIntent }, 'Architecture stream generation requested');

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const generator = generateArchitectureStream(
      {
        projectDescription: desc,
        projectType,
        techStack,
        complexity,
        refinements,
      },
      conversationHistory,
      enrichedIntent
    );

    for await (const chunk of generator) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'Architecture stream endpoint error');
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/architecture/refine
 * Refine existing architecture
 */
router.post('/refine', async (req: Request<{}, {}, { architectureId?: string; refinements: string[] }>, res: Response) => {
  const log = getRequestLogger();

  try {
    const { architectureId, refinements } = req.body;

    if (!refinements || !Array.isArray(refinements) || refinements.length === 0) {
      res.status(400).json({
        error: 'Missing or invalid refinements',
        type: 'validation_error',
      });
      return;
    }

    log.info(
      { architectureId, refinementCount: refinements.length },
      'Architecture refinement requested'
    );

    // For now, just return success - refinements will be used in PRD generation
    res.json({
      id: architectureId,
      status: 'refined',
      message: 'Architecture refinement noted. Use in PRD generation.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'Architecture refine endpoint error');
    res.status(500).json({
      error: 'Failed to refine architecture',
      type: 'internal_error',
    });
  }
});

export default router;

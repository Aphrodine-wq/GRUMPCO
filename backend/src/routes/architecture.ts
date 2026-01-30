/**
 * Architecture Routes
 * Endpoints for system architecture generation
 */

import { createHash } from 'crypto';
import express, { Request, Response, Router } from 'express';
import { generateArchitecture, generateArchitectureStream } from '../services/architectureService.js';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError, writeSSEError } from '../utils/errorResponse.js';
import { validateArchitectureRequest, handleArchitectureValidationErrors } from '../middleware/validator.js';
import { dispatchWebhook } from '../services/webhookService.js';
import { getTieredCache } from '../services/tieredCache.js';
import { DEMO_ARCHITECTURE } from '../demo/sampleData.js';
import type { ArchitectureRequest, ConversationMessage } from '../types/index.js';
import type { EnrichedIntent } from '../services/intentCompilerService.js';

const ARCHITECTURE_CACHE_TTL_SEC = 60 * 60; // 1 hour (seconds for tiered cache)

function architectureCacheKey(
  req: ArchitectureRequest,
  conversationHistory?: ConversationMessage[],
  enrichedIntent?: EnrichedIntent
): string {
  const payload = JSON.stringify({
    projectDescription: req.projectDescription?.trim(),
    projectType: req.projectType,
    techStack: req.techStack ?? [],
    complexity: req.complexity,
    refinements: req.refinements ?? [],
    historyLen: conversationHistory?.length ?? 0,
    enrichedRaw: enrichedIntent?.raw?.trim().slice(0, 500),
  });
  return createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

const router: Router = express.Router();

interface ArchitectureRequestBody extends ArchitectureRequest {
  conversationHistory?: ConversationMessage[];
  enrichedIntent?: EnrichedIntent;
  demo?: boolean;
}

/**
 * POST /api/architecture/generate
 * Generate system architecture from project description
 */
router.post(
  '/generate',
  validateArchitectureRequest,
  handleArchitectureValidationErrors,
  async (req: Request, res: Response) => {
  const log = getRequestLogger();
  const body = req.body as ArchitectureRequestBody;

  try {
    if (body.demo === true) {
      log.info({}, 'Demo mode: returning sample architecture');
      res.json({
        id: DEMO_ARCHITECTURE.id,
        status: 'complete',
        architecture: DEMO_ARCHITECTURE,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { projectDescription, projectType, techStack, complexity, refinements, conversationHistory, enrichedIntent } = body;

    const desc = (projectDescription ?? enrichedIntent?.raw) as string;
    const archRequest = {
      projectDescription: desc,
      projectType,
      techStack,
      complexity,
      refinements,
    };

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

    const key = architectureCacheKey(archRequest, conversationHistory, enrichedIntent);
    const cache = getTieredCache();
    const cached = await cache.get<ReturnType<typeof generateArchitecture>>('architecture:generate', key);
    if (cached && cached.status !== 'error') {
      return res.json(cached);
    }

    const response = await generateArchitecture(archRequest, conversationHistory, enrichedIntent);

    if (response.status === 'error') {
      res.status(400).json(response);
      return;
    }

    cache.set('architecture:generate', key, response, ARCHITECTURE_CACHE_TTL_SEC).catch(() => {});

    dispatchWebhook('architecture.generated', {
      architectureId: response.architecture?.id,
      projectName: response.architecture?.projectName,
      hasDiagram: !!(
        response.architecture?.c4Diagrams?.context ||
        response.architecture?.c4Diagrams?.container ||
        response.architecture?.c4Diagrams?.component
      ),
    });
    res.json(response);
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'Architecture generation endpoint error');
    sendServerError(res, err);
  }
});

/**
 * POST /api/architecture/generate-stream
 * Generate architecture with streaming response
 */
router.post(
  '/generate-stream',
  validateArchitectureRequest,
  handleArchitectureValidationErrors,
  async (req: Request, res: Response) => {
  const log = getRequestLogger();
  const body = req.body as ArchitectureRequestBody;

  try {
    if (body.demo === true) {
      log.info({}, 'Demo mode: returning sample architecture stream');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.write(`data: ${JSON.stringify({ type: 'complete', architecture: DEMO_ARCHITECTURE })}\n\n`);
      res.end();
      return;
    }

    const { projectDescription, projectType, techStack, complexity, refinements, conversationHistory, enrichedIntent } = body;

    const desc = (projectDescription ?? enrichedIntent?.raw) as string;

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
    writeSSEError(res, err);
    res.end();
  }
});

/**
 * POST /api/architecture/refine
 * Refine existing architecture
 */
router.post('/refine', async (req: Request<Record<string, never>, object, { architectureId?: string; refinements: string[] }>, res: Response) => {
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
    sendServerError(res, err);
  }
});

export default router;

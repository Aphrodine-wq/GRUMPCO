/**
 * PRD Routes
 * Endpoints for PRD generation
 */

import { createHash } from 'crypto';
import express, { Request, Response, Router } from 'express';
import {
  generatePRD,
  generatePRDStream,
  suggestComponentsFromArchitecture,
  generatePRDForComponent,
} from '../services/prdGeneratorService.js';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError, writeSSEError } from '../utils/errorResponse.js';
import { validatePrdGenerateRequest, handlePrdValidationErrors } from '../middleware/validator.js';
import { dispatchWebhook } from '../services/webhookService.js';
import { getTieredCache } from '../services/tieredCache.js';
import { DEMO_PRD } from '../demo/sampleData.js';
import type { PRDRequest, ConversationMessage } from '../types/index.js';
import type { SystemArchitecture } from '../types/architecture.js';

const PRD_CACHE_TTL_SEC = 60 * 60; // 1 hour (seconds for tiered cache)

function prdCacheKey(
  req: { architectureId?: string; projectName?: string; projectDescription?: string; refinements?: unknown[] },
  arch: SystemArchitecture
): string {
  const payload = JSON.stringify({
    architectureId: req.architectureId ?? arch.id,
    projectName: (req.projectName ?? '').trim(),
    projectDescription: (req.projectDescription ?? '').trim().slice(0, 500),
    refinements: (req.refinements ?? []),
  });
  return createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

const router: Router = express.Router();

interface PRDRequestBody extends PRDRequest {
  conversationHistory?: ConversationMessage[];
  architecture?: SystemArchitecture;
  demo?: boolean;
}

/**
 * POST /api/prd/generate
 * Generate PRD from architecture
 */
router.post(
  '/generate',
  validatePrdGenerateRequest,
  handlePrdValidationErrors,
  async (req: Request, res: Response) => {
  const log = getRequestLogger();
  const body = req.body as PRDRequestBody;

  try {
    const { projectName, projectDescription, architecture: arch, refinements, conversationHistory, demo } = body;

    if (!arch && !demo) {
      res.status(400).json({ error: 'Missing architecture', type: 'validation_error' });
      return;
    }

    if (demo === true) {
      log.info({}, 'Demo mode: returning sample PRD');
      res.json({
        id: DEMO_PRD.id,
        status: 'complete',
        prd: DEMO_PRD,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!arch) {
      res.status(400).json({ error: 'Missing architecture', type: 'validation_error' });
      return;
    }

    log.info(
      {
        projectName,
        architectureId: arch.id,
        refinementsLength: refinements?.length,
      },
      'PRD generation requested'
    );

    const prdRequest = {
      architectureId: arch.id,
      projectName,
      projectDescription,
      refinements,
    };
    const key = prdCacheKey(prdRequest, arch);
    const cache = getTieredCache();
    const cached = await cache.get<Awaited<ReturnType<typeof generatePRD>>>('prd:generate', key);
    if (cached && cached.status !== 'error') {
      return res.json(cached);
    }

    const response = await generatePRD(prdRequest, arch, conversationHistory);

    if (response.status === 'error') {
      res.status(400).json(response);
      return;
    }

    cache.set('prd:generate', key, response, PRD_CACHE_TTL_SEC).catch(() => {});

    dispatchWebhook('prd.generated', {
      architectureId: arch.id,
      projectName,
      hasPrd: !!response.prd,
    });
    res.json(response);
  } catch (error) {
    const err = error as Error;
    log.error({ error: err.message }, 'PRD generation endpoint error');
    sendServerError(res, err);
  }
});

/**
 * POST /api/prd/generate-stream
 * Generate PRD with streaming response
 */
router.post(
  '/generate-stream',
  validatePrdGenerateRequest,
  handlePrdValidationErrors,
  async (req: Request, res: Response) => {
  const log = getRequestLogger();
  const body = req.body as PRDRequestBody;

  try {
    const { projectName, projectDescription, architecture, refinements, conversationHistory, demo } = body;

    if (!architecture) {
      res.status(400).json({ error: 'Missing architecture', type: 'validation_error' });
      return;
    }

    if (demo === true) {
      log.info({}, 'Demo mode: returning sample PRD stream');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.write(`data: ${JSON.stringify({ type: 'complete', prd: DEMO_PRD })}\n\n`);
      res.end();
      return;
    }

    if (!architecture) {
      res.status(400).json({ error: 'Missing architecture', type: 'validation_error' });
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
    writeSSEError(res, err);
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
  async (req: Request<Record<string, never>, object, { architecture: SystemArchitecture }>, res: Response) => {
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
      sendServerError(res, err);
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
      Record<string, never>,
      object,
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
      sendServerError(res, err);
    }
  }
);

/**
 * POST /api/prd/refine
 * Refine existing PRD
 */
router.post('/refine', async (req: Request<Record<string, never>, object, { prdId?: string; refinements: string[] }>, res: Response) => {
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
    sendServerError(res, err);
  }
});

export default router;

/**
 * Intent API Routes
 * POST /api/intent/parse - Parse NL + constraints via Rust, enrich via Claude.
 */

import { Router, Request, Response } from 'express';
import { parseAndEnrichIntent } from '../services/intentCompilerService.js';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError } from '../utils/errorResponse.js';

const router = Router();

interface ParseBody {
  raw: string;
  constraints?: Record<string, unknown>;
}

/**
 * POST /api/intent/parse
 * Body: { raw: string, constraints?: object }
 * Returns: EnrichedIntent (structured + Claude enrichment)
 */
router.post('/parse', async (req: Request<{}, {}, ParseBody>, res: Response) => {
  const log = getRequestLogger();
  const { raw, constraints } = req.body;

  if (!raw || typeof raw !== 'string') {
    res.status(400).json({
      error: 'Missing or invalid "raw" field',
      type: 'validation_error',
    });
    return;
  }

  try {
    log.info({ rawLength: raw.length, hasConstraints: !!constraints }, 'Intent parse requested');
    const enriched = await parseAndEnrichIntent(raw.trim(), constraints);
    res.json(enriched);
  } catch (e) {
    const err = e as Error;
    log.error({ error: err.message }, 'Intent parse failed');
    sendServerError(res, err);
  }
});

export default router;

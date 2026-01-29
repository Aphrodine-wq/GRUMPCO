/**
 * Intent API Routes
 * POST /api/intent/parse - Parse NL + constraints via Rust, enrich via Claude.
 * POST /api/intent/optimize - Return cleaned, design-ready intent (from raw or parsed).
 */

import { Router, Request, Response } from 'express';
import {
  parseAndEnrichIntent,
  optimizeEnrichedIntent,
  type EnrichedIntent,
  type StructuredIntent,
} from '../services/intentCompilerService.js';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError } from '../utils/errorResponse.js';

const router = Router();

interface ParseBody {
  raw: string;
  constraints?: Record<string, unknown>;
}

interface OptimizeBody {
  raw?: string;
  intent?: EnrichedIntent | StructuredIntent;
  constraints?: Record<string, unknown>;
}

/**
 * POST /api/intent/parse
 * Body: { raw: string, constraints?: object }
 * Returns: EnrichedIntent (structured + Claude enrichment)
 */
router.post('/parse', async (req: Request<Record<string, never>, object, ParseBody>, res: Response) => {
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

/**
 * POST /api/intent/optimize
 * Body: { raw?: string, intent?: EnrichedIntent | StructuredIntent, constraints?: object }
 * Returns: EnrichedIntent (cleaned feature list, constraints, NFRs).
 * If raw is provided: parse + enrich + optimize. If intent is provided: optimize only.
 */
router.post('/optimize', async (req: Request<object, object, OptimizeBody>, res: Response) => {
  const log = getRequestLogger();
  const { raw, intent, constraints } = req.body ?? {};

  if (raw !== undefined && typeof raw !== 'string') {
    res.status(400).json({
      error: 'Field "raw" must be a string when provided',
      type: 'validation_error',
    });
    return;
  }

  if (!raw && !intent) {
    res.status(400).json({
      error: 'Provide either "raw" (NL string) or "intent" (parsed intent object)',
      type: 'validation_error',
    });
    return;
  }

  try {
    let enriched: EnrichedIntent;

    if (raw) {
      log.info({ rawLength: raw.length, hasConstraints: !!constraints }, 'Intent optimize from raw');
      enriched = await parseAndEnrichIntent(raw.trim(), constraints);
      // parseAndEnrichIntent already runs optimizeEnrichedIntent
    } else {
      log.info({ hasIntent: true }, 'Intent optimize from parsed');
      enriched = optimizeEnrichedIntent(intent as EnrichedIntent);
    }

    res.json(enriched);
  } catch (e) {
    const err = e as Error;
    log.error({ error: err.message }, 'Intent optimize failed');
    sendServerError(res, err);
  }
});

export default router;

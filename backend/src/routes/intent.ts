/**
 * Intent API Routes
 * POST /api/intent/parse - Parse NL + constraints via Rust, enrich via Claude.
 * POST /api/intent/optimize - Handled by intent-optimizer feature (see features/intent-optimizer).
 */

import { Router, type Request, type Response } from "express";
import { parseAndEnrichIntent } from "../services/intent/intentCompilerService.js";
import { getRequestLogger } from "../middleware/logger.js";
import { sendServerError } from "../utils/errorResponse.js";

const router = Router();

interface ParseBody {
  raw: string;
  constraints?: Record<string, unknown>;
  mode?: "hybrid" | "rust-first" | "llm-first";
}

/**
 * POST /api/intent/parse
 * Body: { raw: string, constraints?: object, mode?: 'hybrid'|'rust-first'|'llm-first' }
 * Returns: EnrichedIntent (structured + enrichment)
 * mode: hybrid (resolve ambiguity via LLM when score > threshold), rust-first (default), llm-first (LLM extracts first)
 */
router.post(
  "/parse",
  async (
    req: Request<Record<string, never>, object, ParseBody>,
    res: Response,
  ) => {
    const log = getRequestLogger();
    const { raw, constraints, mode } = req.body;

    if (!raw || typeof raw !== "string") {
      res.status(400).json({
        error: 'Missing or invalid "raw" field',
        type: "validation_error",
      });
      return;
    }

    try {
      log.info(
        { rawLength: raw.length, hasConstraints: !!constraints, mode },
        "Intent parse requested",
      );
      const enriched = await parseAndEnrichIntent(
        raw.trim(),
        constraints,
        mode ? { mode } : undefined,
      );
      res.json(enriched);
    } catch (e) {
      const err = e as Error;
      log.error({ error: err.message }, "Intent parse failed");
      sendServerError(res, err);
    }
  },
);

export default router;

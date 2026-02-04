/**
 * Live Canvas API - Agent-driven visual workspace (A2UI)
 *
 * Provides endpoints for managing interactive canvas elements in
 * AI-assisted visual development sessions.
 *
 * @module routes/canvas
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  applyCanvasAction,
  getCanvasState,
} from "../services/canvasService.js";
import {
  sendErrorResponse,
  sendServerError,
  ErrorCode,
} from "../utils/errorResponse.js";
import logger from "../middleware/logger.js";

const router = Router();

/**
 * Schema for canvas element data.
 */
const canvasElementSchema = z
  .object({
    id: z.string().optional(),
    type: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    content: z.unknown().optional(),
    style: z.record(z.unknown()).optional(),
  })
  .passthrough();

/**
 * Schema for canvas action request validation.
 */
const canvasActionSchema = z.object({
  sessionId: z
    .string({
      required_error: "sessionId is required",
      invalid_type_error: "sessionId must be a string",
    })
    .min(1, "sessionId cannot be empty"),
  action: z.enum(["create", "update", "delete"], {
    required_error: "action is required",
    invalid_type_error: "action must be create, update, or delete",
  }),
  elementId: z.string().optional(),
  element: canvasElementSchema.optional(),
});

/**
 * POST /api/canvas/action
 *
 * Apply an action to the canvas (create, update, or delete an element).
 *
 * @route POST /api/canvas/action
 * @param {string} req.body.sessionId - Session identifier
 * @param {'create' | 'update' | 'delete'} req.body.action - Action to perform
 * @param {string} [req.body.elementId] - Element ID (for update/delete)
 * @param {Object} [req.body.element] - Element data (for create/update)
 * @returns {Object} Updated canvas elements
 */
router.post("/action", (req: Request, res: Response) => {
  // Validate request body
  const validation = canvasActionSchema.safeParse(req.body);

  if (!validation.success) {
    const firstError = validation.error.errors[0];
    logger.warn(
      { errors: validation.error.errors },
      "Invalid canvas action request",
    );
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, firstError.message, {
      field: firstError.path.join("."),
    });
    return;
  }

  const { sessionId, action, elementId, element } = validation.data;

  try {
    const result = applyCanvasAction({
      sessionId,
      action,
      elementId,
      element,
    });
    res.json({ ok: true, elements: result.elements });
  } catch (error: unknown) {
    logger.error({ err: error, sessionId, action }, "Canvas action failed");
    sendServerError(res, error, { type: "canvas_error" });
  }
});

/**
 * GET /api/canvas/:sessionId
 *
 * Get the current canvas state for a session.
 *
 * @route GET /api/canvas/:sessionId
 * @param {string} req.params.sessionId - Session identifier
 * @returns {Object} Canvas elements array
 */
router.get("/:sessionId", (req: Request, res: Response) => {
  const sessionId =
    typeof req.params.sessionId === "string"
      ? req.params.sessionId
      : (req.params.sessionId?.[0] ?? "");

  if (!sessionId) {
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, "sessionId is required");
    return;
  }

  const elements = getCanvasState(sessionId);
  res.json({ elements });
});

export default router;

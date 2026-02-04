/**
 * Cron API - Scheduled job management
 *
 * Provides endpoints for creating, listing, and managing scheduled cron jobs
 * for automated ship, chat, or webhook actions.
 *
 * @module routes/cron
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  upsertCronJob,
  deleteCronJob,
  listCronJobs,
  getCronJob,
} from "../services/cronService.js";
import {
  sendErrorResponse,
  sendServerError,
  ErrorCode,
} from "../utils/errorResponse.js";
import logger from "../middleware/logger.js";

const router = Router();

/**
 * Schema for cron job creation/update validation.
 */
const cronJobSchema = z.object({
  id: z
    .string({
      required_error: "id is required",
      invalid_type_error: "id must be a string",
    })
    .min(1, "id cannot be empty")
    .max(100, "id must be at most 100 characters"),
  schedule: z
    .string({
      required_error: "schedule is required",
      invalid_type_error: "schedule must be a string",
    })
    .min(1, "schedule cannot be empty")
    .refine(
      (s) => {
        // Basic cron expression validation (5 or 6 fields)
        const parts = s.trim().split(/\s+/);
        return parts.length >= 5 && parts.length <= 6;
      },
      { message: "schedule must be a valid cron expression (5-6 fields)" },
    ),
  action: z.enum(["ship", "chat", "webhook"], {
    required_error: "action is required",
    invalid_type_error: "action must be ship, chat, or webhook",
  }),
  payload: z.record(z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

/**
 * Type for validated cron job request body.
 * @internal Used for type inference but accessed via z.infer
 */
type _CronJobBody = z.infer<typeof cronJobSchema>;

/**
 * GET /api/cron
 *
 * List all configured cron jobs.
 *
 * @route GET /api/cron
 * @returns {Object} Array of cron jobs
 */
router.get("/", (_req: Request, res: Response) => {
  const jobs = listCronJobs();
  res.json({ jobs });
});

/**
 * POST /api/cron
 *
 * Create or update a cron job.
 *
 * @route POST /api/cron
 * @param {string} req.body.id - Unique job identifier
 * @param {string} req.body.schedule - Cron expression (e.g., '0 9 * * *')
 * @param {'ship' | 'chat' | 'webhook'} req.body.action - Action type
 * @param {Object} [req.body.payload] - Action-specific payload
 * @param {boolean} [req.body.enabled=true] - Whether job is active
 * @returns {Object} Success status
 */
router.post("/", (req: Request, res: Response) => {
  // Validate request body
  const validation = cronJobSchema.safeParse(req.body);

  if (!validation.success) {
    const firstError = validation.error.errors[0];
    logger.warn(
      { errors: validation.error.errors },
      "Invalid cron job request",
    );
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, firstError.message, {
      field: firstError.path.join("."),
    });
    return;
  }

  const { id, schedule, action, payload, enabled } = validation.data;

  try {
    const result = upsertCronJob({
      id,
      schedule,
      action,
      payload,
      enabled,
    });

    if (!result.ok) {
      sendErrorResponse(
        res,
        ErrorCode.OPERATION_FAILED,
        result.error || "Failed to create cron job",
      );
      return;
    }

    res.json({ ok: true });
  } catch (error: unknown) {
    logger.error({ err: error, id, schedule }, "Cron job creation failed");
    sendServerError(res, error, { type: "cron_error" });
  }
});

/**
 * GET /api/cron/:id
 *
 * Get a specific cron job by ID.
 *
 * @route GET /api/cron/:id
 * @param {string} req.params.id - Job identifier
 * @returns {Object} Cron job details
 */
router.get("/:id", (req: Request, res: Response) => {
  const id =
    typeof req.params.id === "string"
      ? req.params.id
      : (req.params.id?.[0] ?? "");

  if (!id) {
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, "id is required");
    return;
  }

  const job = getCronJob(id);

  if (!job) {
    sendErrorResponse(res, ErrorCode.RESOURCE_NOT_FOUND, "Cron job not found");
    return;
  }

  res.json(job);
});

/**
 * DELETE /api/cron/:id
 *
 * Delete a cron job by ID.
 *
 * @route DELETE /api/cron/:id
 * @param {string} req.params.id - Job identifier
 * @returns {Object} Success status
 */
router.delete("/:id", (req: Request, res: Response) => {
  const id =
    typeof req.params.id === "string"
      ? req.params.id
      : (req.params.id?.[0] ?? "");

  if (!id) {
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, "id is required");
    return;
  }

  const deleted = deleteCronJob(id);

  if (!deleted) {
    sendErrorResponse(res, ErrorCode.RESOURCE_NOT_FOUND, "Cron job not found");
    return;
  }

  res.json({ ok: true });
});

export default router;

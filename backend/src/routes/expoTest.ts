/**
 * Expo Test API
 *
 * Provides endpoints for running and monitoring Expo/React Native test jobs.
 * Jobs are enqueued and executed asynchronously via the job queue.
 *
 * @module routes/expoTest
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { enqueueExpoTestJob } from "../services/jobQueue.js";
import { getDatabase } from "../db/database.js";
import { getRequestLogger } from "../middleware/logger.js";
import {
  sendServerError,
  sendErrorResponse,
  ErrorCode,
} from "../utils/errorResponse.js";

const router = Router();

/**
 * Schema for Expo test run request validation.
 */
const expoTestRunSchema = z.object({
  projectPath: z
    .string({
      required_error: "projectPath is required",
      invalid_type_error: "projectPath must be a string",
    })
    .min(1, "projectPath cannot be empty")
    .max(500, "projectPath must be at most 500 characters"),
});

/**
 * Type for validated Expo test run request body.
 */
type ExpoTestRunBody = z.infer<typeof expoTestRunSchema>;

/**
 * Database row type for Expo test jobs.
 */
interface ExpoTestJobRow {
  id: string;
  project_path: string;
  status: string;
  error: string | null;
  result_json: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * POST /api/expo-test/run
 *
 * Enqueue an Expo test job for execution.
 *
 * @route POST /api/expo-test/run
 * @param {string} req.body.projectPath - Path to the Expo/React Native project
 * @returns {Object} Job ID for tracking
 *
 * @example
 * // Request
 * POST /api/expo-test/run
 * { "projectPath": "/path/to/expo-project" }
 *
 * // Response
 * { "jobId": "abc123" }
 */
router.post(
  "/run",
  async (
    req: Request<Record<string, never>, object, ExpoTestRunBody>,
    res: Response,
  ) => {
    const log = getRequestLogger();

    // Validate request body
    const validation = expoTestRunSchema.safeParse(req.body);

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      log.warn(
        { errors: validation.error.errors },
        "Invalid Expo test run request",
      );
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, firstError.message, {
        field: firstError.path.join("."),
      });
      return;
    }

    const { projectPath } = validation.data;

    try {
      const jobId = await enqueueExpoTestJob(projectPath);
      log.info({ jobId, projectPath }, "Expo test job enqueued");
      res.json({ jobId });
    } catch (error: unknown) {
      log.error({ err: error }, "Expo test enqueue failed");
      sendServerError(res, error, { type: "expo_test_error" });
    }
  },
);

/**
 * GET /api/expo-test/status/:jobId
 *
 * Get the status and result of an Expo test job.
 *
 * @route GET /api/expo-test/status/:jobId
 * @param {string} req.params.jobId - Job identifier
 * @returns {Object} Job status and results
 *
 * @example
 * // Response for completed job
 * {
 *   "id": "abc123",
 *   "project_path": "/path/to/project",
 *   "status": "completed",
 *   "result": { "passed": 10, "failed": 0 }
 * }
 */
router.get(
  "/status/:jobId",
  (req: Request<{ jobId: string }>, res: Response) => {
    const log = getRequestLogger();
    const { jobId } = req.params;

    if (!jobId || jobId.length < 1) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, "jobId is required");
      return;
    }

    try {
      const db = getDatabase().getDb();
      const row = db
        .prepare(
          `SELECT id, project_path, status, error, result_json, created_at, updated_at 
       FROM expo_test_jobs WHERE id = ?`,
        )
        .get(jobId) as ExpoTestJobRow | undefined;

      if (!row) {
        sendErrorResponse(res, ErrorCode.RESOURCE_NOT_FOUND, "Job not found");
        return;
      }

      res.json({
        id: row.id,
        project_path: row.project_path,
        status: row.status,
        error: row.error ?? undefined,
        result: row.result_json ? JSON.parse(row.result_json) : undefined,
        created_at: row.created_at,
        updated_at: row.updated_at ?? undefined,
      });
    } catch (error: unknown) {
      log.error({ err: error, jobId }, "Failed to get Expo test job status");
      sendServerError(res, error, { type: "database_error" });
    }
  },
);

export default router;

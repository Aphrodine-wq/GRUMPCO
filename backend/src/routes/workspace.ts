/**
 * Workspace Routes
 *
 * Handles workspace-related operations including loading remote repositories
 * for code analysis and AI-assisted development.
 *
 * @module routes/workspace
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { loadRemoteWorkspace } from "../services/remoteWorkspaceService.js";
import logger from "../middleware/logger.js";
import {
  sendErrorResponse,
  ErrorCode,
  sendServerError,
} from "../utils/errorResponse.js";

const router = Router();

/**
 * Schema for remote workspace request validation.
 * Validates that repoUrl is a valid Git repository URL.
 */
const remoteWorkspaceSchema = z.object({
  repoUrl: z
    .string({
      required_error: "repoUrl is required",
      invalid_type_error: "repoUrl must be a string",
    })
    .min(1, "repoUrl cannot be empty")
    .url("repoUrl must be a valid URL")
    .refine(
      (url) => {
        // Accept common git hosting URLs and .git suffix
        const gitPatterns = [
          /^https?:\/\/(github|gitlab|bitbucket)\.(com|org)/i,
          /\.git$/i,
          /^git@/i,
          /^https?:\/\/.*\.(git|git\/)$/i,
        ];
        return (
          gitPatterns.some((pattern) => pattern.test(url)) ||
          url.startsWith("http")
        );
      },
      { message: "repoUrl must be a valid Git repository URL" },
    ),
});

/**
 * Type for validated remote workspace request body.
 * @internal Used for type inference but accessed via z.infer
 */
type _RemoteWorkspaceBody = z.infer<typeof remoteWorkspaceSchema>;

/**
 * POST /api/workspace/remote
 *
 * Loads a remote Git repository as a workspace for analysis.
 *
 * @route POST /api/workspace/remote
 * @param {string} req.body.repoUrl - Git repository URL to load
 * @returns {Object} Workspace metadata including file structure
 *
 * @example
 * // Request
 * POST /api/workspace/remote
 * { "repoUrl": "https://github.com/user/repo" }
 *
 * // Response
 * {
 *   "path": "/tmp/workspaces/repo-abc123",
 *   "files": ["src/index.ts", "package.json", ...],
 *   "name": "repo"
 * }
 */
router.post("/remote", async (req: Request, res: Response): Promise<void> => {
  // Validate request body with Zod
  const validation = remoteWorkspaceSchema.safeParse(req.body);

  if (!validation.success) {
    const firstError = validation.error.errors[0];
    logger.warn(
      { errors: validation.error.errors, body: req.body },
      "Invalid remote workspace request",
    );
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, firstError.message, {
      field: firstError.path.join("."),
    });
    return;
  }

  const { repoUrl } = validation.data;

  try {
    logger.info({ repoUrl }, "Loading remote workspace");
    const workspace = await loadRemoteWorkspace(repoUrl);
    res.json(workspace);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load repository";
    logger.error({ err: error, repoUrl }, "Failed to load remote workspace");

    // Determine appropriate error code based on error type
    if (message.includes("not found") || message.includes("404")) {
      sendErrorResponse(
        res,
        ErrorCode.RESOURCE_NOT_FOUND,
        "Repository not found",
      );
    } else if (
      message.includes("permission") ||
      message.includes("401") ||
      message.includes("403")
    ) {
      sendErrorResponse(res, ErrorCode.FORBIDDEN, "Cannot access repository");
    } else if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      sendErrorResponse(
        res,
        ErrorCode.REQUEST_TIMEOUT,
        "Repository loading timed out",
      );
    } else {
      sendServerError(res, error, { type: "workspace_error" });
    }
  }
});

export default router;

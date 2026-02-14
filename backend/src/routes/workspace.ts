/**
 * Workspace Routes
 *
 * Handles workspace-related operations including loading remote repositories
 * for code analysis and AI-assisted development, and listing directory trees
 * for the file explorer panel.
 *
 * @module routes/workspace
 */

import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { loadRemoteWorkspace } from '../services/workspace/remoteWorkspaceService.js';
import logger from '../middleware/logger.js';
import { sendErrorResponse, ErrorCode, sendServerError } from '../utils/errorResponse.js';

const router = Router();

/** Directories to skip when listing tree (security and noise) */
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.next', 'dist', 'build']);

/** Max depth for tree listing to avoid huge responses */
const MAX_TREE_DEPTH = 3;

// ============================================================================
// ACTIVE WORKSPACE ROOT — persisted in-memory for this process lifetime
// ============================================================================

let activeWorkspaceRoot: string | null = null;

/**
 * Get the currently active workspace root.
 * Other services (e.g. ToolExecutionService) can import this to discover
 * which directory the user has selected for file output.
 */
export function getActiveWorkspaceRoot(): string | null {
  return activeWorkspaceRoot;
}

/**
 * Set the active workspace root programmatically (used by the endpoint below
 * and by any startup restore logic).
 */
export function setActiveWorkspaceRoot(root: string | null): void {
  activeWorkspaceRoot = root;
  if (root) {
    process.env.WORKSPACE_ROOT = root;
  }
}

// ── POST /api/workspace/set ──────────────────────────────────────────────────

const setWorkspaceSchema = z.object({
  path: z.string({ required_error: 'path is required' }).min(1, 'path cannot be empty'),
});

/**
 * POST /api/workspace/set
 *
 * Validates that the given path exists and is a directory, then sets it as
 * the active workspace root so that subsequent AI file-write operations
 * target the user's chosen folder.
 *
 * @route POST /api/workspace/set
 * @param {string} req.body.path - Absolute path to the local directory
 * @returns {{ success: true, path: string }}
 */
router.post('/set', async (req: Request, res: Response): Promise<void> => {
  const validation = setWorkspaceSchema.safeParse(req.body);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, firstError.message, {});
    return;
  }

  const rawPath = validation.data.path.trim();
  const normalized = path.resolve(rawPath);

  try {
    const stat = await fsPromises.stat(normalized);
    if (!stat.isDirectory()) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'Path is not a directory', {});
      return;
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      sendErrorResponse(res, ErrorCode.RESOURCE_NOT_FOUND, 'Directory not found', {});
      return;
    }
    sendServerError(res, err, { type: 'workspace_set' });
    return;
  }

  setActiveWorkspaceRoot(normalized);
  logger.info({ workspace: normalized }, 'Active workspace root set');

  res.json({ success: true, path: normalized });
});

// ── GET /api/workspace/current ───────────────────────────────────────────────

/**
 * GET /api/workspace/current
 *
 * Returns the currently active workspace root directory, or null if none is set.
 *
 * @route GET /api/workspace/current
 * @returns {{ path: string | null }}
 */
router.get('/current', (_req: Request, res: Response): void => {
  res.json({ path: activeWorkspaceRoot });
});

/**
 * Schema for remote workspace request validation.
 * Validates that repoUrl is a valid Git repository URL.
 */
const remoteWorkspaceSchema = z.object({
  repoUrl: z
    .string({
      required_error: 'repoUrl is required',
      invalid_type_error: 'repoUrl must be a string',
    })
    .min(1, 'repoUrl cannot be empty')
    .url('repoUrl must be a valid URL')
    .refine(
      (url) => {
        // Accept common git hosting URLs and .git suffix
        const gitPatterns = [
          /^https?:\/\/(github|gitlab|bitbucket)\.(com|org)/i,
          /\.git$/i,
          /^git@/i,
          /^https?:\/\/.*\.(git|git\/)$/i,
        ];
        return gitPatterns.some((pattern) => pattern.test(url)) || url.startsWith('http');
      },
      { message: 'repoUrl must be a valid Git repository URL' }
    ),
});

/**
 * Type for validated remote workspace request body.
 * @internal Used for type inference but accessed via z.infer
 */
type _RemoteWorkspaceBody = z.infer<typeof remoteWorkspaceSchema>;

/**
 * GET /api/workspace/tree
 *
 * List directory entries for the file explorer. Uses the active workspace root
 * (set via POST /api/workspace/set) as the base directory. Returns one level;
 * request ?path=subdir to expand.
 *
 * @route GET /api/workspace/tree
 * @param {string} [req.query.path] - Directory path to list (relative to workspace root or absolute)
 * @returns {Object} { path, entries: [{ name, path, isDirectory }] }
 */
router.get('/tree', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawPath = (req.query.path as string)?.trim();

    // Use active workspace root, then WORKSPACE_BASE env, then fail with a clear error.
    const base =
      activeWorkspaceRoot ??
      (process.env.WORKSPACE_BASE ? path.resolve(process.env.WORKSPACE_BASE) : null);

    if (!base && !rawPath) {
      sendErrorResponse(
        res,
        ErrorCode.VALIDATION_ERROR,
        'No workspace root set. Use POST /api/workspace/set first.',
        {}
      );
      return;
    }

    let requestedDir: string;

    if (!rawPath) {
      requestedDir = base!;
    } else if (path.isAbsolute(rawPath)) {
      // Allow absolute paths — this is a local desktop app; users set workspace paths
      requestedDir = path.normalize(rawPath);
    } else {
      requestedDir = path.resolve(base ?? process.cwd(), rawPath);
    }

    const normalized = path.normalize(requestedDir);

    let stat;
    try {
      stat = await fsPromises.stat(normalized);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        sendErrorResponse(res, ErrorCode.RESOURCE_NOT_FOUND, 'Directory not found', {});
        return;
      }
      throw err;
    }

    if (!stat.isDirectory()) {
      sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, 'Path is not a directory', {});
      return;
    }

    const dirents = await fsPromises.readdir(normalized, {
      withFileTypes: true,
    });

    const entries = dirents
      .filter((d) => !d.name.startsWith('.') && !SKIP_DIRS.has(d.name))
      .map((d) => {
        const fullPath = path.join(normalized, d.name);
        return {
          name: d.name,
          path: fullPath,
          isDirectory: d.isDirectory(),
        };
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    res.json({ path: normalized, entries });
  } catch (err) {
    logger.warn({ err, path: req.query.path }, 'Workspace tree list failed');
    sendServerError(res, err, { type: 'workspace_tree' });
  }
});

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
router.post('/remote', async (req: Request, res: Response): Promise<void> => {
  // Validate request body with Zod
  const validation = remoteWorkspaceSchema.safeParse(req.body);

  if (!validation.success) {
    const firstError = validation.error.errors[0];
    logger.warn(
      { errors: validation.error.errors, body: req.body },
      'Invalid remote workspace request'
    );
    sendErrorResponse(res, ErrorCode.VALIDATION_ERROR, firstError.message, {
      field: firstError.path.join('.'),
    });
    return;
  }

  const { repoUrl } = validation.data;

  try {
    logger.info({ repoUrl }, 'Loading remote workspace');
    const workspace = await loadRemoteWorkspace(repoUrl);
    res.json(workspace);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load repository';
    logger.error({ err: error, repoUrl }, 'Failed to load remote workspace');

    // Determine appropriate error code based on error type
    if (message.includes('not found') || message.includes('404')) {
      sendErrorResponse(res, ErrorCode.RESOURCE_NOT_FOUND, 'Repository not found');
    } else if (
      message.includes('permission') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      sendErrorResponse(res, ErrorCode.FORBIDDEN, 'Cannot access repository');
    } else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      sendErrorResponse(res, ErrorCode.REQUEST_TIMEOUT, 'Repository loading timed out');
    } else {
      sendServerError(res, error, { type: 'workspace_error' });
    }
  }
});

export default router;

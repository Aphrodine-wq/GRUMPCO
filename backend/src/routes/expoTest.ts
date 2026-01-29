/**
 * Expo Test API
 * POST /api/expo-test/run - Enqueue Expo test job (project path in body).
 * GET /api/expo-test/status/:jobId - Get job status and result.
 */

import { Router, Request, Response } from 'express';
import { enqueueExpoTestJob } from '../services/jobQueue.js';
import { getDatabase } from '../db/database.js';
import { getRequestLogger } from '../middleware/logger.js';
import { sendServerError } from '../utils/errorResponse.js';

const router = Router();

interface RunBody {
  projectPath: string;
}

/**
 * POST /api/expo-test/run
 * Body: { projectPath: string }
 * Returns: { jobId: string }
 */
router.post('/run', async (req: Request<Record<string, never>, object, RunBody>, res: Response) => {
  const log = getRequestLogger();
  const { projectPath } = req.body ?? {};
  if (!projectPath || typeof projectPath !== 'string') {
    res.status(400).json({ error: 'Missing or invalid projectPath', type: 'validation_error' });
    return;
  }
  try {
    const jobId = await enqueueExpoTestJob(projectPath);
    log.info({ jobId, projectPath }, 'Expo test job enqueued');
    res.json({ jobId });
  } catch (e) {
    const err = e as Error;
    log.error({ error: err.message }, 'Expo test enqueue failed');
    sendServerError(res, err);
  }
});

/**
 * GET /api/expo-test/status/:jobId
 * Returns: { id, project_path, status, error?, result_json? }
 */
router.get('/status/:jobId', (req: Request<{ jobId: string }>, res: Response) => {
  const { jobId } = req.params;
  if (!jobId) {
    res.status(400).json({ error: 'Missing jobId', type: 'validation_error' });
    return;
  }
  try {
    const db = getDatabase().getDb();
    const row = db.prepare(
      `SELECT id, project_path, status, error, result_json, created_at, updated_at FROM expo_test_jobs WHERE id = ?`
    ).get(jobId) as { id: string; project_path: string; status: string; error: string | null; result_json: string | null; created_at: string; updated_at: string | null } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Job not found', type: 'not_found' });
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
  } catch (e) {
    const err = e as Error;
    sendServerError(res, err);
  }
});

export default router;

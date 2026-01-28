/**
 * Job queue for long-running SHIP (and optionally codegen) work.
 * When REDIS_HOST is set: uses BullMQ + Redis for horizontal scaling; worker runs in-process or separate.
 * Otherwise: uses ship_jobs table (SQLite); one in-process worker, one job at a time.
 */

import { getDatabase } from '../db/database.js';
import { executeShipMode } from './shipModeService.js';
import { runExpoTestsInDocker } from './expoTestService.js';
import logger from '../middleware/logger.js';

const POLL_MS = 2000;
const JOB_PREFIX = 'job_';
const SHIP_QUEUE_NAME = 'grump:ship';
const EXPO_JOB_PREFIX = 'job_expo_';

function useRedisQueue(): boolean {
  return !!(process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== '');
}

let bullQueue: import('bullmq').Queue | null = null;
let bullWorker: import('bullmq').Worker | null = null;

async function getBullQueue(): Promise<import('bullmq').Queue> {
  if (bullQueue) return bullQueue;
  const { Queue } = await import('bullmq');
  const conn = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
  bullQueue = new Queue(SHIP_QUEUE_NAME, { connection: conn });
  logger.info('BullMQ ship queue initialized');
  return bullQueue;
}

export async function enqueueShipJob(sessionId: string): Promise<string> {
  const id = `${JOB_PREFIX}ship_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  if (useRedisQueue()) {
    const q = await getBullQueue();
    await q.add('run', { sessionId }, { jobId: id });
    logger.info({ jobId: id, sessionId }, 'Ship job enqueued (BullMQ)');
    return id;
  }
  const db = getDatabase().getDb();
  db.prepare(
    `INSERT INTO ship_jobs (id, session_id, status, created_at) VALUES (?, ?, 'pending', datetime('now'))`
  ).run(id, sessionId);
  logger.info({ jobId: id, sessionId }, 'Ship job enqueued (SQLite)');
  return id;
}

function getNextShipJob(): { id: string; session_id: string } | null {
  const db = getDatabase().getDb();
  const row = db.prepare(
    `SELECT id, session_id FROM ship_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
  ).get() as { id: string; session_id: string } | undefined;
  return row ?? null;
}

function markShipJobRunning(id: string): void {
  const db = getDatabase().getDb();
  db.prepare(`UPDATE ship_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?`).run(id);
}

function markShipJobCompleted(id: string): void {
  const db = getDatabase().getDb();
  db.prepare(`UPDATE ship_jobs SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(id);
}

function markShipJobFailed(id: string, error: string): void {
  const db = getDatabase().getDb();
  db.prepare(
    `UPDATE ship_jobs SET status = 'failed', updated_at = datetime('now'), error = ? WHERE id = ?`
  ).run(error, id);
}

async function processOneShipJob(): Promise<boolean> {
  const job = getNextShipJob();
  if (!job) return false;

  markShipJobRunning(job.id);
  try {
    await executeShipMode(job.session_id);
    markShipJobCompleted(job.id);
    logger.info({ jobId: job.id, sessionId: job.session_id }, 'Ship job completed');
  } catch (err) {
    const msg = (err as Error).message;
    markShipJobFailed(job.id, msg);
    logger.error({ jobId: job.id, sessionId: job.session_id, error: msg }, 'Ship job failed');
  }
  return true;
}

// ========== Expo test jobs ==========

export async function enqueueExpoTestJob(projectPath: string): Promise<string> {
  const id = `${EXPO_JOB_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const db = getDatabase().getDb();
  db.prepare(
    `INSERT INTO expo_test_jobs (id, project_path, status, created_at) VALUES (?, ?, 'pending', datetime('now'))`
  ).run(id, projectPath);
  logger.info({ jobId: id, projectPath }, 'Expo test job enqueued');
  return id;
}

function getNextExpoTestJob(): { id: string; project_path: string } | null {
  const db = getDatabase().getDb();
  const row = db.prepare(
    `SELECT id, project_path FROM expo_test_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
  ).get() as { id: string; project_path: string } | undefined;
  return row ?? null;
}

function markExpoJobRunning(id: string): void {
  const db = getDatabase().getDb();
  db.prepare(`UPDATE expo_test_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?`).run(id);
}

function markExpoJobCompleted(id: string, resultJson: string): void {
  const db = getDatabase().getDb();
  db.prepare(
    `UPDATE expo_test_jobs SET status = 'completed', updated_at = datetime('now'), result_json = ? WHERE id = ?`
  ).run(resultJson, id);
}

function markExpoJobFailed(id: string, error: string): void {
  const db = getDatabase().getDb();
  db.prepare(
    `UPDATE expo_test_jobs SET status = 'failed', updated_at = datetime('now'), error = ? WHERE id = ?`
  ).run(error, id);
}

async function processOneExpoJob(): Promise<boolean> {
  const job = getNextExpoTestJob();
  if (!job) return false;

  markExpoJobRunning(job.id);
  try {
    const result = await runExpoTestsInDocker(job.project_path);
    const resultJson = JSON.stringify(result);
    if (result.success) {
      markExpoJobCompleted(job.id, resultJson);
      logger.info({ jobId: job.id, projectPath: job.project_path }, 'Expo test job completed');
    } else {
      markExpoJobFailed(job.id, result.error ?? result.stderr ?? 'Test failed');
      logger.warn({ jobId: job.id, projectPath: job.project_path, error: result.error }, 'Expo test job failed');
    }
  } catch (err) {
    const msg = (err as Error).message;
    markExpoJobFailed(job.id, msg);
    logger.error({ jobId: job.id, projectPath: job.project_path, error: msg }, 'Expo test job failed');
  }
  return true;
}

let workerTimer: ReturnType<typeof setInterval> | null = null;

export async function startJobWorker(): Promise<void> {
  if (useRedisQueue()) {
    if (bullWorker) return;
    const { Worker } = await import('bullmq');
    const conn = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
    bullWorker = new Worker(
      SHIP_QUEUE_NAME,
      async (job) => {
        const { sessionId } = job.data as { sessionId: string };
        await executeShipMode(sessionId);
      },
      { connection: conn, concurrency: 1 }
    );
    bullWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'BullMQ ship job completed'));
    bullWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: (err as Error).message }, 'BullMQ ship job failed'));
    logger.info('BullMQ ship worker started');
    return;
  }
  if (workerTimer) return;
  workerTimer = setInterval(async () => {
    try {
      await processOneShipJob();
      await processOneExpoJob();
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Job worker error');
    }
  }, POLL_MS);
  logger.info('Job worker started (SQLite)');
}

export async function stopJobWorker(): Promise<void> {
  if (bullWorker) {
    await bullWorker.close();
    bullWorker = null;
    logger.info('BullMQ ship worker stopped');
  }
  if (bullQueue) {
    await bullQueue.close();
    bullQueue = null;
  }
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    logger.info('Job worker stopped');
  }
}

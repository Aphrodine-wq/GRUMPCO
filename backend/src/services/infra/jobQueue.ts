/**
 * Job queue for long-running SHIP (and optionally codegen) work.
 * When REDIS_HOST is set: uses BullMQ + Redis for horizontal scaling; worker runs in-process or separate.
 * Otherwise: uses ship_jobs table (SQLite); one in-process worker, one job at a time.
 */

import { getDatabase } from '../../db/database.js';
import { executeShipMode } from '../ship/shipModeService.js';
import {
  executeCodeGeneration,
  executeCodeGenerationMulti,
  getSession,
} from '../agentOrchestrator.js';
import { runExpoTestsInDocker } from '../workspace/expoTestService.js';
import logger from '../../middleware/logger.js';
import { db as supabaseDb, isMockMode } from '../platform/supabaseClient.js';
import { isServerlessRuntime } from '../../config/runtime.js';

const POLL_MS = 2000;
const JOB_PREFIX = 'job_';
import { getRedisConnectionConfig, sanitizeQueueName, useRedis } from './redisConnection.js';

/** BullMQ does not allow colons in queue names; use hyphen. */
const SHIP_QUEUE_NAME = 'grump-ship';
const EXPO_JOB_PREFIX = 'job_expo_';

function useRedisQueue(): boolean {
  return useRedis();
}

function getPublicBaseUrl(): string | null {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit && explicit.trim()) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.trim()) return `https://${vercel.replace(/^https?:\/\//, '')}`;
  return null;
}

function getWorkerAuthHeader(): string | null {
  const secret = process.env.JOB_WORKER_SECRET;
  if (!secret) return null;
  return `Bearer ${secret}`;
}

function supabaseTable(table: string) {
  if (isMockMode) {
    throw new Error('Supabase is required for serverless job processing');
  }
  return supabaseDb.from(table);
}

async function dispatchServerlessJob(
  path: string,
  payload: Record<string, unknown>
): Promise<void> {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    logger.error({ path }, 'PUBLIC_BASE_URL or VERCEL_URL is required for serverless job dispatch');
    return;
  }

  const target = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const token = process.env.QSTASH_TOKEN;
  const authHeader = getWorkerAuthHeader();

  if (token && token.trim()) {
    const qstashBase = process.env.QSTASH_URL || 'https://qstash.upstash.io/v2/publish';
    const qstashUrl = `${qstashBase.replace(/\/$/, '')}/${encodeURIComponent(target)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Upstash-Forward-Authorization'] = authHeader;
    }
    await fetch(qstashUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers.Authorization = authHeader;
  await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

let bullQueue: import('bullmq').Queue | null = null;
let bullWorker: import('bullmq').Worker | null = null;

async function getBullQueue(): Promise<import('bullmq').Queue> {
  if (bullQueue) return bullQueue;
  const { Queue } = await import('bullmq');
  const conn = getRedisConnectionConfig();
  bullQueue = new Queue(sanitizeQueueName(SHIP_QUEUE_NAME), {
    connection: conn,
  });
  logger.info('BullMQ ship queue initialized');
  return bullQueue;
}

export async function enqueueShipJob(sessionId: string): Promise<string> {
  const id = `${JOB_PREFIX}ship_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  if (isServerlessRuntime) {
    const { error } = await supabaseTable('ship_jobs').insert({
      id,
      session_id: sessionId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    await dispatchServerlessJob('/api/jobs/ship', { jobId: id, sessionId });
    logger.info({ jobId: id, sessionId }, 'Ship job enqueued (serverless)');
    return id;
  }
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

export async function enqueueCodegenJob(sessionId: string): Promise<string> {
  const id = `${JOB_PREFIX}codegen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  if (isServerlessRuntime) {
    const { error } = await supabaseTable('codegen_jobs').insert({
      id,
      session_id: sessionId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    await dispatchServerlessJob('/api/jobs/codegen', { jobId: id, sessionId });
    logger.info({ jobId: id, sessionId }, 'Codegen job enqueued (serverless)');
    return id;
  }
  const db = getDatabase().getDb();
  db.prepare(
    `INSERT INTO codegen_jobs (id, session_id, status, created_at) VALUES (?, ?, 'pending', datetime('now'))`
  ).run(id, sessionId);
  logger.info({ jobId: id, sessionId }, 'Codegen job enqueued (SQLite)');
  return id;
}

function getNextShipJob(): { id: string; session_id: string } | null {
  const db = getDatabase().getDb();
  const row = db
    .prepare(
      `SELECT id, session_id FROM ship_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
    )
    .get() as { id: string; session_id: string } | undefined;
  return row ?? null;
}

function markShipJobRunning(id: string): void {
  const db = getDatabase().getDb();
  db.prepare(
    `UPDATE ship_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

function markShipJobCompleted(id: string): void {
  const db = getDatabase().getDb();
  db.prepare(
    `UPDATE ship_jobs SET status = 'completed', updated_at = datetime('now') WHERE id = ?`
  ).run(id);
}

function markShipJobFailed(id: string, error: string): void {
  const db = getDatabase().getDb();
  db.prepare(
    `UPDATE ship_jobs SET status = 'failed', updated_at = datetime('now'), error = ? WHERE id = ?`
  ).run(error, id);
}

async function processOneShipJob(): Promise<boolean> {
  if (isServerlessRuntime) return false;
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

export async function processShipJob(jobId: string): Promise<void> {
  if (!isServerlessRuntime) {
    logger.warn({ jobId }, 'processShipJob called outside serverless runtime');
    return;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabaseTable('ship_jobs').select('*').eq('id', jobId).single();
  if (error || !data) {
    throw new Error(error?.message || 'Ship job not found');
  }
  if (data.status === 'completed' || data.status === 'failed') {
    return;
  }
  await supabaseTable('ship_jobs').update({ status: 'running', updated_at: now }).eq('id', jobId);
  try {
    await executeShipMode(data.session_id as string);
    await supabaseTable('ship_jobs')
      .update({ status: 'completed', updated_at: now })
      .eq('id', jobId);
    logger.info({ jobId, sessionId: data.session_id }, 'Ship job completed (serverless)');
  } catch (err) {
    const msg = (err as Error).message;
    await supabaseTable('ship_jobs')
      .update({ status: 'failed', updated_at: now, error: msg })
      .eq('id', jobId);
    logger.error({ jobId, sessionId: data.session_id, error: msg }, 'Ship job failed (serverless)');
    throw err;
  }
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
  const row = db
    .prepare(
      `SELECT id, project_path FROM expo_test_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
    )
    .get() as { id: string; project_path: string } | undefined;
  return row ?? null;
}

function markExpoJobRunning(id: string): void {
  const db = getDatabase().getDb();
  db.prepare(
    `UPDATE expo_test_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?`
  ).run(id);
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
  if (isServerlessRuntime) return false;
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
      logger.warn(
        { jobId: job.id, projectPath: job.project_path, error: result.error },
        'Expo test job failed'
      );
    }
  } catch (err) {
    const msg = (err as Error).message;
    markExpoJobFailed(job.id, msg);
    logger.error(
      { jobId: job.id, projectPath: job.project_path, error: msg },
      'Expo test job failed'
    );
  }
  return true;
}

let workerTimer: ReturnType<typeof setInterval> | null = null;

export async function startJobWorker(): Promise<void> {
  if (isServerlessRuntime) {
    logger.info('Job worker disabled in serverless runtime');
    return;
  }
  if (useRedisQueue()) {
    if (bullWorker) return;
    const { Worker } = await import('bullmq');
    const conn = getRedisConnectionConfig();
    bullWorker = new Worker(
      sanitizeQueueName(SHIP_QUEUE_NAME),
      async (job) => {
        const { sessionId } = job.data as { sessionId: string };
        await executeShipMode(sessionId);
      },
      { connection: conn, concurrency: 1 }
    );
    bullWorker.on('completed', (job) =>
      logger.info({ jobId: job.id }, 'BullMQ ship job completed')
    );
    bullWorker.on('failed', (job, err) =>
      logger.error({ jobId: job?.id, err: (err as Error).message }, 'BullMQ ship job failed')
    );
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

export async function processCodegenJob(jobId: string): Promise<void> {
  if (!isServerlessRuntime) {
    logger.warn({ jobId }, 'processCodegenJob called outside serverless runtime');
    return;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabaseTable('codegen_jobs').select('*').eq('id', jobId).single();
  if (error || !data) {
    throw new Error(error?.message || 'Codegen job not found');
  }
  if (data.status === 'completed' || data.status === 'failed') {
    return;
  }
  await supabaseTable('codegen_jobs')
    .update({ status: 'running', updated_at: now })
    .eq('id', jobId);
  try {
    const session = await getSession(data.session_id as string);
    if (!session) throw new Error('Codegen session not found');
    if (session.prds && session.prds.length > 0 && session.architecture) {
      await executeCodeGenerationMulti(session);
    } else if (session.architecture && session.prds?.[0]) {
      await executeCodeGeneration(session, session.prds[0], session.architecture);
    } else {
      throw new Error('Codegen session missing PRD or architecture');
    }
    await supabaseTable('codegen_jobs')
      .update({ status: 'completed', updated_at: now })
      .eq('id', jobId);
    logger.info({ jobId, sessionId: data.session_id }, 'Codegen job completed (serverless)');
  } catch (err) {
    const msg = (err as Error).message;
    await supabaseTable('codegen_jobs')
      .update({ status: 'failed', updated_at: now, error: msg })
      .eq('id', jobId);
    logger.error(
      { jobId, sessionId: data.session_id, error: msg },
      'Codegen job failed (serverless)'
    );
    throw err;
  }
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

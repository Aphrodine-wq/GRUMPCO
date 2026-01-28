/**
 * Scheduled agents with Redis: BullMQ repeatable jobs.
 */

import { runScheduledAgent, type ScheduledAction, type ScheduledAgentParams } from './scheduledAgentsService.js';
import logger from '../middleware/logger.js';

let scheduledQueue: import('bullmq').Queue | null = null;
let scheduledWorker: import('bullmq').Worker | null = null;

export async function getScheduledQueue(): Promise<import('bullmq').Queue> {
  if (scheduledQueue) return scheduledQueue;
  const { Queue } = await import('bullmq');
  const conn = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
  scheduledQueue = new Queue('grump:scheduled', { connection: conn });
  return scheduledQueue;
}

export async function addScheduledRepeatableJob(
  scheduleId: string,
  cronExpression: string,
  action: ScheduledAction,
  params: ScheduledAgentParams
): Promise<void> {
  const q = await getScheduledQueue();
  await q.add('run', { scheduleId, action, params }, { jobId: scheduleId, repeat: { pattern: cronExpression } });
  logger.info({ scheduleId, cronExpression, action }, 'Scheduled repeatable job added');
}

export async function removeScheduledRepeatableJob(scheduleId: string): Promise<void> {
  const q = await getScheduledQueue();
  const repeatables = await q.getRepeatableJobs();
  for (const job of repeatables) {
    if (job.id === scheduleId) {
      await q.removeRepeatableByKey(job.key);
      logger.info({ scheduleId }, 'Scheduled repeatable job removed');
      return;
    }
  }
}

export async function startScheduledAgentsWorker(): Promise<void> {
  if (scheduledWorker) return;
  const { Worker } = await import('bullmq');
  const conn = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
  scheduledWorker = new Worker(
    'grump:scheduled',
    async (job) => {
      const { scheduleId, action, params } = job.data as { scheduleId: string; action: ScheduledAction; params: ScheduledAgentParams };
      await runScheduledAgent(scheduleId, action, params);
    },
    { connection: conn, concurrency: 1 }
  );
  scheduledWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Scheduled agent job completed'));
  scheduledWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: (err as Error).message }, 'Scheduled agent job failed'));
  logger.info('Scheduled agents BullMQ worker started');
}

export async function stopScheduledAgentsWorker(): Promise<void> {
  if (scheduledWorker) {
    await scheduledWorker.close();
    scheduledWorker = null;
    logger.info('Scheduled agents BullMQ worker stopped');
  }
  if (scheduledQueue) {
    await scheduledQueue.close();
    scheduledQueue = null;
  }
}

/** Load enabled scheduled agents from DB and add as repeatable jobs (call after worker started). */
export async function loadRepeatableJobsFromDb(): Promise<void> {
  const { getDatabase } = await import('../db/database.js');
  const db = getDatabase().getDb();
  const rows = db.prepare(
    `SELECT id, cron_expression AS cronExpression, action, params_json AS paramsJson FROM scheduled_agents WHERE enabled = 1`
  ).all() as { id: string; cronExpression: string; action: string; paramsJson: string }[];
  const q = await getScheduledQueue();
  for (const r of rows) {
    const params = (r.paramsJson ? JSON.parse(r.paramsJson) : {}) as ScheduledAgentParams;
    const action = r.action as ScheduledAction;
    await q.add('run', { scheduleId: r.id, action, params }, { jobId: r.id, repeat: { pattern: r.cronExpression } });
    logger.info({ scheduleId: r.id, cronExpression: r.cronExpression }, 'Scheduled repeatable job loaded from DB');
  }
}

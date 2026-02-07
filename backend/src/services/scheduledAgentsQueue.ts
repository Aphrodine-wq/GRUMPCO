/**
 * Scheduled agents with Redis: BullMQ repeatable jobs.
 */

import type { Queue, Worker } from "bullmq";
import {
  runScheduledAgent,
  type ScheduledAction,
  type ScheduledAgentParams,
} from "./scheduledAgentsService.js";
import logger from "../middleware/logger.js";
import {
  getRedisConnectionConfig,
  sanitizeQueueName,
} from "./redisConnection.js";
import { runWithConcurrency } from "../utils/concurrency.js";

const SCHEDULED_QUEUE_NAME = "grump-scheduled";

let scheduledQueue: Queue | null = null;
let scheduledWorker: Worker | null = null;

export async function getScheduledQueue(): Promise<Queue> {
  if (scheduledQueue) return scheduledQueue;
  const { Queue } = await import("bullmq");
  const conn = getRedisConnectionConfig();
  scheduledQueue = new Queue(sanitizeQueueName(SCHEDULED_QUEUE_NAME), {
    connection: conn,
  });
  return scheduledQueue;
}

export async function addScheduledRepeatableJob(
  scheduleId: string,
  cronExpression: string,
  action: ScheduledAction,
  params: ScheduledAgentParams,
): Promise<void> {
  const q = await getScheduledQueue();
  await q.add(
    "run",
    { scheduleId, action, params },
    { jobId: scheduleId, repeat: { pattern: cronExpression } },
  );
  logger.info(
    { scheduleId, cronExpression, action },
    "Scheduled repeatable job added",
  );
}

export async function removeScheduledRepeatableJob(
  scheduleId: string,
): Promise<void> {
  const q = await getScheduledQueue();
  const repeatables = await q.getRepeatableJobs();
  for (const job of repeatables) {
    if (job.id === scheduleId) {
      await q.removeRepeatableByKey(job.key);
      logger.info({ scheduleId }, "Scheduled repeatable job removed");
      return;
    }
  }
}

export async function startScheduledAgentsWorker(): Promise<void> {
  if (scheduledWorker) return;
  const { Worker } = await import("bullmq");
  const conn = getRedisConnectionConfig();
  scheduledWorker = new Worker(
    sanitizeQueueName(SCHEDULED_QUEUE_NAME),
    async (job) => {
      const { scheduleId, action, params } = job.data as {
        scheduleId: string;
        action: ScheduledAction;
        params: ScheduledAgentParams;
      };
      await runScheduledAgent(scheduleId, action, params);
    },
    { connection: conn, concurrency: 1 },
  );
  scheduledWorker.on("completed", (job) =>
    logger.info({ jobId: job.id }, "Scheduled agent job completed"),
  );
  scheduledWorker.on("failed", (job, err) =>
    logger.error(
      { jobId: job?.id, err: (err as Error).message },
      "Scheduled agent job failed",
    ),
  );
  logger.info("Scheduled agents BullMQ worker started");
}

export async function stopScheduledAgentsWorker(): Promise<void> {
  if (scheduledWorker) {
    await scheduledWorker.close();
    scheduledWorker = null;
    logger.info("Scheduled agents BullMQ worker stopped");
  }
  if (scheduledQueue) {
    await scheduledQueue.close();
    scheduledQueue = null;
  }
}

/** Load enabled scheduled agents from DB and add as repeatable jobs (call after worker started). No-op in Supabase mode. */
export async function loadRepeatableJobsFromDb(): Promise<void> {
  const { getDatabase, databaseSupportsRawDb } =
    await import("../db/database.js");
  if (!databaseSupportsRawDb()) {
    logger.debug("loadRepeatableJobsFromDb skipped (Supabase mode, no raw DB)");
    return;
  }
  const db = getDatabase().getDb();
  const rows = db
    .prepare(
      `SELECT id, cron_expression AS cronExpression, action, params_json AS paramsJson FROM scheduled_agents WHERE enabled = 1`,
    )
    .all() as {
    id: string;
    cronExpression: string;
    action: string;
    paramsJson: string;
  }[];
  const q = await getScheduledQueue();

  // Process in batches to prevent Redis connection overload
  const BATCH_SIZE = 50;
  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  await runWithConcurrency(batches, 5, async (batch) => {
    const jobs = batch.map((r) => {
      const params = (
        r.paramsJson ? JSON.parse(r.paramsJson) : {}
      ) as ScheduledAgentParams;
      const action = r.action as ScheduledAction;
      return {
        name: "run",
        data: { scheduleId: r.id, action, params },
        opts: { jobId: r.id, repeat: { pattern: r.cronExpression } },
      };
    });

    await q.addBulk(jobs);

    for (const r of batch) {
      logger.info(
        { scheduleId: r.id, cronExpression: r.cronExpression },
        "Scheduled repeatable job loaded from DB",
      );
    }
  });
}

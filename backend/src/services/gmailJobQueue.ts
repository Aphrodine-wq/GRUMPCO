import logger from "../middleware/logger.js";
import { handleProcessGmailWebhook } from "./jobHandlers/gmail.js";

const GMAIL_QUEUE_NAME = "grump-gmail";

let bullQueue: import("bullmq").Queue | null = null;
let bullWorker: import("bullmq").Worker | null = null;

function useRedisQueue(): boolean {
  return !!(process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== "");
}

async function getGmailQueue(): Promise<import("bullmq").Queue> {
  if (bullQueue) return bullQueue;
  if (!useRedisQueue()) {
    throw new Error("Redis is required for the Gmail queue.");
  }
  const { Queue } = await import("bullmq");
  const conn = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
  bullQueue = new Queue(GMAIL_QUEUE_NAME, { connection: conn });
  logger.info("BullMQ gmail queue initialized");
  return bullQueue;
}

export async function enqueueGmailJob(
  jobName: string,
  data: any,
): Promise<void> {
  const q = await getGmailQueue();
  await q.add(jobName, data);
  logger.info({ jobName, data }, "Gmail job enqueued");
}

export async function startGmailWorker(): Promise<void> {
  if (!useRedisQueue()) {
    logger.info("Gmail worker disabled (Redis not configured)");
    return;
  }
  if (bullWorker) return;

  const { Worker } = await import("bullmq");
  const conn = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  bullWorker = new Worker(
    GMAIL_QUEUE_NAME,
    async (job) => {
      if (job.name === "process-gmail-webhook") {
        await handleProcessGmailWebhook(job);
      }
    },
    { connection: conn, concurrency: 5 },
  );

  bullWorker.on("completed", (job) =>
    logger.info(
      { jobId: job.id, jobName: job.name },
      "BullMQ gmail job completed",
    ),
  );

  bullWorker.on("failed", (job, err) =>
    logger.error(
      { jobId: job?.id, jobName: job?.name, err: err.message },
      "BullMQ gmail job failed",
    ),
  );

  logger.info("BullMQ gmail worker started");
}

export async function stopGmailWorker(): Promise<void> {
  if (bullWorker) {
    await bullWorker.close();
    bullWorker = null;
    logger.info("BullMQ gmail worker stopped");
  }
  if (bullQueue) {
    await bullQueue.close();
    bullQueue = null;
  }
}

/**
 * Cron Service - scheduled task automation
 * Uses node-cron; schedules stored in memory (extend with DB for persistence).
 */

import cron from 'node-cron';
import logger from '../middleware/logger.js';

export interface CronJob {
  id: string;
  schedule: string; // cron expression, e.g. '0 9 * * *' for daily at 9am
  action: 'ship' | 'chat' | 'webhook';
  payload?: Record<string, unknown>;
  enabled: boolean;
}

const jobs = new Map<string, { job: CronJob; task: cron.ScheduledTask }>();

function isValidCron(schedule: string): boolean {
  return cron.validate(schedule);
}

/**
 * Create or update a cron job
 */
export function upsertCronJob(job: CronJob): { ok: boolean; error?: string } {
  if (!isValidCron(job.schedule)) {
    return { ok: false, error: `Invalid cron expression: ${job.schedule}` };
  }
  const existing = jobs.get(job.id);
  if (existing) {
    existing.task.stop();
    jobs.delete(job.id);
  }

  const task = cron.schedule(job.schedule, async () => {
    if (!job.enabled) return;
    logger.info({ cronId: job.id, action: job.action }, 'Cron job triggered');
    try {
      if (job.action === 'webhook' && job.payload?.url) {
        await fetch(job.payload.url as string, {
          method: (job.payload.method as string) || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: job.payload.body ? JSON.stringify(job.payload.body) : undefined,
        });
      } else if (job.action === 'ship' && job.payload?.projectDescription) {
        const { startShipMode } = await import('./shipModeService.js');
        const { enqueueShipJob } = await import('./jobQueue.js');
        const session = await startShipMode({
          projectDescription: job.payload.projectDescription as string,
        });
        await enqueueShipJob(session.id);
      }
      // chat action would need similar handling
    } catch (e) {
      logger.warn({ cronId: job.id, err: (e as Error).message }, 'Cron job failed');
    }
  });

  jobs.set(job.id, { job, task });
  return { ok: true };
}

/**
 * Delete a cron job
 */
export function deleteCronJob(id: string): boolean {
  const existing = jobs.get(id);
  if (existing) {
    existing.task.stop();
    jobs.delete(id);
    return true;
  }
  return false;
}

/**
 * List all cron jobs
 */
export function listCronJobs(): CronJob[] {
  return Array.from(jobs.values()).map(({ job }) => job);
}

/**
 * Get a single cron job
 */
export function getCronJob(id: string): CronJob | undefined {
  return jobs.get(id)?.job;
}

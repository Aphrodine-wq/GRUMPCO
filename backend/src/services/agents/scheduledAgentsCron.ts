/**
 * Scheduled agents without Redis: node-cron in-process.
 */

import cron from "node-cron";
import {
  runScheduledAgent,
  type ScheduledAction,
  type ScheduledAgentParams,
} from "./scheduledAgentsService.js";
import logger from "../../middleware/logger.js";

const tasks = new Map<string, cron.ScheduledTask>();

export function scheduleWithNodeCron(
  scheduleId: string,
  cronExpression: string,
  action: ScheduledAction,
  params: ScheduledAgentParams,
): void {
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }
  const task = cron.schedule(cronExpression, async () => {
    try {
      await runScheduledAgent(scheduleId, action, params);
    } catch (err) {
      logger.error(
        { scheduleId, err: (err as Error).message },
        "Scheduled agent (node-cron) failed",
      );
    }
  });
  tasks.set(scheduleId, task);
  logger.info(
    { scheduleId, cronExpression, action },
    "Scheduled agent (node-cron) registered",
  );
}

export function unscheduleNodeCron(scheduleId: string): void {
  const task = tasks.get(scheduleId);
  if (task) {
    task.stop();
    tasks.delete(scheduleId);
    logger.info({ scheduleId }, "Scheduled agent (node-cron) removed");
  }
}

export async function loadAllFromDbAndSchedule(): Promise<void> {
  const { getDatabase } = await import("../../db/database.js");
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
  for (const r of rows) {
    try {
      const params = (
        r.paramsJson ? JSON.parse(r.paramsJson) : {}
      ) as ScheduledAgentParams;
      scheduleWithNodeCron(
        r.id,
        r.cronExpression,
        r.action as ScheduledAction,
        params,
      );
    } catch (err) {
      logger.warn(
        { scheduleId: r.id, err: (err as Error).message },
        "Failed to schedule agent on startup",
      );
    }
  }
}

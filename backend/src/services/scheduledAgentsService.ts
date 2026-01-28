/**
 * Scheduled agents: cron-based SHIP (and optionally codegen/chat) runs.
 * With Redis: BullMQ repeatable jobs. Without Redis: node-cron in-process.
 */

import { getDatabase } from '../db/database.js';
import { startShipMode } from './shipModeService.js';
import { enqueueShipJob } from './jobQueue.js';
import logger from '../middleware/logger.js';

const SCHEDULED_QUEUE_NAME = 'grump:scheduled';

export type ScheduledAction = 'ship' | 'codegen' | 'chat';

export interface ScheduledAgentParams {
  projectDescription?: string;
  preferences?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ScheduledAgent {
  id: string;
  name: string;
  cronExpression: string;
  action: ScheduledAction;
  params: ScheduledAgentParams;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function useRedis(): boolean {
  return !!(process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== '');
}

function getDb() {
  return getDatabase().getDb();
}

export function listScheduledAgents(): ScheduledAgent[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, name, cron_expression AS cronExpression, action, params_json AS paramsJson, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM scheduled_agents WHERE enabled = 1 ORDER BY created_at ASC`
  ).all() as { id: string; name: string; cronExpression: string; action: string; paramsJson: string; enabled: number; createdAt: string; updatedAt: string }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cronExpression: r.cronExpression,
    action: r.action as ScheduledAction,
    params: (r.paramsJson ? JSON.parse(r.paramsJson) : {}) as ScheduledAgentParams,
    enabled: r.enabled === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export function listAllScheduledAgents(): ScheduledAgent[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, name, cron_expression AS cronExpression, action, params_json AS paramsJson, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM scheduled_agents ORDER BY created_at ASC`
  ).all() as { id: string; name: string; cronExpression: string; action: string; paramsJson: string; enabled: number; createdAt: string; updatedAt: string }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cronExpression: r.cronExpression,
    action: r.action as ScheduledAction,
    params: (r.paramsJson ? JSON.parse(r.paramsJson) : {}) as ScheduledAgentParams,
    enabled: r.enabled === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function runScheduledAgent(scheduleId: string, action: ScheduledAction, params: ScheduledAgentParams): Promise<void> {
  if (action === 'ship') {
    const projectDescription = params.projectDescription ?? '';
    const session = await startShipMode({
      projectDescription,
      preferences: params.preferences as Record<string, unknown> | undefined,
    });
    await enqueueShipJob(session.id);
    logger.info({ scheduleId, sessionId: session.id }, 'Scheduled agent: SHIP session created and enqueued');
  } else {
    logger.warn({ scheduleId, action }, 'Scheduled agent: only ship action is implemented');
  }
}

export async function createScheduledAgent(
  name: string,
  cronExpression: string,
  action: ScheduledAction,
  params: ScheduledAgentParams
): Promise<ScheduledAgent> {
  const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const db = getDb();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  db.prepare(
    `INSERT INTO scheduled_agents (id, name, cron_expression, action, params_json, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(id, name, cronExpression, action, JSON.stringify(params ?? {}), now, now);

  if (useRedis()) {
    const { addScheduledRepeatableJob } = await import('./scheduledAgentsQueue.js');
    await addScheduledRepeatableJob(id, cronExpression, action, params);
  } else {
    const { scheduleWithNodeCron } = await import('./scheduledAgentsCron.js');
    scheduleWithNodeCron(id, cronExpression, action, params);
  }

  const agent: ScheduledAgent = {
    id,
    name,
    cronExpression,
    action,
    params: params ?? {},
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  logger.info({ id, name, cronExpression, action }, 'Scheduled agent created');
  return agent;
}

export async function cancelScheduledAgent(id: string): Promise<boolean> {
  const db = getDb();
  const result = db.prepare(`UPDATE scheduled_agents SET enabled = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
  if (result.changes === 0) return false;

  if (useRedis()) {
    const { removeScheduledRepeatableJob } = await import('./scheduledAgentsQueue.js');
    await removeScheduledRepeatableJob(id);
  } else {
    const { unscheduleNodeCron } = await import('./scheduledAgentsCron.js');
    unscheduleNodeCron(id);
  }
  logger.info({ id }, 'Scheduled agent cancelled');
  return true;
}

export function getScheduledAgent(id: string): ScheduledAgent | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT id, name, cron_expression AS cronExpression, action, params_json AS paramsJson, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM scheduled_agents WHERE id = ?`
  ).get(id) as { id: string; name: string; cronExpression: string; action: string; paramsJson: string; enabled: number; createdAt: string; updatedAt: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    cronExpression: row.cronExpression,
    action: row.action as ScheduledAction,
    params: (row.paramsJson ? JSON.parse(row.paramsJson) : {}) as ScheduledAgentParams,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

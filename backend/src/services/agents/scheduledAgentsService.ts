/**
 * Scheduled agents: cron-based SHIP (and optionally codegen/chat) runs.
 * With Redis: BullMQ repeatable jobs. Without Redis: node-cron in-process.
 */

import { getDatabase } from "../../db/database.js";
import { startShipMode } from "../ship/shipModeService.js";
import { enqueueShipJob } from "../infra/jobQueue.js";
import logger from "../../middleware/logger.js";
import { db as supabaseDb, isMockMode } from "../platform/supabaseClient.js";
import { isServerlessRuntime } from "../../config/runtime.js";

const _SCHEDULED_QUEUE_NAME = "grump-scheduled";

export type ScheduledAction = "ship" | "codegen" | "chat";

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
  return !!(process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== "");
}

function useSupabase(): boolean {
  return isServerlessRuntime || process.env.DB_TYPE === "supabase";
}

function supabaseTable(table: string) {
  if (isMockMode) {
    throw new Error(
      "Supabase is required for scheduled agents in serverless mode",
    );
  }
  return supabaseDb.from(table);
}

function getDb() {
  return getDatabase().getDb();
}

export function listScheduledAgents(): ScheduledAgent[] {
  if (useSupabase()) {
    throw new Error(
      "Scheduled agents listing is async in Supabase mode. Use listAllScheduledAgents with await.",
    );
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, cron_expression AS cronExpression, action, params_json AS paramsJson, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM scheduled_agents WHERE enabled = 1 ORDER BY created_at ASC`,
    )
    .all() as {
      id: string;
      name: string;
      cronExpression: string;
      action: string;
      paramsJson: string;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cronExpression: r.cronExpression,
    action: r.action as ScheduledAction,
    params: (r.paramsJson
      ? JSON.parse(r.paramsJson)
      : {}) as ScheduledAgentParams,
    enabled: r.enabled === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function listAllScheduledAgents(): Promise<ScheduledAgent[]> {
  if (useSupabase()) {
    const { data, error } = await supabaseTable("scheduled_agents")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      cronExpression: r.cron_expression as string,
      action: r.action as ScheduledAction,
      params: (r.params_json as ScheduledAgentParams) ?? {},
      enabled: r.enabled === true,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, cron_expression AS cronExpression, action, params_json AS paramsJson, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM scheduled_agents ORDER BY created_at ASC`,
    )
    .all() as {
      id: string;
      name: string;
      cronExpression: string;
      action: string;
      paramsJson: string;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    cronExpression: r.cronExpression,
    action: r.action as ScheduledAction,
    params: (r.paramsJson
      ? JSON.parse(r.paramsJson)
      : {}) as ScheduledAgentParams,
    enabled: r.enabled === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function runScheduledAgent(
  scheduleId: string,
  action: ScheduledAction,
  params: ScheduledAgentParams,
): Promise<void> {
  if (action === "ship") {
    const projectDescription = params.projectDescription ?? "";
    const session = await startShipMode({
      projectDescription,
      preferences: params.preferences as Record<string, unknown> | undefined,
    });
    await enqueueShipJob(session.id);
    logger.info(
      { scheduleId, sessionId: session.id },
      "Scheduled agent: SHIP session created and enqueued",
    );
  } else {
    logger.warn(
      { scheduleId, action },
      "Scheduled agent: only ship action is implemented",
    );
  }
}

export async function createScheduledAgent(
  name: string,
  cronExpression: string,
  action: ScheduledAction,
  params: ScheduledAgentParams,
): Promise<ScheduledAgent> {
  const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  if (useSupabase()) {
    const { error } = await supabaseTable("scheduled_agents").insert({
      id,
      name,
      cron_expression: cronExpression,
      action,
      params_json: params ?? {},
      enabled: true,
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
  } else {
    const db = getDb();
    const sqliteNow = now.replace("T", " ").slice(0, 19);
    db.prepare(
      `INSERT INTO scheduled_agents (id, name, cron_expression, action, params_json, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id,
      name,
      cronExpression,
      action,
      JSON.stringify(params ?? {}),
      sqliteNow,
      sqliteNow,
    );

    if (useRedis()) {
      const { addScheduledRepeatableJob } =
        await import("./scheduledAgentsQueue.js");
      await addScheduledRepeatableJob(id, cronExpression, action, params);
    } else {
      const { scheduleWithNodeCron } = await import("./scheduledAgentsCron.js");
      scheduleWithNodeCron(id, cronExpression, action, params);
    }
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
  logger.info({ id, name, cronExpression, action }, "Scheduled agent created");
  return agent;
}

export async function cancelScheduledAgent(id: string): Promise<boolean> {
  if (useSupabase()) {
    const { data, error } = await supabaseTable("scheduled_agents")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single();
    if (error || !data) return false;
    logger.info({ id }, "Scheduled agent cancelled");
    return true;
  }
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE scheduled_agents SET enabled = 0, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(id);
  if (result.changes === 0) return false;

  if (useRedis()) {
    const { removeScheduledRepeatableJob } =
      await import("./scheduledAgentsQueue.js");
    await removeScheduledRepeatableJob(id);
  } else {
    const { unscheduleNodeCron } = await import("./scheduledAgentsCron.js");
    unscheduleNodeCron(id);
  }
  logger.info({ id }, "Scheduled agent cancelled");
  return true;
}

export async function getScheduledAgent(
  id: string,
): Promise<ScheduledAgent | null> {
  if (useSupabase()) {
    const { data, error } = await supabaseTable("scheduled_agents")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return {
      id: data.id as string,
      name: data.name as string,
      cronExpression: data.cron_expression as string,
      action: data.action as ScheduledAction,
      params: (data.params_json as ScheduledAgentParams) ?? {},
      enabled: data.enabled === true,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, cron_expression AS cronExpression, action, params_json AS paramsJson, enabled, created_at AS createdAt, updated_at AS updatedAt
     FROM scheduled_agents WHERE id = ?`,
    )
    .get(id) as
    | {
      id: string;
      name: string;
      cronExpression: string;
      action: string;
      paramsJson: string;
      enabled: number;
      createdAt: string;
      updatedAt: string;
    }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    cronExpression: row.cronExpression,
    action: row.action as ScheduledAction,
    params: (row.paramsJson
      ? JSON.parse(row.paramsJson)
      : {}) as ScheduledAgentParams,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

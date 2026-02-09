/**
 * Heartbeat Service
 * Manages proactive scheduled tasks (hourly, daily, etc.)
 */

import { getDatabase } from "../../db/database.js";
import { writeAuditLog } from "../security/auditLogService.js";
import logger from "../../middleware/logger.js";
import type {
  HeartbeatRecord,
  CreateHeartbeatInput,
} from "../../types/integrations.js";

// We'll use node-cron compatible expressions
import { CronExpressionParser } from "cron-parser";

/**
 * Generate next run time from cron expression
 */
function getNextRunTime(cronExpression: string): string {
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    return interval.next().toISOString() ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
  } catch {
    // Default to 1 hour from now if cron parsing fails
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
}

/**
 * Create a new heartbeat
 */
export async function createHeartbeat(
  input: CreateHeartbeatInput,
): Promise<HeartbeatRecord> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const record: HeartbeatRecord = {
    id: `hb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: input.userId,
    name: input.name,
    cron_expression: input.cronExpression,
    enabled: true,
    payload: input.payload ? JSON.stringify(input.payload) : null,
    last_run_at: null,
    next_run_at: getNextRunTime(input.cronExpression),
    created_at: now,
    updated_at: now,
  };

  await db.saveHeartbeat(record);

  await writeAuditLog({
    userId: input.userId,
    action: "heartbeat.created",
    category: "automation",
    target: input.name,
    metadata: { cronExpression: input.cronExpression },
  });

  logger.info(
    { name: input.name, cron: input.cronExpression },
    "Heartbeat created",
  );
  return record;
}

/**
 * Get heartbeat by ID
 */
export async function getHeartbeat(
  id: string,
): Promise<HeartbeatRecord | null> {
  const db = getDatabase();
  return db.getHeartbeat(id);
}

/**
 * Get all heartbeats for a user
 */
export async function getHeartbeatsForUser(
  userId: string,
): Promise<HeartbeatRecord[]> {
  const db = getDatabase();
  return db.getHeartbeatsForUser(userId);
}

/**
 * Get all enabled heartbeats (for cron scheduler)
 */
export async function getEnabledHeartbeats(): Promise<HeartbeatRecord[]> {
  const db = getDatabase();
  return db.getEnabledHeartbeats();
}

/**
 * Get due heartbeats (next_run_at <= now)
 */
export async function getDueHeartbeats(): Promise<HeartbeatRecord[]> {
  const db = getDatabase();
  const enabled = await db.getEnabledHeartbeats();
  const now = new Date();

  return enabled.filter((hb) => {
    if (!hb.next_run_at) return true;
    return new Date(hb.next_run_at) <= now;
  });
}

/**
 * Update heartbeat after execution
 */
export async function markHeartbeatExecuted(id: string): Promise<void> {
  const db = getDatabase();
  const record = await db.getHeartbeat(id);
  if (!record) return;

  const now = new Date().toISOString();
  const nextRun = getNextRunTime(record.cron_expression);

  const updated: HeartbeatRecord = {
    ...record,
    last_run_at: now,
    next_run_at: nextRun,
    updated_at: now,
  };

  await db.saveHeartbeat(updated);
  logger.debug({ id, name: record.name, nextRun }, "Heartbeat executed");
}

/**
 * Enable/disable a heartbeat
 */
export async function setHeartbeatEnabled(
  id: string,
  enabled: boolean,
  userId: string,
): Promise<void> {
  const db = getDatabase();
  const record = await db.getHeartbeat(id);
  if (!record) {
    throw new Error(`Heartbeat not found: ${id}`);
  }

  const updated: HeartbeatRecord = {
    ...record,
    enabled,
    next_run_at: enabled ? getNextRunTime(record.cron_expression) : null,
    updated_at: new Date().toISOString(),
  };

  await db.saveHeartbeat(updated);

  await writeAuditLog({
    userId,
    action: enabled ? "heartbeat.enabled" : "heartbeat.disabled",
    category: "automation",
    target: record.name,
  });

  logger.info({ id, name: record.name, enabled }, "Heartbeat status changed");
}

/**
 * Update heartbeat schedule
 */
export async function updateHeartbeatSchedule(
  id: string,
  cronExpression: string,
  userId: string,
): Promise<void> {
  const db = getDatabase();
  const record = await db.getHeartbeat(id);
  if (!record) {
    throw new Error(`Heartbeat not found: ${id}`);
  }

  // Validate cron expression
  try {
    CronExpressionParser.parse(cronExpression);
  } catch {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  const updated: HeartbeatRecord = {
    ...record,
    cron_expression: cronExpression,
    next_run_at: record.enabled ? getNextRunTime(cronExpression) : null,
    updated_at: new Date().toISOString(),
  };

  await db.saveHeartbeat(updated);

  await writeAuditLog({
    userId,
    action: "heartbeat.schedule_updated",
    category: "automation",
    target: record.name,
    metadata: { cronExpression },
  });

  logger.info(
    { id, name: record.name, cron: cronExpression },
    "Heartbeat schedule updated",
  );
}

/**
 * Delete a heartbeat
 */
export async function deleteHeartbeat(
  id: string,
  userId: string,
): Promise<void> {
  const db = getDatabase();
  const record = await db.getHeartbeat(id);
  if (!record) return;

  await db.deleteHeartbeat(id);

  await writeAuditLog({
    userId,
    action: "heartbeat.deleted",
    category: "automation",
    target: record.name,
  });

  logger.info({ id, name: record.name }, "Heartbeat deleted");
}

// ========== Predefined Heartbeat Templates ==========

export const HEARTBEAT_TEMPLATES = {
  HOURLY_SUMMARY: {
    name: "Hourly Summary",
    cronExpression: "0 * * * *", // Every hour
    description: "Generate a summary of recent activity",
  },
  DAILY_DIGEST: {
    name: "Daily Digest",
    cronExpression: "0 9 * * *", // 9 AM daily
    description: "Send daily digest of tasks and updates",
  },
  WEEKLY_REVIEW: {
    name: "Weekly Review",
    cronExpression: "0 10 * * 1", // 10 AM Monday
    description: "Weekly progress review and planning",
  },
  HEALTH_CHECK: {
    name: "System Health Check",
    cronExpression: "*/15 * * * *", // Every 15 minutes
    description: "Check system health and integrations",
  },
  MEMORY_CLEANUP: {
    name: "Memory Cleanup",
    cronExpression: "0 3 * * *", // 3 AM daily
    description: "Clean up expired memories and optimize storage",
  },
  REMINDER_CHECK: {
    name: "Reminder Check",
    cronExpression: "*/5 * * * *", // Every 5 minutes
    description: "Process due reminders and notify via messaging",
  },
  INBOX_SUMMARY: {
    name: "Inbox Summary",
    cronExpression: "0 9 * * *", // 9 AM daily
    description: "Daily email digest (requires Gmail OAuth)",
  },
  CALENDAR_REMINDER: {
    name: "Calendar Reminder",
    cronExpression: "0 8 * * *", // 8 AM daily
    description: "Upcoming events reminder (requires Google Calendar OAuth)",
  },
  CUSTOM_REMINDER: {
    name: "Custom Reminder",
    cronExpression: "0 9 * * *", // 9 AM daily
    description: "User-defined reminder text",
  },
} as const;

/**
 * Create heartbeat from template
 */
export async function createHeartbeatFromTemplate(
  userId: string,
  templateKey: keyof typeof HEARTBEAT_TEMPLATES,
  payload?: Record<string, unknown>,
): Promise<HeartbeatRecord> {
  const template = HEARTBEAT_TEMPLATES[templateKey];
  return createHeartbeat({
    userId,
    name: template.name,
    cronExpression: template.cronExpression,
    payload: {
      template: templateKey,
      description: template.description,
      ...payload,
    },
  });
}

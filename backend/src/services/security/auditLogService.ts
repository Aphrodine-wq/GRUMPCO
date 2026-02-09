import { getDatabase } from "../../db/database.js";
import logger from "../../middleware/logger.js";
import type { AuditCategory, AuditLogRecord } from "../../types/integrations.js";

export interface AuditLogInput {
  userId: string;
  action: string;
  category: AuditCategory;
  actor?: string;
  target?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit log entry
 * Audit logs track all significant actions for security and compliance
 */
export async function writeAuditLog(entry: AuditLogInput): Promise<void> {
  try {
    const db = getDatabase();
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const record: AuditLogRecord = {
      id,
      user_id: entry.userId,
      actor: entry.actor ?? null,
      action: entry.action,
      category: entry.category,
      target: entry.target ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      created_at: new Date().toISOString(),
    };
    await db.saveAuditLog(record);
  } catch (err) {
    // Audit log failures should not break the application
    logger.warn({ error: (err as Error).message }, "Audit log write failed");
  }
}

/**
 * Query audit logs with optional filters
 */
export async function queryAuditLogs(
  options: {
    userId?: string;
    category?: AuditCategory;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AuditLogRecord[]> {
  try {
    const db = getDatabase();
    return await db.getAuditLogs({
      userId: options.userId,
      category: options.category,
      limit: options.limit ?? 100,
      offset: options.offset,
    });
  } catch (err) {
    logger.error({ error: (err as Error).message }, "Audit log query failed");
    return [];
  }
}

// Re-export AuditCategory for convenience
export type { AuditCategory } from "../../types/integrations.js";

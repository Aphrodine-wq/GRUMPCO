/**
 * Goal Repository
 *
 * Database persistence layer for G-Agent goals.
 * Provides CRUD operations with support for both SQLite and PostgreSQL.
 *
 * @module gAgent/goalRepository
 */

import { CronExpressionParser } from "cron-parser";
import type { GoalRow } from "../db/schema.js";
import type {
  Goal,
  GoalCheckpoint,
  GoalStatus,
  GoalPriority,
  GoalTrigger,
  AgentArtifact,
} from "./types.js";
import logger from "../middleware/logger.js";
import { recordDbOperation } from "../middleware/metrics.js";

// =============================================================================
// Database Types
// =============================================================================

/**
 * Database interface for better-sqlite3 style synchronous operations.
 * This provides type safety for database operations without importing
 * better-sqlite3 directly (allowing for database abstraction).
 */
interface DatabaseStatement<T = unknown> {
  run(...params: unknown[]): {
    changes: number;
    lastInsertRowid: number | bigint;
  };
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
}

interface Database {
  prepare<T = unknown>(sql: string): DatabaseStatement<T>;
}

/**
 * SQL parameter types for type-safe query building
 */
type SqlParam = string | number | boolean | null;

// ============================================================================
// Types
// ============================================================================

export interface GoalCreateInput {
  userId: string;
  description: string;
  priority?: GoalPriority;
  trigger?: GoalTrigger;
  scheduledAt?: string;
  cronExpression?: string;
  workspaceRoot?: string;
  parentGoalId?: string;
  tags?: string[];
  maxRetries?: number;
}

export interface GoalUpdateInput {
  status?: GoalStatus;
  priority?: GoalPriority;
  planId?: string;
  sessionId?: string;
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  nextRunAt?: string;
  retryCount?: number;
  checkpoints?: GoalCheckpoint[];
  currentCheckpointId?: string;
  childGoalIds?: string[];
  artifacts?: AgentArtifact[];
}

export interface GoalFilter {
  userId?: string;
  status?: GoalStatus[];
  priority?: GoalPriority[];
  trigger?: GoalTrigger[];
  parentGoalId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "priority" | "nextRunAt";
  orderDir?: "asc" | "desc";
}

export interface GoalStats {
  pending: number;
  scheduled: number;
  planning: number;
  awaiting_approval: number;
  executing: number;
  paused: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

// ============================================================================
// Repository Implementation
// ============================================================================

class GoalRepository {
  private db: Database | null = null; // Will be set during initialization

  /**
   * Initialize with database instance
   */
  setDatabase(db: Database): void {
    this.db = db;
  }

  /**
   * Get the database instance, throwing if not initialized
   */
  private getDb(): Database {
    if (!this.db) {
      throw new Error(
        "GoalRepository not initialized. Call setDatabase() first.",
      );
    }
    return this.db;
  }

  // ==========================================================================
  // Goal CRUD
  // ==========================================================================

  /**
   * Create a new goal
   */
  async create(input: GoalCreateInput): Promise<Goal> {
    const db = this.getDb();
    const start = process.hrtime.bigint();

    try {
      const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      const status: GoalStatus =
        input.scheduledAt || input.cronExpression ? "scheduled" : "pending";
      const trigger: GoalTrigger =
        input.trigger ?? (input.scheduledAt ? "scheduled" : "immediate");

      // Calculate next run time
      let nextRunAt: string | null = null;
      if (input.scheduledAt) {
        nextRunAt = input.scheduledAt;
      } else if (input.cronExpression) {
        nextRunAt = this.calculateNextCronRun(input.cronExpression);
      }

      const stmt = db.prepare(`
        INSERT INTO goals (
          id, user_id, description, status, priority, trigger,
          scheduled_at, cron_expression, workspace_root, parent_goal_id,
          child_goal_ids, checkpoints, tags,
          retry_count, max_retries, created_at, updated_at, next_run_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        input.userId,
        input.description,
        status,
        input.priority ?? "normal",
        trigger,
        input.scheduledAt ?? null,
        input.cronExpression ?? null,
        input.workspaceRoot ?? null,
        input.parentGoalId ?? null,
        "[]", // child_goal_ids
        "[]", // checkpoints
        JSON.stringify(input.tags ?? []),
        0,
        input.maxRetries ?? 3,
        now,
        now,
        nextRunAt,
      );

      const goal = await this.getById(id);
      if (!goal) {
        throw new Error("Failed to create goal");
      }

      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation("createGoal", "goals", duration, "success");

      logger.info({ goalId: id, userId: input.userId }, "Goal created");
      return goal;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation("createGoal", "goals", duration, "error");
      throw error;
    }
  }

  /**
   * Get a goal by ID
   */
  async getById(id: string): Promise<Goal | null> {
    const db = this.getDb();

    const stmt = db.prepare("SELECT * FROM goals WHERE id = ?");
    const row = stmt.get(id) as GoalRow | undefined;

    if (!row) {
      return null;
    }

    return this.rowToGoal(row);
  }

  /**
   * Update a goal
   */
  async update(id: string, input: GoalUpdateInput): Promise<Goal | null> {
    const db = this.getDb();
    const start = process.hrtime.bigint();

    try {
      const existing = await this.getById(id);
      if (!existing) {
        return null;
      }

      const updates: string[] = [];
      const params: SqlParam[] = [];

      if (input.status !== undefined) {
        updates.push("status = ?");
        params.push(input.status);
      }
      if (input.priority !== undefined) {
        updates.push("priority = ?");
        params.push(input.priority);
      }
      if (input.planId !== undefined) {
        updates.push("plan_id = ?");
        params.push(input.planId);
      }
      if (input.sessionId !== undefined) {
        updates.push("session_id = ?");
        params.push(input.sessionId);
      }
      if (input.result !== undefined) {
        updates.push("result = ?");
        params.push(input.result);
      }
      if (input.error !== undefined) {
        updates.push("error = ?");
        params.push(input.error);
      }
      if (input.startedAt !== undefined) {
        updates.push("started_at = ?");
        params.push(input.startedAt);
      }
      if (input.completedAt !== undefined) {
        updates.push("completed_at = ?");
        params.push(input.completedAt);
      }
      if (input.nextRunAt !== undefined) {
        updates.push("next_run_at = ?");
        params.push(input.nextRunAt);
      }
      if (input.retryCount !== undefined) {
        updates.push("retry_count = ?");
        params.push(input.retryCount);
      }
      if (input.checkpoints !== undefined) {
        updates.push("checkpoints = ?");
        params.push(JSON.stringify(input.checkpoints));
      }
      if (input.currentCheckpointId !== undefined) {
        updates.push("current_checkpoint_id = ?");
        params.push(input.currentCheckpointId);
      }
      if (input.childGoalIds !== undefined) {
        updates.push("child_goal_ids = ?");
        params.push(JSON.stringify(input.childGoalIds));
      }
      if (input.artifacts !== undefined) {
        updates.push("artifacts = ?");
        params.push(JSON.stringify(input.artifacts));
      }

      if (updates.length === 0) {
        return existing;
      }

      updates.push("updated_at = ?");
      params.push(new Date().toISOString());
      params.push(id);

      const stmt = db.prepare(`
        UPDATE goals SET ${updates.join(", ")} WHERE id = ?
      `);
      stmt.run(...params);

      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation("updateGoal", "goals", duration, "success");

      return this.getById(id);
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation("updateGoal", "goals", duration, "error");
      throw error;
    }
  }

  /**
   * Delete a goal
   */
  async delete(id: string): Promise<boolean> {
    const db = this.getDb();

    const stmt = db.prepare("DELETE FROM goals WHERE id = ?");
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * List goals with filters
   */
  async list(filter: GoalFilter = {}): Promise<Goal[]> {
    const db = this.getDb();

    let sql = "SELECT * FROM goals WHERE 1=1";
    const params: SqlParam[] = [];

    if (filter.userId) {
      sql += " AND user_id = ?";
      params.push(filter.userId);
    }

    if (filter.status && filter.status.length > 0) {
      sql += ` AND status IN (${filter.status.map(() => "?").join(", ")})`;
      params.push(...filter.status);
    }

    if (filter.priority && filter.priority.length > 0) {
      sql += ` AND priority IN (${filter.priority.map(() => "?").join(", ")})`;
      params.push(...filter.priority);
    }

    if (filter.trigger && filter.trigger.length > 0) {
      sql += ` AND trigger IN (${filter.trigger.map(() => "?").join(", ")})`;
      params.push(...filter.trigger);
    }

    if (filter.parentGoalId) {
      sql += " AND parent_goal_id = ?";
      params.push(filter.parentGoalId);
    }

    // Order by
    const orderDir = filter.orderDir === "asc" ? "ASC" : "DESC";

    // For priority ordering, we need custom ordering (urgent=0, high=1, normal=2, low=3)
    if (filter.orderBy === "priority") {
      sql += ` ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END ${orderDir}`;
    } else if (filter.orderBy === "nextRunAt") {
      sql += ` ORDER BY next_run_at ${orderDir}`;
    } else {
      sql += ` ORDER BY created_at ${orderDir}`;
    }

    if (filter.limit) {
      sql += " LIMIT ?";
      params.push(filter.limit);
    }

    if (filter.offset) {
      sql += " OFFSET ?";
      params.push(filter.offset);
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as GoalRow[];

    return rows.map((row) => this.rowToGoal(row));
  }

  /**
   * Get goals that are due for execution
   */
  async getDueGoals(limit = 10): Promise<Goal[]> {
    const db = this.getDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      SELECT * FROM goals 
      WHERE status = 'scheduled' 
        AND next_run_at IS NOT NULL 
        AND next_run_at <= ?
      ORDER BY 
        CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END ASC,
        next_run_at ASC
      LIMIT ?
    `);

    const rows = stmt.all(now, limit) as GoalRow[];
    return rows.map((row) => this.rowToGoal(row));
  }

  /**
   * Get the next pending goal for a user (highest priority first)
   */
  async getNextPendingGoal(userId: string): Promise<Goal | null> {
    const db = this.getDb();

    const stmt = db.prepare(`
      SELECT * FROM goals 
      WHERE user_id = ? AND status = 'pending'
      ORDER BY 
        CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END ASC,
        created_at ASC
      LIMIT 1
    `);

    const row = stmt.get(userId) as GoalRow | undefined;
    return row ? this.rowToGoal(row) : null;
  }

  /**
   * Get goal statistics
   */
  async getStats(userId?: string): Promise<GoalStats> {
    const db = this.getDb();

    let sql = `
      SELECT 
        status,
        COUNT(*) as count
      FROM goals
    `;
    const params: SqlParam[] = [];

    if (userId) {
      sql += " WHERE user_id = ?";
      params.push(userId);
    }

    sql += " GROUP BY status";

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as { status: GoalStatus; count: number }[];

    const stats: GoalStats = {
      pending: 0,
      scheduled: 0,
      planning: 0,
      awaiting_approval: 0,
      executing: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    };

    for (const row of rows) {
      if (row.status in stats) {
        stats[row.status as keyof Omit<GoalStats, "total">] = row.count;
      }
      stats.total += row.count;
    }

    return stats;
  }

  // ==========================================================================
  // Checkpoint Operations
  // ==========================================================================

  /**
   * Add a checkpoint to a goal
   */
  async addCheckpoint(
    goalId: string,
    checkpoint: Omit<GoalCheckpoint, "id" | "goalId" | "createdAt">,
  ): Promise<GoalCheckpoint | null> {
    const goal = await this.getById(goalId);
    if (!goal) {
      return null;
    }

    const newCheckpoint: GoalCheckpoint = {
      id: `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      goalId,
      phase: checkpoint.phase,
      progress: checkpoint.progress,
      state: checkpoint.state,
      createdAt: new Date().toISOString(),
    };

    const checkpoints = [...goal.checkpoints, newCheckpoint];

    await this.update(goalId, {
      checkpoints,
      currentCheckpointId: newCheckpoint.id,
    });

    return newCheckpoint;
  }

  /**
   * Get the latest checkpoint for a goal
   */
  async getLatestCheckpoint(goalId: string): Promise<GoalCheckpoint | null> {
    const goal = await this.getById(goalId);
    if (!goal || goal.checkpoints.length === 0) {
      return null;
    }

    if (goal.currentCheckpointId) {
      return (
        goal.checkpoints.find((c) => c.id === goal.currentCheckpointId) ?? null
      );
    }

    return goal.checkpoints[goal.checkpoints.length - 1];
  }

  // ==========================================================================
  // Child Goals
  // ==========================================================================

  /**
   * Add a child goal ID to a parent goal
   */
  async addChildGoal(
    parentGoalId: string,
    childGoalId: string,
  ): Promise<boolean> {
    const parent = await this.getById(parentGoalId);
    if (!parent) {
      return false;
    }

    const childGoalIds = [...parent.childGoalIds, childGoalId];
    await this.update(parentGoalId, { childGoalIds });
    return true;
  }

  /**
   * Get child goals (sub-goals spawned from a parent)
   */
  async getChildGoals(parentGoalId: string): Promise<Goal[]> {
    return this.list({ parentGoalId });
  }

  /**
   * Get goal lineage (parent chain)
   */
  async getGoalLineage(goalId: string): Promise<Goal[]> {
    const lineage: Goal[] = [];
    let current = await this.getById(goalId);

    while (current) {
      lineage.push(current);
      if (!current.parentGoalId) break;
      current = await this.getById(current.parentGoalId);
    }

    return lineage;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Convert a database row to a Goal object
   */
  private rowToGoal(row: GoalRow): Goal {
    return {
      id: row.id,
      userId: row.user_id,
      description: row.description,
      status: row.status,
      priority: row.priority,
      trigger: row.trigger,
      scheduledAt: row.scheduled_at ?? undefined,
      cronExpression: row.cron_expression ?? undefined,
      nextRunAt: row.next_run_at ?? undefined,
      workspaceRoot: row.workspace_root ?? undefined,
      planId: row.plan_id ?? undefined,
      sessionId: row.session_id ?? undefined,
      parentGoalId: row.parent_goal_id ?? undefined,
      childGoalIds: JSON.parse(row.child_goal_ids),
      checkpoints: JSON.parse(row.checkpoints),
      currentCheckpointId: row.current_checkpoint_id ?? undefined,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
      artifacts: row.artifacts ? JSON.parse(row.artifacts) : undefined,
      tags: JSON.parse(row.tags),
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
    };
  }

  /**
   * Calculate next cron run time using cron-parser
   */
  private calculateNextCronRun(cronExpression: string): string {
    try {
      const interval = CronExpressionParser.parse(cronExpression);
      const nextDate = interval.next().toDate();
      return nextDate ? nextDate.toISOString() : new Date(Date.now() + 60 * 1000).toISOString();
    } catch (err) {
      logger.warn(
        { err, cronExpression },
        "Invalid cron expression, falling back to next minute",
      );
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);
      now.setSeconds(0);
      now.setMilliseconds(0);
      return now.toISOString();
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const goalRepository = new GoalRepository();
export default goalRepository;

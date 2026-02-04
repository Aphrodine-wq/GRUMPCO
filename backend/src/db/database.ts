/**
 * Database Service Layer
 * Provides database abstraction with SQLite (desktop) and PostgreSQL (scale) support
 *
 * Optimizations:
 * - Prepared statement caching (statements compiled once, reused)
 * - Query result caching for frequently accessed data
 * - WAL mode for better concurrency
 */

import fs from "fs";
import path from "path";
// NOTE: better-sqlite3 is dynamically imported only when DB_TYPE=sqlite
// This avoids loading native modules in serverless environments
import type DatabaseType from "better-sqlite3";
import { SupabaseDatabaseService } from "./supabase-db.js";
import {
  type SessionRow,
  type PlanRow,
  type SpecRow,
  type ShipSessionRow,
  type WorkReportRow,
} from "./schema.js";
import logger from "../middleware/logger.js";
import { recordDbOperation } from "../middleware/metrics.js";
import type { GenerationSession, AgentWorkReport } from "../types/agents.js";
import type { ShipSession } from "../types/ship.js";
import type { Plan } from "../types/plan.js";
import type { SpecSession } from "../types/spec.js";
import type { Settings } from "../types/settings.js";
import type {
  IntegrationRecord,
  OAuthTokenRecord,
  IntegrationSecretRecord,
  AuditLogRecord,
  HeartbeatRecord,
  ApprovalRequestRecord,
  SwarmAgentRecord,
  SkillRecord,
  MemoryRecord,
  CostBudgetRecord,
  RateLimitRecord,
  BrowserAllowlistRecord,
  IntegrationProviderId,
  SlackTokenRecord,
  ConversationMemoryRecord,
  MessagingSubscriptionRecord,
  SlackUserPairingRecord,
  ReminderRecord,
} from "../types/integrations.js";

type DbType = "sqlite" | "postgresql" | "supabase";

// Query result cache entry
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Cache TTL configuration (in milliseconds)
const CACHE_TTL = {
  settings: 5 * 60 * 1000, // 5 minutes for settings
  session: 30 * 1000, // 30 seconds for sessions
  usage: 60 * 1000, // 1 minute for usage stats
};

interface DatabaseConfig {
  type: DbType;
  sqlite?: {
    path: string;
  };
  postgresql?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

interface UsageRecordRow {
  id: string;
  user_id: string;
  endpoint: string;
  method: string;
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  latency_ms?: number | null;
  success: number;
  created_at: string;
}

class DatabaseService {
  private db: DatabaseType.Database | null = null;
  private config: DatabaseConfig;
  private initialized = false;

  // Prepared statement cache (compiled once, reused)
  private statementCache = new Map<string, DatabaseType.Statement>();

  // Query result cache for frequently accessed data
  private resultCache = new Map<string, CacheEntry<unknown>>();

  // Cache statistics
  private cacheStats = {
    hits: 0,
    misses: 0,
    statementsCompiled: 0,
    statementsCached: 0,
  };

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Get or create a prepared statement (cached for reuse)
   */
  private getStatement(sql: string): DatabaseType.Statement {
    if (!this.db) throw new Error("Database not initialized");

    let stmt = this.statementCache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.statementCache.set(sql, stmt);
      this.cacheStats.statementsCompiled++;
      this.cacheStats.statementsCached = this.statementCache.size;
    }
    return stmt;
  }

  /**
   * Get cached result or execute query
   */
  private getCachedOrFetch<T>(
    cacheKey: string,
    ttl: number,
    fetchFn: () => T,
  ): T {
    const cached = this.resultCache.get(cacheKey) as CacheEntry<T> | undefined;
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      this.cacheStats.hits++;
      return cached.data;
    }

    this.cacheStats.misses++;
    const data = fetchFn();
    this.resultCache.set(cacheKey, {
      data,
      expiresAt: now + ttl,
    });

    return data;
  }

  /**
   * Invalidate cache entries matching a prefix
   */
  private invalidateCache(prefix: string): void {
    for (const key of this.resultCache.keys()) {
      if (key.startsWith(prefix)) {
        this.resultCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    resultCache: {
      hits: number;
      misses: number;
      hitRate: number;
      size: number;
    };
    statementCache: { compiled: number; cached: number };
  } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return {
      resultCache: {
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hitRate: total > 0 ? this.cacheStats.hits / total : 0,
        size: this.resultCache.size,
      },
      statementCache: {
        compiled: this.cacheStats.statementsCompiled,
        cached: this.cacheStats.statementsCached,
      },
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.resultCache.clear();
    // Don't clear statement cache - statements remain valid
    logger.debug("Database result cache cleared");
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      if (this.config.type === "sqlite") {
        // Dynamic import to avoid loading native module in serverless
        const Database = (await import("better-sqlite3")).default;
        const { runMigrations } = await import("./migrate.js");
        const dbPath = this.config.sqlite?.path || "./data/grump.db";
        const dir = path.dirname(path.resolve(dbPath));
        fs.mkdirSync(dir, { recursive: true });
        this.db = new Database(dbPath);

        // Performance pragmas
        this.db.pragma("journal_mode = WAL"); // Better concurrency
        this.db.pragma("synchronous = NORMAL"); // Balance safety/speed
        this.db.pragma("cache_size = -64000"); // 64MB cache
        this.db.pragma("temp_store = MEMORY"); // Temp tables in memory
        this.db.pragma("mmap_size = 268435456"); // 256MB memory-mapped I/O
        this.db.pragma("foreign_keys = ON"); // Enable foreign keys
        this.db.pragma("busy_timeout = 5000"); // 5s timeout for locks

        // Verify WAL mode
        const journalMode = this.db.pragma("journal_mode");
        logger.debug({ journalMode }, "SQLite journal mode");

        runMigrations(this.db);
        logger.info(
          {
            path: dbPath,
            pragmas: {
              journalMode: "WAL",
              cacheSize: "64MB",
              mmapSize: "256MB",
            },
          },
          "SQLite database initialized with optimizations",
        );
      } else if (this.config.type === "postgresql") {
        // PostgreSQL planned; production uses SQLite + Redis today (see docs/SCALING.md).
        throw new Error("PostgreSQL support not yet implemented");
      }

      this.initialized = true;
      logger.info({ type: this.config.type }, "Database service initialized");
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        "Database initialization failed",
      );
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      // Clear caches before closing
      this.resultCache.clear();
      this.statementCache.clear();

      this.db.close();
      this.db = null;
      this.initialized = false;
      logger.info(
        {
          cacheStats: this.getCacheStats(),
        },
        "Database connection closed",
      );
    }
  }

  /**
   * Get database instance (for raw queries if needed)
   */
  getDb(): DatabaseType.Database {
    if (!this.db || !this.initialized) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  // ========== Sessions ==========

  /**
   * Save or update a generation session
   */
  async saveSession(session: GenerationSession): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const start = process.hrtime.bigint();
    try {
      const stmt = this.getStatement(`
        INSERT INTO sessions (id, type, status, data, created_at, updated_at, started_at, completed_at, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          data = excluded.data,
          updated_at = excluded.updated_at,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          project_id = excluded.project_id
      `);

      stmt.run(
        session.sessionId,
        "generation",
        session.status,
        JSON.stringify(session),
        session.createdAt,
        new Date().toISOString(),
        session.startedAt || null,
        session.completedAt || null,
        session.projectId ?? null,
      );

      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation("saveSession", "sessions", duration, "success");
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation("saveSession", "sessions", duration, "error");
      throw error;
    }
  }

  /**
   * Get a generation session by ID
   */
  async getSession(sessionId: string): Promise<GenerationSession | null> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement(
      "SELECT * FROM sessions WHERE id = ? AND type = ?",
    );
    const row = stmt.get(sessionId, "generation") as SessionRow | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.data) as GenerationSession;
  }

  /**
   * List sessions with optional filters
   */
  async listSessions(
    options: {
      type?: "generation" | "ship" | "spec" | "plan";
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<GenerationSession[]> {
    if (!this.db) throw new Error("Database not initialized");

    let query = "SELECT * FROM sessions WHERE 1=1";
    const params: (string | number)[] = [];

    if (options.type) {
      query += " AND type = ?";
      params.push(options.type);
    }

    if (options.status) {
      query += " AND status = ?";
      params.push(options.status);
    }

    query += " ORDER BY created_at DESC";

    if (options.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    if (options.offset) {
      query += " OFFSET ?";
      params.push(options.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as SessionRow[];

    return rows.map((row) => JSON.parse(row.data) as GenerationSession);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement("DELETE FROM sessions WHERE id = ?");
    stmt.run(sessionId);
  }

  // ========== Ship Sessions ==========

  /**
   * Save or update a ship session
   */
  async saveShipSession(session: ShipSession): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement(`
      INSERT INTO ship_sessions (id, phase, status, data, created_at, updated_at, project_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        phase = excluded.phase,
        status = excluded.status,
        data = excluded.data,
        updated_at = excluded.updated_at,
        project_id = excluded.project_id
    `);

    stmt.run(
      session.id,
      session.phase,
      session.status,
      JSON.stringify(session),
      session.createdAt,
      session.updatedAt,
      session.projectId ?? null,
    );
  }

  /**
   * Get a ship session by ID
   */
  async getShipSession(sessionId: string): Promise<ShipSession | null> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement("SELECT * FROM ship_sessions WHERE id = ?");
    const row = stmt.get(sessionId) as ShipSessionRow | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.data) as ShipSession;
  }

  /**
   * List ship sessions
   */
  async listShipSessions(
    options: {
      phase?: string;
      status?: string;
      projectId?: string;
      limit?: number;
    } = {},
  ): Promise<ShipSession[]> {
    if (!this.db) throw new Error("Database not initialized");

    let query = "SELECT * FROM ship_sessions WHERE 1=1";
    const params: (string | number)[] = [];

    if (options.phase) {
      query += " AND phase = ?";
      params.push(options.phase);
    }

    if (options.status) {
      query += " AND status = ?";
      params.push(options.status);
    }

    if (options.projectId != null) {
      query += " AND project_id = ?";
      params.push(options.projectId);
    }

    query += " ORDER BY created_at DESC";

    if (options.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as ShipSessionRow[];

    return rows.map((row) => JSON.parse(row.data) as ShipSession);
  }

  // ========== Plans ==========

  /**
   * Save or update a plan
   */
  async savePlan(plan: Plan): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement(`
      INSERT INTO plans (id, session_id, data, created_at, updated_at, approved_at, approved_by, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at,
        approved_at = excluded.approved_at,
        approved_by = excluded.approved_by,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at
    `);

    stmt.run(
      plan.id,
      null, // session_id can be set if needed
      JSON.stringify(plan),
      plan.createdAt,
      plan.updatedAt,
      plan.approvedAt || null,
      plan.approvedBy || null,
      plan.startedAt || null,
      plan.completedAt || null,
    );
  }

  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<Plan | null> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement("SELECT * FROM plans WHERE id = ?");
    const row = stmt.get(planId) as PlanRow | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.data) as Plan;
  }

  /**
   * List plans
   */
  async listPlans(
    options: {
      status?: string;
      limit?: number;
    } = {},
  ): Promise<Plan[]> {
    if (!this.db) throw new Error("Database not initialized");

    let query = "SELECT * FROM plans WHERE 1=1";
    const params: (string | number)[] = [];

    if (options.status) {
      query += ' AND json_extract(data, "$.status") = ?';
      params.push(options.status);
    }

    query += " ORDER BY created_at DESC";

    if (options.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as PlanRow[];

    return rows.map((row) => JSON.parse(row.data) as Plan);
  }

  // ========== Specs ==========

  /**
   * Save or update a spec session
   */
  async saveSpec(spec: SpecSession): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement(`
      INSERT INTO specs (id, session_id, data, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `);

    stmt.run(
      spec.id,
      null, // session_id can be set if needed
      JSON.stringify(spec),
      spec.createdAt,
      spec.updatedAt,
      spec.completedAt || null,
    );
  }

  /**
   * Get a spec by ID
   */
  async getSpec(specId: string): Promise<SpecSession | null> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement("SELECT * FROM specs WHERE id = ?");
    const row = stmt.get(specId) as SpecRow | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.data) as SpecSession;
  }

  /**
   * Alias for saveSpec (for sessionStorage compatibility)
   */
  async saveSpecSession(spec: SpecSession): Promise<void> {
    return this.saveSpec(spec);
  }

  /**
   * Alias for getSpec (for sessionStorage compatibility)
   */
  async getSpecSession(specId: string): Promise<SpecSession | null> {
    return this.getSpec(specId);
  }

  // ========== Work Reports ==========

  /**
   * Save a work report
   */
  async saveWorkReport(report: AgentWorkReport): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement(`
      INSERT INTO work_reports (id, session_id, agent_type, report, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        report = excluded.report
    `);

    const reportId = `report_${report.sessionId}_${report.agentType}_${Date.now()}`;
    stmt.run(
      reportId,
      report.sessionId,
      report.agentType,
      JSON.stringify(report),
      report.generatedAt,
    );
  }

  /**
   * Get work reports for a session
   */
  async getWorkReports(sessionId: string): Promise<AgentWorkReport[]> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement(
      "SELECT * FROM work_reports WHERE session_id = ? ORDER BY created_at",
    );
    const rows = stmt.all(sessionId) as WorkReportRow[];

    return rows.map((row) => JSON.parse(row.report) as AgentWorkReport);
  }

  // ========== Settings ==========

  /**
   * Get settings by user key (e.g. userId or 'default')
   * Uses result caching for frequently accessed settings
   */
  async getSettings(userKey: string): Promise<Settings | null> {
    if (!this.db) throw new Error("Database not initialized");

    const cacheKey = `settings:${userKey}`;

    return this.getCachedOrFetch<Settings | null>(
      cacheKey,
      CACHE_TTL.settings,
      () => {
        const stmt = this.getStatement(
          "SELECT data FROM settings WHERE id = ?",
        );
        const row = stmt.get(userKey) as { data: string } | undefined;
        if (!row) return null;
        return JSON.parse(row.data) as Settings;
      },
    );
  }

  /**
   * Save or update settings for a user key
   */
  async saveSettings(userKey: string, data: Settings): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const updatedAt = new Date().toISOString();
    const payload = { ...data, updatedAt };
    const stmt = this.getStatement(`
      INSERT INTO settings (id, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `);
    stmt.run(userKey, JSON.stringify(payload), updatedAt);

    // Invalidate cache
    this.invalidateCache(`settings:${userKey}`);
  }

  // ========== Usage Records ==========

  /**
   * Save a usage record for API tracking
   */
  async saveUsageRecord(record: {
    id: string;
    userId: string;
    endpoint: string;
    method: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    storageBytes?: number;
    success: boolean;
  }): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const start = process.hrtime.bigint();
    try {
      const stmt = this.getStatement(`
        INSERT INTO usage_records
        (id, user_id, endpoint, method, model, input_tokens, output_tokens, latency_ms, storage_bytes, success, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        record.id,
        record.userId,
        record.endpoint,
        record.method,
        record.model || null,
        record.inputTokens || null,
        record.outputTokens || null,
        record.latencyMs || null,
        record.storageBytes || null,
        record.success ? 1 : 0,
      );

      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation(
        "saveUsageRecord",
        "usage_records",
        duration,
        "success",
      );
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation("saveUsageRecord", "usage_records", duration, "error");
      throw error;
    }
  }

  /**
   * Get usage records for a user within a date range
   */
  async getUsageForUser(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<UsageRecordRow[]> {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.getStatement(`
      SELECT * FROM usage_records
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `);

    return stmt.all(
      userId,
      fromDate.toISOString(),
      toDate.toISOString(),
    ) as UsageRecordRow[];
  }

  /**
   * Get monthly token usage for a user
   */
  async getMonthlyTokenUsage(
    userId: string,
  ): Promise<{ input: number; output: number }> {
    if (!this.db) throw new Error("Database not initialized");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stmt = this.getStatement(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as input,
        COALESCE(SUM(output_tokens), 0) as output
      FROM usage_records
      WHERE user_id = ? AND created_at >= ?
    `);

    const result = stmt.get(userId, startOfMonth.toISOString()) as
      | { input?: number; output?: number }
      | undefined;
    return {
      input: result?.input ?? 0,
      output: result?.output ?? 0,
    };
  }

  /**
   * Get API usage summary (cached for 1 minute)
   */
  async getUsageSummary(userId: string): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    monthlyInputTokens: number;
    monthlyOutputTokens: number;
    avgLatencyMs: number;
  }> {
    if (!this.db) throw new Error("Database not initialized");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const cacheKey = `usage:summary:${userId}:${startOfMonth.toISOString().slice(0, 7)}`;

    return this.getCachedOrFetch(cacheKey, CACHE_TTL.usage, () => {
      const stmt = this.getStatement(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
            COALESCE(SUM(input_tokens), 0) as input_tokens,
            COALESCE(SUM(output_tokens), 0) as output_tokens,
            COALESCE(ROUND(AVG(latency_ms)), 0) as avg_latency
          FROM usage_records
          WHERE user_id = ? AND created_at >= ?
        `);

      const result = stmt.get(userId, startOfMonth.toISOString()) as
        | {
            total?: number;
            successful?: number;
            failed?: number;
            input_tokens?: number;
            output_tokens?: number;
            avg_latency?: number;
          }
        | undefined;

      return {
        totalRequests: result?.total ?? 0,
        successfulRequests: result?.successful ?? 0,
        failedRequests: result?.failed ?? 0,
        monthlyInputTokens: result?.input_tokens ?? 0,
        monthlyOutputTokens: result?.output_tokens ?? 0,
        avgLatencyMs: result?.avg_latency ?? 0,
      };
    });
  }

  // ========== Comments & Version History ==========

  /** Insert a comment (requires migration 010). */
  insertComment(p: {
    id: string;
    project_id: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    parent_id?: string | null;
    body: string;
  }): void {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO comments (id, project_id, entity_type, entity_id, user_id, parent_id, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(
      p.id,
      p.project_id,
      p.entity_type,
      p.entity_id,
      p.user_id,
      p.parent_id ?? null,
      p.body,
    );
  }

  /** List comments for an entity (requires migration 010). */
  listComments(
    entity_type: string,
    entity_id: string,
  ): {
    id: string;
    project_id: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    parent_id: string | null;
    body: string;
    created_at: string;
    updated_at: string;
  }[] {
    if (!this.db) throw new Error("Database not initialized");
    try {
      const stmt = this.getStatement(
        "SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at",
      );
      return stmt.all(entity_type, entity_id) as {
        id: string;
        project_id: string;
        entity_type: string;
        entity_id: string;
        user_id: string;
        parent_id: string | null;
        body: string;
        created_at: string;
        updated_at: string;
      }[];
    } catch {
      return [];
    }
  }

  /** Insert a version snapshot (requires migration 010). */
  insertVersion(p: {
    id: string;
    project_id: string;
    entity_type: string;
    entity_id: string;
    version: number;
    data: string;
    created_by?: string | null;
  }): void {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO version_history (id, project_id, entity_type, entity_id, version, data, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `);
    stmt.run(
      p.id,
      p.project_id,
      p.entity_type,
      p.entity_id,
      p.version,
      p.data,
      p.created_by ?? null,
    );
  }

  /** List version history for an entity (requires migration 010). */
  listVersions(
    entity_type: string,
    entity_id: string,
    limit?: number,
  ): {
    id: string;
    version: number;
    data: string;
    created_at: string;
    created_by: string | null;
  }[] {
    if (!this.db) throw new Error("Database not initialized");
    try {
      const sql = limit
        ? "SELECT id, version, data, created_at, created_by FROM version_history WHERE entity_type = ? AND entity_id = ? ORDER BY version DESC LIMIT ?"
        : "SELECT id, version, data, created_at, created_by FROM version_history WHERE entity_type = ? AND entity_id = ? ORDER BY version DESC";
      const stmt = this.db.prepare(sql);
      const args = limit
        ? [entity_type, entity_id, limit]
        : [entity_type, entity_id];
      return stmt.all(...args) as {
        id: string;
        version: number;
        data: string;
        created_at: string;
        created_by: string | null;
      }[];
    } catch {
      return [];
    }
  }

  /** Get next version number for entity (requires migration 010). */
  getNextVersionNumber(entity_type: string, entity_id: string): number {
    if (!this.db) throw new Error("Database not initialized");
    try {
      const stmt = this.getStatement(
        "SELECT COALESCE(MAX(version), 0) + 1 AS next FROM version_history WHERE entity_type = ? AND entity_id = ?",
      );
      const row = stmt.get(entity_type, entity_id) as
        | { next: number }
        | undefined;
      return row?.next ?? 1;
    } catch {
      return 1;
    }
  }

  /**
   * Transaction support
   */
  transaction<T>(fn: (db: DatabaseType.Database) => T): T {
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction(fn);
    return transaction(this.db);
  }

  // ========== Integrations Platform ==========

  /** Save an audit log entry */
  async saveAuditLog(record: AuditLogRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO audit_logs (id, user_id, actor, action, category, target, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.actor ?? null,
      record.action,
      record.category,
      record.target ?? null,
      record.metadata ? JSON.stringify(record.metadata) : null,
      record.created_at,
    );
  }

  /** Get audit logs with filters */
  async getAuditLogs(
    options: {
      userId?: string;
      category?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<AuditLogRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    let sql = "SELECT * FROM audit_logs WHERE 1=1";
    const params: (string | number)[] = [];
    if (options.userId) {
      sql += " AND user_id = ?";
      params.push(options.userId);
    }
    if (options.category) {
      sql += " AND category = ?";
      params.push(options.category);
    }
    sql += " ORDER BY created_at DESC";
    if (options.limit) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }
    if (options.offset) {
      sql += " OFFSET ?";
      params.push(options.offset);
    }
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as AuditLogRecord[];
  }

  /** Save an integration */
  async saveIntegration(record: IntegrationRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO integrations (id, user_id, provider, status, display_name, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        display_name = excluded.display_name,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.provider,
      record.status,
      record.display_name ?? null,
      record.metadata ?? null,
      record.created_at,
      record.updated_at,
    );
  }

  /** Get integration by ID */
  async getIntegration(id: string): Promise<IntegrationRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("SELECT * FROM integrations WHERE id = ?");
    return (stmt.get(id) as IntegrationRecord | undefined) ?? null;
  }

  /** Get integrations for user */
  async getIntegrationsForUser(userId: string): Promise<IntegrationRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM integrations WHERE user_id = ? ORDER BY created_at DESC",
    );
    return stmt.all(userId) as IntegrationRecord[];
  }

  /** Get integration by user and provider */
  async getIntegrationByProvider(
    userId: string,
    provider: IntegrationProviderId,
  ): Promise<IntegrationRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM integrations WHERE user_id = ? AND provider = ?",
    );
    return (
      (stmt.get(userId, provider) as IntegrationRecord | undefined) ?? null
    );
  }

  /** Delete integration */
  async deleteIntegration(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("DELETE FROM integrations WHERE id = ?");
    stmt.run(id);
  }

  /** Save OAuth token */
  async saveOAuthToken(record: OAuthTokenRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO oauth_tokens (id, user_id, provider, access_token_enc, refresh_token_enc, token_type, scope, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        access_token_enc = excluded.access_token_enc,
        refresh_token_enc = excluded.refresh_token_enc,
        token_type = excluded.token_type,
        scope = excluded.scope,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.provider,
      record.access_token_enc,
      record.refresh_token_enc ?? null,
      record.token_type ?? null,
      record.scope ?? null,
      record.expires_at ?? null,
      record.created_at,
      record.updated_at,
    );
  }

  /** Get OAuth token by user and provider */
  async getOAuthToken(
    userId: string,
    provider: IntegrationProviderId,
  ): Promise<OAuthTokenRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM oauth_tokens WHERE user_id = ? AND provider = ?",
    );
    return (stmt.get(userId, provider) as OAuthTokenRecord | undefined) ?? null;
  }

  /** Delete OAuth token */
  async deleteOAuthToken(
    userId: string,
    provider: IntegrationProviderId,
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?",
    );
    stmt.run(userId, provider);
  }

  /** Save integration secret */
  async saveIntegrationSecret(record: IntegrationSecretRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO integration_secrets (id, user_id, provider, name, secret_enc, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider, name) DO UPDATE SET
        secret_enc = excluded.secret_enc,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.provider,
      record.name,
      record.secret_enc,
      record.created_at,
      record.updated_at,
    );
  }

  /** Get integration secret */
  async getIntegrationSecret(
    userId: string,
    provider: IntegrationProviderId,
    name: string,
  ): Promise<IntegrationSecretRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM integration_secrets WHERE user_id = ? AND provider = ? AND name = ?",
    );
    return (
      (stmt.get(userId, provider, name) as
        | IntegrationSecretRecord
        | undefined) ?? null
    );
  }

  /** Delete integration secret */
  async deleteIntegrationSecret(
    userId: string,
    provider: IntegrationProviderId,
    name: string,
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "DELETE FROM integration_secrets WHERE user_id = ? AND provider = ? AND name = ?",
    );
    stmt.run(userId, provider, name);
  }

  /** Save heartbeat */
  async saveHeartbeat(record: HeartbeatRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO heartbeats (id, user_id, name, cron_expression, enabled, payload, last_run_at, next_run_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        cron_expression = excluded.cron_expression,
        enabled = excluded.enabled,
        payload = excluded.payload,
        last_run_at = excluded.last_run_at,
        next_run_at = excluded.next_run_at,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.name,
      record.cron_expression,
      record.enabled ? 1 : 0,
      record.payload ?? null,
      record.last_run_at ?? null,
      record.next_run_at ?? null,
      record.created_at,
      record.updated_at,
    );
  }

  /** Get heartbeat by ID */
  async getHeartbeat(id: string): Promise<HeartbeatRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("SELECT * FROM heartbeats WHERE id = ?");
    const row = stmt.get(id) as HeartbeatRecord | undefined;
    if (!row) return null;
    return { ...row, enabled: Boolean(row.enabled) };
  }

  /** Get enabled heartbeats */
  async getEnabledHeartbeats(): Promise<HeartbeatRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM heartbeats WHERE enabled = 1 ORDER BY next_run_at ASC",
    );
    const rows = stmt.all() as HeartbeatRecord[];
    return rows.map((r) => ({ ...r, enabled: Boolean(r.enabled) }));
  }

  /** Get heartbeats for user */
  async getHeartbeatsForUser(userId: string): Promise<HeartbeatRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM heartbeats WHERE user_id = ? ORDER BY created_at DESC",
    );
    const rows = stmt.all(userId) as HeartbeatRecord[];
    return rows.map((r) => ({ ...r, enabled: Boolean(r.enabled) }));
  }

  /** Delete heartbeat */
  async deleteHeartbeat(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("DELETE FROM heartbeats WHERE id = ?");
    stmt.run(id);
  }

  /** Save approval request */
  async saveApprovalRequest(record: ApprovalRequestRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO approval_requests (id, user_id, status, action, risk_level, reason, payload, expires_at, created_at, resolved_at, resolved_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        resolved_at = excluded.resolved_at,
        resolved_by = excluded.resolved_by
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.status,
      record.action,
      record.risk_level,
      record.reason ?? null,
      record.payload ?? null,
      record.expires_at ?? null,
      record.created_at,
      record.resolved_at ?? null,
      record.resolved_by ?? null,
    );
  }

  /** Get approval request by ID */
  async getApprovalRequest(id: string): Promise<ApprovalRequestRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM approval_requests WHERE id = ?",
    );
    return (stmt.get(id) as ApprovalRequestRecord | undefined) ?? null;
  }

  /** Get pending approvals for user */
  async getPendingApprovals(userId: string): Promise<ApprovalRequestRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM approval_requests WHERE user_id = ? AND status = ? ORDER BY created_at DESC",
    );
    return stmt.all(userId, "pending") as ApprovalRequestRecord[];
  }

  /** Save swarm agent */
  async saveSwarmAgent(record: SwarmAgentRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO agent_swarm (id, user_id, parent_id, name, status, agent_type, task_description, result, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        result = excluded.result,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.parent_id ?? null,
      record.name,
      record.status,
      record.agent_type,
      record.task_description ?? null,
      record.result ?? null,
      record.created_at,
      record.updated_at,
      record.completed_at ?? null,
    );
  }

  /** Get swarm agent by ID */
  async getSwarmAgent(id: string): Promise<SwarmAgentRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("SELECT * FROM agent_swarm WHERE id = ?");
    return (stmt.get(id) as SwarmAgentRecord | undefined) ?? null;
  }

  /** Get swarm agents for parent */
  async getSwarmChildren(parentId: string): Promise<SwarmAgentRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM agent_swarm WHERE parent_id = ? ORDER BY created_at ASC",
    );
    return stmt.all(parentId) as SwarmAgentRecord[];
  }

  /** Get running swarm agents */
  async getRunningSwarmAgents(): Promise<SwarmAgentRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM agent_swarm WHERE status = ? ORDER BY created_at ASC",
    );
    return stmt.all("running") as SwarmAgentRecord[];
  }

  /** Save skill */
  async saveSkill(record: SkillRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO skills (id, user_id, name, description, language, source_code, compiled_code, status, version, approval_request_id, created_at, updated_at, approved_at, approved_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        description = excluded.description,
        source_code = excluded.source_code,
        compiled_code = excluded.compiled_code,
        status = excluded.status,
        version = excluded.version,
        updated_at = excluded.updated_at,
        approved_at = excluded.approved_at,
        approved_by = excluded.approved_by
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.name,
      record.description ?? null,
      record.language,
      record.source_code,
      record.compiled_code ?? null,
      record.status,
      record.version,
      record.approval_request_id ?? null,
      record.created_at,
      record.updated_at,
      record.approved_at ?? null,
      record.approved_by ?? null,
    );
  }

  /** Get skill by ID */
  async getSkill(id: string): Promise<SkillRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("SELECT * FROM skills WHERE id = ?");
    return (stmt.get(id) as SkillRecord | undefined) ?? null;
  }

  /** Get skill by name */
  async getSkillByName(name: string): Promise<SkillRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("SELECT * FROM skills WHERE name = ?");
    return (stmt.get(name) as SkillRecord | undefined) ?? null;
  }

  /** Get active skills */
  async getActiveSkills(): Promise<SkillRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM skills WHERE status = ? ORDER BY name ASC",
    );
    return stmt.all("active") as SkillRecord[];
  }

  /** Save memory record */
  async saveMemoryRecord(record: MemoryRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO memory_records (id, user_id, type, content, embedding, importance, access_count, last_accessed_at, expires_at, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        embedding = excluded.embedding,
        importance = excluded.importance,
        access_count = excluded.access_count,
        last_accessed_at = excluded.last_accessed_at,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.type,
      record.content,
      record.embedding ?? null,
      record.importance,
      record.access_count,
      record.last_accessed_at ?? null,
      record.expires_at ?? null,
      record.metadata ?? null,
      record.created_at,
      record.updated_at,
    );
  }

  /** Get memory record by ID */
  async getMemoryRecord(id: string): Promise<MemoryRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("SELECT * FROM memory_records WHERE id = ?");
    return (stmt.get(id) as MemoryRecord | undefined) ?? null;
  }

  /** Search memory records by type */
  async getMemoryRecordsByType(
    userId: string,
    type: string,
    limit = 50,
  ): Promise<MemoryRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM memory_records WHERE user_id = ? AND type = ? ORDER BY importance DESC, last_accessed_at DESC LIMIT ?",
    );
    return stmt.all(userId, type, limit) as MemoryRecord[];
  }

  /** Get recent memories */
  async getRecentMemories(userId: string, limit = 20): Promise<MemoryRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM memory_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    );
    return stmt.all(userId, limit) as MemoryRecord[];
  }

  /** Delete memory record */
  async deleteMemoryRecord(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement("DELETE FROM memory_records WHERE id = ?");
    stmt.run(id);
  }

  /** Save cost budget */
  async saveCostBudget(record: CostBudgetRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO cost_budgets (id, user_id, period, limit_cents, spent_cents, period_start, period_end, notify_at_percent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        limit_cents = excluded.limit_cents,
        spent_cents = excluded.spent_cents,
        period_start = excluded.period_start,
        period_end = excluded.period_end,
        notify_at_percent = excluded.notify_at_percent,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.period,
      record.limit_cents,
      record.spent_cents,
      record.period_start,
      record.period_end,
      record.notify_at_percent,
      record.created_at,
      record.updated_at,
    );
  }

  /** Get current budget for user */
  async getCurrentBudget(userId: string): Promise<CostBudgetRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const now = new Date().toISOString();
    const stmt = this.getStatement(
      "SELECT * FROM cost_budgets WHERE user_id = ? AND period_start <= ? AND period_end >= ?",
    );
    return (stmt.get(userId, now, now) as CostBudgetRecord | undefined) ?? null;
  }

  /** Save rate limit */
  async saveRateLimit(record: RateLimitRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO rate_limits (id, user_id, resource, max_requests, window_seconds, current_count, window_start, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, resource) DO UPDATE SET
        max_requests = excluded.max_requests,
        window_seconds = excluded.window_seconds,
        current_count = excluded.current_count,
        window_start = excluded.window_start
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.resource,
      record.max_requests,
      record.window_seconds,
      record.current_count,
      record.window_start,
      record.created_at,
    );
  }

  /** Get rate limit */
  async getRateLimit(
    userId: string,
    resource: string,
  ): Promise<RateLimitRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM rate_limits WHERE user_id = ? AND resource = ?",
    );
    return (stmt.get(userId, resource) as RateLimitRecord | undefined) ?? null;
  }

  /** Increment rate limit counter */
  async incrementRateLimit(
    userId: string,
    resource: string,
  ): Promise<{ allowed: boolean; remaining: number }> {
    if (!this.db) throw new Error("Database not initialized");
    const limit = await this.getRateLimit(userId, resource);
    if (!limit) return { allowed: true, remaining: 999 };

    const now = new Date();
    const windowStart = new Date(limit.window_start);
    const windowEnd = new Date(
      windowStart.getTime() + limit.window_seconds * 1000,
    );

    if (now > windowEnd) {
      // Reset window
      const stmt = this.getStatement(
        "UPDATE rate_limits SET current_count = 1, window_start = ? WHERE user_id = ? AND resource = ?",
      );
      stmt.run(now.toISOString(), userId, resource);
      return { allowed: true, remaining: limit.max_requests - 1 };
    }

    if (limit.current_count >= limit.max_requests) {
      return { allowed: false, remaining: 0 };
    }

    const stmt = this.getStatement(
      "UPDATE rate_limits SET current_count = current_count + 1 WHERE user_id = ? AND resource = ?",
    );
    stmt.run(userId, resource);
    return {
      allowed: true,
      remaining: limit.max_requests - limit.current_count - 1,
    };
  }

  /** Save browser allowlist entry */
  async saveBrowserAllowlist(record: BrowserAllowlistRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO browser_allowlist (id, user_id, domain, allowed_actions, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, domain) DO UPDATE SET
        allowed_actions = excluded.allowed_actions
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.domain,
      record.allowed_actions,
      record.created_at,
    );
  }

  /** Get browser allowlist for user */
  async getBrowserAllowlist(userId: string): Promise<BrowserAllowlistRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM browser_allowlist WHERE user_id = ? ORDER BY domain ASC",
    );
    return stmt.all(userId) as BrowserAllowlistRecord[];
  }

  /** Check if domain is allowed */
  async isDomainAllowed(
    userId: string,
    domain: string,
  ): Promise<BrowserAllowlistRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM browser_allowlist WHERE user_id = ? AND domain = ?",
    );
    return (
      (stmt.get(userId, domain) as BrowserAllowlistRecord | undefined) ?? null
    );
  }

  /** Delete browser allowlist entry */
  async deleteBrowserAllowlist(userId: string, domain: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "DELETE FROM browser_allowlist WHERE user_id = ? AND domain = ?",
    );
    stmt.run(userId, domain);
  }

  // ========== Slack Tokens ==========

  /** Save or update Slack token */
  async saveSlackToken(record: SlackTokenRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO slack_tokens (id, user_id, workspace_id, workspace_name, access_token_enc, bot_user_id, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, workspace_id) DO UPDATE SET
        workspace_name = excluded.workspace_name,
        access_token_enc = excluded.access_token_enc,
        bot_user_id = excluded.bot_user_id,
        scope = excluded.scope,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.workspace_id,
      record.workspace_name ?? null,
      record.access_token_enc,
      record.bot_user_id ?? null,
      record.scope ?? null,
      record.created_at,
      record.updated_at,
    );
  }

  /** Get Slack token by user and workspace */
  async getSlackToken(
    userId: string,
    workspaceId: string,
  ): Promise<SlackTokenRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM slack_tokens WHERE user_id = ? AND workspace_id = ?",
    );
    return (
      (stmt.get(userId, workspaceId) as SlackTokenRecord | undefined) ?? null
    );
  }

  /** Get any Slack token for a workspace (for replying to messages from any user in the workspace) */
  async getSlackTokenByWorkspace(
    workspaceId: string,
  ): Promise<SlackTokenRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM slack_tokens WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 1",
    );
    return (stmt.get(workspaceId) as SlackTokenRecord | undefined) ?? null;
  }

  /** Get all Slack tokens for a user */
  async getSlackTokensForUser(userId: string): Promise<SlackTokenRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM slack_tokens WHERE user_id = ? ORDER BY created_at DESC",
    );
    return stmt.all(userId) as SlackTokenRecord[];
  }

  /** Delete Slack token */
  async deleteSlackToken(userId: string, workspaceId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "DELETE FROM slack_tokens WHERE user_id = ? AND workspace_id = ?",
    );
    stmt.run(userId, workspaceId);
  }

  // ========== Conversation Memories ==========

  /** Get or create conversation memory */
  async getConversationMemory(
    platform: string,
    platformUserId: string,
  ): Promise<ConversationMemoryRecord | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM conversation_memories WHERE platform = ? AND platform_user_id = ?",
    );
    return (
      (stmt.get(platform, platformUserId) as
        | ConversationMemoryRecord
        | undefined) ?? null
    );
  }

  /** Save conversation memory */
  async saveConversationMemory(
    record: ConversationMemoryRecord,
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO conversation_memories (id, platform, platform_user_id, user_id, messages, summary, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, platform_user_id) DO UPDATE SET
        user_id = excluded.user_id,
        messages = excluded.messages,
        summary = excluded.summary,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.platform,
      record.platform_user_id,
      record.user_id ?? null,
      record.messages,
      record.summary ?? null,
      record.updated_at,
      record.created_at,
    );
  }

  // ========== Messaging Subscriptions ==========

  /** Get messaging subscriptions for a user */
  async getMessagingSubscriptions(
    userId: string,
  ): Promise<MessagingSubscriptionRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM messaging_subscriptions WHERE user_id = ? ORDER BY created_at DESC",
    );
    return stmt.all(userId) as MessagingSubscriptionRecord[];
  }

  /** Save messaging subscription */
  async saveMessagingSubscription(
    record: MessagingSubscriptionRecord,
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO messaging_subscriptions (id, user_id, platform, platform_user_id, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, platform, platform_user_id) DO NOTHING
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.platform,
      record.platform_user_id,
      record.created_at,
    );
  }

  /** Delete messaging subscription */
  async deleteMessagingSubscription(
    userId: string,
    platform: string,
    platformUserId: string,
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "DELETE FROM messaging_subscriptions WHERE user_id = ? AND platform = ? AND platform_user_id = ?",
    );
    stmt.run(userId, platform, platformUserId);
  }

  // ========== Slack User Pairings ==========

  /** Save Slack user pairing */
  async saveSlackUserPairing(record: SlackUserPairingRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO slack_user_pairings (slack_user_id, workspace_id, grump_user_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slack_user_id, workspace_id) DO UPDATE SET
        grump_user_id = excluded.grump_user_id,
        created_at = excluded.created_at
    `);
    stmt.run(
      record.slack_user_id,
      record.workspace_id,
      record.grump_user_id,
      record.created_at,
    );
  }

  /** Get G-Rump user ID from Slack user and workspace */
  async getGrumpUserIdFromSlack(
    slackUserId: string,
    workspaceId: string,
  ): Promise<string | null> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT grump_user_id FROM slack_user_pairings WHERE slack_user_id = ? AND workspace_id = ?",
    );
    const row = stmt.get(slackUserId, workspaceId) as
      | { grump_user_id: string }
      | undefined;
    return row?.grump_user_id ?? null;
  }

  // ========== Reminders ==========

  async saveReminder(record: ReminderRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(`
      INSERT INTO reminders (id, user_id, content, due_at, platform, platform_user_id, notified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        due_at = excluded.due_at,
        notified = excluded.notified,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      record.id,
      record.user_id,
      record.content,
      record.due_at,
      record.platform ?? null,
      record.platform_user_id ?? null,
      record.notified ?? 0,
      record.created_at,
      record.updated_at,
    );
  }

  async getDueReminders(before: string): Promise<ReminderRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM reminders WHERE due_at <= ? AND notified = 0 ORDER BY due_at ASC",
    );
    const rows = stmt.all(before) as ReminderRecord[];
    return rows.map((r) => ({ ...r, notified: r.notified ?? 0 }));
  }

  async getRemindersForUser(userId: string): Promise<ReminderRecord[]> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "SELECT * FROM reminders WHERE user_id = ? ORDER BY due_at ASC",
    );
    const rows = stmt.all(userId) as ReminderRecord[];
    return rows.map((r) => ({ ...r, notified: r.notified ?? 0 }));
  }

  async setReminderNotified(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.getStatement(
      "UPDATE reminders SET notified = 1, updated_at = ? WHERE id = ?",
    );
    stmt.run(new Date().toISOString(), id);
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null;
let supabaseDbInstance: SupabaseDatabaseService | null = null;

// Common interface for both database types
type DatabaseInterface = DatabaseService | SupabaseDatabaseService;

/**
 * Check if Supabase should be used
 */
function shouldUseSupabase(): boolean {
  const dbType = process.env.DB_TYPE;
  if (dbType === "supabase") return true;

  // Auto-detect: use Supabase in production if configured
  const isProduction = process.env.NODE_ENV === "production";
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasSupabaseConfig =
    process.env.SUPABASE_URL &&
    serviceKey &&
    process.env.SUPABASE_URL !== "https://your-project.supabase.co";

  return Boolean(isProduction && hasSupabaseConfig);
}

/**
 * Get or create database service instance
 */
export function getDatabase(): DatabaseInterface {
  if (shouldUseSupabase()) {
    if (!supabaseDbInstance) {
      const url = process.env.SUPABASE_URL;
      const key =
        process.env.SUPABASE_SERVICE_KEY ??
        process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key)
        throw new Error(
          "SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required when using Supabase",
        );
      supabaseDbInstance = new SupabaseDatabaseService(url, key);
    }
    return supabaseDbInstance;
  }

  if (!dbInstance) {
    const dbType = (process.env.DB_TYPE || "sqlite") as DbType;
    const dbPath = process.env.DB_PATH || "./data/grump.db";

    dbInstance = new DatabaseService({
      type: dbType,
      sqlite: {
        path: dbPath,
      },
    });
  }
  return dbInstance;
}

/**
 * Initialize database (call on app startup)
 */
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  await db.initialize();
}

/**
 * Close database (call on app shutdown)
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
  if (supabaseDbInstance) {
    await supabaseDbInstance.close();
    supabaseDbInstance = null;
  }
}

export { DatabaseService };
export { SupabaseDatabaseService } from "./supabase-db.js";

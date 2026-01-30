/**
 * Database Service Layer
 * Provides database abstraction with SQLite (desktop) and PostgreSQL (scale) support
 * 
 * Optimizations:
 * - Prepared statement caching (statements compiled once, reused)
 * - Query result caching for frequently accessed data
 * - WAL mode for better concurrency
 */

import fs from 'fs';
import path from 'path';
// NOTE: better-sqlite3 is dynamically imported only when DB_TYPE=sqlite
// This avoids loading native modules in serverless environments
import type DatabaseType from 'better-sqlite3';
import { SupabaseDatabaseService } from './supabase-db.js';
import { type SessionRow, type PlanRow, type SpecRow, type ShipSessionRow, type WorkReportRow } from './schema.js';
import logger from '../middleware/logger.js';
import { recordDbOperation } from '../middleware/metrics.js';
import type { GenerationSession } from '../types/agents.js';
import type { ShipSession } from '../types/ship.js';
import type { Plan } from '../types/plan.js';
import type { SpecSession } from '../types/spec.js';
import type { AgentWorkReport } from '../types/agents.js';
import type { Settings } from '../types/settings.js';

type DbType = 'sqlite' | 'postgresql' | 'supabase';

// Query result cache entry
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Cache TTL configuration (in milliseconds)
const CACHE_TTL = {
  settings: 5 * 60 * 1000,      // 5 minutes for settings
  session: 30 * 1000,           // 30 seconds for sessions
  usage: 60 * 1000,             // 1 minute for usage stats
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
    if (!this.db) throw new Error('Database not initialized');
    
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
    fetchFn: () => T
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
    resultCache: { hits: number; misses: number; hitRate: number; size: number };
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
    logger.debug('Database result cache cleared');
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      if (this.config.type === 'sqlite') {
        // Dynamic import to avoid loading native module in serverless
        const Database = (await import('better-sqlite3')).default;
        const { runMigrations } = await import('./migrate.js');
        const dbPath = this.config.sqlite?.path || './data/grump.db';
        const dir = path.dirname(path.resolve(dbPath));
        fs.mkdirSync(dir, { recursive: true });
        this.db = new Database(dbPath);
        
        // Performance pragmas
        this.db.pragma('journal_mode = WAL');           // Better concurrency
        this.db.pragma('synchronous = NORMAL');         // Balance safety/speed
        this.db.pragma('cache_size = -64000');          // 64MB cache
        this.db.pragma('temp_store = MEMORY');          // Temp tables in memory
        this.db.pragma('mmap_size = 268435456');        // 256MB memory-mapped I/O
        this.db.pragma('foreign_keys = ON');            // Enable foreign keys
        this.db.pragma('busy_timeout = 5000');          // 5s timeout for locks
        
        // Verify WAL mode
        const journalMode = this.db.pragma('journal_mode');
        logger.debug({ journalMode }, 'SQLite journal mode');

        runMigrations(this.db);
        logger.info({ 
          path: dbPath,
          pragmas: {
            journalMode: 'WAL',
            cacheSize: '64MB',
            mmapSize: '256MB',
          }
        }, 'SQLite database initialized with optimizations');
      } else if (this.config.type === 'postgresql') {
        // PostgreSQL would use pg library
        // For now, we'll implement SQLite as primary
        throw new Error('PostgreSQL support not yet implemented');
      }

      this.initialized = true;
      logger.info({ type: this.config.type }, 'Database service initialized');
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Database initialization failed');
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
      logger.info({
        cacheStats: this.getCacheStats(),
      }, 'Database connection closed');
    }
  }

  /**
   * Get database instance (for raw queries if needed)
   */
  getDb(): DatabaseType.Database {
    if (!this.db || !this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  // ========== Sessions ==========

  /**
   * Save or update a generation session
   */
  async saveSession(session: GenerationSession): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const start = process.hrtime.bigint();
    try {
      const stmt = this.db.prepare(`
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
        'generation',
        session.status,
        JSON.stringify(session),
        session.createdAt,
        new Date().toISOString(),
        session.startedAt || null,
        session.completedAt || null,
        session.projectId ?? null
      );

      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation('saveSession', 'sessions', duration, 'success');
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation('saveSession', 'sessions', duration, 'error');
      throw error;
    }
  }

  /**
   * Get a generation session by ID
   */
  async getSession(sessionId: string): Promise<GenerationSession | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ? AND type = ?');
    const row = stmt.get(sessionId, 'generation') as SessionRow | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.data) as GenerationSession;
  }

  /**
   * List sessions with optional filters
   */
  async listSessions(options: {
    type?: 'generation' | 'ship' | 'spec' | 'plan';
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<GenerationSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM sessions WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as SessionRow[];

    return rows.map(row => JSON.parse(row.data) as GenerationSession);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(sessionId);
  }

  // ========== Ship Sessions ==========

  /**
   * Save or update a ship session
   */
  async saveShipSession(session: ShipSession): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
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
      session.projectId ?? null
    );
  }

  /**
   * Get a ship session by ID
   */
  async getShipSession(sessionId: string): Promise<ShipSession | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM ship_sessions WHERE id = ?');
    const row = stmt.get(sessionId) as ShipSessionRow | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.data) as ShipSession;
  }

  /**
   * List ship sessions
   */
  async listShipSessions(options: {
    phase?: string;
    status?: string;
    projectId?: string;
    limit?: number;
  } = {}): Promise<ShipSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM ship_sessions WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.phase) {
      query += ' AND phase = ?';
      params.push(options.phase);
    }

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    if (options.projectId != null) {
      query += ' AND project_id = ?';
      params.push(options.projectId);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as ShipSessionRow[];

    return rows.map(row => JSON.parse(row.data) as ShipSession);
  }

  // ========== Plans ==========

  /**
   * Save or update a plan
   */
  async savePlan(plan: Plan): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
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
      plan.completedAt || null
    );
  }

  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<Plan | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM plans WHERE id = ?');
    const row = stmt.get(planId) as PlanRow | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.data) as Plan;
  }

  /**
   * List plans
   */
  async listPlans(options: {
    status?: string;
    limit?: number;
  } = {}): Promise<Plan[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM plans WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.status) {
      query += ' AND json_extract(data, "$.status") = ?';
      params.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as PlanRow[];

    return rows.map(row => JSON.parse(row.data) as Plan);
  }

  // ========== Specs ==========

  /**
   * Save or update a spec session
   */
  async saveSpec(spec: SpecSession): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
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
      spec.completedAt || null
    );
  }

  /**
   * Get a spec by ID
   */
  async getSpec(specId: string): Promise<SpecSession | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM specs WHERE id = ?');
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
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
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
      report.generatedAt
    );
  }

  /**
   * Get work reports for a session
   */
  async getWorkReports(sessionId: string): Promise<AgentWorkReport[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM work_reports WHERE session_id = ? ORDER BY created_at');
    const rows = stmt.all(sessionId) as WorkReportRow[];

    return rows.map(row => JSON.parse(row.report) as AgentWorkReport);
  }

  // ========== Settings ==========

  /**
   * Get settings by user key (e.g. userId or 'default')
   * Uses result caching for frequently accessed settings
   */
  async getSettings(userKey: string): Promise<Settings | null> {
    if (!this.db) throw new Error('Database not initialized');

    const cacheKey = `settings:${userKey}`;
    
    return this.getCachedOrFetch<Settings | null>(
      cacheKey,
      CACHE_TTL.settings,
      () => {
        const stmt = this.getStatement('SELECT data FROM settings WHERE id = ?');
        const row = stmt.get(userKey) as { data: string } | undefined;
        if (!row) return null;
        return JSON.parse(row.data) as Settings;
      }
    );
  }

  /**
   * Save or update settings for a user key
   */
  async saveSettings(userKey: string, data: Settings): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

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
    success: boolean;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const start = process.hrtime.bigint();
    try {
      const stmt = this.db.prepare(`
        INSERT INTO usage_records
        (id, user_id, endpoint, method, model, input_tokens, output_tokens, latency_ms, success, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        record.success ? 1 : 0
      );

      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation('saveUsageRecord', 'usage_records', duration, 'success');
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation('saveUsageRecord', 'usage_records', duration, 'error');
      throw error;
    }
  }

  /**
   * Get usage records for a user within a date range
   */
  async getUsageForUser(
    userId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<UsageRecordRow[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM usage_records
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `);

    return stmt.all(userId, fromDate.toISOString(), toDate.toISOString()) as UsageRecordRow[];
  }

  /**
   * Get monthly token usage for a user
   */
  async getMonthlyTokenUsage(userId: string): Promise<{ input: number; output: number }> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stmt = this.db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as input,
        COALESCE(SUM(output_tokens), 0) as output
      FROM usage_records
      WHERE user_id = ? AND created_at >= ?
    `);

    const result = stmt.get(userId, startOfMonth.toISOString()) as { input?: number; output?: number } | undefined;
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
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const cacheKey = `usage:summary:${userId}:${startOfMonth.toISOString().slice(0, 7)}`;

    return this.getCachedOrFetch(
      cacheKey,
      CACHE_TTL.usage,
      () => {
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

        const result = stmt.get(userId, startOfMonth.toISOString()) as {
          total?: number; successful?: number; failed?: number;
          input_tokens?: number; output_tokens?: number; avg_latency?: number;
        } | undefined;
        
        return {
          totalRequests: result?.total ?? 0,
          successfulRequests: result?.successful ?? 0,
          failedRequests: result?.failed ?? 0,
          monthlyInputTokens: result?.input_tokens ?? 0,
          monthlyOutputTokens: result?.output_tokens ?? 0,
          avgLatencyMs: result?.avg_latency ?? 0,
        };
      }
    );
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
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT INTO comments (id, project_id, entity_type, entity_id, user_id, parent_id, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(p.id, p.project_id, p.entity_type, p.entity_id, p.user_id, p.parent_id ?? null, p.body);
  }

  /** List comments for an entity (requires migration 010). */
  listComments(entity_type: string, entity_id: string): { id: string; project_id: string; entity_type: string; entity_id: string; user_id: string; parent_id: string | null; body: string; created_at: string; updated_at: string }[] {
    if (!this.db) throw new Error('Database not initialized');
    try {
      const stmt = this.db.prepare('SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at');
      return stmt.all(entity_type, entity_id) as { id: string; project_id: string; entity_type: string; entity_id: string; user_id: string; parent_id: string | null; body: string; created_at: string; updated_at: string }[];
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
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(`
      INSERT INTO version_history (id, project_id, entity_type, entity_id, version, data, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `);
    stmt.run(p.id, p.project_id, p.entity_type, p.entity_id, p.version, p.data, p.created_by ?? null);
  }

  /** List version history for an entity (requires migration 010). */
  listVersions(entity_type: string, entity_id: string, limit?: number): { id: string; version: number; data: string; created_at: string; created_by: string | null }[] {
    if (!this.db) throw new Error('Database not initialized');
    try {
      const sql = limit
        ? 'SELECT id, version, data, created_at, created_by FROM version_history WHERE entity_type = ? AND entity_id = ? ORDER BY version DESC LIMIT ?'
        : 'SELECT id, version, data, created_at, created_by FROM version_history WHERE entity_type = ? AND entity_id = ? ORDER BY version DESC';
      const stmt = this.db.prepare(sql);
      const args = limit ? [entity_type, entity_id, limit] : [entity_type, entity_id];
      return stmt.all(...args) as { id: string; version: number; data: string; created_at: string; created_by: string | null }[];
    } catch {
      return [];
    }
  }

  /** Get next version number for entity (requires migration 010). */
  getNextVersionNumber(entity_type: string, entity_id: string): number {
    if (!this.db) throw new Error('Database not initialized');
    try {
      const stmt = this.db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM version_history WHERE entity_type = ? AND entity_id = ?');
      const row = stmt.get(entity_type, entity_id) as { next: number } | undefined;
      return row?.next ?? 1;
    } catch {
      return 1;
    }
  }

  /**
   * Transaction support
   */
  transaction<T>(fn: (db: DatabaseType.Database) => T): T {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(fn);
    return transaction(this.db);
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
  if (dbType === 'supabase') return true;

  // Auto-detect: use Supabase in production if configured
  const isProduction = process.env.NODE_ENV === 'production';
  const hasSupabaseConfig =
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_KEY &&
    process.env.SUPABASE_URL !== 'https://your-project.supabase.co';

  return Boolean(isProduction && hasSupabaseConfig);
}

/**
 * Get or create database service instance
 */
export function getDatabase(): DatabaseInterface {
  if (shouldUseSupabase()) {
    if (!supabaseDbInstance) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY;
      if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required when using Supabase');
      supabaseDbInstance = new SupabaseDatabaseService(url, key);
    }
    return supabaseDbInstance;
  }

  if (!dbInstance) {
    const dbType = (process.env.DB_TYPE || 'sqlite') as DbType;
    const dbPath = process.env.DB_PATH || './data/grump.db';

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
export { SupabaseDatabaseService } from './supabase-db.js';


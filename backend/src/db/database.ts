/**
 * Database Service Layer
 * Provides database abstraction with SQLite (desktop) and PostgreSQL (scale) support
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate.js';
import { SupabaseDatabaseService } from './supabase-db.js';
import { SCHEMA_POSTGRESQL, type SessionRow, type PlanRow, type SpecRow, type ShipSessionRow, type WorkReportRow } from './schema.js';
import logger from '../middleware/logger.js';
import { recordDbOperation } from '../middleware/metrics.js';
import type { GenerationSession } from '../types/agents.js';
import type { ShipSession } from '../types/ship.js';
import type { Plan } from '../types/plan.js';
import type { SpecSession } from '../types/spec.js';
import type { AgentWorkReport } from '../types/agents.js';
import type { Settings } from '../types/settings.js';

type DbType = 'sqlite' | 'postgresql' | 'supabase';

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

class DatabaseService {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private initialized = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
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
        const dbPath = this.config.sqlite?.path || './data/grump.db';
        const dir = path.dirname(path.resolve(dbPath));
        fs.mkdirSync(dir, { recursive: true });
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL'); // Better concurrency
        this.db.pragma('foreign_keys = ON'); // Enable foreign keys

        runMigrations(this.db);
        logger.info({ path: dbPath }, 'SQLite database initialized');
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
      this.db.close();
      this.db = null;
      this.initialized = false;
      logger.info('Database connection closed');
    }
  }

  /**
   * Get database instance (for raw queries if needed)
   */
  getDb(): Database.Database {
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
    const params: any[] = [];

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
    const params: any[] = [];

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
    const params: any[] = [];

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
   */
  async getSettings(userKey: string): Promise<Settings | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT data FROM settings WHERE id = ?');
    const row = stmt.get(userKey) as { data: string } | undefined;
    if (!row) return null;

    const data = JSON.parse(row.data) as Settings;
    return data;
  }

  /**
   * Save or update settings for a user key
   */
  async saveSettings(userKey: string, data: Settings): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const updatedAt = new Date().toISOString();
    const payload = { ...data, updatedAt };
    const stmt = this.db.prepare(`
      INSERT INTO settings (id, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `);
    stmt.run(userKey, JSON.stringify(payload), updatedAt);
  }

  /**
   * Transaction support
   */
  transaction<T>(fn: (db: Database.Database) => T): T {
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

  return isProduction && hasSupabaseConfig;
}

/**
 * Get or create database service instance
 */
export function getDatabase(): DatabaseInterface {
  if (shouldUseSupabase()) {
    if (!supabaseDbInstance) {
      const { SupabaseDatabaseService } = require('./supabase-db.js');
      supabaseDbInstance = new SupabaseDatabaseService(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
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


/**
 * Database Schema
 * Defines all database tables and their structure
 */

export interface SessionRow {
  id: string;
  type: 'generation' | 'ship' | 'spec' | 'plan';
  status: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface PlanRow {
  id: string;
  session_id?: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
  started_at?: string;
  completed_at?: string;
}

export interface SpecRow {
  id: string;
  session_id?: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ShipSessionRow {
  id: string;
  phase: string;
  status: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface WorkReportRow {
  id: string;
  session_id: string;
  agent_type: string;
  report: string; // JSON string
  created_at: string;
}

/**
 * SQL schema definitions
 */
export const SCHEMA_SQL = `
-- Sessions table (for generation sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('generation', 'ship', 'spec', 'plan')),
  status TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  approved_by TEXT,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Specs table
CREATE TABLE IF NOT EXISTS specs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Ship sessions table
CREATE TABLE IF NOT EXISTS ship_sessions (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Work reports table
CREATE TABLE IF NOT EXISTS work_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  report TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id);
CREATE INDEX IF NOT EXISTS idx_specs_session_id ON specs(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_session_id ON work_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_agent_type ON work_reports(agent_type);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_phase ON ship_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_status ON ship_sessions(status);
`;

/**
 * PostgreSQL-specific schema (for production scale)
 */
export const SCHEMA_POSTGRESQL = `
-- Sessions table (for generation sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('generation', 'ship', 'spec', 'plan')),
  status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Specs table
CREATE TABLE IF NOT EXISTS specs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Ship sessions table
CREATE TABLE IF NOT EXISTS ship_sessions (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Work reports table
CREATE TABLE IF NOT EXISTS work_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id);
CREATE INDEX IF NOT EXISTS idx_specs_session_id ON specs(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_session_id ON work_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_agent_type ON work_reports(agent_type);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_phase ON ship_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_status ON ship_sessions(status);
`;

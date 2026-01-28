-- Sessions table (for generation sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('generation', 'ship', 'spec', 'plan')),
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data TEXT NOT NULL,
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
  data TEXT NOT NULL,
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
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Work reports table
CREATE TABLE IF NOT EXISTS work_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  report TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id);
CREATE INDEX IF NOT EXISTS idx_specs_session_id ON specs(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_session_id ON work_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_agent_type ON work_reports(agent_type);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_phase ON ship_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_status ON ship_sessions(status);

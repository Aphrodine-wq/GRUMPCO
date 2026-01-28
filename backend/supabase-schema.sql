-- Supabase SQL Schema for Grump Backend
-- Run this in Supabase Dashboard > SQL Editor

-- Sessions table (for generation sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('generation', 'ship', 'spec', 'plan')),
  status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  project_id TEXT
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
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  project_id TEXT
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

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id);
CREATE INDEX IF NOT EXISTS idx_specs_session_id ON specs(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_session_id ON work_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_agent_type ON work_reports(agent_type);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_phase ON ship_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_status ON ship_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_project_id ON ship_sessions(project_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend)
CREATE POLICY "Service role full access" ON sessions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON plans FOR ALL USING (true);
CREATE POLICY "Service role full access" ON specs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ship_sessions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON work_reports FOR ALL USING (true);
CREATE POLICY "Service role full access" ON settings FOR ALL USING (true);

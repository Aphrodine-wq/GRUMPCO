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

-- Usage records
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ship/codegen jobs
CREATE TABLE IF NOT EXISTS ship_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  error TEXT
);

CREATE TABLE IF NOT EXISTS codegen_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  error TEXT
);

-- Expo test jobs
CREATE TABLE IF NOT EXISTS expo_test_jobs (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  error TEXT,
  result_json JSONB
);

-- Webhook config and deliveries
CREATE TABLE IF NOT EXISTS webhook_config (
  id TEXT PRIMARY KEY,
  user_key TEXT,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  error TEXT
);

-- Intent compiler failures
CREATE TABLE IF NOT EXISTS intent_compiler_failures (
  id TEXT PRIMARY KEY,
  input_text TEXT NOT NULL,
  rust_error TEXT NOT NULL,
  claude_result_json JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scheduled agents
CREATE TABLE IF NOT EXISTS scheduled_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('ship', 'codegen', 'chat')),
  params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Event log for polling
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_usage_records_user_created ON usage_records(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_records_endpoint ON usage_records(endpoint);
CREATE INDEX IF NOT EXISTS idx_usage_records_success ON usage_records(success);
CREATE INDEX IF NOT EXISTS idx_ship_jobs_status ON ship_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ship_jobs_created_at ON ship_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_codegen_jobs_status ON codegen_jobs(status);
CREATE INDEX IF NOT EXISTS idx_codegen_jobs_created_at ON codegen_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_expo_test_jobs_status ON expo_test_jobs(status);
CREATE INDEX IF NOT EXISTS idx_expo_test_jobs_created_at ON expo_test_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_config_user_key ON webhook_config(user_key);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_intent_compiler_failures_created_at ON intent_compiler_failures(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_agents_enabled ON scheduled_agents(enabled);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE codegen_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expo_test_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_compiler_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend)
CREATE POLICY "Service role full access" ON sessions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON plans FOR ALL USING (true);
CREATE POLICY "Service role full access" ON specs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ship_sessions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON work_reports FOR ALL USING (true);
CREATE POLICY "Service role full access" ON settings FOR ALL USING (true);
CREATE POLICY "Service role full access" ON usage_records FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ship_jobs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON codegen_jobs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON expo_test_jobs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON webhook_config FOR ALL USING (true);
CREATE POLICY "Service role full access" ON webhook_deliveries FOR ALL USING (true);
CREATE POLICY "Service role full access" ON intent_compiler_failures FOR ALL USING (true);
CREATE POLICY "Service role full access" ON scheduled_agents FOR ALL USING (true);
CREATE POLICY "Service role full access" ON events FOR ALL USING (true);

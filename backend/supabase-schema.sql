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

-- ============================================================================
-- INTEGRATIONS PLATFORM (Migration 011)
-- ============================================================================

-- Integrations (provider connections)
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active', 'disabled', 'error', 'pending')),
  display_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- OAuth tokens (encrypted)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  access_token_enc JSONB NOT NULL,
  refresh_token_enc JSONB,
  token_type TEXT,
  scope TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Integration secrets (encrypted API keys, etc.)
CREATE TABLE IF NOT EXISTS integration_secrets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_enc JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider, name)
);

-- Audit logs (90-day retention)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor TEXT,
  action TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('integration', 'system', 'security', 'automation', 'billing', 'agent')),
  target TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Heartbeats (proactive cron tasks)
CREATE TABLE IF NOT EXISTS heartbeats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  payload JSONB,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Approval requests (human-in-the-loop)
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
  action TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high')),
  reason TEXT,
  payload JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT
);

-- Agent swarm instances
CREATE TABLE IF NOT EXISTS agent_swarm (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  agent_type TEXT NOT NULL,
  task_description TEXT,
  result JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Skills (self-building, require approval)
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  language TEXT NOT NULL DEFAULT 'typescript' CHECK(language IN ('typescript', 'python')),
  source_code TEXT NOT NULL,
  compiled_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'active', 'disabled', 'rejected')),
  version INTEGER NOT NULL DEFAULT 1,
  approval_request_id TEXT REFERENCES approval_requests(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by TEXT
);

-- Memory records (long-term persistent memory)
CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('conversation', 'preference', 'task', 'fact', 'context')),
  content TEXT NOT NULL,
  embedding JSONB,
  importance REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cost budgets
CREATE TABLE IF NOT EXISTS cost_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('daily', 'weekly', 'monthly')),
  limit_cents INTEGER NOT NULL,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  notify_at_percent INTEGER DEFAULT 80,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Rate limits
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL DEFAULT 60,
  current_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, resource)
);

-- Browser automation allowlist
CREATE TABLE IF NOT EXISTS browser_allowlist (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  allowed_actions TEXT NOT NULL DEFAULT 'read',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

-- Indexes for integrations platform
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_integration_secrets_user_provider ON integration_secrets(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_heartbeats_user_id ON heartbeats(user_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_enabled ON heartbeats(enabled);
CREATE INDEX IF NOT EXISTS idx_heartbeats_next_run ON heartbeats(next_run_at);

CREATE INDEX IF NOT EXISTS idx_approval_requests_user_id ON approval_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at ON approval_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_swarm_user_id ON agent_swarm(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_swarm_status ON agent_swarm(status);
CREATE INDEX IF NOT EXISTS idx_agent_swarm_parent_id ON agent_swarm(parent_id);

CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);

CREATE INDEX IF NOT EXISTS idx_memory_records_user_id ON memory_records(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_records_type ON memory_records(type);
CREATE INDEX IF NOT EXISTS idx_memory_records_importance ON memory_records(importance);
CREATE INDEX IF NOT EXISTS idx_memory_records_last_accessed ON memory_records(last_accessed_at);

CREATE INDEX IF NOT EXISTS idx_cost_budgets_user_id ON cost_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_budgets_period ON cost_budgets(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_resource ON rate_limits(user_id, resource);

CREATE INDEX IF NOT EXISTS idx_browser_allowlist_user_domain ON browser_allowlist(user_id, domain);

-- Enable RLS for integrations platform tables
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_swarm ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_allowlist ENABLE ROW LEVEL SECURITY;

-- Policies for integrations platform tables
CREATE POLICY "Service role full access" ON integrations FOR ALL USING (true);
CREATE POLICY "Service role full access" ON oauth_tokens FOR ALL USING (true);
CREATE POLICY "Service role full access" ON integration_secrets FOR ALL USING (true);
CREATE POLICY "Service role full access" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON heartbeats FOR ALL USING (true);
CREATE POLICY "Service role full access" ON approval_requests FOR ALL USING (true);
CREATE POLICY "Service role full access" ON agent_swarm FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skills FOR ALL USING (true);
CREATE POLICY "Service role full access" ON memory_records FOR ALL USING (true);
CREATE POLICY "Service role full access" ON cost_budgets FOR ALL USING (true);
CREATE POLICY "Service role full access" ON rate_limits FOR ALL USING (true);
CREATE POLICY "Service role full access" ON browser_allowlist FOR ALL USING (true);

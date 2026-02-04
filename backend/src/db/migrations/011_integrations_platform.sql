-- Migration 011: Integrations Platform
-- Adds tables for integrations, OAuth tokens, secrets, audit logs, heartbeats, approvals, and swarm

-- Integrations (provider connections)
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('active', 'disabled', 'error', 'pending')),
  display_name TEXT,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- OAuth tokens (encrypted)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  access_token_enc TEXT NOT NULL, -- JSON: EncryptedPayload
  refresh_token_enc TEXT, -- JSON: EncryptedPayload
  token_type TEXT,
  scope TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);

-- Integration secrets (encrypted API keys, etc.)
CREATE TABLE IF NOT EXISTS integration_secrets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_enc TEXT NOT NULL, -- JSON: EncryptedPayload
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Heartbeats (proactive cron tasks)
CREATE TABLE IF NOT EXISTS heartbeats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  payload TEXT, -- JSON
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Approval requests (human-in-the-loop)
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
  action TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high')),
  reason TEXT,
  payload TEXT, -- JSON
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT
);

-- Agent swarm instances
CREATE TABLE IF NOT EXISTS agent_swarm (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_id TEXT, -- Parent swarm/session if nested
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  agent_type TEXT NOT NULL,
  task_description TEXT,
  result TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
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
  approval_request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  approved_by TEXT,
  FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id)
);

-- Memory records (long-term persistent memory)
CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('conversation', 'preference', 'task', 'fact', 'context')),
  content TEXT NOT NULL,
  embedding TEXT, -- JSON array for vector search fallback
  importance REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TEXT,
  expires_at TEXT, -- NULL = never expires
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cost budgets
CREATE TABLE IF NOT EXISTS cost_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('daily', 'weekly', 'monthly')),
  limit_cents INTEGER NOT NULL,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  notify_at_percent INTEGER DEFAULT 80,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rate limits
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource TEXT NOT NULL, -- e.g., 'api', 'llm', 'integration:discord'
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL DEFAULT 60,
  current_count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, resource)
);

-- Browser automation allowlist
CREATE TABLE IF NOT EXISTS browser_allowlist (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  allowed_actions TEXT NOT NULL DEFAULT 'read', -- 'read', 'write', 'full'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, domain)
);

-- Indexes
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

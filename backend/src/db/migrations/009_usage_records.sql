-- Usage Records Table for tracking API calls and token usage
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
  -- Note: Foreign key to auth_users removed - user validation is at app level
);

-- Index for user_id and created_at for efficient time-range queries
CREATE INDEX IF NOT EXISTS idx_usage_records_user_created
  ON usage_records(user_id, created_at);

-- Index for endpoint for filtering by specific endpoints
CREATE INDEX IF NOT EXISTS idx_usage_records_endpoint
  ON usage_records(endpoint);

-- Index for success status to filter failed requests
CREATE INDEX IF NOT EXISTS idx_usage_records_success
  ON usage_records(success);

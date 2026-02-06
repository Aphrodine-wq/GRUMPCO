-- Fix usage_records table: Remove invalid foreign key to non-existent auth_users table
-- This migration recreates the table without the FK constraint to allow usage tracking
-- to work properly in the local SQLite database.

-- Disable FK enforcement temporarily
PRAGMA foreign_keys = OFF;

-- Create new table without FK constraint
CREATE TABLE IF NOT EXISTS usage_records_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  storage_bytes INTEGER,
  success BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy existing data (if any)
INSERT OR IGNORE INTO usage_records_new 
SELECT id, user_id, endpoint, method, model, input_tokens, output_tokens, latency_ms, storage_bytes, success, created_at
FROM usage_records;

-- Drop old table
DROP TABLE IF EXISTS usage_records;

-- Rename new table
ALTER TABLE usage_records_new RENAME TO usage_records;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_usage_records_user_created
  ON usage_records(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_usage_records_endpoint
  ON usage_records(endpoint);

CREATE INDEX IF NOT EXISTS idx_usage_records_success
  ON usage_records(success);

-- Re-enable FK enforcement
PRAGMA foreign_keys = ON;

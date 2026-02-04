-- Migration 012: Slack Integration
-- Adds table for Slack OAuth tokens with workspace support

-- Slack tokens (per workspace)
CREATE TABLE IF NOT EXISTS slack_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  access_token_enc TEXT NOT NULL, -- JSON: EncryptedPayload
  bot_user_id TEXT,
  scope TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, workspace_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slack_tokens_user_id ON slack_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_tokens_workspace_id ON slack_tokens(workspace_id);

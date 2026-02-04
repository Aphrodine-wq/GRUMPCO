-- Rollback for migration 012
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_slack_tokens_workspace_id;
DROP INDEX IF EXISTS idx_slack_tokens_user_id;
DROP TABLE IF EXISTS slack_tokens;
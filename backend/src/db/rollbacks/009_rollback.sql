-- Rollback for migration 009
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_usage_records_success;
DROP INDEX IF EXISTS idx_usage_records_endpoint;
DROP INDEX IF EXISTS idx_usage_records_user_created;
DROP TABLE IF EXISTS usage_records;
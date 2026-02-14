-- Rollback for migration 014
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_usage_records_success;
DROP INDEX IF EXISTS idx_usage_records_endpoint;
DROP INDEX IF EXISTS idx_usage_records_user_created;
-- WARNING: DROP operation cannot be rolled back automatically
-- Manual restoration required from backup
DROP TABLE IF EXISTS usage_records_new;
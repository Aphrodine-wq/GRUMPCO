-- Rollback for migration 006
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_webhook_deliveries_status;
DROP TABLE IF EXISTS webhook_deliveries;
DROP INDEX IF EXISTS idx_webhook_config_user_key;
DROP TABLE IF EXISTS webhook_config;
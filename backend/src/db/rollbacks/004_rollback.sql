-- Rollback for migration 004
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_settings_updated_at;
DROP TABLE IF EXISTS settings;
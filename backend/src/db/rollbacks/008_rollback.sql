-- Rollback for migration 008
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_scheduled_agents_enabled;
DROP TABLE IF EXISTS scheduled_agents;
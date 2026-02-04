-- Rollback for migration 002
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_ship_sessions_project_id;
DROP INDEX IF EXISTS idx_sessions_project_id;
ALTER TABLE ship_sessions DROP COLUMN project_id;
ALTER TABLE sessions DROP COLUMN project_id;
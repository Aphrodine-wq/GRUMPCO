-- Rollback for migration 001
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_ship_sessions_status;
DROP INDEX IF EXISTS idx_ship_sessions_phase;
DROP INDEX IF EXISTS idx_work_reports_agent_type;
DROP INDEX IF EXISTS idx_work_reports_session_id;
DROP INDEX IF EXISTS idx_specs_session_id;
DROP INDEX IF EXISTS idx_plans_session_id;
DROP INDEX IF EXISTS idx_sessions_created_at;
DROP INDEX IF EXISTS idx_sessions_status;
DROP INDEX IF EXISTS idx_sessions_type;
DROP TABLE IF EXISTS work_reports;
DROP TABLE IF EXISTS ship_sessions;
DROP TABLE IF EXISTS specs;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS sessions;
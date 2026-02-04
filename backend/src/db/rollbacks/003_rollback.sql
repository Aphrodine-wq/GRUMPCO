-- Rollback for migration 003
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_codegen_jobs_created_at;
DROP INDEX IF EXISTS idx_codegen_jobs_status;
DROP INDEX IF EXISTS idx_ship_jobs_created_at;
DROP INDEX IF EXISTS idx_ship_jobs_status;
DROP TABLE IF EXISTS codegen_jobs;
DROP TABLE IF EXISTS ship_jobs;
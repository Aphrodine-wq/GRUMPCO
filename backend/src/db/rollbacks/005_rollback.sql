-- Rollback for migration 005
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_expo_test_jobs_created_at;
DROP INDEX IF EXISTS idx_expo_test_jobs_status;
DROP TABLE IF EXISTS expo_test_jobs;
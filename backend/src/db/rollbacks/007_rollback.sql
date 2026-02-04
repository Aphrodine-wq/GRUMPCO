-- Rollback for migration 007
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_intent_compiler_failures_created_at;
DROP TABLE IF EXISTS intent_compiler_failures;
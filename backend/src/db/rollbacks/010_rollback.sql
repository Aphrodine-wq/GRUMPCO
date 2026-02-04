-- Rollback for migration 010
-- WARNING: Review before running in production

DROP INDEX IF EXISTS idx_version_history_created;
DROP INDEX IF EXISTS idx_version_history_project;
DROP INDEX IF EXISTS idx_version_history_entity;
DROP TABLE IF EXISTS version_history;
DROP INDEX IF EXISTS idx_comments_created;
DROP INDEX IF EXISTS idx_comments_parent;
DROP INDEX IF EXISTS idx_comments_project;
DROP INDEX IF EXISTS idx_comments_entity;
DROP TABLE IF EXISTS comments;
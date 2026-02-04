-- Comment threads on entities (diagrams, specs, plans, code)
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('diagram', 'spec', 'plan', 'code', 'session')),
  entity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  parent_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);

-- Version history for specs, plans, diagrams (snapshots for diff view)
CREATE TABLE IF NOT EXISTS version_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('spec', 'plan', 'diagram')),
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  UNIQUE(entity_type, entity_id, version)
);

CREATE INDEX IF NOT EXISTS idx_version_history_entity ON version_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_version_history_project ON version_history(project_id);
CREATE INDEX IF NOT EXISTS idx_version_history_created ON version_history(created_at);

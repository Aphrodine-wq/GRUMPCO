-- Settings table: key (user id or 'default'), data JSON, updated_at
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);

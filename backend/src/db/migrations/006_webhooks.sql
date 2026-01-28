-- Outbound webhook config (per user/org or default)
CREATE TABLE IF NOT EXISTS webhook_config (
  id TEXT PRIMARY KEY,
  user_key TEXT,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_config_user_key ON webhook_config(user_key);

-- Pending webhook deliveries (async dispatch)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  error TEXT,
  FOREIGN KEY (config_id) REFERENCES webhook_config(id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

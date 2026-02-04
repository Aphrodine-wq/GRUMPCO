-- Pending jobs for SHIP and codegen so long runs can be offloaded to a worker
CREATE TABLE IF NOT EXISTS ship_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  error TEXT,
  FOREIGN KEY (session_id) REFERENCES ship_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS codegen_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_ship_jobs_status ON ship_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ship_jobs_created_at ON ship_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_codegen_jobs_status ON codegen_jobs(status);
CREATE INDEX IF NOT EXISTS idx_codegen_jobs_created_at ON codegen_jobs(created_at);

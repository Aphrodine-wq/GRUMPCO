-- Expo test jobs: run Expo/React Native tests inside Docker
CREATE TABLE IF NOT EXISTS expo_test_jobs (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  error TEXT,
  result_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_expo_test_jobs_status ON expo_test_jobs(status);
CREATE INDEX IF NOT EXISTS idx_expo_test_jobs_created_at ON expo_test_jobs(created_at);

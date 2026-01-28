-- Store intent compiler Rust failures + Claude fallback results for analysis
CREATE TABLE IF NOT EXISTS intent_compiler_failures (
  id TEXT PRIMARY KEY,
  input_text TEXT NOT NULL,
  rust_error TEXT NOT NULL,
  claude_result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intent_compiler_failures_created_at ON intent_compiler_failures(created_at);

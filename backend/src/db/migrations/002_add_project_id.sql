-- Add optional project_id to link chat/ship/codegen sessions to a project/workspace
ALTER TABLE sessions ADD COLUMN project_id TEXT;
ALTER TABLE ship_sessions ADD COLUMN project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_project_id ON ship_sessions(project_id);

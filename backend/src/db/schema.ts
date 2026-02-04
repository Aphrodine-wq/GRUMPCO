/**
 * Database Schema
 * Defines all database tables and their structure
 */

export interface SessionRow {
  id: string;
  type: 'generation' | 'ship' | 'spec' | 'plan';
  status: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  project_id?: string | null;
}

export interface PlanRow {
  id: string;
  session_id?: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
  started_at?: string;
  completed_at?: string;
}

export interface SpecRow {
  id: string;
  session_id?: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ShipSessionRow {
  id: string;
  phase: string;
  status: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
  project_id?: string | null;
}

export interface WorkReportRow {
  id: string;
  session_id: string;
  agent_type: string;
  report: string; // JSON string
  created_at: string;
}

export interface SlackTokenRow {
  id: string;
  user_id: string;
  workspace_id: string;
  workspace_name?: string | null;
  access_token_enc: string; // JSON: EncryptedPayload
  bot_user_id?: string | null;
  scope?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// G-Agent Goals Tables
// ============================================================================

export interface GoalRow {
  id: string;
  user_id: string;
  description: string;
  status:
    | 'pending'
    | 'scheduled'
    | 'planning'
    | 'awaiting_approval'
    | 'executing'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  trigger: 'immediate' | 'scheduled' | 'webhook' | 'cron' | 'file_change' | 'self_scheduled';

  // Scheduling
  scheduled_at?: string | null;
  cron_expression?: string | null;

  // Execution
  plan_id?: string | null;
  session_id?: string | null;
  workspace_root?: string | null;

  // Hierarchy
  parent_goal_id?: string | null;
  child_goal_ids: string; // JSON array of strings

  // Checkpoints
  checkpoints: string; // JSON array
  current_checkpoint_id?: string | null;

  // Results
  result?: string | null;
  error?: string | null;
  artifacts?: string | null; // JSON array

  // Metadata
  tags: string; // JSON array of strings
  retry_count: number;
  max_retries: number;

  // Timestamps
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  next_run_at?: string | null;
}

export interface GoalCheckpointRow {
  id: string;
  goal_id: string;
  phase: string;
  progress: number; // 0-100
  state?: string | null; // JSON - serialized state for resumption
  message?: string | null; // Human-readable progress message
  created_at: string;
}

export interface AgentInstanceRow {
  id: string;
  type: string;
  status: 'spawning' | 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  goal_id?: string | null;
  task_id?: string | null;
  parent_id?: string | null;
  input?: string | null; // JSON
  output?: string | null; // JSON
  error?: string | null;
  tokens_used: number;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  last_heartbeat: string;
}

/**
 * SQL schema definitions
 */
export const SCHEMA_SQL = `
-- Sessions table (for generation sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('generation', 'ship', 'spec', 'plan')),
  status TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  approved_by TEXT,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Specs table
CREATE TABLE IF NOT EXISTS specs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Ship sessions table
CREATE TABLE IF NOT EXISTS ship_sessions (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Work reports table
CREATE TABLE IF NOT EXISTS work_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  report TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id);
CREATE INDEX IF NOT EXISTS idx_specs_session_id ON specs(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_session_id ON work_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_agent_type ON work_reports(agent_type);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_phase ON ship_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_status ON ship_sessions(status);

-- G-Agent Goals table
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'scheduled', 'planning', 'awaiting_approval', 'executing', 'paused', 'completed', 'failed', 'cancelled')),
  priority TEXT NOT NULL CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  trigger TEXT NOT NULL CHECK(trigger IN ('immediate', 'scheduled', 'webhook', 'cron', 'file_change', 'self_scheduled')),
  scheduled_at TEXT,
  cron_expression TEXT,
  plan_id TEXT,
  session_id TEXT,
  workspace_root TEXT,
  parent_goal_id TEXT,
  child_goal_ids TEXT NOT NULL DEFAULT '[]',
  checkpoints TEXT NOT NULL DEFAULT '[]',
  current_checkpoint_id TEXT,
  result TEXT,
  error TEXT,
  artifacts TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  next_run_at TEXT,
  FOREIGN KEY (parent_goal_id) REFERENCES goals(id) ON DELETE SET NULL
);

-- Goal checkpoints for resumption
CREATE TABLE IF NOT EXISTS goal_checkpoints (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  state TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
);

-- Agent instances table
CREATE TABLE IF NOT EXISTS agent_instances (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('spawning', 'idle', 'running', 'completed', 'failed', 'cancelled')),
  goal_id TEXT,
  task_id TEXT,
  parent_id TEXT,
  input TEXT,
  output TEXT,
  error TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  last_heartbeat TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES agent_instances(id) ON DELETE SET NULL
);

-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_goals_trigger ON goals(trigger);
CREATE INDEX IF NOT EXISTS idx_goals_next_run_at ON goals(next_run_at);
CREATE INDEX IF NOT EXISTS idx_goals_parent_goal_id ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);

-- Indexes for goal_checkpoints
CREATE INDEX IF NOT EXISTS idx_goal_checkpoints_goal_id ON goal_checkpoints(goal_id);

-- Indexes for agent_instances
CREATE INDEX IF NOT EXISTS idx_agent_instances_type ON agent_instances(type);
CREATE INDEX IF NOT EXISTS idx_agent_instances_status ON agent_instances(status);
CREATE INDEX IF NOT EXISTS idx_agent_instances_goal_id ON agent_instances(goal_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_parent_id ON agent_instances(parent_id);
`;

/**
 * PostgreSQL-specific schema (for production scale)
 */
export const SCHEMA_POSTGRESQL = `
-- Sessions table (for generation sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('generation', 'ship', 'spec', 'plan')),
  status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Specs table
CREATE TABLE IF NOT EXISTS specs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Ship sessions table
CREATE TABLE IF NOT EXISTS ship_sessions (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Work reports table
CREATE TABLE IF NOT EXISTS work_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id);
CREATE INDEX IF NOT EXISTS idx_specs_session_id ON specs(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_session_id ON work_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_agent_type ON work_reports(agent_type);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_phase ON ship_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_ship_sessions_status ON ship_sessions(status);

-- G-Agent Goals table
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'scheduled', 'planning', 'awaiting_approval', 'executing', 'paused', 'completed', 'failed', 'cancelled')),
  priority TEXT NOT NULL CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  trigger TEXT NOT NULL CHECK(trigger IN ('immediate', 'scheduled', 'webhook', 'cron', 'file_change', 'self_scheduled')),
  scheduled_at TIMESTAMP,
  cron_expression TEXT,
  plan_id TEXT,
  session_id TEXT,
  workspace_root TEXT,
  parent_goal_id TEXT,
  child_goal_ids JSONB NOT NULL DEFAULT '[]',
  checkpoints JSONB NOT NULL DEFAULT '[]',
  current_checkpoint_id TEXT,
  result TEXT,
  error TEXT,
  artifacts JSONB,
  tags JSONB NOT NULL DEFAULT '[]',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  next_run_at TIMESTAMP,
  FOREIGN KEY (parent_goal_id) REFERENCES goals(id) ON DELETE SET NULL
);

-- Goal checkpoints for resumption
CREATE TABLE IF NOT EXISTS goal_checkpoints (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  state JSONB,
  message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
);

-- Agent instances table
CREATE TABLE IF NOT EXISTS agent_instances (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('spawning', 'idle', 'running', 'completed', 'failed', 'cancelled')),
  goal_id TEXT,
  task_id TEXT,
  parent_id TEXT,
  input JSONB,
  output JSONB,
  error TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_id) REFERENCES agent_instances(id) ON DELETE SET NULL
);

-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_goals_trigger ON goals(trigger);
CREATE INDEX IF NOT EXISTS idx_goals_next_run_at ON goals(next_run_at);
CREATE INDEX IF NOT EXISTS idx_goals_parent_goal_id ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);

-- Indexes for goal_checkpoints
CREATE INDEX IF NOT EXISTS idx_goal_checkpoints_goal_id ON goal_checkpoints(goal_id);

-- Indexes for agent_instances
CREATE INDEX IF NOT EXISTS idx_agent_instances_type ON agent_instances(type);
CREATE INDEX IF NOT EXISTS idx_agent_instances_status ON agent_instances(status);
CREATE INDEX IF NOT EXISTS idx_agent_instances_goal_id ON agent_instances(goal_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_parent_id ON agent_instances(parent_id);
`;

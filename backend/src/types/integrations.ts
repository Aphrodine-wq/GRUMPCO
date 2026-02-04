/**
 * Types for the Integrations Platform
 * Includes integrations, OAuth, secrets, audit logs, heartbeats, approvals, swarm, skills, memory, budgets
 */

// ========== Integration Providers ==========

export type IntegrationProviderId =
  | 'discord'
  | 'slack'
  | 'spotify'
  | 'imessage'
  | 'signal'
  | 'whatsapp'
  | 'gmail'
  | 'google_calendar'
  | 'telegram'
  | 'notion'
  | 'obsidian'
  | 'twitter'
  | 'whoop'
  | 'philips_hue'
  | 'home_assistant'
  | 'elevenlabs'
  | 'twilio'
  // New integrations (Phase 2.3+)
  | 'jira'
  | 'atlassian'
  | 'vercel'
  | 'netlify'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'supabase'
  | 'firebase'
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'linear';

export type IntegrationStatus = 'active' | 'disabled' | 'error' | 'pending';

export interface IntegrationRecord {
  id: string;
  user_id: string;
  provider: IntegrationProviderId;
  status: IntegrationStatus;
  display_name?: string | null;
  metadata?: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

// ========== OAuth Tokens ==========

export interface OAuthTokenRecord {
  id: string;
  user_id: string;
  provider: IntegrationProviderId;
  access_token_enc: string; // JSON EncryptedPayload
  refresh_token_enc?: string | null;
  token_type?: string | null;
  scope?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ========== Integration Secrets ==========

export interface IntegrationSecretRecord {
  id: string;
  user_id: string;
  provider: IntegrationProviderId;
  name: string;
  secret_enc: string; // JSON EncryptedPayload
  created_at: string;
  updated_at: string;
}

// ========== Audit Logs ==========

export type AuditCategory =
  | 'integration'
  | 'system'
  | 'security'
  | 'automation'
  | 'billing'
  | 'agent'
  | 'ai'
  | 'tool'
  | 'skill';

export interface AuditLogRecord {
  id: string;
  user_id: string;
  actor?: string | null;
  action: string;
  category: AuditCategory;
  target?: string | null;
  metadata?: string | null; // JSON string
  created_at: string;
}

// ========== Heartbeats (Proactive Tasks) ==========

export interface HeartbeatRecord {
  id: string;
  user_id: string;
  name: string;
  cron_expression: string;
  enabled: boolean | number; // SQLite uses 0/1
  payload?: string | null; // JSON string
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ========== Approval Requests ==========

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ApprovalRequestRecord {
  id: string;
  user_id: string;
  status: ApprovalStatus;
  action: string;
  risk_level: RiskLevel;
  reason?: string | null;
  payload?: string | null; // JSON string
  expires_at?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

// ========== Agent Swarm ==========

export type SwarmStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SwarmAgentRecord {
  id: string;
  user_id: string;
  parent_id?: string | null;
  name: string;
  status: SwarmStatus;
  agent_type: string;
  task_description?: string | null;
  result?: string | null; // JSON string
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

// ========== Skills ==========

export type SkillLanguage = 'typescript' | 'python';
export type SkillStatus = 'pending' | 'approved' | 'active' | 'disabled' | 'rejected';

export interface SkillRecord {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  language: SkillLanguage;
  source_code: string;
  compiled_code?: string | null;
  status: SkillStatus;
  version: number;
  approval_request_id?: string | null;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
}

// ========== Conversation Memories (Messaging) ==========

export interface ConversationMemoryRecord {
  id: string;
  platform: string;
  platform_user_id: string;
  user_id: string | null;
  messages: string; // JSON array of {role, content}
  summary: string | null;
  updated_at: string;
  created_at: string;
}

// ========== Messaging Subscriptions (Proactive Push) ==========

export interface MessagingSubscriptionRecord {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id: string;
  created_at: string;
}

// ========== Reminders (Life Automation) ==========

export interface ReminderRecord {
  id: string;
  user_id: string;
  content: string;
  due_at: string;
  platform: string | null;
  platform_user_id: string | null;
  notified: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

// ========== Slack User Pairings ==========

export interface SlackUserPairingRecord {
  slack_user_id: string;
  workspace_id: string;
  grump_user_id: string;
  created_at: string;
}

// ========== Memory Records ==========

export type MemoryType = 'conversation' | 'preference' | 'task' | 'fact' | 'context';

export interface MemoryRecord {
  id: string;
  user_id: string;
  type: MemoryType;
  content: string;
  embedding?: string | null; // JSON array
  importance: number;
  access_count: number;
  last_accessed_at?: string | null;
  expires_at?: string | null;
  metadata?: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

// ========== Cost Budgets ==========

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly';

export interface CostBudgetRecord {
  id: string;
  user_id: string;
  period: BudgetPeriod;
  limit_cents: number;
  spent_cents: number;
  period_start: string;
  period_end: string;
  notify_at_percent: number;
  created_at: string;
  updated_at: string;
}

// ========== Rate Limits ==========

export interface RateLimitRecord {
  id: string;
  user_id: string;
  resource: string;
  max_requests: number;
  window_seconds: number;
  current_count: number;
  window_start: string;
  created_at: string;
}

// ========== Slack Tokens ==========

export interface SlackTokenRecord {
  id: string;
  user_id: string;
  workspace_id: string;
  workspace_name?: string | null;
  access_token_enc: string; // JSON EncryptedPayload
  bot_user_id?: string | null;
  scope?: string | null;
  created_at: string;
  updated_at: string;
}

// ========== Browser Allowlist ==========

export type BrowserAllowedAction = 'read' | 'write' | 'full';

export interface BrowserAllowlistRecord {
  id: string;
  user_id: string;
  domain: string;
  allowed_actions: BrowserAllowedAction;
  created_at: string;
}

// ========== Input Types (for creating/updating) ==========

export interface CreateIntegrationInput {
  userId: string;
  provider: IntegrationProviderId;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateOAuthTokenInput {
  userId: string;
  provider: IntegrationProviderId;
  accessTokenEnc: string;
  refreshTokenEnc?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: string;
}

export interface CreateSecretInput {
  userId: string;
  provider: IntegrationProviderId;
  name: string;
  secretEnc: string;
}

export interface CreateAuditLogInput {
  userId: string;
  actor?: string;
  action: string;
  category: AuditCategory;
  target?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateHeartbeatInput {
  userId: string;
  name: string;
  cronExpression: string;
  payload?: Record<string, unknown>;
}

export interface CreateApprovalInput {
  userId: string;
  action: string;
  riskLevel: RiskLevel;
  reason?: string;
  payload?: Record<string, unknown>;
  expiresAt?: string;
}

export interface CreateSwarmAgentInput {
  userId: string;
  parentId?: string;
  name: string;
  agentType: string;
  taskDescription?: string;
}

export interface CreateSkillInput {
  userId: string;
  name: string;
  description?: string;
  language: SkillLanguage;
  sourceCode: string;
}

export interface CreateMemoryInput {
  userId: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  importance?: number;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}

export interface CreateSlackTokenInput {
  userId: string;
  workspaceId: string;
  workspaceName?: string;
  accessTokenEnc: string;
  botUserId?: string;
  scope?: string;
}

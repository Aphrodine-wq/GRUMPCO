/**
 * Supabase Database Service
 * Implements database operations using Supabase PostgreSQL
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import logger from '../middleware/logger.js';
import { recordDbOperation } from '../middleware/metrics.js';
import type { GenerationSession, AgentWorkReport } from '../types/agents.js';
import type { ShipSession } from '../types/ship.js';
import type { Plan } from '../types/plan.js';
import type { SpecSession } from '../types/spec.js';
import type { Settings } from '../types/settings.js';
import type {
  IntegrationRecord,
  OAuthTokenRecord,
  IntegrationSecretRecord,
  AuditLogRecord,
  HeartbeatRecord,
  ApprovalRequestRecord,
  SwarmAgentRecord,
  SkillRecord,
  MemoryRecord,
  CostBudgetRecord,
  RateLimitRecord,
  BrowserAllowlistRecord,
  IntegrationProviderId,
  SlackTokenRecord,
  ConversationMemoryRecord,
  MessagingSubscriptionRecord,
  SlackUserPairingRecord,
  ReminderRecord,
} from '../types/integrations.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRow = Record<string, any>;

/** Project API URL must be https://<project-ref>.supabase.co (no /dashboard or app.supabase.com) */
const SUPABASE_PROJECT_URL_REGEX = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i;

function isHtmlResponse(message: string): boolean {
  return (
    typeof message === 'string' &&
    (message.trimStart().startsWith('<!DOCTYPE') ||
      message.includes('"page":"/404"') ||
      (message.includes('<title') && message.includes('Supabase')))
  );
}

function isProjectApiUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      SUPABASE_PROJECT_URL_REGEX.test(url) &&
      !u.hostname.includes('app.') &&
      (u.pathname === '' || u.pathname === '/')
    );
  } catch {
    return false;
  }
}

export class SupabaseDatabaseService {
  private client: SupabaseClient;
  private initialized = false;
  private supabaseUrl: string;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!isProjectApiUrl(this.supabaseUrl)) {
      const hint =
        this.supabaseUrl.includes('dashboard') || this.supabaseUrl.includes('app.supabase.com')
          ? ' Use your project API URL (e.g. https://YOUR_PROJECT_REF.supabase.co), not the Supabase dashboard URL.'
          : ' SUPABASE_URL must be your project API URL: https://YOUR_PROJECT_REF.supabase.co (find it in Supabase Dashboard → Project Settings → API).';
      throw new Error(`Invalid SUPABASE_URL: expected project API URL.${hint}`);
    }

    // Test connection by checking if we can query
    const { error } = await this.client.from('sessions').select('id').limit(1);

    if (error && error.code === '42P01') {
      // Table doesn't exist - user needs to run migrations
      logger.warn('Supabase tables not found. Please run the SQL schema in Supabase Dashboard.');
      logger.warn('See DEPLOY_VERCEL.md for setup instructions.');
    } else if (error) {
      const msg = error.message ?? String(error);
      if (isHtmlResponse(msg)) {
        throw new Error(
          'Supabase connection failed: the server returned a web page instead of the API. ' +
            'Set SUPABASE_URL to your project API URL (e.g. https://YOUR_PROJECT_REF.supabase.co), ' +
            'not the Supabase dashboard or app URL. Find it in Supabase Dashboard → Project Settings → API.'
        );
      }
      logger.error({ error: msg }, 'Supabase connection test failed');
      throw new Error(`Supabase connection failed: ${msg}`);
    }

    this.initialized = true;
    logger.info('Supabase database initialized');
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit close
    this.initialized = false;
  }

  /**
   * Get raw database - stub for SQLite compatibility
   * Note: This throws for Supabase as direct DB access is not supported
   */
  getDb(): never {
    throw new Error(
      'Direct database access not supported in Supabase mode. Use Supabase methods instead.'
    );
  }

  /**
   * Alias for saveSpec (for sessionStorage compatibility)
   */
  async saveSpecSession(spec: SpecSession): Promise<void> {
    return this.saveSpec(spec);
  }

  /**
   * Alias for getSpec (for sessionStorage compatibility)
   */
  async getSpecSession(specId: string): Promise<SpecSession | null> {
    return this.getSpec(specId);
  }

  // ========== Sessions ==========

  async saveSession(session: GenerationSession): Promise<void> {
    const start = process.hrtime.bigint();
    try {
      const { error } = await this.client.from('sessions').upsert({
        id: session.sessionId,
        type: 'generation',
        status: session.status,
        data: session,
        created_at: session.createdAt,
        updated_at: new Date().toISOString(),
        started_at: session.startedAt || null,
        completed_at: session.completedAt || null,
        project_id: session.projectId ?? null,
      });

      if (error) throw error;

      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation('saveSession', 'sessions', duration, 'success');
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation('saveSession', 'sessions', duration, 'error');
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<GenerationSession | null> {
    const { data, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('type', 'generation')
      .single();

    if (error || !data) return null;
    return data.data as GenerationSession;
  }

  async listSessions(
    options: {
      type?: 'generation' | 'ship' | 'spec' | 'plan';
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<GenerationSession[]> {
    let query = this.client.from('sessions').select('*');

    if (options.type) query = query.eq('type', options.type);
    if (options.status) query = query.eq('status', options.status);
    query = query.order('created_at', { ascending: false });
    if (options.limit) query = query.limit(options.limit);
    if (options.offset)
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: SupabaseRow) => row.data as GenerationSession);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.client.from('sessions').delete().eq('id', sessionId);
    if (error) throw error;
  }

  // ========== Ship Sessions ==========

  async saveShipSession(session: ShipSession): Promise<void> {
    const { error } = await this.client.from('ship_sessions').upsert({
      id: session.id,
      phase: session.phase,
      status: session.status,
      data: session,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      project_id: session.projectId ?? null,
    });

    if (error) throw error;
  }

  async getShipSession(sessionId: string): Promise<ShipSession | null> {
    const { data, error } = await this.client
      .from('ship_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) return null;
    return data.data as ShipSession;
  }

  async listShipSessions(
    options: {
      phase?: string;
      status?: string;
      projectId?: string;
      limit?: number;
    } = {}
  ): Promise<ShipSession[]> {
    let query = this.client.from('ship_sessions').select('*');

    if (options.phase) query = query.eq('phase', options.phase);
    if (options.status) query = query.eq('status', options.status);
    if (options.projectId != null) query = query.eq('project_id', options.projectId);
    query = query.order('created_at', { ascending: false });
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: SupabaseRow) => row.data as ShipSession);
  }

  // ========== Plans ==========

  async savePlan(plan: Plan): Promise<void> {
    const { error } = await this.client.from('plans').upsert({
      id: plan.id,
      session_id: null,
      data: plan,
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
      approved_at: plan.approvedAt || null,
      approved_by: plan.approvedBy || null,
      started_at: plan.startedAt || null,
      completed_at: plan.completedAt || null,
    });

    if (error) throw error;
  }

  async getPlan(planId: string): Promise<Plan | null> {
    const { data, error } = await this.client.from('plans').select('*').eq('id', planId).single();

    if (error || !data) return null;
    return data.data as Plan;
  }

  async listPlans(options: { status?: string; limit?: number } = {}): Promise<Plan[]> {
    let query = this.client.from('plans').select('*');

    if (options.status) {
      query = query.eq('data->>status', options.status);
    }
    query = query.order('created_at', { ascending: false });
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: SupabaseRow) => row.data as Plan);
  }

  // ========== Specs ==========

  async saveSpec(spec: SpecSession): Promise<void> {
    const { error } = await this.client.from('specs').upsert({
      id: spec.id,
      session_id: null,
      data: spec,
      created_at: spec.createdAt,
      updated_at: spec.updatedAt,
      completed_at: spec.completedAt || null,
    });

    if (error) throw error;
  }

  async getSpec(specId: string): Promise<SpecSession | null> {
    const { data, error } = await this.client.from('specs').select('*').eq('id', specId).single();

    if (error || !data) return null;
    return data.data as SpecSession;
  }

  // ========== Work Reports ==========

  async saveWorkReport(report: AgentWorkReport): Promise<void> {
    const reportId = `report_${report.sessionId}_${report.agentType}_${Date.now()}`;
    const { error } = await this.client.from('work_reports').upsert({
      id: reportId,
      session_id: report.sessionId,
      agent_type: report.agentType,
      report: report,
      created_at: report.generatedAt,
    });

    if (error) throw error;
  }

  async getWorkReports(sessionId: string): Promise<AgentWorkReport[]> {
    const { data, error } = await this.client
      .from('work_reports')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map((row: SupabaseRow) => row.report as AgentWorkReport);
  }

  // ========== Settings ==========

  async getSettings(userKey: string): Promise<Settings | null> {
    const { data, error } = await this.client
      .from('settings')
      .select('data')
      .eq('id', userKey)
      .single();

    if (error || !data) return null;
    return data.data as Settings;
  }

  async saveSettings(userKey: string, settings: Settings): Promise<void> {
    const updatedAt = new Date().toISOString();
    const payload = { ...settings, updatedAt };

    const { error } = await this.client.from('settings').upsert({
      id: userKey,
      data: payload,
      updated_at: updatedAt,
    });

    if (error) throw error;
  }
  async saveUsageRecord(record: {
    id: string;
    userId: string;
    endpoint: string;
    method: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    storageBytes?: number;
    success: boolean;
    estimatedCostUsd?: number;
  }): Promise<void> {
    const start = process.hrtime.bigint();
    const { error } = await this.client.from('usage_records').insert({
      id: record.id,
      user_id: record.userId,
      endpoint: record.endpoint,
      method: record.method,
      model: record.model || null,
      input_tokens: record.inputTokens || null,
      output_tokens: record.outputTokens || null,
      latency_ms: record.latencyMs || null,
      storage_bytes: record.storageBytes || null,
      success: record.success ? 1 : 0,
      estimated_cost_usd: record.estimatedCostUsd ?? 0,
      created_at: new Date().toISOString(),
    });

    if (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      recordDbOperation('saveUsageRecord', 'usage_records', duration, 'error');
      throw error;
    }
  }

  async getUsageForUser(
    userId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Record<string, unknown>[]> {
    const { data, error } = await this.client
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getUsageSummary(userId: string): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    monthlyInputTokens: number;
    monthlyOutputTokens: number;
    avgLatencyMs: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await this.client
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    if (error || !data) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        monthlyInputTokens: 0,
        monthlyOutputTokens: 0,
        avgLatencyMs: 0,
      };
    }

    const successful = data.filter((r: SupabaseRow) => r.success === 1);
    const totalLatency = successful.reduce(
      (acc: number, r: SupabaseRow) => acc + (r.latency_ms || 0),
      0
    );

    return {
      totalRequests: data.length,
      successfulRequests: successful.length,
      failedRequests: data.length - successful.length,
      monthlyInputTokens: data.reduce(
        (acc: number, r: SupabaseRow) => acc + (r.input_tokens || 0),
        0
      ),
      monthlyOutputTokens: data.reduce(
        (acc: number, r: SupabaseRow) => acc + (r.output_tokens || 0),
        0
      ),
      avgLatencyMs: successful.length > 0 ? Math.round(totalLatency / successful.length) : 0,
    };
  }

  // ========== Integrations Platform ==========

  /** Save an audit log entry */
  async saveAuditLog(record: AuditLogRecord): Promise<void> {
    const { error } = await this.client.from('audit_logs').insert({
      id: record.id,
      user_id: record.user_id,
      actor: record.actor ?? null,
      action: record.action,
      category: record.category,
      target: record.target ?? null,
      metadata: record.metadata ?? null,
      created_at: record.created_at,
    });
    if (error) throw error;
  }

  /** Get audit logs with filters */
  async getAuditLogs(
    options: {
      userId?: string;
      category?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuditLogRecord[]> {
    let query = this.client.from('audit_logs').select('*');
    if (options.userId) query = query.eq('user_id', options.userId);
    if (options.category) query = query.eq('category', options.category);
    query = query.order('created_at', { ascending: false });
    if (options.limit) query = query.limit(options.limit);
    if (options.offset)
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AuditLogRecord[];
  }

  /** Save an integration */
  async saveIntegration(record: IntegrationRecord): Promise<void> {
    const { error } = await this.client.from('integrations').upsert({
      id: record.id,
      user_id: record.user_id,
      provider: record.provider,
      status: record.status,
      display_name: record.display_name ?? null,
      metadata: record.metadata ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
    if (error) throw error;
  }

  /** Get integration by ID */
  async getIntegration(id: string): Promise<IntegrationRecord | null> {
    const { data, error } = await this.client
      .from('integrations')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data as IntegrationRecord;
  }

  /** Get integrations for user */
  async getIntegrationsForUser(userId: string): Promise<IntegrationRecord[]> {
    const { data, error } = await this.client
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as IntegrationRecord[];
  }

  /** Get integration by user and provider */
  async getIntegrationByProvider(
    userId: string,
    provider: IntegrationProviderId
  ): Promise<IntegrationRecord | null> {
    const { data, error } = await this.client
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();
    if (error || !data) return null;
    return data as IntegrationRecord;
  }

  /** Delete integration */
  async deleteIntegration(id: string): Promise<void> {
    const { error } = await this.client.from('integrations').delete().eq('id', id);
    if (error) throw error;
  }

  /** Save OAuth token */
  async saveOAuthToken(record: OAuthTokenRecord): Promise<void> {
    const { error } = await this.client.from('oauth_tokens').upsert({
      id: record.id,
      user_id: record.user_id,
      provider: record.provider,
      access_token_enc: record.access_token_enc,
      refresh_token_enc: record.refresh_token_enc ?? null,
      token_type: record.token_type ?? null,
      scope: record.scope ?? null,
      expires_at: record.expires_at ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
    if (error) throw error;
  }

  /** Get OAuth token by user and provider */
  async getOAuthToken(
    userId: string,
    provider: IntegrationProviderId
  ): Promise<OAuthTokenRecord | null> {
    const { data, error } = await this.client
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();
    if (error || !data) return null;
    return data as OAuthTokenRecord;
  }

  /** Delete OAuth token */
  async deleteOAuthToken(userId: string, provider: IntegrationProviderId): Promise<void> {
    const { error } = await this.client
      .from('oauth_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);
    if (error) throw error;
  }

  /** Save integration secret */
  async saveIntegrationSecret(record: IntegrationSecretRecord): Promise<void> {
    const { error } = await this.client.from('integration_secrets').upsert({
      id: record.id,
      user_id: record.user_id,
      provider: record.provider,
      name: record.name,
      secret_enc: record.secret_enc,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
    if (error) throw error;
  }

  /** Get integration secret */
  async getIntegrationSecret(
    userId: string,
    provider: IntegrationProviderId,
    name: string
  ): Promise<IntegrationSecretRecord | null> {
    const { data, error } = await this.client
      .from('integration_secrets')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('name', name)
      .single();
    if (error || !data) return null;
    return data as IntegrationSecretRecord;
  }

  /** Delete integration secret */
  async deleteIntegrationSecret(
    userId: string,
    provider: IntegrationProviderId,
    name: string
  ): Promise<void> {
    const { error } = await this.client
      .from('integration_secrets')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('name', name);
    if (error) throw error;
  }

  /** Save heartbeat */
  async saveHeartbeat(record: HeartbeatRecord): Promise<void> {
    const { error } = await this.client.from('heartbeats').upsert({
      id: record.id,
      user_id: record.user_id,
      name: record.name,
      cron_expression: record.cron_expression,
      enabled: record.enabled,
      payload: record.payload ?? null,
      last_run_at: record.last_run_at ?? null,
      next_run_at: record.next_run_at ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
    if (error) throw error;
  }

  /** Get heartbeat by ID */
  async getHeartbeat(id: string): Promise<HeartbeatRecord | null> {
    const { data, error } = await this.client.from('heartbeats').select('*').eq('id', id).single();
    if (error || !data) return null;
    return { ...data, enabled: Boolean(data.enabled) } as HeartbeatRecord;
  }

  /** Get enabled heartbeats */
  async getEnabledHeartbeats(): Promise<HeartbeatRecord[]> {
    const { data, error } = await this.client
      .from('heartbeats')
      .select('*')
      .eq('enabled', true)
      .order('next_run_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((r: SupabaseRow) => ({
      ...r,
      enabled: true,
    })) as HeartbeatRecord[];
  }

  /** Get heartbeats for user */
  async getHeartbeatsForUser(userId: string): Promise<HeartbeatRecord[]> {
    const { data, error } = await this.client
      .from('heartbeats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r: SupabaseRow) => ({
      ...r,
      enabled: Boolean(r.enabled),
    })) as HeartbeatRecord[];
  }

  /** Delete heartbeat */
  async deleteHeartbeat(id: string): Promise<void> {
    const { error } = await this.client.from('heartbeats').delete().eq('id', id);
    if (error) throw error;
  }

  /** Save approval request */
  async saveApprovalRequest(record: ApprovalRequestRecord): Promise<void> {
    const { error } = await this.client.from('approval_requests').upsert({
      id: record.id,
      user_id: record.user_id,
      status: record.status,
      action: record.action,
      risk_level: record.risk_level,
      reason: record.reason ?? null,
      payload: record.payload ?? null,
      expires_at: record.expires_at ?? null,
      created_at: record.created_at,
      resolved_at: record.resolved_at ?? null,
      resolved_by: record.resolved_by ?? null,
    });
    if (error) throw error;
  }

  /** Get approval request by ID */
  async getApprovalRequest(id: string): Promise<ApprovalRequestRecord | null> {
    const { data, error } = await this.client
      .from('approval_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data as ApprovalRequestRecord;
  }

  /** Get pending approvals for user */
  async getPendingApprovals(userId: string): Promise<ApprovalRequestRecord[]> {
    const { data, error } = await this.client
      .from('approval_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ApprovalRequestRecord[];
  }

  /** Save swarm agent */
  async saveSwarmAgent(record: SwarmAgentRecord): Promise<void> {
    const { error } = await this.client.from('agent_swarm').upsert({
      id: record.id,
      user_id: record.user_id,
      parent_id: record.parent_id ?? null,
      name: record.name,
      status: record.status,
      agent_type: record.agent_type,
      task_description: record.task_description ?? null,
      result: record.result ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
      completed_at: record.completed_at ?? null,
    });
    if (error) throw error;
  }

  /** Get swarm agent by ID */
  async getSwarmAgent(id: string): Promise<SwarmAgentRecord | null> {
    const { data, error } = await this.client.from('agent_swarm').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as SwarmAgentRecord;
  }

  /** Get swarm agents for parent */
  async getSwarmChildren(parentId: string): Promise<SwarmAgentRecord[]> {
    const { data, error } = await this.client
      .from('agent_swarm')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as SwarmAgentRecord[];
  }

  /** Get running swarm agents */
  async getRunningSwarmAgents(): Promise<SwarmAgentRecord[]> {
    const { data, error } = await this.client
      .from('agent_swarm')
      .select('*')
      .eq('status', 'running')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as SwarmAgentRecord[];
  }

  /** Save skill */
  async saveSkill(record: SkillRecord): Promise<void> {
    const { error } = await this.client.from('skills').upsert({
      id: record.id,
      user_id: record.user_id,
      name: record.name,
      description: record.description ?? null,
      language: record.language,
      source_code: record.source_code,
      compiled_code: record.compiled_code ?? null,
      status: record.status,
      version: record.version,
      approval_request_id: record.approval_request_id ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
      approved_at: record.approved_at ?? null,
      approved_by: record.approved_by ?? null,
    });
    if (error) throw error;
  }

  /** Get skill by ID */
  async getSkill(id: string): Promise<SkillRecord | null> {
    const { data, error } = await this.client.from('skills').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data as SkillRecord;
  }

  /** Get skill by name */
  async getSkillByName(name: string): Promise<SkillRecord | null> {
    const { data, error } = await this.client.from('skills').select('*').eq('name', name).single();
    if (error || !data) return null;
    return data as SkillRecord;
  }

  /** Get active skills */
  async getActiveSkills(): Promise<SkillRecord[]> {
    const { data, error } = await this.client
      .from('skills')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as SkillRecord[];
  }

  /** Save memory record */
  async saveMemoryRecord(record: MemoryRecord): Promise<void> {
    const { error } = await this.client.from('memory_records').upsert({
      id: record.id,
      user_id: record.user_id,
      type: record.type,
      content: record.content,
      embedding: record.embedding ?? null,
      importance: record.importance,
      access_count: record.access_count,
      last_accessed_at: record.last_accessed_at ?? null,
      expires_at: record.expires_at ?? null,
      metadata: record.metadata ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
    if (error) throw error;
  }

  /** Get memory record by ID */
  async getMemoryRecord(id: string): Promise<MemoryRecord | null> {
    const { data, error } = await this.client
      .from('memory_records')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data as MemoryRecord;
  }

  /** Search memory records by type */
  async getMemoryRecordsByType(userId: string, type: string, limit = 50): Promise<MemoryRecord[]> {
    const { data, error } = await this.client
      .from('memory_records')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('importance', { ascending: false })
      .order('last_accessed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as MemoryRecord[];
  }

  /** Get recent memories */
  async getRecentMemories(userId: string, limit = 20): Promise<MemoryRecord[]> {
    const { data, error } = await this.client
      .from('memory_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as MemoryRecord[];
  }

  /** Delete memory record */
  async deleteMemoryRecord(id: string): Promise<void> {
    const { error } = await this.client.from('memory_records').delete().eq('id', id);
    if (error) throw error;
  }

  /** Save cost budget */
  async saveCostBudget(record: CostBudgetRecord): Promise<void> {
    const { error } = await this.client.from('cost_budgets').upsert({
      id: record.id,
      user_id: record.user_id,
      period: record.period,
      limit_cents: record.limit_cents,
      spent_cents: record.spent_cents,
      period_start: record.period_start,
      period_end: record.period_end,
      notify_at_percent: record.notify_at_percent,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
    if (error) throw error;
  }

  /** Get current budget for user */
  async getCurrentBudget(userId: string): Promise<CostBudgetRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('cost_budgets')
      .select('*')
      .eq('user_id', userId)
      .lte('period_start', now)
      .gte('period_end', now)
      .single();
    if (error || !data) return null;
    return data as CostBudgetRecord;
  }

  /** Save rate limit */
  async saveRateLimit(record: RateLimitRecord): Promise<void> {
    const { error } = await this.client.from('rate_limits').upsert({
      id: record.id,
      user_id: record.user_id,
      resource: record.resource,
      max_requests: record.max_requests,
      window_seconds: record.window_seconds,
      current_count: record.current_count,
      window_start: record.window_start,
      created_at: record.created_at,
    });
    if (error) throw error;
  }

  /** Get rate limit */
  async getRateLimit(userId: string, resource: string): Promise<RateLimitRecord | null> {
    const { data, error } = await this.client
      .from('rate_limits')
      .select('*')
      .eq('user_id', userId)
      .eq('resource', resource)
      .single();
    if (error || !data) return null;
    return data as RateLimitRecord;
  }

  /** Increment rate limit counter */
  async incrementRateLimit(
    userId: string,
    resource: string
  ): Promise<{ allowed: boolean; remaining: number }> {
    const limit = await this.getRateLimit(userId, resource);
    if (!limit) return { allowed: true, remaining: 999 };

    const now = new Date();
    const windowStart = new Date(limit.window_start);
    const windowEnd = new Date(windowStart.getTime() + limit.window_seconds * 1000);

    if (now > windowEnd) {
      // Reset window
      await this.client
        .from('rate_limits')
        .update({ current_count: 1, window_start: now.toISOString() })
        .eq('user_id', userId)
        .eq('resource', resource);
      return { allowed: true, remaining: limit.max_requests - 1 };
    }

    if (limit.current_count >= limit.max_requests) {
      return { allowed: false, remaining: 0 };
    }

    await this.client
      .from('rate_limits')
      .update({ current_count: limit.current_count + 1 })
      .eq('user_id', userId)
      .eq('resource', resource);
    return {
      allowed: true,
      remaining: limit.max_requests - limit.current_count - 1,
    };
  }

  /** Save browser allowlist entry */
  async saveBrowserAllowlist(record: BrowserAllowlistRecord): Promise<void> {
    const { error } = await this.client.from('browser_allowlist').upsert({
      id: record.id,
      user_id: record.user_id,
      domain: record.domain,
      allowed_actions: record.allowed_actions,
      created_at: record.created_at,
    });
    if (error) throw error;
  }

  /** Get browser allowlist for user */
  async getBrowserAllowlist(userId: string): Promise<BrowserAllowlistRecord[]> {
    const { data, error } = await this.client
      .from('browser_allowlist')
      .select('*')
      .eq('user_id', userId)
      .order('domain', { ascending: true });
    if (error) throw error;
    return (data || []) as BrowserAllowlistRecord[];
  }

  /** Check if domain is allowed */
  async isDomainAllowed(userId: string, domain: string): Promise<BrowserAllowlistRecord | null> {
    const { data, error } = await this.client
      .from('browser_allowlist')
      .select('*')
      .eq('user_id', userId)
      .eq('domain', domain)
      .single();
    if (error || !data) return null;
    return data as BrowserAllowlistRecord;
  }

  /** Delete browser allowlist entry */
  async deleteBrowserAllowlist(userId: string, domain: string): Promise<void> {
    const { error } = await this.client
      .from('browser_allowlist')
      .delete()
      .eq('user_id', userId)
      .eq('domain', domain);
    if (error) throw error;
  }

  // ========== Slack Tokens ==========

  /** Save or update Slack token */
  async saveSlackToken(record: SlackTokenRecord): Promise<void> {
    const { error } = await this.client.from('slack_tokens').upsert({
      id: record.id,
      user_id: record.user_id,
      workspace_id: record.workspace_id,
      workspace_name: record.workspace_name ?? null,
      access_token_enc: record.access_token_enc,
      bot_user_id: record.bot_user_id ?? null,
      scope: record.scope ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
    if (error) throw error;
  }

  /** Get Slack token by user and workspace */
  async getSlackToken(userId: string, workspaceId: string): Promise<SlackTokenRecord | null> {
    const { data, error } = await this.client
      .from('slack_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();
    if (error || !data) return null;
    return data as SlackTokenRecord;
  }

  /** Get any Slack token for a workspace */
  async getSlackTokenByWorkspace(workspaceId: string): Promise<SlackTokenRecord | null> {
    const { data, error } = await this.client
      .from('slack_tokens')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return data as SlackTokenRecord;
  }

  /** Get all Slack tokens for a user */
  async getSlackTokensForUser(userId: string): Promise<SlackTokenRecord[]> {
    const { data, error } = await this.client
      .from('slack_tokens')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as SlackTokenRecord[];
  }

  /** Delete Slack token */
  async deleteSlackToken(userId: string, workspaceId: string): Promise<void> {
    const { error } = await this.client
      .from('slack_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId);
    if (error) throw error;
  }

  // ========== Conversation Memories ==========

  async getConversationMemory(
    platform: string,
    platformUserId: string
  ): Promise<ConversationMemoryRecord | null> {
    const { data, error } = await this.client
      .from('conversation_memories')
      .select('*')
      .eq('platform', platform)
      .eq('platform_user_id', platformUserId)
      .single();
    if (error || !data) return null;
    return data as ConversationMemoryRecord;
  }

  async saveConversationMemory(record: ConversationMemoryRecord): Promise<void> {
    const { error } = await this.client.from('conversation_memories').upsert(
      {
        id: record.id,
        platform: record.platform,
        platform_user_id: record.platform_user_id,
        user_id: record.user_id ?? null,
        messages: record.messages,
        summary: record.summary ?? null,
        updated_at: record.updated_at,
        created_at: record.created_at,
      },
      {
        onConflict: 'platform,platform_user_id',
      }
    );
    if (error) throw error;
  }

  // ========== Messaging Subscriptions ==========

  async getMessagingSubscriptions(userId: string): Promise<MessagingSubscriptionRecord[]> {
    const { data, error } = await this.client
      .from('messaging_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as MessagingSubscriptionRecord[];
  }

  async saveMessagingSubscription(record: MessagingSubscriptionRecord): Promise<void> {
    const { error } = await this.client.from('messaging_subscriptions').upsert(
      {
        id: record.id,
        user_id: record.user_id,
        platform: record.platform,
        platform_user_id: record.platform_user_id,
        created_at: record.created_at,
      },
      { onConflict: 'user_id,platform,platform_user_id' }
    );
    if (error) throw error;
  }

  async deleteMessagingSubscription(
    userId: string,
    platform: string,
    platformUserId: string
  ): Promise<void> {
    const { error } = await this.client
      .from('messaging_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('platform_user_id', platformUserId);
    if (error) throw error;
  }

  // ========== Slack User Pairings ==========

  async saveSlackUserPairing(record: SlackUserPairingRecord): Promise<void> {
    const { error } = await this.client.from('slack_user_pairings').upsert(
      {
        slack_user_id: record.slack_user_id,
        workspace_id: record.workspace_id,
        grump_user_id: record.grump_user_id,
        created_at: record.created_at,
      },
      { onConflict: 'slack_user_id,workspace_id' }
    );
    if (error) throw error;
  }

  async getGrumpUserIdFromSlack(slackUserId: string, workspaceId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('slack_user_pairings')
      .select('grump_user_id')
      .eq('slack_user_id', slackUserId)
      .eq('workspace_id', workspaceId)
      .single();
    if (error || !data) return null;
    return (data as { grump_user_id: string }).grump_user_id;
  }

  // ========== Reminders ==========

  async saveReminder(record: ReminderRecord): Promise<void> {
    const { error } = await this.client.from('reminders').upsert(
      {
        id: record.id,
        user_id: record.user_id,
        content: record.content,
        due_at: record.due_at,
        platform: record.platform ?? null,
        platform_user_id: record.platform_user_id ?? null,
        notified: record.notified ?? 0,
        created_at: record.created_at,
        updated_at: record.updated_at,
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  async getDueReminders(before: string): Promise<ReminderRecord[]> {
    const { data, error } = await this.client
      .from('reminders')
      .select('*')
      .lte('due_at', before)
      .eq('notified', 0)
      .order('due_at', { ascending: true });
    if (error) throw error;
    return (data || []) as ReminderRecord[];
  }

  async getRemindersForUser(userId: string): Promise<ReminderRecord[]> {
    const { data, error } = await this.client
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .order('due_at', { ascending: true });
    if (error) throw error;
    return (data || []) as ReminderRecord[];
  }

  async setReminderNotified(id: string): Promise<void> {
    const { error } = await this.client
      .from('reminders')
      .update({ notified: 1, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
}

/**
 * Supabase Database Service
 * Implements database operations using Supabase PostgreSQL
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import logger from '../middleware/logger.js';
import { recordDbOperation } from '../middleware/metrics.js';
import type { GenerationSession } from '../types/agents.js';
import type { ShipSession } from '../types/ship.js';
import type { Plan } from '../types/plan.js';
import type { SpecSession } from '../types/spec.js';
import type { AgentWorkReport } from '../types/agents.js';
import type { Settings } from '../types/settings.js';

export class SupabaseDatabaseService {
  private client: SupabaseClient;
  private initialized = false;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection by checking if we can query
    const { error } = await this.client.from('sessions').select('id').limit(1);
    
    if (error && error.code === '42P01') {
      // Table doesn't exist - user needs to run migrations
      logger.warn('Supabase tables not found. Please run the SQL schema in Supabase Dashboard.');
      logger.warn('See DEPLOY_VERCEL.md for setup instructions.');
    } else if (error) {
      logger.error({ error: error.message }, 'Supabase connection test failed');
      throw new Error(`Supabase connection failed: ${error.message}`);
    }

    this.initialized = true;
    logger.info('Supabase database initialized');
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit close
    this.initialized = false;
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

  async listSessions(options: {
    type?: 'generation' | 'ship' | 'spec' | 'plan';
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<GenerationSession[]> {
    let query = this.client.from('sessions').select('*');

    if (options.type) query = query.eq('type', options.type);
    if (options.status) query = query.eq('status', options.status);
    query = query.order('created_at', { ascending: false });
    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => row.data as GenerationSession);
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

  async listShipSessions(options: {
    phase?: string;
    status?: string;
    projectId?: string;
    limit?: number;
  } = {}): Promise<ShipSession[]> {
    let query = this.client.from('ship_sessions').select('*');

    if (options.phase) query = query.eq('phase', options.phase);
    if (options.status) query = query.eq('status', options.status);
    if (options.projectId != null) query = query.eq('project_id', options.projectId);
    query = query.order('created_at', { ascending: false });
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => row.data as ShipSession);
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
    const { data, error } = await this.client
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

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
    return data.map((row) => row.data as Plan);
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
    const { data, error } = await this.client
      .from('specs')
      .select('*')
      .eq('id', specId)
      .single();

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
    return data.map((row) => row.report as AgentWorkReport);
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
}

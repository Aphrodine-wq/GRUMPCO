/**
 * Supabase Database Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SupabaseDatabaseService } from '../../src/db/supabase-db.js';
import type { GenerationSession, AgentType, AgentTask, AgentWorkReport } from '../../src/types/agents.js';
import type { ShipSession } from '../../src/types/ship.js';
import type { Plan, Phase } from '../../src/types/plan.js';
import type { SpecSession } from '../../src/types/spec.js';
import type { Settings } from '../../src/types/settings.js';

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('../../src/middleware/metrics.js', () => ({
  recordDbOperation: vi.fn(),
}));

// Helper to create mock query builder
function createMockQueryBuilder(options: {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
} = {}) {
  const { data = null, error = null } = options;
  
  // Create a thenable builder that supports chaining AND promise resolution
  const createThenableBuilder = (): Record<string, unknown> => {
    const builder: Record<string, unknown> = {};
    
    const chainMethods = ['select', 'eq', 'gte', 'lte', 'order', 'range', 'neq', 'gt', 'lt', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'match', 'not', 'or', 'filter'];
    const terminalMethods = ['single', 'limit', 'maybeSingle'];
    
    // All chain methods return the same thenable builder
    for (const method of chainMethods) {
      builder[method] = vi.fn().mockReturnValue(builder);
    }
    
    // Terminal methods resolve the promise
    for (const method of terminalMethods) {
      builder[method] = vi.fn().mockResolvedValue({ data, error });
    }
    
    // Make the builder itself thenable (for await without terminal method)
    builder.then = (
      resolve: (value: { data: unknown; error: unknown }) => void,
      reject?: (reason: unknown) => void
    ) => {
      return Promise.resolve({ data, error }).then(resolve, reject);
    };
    
    return builder;
  };
  
  const builder = createThenableBuilder();
  
  // insert, upsert, update resolve directly
  builder.insert = vi.fn().mockResolvedValue({ data, error });
  builder.upsert = vi.fn().mockResolvedValue({ data, error });
  builder.update = vi.fn().mockResolvedValue({ data, error });
  
  // delete needs to chain to eq
  builder.delete = vi.fn().mockImplementation(() => {
    const deleteBuilder = createThenableBuilder();
    deleteBuilder.eq = vi.fn().mockResolvedValue({ data, error });
    return deleteBuilder;
  });
  
  return builder;
}

let mockSupabaseClient: {
  from: ReturnType<typeof vi.fn>;
};

// Helper to create valid GenerationSession
function createMockGenerationSession(overrides: Partial<GenerationSession> = {}): GenerationSession {
  const agentTypes: AgentType[] = ['architect', 'frontend', 'backend', 'devops', 'test', 'docs', 'security', 'i18n', 'wrunner'];
  const agents: Record<AgentType, AgentTask> = {} as Record<AgentType, AgentTask>;
  
  for (const type of agentTypes) {
    agents[type] = {
      taskId: `task-${type}`,
      agentType: type,
      description: `${type} task`,
      status: 'pending',
      input: {},
    };
  }
  
  return {
    sessionId: 'test-session-1',
    status: 'initializing',
    prdId: 'prd-1',
    architectureId: 'arch-1',
    createdAt: new Date().toISOString(),
    agents,
    preferences: {},
    ...overrides,
  };
}

// Helper to create valid ShipSession
function createMockShipSession(overrides: Partial<ShipSession> = {}): ShipSession {
  return {
    id: 'ship-1',
    projectDescription: 'Test project',
    phase: 'design',
    status: 'initializing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create valid Plan
function createMockPlan(overrides: Partial<Plan> = {}): Plan {
  const phases: Phase[] = [
    { id: 'exploration', name: 'Exploration', description: '', steps: [], checkpoint: false, status: 'pending' },
    { id: 'preparation', name: 'Preparation', description: '', steps: [], checkpoint: false, status: 'pending' },
    { id: 'implementation', name: 'Implementation', description: '', steps: [], checkpoint: false, status: 'pending' },
    { id: 'validation', name: 'Validation', description: '', steps: [], checkpoint: false, status: 'pending' },
  ];
  
  return {
    id: 'plan-1',
    title: 'Test Plan',
    description: 'Test description',
    status: 'draft',
    steps: [],
    phases,
    totalEstimatedTime: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create valid SpecSession
function createMockSpecSession(overrides: Partial<SpecSession> = {}): SpecSession {
  return {
    id: 'spec-1',
    status: 'collecting',
    originalRequest: 'Test request',
    questions: [],
    answers: {},
    specification: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create valid AgentWorkReport
function createMockWorkReport(overrides: Partial<AgentWorkReport> = {}): AgentWorkReport {
  return {
    sessionId: 'session-1',
    agentType: 'frontend',
    taskId: 'task-1',
    report: {
      summary: 'Test report',
      filesGenerated: [],
      architectureDecisions: [],
      codeQualityMetrics: { issues: [] },
      integrationPoints: [],
      testingStrategy: 'unit tests',
      knownIssues: [],
      recommendations: [],
    },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SupabaseDatabaseService', () => {
  let service: SupabaseDatabaseService;
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>;

  beforeEach(() => {
    mockQueryBuilder = createMockQueryBuilder();
    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };
    service = new SupabaseDatabaseService('https://test.supabase.co', 'test-key');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully when connection works', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.initialize();
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sessions');
    });

    it('should not reinitialize if already initialized', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.initialize();
      await service.initialize();
      
      // Should only call from once
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
    });

    it('should warn if tables do not exist (42P01 error)', async () => {
      mockQueryBuilder = createMockQueryBuilder({ 
        data: null, 
        error: { code: '42P01', message: 'Table not found' } 
      });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.initialize();
      // Should not throw, just warn
    });

    it('should throw on other connection errors', async () => {
      mockQueryBuilder = createMockQueryBuilder({ 
        data: null, 
        error: { code: 'OTHER', message: 'Connection refused' } 
      });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await expect(service.initialize()).rejects.toThrow('Supabase connection failed');
    });

    it('should throw when SUPABASE_URL is dashboard URL (not project API URL)', async () => {
      const dashboardService = new SupabaseDatabaseService(
        'https://supabase.com/dashboard/project/abc123',
        'test-key'
      );
      await expect(dashboardService.initialize()).rejects.toThrow('Invalid SUPABASE_URL');
      await expect(dashboardService.initialize()).rejects.toThrow('project API URL');
    });

    it('should throw clear error when server returns HTML (wrong URL)', async () => {
      const htmlErrorService = new SupabaseDatabaseService('https://test.supabase.co', 'test-key');
      mockQueryBuilder = createMockQueryBuilder({
        data: null,
        error: {
          code: 'PGRST301',
          message: '<!DOCTYPE html><html><title>Supabase</title><body>404</body></html>',
        },
      });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await expect(htmlErrorService.initialize()).rejects.toThrow(
        'the server returned a web page instead of the API'
      );
      await expect(htmlErrorService.initialize()).rejects.toThrow('Project Settings → API');
    });
  });

  describe('close', () => {
    it('should mark service as not initialized', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
      
      await service.initialize();
      await service.close();
      
      // After close, initialize should be callable again
      await service.initialize();
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDb', () => {
    it('should throw error since direct DB access is not supported', () => {
      expect(() => service.getDb()).toThrow('Direct database access not supported in Supabase mode');
    });
  });

  describe('Sessions', () => {
    it('should save a session', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
      const mockSession = createMockGenerationSession();

      await service.saveSession(mockSession);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sessions');
      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
    });

    it('should throw on save error', async () => {
      mockQueryBuilder = createMockQueryBuilder({ 
        data: null, 
        error: { message: 'Insert failed' } 
      });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
      const mockSession = createMockGenerationSession();

      await expect(service.saveSession(mockSession)).rejects.toBeDefined();
    });

    it('should get a session by ID', async () => {
      const mockSession = createMockGenerationSession();
      const returnData = { data: mockSession };
      mockQueryBuilder = createMockQueryBuilder({ data: returnData, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.getSession('test-session-1');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sessions');
    });

    it('should return null for non-existent session', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: { message: 'Not found' } });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getSession('non-existent');
      expect(result).toBeNull();
    });

    it('should list sessions with options', async () => {
      const mockSession = createMockGenerationSession();
      const sessions = [
        { data: mockSession },
        { data: { ...mockSession, sessionId: 'test-2' } },
      ];
      mockQueryBuilder = createMockQueryBuilder({ data: sessions, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.listSessions({ status: 'running', limit: 10 });
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sessions');
    });

    it('should return empty array on list error', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: { message: 'Query failed' } });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.listSessions();
      expect(result).toEqual([]);
    });

    it('should delete a session', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.deleteSession('test-session-1');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sessions');
    });

    it('should throw on delete error', async () => {
      const deleteBuilder = {
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Delete failed' } }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue(deleteBuilder),
      });

      await expect(service.deleteSession('test-session-1')).rejects.toBeDefined();
    });
  });

  describe('Ship Sessions', () => {
    it('should save a ship session', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
      const mockShipSession = createMockShipSession();

      await service.saveShipSession(mockShipSession);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('ship_sessions');
      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
    });

    it('should get a ship session by ID', async () => {
      const mockShipSession = createMockShipSession();
      const returnData = { data: mockShipSession };
      mockQueryBuilder = createMockQueryBuilder({ data: returnData, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.getShipSession('ship-1');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('ship_sessions');
    });

    it('should return null for non-existent ship session', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: { message: 'Not found' } });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getShipSession('non-existent');
      expect(result).toBeNull();
    });

    it('should list ship sessions with filters', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.listShipSessions({ phase: 'design', status: 'running', limit: 5 });
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('ship_sessions');
    });
  });

  describe('Plans', () => {
    it('should save a plan', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
      const mockPlan = createMockPlan();

      await service.savePlan(mockPlan);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('plans');
      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
    });

    it('should get a plan by ID', async () => {
      const mockPlan = createMockPlan();
      const returnData = { data: mockPlan };
      mockQueryBuilder = createMockQueryBuilder({ data: returnData, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.getPlan('plan-1');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('plans');
    });

    it('should list plans with status filter', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.listPlans({ status: 'draft', limit: 10 });
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('plans');
    });
  });

  describe('Specs', () => {
    it('should save a spec', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
      const mockSpec = createMockSpecSession();

      await service.saveSpec(mockSpec);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('specs');
    });

    it('should save a spec session (alias)', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
      const mockSpec = createMockSpecSession();

      await service.saveSpecSession(mockSpec);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('specs');
    });

    it('should get a spec by ID', async () => {
      const mockSpec = createMockSpecSession();
      const returnData = { data: mockSpec };
      mockQueryBuilder = createMockQueryBuilder({ data: returnData, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.getSpec('spec-1');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('specs');
    });

    it('should get a spec session (alias)', async () => {
      const mockSpec = createMockSpecSession();
      const returnData = { data: mockSpec };
      mockQueryBuilder = createMockQueryBuilder({ data: returnData, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.getSpecSession('spec-1');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('specs');
    });
  });

  describe('Work Reports', () => {
    it('should save a work report', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
      const mockReport = createMockWorkReport();

      await service.saveWorkReport(mockReport);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('work_reports');
    });

    it('should get work reports for a session', async () => {
      const mockReport = createMockWorkReport();
      mockQueryBuilder = createMockQueryBuilder({ data: [{ report: mockReport }], error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.getWorkReports('session-1');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('work_reports');
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: { message: 'Query failed' } });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getWorkReports('session-1');
      expect(result).toEqual([]);
    });
  });

  describe('Settings', () => {
    const mockSettings: Settings = {
      user: { displayName: 'Test User' },
      models: { defaultProvider: 'nim' },
    };

    it('should get settings for a user', async () => {
      const returnData = { data: mockSettings };
      mockQueryBuilder = createMockQueryBuilder({ data: returnData, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.getSettings('user-1');
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('settings');
    });

    it('should return null for non-existent settings', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: { message: 'Not found' } });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getSettings('non-existent');
      expect(result).toBeNull();
    });

    it('should save settings', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.saveSettings('user-1', mockSettings);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('settings');
      expect(mockQueryBuilder.upsert).toHaveBeenCalled();
    });
  });

  describe('Usage Records', () => {
    const mockUsageRecord = {
      id: 'usage-1',
      userId: 'user-1',
      endpoint: '/api/chat',
      method: 'POST',
      model: 'test-model',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 500,
      success: true,
    };

    it('should save a usage record', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      await service.saveUsageRecord(mockUsageRecord);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('usage_records');
    });

    it('should throw on save error', async () => {
      const insertBuilder = vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        insert: insertBuilder,
      });

      await expect(service.saveUsageRecord(mockUsageRecord)).rejects.toBeDefined();
    });

    it('should get usage for user within date range', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');
      const result = await service.getUsageForUser('user-1', fromDate, toDate);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('usage_records');
      expect(result).toEqual([]);
    });

    it('should get usage summary', async () => {
      const mockData = [
        { success: 1, input_tokens: 100, output_tokens: 50, latency_ms: 500 },
        { success: 1, input_tokens: 200, output_tokens: 100, latency_ms: 600 },
        { success: 0, input_tokens: 50, output_tokens: 0, latency_ms: 100 },
      ];
      mockQueryBuilder = createMockQueryBuilder({ data: mockData, error: null });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getUsageSummary('user-1');
      
      expect(result.totalRequests).toBe(3);
      expect(result.successfulRequests).toBe(2);
      expect(result.failedRequests).toBe(1);
      expect(result.monthlyInputTokens).toBe(350);
      expect(result.monthlyOutputTokens).toBe(150);
      expect(result.avgLatencyMs).toBe(550);
    });

    it('should return zeros for empty usage summary', async () => {
      mockQueryBuilder = createMockQueryBuilder({ data: null, error: { message: 'No data' } });
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

      const result = await service.getUsageSummary('user-1');
      
      expect(result.totalRequests).toBe(0);
      expect(result.successfulRequests).toBe(0);
      expect(result.avgLatencyMs).toBe(0);
    });
  });

  describe('Integrations Platform', () => {
    describe('Audit Logs', () => {
      it('should save audit log', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveAuditLog({
          id: 'audit-1',
          user_id: 'user-1',
          action: 'create',
          category: 'integration',
          created_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('audit_logs');
      });

      it('should get audit logs with filters', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getAuditLogs({ userId: 'user-1', category: 'integration', limit: 10 });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('audit_logs');
      });
    });

    describe('Integrations', () => {
      it('should save integration', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveIntegration({
          id: 'int-1',
          user_id: 'user-1',
          provider: 'github',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('integrations');
      });

      it('should get integration by ID', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'int-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getIntegration('int-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('integrations');
      });

      it('should get integrations for user', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getIntegrationsForUser('user-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('integrations');
      });

      it('should get integration by provider', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'int-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getIntegrationByProvider('user-1', 'github');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('integrations');
      });

      it('should delete integration', async () => {
        const deleteBuilder = {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue(deleteBuilder),
        });

        await service.deleteIntegration('int-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('integrations');
      });
    });

    describe('OAuth Tokens', () => {
      it('should save OAuth token', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveOAuthToken({
          id: 'token-1',
          user_id: 'user-1',
          provider: 'github',
          access_token_enc: 'encrypted-token',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_tokens');
      });

      it('should get OAuth token', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'token-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getOAuthToken('user-1', 'github');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_tokens');
      });

      it('should delete OAuth token', async () => {
        const deleteBuilder = {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue(deleteBuilder),
        });

        await service.deleteOAuthToken('user-1', 'github');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('oauth_tokens');
      });
    });

    describe('Integration Secrets', () => {
      it('should save integration secret', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveIntegrationSecret({
          id: 'secret-1',
          user_id: 'user-1',
          provider: 'github',
          name: 'api_key',
          secret_enc: 'encrypted-secret',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('integration_secrets');
      });

      it('should get integration secret', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'secret-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getIntegrationSecret('user-1', 'github', 'api_key');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('integration_secrets');
      });

      it('should delete integration secret', async () => {
        const deleteBuilder = {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue(deleteBuilder),
        });

        await service.deleteIntegrationSecret('user-1', 'github', 'api_key');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('integration_secrets');
      });
    });

    describe('Heartbeats', () => {
      it('should save heartbeat', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveHeartbeat({
          id: 'hb-1',
          user_id: 'user-1',
          name: 'test-heartbeat',
          cron_expression: '*/5 * * * *',
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('heartbeats');
      });

      it('should get heartbeat by ID', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'hb-1', enabled: 1 }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getHeartbeat('hb-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('heartbeats');
      });

      it('should get enabled heartbeats', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [{ id: 'hb-1', enabled: 1 }], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getEnabledHeartbeats();
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('heartbeats');
      });

      it('should get heartbeats for user', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getHeartbeatsForUser('user-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('heartbeats');
      });

      it('should delete heartbeat', async () => {
        const deleteBuilder = {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue(deleteBuilder),
        });

        await service.deleteHeartbeat('hb-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('heartbeats');
      });
    });

    describe('Approval Requests', () => {
      it('should save approval request', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveApprovalRequest({
          id: 'approval-1',
          user_id: 'user-1',
          status: 'pending',
          action: 'deploy',
          risk_level: 'high',
          created_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('approval_requests');
      });

      it('should get approval request by ID', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'approval-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getApprovalRequest('approval-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('approval_requests');
      });

      it('should get pending approvals for user', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getPendingApprovals('user-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('approval_requests');
      });
    });

    describe('Swarm Agents', () => {
      it('should save swarm agent', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveSwarmAgent({
          id: 'agent-1',
          user_id: 'user-1',
          name: 'test-agent',
          status: 'running',
          agent_type: 'worker',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('agent_swarm');
      });

      it('should get swarm agent by ID', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'agent-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getSwarmAgent('agent-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('agent_swarm');
      });

      it('should get swarm children', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getSwarmChildren('parent-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('agent_swarm');
      });

      it('should get running swarm agents', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getRunningSwarmAgents();
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('agent_swarm');
      });
    });

    describe('Skills', () => {
      it('should save skill', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveSkill({
          id: 'skill-1',
          user_id: 'user-1',
          name: 'test-skill',
          language: 'typescript',
          source_code: 'console.log("hello")',
          status: 'active',
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('skills');
      });

      it('should get skill by ID', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'skill-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getSkill('skill-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('skills');
      });

      it('should get skill by name', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { name: 'test-skill' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getSkillByName('test-skill');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('skills');
      });

      it('should get active skills', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getActiveSkills();
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('skills');
      });
    });

    describe('Memory Records', () => {
      it('should save memory record', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveMemoryRecord({
          id: 'memory-1',
          user_id: 'user-1',
          type: 'conversation',
          content: 'test content',
          importance: 5,
          access_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('memory_records');
      });

      it('should get memory record by ID', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'memory-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getMemoryRecord('memory-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('memory_records');
      });

      it('should get memory records by type', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getMemoryRecordsByType('user-1', 'conversation', 20);
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('memory_records');
      });

      it('should get recent memories', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getRecentMemories('user-1', 10);
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('memory_records');
      });

      it('should delete memory record', async () => {
        const deleteBuilder = {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue(deleteBuilder),
        });

        await service.deleteMemoryRecord('memory-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('memory_records');
      });
    });

    describe('Cost Budgets', () => {
      it('should save cost budget', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveCostBudget({
          id: 'budget-1',
          user_id: 'user-1',
          period: 'monthly',
          limit_cents: 10000,
          spent_cents: 500,
          period_start: new Date().toISOString(),
          period_end: new Date().toISOString(),
          notify_at_percent: 80,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('cost_budgets');
      });

      it('should get current budget for user', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'budget-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getCurrentBudget('user-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('cost_budgets');
      });
    });

    describe('Rate Limits', () => {
      it('should save rate limit', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveRateLimit({
          id: 'limit-1',
          user_id: 'user-1',
          resource: 'api',
          max_requests: 100,
          window_seconds: 3600,
          current_count: 0,
          window_start: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('rate_limits');
      });

      it('should get rate limit', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { id: 'limit-1' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getRateLimit('user-1', 'api');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('rate_limits');
      });

      it('should allow request when no rate limit exists', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: { message: 'Not found' } });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        const result = await service.incrementRateLimit('user-1', 'api');
        
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(999);
      });

      it('should deny request when rate limit exceeded', async () => {
        const rateLimit = {
          max_requests: 10,
          current_count: 10,
          window_seconds: 3600,
          window_start: new Date().toISOString(),
        };
        mockQueryBuilder = createMockQueryBuilder({ data: rateLimit, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        const result = await service.incrementRateLimit('user-1', 'api');
        
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });
    });

    describe('Browser Allowlist', () => {
      it('should save browser allowlist entry', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: null, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.saveBrowserAllowlist({
          id: 'allow-1',
          user_id: 'user-1',
          domain: 'example.com',
          allowed_actions: 'read',
          created_at: new Date().toISOString(),
        });
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('browser_allowlist');
      });

      it('should get browser allowlist for user', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: [], error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.getBrowserAllowlist('user-1');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('browser_allowlist');
      });

      it('should check if domain is allowed', async () => {
        mockQueryBuilder = createMockQueryBuilder({ data: { domain: 'example.com' }, error: null });
        mockSupabaseClient.from = vi.fn().mockReturnValue(mockQueryBuilder);

        await service.isDomainAllowed('user-1', 'example.com');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('browser_allowlist');
      });

      it('should delete browser allowlist entry', async () => {
        const deleteBuilder = {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue(deleteBuilder),
        });

        await service.deleteBrowserAllowlist('user-1', 'example.com');
        
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('browser_allowlist');
      });
    });
  });
});

/**
 * Agent Budget Store Tests
 *
 * Tests for budget tracking, cost estimation, and approval handling
 */

import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock lucide-svelte - SVG parsing fails in jsdom
vi.mock('lucide-svelte', () => {
  const MockIcon = () => null;
  return new Proxy({} as Record<string, unknown>, {
    get: () => MockIcon,
  });
});

// Mock fetch and fetchApi
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
  getApiBase: vi.fn(() => 'http://localhost:3000'),
}));

// Dynamic import in beforeAll - mocks are hoisted
let gAgentBudgetStore: typeof import('./gAgentBudgetStore').gAgentBudgetStore;
let budgetStatus: typeof import('./gAgentBudgetStore').budgetStatus;
let isWarning: typeof import('./gAgentBudgetStore').isWarning;
let isExceeded: typeof import('./gAgentBudgetStore').isExceeded;
let canProceed: typeof import('./gAgentBudgetStore').canProceed;
let pendingApprovalCount: typeof import('./gAgentBudgetStore').pendingApprovalCount;
let formatCost: typeof import('./gAgentBudgetStore').formatCost;
let getStatusColor: typeof import('./gAgentBudgetStore').getStatusColor;
let getStatusIcon: typeof import('./gAgentBudgetStore').getStatusIcon;
let fetchApi: typeof import('../lib/api.js').fetchApi;

describe('gAgentBudgetStore', () => {
  beforeAll(async () => {
    const storeMod = await import('./gAgentBudgetStore');
    const apiMod = await import('../lib/api.js');
    gAgentBudgetStore = storeMod.gAgentBudgetStore;
    budgetStatus = storeMod.budgetStatus;
    isWarning = storeMod.isWarning;
    isExceeded = storeMod.isExceeded;
    canProceed = storeMod.canProceed;
    pendingApprovalCount = storeMod.pendingApprovalCount;
    formatCost = storeMod.formatCost;
    getStatusColor = storeMod.getStatusColor;
    getStatusIcon = storeMod.getStatusIcon;
    fetchApi = apiMod.fetchApi;
  });
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    gAgentBudgetStore.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockBudgetStatus = (overrides = {}) => ({
    sessionUsed: 50,
    sessionRemaining: 950,
    sessionPercent: 5,
    dailyUsed: 200,
    dailyRemaining: 800,
    dailyPercent: 20,
    monthlyUsed: 1000,
    monthlyRemaining: 9000,
    monthlyPercent: 10,
    status: 'ok' as const,
    canProceed: true,
    message: undefined,
    ...overrides,
  });

  const createMockBudgetConfig = (overrides = {}) => ({
    sessionLimit: 1000,
    dailyLimit: 1000,
    monthlyLimit: 10000,
    warningThreshold: 0.7,
    criticalThreshold: 0.9,
    hardStop: true,
    autoApproveUnder: 10,
    requireApprovalOver: 100,
    ...overrides,
  });

  const createMockCostEstimate = (overrides = {}) => ({
    estimatedTokensIn: 1000,
    estimatedTokensOut: 500,
    estimatedCost: 15,
    estimatedDurationMs: 2000,
    confidence: 0.85,
    breakdown: [
      {
        operation: 'llm_call',
        tokensIn: 1000,
        tokensOut: 500,
        cost: 15,
        model: 'claude-3.5-sonnet',
      },
    ],
    requiresApproval: false,
    reason: undefined,
    ...overrides,
  });

  const createMockApprovalRequest = (overrides = {}) => ({
    id: 'approval-123',
    sessionId: 'session-456',
    userId: 'user-789',
    operation: 'large_generation',
    estimatedCost: 150,
    currentSpent: 800,
    budgetRemaining: 200,
    reason: 'Cost exceeds auto-approval threshold',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    status: 'pending' as const,
    ...overrides,
  });

  describe('initial state', () => {
    it('should have null status initially', () => {
      const state = gAgentBudgetStore.getState();
      expect(state.status).toBeNull();
    });

    it('should have null config initially', () => {
      const state = gAgentBudgetStore.getState();
      expect(state.config).toBeNull();
    });

    it('should have zero costs initially', () => {
      const state = gAgentBudgetStore.getState();
      expect(state.sessionCost).toBe(0);
      expect(state.dailyCost).toBe(0);
      expect(state.monthlyCost).toBe(0);
    });

    it('should have empty pending approvals initially', () => {
      const state = gAgentBudgetStore.getState();
      expect(state.pendingApprovals).toEqual([]);
    });

    it('should not be loading initially', () => {
      const state = gAgentBudgetStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('derived stores', () => {
    it('budgetStatus should reflect store state', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: createMockBudgetStatus() }),
      });

      await gAgentBudgetStore.fetchStatus();
      expect(get(budgetStatus)?.status).toBe('ok');
    });

    it('isWarning should be true when status is warning', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: createMockBudgetStatus({ status: 'warning' }) }),
      });

      await gAgentBudgetStore.fetchStatus();
      expect(get(isWarning)).toBe(true);
    });

    it('isExceeded should be true when status is exceeded', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: createMockBudgetStatus({ status: 'exceeded' }) }),
      });

      await gAgentBudgetStore.fetchStatus();
      expect(get(isExceeded)).toBe(true);
    });

    it('canProceed should reflect budget status', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: createMockBudgetStatus({ canProceed: false }) }),
      });

      await gAgentBudgetStore.fetchStatus();
      expect(get(canProceed)).toBe(false);
    });

    it('pendingApprovalCount should count pending approvals', async () => {
      gAgentBudgetStore.handleBudgetEvent({
        type: 'approval_required',
        data: { request: createMockApprovalRequest() },
      });

      gAgentBudgetStore.handleBudgetEvent({
        type: 'approval_required',
        data: { request: createMockApprovalRequest({ id: 'approval-456' }) },
      });

      expect(get(pendingApprovalCount)).toBe(2);
    });
  });

  describe('fetchStatus', () => {
    it('should fetch and store budget status', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockStatus = createMockBudgetStatus();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: mockStatus }),
      });

      const result = await gAgentBudgetStore.fetchStatus('test-session');

      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/budget/status?sessionId=test-session');
      expect(result).toEqual(mockStatus);
      expect(gAgentBudgetStore.getState().sessionCost).toBe(50);
    });

    it('should handle fetch error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await gAgentBudgetStore.fetchStatus();

      expect(result).toBeNull();
      expect(gAgentBudgetStore.getState().error).toBe('Failed to fetch budget status: 500');
    });
  });

  describe('fetchConfig', () => {
    it('should fetch and store budget config', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockConfig = createMockBudgetConfig();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ config: { budget: mockConfig } }),
      });

      const result = await gAgentBudgetStore.fetchConfig('test-session');

      expect(result).toEqual(mockConfig);
      expect(gAgentBudgetStore.getState().config).toEqual(mockConfig);
    });
  });

  describe('updateConfig', () => {
    it('should update budget config', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const updatedConfig = createMockBudgetConfig({ sessionLimit: 2000 });
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ budgetConfig: updatedConfig }),
      });

      const result = await gAgentBudgetStore.updateConfig({ sessionLimit: 2000 });

      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/config/budget?sessionId=default', {
        method: 'PUT',
        body: JSON.stringify({ sessionLimit: 2000 }),
      });
      expect(result?.sessionLimit).toBe(2000);
    });

    it('should handle update error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid config' }),
      });

      const result = await gAgentBudgetStore.updateConfig({ sessionLimit: -1 });

      expect(result).toBeNull();
      expect(gAgentBudgetStore.getState().error).toBe('Invalid config');
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for operations', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      const mockEstimate = createMockCostEstimate();
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ estimate: mockEstimate }),
      });

      const operations = [
        { type: 'llm_call' as const, estimatedInputTokens: 1000, estimatedOutputTokens: 500 },
      ];

      const result = await gAgentBudgetStore.estimateCost(operations);

      expect(result).toEqual(mockEstimate);
      expect(gAgentBudgetStore.getState().lastEstimate).toEqual(mockEstimate);
    });

    it('should handle estimation error', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await gAgentBudgetStore.estimateCost([]);

      expect(result).toBeNull();
      expect(gAgentBudgetStore.getState().error).toBe('Cost estimation failed: 500');
    });
  });

  describe('quickEstimate', () => {
    it('should calculate quick estimate for claude-3.5-sonnet', async () => {
      const result = gAgentBudgetStore.quickEstimate(1000, 500, 'claude-3.5-sonnet');

      // 1000 * 300 / 1M + 500 * 1500 / 1M = 0.3 + 0.75 = 1.05 cents
      expect(result.cost).toBe(2); // Rounded up
      expect(result.formatted).toBe('2\u00a2');
    });

    it('should calculate quick estimate for gpt-4o-mini', async () => {
      const result = gAgentBudgetStore.quickEstimate(10000, 5000, 'gpt-4o-mini');

      // 10000 * 15 / 1M + 5000 * 60 / 1M = 0.15 + 0.30 = 0.45 cents
      expect(result.cost).toBe(1); // Rounded up
      expect(result.formatted).toBe('1\u00a2');
    });

    it('should format dollars for amounts >= 100 cents', async () => {
      const result = gAgentBudgetStore.quickEstimate(1000000, 500000, 'claude-3-opus');

      expect(result.formatted).toMatch(/^\$/);
    });
  });

  describe('canAfford', () => {
    it('should check if operation is affordable', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ allowed: true }),
      });

      const result = await gAgentBudgetStore.canAfford(50);

      expect(result.allowed).toBe(true);
    });

    it('should return reason when not affordable', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ allowed: false, reason: 'Budget exceeded' }),
      });

      const result = await gAgentBudgetStore.canAfford(1000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Budget exceeded');
    });

    it('should handle check failure', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockRejectedValue(new Error('Network error'));

      const result = await gAgentBudgetStore.canAfford(50);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Budget check failed');
    });
  });

  describe('session management', () => {
    it('should start session', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({ ok: true });

      const result = await gAgentBudgetStore.startSession('test-session');

      expect(result).toBe(true);
      expect(mockFetchApi).toHaveBeenCalledWith('/api/gagent/budget/session/start', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test-session' }),
      });
    });

    it('should end session and return summary', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            summary: { totalCost: '$1.50', totalTokens: 50000, operationCount: 25 },
          }),
      });

      const result = await gAgentBudgetStore.endSession('test-session');

      expect(result?.totalCost).toBe('$1.50');
      expect(result?.totalTokens).toBe(50000);
    });
  });

  describe('handleBudgetEvent', () => {
    it('should handle cost_recorded event', async () => {
      const operation = {
        id: 'op-123',
        type: 'llm_call' as const,
        description: 'Chat completion',
        tokensIn: 1000,
        tokensOut: 500,
        cost: 15,
        model: 'claude-3.5-sonnet',
        timestamp: new Date().toISOString(),
        durationMs: 2000,
      };

      gAgentBudgetStore.handleBudgetEvent({
        type: 'cost_recorded',
        data: { operation, total: 65 },
      });

      const state = gAgentBudgetStore.getState();
      expect(state.sessionCost).toBe(65);
      expect(state.recentOperations[0]).toEqual(operation);
    });

    it('should handle budget_warning event', async () => {
      const status = createMockBudgetStatus({ status: 'warning' });
      gAgentBudgetStore.handleBudgetEvent({
        type: 'budget_warning',
        data: { status, message: 'Approaching budget limit' },
      });

      const state = gAgentBudgetStore.getState();
      expect(state.status?.status).toBe('warning');
      expect(state.showWarning).toBe(true);
      expect(state.warningMessage).toBe('Approaching budget limit');
    });

    it('should handle budget_critical event', async () => {
      const status = createMockBudgetStatus({ status: 'critical' });
      gAgentBudgetStore.handleBudgetEvent({
        type: 'budget_critical',
        data: { status, message: 'Budget nearly exhausted' },
      });

      const state = gAgentBudgetStore.getState();
      expect(state.status?.status).toBe('critical');
      expect(state.showWarning).toBe(true);
    });

    it('should handle approval_required event', async () => {
      const request = createMockApprovalRequest();
      gAgentBudgetStore.handleBudgetEvent({
        type: 'approval_required',
        data: { request },
      });

      const state = gAgentBudgetStore.getState();
      expect(state.pendingApprovals).toHaveLength(1);
      expect(state.pendingApprovals[0].id).toBe('approval-123');
    });
  });

  describe('approveRequest', () => {
    it('should approve pending request', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // Add pending request
      gAgentBudgetStore.handleBudgetEvent({
        type: 'approval_required',
        data: { request: createMockApprovalRequest() },
      });

      mockFetchApi.mockResolvedValue({ ok: true });

      const result = await gAgentBudgetStore.approveRequest('approval-123');

      expect(result).toBe(true);
      const state = gAgentBudgetStore.getState();
      expect(state.pendingApprovals[0].status).toBe('approved');
    });

    it('should handle approve failure', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      mockFetchApi.mockResolvedValue({ ok: false });

      const result = await gAgentBudgetStore.approveRequest('invalid');

      expect(result).toBe(false);
    });
  });

  describe('denyRequest', () => {
    it('should deny pending request', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // Add pending request
      gAgentBudgetStore.handleBudgetEvent({
        type: 'approval_required',
        data: { request: createMockApprovalRequest() },
      });

      mockFetchApi.mockResolvedValue({ ok: true });

      const result = await gAgentBudgetStore.denyRequest('approval-123');

      expect(result).toBe(true);
      const state = gAgentBudgetStore.getState();
      expect(state.pendingApprovals[0].status).toBe('denied');
    });
  });

  describe('helper functions', () => {
    it('formatCost should format cents correctly', () => {
      expect(formatCost(5)).toBe('5\u00a2');
      expect(formatCost(50)).toBe('50\u00a2');
      expect(formatCost(99)).toBe('99\u00a2');
      expect(formatCost(100)).toBe('$1.00');
      expect(formatCost(150)).toBe('$1.50');
      expect(formatCost(1000)).toBe('$10.00');
    });

    it('getStatusColor should return correct colors', () => {
      expect(getStatusColor('ok')).toBe('text-green-500');
      expect(getStatusColor('warning')).toBe('text-yellow-500');
      expect(getStatusColor('critical')).toBe('text-orange-500');
      expect(getStatusColor('exceeded')).toBe('text-red-500');
    });

    it('getStatusIcon should return correct icons', () => {
      // Stores return ComponentType (Svelte components), not emoji strings
      expect(typeof getStatusIcon('ok')).toBe('function');
      expect(getStatusIcon('ok')).toBeDefined();
      expect(typeof getStatusIcon('warning')).toBe('function');
      expect(typeof getStatusIcon('critical')).toBe('function');
      expect(typeof getStatusIcon('exceeded')).toBe('function');
    });
  });

  describe('dismissWarning', () => {
    it('should dismiss warning', async () => {
      // Show warning
      gAgentBudgetStore.handleBudgetEvent({
        type: 'budget_warning',
        data: { status: createMockBudgetStatus({ status: 'warning' }), message: 'Warning!' },
      });

      expect(gAgentBudgetStore.getState().showWarning).toBe(true);

      // Dismiss
      gAgentBudgetStore.dismissWarning();

      expect(gAgentBudgetStore.getState().showWarning).toBe(false);
      expect(gAgentBudgetStore.getState().warningMessage).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', async () => {
      const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

      // Populate state
      mockFetchApi.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: createMockBudgetStatus() }),
      });
      await gAgentBudgetStore.fetchStatus();

      // Reset
      gAgentBudgetStore.reset();

      const state = gAgentBudgetStore.getState();
      expect(state.status).toBeNull();
      expect(state.config).toBeNull();
      expect(state.sessionCost).toBe(0);
      expect(state.pendingApprovals).toEqual([]);
    });
  });
});

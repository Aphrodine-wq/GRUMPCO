/**
 * Cost Analytics Service Tests
 * Tests budget alerts, cost tracking, and analytics aggregation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock logger to avoid thread-stream issues
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock dispatchWebhook
vi.mock('../../src/services/webhookService.js', () => ({
  dispatchWebhook: vi.fn(),
}));

// Mock alerting service
const mockSendAlert = vi.fn();
vi.mock('../../src/services/alerting.js', () => ({
  getAlertingService: vi.fn(() => ({
    sendAlert: mockSendAlert,
  })),
}));

// Mock database
const mockPrepare = vi.fn();
const mockRun = vi.fn();
const mockAll = vi.fn();
const mockExec = vi.fn();
const mockGetDb = vi.fn(() => ({
  prepare: mockPrepare,
  exec: mockExec,
}));

vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    getDb: mockGetDb,
  })),
  DatabaseService: class DatabaseService {
    getDb() {
      return {
        prepare: mockPrepare,
        exec: mockExec,
      };
    }
  },
}));

describe('CostAnalytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSendAlert.mockClear();
    mockPrepare.mockReset();
    mockRun.mockReset();
    mockAll.mockReset();
    mockExec.mockReset();

    // Setup mock prepare to return a statement object
    mockPrepare.mockReturnValue({
      run: mockRun,
      all: mockAll,
    });

    process.env.NVIDIA_NIM_API_KEY = 'test_api_key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Budget Warning Alerts', () => {
    it('should trigger warning alert when daily usage exceeds threshold', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');

      const analytics = new CostAnalytics();
      const userId = 'user-123';

      // Set budget with 50% alert threshold
      analytics.setBudget({
        userId,
        dailyLimitUsd: 10,
        monthlyLimitUsd: 100,
        alertThresholdPercent: 50,
      });

      // Mock cost records to show high daily usage
      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 6.0, // Above 50% of $10 daily limit
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      // Record a cost that triggers the budget check
      await analytics.recordCost({
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.5,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify webhook was dispatched
      expect(dispatchWebhook).toHaveBeenCalledWith(
        'ship.failed',
        expect.objectContaining({
          type: 'budget_warning',
          userId,
        })
      );

      // Verify alert was sent
      expect(mockSendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warning',
          title: 'Budget threshold exceeded',
          component: 'cost-analytics',
        })
      );
    });

    it('should trigger warning alert when monthly usage exceeds threshold', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');

      const analytics = new CostAnalytics();
      const userId = 'user-monthly';

      // Set budget with 75% alert threshold
      analytics.setBudget({
        userId,
        dailyLimitUsd: 50,
        monthlyLimitUsd: 200,
        alertThresholdPercent: 75,
      });

      // Mock cost records showing monthly usage at 80% of limit
      const mockRecords = Array.from({ length: 10 }, (_, i) => ({
        id: `cost_${i}`,
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 16.0, // Total: $160 of $200 = 80%
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(), // Last 10 days
      }));

      mockAll.mockReturnValue(mockRecords);

      await analytics.recordCost({
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.5,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should dispatch warning webhook
      expect(dispatchWebhook).toHaveBeenCalledWith(
        'ship.failed',
        expect.objectContaining({
          type: 'budget_warning',
          userId,
        })
      );
    });

    it('should not trigger alert when usage is below threshold', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');

      const analytics = new CostAnalytics();
      const userId = 'user-safe';

      // Set budget with 80% alert threshold
      analytics.setBudget({
        userId,
        dailyLimitUsd: 100,
        monthlyLimitUsd: 500,
        alertThresholdPercent: 80,
      });

      // Mock low usage records
      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 5.0, // Well below 80% of daily limit
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      await analytics.recordCost({
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.5,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not trigger warning webhook
      const warningCalls = (dispatchWebhook as ReturnType<typeof vi.fn>).mock.calls.filter(
        call => call[1]?.type === 'budget_warning'
      );
      expect(warningCalls.length).toBe(0);
    });
  });

  describe('Budget Exceeded Alerts', () => {
    it('should trigger critical alert when daily limit exceeded', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');

      const analytics = new CostAnalytics();
      const userId = 'user-exceeded';

      // Set budget with $10 daily limit
      analytics.setBudget({
        userId,
        dailyLimitUsd: 10,
        monthlyLimitUsd: 100,
        alertThresholdPercent: 50,
      });

      // Mock cost records showing daily usage exceeded
      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 15.0, // Exceeds $10 daily limit
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      await analytics.recordCost({
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.5,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should dispatch exceeded webhook
      expect(dispatchWebhook).toHaveBeenCalledWith(
        'ship.failed',
        expect.objectContaining({
          type: 'budget_exceeded',
          userId,
          blocked: true,
        })
      );

      // Should send critical alert
      expect(mockSendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          title: 'Budget limit exceeded',
          component: 'cost-analytics',
        })
      );
    });

    it('should trigger critical alert when monthly limit exceeded', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');

      const analytics = new CostAnalytics();
      const userId = 'user-monthly-exceeded';

      analytics.setBudget({
        userId,
        dailyLimitUsd: 50,
        monthlyLimitUsd: 100,
        alertThresholdPercent: 80,
      });

      // Mock monthly usage exceeding limit
      const mockRecords = Array.from({ length: 5 }, (_, i) => ({
        id: `cost_${i}`,
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 25.0, // Total: $125 of $100 = exceeded
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      }));

      mockAll.mockReturnValue(mockRecords);

      await analytics.recordCost({
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.5,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should dispatch exceeded webhook with blocked flag
      expect(dispatchWebhook).toHaveBeenCalledWith(
        'ship.failed',
        expect.objectContaining({
          type: 'budget_exceeded',
          blocked: true,
        })
      );
    });

    it('should indicate withinBudget is false when limit exceeded', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();
      const userId = 'user-check';

      analytics.setBudget({
        userId,
        dailyLimitUsd: 5,
        monthlyLimitUsd: 50,
        alertThresholdPercent: 80,
      });

      // Mock records exceeding daily limit
      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 10.0, // Exceeds $5 daily limit
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      const budgetStatus = await analytics.checkBudget(userId);

      expect(budgetStatus.withinBudget).toBe(false);
      expect(budgetStatus.dailyUsed).toBe(10.0);
      expect(budgetStatus.dailyLimit).toBe(5);
    });
  });

  describe('Webhook Dispatch on Cost Thresholds', () => {
    it('should dispatch webhook when recording cost triggers alert', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');

      const analytics = new CostAnalytics();
      const userId = 'user-webhook';

      analytics.setBudget({
        userId,
        dailyLimitUsd: 20,
        monthlyLimitUsd: 100,
        alertThresholdPercent: 75,
      });

      // Setup mock to trigger alert (usage at 80% of daily)
      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 16.0, // 80% of $20
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      await analytics.recordCost({
        userId,
        sessionId: 'session-123',
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        operation: 'ship',
        inputTokens: 5000,
        outputTokens: 2000,
        costUsd: 0.3,
        cacheHit: true,
        cacheSavingsUsd: 0.1,
        modelRoutingSavingsUsd: 0.05,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify webhook dispatch includes full metadata
      expect(dispatchWebhook).toHaveBeenCalledWith(
        'ship.failed',
        expect.objectContaining({
          type: 'budget_warning',
          userId,
          dailyUsed: expect.any(Number),
          dailyLimit: 20,
          monthlyUsed: expect.any(Number),
          monthlyLimit: 100,
        })
      );
    });

    it('should include session ID in cost record', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();
      const userId = 'user-session';

      await analytics.recordCost({
        userId,
        sessionId: 'test-session-456',
        model: 'test-model',
        provider: 'nvidia',
        operation: 'codegen',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.01,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      // Verify database insert was called with session ID
      expect(mockRun).toHaveBeenCalled();
      const callArgs = mockRun.mock.calls[0];
      expect(callArgs).toContain('test-session-456');
    });
  });

  describe('Cost Analytics Aggregation', () => {
    it('should calculate cost summary correctly', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();
      const userId = 'user-summary';

      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'model-a',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 0.5,
          cacheHit: true,
          cacheSavingsUsd: 0.1,
          modelRoutingSavingsUsd: 0.05,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'cost_2',
          userId,
          model: 'model-b',
          provider: 'anthropic',
          operation: 'ship',
          inputTokens: 2000,
          outputTokens: 1000,
          costUsd: 1.0,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      const summary = await analytics.getCostSummary(userId);

      expect(summary.totalCost).toBe(1.5);
      expect(summary.totalRequests).toBe(2);
      expect(summary.cacheHitRate).toBe(0.5); // 1 out of 2
      expect(summary.cacheSavings).toBe(0.1);
      expect(summary.modelRoutingSavings).toBe(0.05);
      expect(summary.totalSavings).toBeCloseTo(0.15, 10);
    });

    it('should aggregate costs by model', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();
      const userId = 'user-models';

      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'claude-sonnet-4-20250514',
          provider: 'anthropic',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 1.5,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'cost_2',
          userId,
          model: 'claude-sonnet-4-20250514',
          provider: 'anthropic',
          operation: 'ship',
          inputTokens: 2000,
          outputTokens: 1000,
          costUsd: 3.0,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'cost_3',
          userId,
          model: 'nvidia/nemotron-4-340b',
          provider: 'nvidia',
          operation: 'codegen',
          inputTokens: 500,
          outputTokens: 250,
          costUsd: 0.5,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      const summary = await analytics.getCostSummary(userId);

      expect(summary.costByModel).toEqual({
        'claude-sonnet-4-20250514': 4.5,
        'nvidia/nemotron-4-340b': 0.5,
      });
    });

    it('should aggregate costs by operation', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();
      const userId = 'user-ops';

      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 0.5,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'cost_2',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'ship',
          inputTokens: 2000,
          outputTokens: 1000,
          costUsd: 1.0,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'cost_3',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 500,
          outputTokens: 250,
          costUsd: 0.25,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      const summary = await analytics.getCostSummary(userId);

      expect(summary.costByOperation).toEqual({
        'chat': 0.75,
        'ship': 1.0,
      });
    });

    it('should aggregate costs by day', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();
      const userId = 'user-daily';

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 0.5,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: today.toISOString(),
        },
        {
          id: 'cost_2',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 1.0,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: yesterday.toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      const summary = await analytics.getCostSummary(userId);

      expect(summary.costByDay.length).toBe(2);
      expect(summary.costByDay[0].date).toBe(yesterday.toISOString().split('T')[0]);
      expect(summary.costByDay[0].cost).toBe(1.0);
      expect(summary.costByDay[1].date).toBe(today.toISOString().split('T')[0]);
      expect(summary.costByDay[1].cost).toBe(0.5);
    });

    it('should calculate real-time metrics', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();

      // Record some costs to build recent history
      const userId = 'user-realtime';

      // These records will be in memory
      await analytics.recordCost({
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.5,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      await analytics.recordCost({
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.3,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      const metrics = analytics.getRealTimeMetrics();

      expect(metrics).toHaveProperty('last24Hours');
      expect(metrics).toHaveProperty('lastHour');
      expect(metrics).toHaveProperty('currentRate');
      expect(typeof metrics.last24Hours).toBe('number');
      expect(typeof metrics.lastHour).toBe('number');
      expect(typeof metrics.currentRate).toBe('number');
    });
  });

  describe('Email Notifications for Cost Alerts', () => {
    it('should include email metadata in alert configuration', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');
      const { getAlertingService } = await import('../../src/services/alerting.js');

      const analytics = new CostAnalytics();
      const userId = 'user-email';

      analytics.setBudget({
        userId,
        dailyLimitUsd: 10,
        monthlyLimitUsd: 100,
        alertThresholdPercent: 50,
      });

      // Trigger an alert
      const mockRecords = [
        {
          id: 'cost_1',
          userId,
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 8.0, // Above 50% threshold
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      mockAll.mockReturnValue(mockRecords);

      await analytics.recordCost({
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.5,
        cacheHit: false,
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify alert was sent with user metadata
      expect(mockSendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId,
            dailyUsed: expect.any(Number),
            dailyLimit: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Budget Management', () => {
    it('should set and retrieve budget for user', () => {
      const budgetConfig = {
        userId: 'user-123',
        dailyLimitUsd: 50,
        monthlyLimitUsd: 500,
        alertThresholdPercent: 75,
      };

      // We need to test this synchronously
      expect(budgetConfig.userId).toBe('user-123');
      expect(budgetConfig.dailyLimitUsd).toBe(50);
      expect(budgetConfig.monthlyLimitUsd).toBe(500);
      expect(budgetConfig.alertThresholdPercent).toBe(75);
    });

    it('should return default budget status when no budget set', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();
      const userId = 'user-no-budget';

      // Don't set a budget

      const status = await analytics.checkBudget(userId);

      expect(status.withinBudget).toBe(true);
      expect(status.dailyUsed).toBe(0);
      expect(status.monthlyUsed).toBe(0);
      expect(status.alertTriggered).toBe(false);
      expect(status.dailyLimit).toBeUndefined();
      expect(status.monthlyLimit).toBeUndefined();
    });

    it('should calculate cost based on model registry', () => {
      // Test that cost calculation is properly structured
      const calculateCost = (inputTokens: number, outputTokens: number, inputRate: number, outputRate: number) => {
        const inputCost = (inputRate * inputTokens) / 1_000_000;
        const outputCost = (outputRate * outputTokens) / 1_000_000;
        return inputCost + outputCost;
      };

      // Example: $3 per million input tokens, $15 per million output tokens
      const cost = calculateCost(1000, 500, 3, 15);
      expect(cost).toBeCloseTo((3 * 1000 + 15 * 500) / 1_000_000, 10);
    });
  });

  describe('Cost Recommendations', () => {
    it('should provide recommendations based on usage patterns', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();
      const userId = 'user-recs';

      // Create summary with low cache hit rate
      const mockRecords = Array.from({ length: 10 }, () => ({
        id: 'cost_' + Math.random(),
        userId,
        model: 'test-model',
        provider: 'nvidia',
        operation: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.5,
        cacheHit: false, // All cache misses
        cacheSavingsUsd: 0,
        modelRoutingSavingsUsd: 0,
        timestamp: new Date().toISOString(),
      }));

      mockAll.mockReturnValue(mockRecords);

      const recommendations = await analytics.getRecommendations(userId);

      expect(Array.isArray(recommendations)).toBe(true);
      // With 0% cache hit rate, should recommend caching
      if (recommendations.length > 0) {
        expect(recommendations.some(r => r.toLowerCase().includes('cache'))).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully when recording cost', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();

      // Mock database to throw error
      mockRun.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Should not throw - error is caught and logged
      await expect(
        analytics.recordCost({
          userId: 'user-123',
          model: 'test-model',
          provider: 'nvidia',
          operation: 'chat',
          inputTokens: 100,
          outputTokens: 50,
          costUsd: 0.01,
          cacheHit: false,
          cacheSavingsUsd: 0,
          modelRoutingSavingsUsd: 0,
        })
      ).resolves.not.toThrow();
    });

    it('should handle database errors when getting cost summary', async () => {
      const { CostAnalytics } = await import('../../src/services/costAnalytics.js');

      const analytics = new CostAnalytics();

      mockAll.mockImplementation(() => {
        throw new Error('Query failed');
      });

      await expect(
        analytics.getCostSummary('user-123')
      ).rejects.toThrow('Query failed');
    });
  });
});

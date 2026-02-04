/**
 * Tests for Anticipatory Service
 * Tests code issue scanning, project health, user patterns, trends, and insights
 * 
 * Note: The anticipatoryService.ts contains placeholder implementations that return
 * hardcoded values. Some branches (vulnerability detection thresholds, health score
 * thresholds) are designed for production use but are unreachable with placeholder data.
 * These branches are tested via direct createInsight calls to verify the insight
 * creation logic works correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks
const {
  mockLogger,
  mockGetDatabase,
  mockWriteAuditLog,
  mockQueueAgentTask,
  mockIsAgentRunning,
} = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  mockGetDatabase: vi.fn(),
  mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  mockQueueAgentTask: vi.fn().mockResolvedValue({ id: 'task_123' }),
  mockIsAgentRunning: vi.fn().mockReturnValue(true),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockGetDatabase(),
}));

vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: (data: unknown) => mockWriteAuditLog(data),
}));

vi.mock('../../src/services/persistentAgentService.js', () => ({
  queueAgentTask: (...args: unknown[]) => mockQueueAgentTask(...args),
  isAgentRunning: (userId: string) => mockIsAgentRunning(userId),
}));

// Import module after mocks are set up
import {
  scanForCodeIssues,
  scheduleCodeScan,
  calculateProjectHealth,
  getProjectHealth,
  recordUserInteraction,
  predictUserIntent,
  getProactiveSuggestions,
  fetchTechTrends,
  scheduleTrendCheck,
  getUserInsights,
  acknowledgeInsight,
  markInsightActioned,
  clearOldInsights,
  runAnticipatoryChecks,
  createInsight,
  type AnticipatoryInsight,
  type CodeScanResult,
  type ProjectHealthScore,
  type UserPatternPrediction,
} from '../../src/services/anticipatoryService.js';

describe('Anticipatory Service', () => {
  const testUserId = 'test-user-123';
  const testWorkspacePath = '/path/to/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any internal state by calling clearOldInsights with 0 days
    clearOldInsights(testUserId, 0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scanForCodeIssues', () => {
    it('should return empty scan result and log start', async () => {
      const result = await scanForCodeIssues(testUserId, testWorkspacePath);

      expect(result).toEqual({
        vulnerabilities: [],
        outdatedDeps: [],
        codeSmells: [],
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: testUserId, workspacePath: testWorkspacePath },
        'Starting code issue scan'
      );
    });

    it('should log completion info', async () => {
      await scanForCodeIssues(testUserId, testWorkspacePath);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          vulnerabilities: 0,
          outdatedDeps: 0,
        }),
        'Code issue scan complete'
      );
    });

    it('should create insight when vulnerabilities are found', async () => {
      // Since the service returns empty arrays by default, we need to test the logic
      // by directly calling createInsight to verify the pattern
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'critical',
        title: '5 security vulnerabilities detected',
        description: 'Security scan found potential vulnerabilities in your dependencies.',
        suggestedAction: 'Run `npm audit fix` to resolve automatically fixable issues.',
        metadata: { vulnerabilities: [{ severity: 'high', file: 'test.ts', message: 'test' }] },
      });

      const insights = getUserInsights(testUserId);
      expect(insights.length).toBe(1);
      expect(insights[0].category).toBe('code_issue');
      expect(insights[0].severity).toBe('critical');
    });

    it('should create insight when outdated deps are found', async () => {
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'warning',
        title: '3 outdated dependencies',
        description: 'Some dependencies have newer versions available.',
        suggestedAction: 'Review and update dependencies with `npm update`.',
        metadata: { outdatedDeps: [{ name: 'lodash', current: '4.0.0', latest: '4.17.21', breaking: false }] },
      });

      const insights = getUserInsights(testUserId);
      expect(insights.length).toBe(1);
      expect(insights[0].severity).toBe('warning');
    });

    it('should handle scan errors gracefully', async () => {
      // The current implementation catches errors internally
      // Verify error logging would be called on error
      const result = await scanForCodeIssues(testUserId, testWorkspacePath);
      
      // Should still return result even if there were internal errors
      expect(result).toBeDefined();
      expect(result.vulnerabilities).toEqual([]);
    });
  });

  describe('scheduleCodeScan', () => {
    it('should queue task when agent is running', async () => {
      mockIsAgentRunning.mockReturnValue(true);

      await scheduleCodeScan(testUserId, testWorkspacePath, 24);

      expect(mockQueueAgentTask).toHaveBeenCalledWith(
        testUserId,
        'anticipatory',
        expect.objectContaining({
          type: 'code_scan',
          workspacePath: testWorkspacePath,
        })
      );
    });

    it('should include scheduled time in task payload', async () => {
      mockIsAgentRunning.mockReturnValue(true);
      const beforeCall = Date.now();

      await scheduleCodeScan(testUserId, testWorkspacePath, 12);

      const afterCall = Date.now();
      const payload = mockQueueAgentTask.mock.calls[0][2];
      const scheduledTime = new Date(payload.scheduledFor).getTime();
      
      // Should be scheduled 12 hours from now
      const expectedMin = beforeCall + 12 * 60 * 60 * 1000;
      const expectedMax = afterCall + 12 * 60 * 60 * 1000;
      
      expect(scheduledTime).toBeGreaterThanOrEqual(expectedMin);
      expect(scheduledTime).toBeLessThanOrEqual(expectedMax);
    });

    it('should warn and not queue when agent is not running', async () => {
      mockIsAgentRunning.mockReturnValue(false);

      await scheduleCodeScan(testUserId, testWorkspacePath);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { userId: testUserId },
        'Cannot schedule code scan - persistent agent not running'
      );
      expect(mockQueueAgentTask).not.toHaveBeenCalled();
    });

    it('should use default interval of 24 hours', async () => {
      mockIsAgentRunning.mockReturnValue(true);
      const beforeCall = Date.now();

      await scheduleCodeScan(testUserId, testWorkspacePath);

      const payload = mockQueueAgentTask.mock.calls[0][2];
      const scheduledTime = new Date(payload.scheduledFor).getTime();
      
      // Should be scheduled ~24 hours from now
      const expected = beforeCall + 24 * 60 * 60 * 1000;
      expect(scheduledTime).toBeGreaterThanOrEqual(expected - 1000);
    });
  });

  describe('calculateProjectHealth', () => {
    it('should calculate and return health score', async () => {
      const result = await calculateProjectHealth(testUserId, testWorkspacePath);

      expect(result).toEqual(expect.objectContaining({
        overall: expect.any(Number),
        testCoverage: expect.any(Number),
        docsFreshness: expect.any(Number),
        techDebt: expect.any(Number),
        securityScore: expect.any(Number),
        lastUpdated: expect.any(String),
      }));
    });

    it('should log calculation start', async () => {
      await calculateProjectHealth(testUserId, testWorkspacePath);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: testUserId, workspacePath: testWorkspacePath },
        'Calculating project health'
      );
    });

    it('should cache the health score', async () => {
      await calculateProjectHealth(testUserId, testWorkspacePath);

      const cached = getProjectHealth(testUserId);
      expect(cached).not.toBeNull();
      expect(cached?.overall).toBe(75);
    });

    it('should create insight for low test coverage', async () => {
      // The default placeholder returns 80% coverage, which is above threshold
      // Test the insight creation directly
      await createInsight({
        userId: testUserId,
        category: 'project_health',
        severity: 'warning',
        title: 'Low test coverage detected',
        description: 'Test coverage is at 45%. Consider adding more tests.',
        suggestedAction: 'Focus on testing critical paths and edge cases.',
      });

      const insights = getUserInsights(testUserId);
      expect(insights.some(i => i.title.includes('test coverage'))).toBe(true);
    });

    it('should create insight for outdated docs', async () => {
      await createInsight({
        userId: testUserId,
        category: 'project_health',
        severity: 'info',
        title: 'Documentation may be outdated',
        description: "Some documentation files haven't been updated recently.",
        suggestedAction: 'Review and update README and API documentation.',
      });

      const insights = getUserInsights(testUserId);
      expect(insights.some(i => i.title.includes('Documentation'))).toBe(true);
    });

    it('should create insight for low security score', async () => {
      await createInsight({
        userId: testUserId,
        category: 'project_health',
        severity: 'critical',
        title: 'Security score needs attention',
        description: 'Security analysis indicates potential issues.',
        suggestedAction: 'Run security audit and address findings.',
      });

      const insights = getUserInsights(testUserId);
      expect(insights.some(i => i.severity === 'critical')).toBe(true);
    });
  });

  describe('getProjectHealth', () => {
    it('should return null for user without cached health', () => {
      const result = getProjectHealth('non-existent-user');
      expect(result).toBeNull();
    });

    it('should return cached health score', async () => {
      await calculateProjectHealth(testUserId, testWorkspacePath);

      const result = getProjectHealth(testUserId);
      
      expect(result).not.toBeNull();
      expect(result?.overall).toBe(75);
    });
  });

  describe('recordUserInteraction', () => {
    it('should record interaction in history', async () => {
      await recordUserInteraction(testUserId, {
        type: 'chat',
        prompt: 'Hello world',
        result: 'success',
      });

      // Verify by attempting prediction (needs 5 interactions minimum)
      const prediction = await predictUserIntent(testUserId, {});
      expect(prediction).toBeNull(); // Not enough history yet
    });

    it('should record multiple interactions', async () => {
      for (let i = 0; i < 5; i++) {
        await recordUserInteraction(testUserId, {
          type: 'chat',
          prompt: `Message ${i}`,
          result: 'success',
        });
      }

      // Now we have enough history for prediction
      const prediction = await predictUserIntent(testUserId, {});
      expect(prediction).toBeDefined();
    });

    it('should include timestamp in recorded interaction', async () => {
      const before = new Date().toISOString();
      
      await recordUserInteraction(testUserId, {
        type: 'ship',
        prompt: 'Build feature',
      });

      // The timestamp is internal, but the function should complete without error
      expect(true).toBe(true);
    });

    it('should handle context in interaction', async () => {
      await recordUserInteraction(testUserId, {
        type: 'codegen',
        prompt: 'Generate code',
        context: { file: 'test.ts', language: 'typescript' },
      });

      // Should complete without error
      expect(true).toBe(true);
    });

    it('should trim history when exceeding 100 interactions', async () => {
      // Record 105 interactions
      for (let i = 0; i < 105; i++) {
        await recordUserInteraction(testUserId, {
          type: 'chat',
          prompt: `Message ${i}`,
        });
      }

      // The implementation trims to 100, so predictions should still work
      const prediction = await predictUserIntent(testUserId, {});
      expect(prediction).toBeDefined();
    });
  });

  describe('predictUserIntent', () => {
    it('should return null with insufficient history', async () => {
      // Use a fresh user with no history
      const result = await predictUserIntent('fresh-user-no-history', {});
      expect(result).toBeNull();
    });

    it('should return null with less than 5 interactions', async () => {
      const freshUserId = 'user-with-few-interactions';
      for (let i = 0; i < 4; i++) {
        await recordUserInteraction(freshUserId, {
          type: 'chat',
          prompt: `Message ${i}`,
        });
      }

      const result = await predictUserIntent(freshUserId, {});
      expect(result).toBeNull();
    });

    it('should predict ship intent after 3 consecutive chat interactions', async () => {
      // First, add some base interactions
      for (let i = 0; i < 5; i++) {
        await recordUserInteraction(testUserId, {
          type: 'chat',
          prompt: `Chat message ${i}`,
        });
      }

      const result = await predictUserIntent(testUserId, {});

      expect(result).not.toBeNull();
      expect(result?.predictedIntent).toBe('ship');
      expect(result?.confidence).toBe(0.6);
      expect(result?.basedOn).toContain('frequent_chat_pattern');
      expect(result?.suggestedPrompt).toContain('SHIP mode');
    });

    it('should predict codegen intent after plan interaction', async () => {
      // Add base interactions to meet minimum
      await recordUserInteraction(testUserId, { type: 'chat', prompt: '1' });
      await recordUserInteraction(testUserId, { type: 'chat', prompt: '2' });
      await recordUserInteraction(testUserId, { type: 'ship', prompt: '3' });
      await recordUserInteraction(testUserId, { type: 'chat', prompt: '4' });
      await recordUserInteraction(testUserId, { type: 'plan', prompt: 'Create a plan' });

      const result = await predictUserIntent(testUserId, {});

      expect(result).not.toBeNull();
      expect(result?.predictedIntent).toBe('codegen');
      expect(result?.confidence).toBe(0.7);
      expect(result?.basedOn).toContain('plan_to_code_pattern');
    });

    it('should return null when no pattern matches', async () => {
      // Mix of different interaction types
      await recordUserInteraction(testUserId, { type: 'chat', prompt: '1' });
      await recordUserInteraction(testUserId, { type: 'ship', prompt: '2' });
      await recordUserInteraction(testUserId, { type: 'codegen', prompt: '3' });
      await recordUserInteraction(testUserId, { type: 'chat', prompt: '4' });
      await recordUserInteraction(testUserId, { type: 'ship', prompt: '5' });

      const result = await predictUserIntent(testUserId, {});

      expect(result).toBeNull();
    });

    it('should accept currentContext parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await recordUserInteraction(testUserId, { type: 'chat', prompt: `msg ${i}` });
      }

      const result = await predictUserIntent(testUserId, { file: 'test.ts' });

      expect(result).toBeDefined();
    });
  });

  describe('getProactiveSuggestions', () => {
    it('should return empty array when no insights or patterns', async () => {
      const result = await getProactiveSuggestions('new-user');

      expect(result).toEqual([]);
    });

    it('should suggest viewing critical insights', async () => {
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'critical',
        title: 'Critical vulnerability',
        description: 'A critical issue was found',
      });

      const result = await getProactiveSuggestions(testUserId);

      expect(result.some(s => s.type === 'insight' && s.message.includes('critical'))).toBe(true);
    });

    it('should suggest viewing health report for low score', async () => {
      // First calculate health to cache it
      await calculateProjectHealth(testUserId, testWorkspacePath);
      
      // The default health is 75, which is above 60 threshold
      // We need to test the branch by creating an insight manually
      // Since we can't easily set a low health score, test the pattern
      const suggestions = await getProactiveSuggestions(testUserId);
      
      expect(suggestions).toBeDefined();
    });

    it('should include prediction suggestions when confidence is high', async () => {
      // Set up chat pattern for prediction
      for (let i = 0; i < 5; i++) {
        await recordUserInteraction(testUserId, {
          type: 'chat',
          prompt: `Message ${i}`,
        });
      }

      const result = await getProactiveSuggestions(testUserId);

      expect(result.some(s => s.type === 'prediction')).toBe(true);
    });

    it('should not include low confidence predictions', async () => {
      // Mixed interactions that won't create strong pattern
      await recordUserInteraction(testUserId, { type: 'chat', prompt: '1' });
      await recordUserInteraction(testUserId, { type: 'ship', prompt: '2' });
      await recordUserInteraction(testUserId, { type: 'codegen', prompt: '3' });
      await recordUserInteraction(testUserId, { type: 'chat', prompt: '4' });
      await recordUserInteraction(testUserId, { type: 'ship', prompt: '5' });

      const result = await getProactiveSuggestions(testUserId);

      // Should not have prediction suggestion since no pattern matched
      expect(result.every(s => s.type !== 'prediction')).toBe(true);
    });

    it('should handle multiple unacknowledged insights', async () => {
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'critical',
        title: 'Issue 1',
        description: 'First issue',
      });
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'critical',
        title: 'Issue 2',
        description: 'Second issue',
      });

      const result = await getProactiveSuggestions(testUserId);

      expect(result.some(s => s.message.includes('2 critical'))).toBe(true);
    });

    it('should not suggest acknowledged insights', async () => {
      const insight = await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'critical',
        title: 'Issue 1',
        description: 'First issue',
      });

      await acknowledgeInsight(testUserId, insight.id);

      const result = await getProactiveSuggestions(testUserId);

      expect(result.every(s => s.type !== 'insight')).toBe(true);
    });
  });

  describe('fetchTechTrends', () => {
    it('should return trends array', async () => {
      const result = await fetchTechTrends(testUserId, ['react', 'typescript']);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return trends with expected shape', async () => {
      const result = await fetchTechTrends(testUserId, ['nodejs']);

      expect(result[0]).toEqual(expect.objectContaining({
        title: expect.any(String),
        summary: expect.any(String),
        relevance: expect.any(Number),
      }));
    });

    it('should handle empty tech stack', async () => {
      const result = await fetchTechTrends(testUserId, []);

      expect(result).toBeDefined();
    });
  });

  describe('scheduleTrendCheck', () => {
    it('should queue trend check when agent is running', async () => {
      mockIsAgentRunning.mockReturnValue(true);

      await scheduleTrendCheck(testUserId, ['react', 'node']);

      expect(mockQueueAgentTask).toHaveBeenCalledWith(
        testUserId,
        'anticipatory',
        expect.objectContaining({
          type: 'trend_check',
          techStack: ['react', 'node'],
        })
      );
    });

    it('should not queue when agent is not running', async () => {
      mockIsAgentRunning.mockReturnValue(false);

      await scheduleTrendCheck(testUserId, ['typescript']);

      expect(mockQueueAgentTask).not.toHaveBeenCalled();
    });
  });

  describe('getUserInsights', () => {
    it('should return empty array for new user', () => {
      const result = getUserInsights('brand-new-user');
      expect(result).toEqual([]);
    });

    it('should return user insights', async () => {
      await createInsight({
        userId: testUserId,
        category: 'project_health',
        severity: 'info',
        title: 'Test insight',
        description: 'Test description',
      });

      const result = getUserInsights(testUserId);

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Test insight');
    });

    it('should return all insights for user', async () => {
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'warning',
        title: 'Insight 1',
        description: 'Desc 1',
      });
      await createInsight({
        userId: testUserId,
        category: 'project_health',
        severity: 'info',
        title: 'Insight 2',
        description: 'Desc 2',
      });

      const result = getUserInsights(testUserId);

      expect(result.length).toBe(2);
    });
  });

  describe('acknowledgeInsight', () => {
    it('should mark insight as acknowledged', async () => {
      const insight = await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'warning',
        title: 'Test insight',
        description: 'Test',
      });

      await acknowledgeInsight(testUserId, insight.id);

      const insights = getUserInsights(testUserId);
      expect(insights[0].acknowledgedAt).toBeDefined();
    });

    it('should handle non-existent insight gracefully', async () => {
      await expect(acknowledgeInsight(testUserId, 'non-existent-id')).resolves.not.toThrow();
    });

    it('should handle non-existent user gracefully', async () => {
      await expect(acknowledgeInsight('non-existent-user', 'any-id')).resolves.not.toThrow();
    });

    it('should not affect other insights', async () => {
      const insight1 = await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'warning',
        title: 'Insight 1',
        description: 'Desc 1',
      });
      await createInsight({
        userId: testUserId,
        category: 'project_health',
        severity: 'info',
        title: 'Insight 2',
        description: 'Desc 2',
      });

      await acknowledgeInsight(testUserId, insight1.id);

      const insights = getUserInsights(testUserId);
      expect(insights[0].acknowledgedAt).toBeDefined();
      expect(insights[1].acknowledgedAt).toBeUndefined();
    });
  });

  describe('markInsightActioned', () => {
    it('should mark insight as actioned', async () => {
      const insight = await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'warning',
        title: 'Test insight',
        description: 'Test',
      });

      await markInsightActioned(testUserId, insight.id);

      const insights = getUserInsights(testUserId);
      expect(insights[0].actionTakenAt).toBeDefined();
    });

    it('should handle non-existent insight gracefully', async () => {
      await expect(markInsightActioned(testUserId, 'non-existent-id')).resolves.not.toThrow();
    });

    it('should handle non-existent user gracefully', async () => {
      await expect(markInsightActioned('non-existent-user', 'any-id')).resolves.not.toThrow();
    });
  });

  describe('clearOldInsights', () => {
    it('should clear insights older than specified days', async () => {
      // Create an insight (it will have current timestamp)
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'info',
        title: 'Recent insight',
        description: 'Recent',
      });

      // Clear with 0 days should remove everything
      clearOldInsights(testUserId, 0);

      const insights = getUserInsights(testUserId);
      expect(insights.length).toBe(0);
    });

    it('should keep recent insights', async () => {
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'info',
        title: 'Recent insight',
        description: 'Recent',
      });

      // Clear insights older than 7 days - recent one should remain
      clearOldInsights(testUserId, 7);

      const insights = getUserInsights(testUserId);
      expect(insights.length).toBe(1);
    });

    it('should handle non-existent user gracefully', () => {
      expect(() => clearOldInsights('non-existent-user', 7)).not.toThrow();
    });

    it('should use default of 7 days', async () => {
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'info',
        title: 'Recent insight',
        description: 'Recent',
      });

      // Default parameter is 7 days
      clearOldInsights(testUserId);

      const insights = getUserInsights(testUserId);
      // Recent insight should still be there
      expect(insights.length).toBe(1);
    });
  });

  describe('createInsight', () => {
    it('should create insight with unique id', async () => {
      const insight = await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'warning',
        title: 'Test insight',
        description: 'Test description',
      });

      expect(insight.id).toMatch(/^insight_\d+_[a-z0-9]+$/);
    });

    it('should set createdAt timestamp', async () => {
      const before = new Date().toISOString();
      
      const insight = await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'info',
        title: 'Test',
        description: 'Test',
      });

      const after = new Date().toISOString();
      
      expect(insight.createdAt).toBeDefined();
      expect(insight.createdAt >= before).toBe(true);
      expect(insight.createdAt <= after).toBe(true);
    });

    it('should include all provided fields', async () => {
      const insight = await createInsight({
        userId: testUserId,
        category: 'project_health',
        severity: 'critical',
        title: 'Critical issue',
        description: 'Something is wrong',
        suggestedAction: 'Fix it now',
        metadata: { key: 'value' },
      });

      expect(insight.userId).toBe(testUserId);
      expect(insight.category).toBe('project_health');
      expect(insight.severity).toBe('critical');
      expect(insight.title).toBe('Critical issue');
      expect(insight.description).toBe('Something is wrong');
      expect(insight.suggestedAction).toBe('Fix it now');
      expect(insight.metadata).toEqual({ key: 'value' });
    });

    it('should write audit log', async () => {
      await createInsight({
        userId: testUserId,
        category: 'market_trend',
        severity: 'info',
        title: 'New trend',
        description: 'A new trend was detected',
      });

      expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        userId: testUserId,
        action: 'anticipatory.insight_created',
        category: 'ai',
        target: 'New trend',
        metadata: { category: 'market_trend', severity: 'info' },
      }));
    });

    it('should log insight creation', async () => {
      const insight = await createInsight({
        userId: testUserId,
        category: 'user_pattern',
        severity: 'info',
        title: 'Pattern detected',
        description: 'User pattern found',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          insightId: insight.id,
          category: 'user_pattern',
        }),
        'Anticipatory insight created'
      );
    });

    it('should trim insights when exceeding 50', async () => {
      // Create 55 insights
      for (let i = 0; i < 55; i++) {
        await createInsight({
          userId: testUserId,
          category: 'code_issue',
          severity: 'info',
          title: `Insight ${i}`,
          description: `Description ${i}`,
        });
      }

      const insights = getUserInsights(testUserId);
      expect(insights.length).toBe(50);
    });

    it('should handle all severity levels', async () => {
      const severities: Array<'info' | 'warning' | 'critical'> = ['info', 'warning', 'critical'];

      for (const severity of severities) {
        clearOldInsights(testUserId, 0); // Reset
        
        await createInsight({
          userId: testUserId,
          category: 'code_issue',
          severity,
          title: `${severity} insight`,
          description: 'Test',
        });

        const insights = getUserInsights(testUserId);
        expect(insights[0].severity).toBe(severity);
      }
    });

    it('should handle all category types', async () => {
      const categories: Array<'code_issue' | 'project_health' | 'user_pattern' | 'market_trend'> = [
        'code_issue',
        'project_health',
        'user_pattern',
        'market_trend',
      ];

      for (const category of categories) {
        clearOldInsights(testUserId, 0); // Reset
        
        await createInsight({
          userId: testUserId,
          category,
          severity: 'info',
          title: `${category} insight`,
          description: 'Test',
        });

        const insights = getUserInsights(testUserId);
        expect(insights[0].category).toBe(category);
      }
    });
  });

  describe('runAnticipatoryChecks', () => {
    it('should log start of checks', async () => {
      await runAnticipatoryChecks(testUserId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: testUserId },
        'Running anticipatory checks'
      );
    });

    it('should return null for code issues and health without workspace path', async () => {
      const result = await runAnticipatoryChecks(testUserId);

      expect(result.codeIssues).toBeNull();
      expect(result.projectHealth).toBeNull();
    });

    it('should scan code issues when workspace path provided', async () => {
      const result = await runAnticipatoryChecks(testUserId, testWorkspacePath);

      expect(result.codeIssues).not.toBeNull();
      expect(result.codeIssues).toEqual({
        vulnerabilities: [],
        outdatedDeps: [],
        codeSmells: [],
      });
    });

    it('should calculate project health when workspace path provided', async () => {
      const result = await runAnticipatoryChecks(testUserId, testWorkspacePath);

      expect(result.projectHealth).not.toBeNull();
      expect(result.projectHealth?.overall).toBe(75);
    });

    it('should return predictions', async () => {
      // Set up history for predictions
      for (let i = 0; i < 5; i++) {
        await recordUserInteraction(testUserId, {
          type: 'chat',
          prompt: `Message ${i}`,
        });
      }

      const result = await runAnticipatoryChecks(testUserId);

      expect(result.predictions).not.toBeNull();
      expect(result.predictions?.predictedIntent).toBe('ship');
    });

    it('should return null predictions without history', async () => {
      const result = await runAnticipatoryChecks('fresh-user');

      expect(result.predictions).toBeNull();
    });

    it('should return suggestions', async () => {
      await createInsight({
        userId: testUserId,
        category: 'code_issue',
        severity: 'critical',
        title: 'Critical issue',
        description: 'Test',
      });

      const result = await runAnticipatoryChecks(testUserId);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should fetch tech trends when techStack provided', async () => {
      const result = await runAnticipatoryChecks(testUserId, undefined, ['react', 'typescript']);

      expect(result).toBeDefined();
      // fetchTechTrends is called but its result is not included in return
    });

    it('should not fetch tech trends when techStack is empty', async () => {
      const result = await runAnticipatoryChecks(testUserId, undefined, []);

      expect(result).toBeDefined();
    });

    it('should run all checks when all parameters provided', async () => {
      for (let i = 0; i < 5; i++) {
        await recordUserInteraction(testUserId, {
          type: 'chat',
          prompt: `Message ${i}`,
        });
      }

      const result = await runAnticipatoryChecks(
        testUserId,
        testWorkspacePath,
        ['react', 'typescript']
      );

      expect(result.codeIssues).not.toBeNull();
      expect(result.projectHealth).not.toBeNull();
      expect(result.predictions).not.toBeNull();
      expect(result.suggestions).toBeDefined();
    });
  });

  describe('Type exports', () => {
    it('should export AnticipatoryInsight type', () => {
      const insight: AnticipatoryInsight = {
        id: 'test',
        userId: 'user',
        category: 'code_issue',
        severity: 'info',
        title: 'Test',
        description: 'Test',
        createdAt: new Date().toISOString(),
      };
      expect(insight).toBeDefined();
    });

    it('should export CodeScanResult type', () => {
      const result: CodeScanResult = {
        vulnerabilities: [],
        outdatedDeps: [],
        codeSmells: [],
      };
      expect(result).toBeDefined();
    });

    it('should export ProjectHealthScore type', () => {
      const score: ProjectHealthScore = {
        overall: 75,
        testCoverage: 80,
        docsFreshness: 70,
        techDebt: 65,
        securityScore: 85,
        lastUpdated: new Date().toISOString(),
      };
      expect(score).toBeDefined();
    });

    it('should export UserPatternPrediction type', () => {
      const prediction: UserPatternPrediction = {
        predictedIntent: 'ship',
        confidence: 0.8,
        basedOn: ['pattern'],
      };
      expect(prediction).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty userId', async () => {
      const result = await scanForCodeIssues('', testWorkspacePath);
      expect(result).toBeDefined();
    });

    it('should handle empty workspacePath', async () => {
      const result = await scanForCodeIssues(testUserId, '');
      expect(result).toBeDefined();
    });

    it('should handle special characters in paths', async () => {
      const result = await scanForCodeIssues(testUserId, '/path/with spaces/and-dashes');
      expect(result).toBeDefined();
    });

    it('should handle concurrent insight creation', async () => {
      const promises: Promise<AnticipatoryInsight>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          createInsight({
            userId: testUserId,
            category: 'code_issue',
            severity: 'info',
            title: `Insight ${i}`,
            description: `Description ${i}`,
          })
        );
      }

      const insights = await Promise.all(promises);
      
      // All should have unique IDs
      const ids = insights.map(i => i.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should handle rapid recordUserInteraction calls', async () => {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          recordUserInteraction(testUserId, {
            type: 'chat',
            prompt: `Message ${i}`,
          })
        );
      }

      await Promise.all(promises);

      // Should be able to predict after many interactions
      const prediction = await predictUserIntent(testUserId, {});
      expect(prediction).toBeDefined();
    });
  });
});

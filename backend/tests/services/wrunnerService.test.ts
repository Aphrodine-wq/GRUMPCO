import { describe, it, expect } from 'vitest';
import { generateFixPlan, hasAutoFixableIssues } from '../../src/services/wrunnerService.js';
import type { WRunnerAnalysis } from '../../src/types/agents.js';

function makeIssue(overrides: Partial<WRunnerAnalysis['issues'][0]> = {}): WRunnerAnalysis['issues'][0] {
  return {
    id: 'i1',
    description: 'Test issue',
    category: 'quality',
    severity: 'medium',
    affectedAgents: ['frontend'],
    suggestedFixes: [{ action: 'Fix it', code: 'const x = 1;', files: ['a.ts'] }],
    ...overrides,
  } as WRunnerAnalysis['issues'][0];
}

describe('wrunnerService', () => {
  describe('generateFixPlan', () => {
    it('should classify auto-fixable issues (quality, non-critical, with code/files)', () => {
      const analysis = {
        sessionId: 's1',
        issues: [
          makeIssue({ id: 'i1', category: 'quality', severity: 'medium' }),
          makeIssue({ id: 'i2', category: 'missing', severity: 'low' }),
        ],
      } as WRunnerAnalysis;

      const plan = generateFixPlan(analysis);
      expect(plan.autoFixable).toHaveLength(2);
      expect(plan.manualFix).toHaveLength(0);
    });

    it('should not auto-fix critical issues', () => {
      const analysis = {
        sessionId: 's1',
        issues: [makeIssue({ id: 'i1', severity: 'critical' })],
      } as WRunnerAnalysis;

      const plan = generateFixPlan(analysis);
      expect(plan.autoFixable).toHaveLength(0);
      expect(plan.manualFix).toHaveLength(1);
    });

    it('should classify issues without code/files as manual', () => {
      const analysis = {
        sessionId: 's1',
        issues: [makeIssue({ suggestedFixes: [{ action: 'manual review', code: undefined, files: [] }] as any })],
      } as WRunnerAnalysis;

      const plan = generateFixPlan(analysis);
      expect(plan.autoFixable).toHaveLength(0);
      expect(plan.manualFix).toHaveLength(1);
    });

    it('should put critical and high issues in priority list', () => {
      const analysis = {
        sessionId: 's1',
        issues: [
          makeIssue({ id: 'i1', severity: 'low' }),
          makeIssue({ id: 'i2', severity: 'critical' }),
          makeIssue({ id: 'i3', severity: 'high' }),
          makeIssue({ id: 'i4', severity: 'medium' }),
        ],
      } as WRunnerAnalysis;

      const plan = generateFixPlan(analysis);
      expect(plan.priority).toHaveLength(2);
      expect(plan.priority[0].severity).toBe('critical');
      expect(plan.priority[1].severity).toBe('high');
    });

    it('should handle empty issues array', () => {
      const plan = generateFixPlan({ sessionId: 's1', issues: [] } as WRunnerAnalysis);
      expect(plan.autoFixable).toEqual([]);
      expect(plan.manualFix).toEqual([]);
      expect(plan.priority).toEqual([]);
    });

    it('should classify inconsistency category as auto-fixable', () => {
      const analysis = {
        sessionId: 's1',
        issues: [makeIssue({ category: 'inconsistency', severity: 'medium' })],
      } as WRunnerAnalysis;

      const plan = generateFixPlan(analysis);
      expect(plan.autoFixable).toHaveLength(1);
    });

    it('should classify security category as manual', () => {
      const analysis = {
        sessionId: 's1',
        issues: [makeIssue({ category: 'security' as any, severity: 'high' })],
      } as WRunnerAnalysis;

      const plan = generateFixPlan(analysis);
      expect(plan.autoFixable).toHaveLength(0);
      expect(plan.manualFix).toHaveLength(1);
    });
  });

  describe('hasAutoFixableIssues', () => {
    it('should return true when auto-fixable issues exist', () => {
      const analysis = {
        sessionId: 's1',
        autoFixable: true,
        issues: [makeIssue({ category: 'missing', severity: 'medium' })],
      } as WRunnerAnalysis;

      expect(hasAutoFixableIssues(analysis)).toBe(true);
    });

    it('should return false when autoFixable flag is false', () => {
      const analysis = {
        sessionId: 's1',
        autoFixable: false,
        issues: [makeIssue({ category: 'missing', severity: 'medium' })],
      } as WRunnerAnalysis;

      expect(hasAutoFixableIssues(analysis)).toBe(false);
    });

    it('should return false when all issues are critical', () => {
      const analysis = {
        sessionId: 's1',
        autoFixable: true,
        issues: [makeIssue({ severity: 'critical' })],
      } as WRunnerAnalysis;

      expect(hasAutoFixableIssues(analysis)).toBe(false);
    });

    it('should return false when no suggested fixes exist', () => {
      const analysis = {
        sessionId: 's1',
        autoFixable: true,
        issues: [makeIssue({ suggestedFixes: [] })],
      } as WRunnerAnalysis;

      expect(hasAutoFixableIssues(analysis)).toBe(false);
    });

    it('should return false for empty issues', () => {
      const analysis = {
        sessionId: 's1',
        autoFixable: true,
        issues: [],
      } as WRunnerAnalysis;

      expect(hasAutoFixableIssues(analysis)).toBe(false);
    });
  });
});

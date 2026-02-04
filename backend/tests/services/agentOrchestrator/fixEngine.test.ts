import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/middleware/logger.js', () => {
  const noop = () => {};
  const child = () => log;
  const log = { info: noop, warn: noop, error: noop, debug: noop, child };
  return { default: log, getRequestLogger: () => log };
});

vi.mock('../../../src/services/wrunnerService.js', () => ({
  generateFixPlan: vi.fn(),
}));

import { generateFixPlan } from '../../../src/services/wrunnerService.js';
import { applyAutoFixes, validateFixes, regenerateAgentOutput } from '../../../src/services/agentOrchestrator/fixEngine.js';
import type { GenerationSession, WRunnerAnalysis } from '../../../src/types/agents.js';

function makeSession(overrides?: Partial<GenerationSession>): GenerationSession {
  return {
    sessionId: 'sess_1',
    status: 'running',
    agents: {
      architect: { taskId: 't1', agentType: 'architect', description: '', input: {}, status: 'completed' },
      frontend: { taskId: 't2', agentType: 'frontend', description: '', input: {}, status: 'completed' },
      backend: { taskId: 't3', agentType: 'backend', description: '', input: {}, status: 'pending' },
    } as any,
    generatedFiles: [{ path: 'a.ts', content: 'code', type: 'source', language: 'typescript', size: 4 }],
    ...overrides,
  } as GenerationSession;
}

describe('agentOrchestrator/fixEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('applyAutoFixes', () => {
    it('should apply all auto-fixable issues', async () => {
      const analysis: WRunnerAnalysis = {
        sessionId: 'sess_1',
        issues: [
          {
            id: 'i1',
            description: 'Missing index',
            category: 'missing',
            severity: 'medium',
            affectedAgents: ['frontend'],
            suggestedFixes: [{ action: 'Add index.ts' }],
          },
        ],
      } as WRunnerAnalysis;

      (generateFixPlan as ReturnType<typeof vi.fn>).mockReturnValue({
        autoFixable: analysis.issues,
        manualRequired: [],
      });

      const session = makeSession();
      const fixes = await applyAutoFixes(session, analysis);

      expect(fixes).toHaveLength(1);
      expect(fixes[0].issueId).toBe('i1');
      expect(fixes[0].status).toBe('applied');
      expect(session.autoFixesApplied).toHaveLength(1);
    });

    it('should handle empty fix plan', async () => {
      (generateFixPlan as ReturnType<typeof vi.fn>).mockReturnValue({
        autoFixable: [],
        manualRequired: [],
      });

      const session = makeSession();
      const fixes = await applyAutoFixes(session, { issues: [] } as any);
      expect(fixes).toEqual([]);
    });
  });

  describe('validateFixes', () => {
    it('should return valid when all expected fixes applied', () => {
      const analysis: WRunnerAnalysis = {
        sessionId: 'sess_1',
        issues: [
          {
            id: 'i1',
            category: 'missing',
            severity: 'medium',
            suggestedFixes: [{ action: 'fix' }],
          },
        ],
      } as any;

      const appliedFixes = [{ issueId: 'i1', fix: 'fix', status: 'applied' as const }];
      const session = makeSession();
      const result = validateFixes(session, analysis, appliedFixes);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should report missing fixes', () => {
      const analysis: WRunnerAnalysis = {
        sessionId: 'sess_1',
        issues: [
          {
            id: 'i1',
            category: 'quality',
            severity: 'medium',
            suggestedFixes: [{ action: 'fix' }],
          },
        ],
      } as any;

      const result = validateFixes(makeSession(), analysis, []);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Fix for issue i1 was not applied');
    });

    it('should report failed fixes', () => {
      const analysis = { sessionId: 'sess_1', issues: [] } as any;
      const appliedFixes = [{ issueId: 'i1', fix: 'fix', status: 'failed' as const }];
      const result = validateFixes(makeSession(), analysis, appliedFixes);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('1 fixes failed to apply');
    });

    it('should skip critical severity issues from expected set', () => {
      const analysis: WRunnerAnalysis = {
        sessionId: 'sess_1',
        issues: [
          {
            id: 'i1',
            category: 'missing',
            severity: 'critical',
            suggestedFixes: [{ action: 'fix' }],
          },
        ],
      } as any;

      const result = validateFixes(makeSession(), analysis, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('regenerateAgentOutput', () => {
    it('should throw for incomplete agents', async () => {
      const session = makeSession();
      await expect(regenerateAgentOutput(session, 'backend', [])).rejects.toThrow(
        'Agent backend has not completed or does not exist'
      );
    });

    it('should return files for completed agents', async () => {
      const session = makeSession();
      const files = await regenerateAgentOutput(session, 'architect', []);
      expect(files).toHaveLength(1);
    });
  });
});

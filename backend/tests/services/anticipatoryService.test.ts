import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockLogger,
  mockGetDatabase,
  mockWriteAuditLog,
  mockQueueAgentTask,
  mockIsAgentRunning,
  mockFs,
  mockExec,
  mockGetCompletion,
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
  mockFs: { readFile: vi.fn(), readdir: vi.fn() },
  mockExec: vi.fn(),
  mockGetCompletion: vi.fn().mockResolvedValue({ text: "{}", error: null }),
}));

vi.mock('../../src/middleware/logger.js', () => ({ default: mockLogger }));
vi.mock('../../src/db/database.js', () => ({ getDatabase: () => mockGetDatabase() }));
vi.mock('../../src/services/auditLogService.js', () => ({ writeAuditLog: (d: any) => mockWriteAuditLog(d) }));
vi.mock('../../src/services/persistentAgentService.js', () => ({
  queueAgentTask: (...args: any[]) => mockQueueAgentTask(...args),
  isAgentRunning: (id: string) => mockIsAgentRunning(id),
}));
vi.mock('fs/promises', () => ({ default: mockFs }));
vi.mock('../../src/services/llmGatewayHelper.js', () => ({ getCompletion: (...args: any[]) => mockGetCompletion(...args) }));
vi.mock('child_process', () => ({
  exec: (cmd: string, opts: any, cb: any) => {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    mockExec(cmd, opts, cb);
  },
}));
vi.mock('../../src/services/llmGatewayHelper.js', () => ({
  getCompletion: (...args: any[]) => mockGetCompletion(...args)
}));

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
} from '../../src/services/anticipatoryService.js';

describe('Anticipatory Service', () => {
  const testUserId = 'test-user-123';
  const testWorkspacePath = '/path/to/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    clearOldInsights(testUserId, 0);
    mockExec.mockImplementation((cmd, opts, cb) => cb(null, { stdout: '' }));
    mockFs.readFile.mockRejectedValue(new Error('File not found'));
    mockFs.readdir.mockResolvedValue([]);
  });

  describe('calculateProjectHealth', () => {
    it('should calculate health score (Good Health)', async () => {
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes('lcov.info')) return Promise.resolve('LF:10\nLH:8\n');
        return Promise.reject(new Error('File not found'));
      });
      mockExec.mockImplementation((cmd, opts, cb) => {
        if (cmd.includes('git log')) cb(null, { stdout: Math.floor(Date.now() / 1000 - 86400).toString() });
        else if (cmd.includes('grep')) cb(null, { stdout: '0\n' });
        else if (cmd.includes('pnpm audit')) cb(null, { stdout: JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } } }) });
        else cb(null, { stdout: '' });
      });
      const result = await calculateProjectHealth(testUserId, testWorkspacePath);
      expect(result.overall).toBe(94);
    });

    it('should calculate health score (Poor Health)', async () => {
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes('lcov.info')) return Promise.resolve('LF:10\nLH:4\n');
        if (path.includes('lint_output.txt')) return Promise.resolve('Error: 1\nError: 2\n');
        return Promise.reject(new Error('File not found'));
      });
      mockExec.mockImplementation((cmd, opts, cb) => {
        if (cmd.includes('git log')) cb(null, { stdout: Math.floor(Date.now() / 1000 - (200 * 86400)).toString() });
        else if (cmd.includes('grep')) cb(null, { stdout: '50\n' });
        else if (cmd.includes('pnpm audit')) cb(null, { stdout: JSON.stringify({ metadata: { vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0 } } }) });
        else cb(null, { stdout: '' });
      });
      const result = await calculateProjectHealth(testUserId, testWorkspacePath);
      expect(result.overall).toBe(49);
    });

    it('should handle failures gracefully', async () => {
       const result = await calculateProjectHealth(testUserId, testWorkspacePath);
       expect(result.overall).toBe(45);
    });
  });

  describe('scanForCodeIssues', () => {
    it('should return empty result if no lockfile found', async () => {
      mockFs.readdir.mockResolvedValue(['package.json']);
      const result = await scanForCodeIssues(testUserId, testWorkspacePath);
      expect(result.codeSmells).toHaveLength(1);
      expect(result.codeSmells[0].message).toContain('No lockfile found');
    });

    it('should scan npm project correctly (npm v7+ style)', async () => {
      mockFs.readdir.mockResolvedValue(['package-lock.json']);
      const auditOutput = JSON.stringify({
        vulnerabilities: {
          "vulnerable-pkg": {
             severity: "high",
             via: [{ title: "High Severity Vuln", severity: "high", cwe: ["CWE-123"] }]
          }
        }
      });
      const outdatedOutput = JSON.stringify({
        "old-pkg": { current: "1.0.0", latest: "2.0.0" }
      });

      mockExec.mockImplementation((cmd, opts, cb) => {
        if (cmd.includes('npm audit')) cb(null, { stdout: auditOutput });
        else if (cmd.includes('npm outdated')) cb(null, { stdout: outdatedOutput });
        else cb(null, { stdout: '' });
      });

      const result = await scanForCodeIssues(testUserId, testWorkspacePath);

      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.vulnerabilities[0].severity).toBe('high');
      expect(result.outdatedDeps).toHaveLength(1);
      expect(result.outdatedDeps[0].breaking).toBe(true);
    });

    it('should scan pnpm project correctly', async () => {
        mockFs.readdir.mockResolvedValue(['pnpm-lock.yaml']);
        const auditOutput = JSON.stringify({
            advisories: {
                "123": {
                    severity: "moderate",
                    title: "Moderate Vuln",
                    cwe: "CWE-456",
                    findings: [{ paths: ["pkg > subpkg"] }]
                }
            }
        });
        const outdatedOutput = JSON.stringify({
            "old-pkg": { wanted: "1.0.0", latest: "1.1.0" }
        });

        mockExec.mockImplementation((cmd, opts, cb) => {
            if (cmd.includes('pnpm audit')) cb(null, { stdout: auditOutput });
            else if (cmd.includes('pnpm outdated')) cb(null, { stdout: outdatedOutput });
            else cb(null, { stdout: '' });
        });

        const result = await scanForCodeIssues(testUserId, testWorkspacePath);

        expect(result.vulnerabilities).toHaveLength(1);
        expect(result.vulnerabilities[0].severity).toBe('moderate');
        expect(result.outdatedDeps).toHaveLength(1);
        expect(result.outdatedDeps[0].breaking).toBe(false); // 1.0.0 -> 1.1.0 is not breaking
    });

    it('should handle scan errors gracefully', async () => {
         mockFs.readdir.mockResolvedValue(['package-lock.json']);
         mockExec.mockImplementation((cmd, opts, cb) => {
             cb(new Error('Command failed'), { stdout: '' });
         });

         const result = await scanForCodeIssues(testUserId, testWorkspacePath);
         expect(result.vulnerabilities).toEqual([]);
         expect(mockLogger.warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Audit command failed'));
    });
  });

  describe('scheduleCodeScan', () => {
    it('should queue task when agent is running', async () => {
      mockIsAgentRunning.mockReturnValue(true);
      await scheduleCodeScan(testUserId, testWorkspacePath, 24);
      expect(mockQueueAgentTask).toHaveBeenCalledWith(testUserId, 'anticipatory', expect.objectContaining({ type: 'code_scan' }));
    });
  });

  describe('getProjectHealth', () => {
    it('should return cached health score', async () => {
      await calculateProjectHealth(testUserId, testWorkspacePath);
      const result = getProjectHealth(testUserId);
      expect(result).not.toBeNull();
      expect(result?.overall).toBe(45);
    });
  });

  describe('recordUserInteraction', () => {
    it('should record interaction', async () => {
      await recordUserInteraction(testUserId, { type: 'chat', prompt: 'hi' });
    });
  });

  describe('predictUserIntent', () => {
    it('should predict ship after 3 chats', async () => {
      for(let i=0; i<5; i++) await recordUserInteraction(testUserId, { type: 'chat', prompt: 'msg' });
      const result = await predictUserIntent(testUserId, {});
      expect(result?.predictedIntent).toBe('ship');
    });
  });

  describe('getProactiveSuggestions', () => {
    it('should suggest insights', async () => {
      await createInsight({ userId: testUserId, category: 'code_issue', severity: 'critical', title: 'Crit', description: 'desc' });
      const result = await getProactiveSuggestions(testUserId);
      expect(result.some(s => s.type === 'insight')).toBe(true);
    });
  });

  describe('createInsight', () => {
    it('should create insight with id', async () => {
      const insight = await createInsight({ userId: testUserId, category: 'code_issue', severity: 'info', title: 'T', description: 'D' });
      expect(insight.id).toBeDefined();
    });
  });

  describe('runAnticipatoryChecks', () => {
    it('should run checks', async () => {
      const result = await runAnticipatoryChecks(testUserId, testWorkspacePath);
      expect(result.projectHealth).toBeDefined();
    });
  });

  describe('fetchTechTrends', () => {
    it('should return trends', async () => {
      (global.fetch as any).mockResolvedValue({
         ok: true,
         json: async () => ([{
            title: 'React 19',
            url: 'http://react.com',
            description: 'New features',
            positive_reactions_count: 100,
            published_at: '2024-01-01'
         },
         {
             title: 'React 19 beta',
             url: 'http://react.com',
             description: 'New features',
             points: 100,
             created_at: '2024-01-01',
             objectID: '123'
         }])
      });
      mockGetCompletion.mockResolvedValue({
        text: JSON.stringify([{ title: 'React 19', summary: 'Good stuff', relevance: 0.9 }]),
        error: null
      });

      const result = await fetchTechTrends(testUserId, ['react']);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('scheduleTrendCheck', () => {
    it('should schedule check', async () => {
      mockIsAgentRunning.mockReturnValue(true);
      await scheduleTrendCheck(testUserId, ['react']);
      expect(mockQueueAgentTask).toHaveBeenCalled();
    });
  });

  describe('getUserInsights', () => {
    it('should get insights', async () => {
      await createInsight({ userId: testUserId, category: 'code_issue', severity: 'info', title: 'T', description: 'D' });
      const result = getUserInsights(testUserId);
      expect(result.length).toBe(1);
    });
  });

  describe('acknowledgeInsight', () => {
      it('should acknowledge', async () => {
          const insight = await createInsight({ userId: testUserId, category: 'code_issue', severity: 'info', title: 'T', description: 'D' });
          await acknowledgeInsight(testUserId, insight.id);
          expect(getUserInsights(testUserId)[0].acknowledgedAt).toBeDefined();
      });
  });

  describe('markInsightActioned', () => {
      it('should mark actioned', async () => {
          const insight = await createInsight({ userId: testUserId, category: 'code_issue', severity: 'info', title: 'T', description: 'D' });
          await markInsightActioned(testUserId, insight.id);
          expect(getUserInsights(testUserId)[0].actionTakenAt).toBeDefined();
      });
  });

  describe('clearOldInsights', () => {
      it('should clear old insights', async () => {
          await createInsight({ userId: testUserId, category: 'code_issue', severity: 'info', title: 'T', description: 'D' });
          clearOldInsights(testUserId, 0);
          expect(getUserInsights(testUserId).length).toBe(0);
      });
  });

});

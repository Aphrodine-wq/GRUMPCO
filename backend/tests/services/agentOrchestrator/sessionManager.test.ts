import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
const mockDb = {
  saveSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockResolvedValue(null),
};
vi.mock('../../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

vi.mock('../../../src/middleware/logger.js', () => {
  const noop = () => {};
  const child = () => log;
  const log = { info: noop, warn: noop, error: noop, debug: noop, child };
  return { default: log, getRequestLogger: () => log };
});

vi.mock('../../../src/services/agentOrchestrator/shared.js', () => ({
  DEFAULT_AGENT_MODEL: 'test-model',
  resilientLlmCall: vi.fn(),
}));

import { getDatabase } from '../../../src/db/database.js';
import { resilientLlmCall } from '../../../src/services/agentOrchestrator/shared.js';
import {
  initializeSession,
  getSession,
  initializeAgentTask,
  defaultComponentMapping,
  getPrdsAndSubTasksForAgent,
  breakPrdIntoSubTasks,
} from '../../../src/services/agentOrchestrator/sessionManager.js';
import type { GenerationSession, AgentType } from '../../../src/types/agents.js';
import type { PRD } from '../../../src/types/prd.js';

describe('agentOrchestrator/sessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeAgentTask', () => {
    it('should create a pending task with correct agent type', () => {
      const task = initializeAgentTask('frontend', 'Generate frontend');
      expect(task.agentType).toBe('frontend');
      expect(task.description).toBe('Generate frontend');
      expect(task.status).toBe('pending');
      expect(task.taskId).toContain('task_frontend_');
      expect(task.input).toEqual({});
    });
  });

  describe('initializeSession', () => {
    it('should create a session with all agent tasks', async () => {
      const session = await initializeSession({
        prdId: 'prd_1',
        architectureId: 'arch_1',
        preferences: {
          frontendFramework: 'vue',
          backendRuntime: 'node',
          database: 'postgres',
        },
      });

      expect(session.sessionId).toMatch(/^session_/);
      expect(session.status).toBe('initializing');
      expect(session.prdId).toBe('prd_1');
      expect(session.agents.architect.agentType).toBe('architect');
      expect(session.agents.frontend.agentType).toBe('frontend');
      expect(session.agents.backend.agentType).toBe('backend');
      expect(session.agents.devops.agentType).toBe('devops');
      expect(session.agents.test.agentType).toBe('test');
      expect(session.agents.docs.agentType).toBe('docs');
      expect(session.agents.security.agentType).toBe('security');
      expect(session.agents.i18n.agentType).toBe('i18n');
      expect(session.agents.wrunner.agentType).toBe('wrunner');
      expect(session.generatedFiles).toEqual([]);

      const db = getDatabase();
      expect(db.saveSession).toHaveBeenCalledOnce();
    });
  });

  describe('getSession', () => {
    it('should delegate to database getSession', async () => {
      const mockSession = { sessionId: 'test' } as GenerationSession;
      mockDb.getSession.mockResolvedValueOnce(mockSession);

      const result = await getSession('test');
      expect(result).toBe(mockSession);
      expect(mockDb.getSession).toHaveBeenCalledWith('test');
    });

    it('should return null for unknown session', async () => {
      const result = await getSession('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('breakPrdIntoSubTasks', () => {
    it('should parse sub-tasks from LLM response', async () => {
      (resilientLlmCall as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: '[{"id":"t1","title":"Setup project","status":"pending"},{"id":"t2","title":"Add auth","status":"pending"}]',
        error: null,
      });

      const prd = { id: 'prd_1', sections: { overview: 'A todo app' } } as PRD;
      const tasks = await breakPrdIntoSubTasks(prd);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('t1');
      expect(tasks[0].title).toBe('Setup project');
      expect(tasks[0].status).toBe('pending');
    });

    it('should extract JSON array from wrapped response', async () => {
      (resilientLlmCall as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: 'Here are the tasks:\n[{"id":"t1","title":"Task 1"}]\nDone.',
        error: null,
      });

      const prd = { id: 'prd_1', sections: {} } as PRD;
      const tasks = await breakPrdIntoSubTasks(prd);
      expect(tasks).toHaveLength(1);
    });

    it('should return empty array on LLM error', async () => {
      (resilientLlmCall as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: '',
        error: 'API unavailable',
      });

      const prd = { id: 'prd_1', sections: {} } as PRD;
      const tasks = await breakPrdIntoSubTasks(prd);
      expect(tasks).toEqual([]);
    });

    it('should return empty array on parse failure', async () => {
      (resilientLlmCall as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: 'not json at all',
        error: null,
      });

      const prd = { id: 'prd_1', sections: {} } as PRD;
      const tasks = await breakPrdIntoSubTasks(prd);
      expect(tasks).toEqual([]);
    });

    it('should assign default ids and titles for missing fields', async () => {
      (resilientLlmCall as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: '[{}, {"title": "Only title"}]',
        error: null,
      });

      const prd = { id: 'prd_1', sections: {} } as PRD;
      const tasks = await breakPrdIntoSubTasks(prd);
      expect(tasks[0].id).toBe('task_0');
      expect(tasks[0].title).toBe('Task 1');
      expect(tasks[1].title).toBe('Only title');
    });
  });

  describe('defaultComponentMapping', () => {
    it('should map frontend labels to frontend agent', () => {
      const prds = [
        { prd: { id: 'p1' } as PRD, componentLabel: 'Frontend Dashboard' },
        { prd: { id: 'p2' } as PRD, componentLabel: 'UI Components' },
      ];
      const mapping = defaultComponentMapping(prds);
      expect(mapping.frontend).toEqual(['p1', 'p2']);
    });

    it('should map backend/api labels to backend agent', () => {
      const prds = [
        { prd: { id: 'p1' } as PRD, componentLabel: 'API Layer' },
        { prd: { id: 'p2' } as PRD, componentLabel: 'Auth Service' },
        { prd: { id: 'p3' } as PRD, componentLabel: 'Backend Core' },
      ];
      const mapping = defaultComponentMapping(prds);
      expect(mapping.backend).toEqual(['p1', 'p2', 'p3']);
    });

    it('should default unlabeled PRDs to backend', () => {
      const prds = [
        { prd: { id: 'p1' } as PRD, componentLabel: '' },
        { prd: { id: 'p2' } as PRD },
      ];
      const mapping = defaultComponentMapping(prds as any);
      expect(mapping.backend).toEqual(['p1', 'p2']);
    });
  });

  describe('getPrdsAndSubTasksForAgent', () => {
    it('should return all PRDs and sub-tasks when no mapping exists', () => {
      const session = {
        prds: [{ id: 'p1' } as PRD, { id: 'p2' } as PRD],
        subTasksByPrdId: {
          p1: [{ id: 't1', title: 'Task 1', status: 'pending' as const }],
          p2: [{ id: 't2', title: 'Task 2', status: 'pending' as const }],
        },
      } as unknown as GenerationSession;

      const result = getPrdsAndSubTasksForAgent(session, 'frontend');
      expect(result.prds).toHaveLength(2);
      expect(result.subTasks).toHaveLength(2);
    });

    it('should filter by component mapping when present', () => {
      const session = {
        prds: [{ id: 'p1' } as PRD, { id: 'p2' } as PRD],
        componentMapping: { frontend: ['p1'] },
        subTasksByPrdId: {
          p1: [{ id: 't1', title: 'Task 1', status: 'pending' as const }],
          p2: [{ id: 't2', title: 'Task 2', status: 'pending' as const }],
        },
      } as unknown as GenerationSession;

      const result = getPrdsAndSubTasksForAgent(session, 'frontend');
      expect(result.prds).toHaveLength(1);
      expect(result.prds[0].id).toBe('p1');
      expect(result.subTasks).toHaveLength(1);
    });

    it('should handle empty session gracefully', () => {
      const session = {} as GenerationSession;
      const result = getPrdsAndSubTasksForAgent(session, 'backend');
      expect(result.prds).toEqual([]);
      expect(result.subTasks).toEqual([]);
    });
  });
});

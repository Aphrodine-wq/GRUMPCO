/**
 * Ship Code Service (Ship Mode Service) Unit Tests
 *
 * Comprehensive tests for the SHIP mode workflow orchestration service.
 * Tests the sequential Design → Spec → Plan → Code workflow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to declare mocks that will be hoisted with vi.mock
const {
  mockSaveShipSession,
  mockGetShipSession,
  mockGenerateArchitecture,
  mockGeneratePRD,
  mockGenerateCreativeDesignDoc,
  mockStartSpecSession,
  mockGenerateSpecification,
  mockGeneratePlan,
  mockApprovePlan,
  mockInitializeSession,
  mockExecuteCodeGeneration,
  mockDispatchWebhook,
} = vi.hoisted(() => ({
  mockSaveShipSession: vi.fn(),
  mockGetShipSession: vi.fn(),
  mockGenerateArchitecture: vi.fn(),
  mockGeneratePRD: vi.fn(),
  mockGenerateCreativeDesignDoc: vi.fn(),
  mockStartSpecSession: vi.fn(),
  mockGenerateSpecification: vi.fn(),
  mockGeneratePlan: vi.fn(),
  mockApprovePlan: vi.fn(),
  mockInitializeSession: vi.fn(),
  mockExecuteCodeGeneration: vi.fn(),
  mockDispatchWebhook: vi.fn(),
}));

vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    saveShipSession: mockSaveShipSession,
    getShipSession: mockGetShipSession,
  })),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  getRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../src/services/architectureService.js', () => ({
  generateArchitecture: mockGenerateArchitecture,
}));

vi.mock('../../src/services/prdGeneratorService.js', () => ({
  generatePRD: mockGeneratePRD,
}));

vi.mock('../../src/services/creativeDesignDocService.js', () => ({
  generateCreativeDesignDoc: mockGenerateCreativeDesignDoc,
}));

vi.mock('../../src/services/specService.js', () => ({
  startSpecSession: mockStartSpecSession,
  generateSpecification: mockGenerateSpecification,
}));

vi.mock('../../src/services/planService.js', () => ({
  generatePlan: mockGeneratePlan,
  approvePlan: mockApprovePlan,
}));

vi.mock('../../src/services/agentOrchestrator.js', () => ({
  initializeSession: mockInitializeSession,
  executeCodeGeneration: mockExecuteCodeGeneration,
}));

vi.mock('../../src/services/webhookService.js', () => ({
  dispatchWebhook: mockDispatchWebhook,
}));

vi.mock('../../src/prompts/head.js', () => ({
  getHeadSystemPrompt: vi.fn(() => 'Head system prompt'),
}));

vi.mock('../../src/prompts/chat/index.js', () => ({
  getChatModePrompt: vi.fn((mode: string) => `${mode} mode prompt`),
}));

import {
  startShipMode,
  getShipSession,
  executeDesignPhase,
  executeSpecPhase,
  executePlanPhase,
  executeCodePhase,
  executeShipMode,
} from '../../src/services/shipModeService.js';

// Helper to create mock design result
function createMockDesignResult() {
  return {
    phase: 'design' as const,
    status: 'completed' as const,
    architecture: {
      id: 'arch-123',
      projectName: 'Todo App',
      projectDescription: 'A todo app',
      projectType: 'general' as const,
      complexity: 'mvp' as const,
      techStack: ['node', 'vue'],
      c4Diagrams: { context: '', container: '', component: '' },
      metadata: { components: [], integrations: [], dataModels: [], apiEndpoints: [], technologies: {} },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    prd: {
      id: 'prd-123',
      projectName: 'Todo App',
      projectDescription: 'A todo app',
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: {
        overview: { vision: 'Vision', problem: 'Problem', solution: 'Solution', targetMarket: 'Market' },
        personas: [],
        features: [],
        userStories: [],
        nonFunctionalRequirements: [],
        apis: [],
        dataModels: [],
        successMetrics: [],
      },
    },
    creativeDesignDoc: {},
    completedAt: new Date().toISOString(),
  };
}

// Helper to create mock spec result
function createMockSpecResult() {
  return {
    phase: 'spec' as const,
    status: 'completed' as const,
    specification: {
      id: 'spec-123',
      title: 'Todo App Specification',
      description: 'Specification for todo app',
      sections: {
        requirements: [
          { id: 'req-1', title: 'Requirement 1', description: 'User can add todos', priority: 'high' as const, acceptanceCriteria: ['AC1'] },
        ],
      },
      metadata: { generatedAt: new Date().toISOString(), sessionId: 'spec-session-123' },
    },
    completedAt: new Date().toISOString(),
  };
}

// Helper to create mock plan result
function createMockPlanResult() {
  return {
    phase: 'plan' as const,
    status: 'completed' as const,
    plan: {
      id: 'plan-123',
      title: 'Implementation Plan',
      description: 'Plan to implement todo app',
      steps: [{ id: 'step-1', description: 'Setup project', status: 'pending' as const }],
      phases: [],
      totalEstimatedTime: 3600,
      status: 'approved' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    completedAt: new Date().toISOString(),
  };
}

describe('Ship Mode Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveShipSession.mockResolvedValue(undefined);
    mockGetShipSession.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startShipMode', () => {
    it('should create a new SHIP mode session', async () => {
      const request = {
        projectDescription: 'A test project for building a todo app',
        preferences: {
          frontendFramework: 'vue' as const,
          backendRuntime: 'node' as const,
        },
      };

      const session = await startShipMode(request);

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^ship_/);
      expect(session.projectDescription).toBe(request.projectDescription);
      expect(session.phase).toBe('design');
      expect(session.status).toBe('initializing');
      expect(session.preferences).toEqual(request.preferences);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it('should save session to database', async () => {
      const request = {
        projectDescription: 'Test project',
      };

      await startShipMode(request);

      expect(mockSaveShipSession).toHaveBeenCalledWith(
        expect.objectContaining({
          projectDescription: 'Test project',
          phase: 'design',
          status: 'initializing',
        })
      );
    });

    it('should include project ID when provided', async () => {
      const request = {
        projectDescription: 'Test project',
        projectId: 'project-123',
      };

      const session = await startShipMode(request);

      expect(session.projectId).toBe('project-123');
    });

    it('should handle empty preferences', async () => {
      const request = {
        projectDescription: 'Test project',
      };

      const session = await startShipMode(request);

      expect(session.preferences).toBeUndefined();
    });

    it('should generate unique session IDs', async () => {
      const request1 = { projectDescription: 'Project 1' };
      const request2 = { projectDescription: 'Project 2' };

      const session1 = await startShipMode(request1);
      const session2 = await startShipMode(request2);

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('getShipSession', () => {
    it('should retrieve session by ID', async () => {
      const mockSession = {
        id: 'ship_123',
        projectDescription: 'Test',
        phase: 'design',
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockGetShipSession.mockResolvedValueOnce(mockSession);

      const session = await getShipSession('ship_123');

      expect(session).toEqual(mockSession);
      expect(mockGetShipSession).toHaveBeenCalledWith('ship_123');
    });

    it('should return null for non-existent session', async () => {
      mockGetShipSession.mockResolvedValueOnce(null);

      const session = await getShipSession('non-existent');

      expect(session).toBeNull();
    });
  });

  describe('executeDesignPhase', () => {
    const mockSession = {
      id: 'ship_123',
      projectDescription: 'Build a todo app',
      phase: 'design' as const,
      status: 'initializing' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should execute design phase successfully', async () => {
      mockGenerateArchitecture.mockResolvedValueOnce({
        status: 'success',
        architecture: createMockDesignResult().architecture,
      });

      mockGeneratePRD.mockResolvedValueOnce({
        status: 'success',
        prd: createMockDesignResult().prd,
      });

      mockGenerateCreativeDesignDoc.mockResolvedValueOnce({
        layout: 'sidebar',
        keyScreens: [],
        uxFlows: [],
      });

      const result = await executeDesignPhase(mockSession);

      expect(result.phase).toBe('design');
      expect(result.status).toBe('completed');
      expect(result.architecture).toBeDefined();
      expect(result.prd).toBeDefined();
      expect(result.creativeDesignDoc).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });

    it('should handle architecture generation failure', async () => {
      mockGenerateArchitecture.mockResolvedValueOnce({
        status: 'error',
        error: 'Architecture generation failed',
      });

      const result = await executeDesignPhase(mockSession);

      expect(result.phase).toBe('design');
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Architecture generation failed');
    });

    it('should handle PRD generation failure', async () => {
      mockGenerateArchitecture.mockResolvedValueOnce({
        status: 'success',
        architecture: createMockDesignResult().architecture,
      });

      mockGeneratePRD.mockResolvedValueOnce({
        status: 'error',
        error: 'PRD generation failed',
      });

      const result = await executeDesignPhase(mockSession);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('PRD generation failed');
    });

    it('should update session status during execution', async () => {
      mockGenerateArchitecture.mockResolvedValueOnce({
        status: 'success',
        architecture: createMockDesignResult().architecture,
      });

      mockGeneratePRD.mockResolvedValueOnce({
        status: 'success',
        prd: createMockDesignResult().prd,
      });

      mockGenerateCreativeDesignDoc.mockResolvedValueOnce({});

      await executeDesignPhase(mockSession);

      // Should save session multiple times during execution
      expect(mockSaveShipSession).toHaveBeenCalled();
    });

    it('should use tech stack preferences', async () => {
      const sessionWithPrefs = {
        ...mockSession,
        preferences: {
          backendRuntime: 'node' as const,
          frontendFramework: 'vue' as const,
        },
      };

      mockGenerateArchitecture.mockResolvedValueOnce({
        status: 'success',
        architecture: createMockDesignResult().architecture,
      });

      mockGeneratePRD.mockResolvedValueOnce({
        status: 'success',
        prd: createMockDesignResult().prd,
      });

      mockGenerateCreativeDesignDoc.mockResolvedValueOnce({});

      await executeDesignPhase(sessionWithPrefs);

      expect(mockGenerateArchitecture).toHaveBeenCalledWith(
        expect.objectContaining({
          techStack: expect.arrayContaining(['node', 'vue']),
        })
      );
    });
  });

  describe('executeSpecPhase', () => {
    const mockSession = {
      id: 'ship_123',
      projectDescription: 'Build a todo app',
      phase: 'spec' as const,
      status: 'running' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        workspaceRoot: '/test/workspace',
      },
    };

    it('should execute spec phase successfully', async () => {
      const designResult = createMockDesignResult();

      mockStartSpecSession.mockResolvedValueOnce({
        id: 'spec-session-123',
      });

      mockGenerateSpecification.mockResolvedValueOnce({
        specification: createMockSpecResult().specification,
      });

      const result = await executeSpecPhase(mockSession, designResult as any);

      expect(result.phase).toBe('spec');
      expect(result.status).toBe('completed');
      expect(result.specification).toBeDefined();
    });

    it('should handle specification generation failure', async () => {
      const designResult = createMockDesignResult();

      mockStartSpecSession.mockResolvedValueOnce({
        id: 'spec-session-123',
      });

      mockGenerateSpecification.mockResolvedValueOnce({
        specification: null,
      });

      const result = await executeSpecPhase(mockSession, designResult as any);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Specification generation failed');
    });

    it('should pass design context to spec generator', async () => {
      const designResult = createMockDesignResult();

      mockStartSpecSession.mockResolvedValueOnce({
        id: 'spec-session-123',
      });

      mockGenerateSpecification.mockResolvedValueOnce({
        specification: createMockSpecResult().specification,
      });

      await executeSpecPhase(mockSession, designResult as any);

      expect(mockGenerateSpecification).toHaveBeenCalledWith(
        expect.objectContaining({
          designContext: expect.objectContaining({
            projectDescription: mockSession.projectDescription,
          }),
        })
      );
    });
  });

  describe('executePlanPhase', () => {
    const mockSession = {
      id: 'ship_123',
      projectDescription: 'Build a todo app',
      phase: 'plan' as const,
      status: 'running' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        workspaceRoot: '/test/workspace',
      },
    };

    it('should execute plan phase successfully', async () => {
      const specResult = createMockSpecResult();

      mockGeneratePlan.mockResolvedValueOnce(createMockPlanResult().plan);
      mockApprovePlan.mockResolvedValueOnce(undefined);

      const result = await executePlanPhase(mockSession, specResult as any);

      expect(result.phase).toBe('plan');
      expect(result.status).toBe('completed');
      expect(result.plan).toBeDefined();
      expect(result.plan.id).toBe('plan-123');
    });

    it('should auto-approve the plan', async () => {
      const specResult = createMockSpecResult();

      mockGeneratePlan.mockResolvedValueOnce(createMockPlanResult().plan);
      mockApprovePlan.mockResolvedValueOnce(undefined);

      await executePlanPhase(mockSession, specResult as any);

      expect(mockApprovePlan).toHaveBeenCalledWith('plan-123');
    });

    it('should handle plan generation failure', async () => {
      const specResult = createMockSpecResult();

      mockGeneratePlan.mockRejectedValueOnce(new Error('Plan generation failed'));

      const result = await executePlanPhase(mockSession, specResult as any);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Plan generation failed');
    });
  });

  describe('executeCodePhase', () => {
    const mockSession = {
      id: 'ship_123',
      projectDescription: 'Build a todo app',
      phase: 'code' as const,
      status: 'running' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        frontendFramework: 'vue' as const,
        backendRuntime: 'node' as const,
        includeTests: true,
        includeDocs: true,
      },
    };

    it('should execute code phase successfully', async () => {
      const planResult = createMockPlanResult();
      const designResult = createMockDesignResult();

      const mockGenSession = {
        sessionId: 'gen-123',
        status: 'completed',
        prdId: 'prd-123',
        architectureId: 'arch-123',
        createdAt: new Date().toISOString(),
        agents: {},
        preferences: {},
      };

      mockInitializeSession.mockResolvedValueOnce(mockGenSession);
      mockExecuteCodeGeneration.mockResolvedValueOnce(undefined);

      const result = await executeCodePhase(mockSession, planResult as any, designResult as any);

      expect(result.phase).toBe('code');
      expect(result.status).toBe('completed');
      expect(result.session).toBeDefined();
      expect(result.session.sessionId).toBe('gen-123');
    });

    it('should initialize session with correct preferences', async () => {
      const planResult = createMockPlanResult();
      const designResult = createMockDesignResult();

      mockInitializeSession.mockResolvedValueOnce({
        sessionId: 'gen-123',
        status: 'pending',
        prdId: 'prd-123',
        architectureId: 'arch-123',
        createdAt: new Date().toISOString(),
        agents: {},
        preferences: {},
      });
      mockExecuteCodeGeneration.mockResolvedValueOnce(undefined);

      await executeCodePhase(mockSession, planResult as any, designResult as any);

      expect(mockInitializeSession).toHaveBeenCalledWith({
        prdId: 'prd-123',
        architectureId: 'arch-123',
        preferences: expect.objectContaining({
          frontendFramework: 'vue',
          backendRuntime: 'node',
          includeTests: true,
          includeDocs: true,
        }),
      });
    });

    it('should handle code generation failure', async () => {
      const planResult = createMockPlanResult();
      const designResult = createMockDesignResult();

      mockInitializeSession.mockRejectedValueOnce(new Error('Code generation failed'));

      const result = await executeCodePhase(mockSession, planResult as any, designResult as any);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Code generation failed');
    });
  });

  describe('executeShipMode', () => {
    it('should throw error for non-existent session', async () => {
      mockGetShipSession.mockResolvedValueOnce(null);

      await expect(executeShipMode('non-existent')).rejects.toThrow(
        'SHIP session non-existent not found'
      );
    });

    it('should execute design phase for new session', async () => {
      const mockSession = {
        id: 'ship_123',
        projectDescription: 'Build a todo app',
        phase: 'design' as const,
        status: 'initializing' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockGetShipSession.mockResolvedValueOnce(mockSession);

      mockGenerateArchitecture.mockResolvedValueOnce({
        status: 'error',
        error: 'API key not set',
      });

      const result = await executeShipMode('ship_123');

      expect(result.phase).toBe('design');
      expect(result.status).toBe('failed');
    });

    it('should handle errors gracefully when phase fails', async () => {
      const mockSession = {
        id: 'ship_123',
        projectDescription: 'Build a todo app',
        phase: 'design' as const,
        status: 'initializing' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockGetShipSession.mockResolvedValueOnce(mockSession);
      mockGenerateArchitecture.mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await executeShipMode('ship_123');

      // The service should handle errors and return a failed status
      expect(result.status).toBe('failed');
    });

    it('should continue from spec phase if design is completed', async () => {
      const mockSession = {
        id: 'ship_123',
        projectDescription: 'Build a todo app',
        phase: 'spec' as const,
        status: 'running' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        designResult: createMockDesignResult(),
      };

      mockGetShipSession.mockResolvedValueOnce(mockSession);
      mockStartSpecSession.mockResolvedValueOnce({ id: 'spec-session-123' });
      mockGenerateSpecification.mockResolvedValueOnce({
        specification: createMockSpecResult().specification,
      });

      const result = await executeShipMode('ship_123');

      expect(result.sessionId).toBe('ship_123');
      expect(['spec', 'plan']).toContain(result.phase);
    });

    it('should return current state if already completed', async () => {
      const mockSession = {
        id: 'ship_123',
        projectDescription: 'Build a todo app',
        phase: 'completed' as const,
        status: 'completed' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        designResult: createMockDesignResult(),
        specResult: createMockSpecResult(),
        planResult: createMockPlanResult(),
        codeResult: {
          phase: 'code' as const,
          status: 'completed' as const,
          session: { sessionId: 'gen-123' },
          completedAt: new Date().toISOString(),
        },
      };

      mockGetShipSession.mockResolvedValueOnce(mockSession);

      const result = await executeShipMode('ship_123');

      expect(result.status).toBe('completed');
    });
  });
});

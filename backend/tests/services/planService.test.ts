/**
 * Plan Service unit tests.
 * Mocks getDatabase and getCompletion to test plan CRUD and workflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Plan, PlanPhase } from '../../src/types/plan.js';

const mockPlans = new Map<string, Plan>();

const mockDb = {
  savePlan: vi.fn().mockImplementation(async (plan: Plan) => {
    mockPlans.set(plan.id, { ...plan });
  }),
  getPlan: vi.fn().mockImplementation(async (planId: string) => {
    const p = mockPlans.get(planId);
    return p ? { ...p } : null;
  }),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('../../src/services/llmGatewayHelper.js', () => ({
  getCompletion: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      title: 'Test Plan',
      description: 'A test plan',
      steps: [
        {
          id: 'step_1',
          title: 'Step 1',
          description: 'Do something',
          fileChanges: [],
          dependencies: [],
          estimatedTime: 10,
          risk: 'low',
          phase: 'implementation',
          order: 1,
        },
      ],
      phases: [
        {
          id: 'implementation',
          name: 'Implementation',
          description: 'Implement',
          steps: ['step_1'],
          checkpoint: false,
          status: 'pending',
        },
      ],
      totalEstimatedTime: 10,
    }),
    error: null,
  }),
}));

const {
  getPlan,
  approvePlan,
  rejectPlan,
  editPlan,
  startPlanExecution,
  completePlanExecution,
  updatePhaseStatus,
  generatePlan,
} = await import('../../src/services/planService.js');

function planFixture(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan_1',
    title: 'Test',
    description: 'Test plan',
    steps: [],
    phases: [
      {
        id: 'implementation',
        name: 'Implementation',
        description: '',
        steps: [],
        checkpoint: false,
        status: 'pending',
      },
    ],
    totalEstimatedTime: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('planService', () => {
  beforeEach(() => {
    mockPlans.clear();
    vi.clearAllMocks();
    mockDb.getPlan.mockImplementation(async (planId: string) => {
      const p = mockPlans.get(planId);
      return p ? { ...p } : null;
    });
    mockDb.savePlan.mockImplementation(async (plan: Plan) => {
      mockPlans.set(plan.id, { ...plan });
    });
  });

  describe('getPlan', () => {
    it('returns null for unknown plan', async () => {
      const plan = await getPlan('unknown');
      expect(plan).toBeNull();
    });

    it('returns plan when found', async () => {
      const plan = planFixture();
      mockPlans.set(plan.id, plan);
      const got = await getPlan(plan.id);
      expect(got).not.toBeNull();
      expect(got?.id).toBe(plan.id);
      expect(got?.status).toBe('draft');
    });
  });

  describe('approvePlan', () => {
    it('throws when plan not found', async () => {
      await expect(approvePlan('missing')).rejects.toThrow('not found');
    });

    it('approves draft plan', async () => {
      const plan = planFixture({ status: 'draft' });
      mockPlans.set(plan.id, plan);
      const approved = await approvePlan(plan.id, 'user-1');
      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe('user-1');
      expect(approved.approvedAt).toBeDefined();
    });

    it('approves pending_approval plan', async () => {
      const plan = planFixture({ status: 'pending_approval' });
      mockPlans.set(plan.id, plan);
      const approved = await approvePlan(plan.id);
      expect(approved.status).toBe('approved');
    });

    it('throws when plan cannot be approved', async () => {
      const plan = planFixture({ status: 'executing' });
      mockPlans.set(plan.id, plan);
      await expect(approvePlan(plan.id)).rejects.toThrow('cannot be approved');
    });
  });

  describe('rejectPlan', () => {
    it('throws when plan not found', async () => {
      await expect(rejectPlan('missing')).rejects.toThrow('not found');
    });

    it('rejects plan without comments', async () => {
      const plan = planFixture();
      mockPlans.set(plan.id, plan);
      const rejected = await rejectPlan(plan.id);
      expect(rejected.status).toBe('rejected');
    });

    it('rejects plan with comments', async () => {
      const plan = planFixture();
      mockPlans.set(plan.id, plan);
      const rejected = await rejectPlan(plan.id, 'Not good');
      expect(rejected.status).toBe('rejected');
      expect((rejected.metadata as Record<string, unknown>)?.rejectionComments).toBe('Not good');
    });
  });

  describe('editPlan', () => {
    it('throws when plan not found', async () => {
      await expect(editPlan('missing', { title: 'New' })).rejects.toThrow('not found');
    });

    it('throws when plan is executing', async () => {
      const plan = planFixture({ status: 'executing' });
      mockPlans.set(plan.id, plan);
      await expect(editPlan(plan.id, { title: 'New' })).rejects.toThrow('Cannot edit');
    });

    it('updates title and description', async () => {
      const plan = planFixture();
      mockPlans.set(plan.id, plan);
      const edited = await editPlan(plan.id, {
        title: 'Updated Title',
        description: 'Updated desc',
      });
      expect(edited.title).toBe('Updated Title');
      expect(edited.description).toBe('Updated desc');
    });
  });

  describe('startPlanExecution', () => {
    it('throws when plan not found', async () => {
      await expect(startPlanExecution('missing')).rejects.toThrow('not found');
    });

    it('throws when plan not approved', async () => {
      const plan = planFixture({ status: 'draft' });
      mockPlans.set(plan.id, plan);
      await expect(startPlanExecution(plan.id)).rejects.toThrow('must be approved');
    });

    it('starts execution', async () => {
      const plan = planFixture({ status: 'approved' });
      mockPlans.set(plan.id, plan);
      const started = await startPlanExecution(plan.id);
      expect(started.status).toBe('executing');
      expect(started.startedAt).toBeDefined();
      expect(started.phases[0]?.status).toBe('in_progress');
    });
  });

  describe('completePlanExecution', () => {
    it('throws when plan not found', async () => {
      await expect(completePlanExecution('missing')).rejects.toThrow('not found');
    });

    it('completes execution', async () => {
      const plan = planFixture({
        status: 'executing',
        phases: [
          {
            id: 'implementation',
            name: 'Impl',
            description: '',
            steps: [],
            checkpoint: false,
            status: 'in_progress',
          },
        ],
      });
      mockPlans.set(plan.id, plan);
      const completed = await completePlanExecution(plan.id);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.phases[0]?.status).toBe('completed');
    });
  });

  describe('updatePhaseStatus', () => {
    it('throws when plan not found', async () => {
      await expect(
        updatePhaseStatus('missing', 'implementation', 'completed')
      ).rejects.toThrow('not found');
    });

    it('throws when phase not found', async () => {
      const plan = planFixture();
      mockPlans.set(plan.id, plan);
      await expect(
        updatePhaseStatus(plan.id, 'nonexistent' as PlanPhase, 'completed')
      ).rejects.toThrow('Phase');
    });

    it('updates phase status', async () => {
      const plan = planFixture({
        phases: [
          {
            id: 'implementation',
            name: 'Impl',
            description: '',
            steps: [],
            checkpoint: false,
            status: 'pending',
          },
        ],
      });
      mockPlans.set(plan.id, plan);
      const updated = await updatePhaseStatus(plan.id, 'implementation', 'completed');
      expect(updated.phases[0]?.status).toBe('completed');
    });
  });

  describe('generatePlan', () => {
    it('generates plan and saves to db', async () => {
      const plan = await generatePlan({ userRequest: 'Build a todo app' });
      expect(plan.id).toBeDefined();
      expect(plan.title).toBe('Test Plan');
      expect(plan.steps).toHaveLength(1);
      expect(plan.phases.length).toBeGreaterThan(0);
      expect(plan.status).toBe('draft');
      expect(mockDb.savePlan).toHaveBeenCalled();
    });
  });
});

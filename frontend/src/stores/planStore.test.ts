/**
 * Plan Store Tests
 *
 * Comprehensive tests for plan state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { resetMocks } from '../test/setup';

// Mock the API module
vi.mock('../lib/api.js', () => ({
  fetchApi: vi.fn(),
}));

let currentPlan: typeof import('./planStore').currentPlan;
let isPlanLoading: typeof import('./planStore').isPlanLoading;
let planError: typeof import('./planStore').planError;
let generatePlan: typeof import('./planStore').generatePlan;
let loadPlan: typeof import('./planStore').loadPlan;
let approvePlan: typeof import('./planStore').approvePlan;
let editPlan: typeof import('./planStore').editPlan;
let startPlanExecution: typeof import('./planStore').startPlanExecution;
let updatePhaseStatus: typeof import('./planStore').updatePhaseStatus;
let clearPlan: typeof import('./planStore').clearPlan;

describe('planStore', () => {
  beforeEach(async () => {
    resetMocks();
    vi.resetModules();

    const module = await import('./planStore');
    currentPlan = module.currentPlan;
    isPlanLoading = module.isPlanLoading;
    planError = module.planError;
    generatePlan = module.generatePlan;
    loadPlan = module.loadPlan;
    approvePlan = module.approvePlan;
    editPlan = module.editPlan;
    startPlanExecution = module.startPlanExecution;
    updatePhaseStatus = module.updatePhaseStatus;
    clearPlan = module.clearPlan;

    // Clear state
    clearPlan();
  });

  describe('initial state', () => {
    it('should have null current plan', () => {
      expect(get(currentPlan)).toBeNull();
    });

    it('should not be loading', () => {
      expect(get(isPlanLoading)).toBe(false);
    });

    it('should have no error', () => {
      expect(get(planError)).toBeNull();
    });
  });

  describe('generatePlan', () => {
    it('should set loading state during generation', async () => {
      const { fetchApi } = await import('../lib/api.js');

      // Create a promise we can control
      let resolvePromise: ((value: unknown) => void) | undefined;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(fetchApi).mockReturnValue(promise as ReturnType<typeof fetchApi>);

      const generatePromise = generatePlan({ userRequest: 'test' });

      expect(get(isPlanLoading)).toBe(true);

      // Resolve with success
      if (resolvePromise) {
        resolvePromise({
          ok: true,
          json: () => Promise.resolve({ plan: { id: '1', title: 'Test Plan' } }),
        });
      }

      await generatePromise;

      expect(get(isPlanLoading)).toBe(false);
    });

    it('should update current plan on success', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const mockPlan = { id: '1', title: 'Generated Plan' };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: mockPlan }),
      } as Response);

      await generatePlan({ userRequest: 'Create a todo app' });

      expect(get(currentPlan)).toEqual(mockPlan);
    });

    it('should set error on failure', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Generation failed' }),
      } as Response);

      await expect(generatePlan({ userRequest: 'test' })).rejects.toThrow('Generation failed');

      expect(get(planError)).toBe('Generation failed');
    });

    it('should clear error on new request', async () => {
      const { fetchApi } = await import('../lib/api.js');

      // First request fails
      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Error' }),
      } as Response);

      try {
        await generatePlan({ userRequest: 'test' });
      } catch {
        /* expected - testing error handling */
      }
      expect(get(planError)).toBe('Error');

      // Second request succeeds
      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: { id: '1' } }),
      } as Response);

      await generatePlan({ userRequest: 'test' });

      expect(get(planError)).toBeNull();
    });
  });

  describe('loadPlan', () => {
    it('should load plan by ID', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const mockPlan = { id: 'plan-123', title: 'Loaded Plan' };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: mockPlan }),
      } as Response);

      await loadPlan('plan-123');

      expect(get(currentPlan)).toEqual(mockPlan);
    });

    it('should set error when plan not found', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Plan not found' }),
      } as Response);

      await expect(loadPlan('nonexistent')).rejects.toThrow('Plan not found');

      expect(get(planError)).toBe('Plan not found');
    });

    it('should handle non-Error exceptions in load', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockRejectedValue('load error');

      await expect(loadPlan('1')).rejects.toBe('load error');

      expect(get(planError)).toBe('Unknown error');
    });
  });

  describe('approvePlan', () => {
    it('should approve plan', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const approvedPlan = { id: '1', status: 'approved' };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: approvedPlan }),
      } as Response);

      await approvePlan('1', true);

      expect(get(currentPlan)).toEqual(approvedPlan);
    });

    it('should reject plan when approved=false', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const rejectedPlan = { id: '1', status: 'rejected' };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: rejectedPlan }),
      } as Response);

      await approvePlan('1', false, 'Needs more details');

      expect(fetchApi).toHaveBeenCalledWith('/api/plan/1/reject', expect.objectContaining({}));
    });

    it('should set error on approval failure', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Approval failed' }),
      } as Response);

      await expect(approvePlan('1')).rejects.toThrow('Approval failed');

      expect(get(planError)).toBe('Approval failed');
    });

    it('should handle non-Error exceptions in approval', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockRejectedValue('approval error');

      await expect(approvePlan('1')).rejects.toBe('approval error');

      expect(get(planError)).toBe('Unknown error');
    });
  });

  describe('editPlan', () => {
    it('should edit plan with changes', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const editedPlan = { id: '1', title: 'Updated Title' };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: editedPlan }),
      } as Response);

      await editPlan('1', { title: 'Updated Title' });

      expect(get(currentPlan)).toEqual(editedPlan);
    });

    it('should set error on edit failure', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Edit failed' }),
      } as Response);

      await expect(editPlan('1', { title: 'Updated' })).rejects.toThrow('Edit failed');

      expect(get(planError)).toBe('Edit failed');
    });

    it('should handle non-Error exceptions', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockRejectedValue('string error');

      await expect(editPlan('1', {})).rejects.toBe('string error');

      expect(get(planError)).toBe('Unknown error');
    });
  });

  describe('startPlanExecution', () => {
    it('should start plan execution', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const executingPlan = { id: '1', status: 'executing' };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: executingPlan }),
      } as Response);

      const result = await startPlanExecution('1');

      expect(get(currentPlan)).toEqual(executingPlan);
      expect(result).toEqual(executingPlan);
    });

    it('should start execution from specific phase', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const executingPlan = { id: '1', status: 'executing' };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: executingPlan }),
      } as Response);

      await startPlanExecution('1', 'phase-2');

      expect(fetchApi).toHaveBeenCalledWith(
        '/api/plan/1/execute',
        expect.objectContaining({
          body: expect.stringContaining('"startFromPhase":"phase-2"'),
        })
      );
    });

    it('should start execution with skipped phases', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const executingPlan = { id: '1', status: 'executing' };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: executingPlan }),
      } as Response);

      await startPlanExecution('1', undefined, ['phase-1', 'phase-3']);

      expect(fetchApi).toHaveBeenCalledWith(
        '/api/plan/1/execute',
        expect.objectContaining({
          body: expect.stringContaining('"skipPhases":["phase-1","phase-3"]'),
        })
      );
    });

    it('should set loading state during execution', async () => {
      const { fetchApi } = await import('../lib/api.js');

      let resolvePromise: ((value: unknown) => void) | undefined;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(fetchApi).mockReturnValue(promise as ReturnType<typeof fetchApi>);

      const execPromise = startPlanExecution('1');

      expect(get(isPlanLoading)).toBe(true);

      if (resolvePromise) {
        resolvePromise({
          ok: true,
          json: () => Promise.resolve({ plan: { id: '1' } }),
        });
      }

      await execPromise;

      expect(get(isPlanLoading)).toBe(false);
    });

    it('should set error on execution failure', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Execution failed' }),
      } as Response);

      await expect(startPlanExecution('1')).rejects.toThrow('Execution failed');

      expect(get(planError)).toBe('Execution failed');
    });

    it('should handle non-Error exceptions in execution', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockRejectedValue('network error');

      await expect(startPlanExecution('1')).rejects.toBe('network error');

      expect(get(planError)).toBe('Unknown error');
    });
  });

  describe('updatePhaseStatus', () => {
    it('should update phase status to completed', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const updatedPlan = { id: '1', phases: [{ id: 'phase-1', status: 'completed' }] };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: updatedPlan }),
      } as Response);

      const result = await updatePhaseStatus('1', 'phase-1', 'completed');

      expect(get(currentPlan)).toEqual(updatedPlan);
      expect(result).toEqual(updatedPlan);
    });

    it('should update phase status to in_progress', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const updatedPlan = { id: '1', phases: [{ id: 'phase-1', status: 'in_progress' }] };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: updatedPlan }),
      } as Response);

      await updatePhaseStatus('1', 'phase-1', 'in_progress');

      expect(fetchApi).toHaveBeenCalledWith(
        '/api/plan/1/phase/phase-1/status',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ status: 'in_progress' }),
        })
      );
    });

    it('should update phase status to skipped', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const updatedPlan = { id: '1', phases: [{ id: 'phase-1', status: 'skipped' }] };

      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: updatedPlan }),
      } as Response);

      await updatePhaseStatus('1', 'phase-1', 'skipped');

      expect(fetchApi).toHaveBeenCalledWith(
        '/api/plan/1/phase/phase-1/status',
        expect.objectContaining({
          body: JSON.stringify({ status: 'skipped' }),
        })
      );
    });

    it('should set loading state during phase update', async () => {
      const { fetchApi } = await import('../lib/api.js');

      let resolvePromise: ((value: unknown) => void) | undefined;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(fetchApi).mockReturnValue(promise as ReturnType<typeof fetchApi>);

      const updatePromise = updatePhaseStatus('1', 'phase-1', 'completed');

      expect(get(isPlanLoading)).toBe(true);

      if (resolvePromise) {
        resolvePromise({
          ok: true,
          json: () => Promise.resolve({ plan: { id: '1' } }),
        });
      }

      await updatePromise;

      expect(get(isPlanLoading)).toBe(false);
    });

    it('should set error on phase update failure', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Phase update failed' }),
      } as Response);

      await expect(updatePhaseStatus('1', 'phase-1', 'completed')).rejects.toThrow(
        'Phase update failed'
      );

      expect(get(planError)).toBe('Phase update failed');
    });

    it('should handle non-Error exceptions in phase update', async () => {
      const { fetchApi } = await import('../lib/api.js');

      vi.mocked(fetchApi).mockRejectedValue({ code: 'NETWORK_ERROR' });

      await expect(updatePhaseStatus('1', 'phase-1', 'completed')).rejects.toEqual({
        code: 'NETWORK_ERROR',
      });

      expect(get(planError)).toBe('Unknown error');
    });
  });

  describe('clearPlan', () => {
    it('should reset all state', async () => {
      const { fetchApi } = await import('../lib/api.js');

      // Set up some state
      vi.mocked(fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: { id: '1' } }),
      } as Response);
      await generatePlan({ userRequest: 'test' });

      expect(get(currentPlan)).not.toBeNull();

      clearPlan();

      expect(get(currentPlan)).toBeNull();
      expect(get(isPlanLoading)).toBe(false);
      expect(get(planError)).toBeNull();
    });
  });
});

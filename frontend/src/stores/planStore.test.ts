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
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => { resolvePromise = resolve; });
      (fetchApi as any).mockReturnValue(promise);

      const generatePromise = generatePlan({ userRequest: 'test' });
      
      expect(get(isPlanLoading)).toBe(true);
      
      // Resolve with success
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ plan: { id: '1', title: 'Test Plan' } }),
      });
      
      await generatePromise;
      
      expect(get(isPlanLoading)).toBe(false);
    });

    it('should update current plan on success', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const mockPlan = { id: '1', title: 'Generated Plan' };
      
      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: mockPlan }),
      });

      await generatePlan({ userRequest: 'Create a todo app' });
      
      expect(get(currentPlan)).toEqual(mockPlan);
    });

    it('should set error on failure', async () => {
      const { fetchApi } = await import('../lib/api.js');
      
      (fetchApi as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Generation failed' }),
      });

      await expect(generatePlan({ userRequest: 'test' })).rejects.toThrow('Generation failed');
      
      expect(get(planError)).toBe('Generation failed');
    });

    it('should clear error on new request', async () => {
      const { fetchApi } = await import('../lib/api.js');
      
      // First request fails
      (fetchApi as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Error' }),
      });
      
      try { await generatePlan({ userRequest: 'test' }); } catch {}
      expect(get(planError)).toBe('Error');
      
      // Second request succeeds
      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: { id: '1' } }),
      });
      
      await generatePlan({ userRequest: 'test' });
      
      expect(get(planError)).toBeNull();
    });
  });

  describe('loadPlan', () => {
    it('should load plan by ID', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const mockPlan = { id: 'plan-123', title: 'Loaded Plan' };
      
      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: mockPlan }),
      });

      await loadPlan('plan-123');
      
      expect(get(currentPlan)).toEqual(mockPlan);
    });

    it('should set error when plan not found', async () => {
      const { fetchApi } = await import('../lib/api.js');
      
      (fetchApi as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Plan not found' }),
      });

      await expect(loadPlan('nonexistent')).rejects.toThrow('Plan not found');
      
      expect(get(planError)).toBe('Plan not found');
    });
  });

  describe('approvePlan', () => {
    it('should approve plan', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const approvedPlan = { id: '1', status: 'approved' };
      
      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: approvedPlan }),
      });

      await approvePlan('1', true);
      
      expect(get(currentPlan)).toEqual(approvedPlan);
    });

    it('should reject plan when approved=false', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const rejectedPlan = { id: '1', status: 'rejected' };
      
      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: rejectedPlan }),
      });

      await approvePlan('1', false, 'Needs more details');
      
      expect(fetchApi).toHaveBeenCalledWith('/api/plan/1/reject', expect.any(Object));
    });
  });

  describe('editPlan', () => {
    it('should edit plan with changes', async () => {
      const { fetchApi } = await import('../lib/api.js');
      const editedPlan = { id: '1', title: 'Updated Title' };
      
      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: editedPlan }),
      });

      await editPlan('1', { title: 'Updated Title' });
      
      expect(get(currentPlan)).toEqual(editedPlan);
    });
  });

  describe('clearPlan', () => {
    it('should reset all state', async () => {
      const { fetchApi } = await import('../lib/api.js');
      
      // Set up some state
      (fetchApi as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: { id: '1' } }),
      });
      await generatePlan({ userRequest: 'test' });
      
      expect(get(currentPlan)).not.toBeNull();
      
      clearPlan();
      
      expect(get(currentPlan)).toBeNull();
      expect(get(isPlanLoading)).toBe(false);
      expect(get(planError)).toBeNull();
    });
  });
});

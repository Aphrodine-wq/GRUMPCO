import { writable, derived } from 'svelte/store';
import type {
  Plan,
  PlanStep,
  Phase,
  PlanGenerationRequest,
  PlanEditRequest,
} from '../types/plan';

const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:3000';

// Plan state
interface PlanState {
  currentPlan: Plan | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PlanState = {
  currentPlan: null,
  isLoading: false,
  error: null,
};

const state = writable<PlanState>(initialState);

// Derived stores
export const currentPlan = derived(state, s => s.currentPlan);
export const isPlanLoading = derived(state, s => s.isLoading);
export const planError = derived(state, s => s.error);

/**
 * Generate a new plan
 */
export async function generatePlan(request: PlanGenerationRequest): Promise<Plan> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/plan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Plan generation failed');
    }

    const data = await response.json();
    const plan = data.plan;

    state.update(s => ({
      ...s,
      currentPlan: plan,
      isLoading: false,
      error: null,
    }));

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Get plan by ID
 */
export async function loadPlan(planId: string): Promise<Plan> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/plan/${planId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to load plan');
    }

    const data = await response.json();
    const plan = data.plan;

    state.update(s => ({
      ...s,
      currentPlan: plan,
      isLoading: false,
      error: null,
    }));

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Approve plan
 */
export async function approvePlan(planId: string, approved: boolean = true, comments?: string): Promise<Plan> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const endpoint = approved ? 'approve' : 'reject';
    const response = await fetch(`${API_BASE}/api/plan/${planId}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, comments }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Plan approval failed');
    }

    const data = await response.json();
    const plan = data.plan;

    state.update(s => ({
      ...s,
      currentPlan: plan,
      isLoading: false,
      error: null,
    }));

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Edit plan
 */
export async function editPlan(planId: string, edits: PlanEditRequest): Promise<Plan> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/plan/${planId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edits),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Plan edit failed');
    }

    const data = await response.json();
    const plan = data.plan;

    state.update(s => ({
      ...s,
      currentPlan: plan,
      isLoading: false,
      error: null,
    }));

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Start plan execution
 */
export async function startPlanExecution(planId: string, startFromPhase?: string, skipPhases?: string[]): Promise<Plan> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/plan/${planId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        startFromPhase,
        skipPhases,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Plan execution failed');
    }

    const data = await response.json();
    const plan = data.plan;

    state.update(s => ({
      ...s,
      currentPlan: plan,
      isLoading: false,
      error: null,
    }));

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Update phase status
 */
export async function updatePhaseStatus(
  planId: string,
  phaseId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
): Promise<Plan> {
  state.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const response = await fetch(`${API_BASE}/api/plan/${planId}/phase/${phaseId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Phase status update failed');
    }

    const data = await response.json();
    const plan = data.plan;

    state.update(s => ({
      ...s,
      currentPlan: plan,
      isLoading: false,
      error: null,
    }));

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    state.update(s => ({
      ...s,
      isLoading: false,
      error: message,
    }));
    throw error;
  }
}

/**
 * Clear current plan
 */
export function clearPlan() {
  state.set(initialState);
}

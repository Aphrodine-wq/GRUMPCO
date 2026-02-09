/**
 * Agent Budget Store
 *
 * Svelte store for tracking AI operation costs, budget limits,
 * and the "Cost Prophecy" system for pre-execution estimates.
 *
 * KEY DIFFERENTIATOR: We respect the user's wallet.
 *
 * Features:
 * - Real-time cost tracking
 * - Budget status and warnings
 * - Cost prophecy (estimate before execution)
 * - Approval request handling
 * - Session and daily/monthly tracking
 */

import { writable, derived, get } from 'svelte/store';
import { fetchApi } from '../lib/api.js';
import type { ComponentType } from 'svelte';
import { CheckCircle, AlertTriangle, AlertCircle, XCircle, HelpCircle } from 'lucide-svelte';

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetStatus {
  sessionUsed: number;
  sessionRemaining: number;
  sessionPercent: number;
  dailyUsed: number;
  dailyRemaining: number;
  dailyPercent: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  monthlyPercent: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  canProceed: boolean;
  message?: string;
}

export interface BudgetConfig {
  sessionLimit: number;
  dailyLimit: number;
  monthlyLimit: number;
  warningThreshold: number;
  criticalThreshold: number;
  hardStop: boolean;
  autoApproveUnder: number;
  requireApprovalOver: number;
}

export interface CostEstimate {
  estimatedTokensIn: number;
  estimatedTokensOut: number;
  estimatedCost: number;
  estimatedDurationMs: number;
  confidence: number;
  breakdown: CostBreakdown[];
  requiresApproval: boolean;
  reason?: string;
}

export interface CostBreakdown {
  operation: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  model: string;
}

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  userId: string;
  operation: string;
  estimatedCost: number;
  currentSpent: number;
  budgetRemaining: number;
  reason: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
}

export interface CostOperation {
  id: string;
  type: 'llm_call' | 'tool_call' | 'agent_spawn' | 'file_op' | 'network';
  description: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  model?: string;
  timestamp: string;
  durationMs: number;
  goalId?: string;
  agentId?: string;
}

interface GAgentBudgetStoreState {
  // Budget status
  status: BudgetStatus | null;
  config: BudgetConfig | null;

  // Real-time tracking
  sessionCost: number;
  dailyCost: number;
  monthlyCost: number;

  // Recent operations
  recentOperations: CostOperation[];

  // Pending approvals
  pendingApprovals: ApprovalRequest[];

  // Last estimate
  lastEstimate: CostEstimate | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  showWarning: boolean;
  warningMessage: string | null;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: GAgentBudgetStoreState = {
  status: null,
  config: null,
  sessionCost: 0,
  dailyCost: 0,
  monthlyCost: 0,
  recentOperations: [],
  pendingApprovals: [],
  lastEstimate: null,
  isLoading: false,
  error: null,
  showWarning: false,
  warningMessage: null,
};

// ============================================================================
// STORE
// ============================================================================

const store = writable<GAgentBudgetStoreState>(initialState);

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Current budget status
 */
export const budgetStatus = derived(store, ($s) => $s.status);

/**
 * Is budget in warning state?
 */
export const isWarning = derived(
  store,
  ($s) => $s.status?.status === 'warning' || $s.status?.status === 'critical'
);

/**
 * Is budget exceeded?
 */
export const isExceeded = derived(store, ($s) => $s.status?.status === 'exceeded');

/**
 * Can we proceed with operations?
 */
export const canProceed = derived(store, ($s) => $s.status?.canProceed ?? true);

/**
 * Formatted session cost
 */
export const formattedSessionCost = derived(store, ($s) => formatCost($s.sessionCost));

/**
 * Session budget percentage used
 */
export const sessionBudgetPercent = derived(store, ($s) => $s.status?.sessionPercent ?? 0);

/**
 * Pending approval count
 */
export const pendingApprovalCount = derived(
  store,
  ($s) => $s.pendingApprovals.filter((a) => a.status === 'pending').length
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format cost in cents to display string
 */
export function formatCost(cents: number): string {
  if (cents < 100) {
    return `${cents}¢`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: BudgetStatus['status']): string {
  switch (status) {
    case 'ok':
      return 'text-green-500';
    case 'warning':
      return 'text-yellow-500';
    case 'critical':
      return 'text-orange-500';
    case 'exceeded':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get status icon for UI
 */
export function getStatusIcon(status: BudgetStatus['status']): ComponentType {
  switch (status) {
    case 'ok':
      return CheckCircle;
    case 'warning':
      return AlertTriangle;
    case 'critical':
      return AlertCircle;
    case 'exceeded':
      return XCircle;
    default:
      return HelpCircle;
  }
}

// ============================================================================
// STORE ACTIONS
// ============================================================================

export const gAgentBudgetStore = {
  subscribe: store.subscribe,

  /**
   * Fetch current budget status
   */
  async fetchStatus(sessionId: string = 'default'): Promise<BudgetStatus | null> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/budget/status?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch budget status: ${response.status}`);
      }

      const data = await response.json();
      const status = data.status as BudgetStatus;

      store.update((s) => ({
        ...s,
        status,
        sessionCost: status.sessionUsed,
        dailyCost: status.dailyUsed,
        monthlyCost: status.monthlyUsed,
        isLoading: false,
        showWarning: status.status === 'warning' || status.status === 'critical',
        warningMessage: status.message || null,
      }));

      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch budget status';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return null;
    }
  },

  /**
   * Fetch budget configuration
   */
  async fetchConfig(sessionId: string = 'default'): Promise<BudgetConfig | null> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/config?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const data = await response.json();
      const config = data.config?.budget as BudgetConfig;

      store.update((s) => ({ ...s, config, isLoading: false }));
      return config;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch config';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return null;
    }
  },

  /**
   * Update budget configuration
   */
  async updateConfig(
    config: Partial<BudgetConfig>,
    sessionId: string = 'default'
  ): Promise<BudgetConfig | null> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/config/budget?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'PUT',
          body: JSON.stringify(config),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update config: ${response.status}`);
      }

      const data = await response.json();
      const updatedConfig = data.budgetConfig as BudgetConfig;

      store.update((s) => ({ ...s, config: updatedConfig, isLoading: false }));
      return updatedConfig;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update config';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return null;
    }
  },

  /**
   * Cost Prophecy - Estimate cost BEFORE execution
   * This is a key differentiator!
   */
  async estimateCost(
    operations: Array<{
      type: 'llm_call' | 'tool_call' | 'agent_spawn';
      model?: string;
      estimatedInputTokens: number;
      estimatedOutputTokens: number;
      description?: string;
    }>,
    sessionId: string = 'default'
  ): Promise<CostEstimate | null> {
    store.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await fetchApi(
        `/api/gagent/budget/estimate?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ operations }),
        }
      );

      if (!response.ok) {
        throw new Error(`Cost estimation failed: ${response.status}`);
      }

      const data = await response.json();
      const estimate = data.estimate as CostEstimate;

      store.update((s) => ({ ...s, lastEstimate: estimate, isLoading: false }));
      return estimate;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cost estimation failed';
      store.update((s) => ({ ...s, isLoading: false, error: message }));
      return null;
    }
  },

  /**
   * Quick estimate for display
   */
  quickEstimate(
    inputTokens: number,
    outputTokens: number,
    model: string = 'claude-3.5-sonnet'
  ): { cost: number; formatted: string } {
    // Model pricing (cents per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3.5-sonnet': { input: 300, output: 1500 },
      'claude-3-opus': { input: 1500, output: 7500 },
      'claude-3-haiku': { input: 25, output: 125 },
      'gpt-4o': { input: 500, output: 1500 },
      'gpt-4o-mini': { input: 15, output: 60 },
      default: { input: 300, output: 1500 },
    };

    const p = pricing[model] || pricing['default'];
    const cost = Math.ceil(
      (inputTokens * p.input) / 1_000_000 + (outputTokens * p.output) / 1_000_000
    );

    return {
      cost,
      formatted: formatCost(cost),
    };
  },

  /**
   * Check if an operation can proceed
   */
  async canAfford(
    estimatedCost: number,
    sessionId: string = 'default'
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const response = await fetchApi(
        `/api/gagent/budget/check?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ estimatedCost }),
        }
      );

      if (!response.ok) {
        return { allowed: false, reason: 'Failed to check budget' };
      }

      const data = await response.json();
      return {
        allowed: data.allowed,
        reason: data.reason,
      };
    } catch {
      return { allowed: false, reason: 'Budget check failed' };
    }
  },

  /**
   * Start a cost tracking session
   */
  async startSession(sessionId: string = 'default'): Promise<boolean> {
    try {
      const response = await fetchApi('/api/gagent/budget/session/start', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });

      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * End a cost tracking session
   */
  async endSession(sessionId: string = 'default'): Promise<{
    totalCost: string;
    totalTokens: number;
    operationCount: number;
  } | null> {
    try {
      const response = await fetchApi('/api/gagent/budget/session/end', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.summary;
    } catch {
      return null;
    }
  },

  /**
   * Handle SSE budget events
   */
  handleBudgetEvent(event: {
    type: 'cost_recorded' | 'budget_warning' | 'budget_critical' | 'approval_required';
    data: unknown;
  }): void {
    switch (event.type) {
      case 'cost_recorded': {
        const { operation, total } = event.data as { operation: CostOperation; total: number };
        store.update((s) => ({
          ...s,
          sessionCost: total,
          recentOperations: [operation, ...s.recentOperations].slice(0, 50),
        }));
        break;
      }

      case 'budget_warning': {
        const { status, message } = event.data as { status: BudgetStatus; message: string };
        store.update((s) => ({
          ...s,
          status,
          showWarning: true,
          warningMessage: message,
        }));
        break;
      }

      case 'budget_critical': {
        const { status, message } = event.data as { status: BudgetStatus; message: string };
        store.update((s) => ({
          ...s,
          status,
          showWarning: true,
          warningMessage: message,
        }));
        break;
      }

      case 'approval_required': {
        const { request } = event.data as { request: ApprovalRequest };
        store.update((s) => ({
          ...s,
          pendingApprovals: [...s.pendingApprovals, request],
        }));
        break;
      }
    }
  },

  /**
   * Approve a pending request
   */
  async approveRequest(requestId: string): Promise<boolean> {
    try {
      const response = await fetchApi(`/api/gagent/budget/approve/${requestId}`, {
        method: 'POST',
      });

      if (response.ok) {
        store.update((s) => ({
          ...s,
          pendingApprovals: s.pendingApprovals.map((a) =>
            a.id === requestId ? { ...a, status: 'approved' as const } : a
          ),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Deny a pending request
   */
  async denyRequest(requestId: string): Promise<boolean> {
    try {
      const response = await fetchApi(`/api/gagent/budget/deny/${requestId}`, {
        method: 'POST',
      });

      if (response.ok) {
        store.update((s) => ({
          ...s,
          pendingApprovals: s.pendingApprovals.map((a) =>
            a.id === requestId ? { ...a, status: 'denied' as const } : a
          ),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Dismiss warning
   */
  dismissWarning(): void {
    store.update((s) => ({ ...s, showWarning: false, warningMessage: null }));
  },

  /**
   * Clear error
   */
  clearError(): void {
    store.update((s) => ({ ...s, error: null }));
  },

  /**
   * Get current state
   */
  getState(): GAgentBudgetStoreState {
    return get(store);
  },

  /**
   * Reset store
   */
  reset(): void {
    store.set(initialState);
  },
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default gAgentBudgetStore;

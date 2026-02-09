/**
 * G-Agent Budget Manager
 *
 * Comprehensive cost tracking and wallet respect system.
 * This is a KEY DIFFERENTIATOR - we respect the user's wallet.
 *
 * Features:
 * - Cost prophecy: Estimate cost BEFORE execution
 * - Budget limits: Per-session, per-day, per-user limits
 * - Runaway detection: Auto-stop on loops, excessive tokens
 * - Cost tracking: Real-time token and cost accounting
 * - Budget firewall: Hard stops when limits approached
 *
 * @module gAgent/budgetManager
 */

import { EventEmitter } from "events";
import { messageBus, CHANNELS } from "./messageBus.js";
import logger from "../middleware/logger.js";

// ============================================================================
// CONSTANTS - Token Costs (per 1M tokens, in cents)
// ============================================================================

/**
 * Token pricing for different models (cents per 1M tokens)
 * Updated: 2024 pricing
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
{
  // Claude models (Anthropic)
  "claude-3-opus": { input: 1500, output: 7500 }, // $15/$75
  "claude-3-sonnet": { input: 300, output: 1500 }, // $3/$15
  "claude-3-haiku": { input: 25, output: 125 }, // $0.25/$1.25
  "claude-3.5-sonnet": { input: 300, output: 1500 }, // $3/$15
  "claude-3.5-haiku": { input: 100, output: 500 }, // $1/$5

  // GPT models (OpenAI)
  "gpt-4-turbo": { input: 1000, output: 3000 }, // $10/$30
  "gpt-4": { input: 3000, output: 6000 }, // $30/$60
  "gpt-4o": { input: 500, output: 1500 }, // $5/$15
  "gpt-4o-mini": { input: 15, output: 60 }, // $0.15/$0.60
  "gpt-3.5-turbo": { input: 50, output: 150 }, // $0.50/$1.50

  // Default for unknown models
  default: { input: 300, output: 1500 },
};

/**
 * Default budget configuration
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  sessionLimit: 500, // $5.00 per session
  dailyLimit: 2000, // $20.00 per day
  monthlyLimit: 10000, // $100.00 per month
  warningThreshold: 0.8, // Warn at 80%
  criticalThreshold: 0.95, // Critical at 95%
  hardStop: true, // Stop when exceeded
  autoApproveUnder: 10, // Auto-approve under 10 cents
  requireApprovalOver: 100, // Always require approval over $1.00
};

/**
 * Runaway detection thresholds
 */
export const RUNAWAY_THRESHOLDS = {
  maxLoopsPerMinute: 10,
  maxTokensPerMinute: 100000,
  maxCostPerMinute: 100, // $1.00 per minute max
  maxConsecutiveErrors: 5,
  maxIdleTimeMs: 60000, // 1 minute idle = suspicious
  maxTotalTokens: 2000000, // 2M tokens per session max
};

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetConfig {
  sessionLimit: number; // Max cost per session (cents)
  dailyLimit: number; // Max cost per day (cents)
  monthlyLimit: number; // Max cost per month (cents)
  warningThreshold: number; // Warn at this % of limit (0-1)
  criticalThreshold: number; // Critical at this % of limit (0-1)
  hardStop: boolean; // Stop vs warn when exceeded
  autoApproveUnder: number; // Auto-approve operations under this cost (cents)
  requireApprovalOver: number; // Always require approval over this cost (cents)
}

export interface CostOperation {
  id: string;
  type: "llm_call" | "tool_call" | "agent_spawn" | "file_op" | "network";
  description: string;
  tokensIn: number;
  tokensOut: number;
  cost: number; // in cents
  model?: string;
  timestamp: string;
  durationMs: number;
  goalId?: string;
  agentId?: string;
}

export interface CostTracker {
  id: string;
  sessionId: string;
  userId: string;
  startedAt: string;

  // Token counts
  totalTokensIn: number;
  totalTokensOut: number;

  // Cost totals
  totalCost: number; // in cents
  estimatedRemainingCost: number;

  // Operations
  operations: CostOperation[];

  // Status
  status: "active" | "warning" | "critical" | "stopped" | "completed";
  lastOperationAt: string;

  // Runaway detection
  loopCount: number;
  errorCount: number;
  lastMinuteTokens: number;
  lastMinuteCost: number;
}

export interface CostEstimate {
  estimatedTokensIn: number;
  estimatedTokensOut: number;
  estimatedCost: number; // in cents
  estimatedDurationMs: number;
  confidence: number; // 0-1
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
  status: "ok" | "warning" | "critical" | "exceeded";
  canProceed: boolean;
  message?: string;
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
  status: "pending" | "approved" | "denied" | "expired";
}

export type BudgetEvent =
  | { type: "cost_recorded"; operation: CostOperation; total: number }
  | { type: "budget_warning"; status: BudgetStatus; message: string }
  | { type: "budget_critical"; status: BudgetStatus; message: string }
  | { type: "budget_exceeded"; status: BudgetStatus; message: string }
  | { type: "approval_required"; request: ApprovalRequest }
  | { type: "runaway_detected"; reason: string; metrics: RunawayMetrics }
  | { type: "session_stopped"; sessionId: string; reason: string };

export interface RunawayMetrics {
  loopsPerMinute: number;
  tokensPerMinute: number;
  costPerMinute: number;
  consecutiveErrors: number;
  idleTimeMs: number;
}

// ============================================================================
// BUDGET MANAGER CLASS
// ============================================================================

export class BudgetManager extends EventEmitter {
  private trackers: Map<string, CostTracker> = new Map();
  private userConfigs: Map<string, BudgetConfig> = new Map();
  private dailyTotals: Map<string, number> = new Map();
  private monthlyTotals: Map<string, number> = new Map();
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private globalPaused: boolean = false;

  constructor() {
    super();
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------------------------------

  /**
   * Get or create budget config for a user
   */
  getConfig(userId: string): BudgetConfig {
    return this.userConfigs.get(userId) || { ...DEFAULT_BUDGET_CONFIG };
  }

  /**
   * Update budget config for a user
   */
  setConfig(userId: string, config: Partial<BudgetConfig>): BudgetConfig {
    const current = this.getConfig(userId);
    const updated = { ...current, ...config };
    this.userConfigs.set(userId, updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // SESSION TRACKING
  // --------------------------------------------------------------------------

  /**
   * Start tracking costs for a session
   */
  startSession(sessionId: string, userId: string): CostTracker {
    const tracker: CostTracker = {
      id: crypto.randomUUID(),
      sessionId,
      userId,
      startedAt: new Date().toISOString(),
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCost: 0,
      estimatedRemainingCost: 0,
      operations: [],
      status: "active",
      lastOperationAt: new Date().toISOString(),
      loopCount: 0,
      errorCount: 0,
      lastMinuteTokens: 0,
      lastMinuteCost: 0,
    };

    this.trackers.set(sessionId, tracker);
    return tracker;
  }

  /**
   * Get tracker for a session
   */
  getTracker(sessionId: string): CostTracker | undefined {
    return this.trackers.get(sessionId);
  }

  /**
   * End a tracking session
   */
  endSession(sessionId: string): CostTracker | undefined {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.status = "completed";
    }
    return tracker;
  }

  // --------------------------------------------------------------------------
  // COST ESTIMATION (PROPHECY)
  // --------------------------------------------------------------------------

  /**
   * Estimate cost BEFORE execution - "Cost Prophecy"
   * This is a key differentiator!
   */
  estimateCost(
    operations: Array<{
      type: "llm_call" | "tool_call" | "agent_spawn";
      model?: string;
      estimatedInputTokens: number;
      estimatedOutputTokens: number;
      description?: string;
    }>,
    sessionId?: string,
  ): CostEstimate {
    const breakdown: CostBreakdown[] = [];
    let totalIn = 0;
    let totalOut = 0;
    let totalCost = 0;
    let totalDuration = 0;

    for (const op of operations) {
      const model = op.model || "default";
      const pricing = MODEL_PRICING[model] || MODEL_PRICING["default"];

      const cost = Math.ceil(
        (op.estimatedInputTokens * pricing.input) / 1_000_000 +
        (op.estimatedOutputTokens * pricing.output) / 1_000_000,
      );

      // Estimate duration (rough: 50 tokens/sec)
      const duration =
        Math.ceil((op.estimatedInputTokens + op.estimatedOutputTokens) / 50) *
        1000;

      breakdown.push({
        operation: op.description || op.type,
        tokensIn: op.estimatedInputTokens,
        tokensOut: op.estimatedOutputTokens,
        cost,
        model,
      });

      totalIn += op.estimatedInputTokens;
      totalOut += op.estimatedOutputTokens;
      totalCost += cost;
      totalDuration += duration;
    }

    // Get config to check if approval is required
    let requiresApproval = false;
    let reason: string | undefined;

    if (sessionId) {
      const tracker = this.getTracker(sessionId);
      if (tracker) {
        const config = this.getConfig(tracker.userId);

        if (totalCost > config.requireApprovalOver) {
          requiresApproval = true;
          reason = `Cost ($${(totalCost / 100).toFixed(2)}) exceeds approval threshold ($${(config.requireApprovalOver / 100).toFixed(2)})`;
        } else if (tracker.totalCost + totalCost > config.sessionLimit) {
          requiresApproval = true;
          reason = `Operation would exceed session budget`;
        }
      }
    }

    return {
      estimatedTokensIn: totalIn,
      estimatedTokensOut: totalOut,
      estimatedCost: totalCost,
      estimatedDurationMs: totalDuration,
      confidence: 0.7, // Moderate confidence in estimates
      breakdown,
      requiresApproval,
      reason,
    };
  }

  /**
   * Quick estimate for a single LLM call
   */
  estimateLLMCall(
    inputTokens: number,
    expectedOutputTokens: number,
    model: string = "claude-3.5-sonnet",
  ): { cost: number; formatted: string } {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING["default"];
    const cost = Math.ceil(
      (inputTokens * pricing.input) / 1_000_000 +
      (expectedOutputTokens * pricing.output) / 1_000_000,
    );

    return {
      cost,
      formatted: cost < 100 ? `${cost}¢` : `$${(cost / 100).toFixed(2)}`,
    };
  }

  // --------------------------------------------------------------------------
  // COST RECORDING
  // --------------------------------------------------------------------------

  /**
   * Record an operation's actual cost
   */
  recordCost(
    sessionId: string,
    operation: Omit<CostOperation, "id" | "timestamp">,
  ): CostOperation | null {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) {
      logger.warn({ sessionId }, "[BudgetManager] No tracker for session");
      return null;
    }

    // Create the operation record
    const op: CostOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Update totals
    tracker.totalTokensIn += op.tokensIn;
    tracker.totalTokensOut += op.tokensOut;
    tracker.totalCost += op.cost;
    tracker.operations.push(op);
    tracker.lastOperationAt = op.timestamp;

    // Update daily/monthly totals
    const dayKey = this.getDayKey(tracker.userId);
    const monthKey = this.getMonthKey(tracker.userId);
    this.dailyTotals.set(dayKey, (this.dailyTotals.get(dayKey) || 0) + op.cost);
    this.monthlyTotals.set(
      monthKey,
      (this.monthlyTotals.get(monthKey) || 0) + op.cost,
    );

    // Emit event
    const event: BudgetEvent = {
      type: "cost_recorded",
      operation: op,
      total: tracker.totalCost,
    };
    this.emit("cost", event);

    // Check budget status
    this.checkBudgetStatus(sessionId);

    // Check for runaway
    this.checkRunaway(sessionId);

    // Publish to message bus via broadcast
    messageBus.broadcast(
      "budget_update",
      {
        sessionId,
        cost: op.cost,
        total: tracker.totalCost,
      },
      "budgetManager",
    );

    return op;
  }

  /**
   * Record tokens used (convenience method)
   */
  recordTokens(
    sessionId: string,
    tokensIn: number,
    tokensOut: number,
    model: string = "claude-3.5-sonnet",
    description: string = "LLM call",
    durationMs: number = 0,
    goalId?: string,
    agentId?: string,
  ): CostOperation | null {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING["default"];
    const cost = Math.ceil(
      (tokensIn * pricing.input) / 1_000_000 +
      (tokensOut * pricing.output) / 1_000_000,
    );

    return this.recordCost(sessionId, {
      type: "llm_call",
      description,
      tokensIn,
      tokensOut,
      cost,
      model,
      durationMs,
      goalId,
      agentId,
    });
  }

  // --------------------------------------------------------------------------
  // BUDGET STATUS & CHECKS
  // --------------------------------------------------------------------------

  /**
   * Get current budget status for a session
   */
  getBudgetStatus(sessionId: string): BudgetStatus | null {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) return null;

    const config = this.getConfig(tracker.userId);
    const dayKey = this.getDayKey(tracker.userId);
    const monthKey = this.getMonthKey(tracker.userId);

    const dailyUsed = this.dailyTotals.get(dayKey) || 0;
    const monthlyUsed = this.monthlyTotals.get(monthKey) || 0;

    const sessionPercent = tracker.totalCost / config.sessionLimit;
    const dailyPercent = dailyUsed / config.dailyLimit;
    const monthlyPercent = monthlyUsed / config.monthlyLimit;

    const maxPercent = Math.max(sessionPercent, dailyPercent, monthlyPercent);

    let status: BudgetStatus["status"];
    let canProceed = true;
    let message: string | undefined;

    if (maxPercent >= 1) {
      status = "exceeded";
      canProceed = !config.hardStop;
      message = "Budget exceeded. Operations paused.";
    } else if (maxPercent >= config.criticalThreshold) {
      status = "critical";
      message = `Budget ${Math.round(maxPercent * 100)}% used. Approaching limit.`;
    } else if (maxPercent >= config.warningThreshold) {
      status = "warning";
      message = `Budget ${Math.round(maxPercent * 100)}% used.`;
    } else {
      status = "ok";
    }

    // Check if globally paused
    if (this.globalPaused) {
      canProceed = false;
      message = "All operations paused by administrator.";
    }

    return {
      sessionUsed: tracker.totalCost,
      sessionRemaining: Math.max(0, config.sessionLimit - tracker.totalCost),
      sessionPercent,
      dailyUsed,
      dailyRemaining: Math.max(0, config.dailyLimit - dailyUsed),
      dailyPercent,
      monthlyUsed,
      monthlyRemaining: Math.max(0, config.monthlyLimit - monthlyUsed),
      monthlyPercent,
      status,
      canProceed,
      message,
    };
  }

  /**
   * Check if an operation can proceed
   */
  canProceed(
    sessionId: string,
    estimatedCost: number = 0,
  ): { allowed: boolean; reason?: string } {
    if (this.globalPaused) {
      return { allowed: false, reason: "Global pause active" };
    }

    const tracker = this.trackers.get(sessionId);
    if (!tracker) {
      return { allowed: false, reason: "No session tracker" };
    }

    if (tracker.status === "stopped") {
      return { allowed: false, reason: "Session stopped" };
    }

    const config = this.getConfig(tracker.userId);
    const status = this.getBudgetStatus(sessionId);

    if (!status) {
      return { allowed: false, reason: "Cannot determine budget status" };
    }

    // Check if we'd exceed budget with this operation
    if (
      tracker.totalCost + estimatedCost > config.sessionLimit &&
      config.hardStop
    ) {
      return {
        allowed: false,
        reason: `Would exceed session budget ($${(config.sessionLimit / 100).toFixed(2)})`,
      };
    }

    const dayKey = this.getDayKey(tracker.userId);
    const dailyUsed = this.dailyTotals.get(dayKey) || 0;
    if (dailyUsed + estimatedCost > config.dailyLimit && config.hardStop) {
      return {
        allowed: false,
        reason: `Would exceed daily budget ($${(config.dailyLimit / 100).toFixed(2)})`,
      };
    }

    return { allowed: status.canProceed };
  }

  /**
   * Check budget status and emit events if needed
   */
  private checkBudgetStatus(sessionId: string): void {
    const status = this.getBudgetStatus(sessionId);
    if (!status) return;

    const tracker = this.trackers.get(sessionId);
    if (!tracker) return;

    const config = this.getConfig(tracker.userId);

    if (status.status === "exceeded") {
      tracker.status = "stopped";
      const event: BudgetEvent = {
        type: "budget_exceeded",
        status,
        message: status.message || "Budget exceeded",
      };
      this.emit("budget", event);
    } else if (status.status === "critical" && tracker.status !== "critical") {
      tracker.status = "critical";
      const event: BudgetEvent = {
        type: "budget_critical",
        status,
        message: status.message || "Budget critical",
      };
      this.emit("budget", event);
    } else if (status.status === "warning" && tracker.status === "active") {
      tracker.status = "warning";
      const event: BudgetEvent = {
        type: "budget_warning",
        status,
        message: status.message || "Budget warning",
      };
      this.emit("budget", event);
    }
  }

  // --------------------------------------------------------------------------
  // RUNAWAY DETECTION
  // --------------------------------------------------------------------------

  /**
   * Check for runaway processes (loops, excessive usage)
   */
  private checkRunaway(sessionId: string): void {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Count operations in the last minute
    const recentOps = tracker.operations.filter(
      (op) => new Date(op.timestamp).getTime() > oneMinuteAgo,
    );

    const lastMinuteTokens = recentOps.reduce(
      (sum, op) => sum + op.tokensIn + op.tokensOut,
      0,
    );
    const lastMinuteCost = recentOps.reduce((sum, op) => sum + op.cost, 0);

    tracker.lastMinuteTokens = lastMinuteTokens;
    tracker.lastMinuteCost = lastMinuteCost;

    // Check thresholds
    const metrics: RunawayMetrics = {
      loopsPerMinute: recentOps.length,
      tokensPerMinute: lastMinuteTokens,
      costPerMinute: lastMinuteCost,
      consecutiveErrors: tracker.errorCount,
      idleTimeMs: now - new Date(tracker.lastOperationAt).getTime(),
    };

    let runawayReason: string | null = null;

    if (metrics.loopsPerMinute > RUNAWAY_THRESHOLDS.maxLoopsPerMinute) {
      runawayReason = `Too many operations per minute (${metrics.loopsPerMinute})`;
    } else if (
      metrics.tokensPerMinute > RUNAWAY_THRESHOLDS.maxTokensPerMinute
    ) {
      runawayReason = `Excessive tokens per minute (${metrics.tokensPerMinute})`;
    } else if (metrics.costPerMinute > RUNAWAY_THRESHOLDS.maxCostPerMinute) {
      runawayReason = `Excessive cost per minute ($${(metrics.costPerMinute / 100).toFixed(2)})`;
    } else if (
      tracker.totalTokensIn + tracker.totalTokensOut >
      RUNAWAY_THRESHOLDS.maxTotalTokens
    ) {
      runawayReason = `Total tokens exceeded (${tracker.totalTokensIn + tracker.totalTokensOut})`;
    } else if (
      metrics.consecutiveErrors > RUNAWAY_THRESHOLDS.maxConsecutiveErrors
    ) {
      runawayReason = `Too many consecutive errors (${metrics.consecutiveErrors})`;
    }

    if (runawayReason) {
      tracker.status = "stopped";
      tracker.loopCount++;

      const event: BudgetEvent = {
        type: "runaway_detected",
        reason: runawayReason,
        metrics,
      };
      this.emit("runaway", event);

      // Publish emergency stop via system error channel
      messageBus.systemError(
        `Runaway detected: ${runawayReason}`,
        "RUNAWAY_DETECTED",
        `session:${sessionId}`,
      );
    }
  }

  /**
   * Record an error for runaway detection
   */
  recordError(sessionId: string): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.errorCount++;
      this.checkRunaway(sessionId);
    }
  }

  /**
   * Reset error count (after successful operation)
   */
  resetErrors(sessionId: string): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.errorCount = 0;
    }
  }

  // --------------------------------------------------------------------------
  // APPROVAL SYSTEM
  // --------------------------------------------------------------------------

  /**
   * Request approval for an expensive operation
   */
  requestApproval(
    sessionId: string,
    operation: string,
    estimatedCost: number,
  ): ApprovalRequest | null {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) return null;

    const status = this.getBudgetStatus(sessionId);
    if (!status) return null;

    const request: ApprovalRequest = {
      id: crypto.randomUUID(),
      sessionId,
      userId: tracker.userId,
      operation,
      estimatedCost,
      currentSpent: tracker.totalCost,
      budgetRemaining: status.sessionRemaining,
      reason: `Operation estimated at $${(estimatedCost / 100).toFixed(2)}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min expiry
      status: "pending",
    };

    this.approvalRequests.set(request.id, request);

    const event: BudgetEvent = {
      type: "approval_required",
      request,
    };
    this.emit("approval", event);

    return request;
  }

  /**
   * Approve a pending request
   */
  approveRequest(requestId: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (!request || request.status !== "pending") return false;

    // Check if expired
    if (new Date(request.expiresAt) < new Date()) {
      request.status = "expired";
      return false;
    }

    request.status = "approved";
    return true;
  }

  /**
   * Deny a pending request
   */
  denyRequest(requestId: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (!request || request.status !== "pending") return false;

    request.status = "denied";
    return true;
  }

  /**
   * Check if an approval is valid
   */
  isApproved(requestId: string): boolean {
    const request = this.approvalRequests.get(requestId);
    return request?.status === "approved";
  }

  // --------------------------------------------------------------------------
  // GLOBAL CONTROLS
  // --------------------------------------------------------------------------

  /**
   * Pause all budget tracking (emergency)
   */
  pauseAll(): void {
    this.globalPaused = true;
    this.emit("global", { type: "global_pause", paused: true });
  }

  /**
   * Resume all budget tracking
   */
  resumeAll(): void {
    this.globalPaused = false;
    this.emit("global", { type: "global_pause", paused: false });
  }

  /**
   * Check if globally paused
   */
  isPaused(): boolean {
    return this.globalPaused;
  }

  /**
   * Stop a specific session
   */
  stopSession(sessionId: string, reason: string): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.status = "stopped";
      const event: BudgetEvent = {
        type: "session_stopped",
        sessionId,
        reason,
      };
      this.emit("stopped", event);
    }
  }

  // --------------------------------------------------------------------------
  // REPORTING
  // --------------------------------------------------------------------------

  /**
   * Get session summary
   */
  getSessionSummary(sessionId: string): {
    totalCost: string;
    totalTokens: number;
    operationCount: number;
    duration: string;
    status: string;
  } | null {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) return null;

    const durationMs = Date.now() - new Date(tracker.startedAt).getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    return {
      totalCost:
        tracker.totalCost < 100
          ? `${tracker.totalCost}¢`
          : `$${(tracker.totalCost / 100).toFixed(2)}`,
      totalTokens: tracker.totalTokensIn + tracker.totalTokensOut,
      operationCount: tracker.operations.length,
      duration: `${minutes}m ${seconds}s`,
      status: tracker.status,
    };
  }

  /**
   * Get daily usage summary for a user
   */
  getDailyUsage(userId: string): {
    used: number;
    limit: number;
    percent: number;
  } {
    const config = this.getConfig(userId);
    const dayKey = this.getDayKey(userId);
    const used = this.dailyTotals.get(dayKey) || 0;

    return {
      used,
      limit: config.dailyLimit,
      percent: (used / config.dailyLimit) * 100,
    };
  }

  /**
   * Get monthly usage summary for a user
   */
  getMonthlyUsage(userId: string): {
    used: number;
    limit: number;
    percent: number;
  } {
    const config = this.getConfig(userId);
    const monthKey = this.getMonthKey(userId);
    const used = this.monthlyTotals.get(monthKey) || 0;

    return {
      used,
      limit: config.monthlyLimit,
      percent: (used / config.monthlyLimit) * 100,
    };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private getDayKey(userId: string): string {
    const date = new Date().toISOString().split("T")[0];
    return `${userId}:${date}`;
  }

  private getMonthKey(userId: string): string {
    const date = new Date().toISOString().slice(0, 7);
    return `${userId}:${date}`;
  }

  /**
   * Format cost for display
   */
  formatCost(cents: number): string {
    if (cents < 100) {
      return `${cents}¢`;
    }
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Parse cost from string
   */
  parseCost(str: string): number {
    if (str.endsWith("¢")) {
      return parseInt(str.slice(0, -1), 10);
    }
    if (str.startsWith("$")) {
      return Math.round(parseFloat(str.slice(1)) * 100);
    }
    return parseInt(str, 10);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const budgetManager = new BudgetManager();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Estimate cost before an operation (Cost Prophecy)
 */
export function prophecyCost(
  operations: Array<{
    type: "llm_call" | "tool_call" | "agent_spawn";
    model?: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    description?: string;
  }>,
  sessionId?: string,
): CostEstimate {
  return budgetManager.estimateCost(operations, sessionId);
}

/**
 * Quick cost check for a single LLM call
 */
export function quickCostCheck(
  inputTokens: number,
  outputTokens: number,
  model?: string,
): { cost: number; formatted: string } {
  return budgetManager.estimateLLMCall(inputTokens, outputTokens, model);
}

/**
 * Check if we can proceed with an operation
 */
export function canAfford(
  sessionId: string,
  estimatedCost: number = 0,
): boolean {
  return budgetManager.canProceed(sessionId, estimatedCost).allowed;
}

/**
 * Format a budget status message for display
 */
export function formatBudgetMessage(sessionId: string): string {
  const status = budgetManager.getBudgetStatus(sessionId);
  if (!status) return "No budget info available";

  const icon =
    status.status === "ok"
      ? "✅"
      : status.status === "warning"
        ? "⚠️"
        : status.status === "critical"
          ? "🚨"
          : "❌";

  return `${icon} Session: ${budgetManager.formatCost(status.sessionUsed)}/${budgetManager.formatCost(status.sessionUsed + status.sessionRemaining)} | Daily: ${Math.round(status.dailyPercent * 100)}%`;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default budgetManager;

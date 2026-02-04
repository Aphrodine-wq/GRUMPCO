/**
 * Budget Enforcement Service
 *
 * Enforces token and cost limits:
 * - Per-request limits
 * - Per-session limits
 * - Per-user daily limits
 * - Real-time cost tracking
 * - Hard cutoff when limits reached
 *
 * @module services/budgetEnforcementService
 */

import logger from '../middleware/logger.js';
import { getGuardrailsConfig } from '../config/guardrailsConfig.js';
import { writeAuditLog } from './auditLogService.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TokenUsage {
  /** Input/prompt tokens */
  inputTokens: number;
  /** Output/completion tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
}

export interface CostEstimate {
  /** Cost in cents */
  cents: number;
  /** Cost in dollars */
  dollars: number;
  /** Model used for estimation */
  model?: string;
}

export interface BudgetCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** Current usage */
  currentUsage: {
    request: TokenUsage;
    session: TokenUsage;
    daily: TokenUsage;
  };
  /** Current costs */
  currentCost: {
    request: CostEstimate;
    session: CostEstimate;
    daily: CostEstimate;
  };
  /** Limits */
  limits: {
    request: { tokens: number; costCents: number };
    session: { tokens: number; costCents: number };
    daily: { tokens: number; costCents: number };
  };
  /** Warning if approaching limit */
  warning?: string;
  /** Percentage of limit used */
  percentUsed: {
    requestTokens: number;
    sessionTokens: number;
    dailyTokens: number;
    requestCost: number;
    sessionCost: number;
    dailyCost: number;
  };
}

export interface BudgetTracker {
  /** User ID */
  userId: string;
  /** Session ID */
  sessionId: string;
  /** Request token usage */
  requestTokens: TokenUsage;
  /** Session token usage */
  sessionTokens: TokenUsage;
  /** Daily token usage (resets at midnight) */
  dailyTokens: TokenUsage;
  /** Request cost in cents */
  requestCostCents: number;
  /** Session cost in cents */
  sessionCostCents: number;
  /** Daily cost in cents */
  dailyCostCents: number;
  /** Date for daily reset */
  dailyResetDate: string;
  /** Last updated timestamp */
  lastUpdated: number;
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

// In-memory storage for budget tracking
// In production, this should be Redis or a database
const budgetTrackers = new Map<string, BudgetTracker>();

// Cleanup old trackers periodically (every hour)
setInterval(
  () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [key, tracker] of budgetTrackers.entries()) {
      if (now - tracker.lastUpdated > oneHour) {
        budgetTrackers.delete(key);
      }
    }
  },
  60 * 60 * 1000
);

// ============================================================================
// COST ESTIMATION
// ============================================================================

// Cost per 1M tokens in cents for common models
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4-turbo': { input: 1000, output: 3000 },
  'gpt-4': { input: 3000, output: 6000 },
  'gpt-4o': { input: 500, output: 1500 },
  'gpt-4o-mini': { input: 15, output: 60 },
  'gpt-3.5-turbo': { input: 50, output: 150 },

  // Anthropic
  'claude-3-opus': { input: 1500, output: 7500 },
  'claude-3-sonnet': { input: 300, output: 1500 },
  'claude-3-haiku': { input: 25, output: 125 },
  'claude-3-5-sonnet': { input: 300, output: 1500 },
  'claude-sonnet-4': { input: 300, output: 1500 },

  // Google
  'gemini-pro': { input: 50, output: 150 },
  'gemini-1.5-pro': { input: 125, output: 375 },
  'gemini-1.5-flash': { input: 10, output: 30 },

  // Default for unknown models
  default: { input: 100, output: 300 },
};

/**
 * Estimate cost for token usage
 */
export function estimateCost(usage: TokenUsage, model?: string): CostEstimate {
  // Find model cost (try partial match)
  let modelCost = MODEL_COSTS['default'];

  if (model) {
    const lowerModel = model.toLowerCase();
    for (const [key, cost] of Object.entries(MODEL_COSTS)) {
      if (lowerModel.includes(key)) {
        modelCost = cost;
        break;
      }
    }
  }

  // Calculate cost in cents (costs are per 1M tokens)
  const inputCost = (usage.inputTokens / 1_000_000) * modelCost.input;
  const outputCost = (usage.outputTokens / 1_000_000) * modelCost.output;
  const totalCents = inputCost + outputCost;

  return {
    cents: Math.round(totalCents * 100) / 100, // Round to 2 decimal places
    dollars: Math.round(totalCents) / 100,
    model,
  };
}

// ============================================================================
// BUDGET TRACKING
// ============================================================================

/**
 * Get or create budget tracker for user/session
 */
function getTracker(userId: string, sessionId: string): BudgetTracker {
  const key = `${userId}:${sessionId}`;
  const today = new Date().toISOString().split('T')[0];

  let tracker = budgetTrackers.get(key);

  if (!tracker) {
    tracker = {
      userId,
      sessionId,
      requestTokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      sessionTokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      dailyTokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      requestCostCents: 0,
      sessionCostCents: 0,
      dailyCostCents: 0,
      dailyResetDate: today,
      lastUpdated: Date.now(),
    };
    budgetTrackers.set(key, tracker);
  }

  // Reset daily if date changed
  if (tracker.dailyResetDate !== today) {
    tracker.dailyTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    tracker.dailyCostCents = 0;
    tracker.dailyResetDate = today;
  }

  return tracker;
}

/**
 * Reset request-level tracking (call at start of each request)
 */
export function resetRequestTracking(userId: string, sessionId: string): void {
  const tracker = getTracker(userId, sessionId);
  tracker.requestTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  tracker.requestCostCents = 0;
  tracker.lastUpdated = Date.now();
}

/**
 * Reset session tracking (call when session ends)
 */
export function resetSessionTracking(userId: string, sessionId: string): void {
  const key = `${userId}:${sessionId}`;
  budgetTrackers.delete(key);
}

/**
 * Record token usage
 */
export function recordUsage(
  userId: string,
  sessionId: string,
  usage: TokenUsage,
  model?: string
): BudgetCheckResult {
  const tracker = getTracker(userId, sessionId);
  const cost = estimateCost(usage, model);

  // Update request tracking
  tracker.requestTokens.inputTokens += usage.inputTokens;
  tracker.requestTokens.outputTokens += usage.outputTokens;
  tracker.requestTokens.totalTokens += usage.totalTokens;
  tracker.requestCostCents += cost.cents;

  // Update session tracking
  tracker.sessionTokens.inputTokens += usage.inputTokens;
  tracker.sessionTokens.outputTokens += usage.outputTokens;
  tracker.sessionTokens.totalTokens += usage.totalTokens;
  tracker.sessionCostCents += cost.cents;

  // Update daily tracking
  tracker.dailyTokens.inputTokens += usage.inputTokens;
  tracker.dailyTokens.outputTokens += usage.outputTokens;
  tracker.dailyTokens.totalTokens += usage.totalTokens;
  tracker.dailyCostCents += cost.cents;

  tracker.lastUpdated = Date.now();

  // Check limits after recording
  return checkBudgetLimits(userId, sessionId);
}

// ============================================================================
// BUDGET CHECKING
// ============================================================================

/**
 * Check if request is within budget limits
 */
export function checkBudgetLimits(userId: string, sessionId: string): BudgetCheckResult {
  const config = getGuardrailsConfig();
  const limits = config.budgetLimits;
  const tracker = getTracker(userId, sessionId);

  // Calculate percentages
  const percentUsed = {
    requestTokens: (tracker.requestTokens.totalTokens / limits.maxTokensPerRequest) * 100,
    sessionTokens: (tracker.sessionTokens.totalTokens / limits.maxTokensPerSession) * 100,
    dailyTokens: (tracker.dailyTokens.totalTokens / limits.maxTokensPerUserDaily) * 100,
    requestCost: (tracker.requestCostCents / limits.maxCostPerRequestCents) * 100,
    sessionCost: (tracker.sessionCostCents / limits.maxCostPerSessionCents) * 100,
    dailyCost: (tracker.dailyCostCents / limits.maxCostPerUserDailyCents) * 100,
  };

  // Build result
  const result: BudgetCheckResult = {
    allowed: true,
    currentUsage: {
      request: { ...tracker.requestTokens },
      session: { ...tracker.sessionTokens },
      daily: { ...tracker.dailyTokens },
    },
    currentCost: {
      request: { cents: tracker.requestCostCents, dollars: tracker.requestCostCents / 100 },
      session: { cents: tracker.sessionCostCents, dollars: tracker.sessionCostCents / 100 },
      daily: { cents: tracker.dailyCostCents, dollars: tracker.dailyCostCents / 100 },
    },
    limits: {
      request: { tokens: limits.maxTokensPerRequest, costCents: limits.maxCostPerRequestCents },
      session: { tokens: limits.maxTokensPerSession, costCents: limits.maxCostPerSessionCents },
      daily: { tokens: limits.maxTokensPerUserDaily, costCents: limits.maxCostPerUserDailyCents },
    },
    percentUsed,
  };

  // Check for limit violations
  const violations: string[] = [];

  if (tracker.requestTokens.totalTokens > limits.maxTokensPerRequest) {
    violations.push(
      `Request token limit exceeded (${tracker.requestTokens.totalTokens}/${limits.maxTokensPerRequest})`
    );
  }

  if (tracker.sessionTokens.totalTokens > limits.maxTokensPerSession) {
    violations.push(
      `Session token limit exceeded (${tracker.sessionTokens.totalTokens}/${limits.maxTokensPerSession})`
    );
  }

  if (tracker.dailyTokens.totalTokens > limits.maxTokensPerUserDaily) {
    violations.push(
      `Daily token limit exceeded (${tracker.dailyTokens.totalTokens}/${limits.maxTokensPerUserDaily})`
    );
  }

  if (tracker.requestCostCents > limits.maxCostPerRequestCents) {
    violations.push(
      `Request cost limit exceeded ($${(tracker.requestCostCents / 100).toFixed(2)}/$${(limits.maxCostPerRequestCents / 100).toFixed(2)})`
    );
  }

  if (tracker.sessionCostCents > limits.maxCostPerSessionCents) {
    violations.push(
      `Session cost limit exceeded ($${(tracker.sessionCostCents / 100).toFixed(2)}/$${(limits.maxCostPerSessionCents / 100).toFixed(2)})`
    );
  }

  if (tracker.dailyCostCents > limits.maxCostPerUserDailyCents) {
    violations.push(
      `Daily cost limit exceeded ($${(tracker.dailyCostCents / 100).toFixed(2)}/$${(limits.maxCostPerUserDailyCents / 100).toFixed(2)})`
    );
  }

  if (violations.length > 0 && limits.hardCutoffEnabled) {
    result.allowed = false;
    result.reason = violations.join('; ');

    logger.warn(
      {
        userId,
        sessionId,
        violations,
        usage: tracker,
      },
      'Budget limit exceeded'
    );
  }

  // Check for warnings
  const warnings: string[] = [];
  const warningThreshold = limits.warningThresholdPercent;

  if (percentUsed.requestTokens >= warningThreshold && percentUsed.requestTokens < 100) {
    warnings.push(`Request tokens at ${percentUsed.requestTokens.toFixed(0)}%`);
  }
  if (percentUsed.sessionTokens >= warningThreshold && percentUsed.sessionTokens < 100) {
    warnings.push(`Session tokens at ${percentUsed.sessionTokens.toFixed(0)}%`);
  }
  if (percentUsed.dailyTokens >= warningThreshold && percentUsed.dailyTokens < 100) {
    warnings.push(`Daily tokens at ${percentUsed.dailyTokens.toFixed(0)}%`);
  }
  if (percentUsed.sessionCost >= warningThreshold && percentUsed.sessionCost < 100) {
    warnings.push(`Session cost at ${percentUsed.sessionCost.toFixed(0)}%`);
  }
  if (percentUsed.dailyCost >= warningThreshold && percentUsed.dailyCost < 100) {
    warnings.push(`Daily cost at ${percentUsed.dailyCost.toFixed(0)}%`);
  }

  if (warnings.length > 0) {
    result.warning = `Approaching limits: ${warnings.join(', ')}`;
  }

  return result;
}

/**
 * Pre-check if a request with estimated tokens would exceed limits
 */
export function preCheckBudget(
  userId: string,
  sessionId: string,
  estimatedTokens: number,
  model?: string
): BudgetCheckResult {
  const tracker = getTracker(userId, sessionId);
  const config = getGuardrailsConfig();
  const limits = config.budgetLimits;

  // Estimate cost
  const estimatedUsage: TokenUsage = {
    inputTokens: estimatedTokens,
    outputTokens: 0,
    totalTokens: estimatedTokens,
  };
  const estimatedCost = estimateCost(estimatedUsage, model);

  // Check if adding this would exceed limits
  const projectedRequestTokens = tracker.requestTokens.totalTokens + estimatedTokens;
  const projectedSessionTokens = tracker.sessionTokens.totalTokens + estimatedTokens;
  const projectedDailyTokens = tracker.dailyTokens.totalTokens + estimatedTokens;
  const projectedRequestCost = tracker.requestCostCents + estimatedCost.cents;
  const projectedSessionCost = tracker.sessionCostCents + estimatedCost.cents;
  const projectedDailyCost = tracker.dailyCostCents + estimatedCost.cents;

  const result = checkBudgetLimits(userId, sessionId);

  // Override with projections
  if (projectedRequestTokens > limits.maxTokensPerRequest) {
    result.allowed = false;
    result.reason = `Request would exceed token limit (${projectedRequestTokens}/${limits.maxTokensPerRequest})`;
  }

  if (projectedSessionTokens > limits.maxTokensPerSession) {
    result.allowed = false;
    result.reason = `Request would exceed session token limit (${projectedSessionTokens}/${limits.maxTokensPerSession})`;
  }

  if (projectedDailyTokens > limits.maxTokensPerUserDaily) {
    result.allowed = false;
    result.reason = `Request would exceed daily token limit (${projectedDailyTokens}/${limits.maxTokensPerUserDaily})`;
  }

  if (projectedRequestCost > limits.maxCostPerRequestCents) {
    result.allowed = false;
    result.reason = `Request would exceed cost limit ($${(projectedRequestCost / 100).toFixed(2)}/$${(limits.maxCostPerRequestCents / 100).toFixed(2)})`;
  }

  if (projectedSessionCost > limits.maxCostPerSessionCents) {
    result.allowed = false;
    result.reason = `Request would exceed session cost limit ($${(projectedSessionCost / 100).toFixed(2)}/$${(limits.maxCostPerSessionCents / 100).toFixed(2)})`;
  }

  if (projectedDailyCost > limits.maxCostPerUserDailyCents) {
    result.allowed = false;
    result.reason = `Request would exceed daily cost limit ($${(projectedDailyCost / 100).toFixed(2)}/$${(limits.maxCostPerUserDailyCents / 100).toFixed(2)})`;
  }

  return result;
}

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

/**
 * Get current budget status for a user
 */
export async function getBudgetStatus(userId: string): Promise<{
  sessions: Map<string, BudgetTracker>;
  dailyTotal: TokenUsage;
  dailyCostCents: number;
}> {
  const sessions = new Map<string, BudgetTracker>();
  const dailyTotal: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let dailyCostCents = 0;

  const today = new Date().toISOString().split('T')[0];

  for (const [key, tracker] of budgetTrackers.entries()) {
    if (key.startsWith(userId + ':')) {
      sessions.set(tracker.sessionId, tracker);

      if (tracker.dailyResetDate === today) {
        dailyTotal.inputTokens += tracker.dailyTokens.inputTokens;
        dailyTotal.outputTokens += tracker.dailyTokens.outputTokens;
        dailyTotal.totalTokens += tracker.dailyTokens.totalTokens;
        dailyCostCents += tracker.dailyCostCents;
      }
    }
  }

  return { sessions, dailyTotal, dailyCostCents };
}

/**
 * Force reset daily budget for a user (admin function)
 */
export async function resetDailyBudget(userId: string, adminId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  for (const [key, tracker] of budgetTrackers.entries()) {
    if (key.startsWith(userId + ':')) {
      tracker.dailyTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      tracker.dailyCostCents = 0;
      tracker.dailyResetDate = today;
    }
  }

  await writeAuditLog({
    userId: adminId,
    action: 'guardrails.budget_reset',
    category: 'security',
    target: userId,
    metadata: { resetType: 'daily' },
  });

  logger.info({ userId, adminId }, 'Daily budget reset for user');
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Express middleware to enforce budget limits
 */
export function budgetEnforcementMiddleware() {
  return async (
    req: {
      userId?: string;
      sessionId?: string;
      body?: { estimatedTokens?: number; model?: string };
    },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    const userId = req.userId ?? 'anonymous';
    const sessionId = req.sessionId ?? 'default';
    const estimatedTokens = req.body?.estimatedTokens ?? 1000;
    const model = req.body?.model;

    const check = preCheckBudget(userId, sessionId, estimatedTokens, model);

    if (!check.allowed) {
      await writeAuditLog({
        userId,
        action: 'guardrails.budget_exceeded',
        category: 'security',
        target: 'request',
        metadata: {
          reason: check.reason,
          usage: check.currentUsage,
          cost: check.currentCost,
        },
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'BUDGET_EXCEEDED',
          message: check.reason,
          usage: check.currentUsage,
          limits: check.limits,
        },
      });
      return;
    }

    // Add warning header if approaching limit
    if (check.warning) {
      // Would add header here in real implementation
      logger.debug({ userId, warning: check.warning }, 'Budget warning');
    }

    next();
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  estimateCost,
  resetRequestTracking,
  resetSessionTracking,
  recordUsage,
  checkBudgetLimits,
  preCheckBudget,
  getBudgetStatus,
  resetDailyBudget,
  budgetEnforcementMiddleware,
};

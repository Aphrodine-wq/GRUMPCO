/**
 * Cost Analytics
 * Comprehensive cost tracking and analytics for LLM API usage
 */

import { getDatabase, type DatabaseService } from "../db/database.js";
import logger from "../middleware/logger.js";
import { MODEL_REGISTRY } from "@grump/ai-core";
import { getAlertingService } from "./alerting.js";
import { dispatchWebhook } from "./webhookService.js";

export interface CostRecord {
  id: string;
  userId: string;
  sessionId?: string;
  model: string;
  provider: string;
  operation: string; // 'chat', 'ship', 'codegen', 'architecture', etc.
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cacheHit: boolean;
  cacheSavingsUsd: number;
  modelRoutingSavingsUsd: number;
  timestamp: Date;
}

export interface CostBudget {
  userId: string;
  dailyLimitUsd?: number;
  monthlyLimitUsd?: number;
  alertThresholdPercent: number; // 0-100
}

export interface CostSummary {
  totalCost: number;
  totalRequests: number;
  cacheHitRate: number;
  cacheSavings: number;
  modelRoutingSavings: number;
  totalSavings: number;
  costByModel: Record<string, number>;
  costByOperation: Record<string, number>;
  costByDay: Array<{ date: string; cost: number }>;
}

export class CostAnalytics {
  private budgets = new Map<string, CostBudget>();
  private recentCosts: CostRecord[] = [];
  private readonly MAX_RECENT_COSTS = 10000;

  /**
   * Record a cost event
   */
  public async recordCost(
    record: Omit<CostRecord, "id" | "timestamp">,
  ): Promise<void> {
    const fullRecord: CostRecord = {
      ...record,
      id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Add to recent costs cache
    this.recentCosts.push(fullRecord);
    if (this.recentCosts.length > this.MAX_RECENT_COSTS) {
      this.recentCosts.shift();
    }

    // Persist to database
    try {
      const db = getDatabase();
      const dbService = db as DatabaseService;
      const rawDb = dbService.getDb();
      const stmt = rawDb.prepare(
        `INSERT INTO cost_records (
          id, user_id, session_id, model, provider, operation,
          input_tokens, output_tokens, cost_usd, cache_hit,
          cache_savings_usd, model_routing_savings_usd, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      stmt.run(
        fullRecord.id,
        fullRecord.userId,
        fullRecord.sessionId || null,
        fullRecord.model,
        fullRecord.provider,
        fullRecord.operation,
        fullRecord.inputTokens,
        fullRecord.outputTokens,
        fullRecord.costUsd,
        fullRecord.cacheHit ? 1 : 0,
        fullRecord.cacheSavingsUsd,
        fullRecord.modelRoutingSavingsUsd,
        fullRecord.timestamp.toISOString(),
      );
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to persist cost record",
      );
    }

    // Check budget alerts
    await this.checkBudgetAlerts(record.userId);
  }

  /**
   * Calculate cost for a request
   */
  public calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const modelConfig = MODEL_REGISTRY.find((m) => m.id === model);

    if (!modelConfig) {
      logger.warn({ model }, "Model not found in registry, using default cost");
      return 0.001; // Default small cost
    }

    const inputCost =
      ((modelConfig.costPerMillionInput || 0) * inputTokens) / 1_000_000;
    const outputCost =
      ((modelConfig.costPerMillionOutput || 0) * outputTokens) / 1_000_000;

    return inputCost + outputCost;
  }

  /**
   * Get cost summary for a user
   */
  public async getCostSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CostSummary> {
    const db = getDatabase();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate || new Date();

    try {
      // Get all cost records for user in date range
      const dbService = db as DatabaseService;
      const rawDb = dbService.getDb();
      const stmt = rawDb.prepare(
        `SELECT * FROM cost_records
         WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp DESC`,
      );
      const records = stmt.all(
        userId,
        start.toISOString(),
        end.toISOString(),
      ) as CostRecord[];

      // Calculate summary
      const totalCost = records.reduce(
        (sum: number, r: CostRecord) => sum + r.costUsd,
        0,
      );
      const totalRequests = records.length;
      const cacheHits = records.filter((r: CostRecord) => r.cacheHit).length;
      const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;
      const cacheSavings = records.reduce(
        (sum: number, r: CostRecord) => sum + r.cacheSavingsUsd,
        0,
      );
      const modelRoutingSavings = records.reduce(
        (sum: number, r: CostRecord) => sum + r.modelRoutingSavingsUsd,
        0,
      );

      // Cost by model
      const costByModel: Record<string, number> = {};
      records.forEach((r: CostRecord) => {
        costByModel[r.model] = (costByModel[r.model] || 0) + r.costUsd;
      });

      // Cost by operation
      const costByOperation: Record<string, number> = {};
      records.forEach((r: CostRecord) => {
        costByOperation[r.operation] =
          (costByOperation[r.operation] || 0) + r.costUsd;
      });

      // Cost by day
      const costByDayMap = new Map<string, number>();
      records.forEach((r: CostRecord) => {
        const date = new Date(r.timestamp).toISOString().split("T")[0];
        costByDayMap.set(date, (costByDayMap.get(date) || 0) + r.costUsd);
      });
      const costByDay = Array.from(costByDayMap.entries())
        .map(([date, cost]) => ({ date, cost }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalCost,
        totalRequests,
        cacheHitRate,
        cacheSavings,
        modelRoutingSavings,
        totalSavings: cacheSavings + modelRoutingSavings,
        costByModel,
        costByOperation,
        costByDay,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
        "Failed to get cost summary",
      );
      throw error;
    }
  }

  /**
   * Set budget for a user
   */
  public setBudget(budget: CostBudget): void {
    this.budgets.set(budget.userId, budget);
    logger.info({ userId: budget.userId, budget }, "Budget set");
  }

  /**
   * Get budget for a user
   */
  public getBudget(userId: string): CostBudget | undefined {
    return this.budgets.get(userId);
  }

  /**
   * Check if user is within budget
   */
  public async checkBudget(userId: string): Promise<{
    withinBudget: boolean;
    dailyUsed: number;
    dailyLimit?: number;
    monthlyUsed: number;
    monthlyLimit?: number;
    alertTriggered: boolean;
  }> {
    const budget = this.budgets.get(userId);

    if (!budget) {
      return {
        withinBudget: true,
        dailyUsed: 0,
        monthlyUsed: 0,
        alertTriggered: false,
      };
    }

    // Get daily usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailySummary = await this.getCostSummary(userId, today);
    const dailyUsed = dailySummary.totalCost;

    // Get monthly usage
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlySummary = await this.getCostSummary(userId, monthStart);
    const monthlyUsed = monthlySummary.totalCost;

    // Check limits
    const dailyExceeded =
      budget.dailyLimitUsd && dailyUsed > budget.dailyLimitUsd;
    const monthlyExceeded =
      budget.monthlyLimitUsd && monthlyUsed > budget.monthlyLimitUsd;
    const withinBudget = !dailyExceeded && !monthlyExceeded;

    // Check alert threshold
    const dailyPercent = budget.dailyLimitUsd
      ? (dailyUsed / budget.dailyLimitUsd) * 100
      : 0;
    const monthlyPercent = budget.monthlyLimitUsd
      ? (monthlyUsed / budget.monthlyLimitUsd) * 100
      : 0;
    const alertTriggered =
      dailyPercent >= budget.alertThresholdPercent ||
      monthlyPercent >= budget.alertThresholdPercent;

    return {
      withinBudget,
      dailyUsed,
      dailyLimit: budget.dailyLimitUsd,
      monthlyUsed,
      monthlyLimit: budget.monthlyLimitUsd,
      alertTriggered,
    };
  }

  /**
   * Check budget and send alerts if needed
   */
  private async checkBudgetAlerts(userId: string): Promise<void> {
    const status = await this.checkBudget(userId);
    const alertService = getAlertingService();

    if (status.alertTriggered) {
      logger.warn(
        {
          userId,
          dailyUsed: status.dailyUsed,
          dailyLimit: status.dailyLimit,
          monthlyUsed: status.monthlyUsed,
          monthlyLimit: status.monthlyLimit,
        },
        "Budget alert triggered",
      );

      // Send warning alert via alerting service
      await alertService.sendAlert({
        severity: "warning",
        title: "Budget threshold exceeded",
        message: `User ${userId} has exceeded budget alert threshold. Daily: $${status.dailyUsed.toFixed(2)}/${status.dailyLimit?.toFixed(2) ?? "unlimited"}, Monthly: $${status.monthlyUsed.toFixed(2)}/${status.monthlyLimit?.toFixed(2) ?? "unlimited"}`,
        component: "cost-analytics",
        metadata: {
          userId,
          dailyUsed: status.dailyUsed,
          dailyLimit: status.dailyLimit,
          monthlyUsed: status.monthlyUsed,
          monthlyLimit: status.monthlyLimit,
        },
      });

      // Dispatch webhook event for budget warning
      dispatchWebhook("ship.failed", {
        type: "budget_warning",
        userId,
        dailyUsed: status.dailyUsed,
        dailyLimit: status.dailyLimit,
        monthlyUsed: status.monthlyUsed,
        monthlyLimit: status.monthlyLimit,
      });
    }

    if (!status.withinBudget) {
      logger.error(
        {
          userId,
          dailyUsed: status.dailyUsed,
          dailyLimit: status.dailyLimit,
          monthlyUsed: status.monthlyUsed,
          monthlyLimit: status.monthlyLimit,
        },
        "Budget exceeded",
      );

      // Send critical alert via alerting service
      await alertService.sendAlert({
        severity: "critical",
        title: "Budget limit exceeded",
        message: `User ${userId} has exceeded budget limits. Daily: $${status.dailyUsed.toFixed(2)}/${status.dailyLimit?.toFixed(2) ?? "unlimited"}, Monthly: $${status.monthlyUsed.toFixed(2)}/${status.monthlyLimit?.toFixed(2) ?? "unlimited"}. Requests may be blocked.`,
        component: "cost-analytics",
        metadata: {
          userId,
          dailyUsed: status.dailyUsed,
          dailyLimit: status.dailyLimit,
          monthlyUsed: status.monthlyUsed,
          monthlyLimit: status.monthlyLimit,
          blocked: true,
        },
      });

      // Dispatch webhook event for budget exceeded
      dispatchWebhook("ship.failed", {
        type: "budget_exceeded",
        userId,
        dailyUsed: status.dailyUsed,
        dailyLimit: status.dailyLimit,
        monthlyUsed: status.monthlyUsed,
        monthlyLimit: status.monthlyLimit,
        blocked: true,
      });
    }
  }

  /**
   * Get cost optimization recommendations
   */
  public async getRecommendations(userId: string): Promise<string[]> {
    const summary = await this.getCostSummary(userId);
    const recommendations: string[] = [];

    // Low cache hit rate
    if (summary.cacheHitRate < 0.3) {
      recommendations.push(
        `Cache hit rate is ${(summary.cacheHitRate * 100).toFixed(1)}%. Consider enabling aggressive caching for repeated queries.`,
      );
    }

    // High cost on expensive models
    const expensiveModels = [
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-20241022",
    ];
    const expensiveCost = expensiveModels.reduce(
      (sum, model) => sum + (summary.costByModel[model] || 0),
      0,
    );
    const expensivePercent =
      summary.totalCost > 0 ? (expensiveCost / summary.totalCost) * 100 : 0;

    if (expensivePercent > 70) {
      recommendations.push(
        `${expensivePercent.toFixed(1)}% of costs are from expensive models. Consider using cost-aware routing to use cheaper models for simple tasks.`,
      );
    }

    // Potential savings
    const potentialSavings = summary.totalCost - summary.totalSavings;
    if (potentialSavings > summary.totalCost * 0.3) {
      recommendations.push(
        `You could save an additional $${potentialSavings.toFixed(2)} (${((potentialSavings / summary.totalCost) * 100).toFixed(1)}%) with better optimization.`,
      );
    }

    // High volume operations
    const highVolumeOps = Object.entries(summary.costByOperation)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (highVolumeOps.length > 0) {
      recommendations.push(
        `Top cost operations: ${highVolumeOps.map(([op, cost]) => `${op} ($${cost.toFixed(2)})`).join(", ")}. Focus optimization efforts here.`,
      );
    }

    return recommendations;
  }

  /**
   * Get real-time cost metrics
   */
  public getRealTimeMetrics(): {
    last24Hours: number;
    lastHour: number;
    currentRate: number; // cost per hour
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const lastHourCosts = this.recentCosts.filter(
      (r) => new Date(r.timestamp).getTime() > oneHourAgo,
    );
    const last24HourCosts = this.recentCosts.filter(
      (r) => new Date(r.timestamp).getTime() > oneDayAgo,
    );

    const lastHour = lastHourCosts.reduce((sum, r) => sum + r.costUsd, 0);
    const last24Hours = last24HourCosts.reduce((sum, r) => sum + r.costUsd, 0);
    const currentRate = lastHour; // Current hourly rate

    return {
      last24Hours,
      lastHour,
      currentRate,
    };
  }
}

// Singleton instance
let costAnalytics: CostAnalytics | null = null;

/**
 * Get or create the global cost analytics instance
 */
export function getCostAnalytics(): CostAnalytics {
  if (!costAnalytics) {
    costAnalytics = new CostAnalytics();
  }
  return costAnalytics;
}

/**
 * Initialize cost tracking table
 */
export async function initializeCostTracking(): Promise<void> {
  const db = getDatabase();
  const dbService = db as DatabaseService;
  const rawDb = dbService.getDb();

  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS cost_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      operation TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      cache_hit INTEGER NOT NULL,
      cache_savings_usd REAL NOT NULL,
      model_routing_savings_usd REAL NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  rawDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_cost_records_user_timestamp 
    ON cost_records(user_id, timestamp)
  `);

  rawDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_cost_records_operation 
    ON cost_records(operation, timestamp)
  `);

  logger.info("Cost tracking initialized");
}

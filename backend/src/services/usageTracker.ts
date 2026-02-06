/**
 * Usage tracker – records API calls for billing and analytics.
 * Persists to database with optional in-memory cache for performance.
 *
 * NOTE: Local AI models (Ollama, local LLMs) are excluded from credit tracking
 * since they run on user's hardware and don't incur API costs.
 */

import logger from "../middleware/logger.js";
import { getDatabase } from "../db/database.js";
import { v4 as uuid } from "uuid";

export interface UsageRecord {
  userId: string;
  endpoint: string;
  method: string;
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  storageBytes?: number;
  success: boolean;
  createdAt: Date;
}

// Optional in-memory cache for recent records (improves query performance)
const recentUsageCache: UsageRecord[] = [];
const CACHE_LIMIT = 1000;

/**
 * Local AI providers that don't incur API costs and shouldn't be tracked for billing.
 * These run on user's hardware (Electron desktop, local server, etc.)
 */
const LOCAL_AI_PROVIDERS = [
  "ollama",
  "local",
  "localhost",
  "lm-studio",
  "llama.cpp",
  "llamafile",
  "textgen",
  "oobabooga",
  "koboldcpp",
];

/**
 * Check if a provider or model represents a local AI (free, no API cost)
 */
export function isLocalModel(provider?: string, model?: string): boolean {
  // Check provider first
  if (provider) {
    const providerLower = provider.toLowerCase();
    if (LOCAL_AI_PROVIDERS.some((p) => providerLower.includes(p))) {
      return true;
    }
  }

  // Check model name for local indicators
  if (model) {
    const modelLower = model.toLowerCase();
    // Ollama-style model names are typically just the model name without provider prefix
    // e.g., "llama3.1", "mistral", "codellama" vs "openai/gpt-4", "anthropic/claude"
    if (
      LOCAL_AI_PROVIDERS.some((p) => modelLower.includes(p)) ||
      modelLower.startsWith("ollama:")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Record an API call with automatic database persistence
 * Fails silently to avoid breaking the request if analytics fails
 *
 * NOTE: Skips recording for local AI models (Ollama, etc.) since they don't
 * incur API costs and shouldn't count against user's credit limits.
 */
export async function recordApiCall(
  record: Omit<UsageRecord, "createdAt">,
): Promise<void> {
  // Skip tracking for local AI models - they don't cost credits
  if (isLocalModel(record.provider, record.model)) {
    logger.debug(
      {
        userId: record.userId,
        model: record.model,
        provider: record.provider,
      },
      "Skipping usage tracking for local AI model (no credit cost)",
    );
    return;
  }

  const full: UsageRecord = { ...record, createdAt: new Date() };

  try {
    // Save to cache for quick access
    if (recentUsageCache.length >= CACHE_LIMIT) {
      recentUsageCache.shift();
    }
    recentUsageCache.push(full);

    // Persist to database asynchronously (fire and forget)
    const db = getDatabase();
    await db.saveUsageRecord({
      id: uuid(),
      userId: record.userId,
      endpoint: record.endpoint,
      method: record.method,
      model: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      latencyMs: record.latencyMs,
      storageBytes: record.storageBytes,
      success: record.success,
    });

    logger.debug(
      {
        userId: record.userId,
        endpoint: record.endpoint,
        tokens: record.inputTokens,
      },
      "Usage recorded",
    );
  } catch (error) {
    // Fail silently - usage tracking errors should not break API responses
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        userId: record.userId,
      },
      "Failed to record usage",
    );
  }
}

/**
 * Record token usage for a model call
 */
export async function recordTokenUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  estimatedCostUsd?: number,
): Promise<void> {
  await recordApiCall({
    userId,
    endpoint: "/api/chat/stream",
    method: "POST",
    model,
    inputTokens,
    outputTokens,
    success: true,
  });

  if (estimatedCostUsd) {
    logger.debug({ userId, model, estimatedCostUsd }, "Token cost tracked");
  }
}

/**
 * Record storage usage for generated artifacts.
 */
export async function recordStorageUsage(
  userId: string,
  storageBytes: number,
  source: "codegen" | "ship" | "other" = "codegen",
): Promise<void> {
  if (!userId || storageBytes <= 0) return;
  await recordApiCall({
    userId,
    endpoint: `/api/storage/${source}`,
    method: "POST",
    storageBytes,
    success: true,
  });
}

/**
 * Get usage records for a user within a date range
 * Returns cached records first, then queries database for historical data
 */
export async function getUsageForUser(
  userId: string,
  fromDate: Date,
  toDate: Date,
): Promise<UsageRecord[]> {
  try {
    // Note: recentUsageCache could be used for cache-first optimization in future
    // Currently we always query database for complete results

    // Query database for complete results
    const db = getDatabase();
    const records = await db.getUsageForUser(userId, fromDate, toDate);
    const rows = records as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      userId: String(r.user_id ?? ""),
      endpoint: String(r.endpoint ?? ""),
      method: String(r.method ?? ""),
      model: r.model != null ? String(r.model) : undefined,
      inputTokens: r.input_tokens != null ? Number(r.input_tokens) : undefined,
      outputTokens:
        r.output_tokens != null ? Number(r.output_tokens) : undefined,
      latencyMs: r.latency_ms != null ? Number(r.latency_ms) : undefined,
      storageBytes:
        r.storage_bytes != null ? Number(r.storage_bytes) : undefined,
      success: r.success === 1,
      createdAt: new Date(String(r.created_at ?? "")),
    })) as UsageRecord[];
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      "Failed to get usage records",
    );
    return [];
  }
}

/**
 * Get monthly call count for billing
 */
export async function getMonthlyCallCount(userId: string): Promise<number> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await getUsageForUser(userId, start, now);
    return records.length;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      "Failed to get monthly call count",
    );
    return 0;
  }
}

/** Credits per 1M input/output tokens (NIM-style; use smallest decimals for accuracy) */
const CREDITS_PER_1M_INPUT = 0.15;
const CREDITS_PER_1M_OUTPUT = 0.6;

/**
 * Get monthly credits used from token usage (for NIM/API cost tracking).
 * Returns a decimal with up to 6 decimal places for accurate display.
 */
export async function getMonthlyCreditsFromTokens(
  userId: string,
): Promise<number> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await getUsageForUser(userId, start, now);
    let total = 0;
    for (const r of records) {
      const inT = r.inputTokens ?? 0;
      const outT = r.outputTokens ?? 0;
      total += (inT / 1_000_000) * CREDITS_PER_1M_INPUT;
      total += (outT / 1_000_000) * CREDITS_PER_1M_OUTPUT;
    }
    return Math.round(total * 1_000_000) / 1_000_000;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      "Failed to get monthly credits from tokens",
    );
    return 0;
  }
}

/**
 * Get usage summary for a user
 */
export async function getUsageSummary(userId: string): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  monthlyInputTokens: number;
  monthlyOutputTokens: number;
  avgLatencyMs: number;
}> {
  try {
    const db = getDatabase();
    return await db.getUsageSummary(userId);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      "Failed to get usage summary",
    );
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      monthlyInputTokens: 0,
      monthlyOutputTokens: 0,
      avgLatencyMs: 0,
    };
  }
}

/**
 * Map endpoint to operation type for usage breakdown
 */
const ENDPOINT_TO_OPERATION: Record<string, string> = {
  "/api/chat/stream": "chat",
  "/api/chat": "chat",
  "/api/architecture": "architecture",
  "/api/intent": "intent",
  "/api/prd": "prd",
  "/api/plan": "plan",
  "/api/ship": "ship",
  "/api/codegen": "codegen",
  "/api/advanced-ai": "swarm_run",
  "/api/gagent": "swarm_run",
};

function endpointToOperation(endpoint: string): string {
  for (const [path, op] of Object.entries(ENDPOINT_TO_OPERATION)) {
    if (endpoint.startsWith(path)) return op;
  }
  return "other";
}

/**
 * Get usage count by operation type for the current month
 */
export async function getUsageByOperation(
  userId: string,
): Promise<Record<string, number>> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await getUsageForUser(userId, start, now);
    const byOp: Record<string, number> = {};
    for (const r of records) {
      const op = endpointToOperation(r.endpoint);
      byOp[op] = (byOp[op] ?? 0) + 1;
    }
    return byOp;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      "Failed to get usage by operation",
    );
    return {};
  }
}

/**
 * Clear in-memory cache (useful for testing)
 */
export function clearCache(): void {
  recentUsageCache.length = 0;
}

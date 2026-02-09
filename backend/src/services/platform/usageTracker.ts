/**
 * Usage tracker – records API calls for billing and analytics.
 * Persists to database with optional in-memory cache for performance.
 *
 * NOTE: Local AI models (Ollama, local LLMs) are excluded from credit tracking
 * since they run on user's hardware and don't incur API costs.
 */

import logger from "../../middleware/logger.js";
import { getDatabase } from "../../db/database.js";
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
  estimatedCostUsd?: number;
}

/** Approximate cost per 1M tokens (input, output) for common models – used when exact model config is unknown */
const DEFAULT_COST_PER_1M_INPUT = 1;
const DEFAULT_COST_PER_1M_OUTPUT = 3;

/**
 * Model-specific pricing per 1M tokens for highly accurate cost tracking.
 * Prices sourced from provider pricing pages as of 2026-Q1.
 * Format: [inputCostPer1M, outputCostPer1M]
 */
const MODEL_PRICING: Record<string, [number, number]> = {
  // OpenAI
  "gpt-4o": [2.50, 10.00],
  "gpt-4o-mini": [0.15, 0.60],
  "gpt-4-turbo": [10.00, 30.00],
  "gpt-4": [30.00, 60.00],
  "gpt-3.5-turbo": [0.50, 1.50],
  "o1": [15.00, 60.00],
  "o1-mini": [3.00, 12.00],
  "o1-preview": [15.00, 60.00],
  "o3": [10.00, 40.00],
  "o3-mini": [1.10, 4.40],
  "o4-mini": [1.10, 4.40],
  // Anthropic
  "claude-3-5-sonnet": [3.00, 15.00],
  "claude-3-5-haiku": [0.80, 4.00],
  "claude-3-opus": [15.00, 75.00],
  "claude-3-sonnet": [3.00, 15.00],
  "claude-3-haiku": [0.25, 1.25],
  "claude-4-opus": [15.00, 75.00],
  "claude-4-sonnet": [3.00, 15.00],
  "claude-sonnet-4": [3.00, 15.00],
  "claude-opus-4": [15.00, 75.00],
  // Google
  "gemini-2.0-flash": [0.10, 0.40],
  "gemini-2.5-flash": [0.15, 0.60],
  "gemini-2.5-pro": [1.25, 10.00],
  "gemini-pro": [0.50, 1.50],
  "gemini-3-pro": [1.25, 10.00],
  // Meta / Llama
  "llama-3.1-8b": [0.10, 0.10],
  "llama-3.1-70b": [0.88, 0.88],
  "llama-3.1-405b": [3.00, 3.00],
  "llama-3.3-70b": [0.88, 0.88],
  // Mistral
  "mistral-large": [2.00, 6.00],
  "mistral-small": [0.20, 0.60],
  "codestral": [0.30, 0.90],
  // DeepSeek
  "deepseek-chat": [0.14, 0.28],
  "deepseek-coder": [0.14, 0.28],
  "deepseek-r1": [0.55, 2.19],
  // Kimi
  "kimi-k2": [0.60, 2.40],
  "kimi-k2.5": [0.60, 2.40],
  // xAI
  "grok-3": [3.00, 15.00],
  "grok-3-mini": [0.30, 0.50],
  // NVIDIA NIM defaults
  "nim-default": [1.00, 3.00],
};

/**
 * Look up model-specific cost rates.
 * Does a fuzzy match against the model name to handle provider prefixes (e.g., "openai/gpt-4o").
 */
function getModelPricing(model: string | undefined): [number, number] {
  if (!model) return [DEFAULT_COST_PER_1M_INPUT, DEFAULT_COST_PER_1M_OUTPUT];

  const modelLower = model.toLowerCase();

  // Exact match first
  if (MODEL_PRICING[modelLower]) return MODEL_PRICING[modelLower];

  // Fuzzy match: strip provider prefix and check
  const parts = modelLower.split("/");
  const modelName = parts.length > 1 ? parts[parts.length - 1] : modelLower;
  if (MODEL_PRICING[modelName]) return MODEL_PRICING[modelName];

  // Partial match: check if the model name contains a known key
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelLower.includes(key) || key.includes(modelLower)) {
      return pricing;
    }
  }

  return [DEFAULT_COST_PER_1M_INPUT, DEFAULT_COST_PER_1M_OUTPUT];
}

/**
 * Compute estimated cost in USD from token counts and model.
 * Uses model-specific pricing for high accuracy; falls back to default rates.
 */
function computeEstimatedCostUsd(
  model: string | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number {
  const inT = inputTokens ?? 0;
  const outT = outputTokens ?? 0;
  if (inT === 0 && outT === 0) return 0;
  const [inputRate, outputRate] = getModelPricing(model);
  const inCost = (inT / 1_000_000) * inputRate;
  const outCost = (outT / 1_000_000) * outputRate;
  return Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
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
  "jan",
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

  const estimatedCostUsd = computeEstimatedCostUsd(
    record.model,
    record.inputTokens,
    record.outputTokens,
  );
  const full: UsageRecord = { ...record, createdAt: new Date(), estimatedCostUsd };

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
      estimatedCostUsd,
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
      estimatedCostUsd:
        r.estimated_cost_usd != null ? Number(r.estimated_cost_usd) : undefined,
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
 * Get monthly cost (USD) for a user from usage records (cost-based billing).
 */
export async function getMonthlyCostForUser(userId: string): Promise<number> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await getUsageForUser(userId, start, now);
    let total = 0;
    for (const r of records) {
      total += r.estimatedCostUsd ?? 0;
    }
    return Math.round(total * 100) / 100;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      "Failed to get monthly cost",
    );
    return 0;
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

/**
 * Usage tracker – records API calls for billing and analytics.
 * Persists to database with optional in-memory cache for performance.
 */

import logger from '../middleware/logger.js';
import { getDatabase } from '../db/database.js';
import { v4 as uuid } from 'uuid';

export interface UsageRecord {
  userId: string;
  endpoint: string;
  method: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  success: boolean;
  createdAt: Date;
}

// Optional in-memory cache for recent records (improves query performance)
const recentUsageCache: UsageRecord[] = [];
const CACHE_LIMIT = 1000;

/**
 * Record an API call with automatic database persistence
 * Fails silently to avoid breaking the request if analytics fails
 */
export async function recordApiCall(record: Omit<UsageRecord, 'createdAt'>): Promise<void> {
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
      success: record.success,
    });

    logger.debug(
      { userId: record.userId, endpoint: record.endpoint, tokens: record.inputTokens },
      'Usage recorded'
    );
  } catch (error) {
    // Fail silently - usage tracking errors should not break API responses
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), userId: record.userId },
      'Failed to record usage'
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
  estimatedCostUsd?: number
): Promise<void> {
  await recordApiCall({
    userId,
    endpoint: '/api/chat/stream',
    method: 'POST',
    model,
    inputTokens,
    outputTokens,
    success: true,
  });

  if (estimatedCostUsd) {
    logger.debug({ userId, model, estimatedCostUsd }, 'Token cost tracked');
  }
}

/**
 * Get usage records for a user within a date range
 * Returns cached records first, then queries database for historical data
 */
export async function getUsageForUser(
  userId: string,
  fromDate: Date,
  toDate: Date
): Promise<UsageRecord[]> {
  try {
    // Check cache first (reserved for future cache-first path)
    const _cachedRecords = recentUsageCache.filter(
      (r) => r.userId === userId && r.createdAt >= fromDate && r.createdAt <= toDate
    );

    // Query database for complete results
    const db = getDatabase();
    const records = await db.getUsageForUser(userId, fromDate, toDate);
    const rows = records as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      userId: String(r.user_id ?? ''),
      endpoint: String(r.endpoint ?? ''),
      method: String(r.method ?? ''),
      model: r.model != null ? String(r.model) : undefined,
      inputTokens: r.input_tokens != null ? Number(r.input_tokens) : undefined,
      outputTokens: r.output_tokens != null ? Number(r.output_tokens) : undefined,
      latencyMs: r.latency_ms != null ? Number(r.latency_ms) : undefined,
      success: r.success === 1,
      createdAt: new Date(String(r.created_at ?? '')),
    })) as UsageRecord[];
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      'Failed to get usage records'
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
      'Failed to get monthly call count'
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
      'Failed to get usage summary'
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
 * Clear in-memory cache (useful for testing)
 */
export function clearCache(): void {
  recentUsageCache.length = 0;
}

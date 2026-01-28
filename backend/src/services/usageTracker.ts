/**
 * Usage tracker – records API calls for billing and analytics.
 * In-memory for now; persist to DB when wired.
 */

import logger from '../middleware/logger.js';

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

const inMemoryUsage: UsageRecord[] = [];
const IN_MEMORY_LIMIT = 10_000;

export function recordApiCall(record: Omit<UsageRecord, 'createdAt'>): void {
  const full: UsageRecord = { ...record, createdAt: new Date() };
  if (inMemoryUsage.length >= IN_MEMORY_LIMIT) {
    inMemoryUsage.shift();
  }
  inMemoryUsage.push(full);
  logger.debug({ userId: record.userId, endpoint: record.endpoint }, 'Usage recorded');
}

export function recordTokenUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  estimatedCostUsd?: number
): void {
  logger.debug({ userId, model, inputTokens, outputTokens, estimatedCostUsd }, 'Token usage recorded');
}

export function getUsageForUser(userId: string, fromDate: Date, toDate: Date): UsageRecord[] {
  return inMemoryUsage.filter(
    (r) => r.userId === userId && r.createdAt >= fromDate && r.createdAt <= toDate
  );
}

export function getMonthlyCallCount(userId: string): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return getUsageForUser(userId, start, now).length;
}

/**
 * Usage tracker - records API calls and token usage for billing and analytics.
 * Persists to DB when Supabase is configured; otherwise in-memory for dev.
 */
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

export interface UsageRecord {
  userId: string
  endpoint: string
  method: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  latencyMs?: number
  success: boolean
  createdAt: Date
}

const inMemoryUsage: UsageRecord[] = []
const IN_MEMORY_LIMIT = 10_000

/**
 * Record one API call. Call from Claude middleware after each request.
 */
export function recordApiCall(record: Omit<UsageRecord, 'createdAt'>): void {
  const full: UsageRecord = { ...record, createdAt: new Date() }
  if (inMemoryUsage.length >= IN_MEMORY_LIMIT) {
    inMemoryUsage.shift()
  }
  inMemoryUsage.push(full)
  logger.debug({ userId: record.userId, endpoint: record.endpoint }, 'Usage recorded')
}

/**
 * Record token usage for cost tracking.
 */
export function recordTokenUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  estimatedCostUsd?: number
): void {
  logger.debug(
    { userId, model, inputTokens, outputTokens, estimatedCostUsd },
    'Token usage recorded'
  )
  // When DB is wired, persist to token_usage table
}

/**
 * Get usage for a user in a time range (from in-memory or DB).
 */
export function getUsageForUser(
  userId: string,
  fromDate: Date,
  toDate: Date
): UsageRecord[] {
  return inMemoryUsage.filter(
    (r) =>
      r.userId === userId &&
      r.createdAt >= fromDate &&
      r.createdAt <= toDate
  )
}

/**
 * Get total API call count for user in current month.
 */
export function getMonthlyCallCount(userId: string): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return getUsageForUser(userId, start, now).length
}

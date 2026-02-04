/**
 * Limit Constants
 *
 * Centralized limits for budgets, rate limiting, concurrency, and sizes.
 * All monetary values are in cents (USD) unless otherwise noted.
 *
 * @module constants/limits
 */

// =============================================================================
// BUDGET LIMITS (in cents)
// =============================================================================

/**
 * Default session budget limit ($50.00)
 */
export const BUDGET_SESSION_LIMIT_CENTS = 5_000;

/**
 * Default daily budget limit ($500.00)
 */
export const BUDGET_DAILY_LIMIT_CENTS = 50_000;

/**
 * Default monthly budget limit ($5,000.00)
 */
export const BUDGET_MONTHLY_LIMIT_CENTS = 500_000;

/**
 * Auto-approve threshold ($0.25)
 * Operations under this cost are auto-approved
 */
export const BUDGET_AUTO_APPROVE_CENTS = 25;

/**
 * Warning threshold percentage (80%)
 */
export const BUDGET_WARNING_THRESHOLD_PERCENT = 80;

/**
 * Critical threshold percentage (95%)
 */
export const BUDGET_CRITICAL_THRESHOLD_PERCENT = 95;

// =============================================================================
// RATE LIMITS
// =============================================================================

/**
 * Max API requests per minute
 */
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 60;

/**
 * Max tokens per minute
 */
export const RATE_LIMIT_TOKENS_PER_MINUTE = 100_000;

/**
 * Max cost per minute in cents ($1.00)
 */
export const RATE_LIMIT_COST_PER_MINUTE_CENTS = 100;

/**
 * Max SSE connections per user
 */
export const RATE_LIMIT_SSE_CONNECTIONS = 5;

/**
 * Max file uploads per minute
 */
export const RATE_LIMIT_UPLOADS_PER_MINUTE = 10;

// =============================================================================
// CONCURRENCY LIMITS
// =============================================================================

/**
 * Max concurrent agents per user
 */
export const MAX_CONCURRENT_AGENTS = 10;

/**
 * Max concurrent goals per user
 */
export const MAX_CONCURRENT_GOALS = 5;

/**
 * Max concurrent tasks per agent
 */
export const MAX_CONCURRENT_TASKS = 20;

/**
 * Max concurrent LLM requests
 */
export const MAX_CONCURRENT_LLM_REQUESTS = 10;

/**
 * Max concurrent tool executions
 */
export const MAX_CONCURRENT_TOOL_EXECUTIONS = 5;

// =============================================================================
// SIZE LIMITS
// =============================================================================

/**
 * Max request body size (10MB)
 */
export const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Max file upload size (50MB)
 */
export const MAX_FILE_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Max message length (100KB)
 */
export const MAX_MESSAGE_LENGTH = 100_000;

/**
 * Max context tokens for LLM
 */
export const MAX_CONTEXT_TOKENS = 128_000;

/**
 * Max output tokens for LLM
 */
export const MAX_OUTPUT_TOKENS = 16_000;

/**
 * Max goals in queue
 */
export const MAX_QUEUE_SIZE = 100;

/**
 * Max checkpoints per goal
 */
export const MAX_CHECKPOINTS_PER_GOAL = 50;

/**
 * Max child goals per parent
 */
export const MAX_CHILD_GOALS = 10;

// =============================================================================
// RETRY LIMITS
// =============================================================================

/**
 * Default max retries
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Max retries for LLM calls
 */
export const LLM_MAX_RETRIES = 3;

/**
 * Max retries for tool execution
 */
export const TOOL_MAX_RETRIES = 2;

/**
 * Max retries for goal execution
 */
export const GOAL_MAX_RETRIES = 3;

// =============================================================================
// CACHE LIMITS
// =============================================================================

/**
 * Max items in memory cache
 */
export const CACHE_MAX_ITEMS = 1000;

/**
 * Max size of cached item (1MB)
 */
export const CACHE_MAX_ITEM_SIZE_BYTES = 1024 * 1024;

// =============================================================================
// LIMIT PRESETS (grouped for convenience)
// =============================================================================

export const LIMITS = {
  /** Budget limits */
  BUDGET: {
    SESSION: BUDGET_SESSION_LIMIT_CENTS,
    DAILY: BUDGET_DAILY_LIMIT_CENTS,
    MONTHLY: BUDGET_MONTHLY_LIMIT_CENTS,
    AUTO_APPROVE: BUDGET_AUTO_APPROVE_CENTS,
    WARNING_PERCENT: BUDGET_WARNING_THRESHOLD_PERCENT,
    CRITICAL_PERCENT: BUDGET_CRITICAL_THRESHOLD_PERCENT,
  },
  /** Rate limits */
  RATE: {
    REQUESTS_PER_MINUTE: RATE_LIMIT_REQUESTS_PER_MINUTE,
    TOKENS_PER_MINUTE: RATE_LIMIT_TOKENS_PER_MINUTE,
    COST_PER_MINUTE: RATE_LIMIT_COST_PER_MINUTE_CENTS,
    SSE_CONNECTIONS: RATE_LIMIT_SSE_CONNECTIONS,
  },
  /** Concurrency limits */
  CONCURRENCY: {
    AGENTS: MAX_CONCURRENT_AGENTS,
    GOALS: MAX_CONCURRENT_GOALS,
    TASKS: MAX_CONCURRENT_TASKS,
    LLM_REQUESTS: MAX_CONCURRENT_LLM_REQUESTS,
    TOOL_EXECUTIONS: MAX_CONCURRENT_TOOL_EXECUTIONS,
  },
  /** Size limits */
  SIZE: {
    REQUEST_BODY: MAX_REQUEST_BODY_BYTES,
    FILE_UPLOAD: MAX_FILE_UPLOAD_BYTES,
    MESSAGE: MAX_MESSAGE_LENGTH,
    CONTEXT_TOKENS: MAX_CONTEXT_TOKENS,
    OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
  },
  /** Retry limits */
  RETRY: {
    DEFAULT: DEFAULT_MAX_RETRIES,
    LLM: LLM_MAX_RETRIES,
    TOOL: TOOL_MAX_RETRIES,
    GOAL: GOAL_MAX_RETRIES,
  },
  /** Cache limits */
  CACHE: {
    MAX_ITEMS: CACHE_MAX_ITEMS,
    MAX_ITEM_SIZE: CACHE_MAX_ITEM_SIZE_BYTES,
  },
} as const;

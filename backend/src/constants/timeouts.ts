/**
 * Timeout Constants
 *
 * Centralized timeout values for consistent behavior across the application.
 * All values are in milliseconds unless otherwise noted.
 *
 * @module constants/timeouts
 */

// =============================================================================
// CORE TIMEOUTS
// =============================================================================

/**
 * Default timeout for general operations (5 minutes)
 */
export const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * Timeout for LLM API calls (2 minutes)
 */
export const LLM_TIMEOUT_MS = 120_000;

/**
 * Timeout for tool execution (1 minute)
 */
export const TOOL_TIMEOUT_MS = 60_000;

/**
 * Timeout for database operations (30 seconds)
 */
export const DB_TIMEOUT_MS = 30_000;

/**
 * Timeout for external API calls (30 seconds)
 */
export const EXTERNAL_API_TIMEOUT_MS = 30_000;

// =============================================================================
// SSE & STREAMING
// =============================================================================

/**
 * SSE heartbeat interval (30 seconds)
 */
export const SSE_HEARTBEAT_MS = 30_000;

/**
 * SSE reconnection delay (5 seconds)
 */
export const SSE_RECONNECT_DELAY_MS = 5_000;

/**
 * SSE connection timeout (5 minutes)
 */
export const SSE_CONNECTION_TIMEOUT_MS = 300_000;

// =============================================================================
// QUEUE & POLLING
// =============================================================================

/**
 * Queue polling interval (30 seconds)
 */
export const QUEUE_POLL_INTERVAL_MS = 30_000;

/**
 * Goal queue processing interval (5 seconds)
 */
export const GOAL_QUEUE_INTERVAL_MS = 5_000;

/**
 * Background job check interval (1 minute)
 */
export const BACKGROUND_JOB_INTERVAL_MS = 60_000;

// =============================================================================
// CACHE
// =============================================================================

/**
 * Default cache TTL (1 hour)
 */
export const CACHE_DEFAULT_TTL_MS = 3_600_000;

/**
 * Short cache TTL for frequently changing data (5 minutes)
 */
export const CACHE_SHORT_TTL_MS = 300_000;

/**
 * Long cache TTL for stable data (24 hours)
 */
export const CACHE_LONG_TTL_MS = 86_400_000;

// =============================================================================
// RETRY & BACKOFF
// =============================================================================

/**
 * Initial retry delay (1 second)
 */
export const RETRY_INITIAL_DELAY_MS = 1_000;

/**
 * Maximum retry delay (30 seconds)
 */
export const RETRY_MAX_DELAY_MS = 30_000;

/**
 * Exponential backoff multiplier
 */
export const RETRY_BACKOFF_MULTIPLIER = 2;

// =============================================================================
// GRACE PERIODS
// =============================================================================

/**
 * Kill switch grace period (5 seconds)
 */
export const KILL_SWITCH_GRACE_PERIOD_MS = 5_000;

/**
 * Shutdown grace period (10 seconds)
 */
export const SHUTDOWN_GRACE_PERIOD_MS = 10_000;

/**
 * Session cleanup grace period (1 hour)
 */
export const SESSION_CLEANUP_GRACE_MS = 3_600_000;

// =============================================================================
// DEBOUNCE & THROTTLE
// =============================================================================

/**
 * Default debounce delay (300ms)
 */
export const DEBOUNCE_DEFAULT_MS = 300;

/**
 * UI update throttle (100ms)
 */
export const UI_THROTTLE_MS = 100;

/**
 * API request debounce (500ms)
 */
export const API_DEBOUNCE_MS = 500;

// =============================================================================
// TIMEOUT PRESETS (grouped for convenience)
// =============================================================================

export const TIMEOUTS = {
  /** Default operation timeout */
  DEFAULT: DEFAULT_TIMEOUT_MS,
  /** LLM API call timeout */
  LLM: LLM_TIMEOUT_MS,
  /** Tool execution timeout */
  TOOL: TOOL_TIMEOUT_MS,
  /** Database operation timeout */
  DB: DB_TIMEOUT_MS,
  /** External API timeout */
  EXTERNAL_API: EXTERNAL_API_TIMEOUT_MS,
  /** SSE heartbeat */
  SSE_HEARTBEAT: SSE_HEARTBEAT_MS,
  /** SSE reconnect delay */
  SSE_RECONNECT: SSE_RECONNECT_DELAY_MS,
  /** Queue polling */
  QUEUE_POLL: QUEUE_POLL_INTERVAL_MS,
  /** Cache default TTL */
  CACHE_TTL: CACHE_DEFAULT_TTL_MS,
  /** Kill switch grace */
  KILL_SWITCH_GRACE: KILL_SWITCH_GRACE_PERIOD_MS,
  /** Shutdown grace */
  SHUTDOWN_GRACE: SHUTDOWN_GRACE_PERIOD_MS,
} as const;

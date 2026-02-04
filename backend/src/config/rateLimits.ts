/**
 * Rate Limit Configuration
 *
 * Externalized rate limit settings that can be configured via environment variables.
 * This allows runtime configuration without code changes.
 *
 * @module config/rateLimits
 */

import { z } from "zod";
import logger from "../middleware/logger.js";

// =============================================================================
// SCHEMA DEFINITION
// =============================================================================

const rateLimitConfigSchema = z.object({
  // Global rate limits
  global: z.object({
    windowMs: z
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000), // 15 minutes
    maxRequests: z.number().int().positive().default(100),
  }),

  // Per-endpoint rate limits
  endpoints: z.record(
    z.object({
      windowMs: z.number().int().positive(),
      maxRequests: z.number().int().positive(),
      message: z.string().optional(),
    }),
  ),

  // Tier multipliers (how much to scale limits by tier)
  tierMultipliers: z.object({
    free: z.number().positive().default(1),
    pro: z.number().positive().default(4),
    team: z.number().positive().default(8),
    enterprise: z.number().positive().default(20),
  }),

  // Feature flags
  useRedis: z.boolean().default(true),
  skipHealthChecks: z.boolean().default(true),
});

export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: RateLimitConfig = {
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  endpoints: {
    "/api/chat": {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: "Too many chat requests. Please wait a moment.",
    },
    "/api/codegen": {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: "Too many code generation requests. Please wait a moment.",
    },
    "/api/diagram": {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: "Too many diagram requests. Please wait a moment.",
    },
    "/api/intent": {
      windowMs: 60 * 1000,
      maxRequests: 15,
      message: "Too many intent requests. Please wait a moment.",
    },
    "/api/architecture": {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: "Too many architecture requests. Please wait a moment.",
    },
    "/api/prd": {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: "Too many PRD requests. Please wait a moment.",
    },
    "/api/voice": {
      windowMs: 60 * 1000,
      maxRequests: 20,
      message: "Too many voice requests. Please wait a moment.",
    },
    "/api/ship": {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: "Too many ship requests. Please wait a moment.",
    },
    "/api/gagent": {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: "Too many G-Agent requests. Please wait a moment.",
    },
  },
  tierMultipliers: {
    free: 1,
    pro: 4,
    team: 8,
    enterprise: 20,
  },
  useRedis: true,
  skipHealthChecks: true,
};

// =============================================================================
// CONFIGURATION LOADING
// =============================================================================

/**
 * Load rate limit configuration from environment or use defaults.
 *
 * Environment variables:
 * - RATE_LIMIT_CONFIG: JSON string with full configuration
 * - RATE_LIMIT_GLOBAL_WINDOW_MS: Global window in milliseconds
 * - RATE_LIMIT_GLOBAL_MAX: Global max requests
 * - RATE_LIMIT_TIER_MULTIPLIER_PRO: Pro tier multiplier
 * - RATE_LIMIT_TIER_MULTIPLIER_TEAM: Team tier multiplier
 * - RATE_LIMIT_TIER_MULTIPLIER_ENTERPRISE: Enterprise tier multiplier
 */
export function loadRateLimitConfig(): RateLimitConfig {
  // Try to load full config from JSON env var
  const jsonConfig = process.env.RATE_LIMIT_CONFIG;
  if (jsonConfig) {
    try {
      const parsed = JSON.parse(jsonConfig);
      const validated = rateLimitConfigSchema.parse(parsed);
      logger.info("Rate limit config loaded from RATE_LIMIT_CONFIG env var");
      return validated;
    } catch (err) {
      logger.warn(
        { err },
        "Failed to parse RATE_LIMIT_CONFIG, using defaults with overrides",
      );
    }
  }

  // Apply individual env var overrides
  const config = { ...DEFAULT_CONFIG };

  // Global overrides
  if (process.env.RATE_LIMIT_GLOBAL_WINDOW_MS) {
    config.global.windowMs = parseInt(
      process.env.RATE_LIMIT_GLOBAL_WINDOW_MS,
      10,
    );
  }
  if (process.env.RATE_LIMIT_GLOBAL_MAX) {
    config.global.maxRequests = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX, 10);
  }

  // Tier multiplier overrides
  if (process.env.RATE_LIMIT_TIER_MULTIPLIER_FREE) {
    config.tierMultipliers.free = parseFloat(
      process.env.RATE_LIMIT_TIER_MULTIPLIER_FREE,
    );
  }
  if (process.env.RATE_LIMIT_TIER_MULTIPLIER_PRO) {
    config.tierMultipliers.pro = parseFloat(
      process.env.RATE_LIMIT_TIER_MULTIPLIER_PRO,
    );
  }
  if (process.env.RATE_LIMIT_TIER_MULTIPLIER_TEAM) {
    config.tierMultipliers.team = parseFloat(
      process.env.RATE_LIMIT_TIER_MULTIPLIER_TEAM,
    );
  }
  if (process.env.RATE_LIMIT_TIER_MULTIPLIER_ENTERPRISE) {
    config.tierMultipliers.enterprise = parseFloat(
      process.env.RATE_LIMIT_TIER_MULTIPLIER_ENTERPRISE,
    );
  }

  // Feature flags
  if (process.env.RATE_LIMIT_USE_REDIS !== undefined) {
    config.useRedis = process.env.RATE_LIMIT_USE_REDIS === "true";
  }
  if (process.env.RATE_LIMIT_SKIP_HEALTH_CHECKS !== undefined) {
    config.skipHealthChecks =
      process.env.RATE_LIMIT_SKIP_HEALTH_CHECKS === "true";
  }

  return config;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let _config: RateLimitConfig | null = null;

/**
 * Get rate limit configuration (cached singleton).
 */
export function getRateLimitConfig(): RateLimitConfig {
  if (!_config) {
    _config = loadRateLimitConfig();
  }
  return _config;
}

/**
 * Reload rate limit configuration (for runtime updates).
 */
export function reloadRateLimitConfig(): RateLimitConfig {
  _config = loadRateLimitConfig();
  logger.info("Rate limit configuration reloaded");
  return _config;
}

/**
 * Get endpoint-specific rate limit config.
 */
export function getEndpointRateLimitConfig(
  path: string,
): RateLimitConfig["endpoints"][string] | undefined {
  const config = getRateLimitConfig();

  // Exact match
  if (config.endpoints[path]) {
    return config.endpoints[path];
  }

  // Prefix match (e.g., /api/chat/stream -> /api/chat)
  for (const basePath of Object.keys(config.endpoints)) {
    if (path.startsWith(basePath + "/")) {
      return config.endpoints[basePath];
    }
  }

  return undefined;
}

/**
 * Get tier multiplier.
 */
export function getTierMultiplier(
  tier: "free" | "pro" | "team" | "enterprise",
): number {
  const config = getRateLimitConfig();
  return config.tierMultipliers[tier] ?? 1;
}

export default getRateLimitConfig;

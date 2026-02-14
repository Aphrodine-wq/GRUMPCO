/**
 * URL Constants
 *
 * Centralized URL configuration for consistent endpoint references.
 * All URLs should be configured via environment variables with sensible defaults.
 *
 * @module constants/urls
 */

// =============================================================================
// LOCAL DEVELOPMENT DEFAULTS
// =============================================================================

/**
 * Default backend API port
 */
export const DEFAULT_API_PORT = 3000;

/**
 * Default frontend dev server port
 */
export const DEFAULT_FRONTEND_PORT = 5173;

/**
 * Default Ollama local port
 */
export const DEFAULT_OLLAMA_PORT = 11434;

/**
 * Default Redis port
 */
export const DEFAULT_REDIS_PORT = 6379;

// =============================================================================
// URL BUILDERS
// =============================================================================

/**
 * Get the API base URL from environment or default
 */
export function getApiBaseUrl(): string {
  return process.env.API_URL || `http://localhost:${DEFAULT_API_PORT}`;
}

/**
 * Get the frontend base URL from environment or default
 */
export function getFrontendBaseUrl(): string {
  return process.env.FRONTEND_URL || `http://localhost:${DEFAULT_FRONTEND_PORT}`;
}

/**
 * Get the Ollama base URL from environment or default
 */
export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_URL || `http://localhost:${DEFAULT_OLLAMA_PORT}`;
}

/**
 * Get the Redis URL from environment or default
 */
export function getRedisUrl(): string {
  return process.env.REDIS_URL || `redis://localhost:${DEFAULT_REDIS_PORT}`;
}

// =============================================================================
// EXTERNAL SERVICE URLS
// =============================================================================

/**
 * NVIDIA NIM API base URL - Primary LLM Provider
 * Powered by NVIDIA - https://build.nvidia.com/
 */
export const NVIDIA_NIM_API_URL = 'https://integrate.api.nvidia.com';

/**
 * OpenAI API base URL (for embeddings compatibility)
 */
export const OPENAI_API_URL = 'https://api.openai.com';

/**
 * GitHub API base URL
 */
export const GITHUB_API_URL = 'https://api.github.com';

/**
 * Google OAuth URLs
 */
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * Discord OAuth URLs
 */
export const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
export const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
export const DISCORD_API_URL = 'https://discord.com/api/v10';

/**
 * Stripe API URL
 */
export const STRIPE_API_URL = 'https://api.stripe.com';

// =============================================================================
// URL PRESETS (grouped for convenience)
// =============================================================================

export const URLS = {
  /** Get API base URL */
  API: getApiBaseUrl,
  /** Get frontend base URL */
  FRONTEND: getFrontendBaseUrl,
  /** Get Ollama base URL */
  OLLAMA: getOllamaBaseUrl,
  /** Get Redis URL */
  REDIS: getRedisUrl,
  /** NVIDIA NIM API - Primary LLM Provider */
  NVIDIA: NVIDIA_NIM_API_URL,
  /** OpenAI API */
  OPENAI: OPENAI_API_URL,
  /** GitHub API */
  GITHUB: GITHUB_API_URL,
  /** Stripe API */
  STRIPE: STRIPE_API_URL,
} as const;

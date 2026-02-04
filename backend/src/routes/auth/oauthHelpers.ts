/**
 * OAuth Helpers
 *
 * Shared utilities for OAuth authentication flows.
 * Reduces code duplication across Discord, Google, and GitHub OAuth routes.
 *
 * @module routes/auth/oauthHelpers
 */

import type { Response } from "express";
import { auth } from "../../services/supabaseClient.js";
import { getRequestLogger } from "../../middleware/logger.js";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported OAuth providers
 */
export type OAuthProvider = "discord" | "google" | "github";

/**
 * Common query parameters for OAuth initiation
 */
export interface OAuthInitQuery {
  cli?: string;
  redirect_uri?: string;
  state?: string;
}

/**
 * Common query parameters for OAuth callback
 */
export interface OAuthCallbackQuery {
  code?: string;
  error?: string;
  state?: string;
}

/**
 * OAuth state object passed through the flow
 */
export interface OAuthState {
  cli?: boolean;
  redirect_uri?: string;
  original_state?: string;
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /** OAuth scopes to request */
  scopes: string;
  /** Environment variable name for redirect URL */
  redirectEnvVar: string;
  /** Display name for error messages */
  displayName: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Provider configurations
 */
export const PROVIDER_CONFIGS: Record<OAuthProvider, ProviderConfig> = {
  discord: {
    scopes: "identify email",
    redirectEnvVar: "DISCORD_OAUTH_REDIRECT_URL",
    displayName: "Discord",
  },
  google: {
    scopes: "openid email profile",
    redirectEnvVar: "GOOGLE_OAUTH_REDIRECT_URL",
    displayName: "Google",
  },
  github: {
    scopes: "read:user user:email",
    redirectEnvVar: "GITHUB_OAUTH_REDIRECT_URL",
    displayName: "GitHub",
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build OAuth state object from query parameters
 */
export function buildOAuthState(query: OAuthInitQuery): OAuthState {
  const state: OAuthState = {};
  const isCli = query.cli === "true";

  if (isCli && query.redirect_uri) {
    state.cli = true;
    state.redirect_uri = query.redirect_uri;
  }

  if (query.state) {
    state.original_state = query.state;
  }

  return state;
}

/**
 * Encode OAuth state for URL transmission
 */
export function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

/**
 * Decode OAuth state from URL parameter
 */
export function decodeState(encodedState: string): OAuthState | null {
  try {
    const decoded = Buffer.from(encodedState, "base64").toString("utf-8");
    return JSON.parse(decoded) as OAuthState;
  } catch {
    return null;
  }
}

/**
 * Get the callback URL for a provider
 */
export function getCallbackUrl(provider: OAuthProvider): string {
  const config = PROVIDER_CONFIGS[provider];
  const envUrl = process.env[config.redirectEnvVar];
  const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  return envUrl || `${baseUrl}/auth/${provider}/callback`;
}

/**
 * Check if request is from CLI
 */
export function isCli(query: OAuthInitQuery): boolean {
  return query.cli === "true";
}

/**
 * Handle OAuth initialization error
 */
export function handleOAuthInitError(
  res: Response,
  provider: OAuthProvider,
  errorMessage: string,
  query: OAuthInitQuery,
): void {
  const log = getRequestLogger();
  const config = PROVIDER_CONFIGS[provider];

  log.error({ error: errorMessage }, `${config.displayName} OAuth init failed`);

  if (isCli(query) && query.redirect_uri) {
    res.redirect(
      `${query.redirect_uri}?error=${encodeURIComponent(errorMessage)}`,
    );
    return;
  }

  res.status(500).json({
    error: `Failed to initiate ${config.displayName} authentication`,
    type: "oauth_init_error",
  });
}

/**
 * Handle successful OAuth URL generation
 */
export function handleOAuthUrl(
  res: Response,
  oauthUrl: string,
  query: OAuthInitQuery,
  state: OAuthState,
): void {
  if (isCli(query) && query.redirect_uri) {
    const url = new URL(oauthUrl);
    url.searchParams.set("state", encodeState(state));
    res.redirect(url.toString());
  } else {
    res.redirect(oauthUrl);
  }
}

/**
 * Handle callback error redirect
 */
export function handleCallbackError(
  res: Response,
  redirectUri: string,
  errorMessage: string,
  originalState?: string,
): void {
  const params = new URLSearchParams({ error: errorMessage });
  if (originalState) {
    params.set("state", originalState);
  }
  res.redirect(`${redirectUri}?${params.toString()}`);
}

/**
 * Handle successful callback redirect
 */
export function handleCallbackSuccess(
  res: Response,
  redirectUri: string,
  tokens: { accessToken: string; refreshToken?: string },
  originalState?: string,
): void {
  const params = new URLSearchParams({
    access_token: tokens.accessToken,
  });
  if (tokens.refreshToken) {
    params.set("refresh_token", tokens.refreshToken);
  }
  if (originalState) {
    params.set("state", originalState);
  }
  res.redirect(`${redirectUri}?${params.toString()}`);
}

/**
 * Initiate OAuth flow for a provider
 *
 * @param provider - The OAuth provider
 * @param res - Express response object
 * @param query - Query parameters from the request
 */
export async function initiateOAuthFlow(
  provider: OAuthProvider,
  res: Response,
  query: OAuthInitQuery,
): Promise<void> {
  const config = PROVIDER_CONFIGS[provider];
  const state = buildOAuthState(query);
  const redirectTo = getCallbackUrl(provider);

  const { data, error } = await auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      scopes: config.scopes,
    },
  });

  if (error) {
    handleOAuthInitError(res, provider, error.message, query);
    return;
  }

  if (data.url) {
    handleOAuthUrl(res, data.url, query, state);
  } else {
    res.status(500).json({
      error: "No OAuth URL returned",
      type: "oauth_init_error",
    });
  }
}

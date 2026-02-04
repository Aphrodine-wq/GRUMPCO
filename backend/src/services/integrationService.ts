/**
 * Integration Service
 * Manages integrations, OAuth tokens, and connection status
 */

import { getDatabase } from '../db/database.js';
import { encryptValue, decryptValue, type EncryptedPayload } from './cryptoService.js';
import { writeAuditLog } from './auditLogService.js';
import logger from '../middleware/logger.js';
import type {
  IntegrationProviderId,
  IntegrationStatus,
  IntegrationRecord,
  OAuthTokenRecord,
  CreateIntegrationInput,
  CreateOAuthTokenInput,
} from '../types/integrations.js';

// ========== Integration CRUD ==========

/**
 * Create or update an integration
 */
export async function upsertIntegration(input: CreateIntegrationInput): Promise<IntegrationRecord> {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Check if integration already exists
  const existing = await db.getIntegrationByProvider(input.userId, input.provider);

  const record: IntegrationRecord = {
    id:
      existing?.id ??
      `int_${input.provider}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: input.userId,
    provider: input.provider,
    status: existing?.status ?? 'pending',
    display_name: input.displayName ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  await db.saveIntegration(record);

  await writeAuditLog({
    userId: input.userId,
    action: existing ? 'integration.updated' : 'integration.created',
    category: 'integration',
    target: input.provider,
    metadata: { integrationId: record.id },
  });

  logger.info({ provider: input.provider, integrationId: record.id }, 'Integration upserted');
  return record;
}

/**
 * Get all integrations for a user
 */
export async function getIntegrations(userId: string): Promise<IntegrationRecord[]> {
  const db = getDatabase();
  return db.getIntegrationsForUser(userId);
}

/**
 * Get integration by provider
 */
export async function getIntegrationByProvider(
  userId: string,
  provider: IntegrationProviderId
): Promise<IntegrationRecord | null> {
  const db = getDatabase();
  return db.getIntegrationByProvider(userId, provider);
}

/**
 * Update integration status
 */
export async function updateIntegrationStatus(
  userId: string,
  provider: IntegrationProviderId,
  status: IntegrationStatus,
  errorMessage?: string
): Promise<void> {
  const db = getDatabase();
  const existing = await db.getIntegrationByProvider(userId, provider);
  if (!existing) {
    throw new Error(`Integration not found: ${provider}`);
  }

  const metadata = existing.metadata ? JSON.parse(existing.metadata) : {};
  if (errorMessage) {
    metadata.lastError = errorMessage;
    metadata.lastErrorAt = new Date().toISOString();
  }

  const record: IntegrationRecord = {
    ...existing,
    status,
    metadata: JSON.stringify(metadata),
    updated_at: new Date().toISOString(),
  };

  await db.saveIntegration(record);

  await writeAuditLog({
    userId,
    action: 'integration.status_changed',
    category: 'integration',
    target: provider,
    metadata: { status, error: errorMessage },
  });
}

/**
 * Delete an integration (and related tokens/secrets)
 */
export async function deleteIntegration(
  userId: string,
  provider: IntegrationProviderId
): Promise<void> {
  const db = getDatabase();
  const existing = await db.getIntegrationByProvider(userId, provider);
  if (!existing) {
    return;
  }

  // Delete OAuth token if exists
  await db.deleteOAuthToken(userId, provider);

  // Delete the integration
  await db.deleteIntegration(existing.id);

  await writeAuditLog({
    userId,
    action: 'integration.deleted',
    category: 'integration',
    target: provider,
  });

  logger.info({ provider }, 'Integration deleted');
}

// ========== OAuth Token Management ==========

/**
 * Store OAuth tokens (encrypted)
 */
export async function storeOAuthTokens(input: CreateOAuthTokenInput): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Encrypt tokens
  const accessTokenEnc = encryptValue(input.accessTokenEnc);
  const refreshTokenEnc = input.refreshTokenEnc ? encryptValue(input.refreshTokenEnc) : null;

  const record: OAuthTokenRecord = {
    id: `oauth_${input.provider}_${Date.now()}`,
    user_id: input.userId,
    provider: input.provider,
    access_token_enc: JSON.stringify(accessTokenEnc),
    refresh_token_enc: refreshTokenEnc ? JSON.stringify(refreshTokenEnc) : null,
    token_type: input.tokenType ?? 'Bearer',
    scope: input.scope ?? null,
    expires_at: input.expiresAt ?? null,
    created_at: now,
    updated_at: now,
  };

  await db.saveOAuthToken(record);

  // Update integration status to active
  await updateIntegrationStatus(input.userId, input.provider, 'active');

  await writeAuditLog({
    userId: input.userId,
    action: 'oauth.tokens_stored',
    category: 'security',
    target: input.provider,
  });

  logger.info({ provider: input.provider }, 'OAuth tokens stored');
}

/**
 * Get decrypted OAuth access token
 */
export async function getAccessToken(
  userId: string,
  provider: IntegrationProviderId
): Promise<string | null> {
  const db = getDatabase();
  const record = await db.getOAuthToken(userId, provider);
  if (!record) return null;

  try {
    const payload = JSON.parse(record.access_token_enc) as EncryptedPayload;
    return decryptValue(payload);
  } catch (err) {
    logger.error({ provider, error: (err as Error).message }, 'Failed to decrypt access token');
    return null;
  }
}

/**
 * Get decrypted OAuth refresh token
 */
export async function getRefreshToken(
  userId: string,
  provider: IntegrationProviderId
): Promise<string | null> {
  const db = getDatabase();
  const record = await db.getOAuthToken(userId, provider);
  if (!record?.refresh_token_enc) return null;

  try {
    const payload = JSON.parse(record.refresh_token_enc) as EncryptedPayload;
    return decryptValue(payload);
  } catch (err) {
    logger.error({ provider, error: (err as Error).message }, 'Failed to decrypt refresh token');
    return null;
  }
}

/**
 * Check if OAuth token is expired
 */
export async function isTokenExpired(
  userId: string,
  provider: IntegrationProviderId
): Promise<boolean> {
  const db = getDatabase();
  const record = await db.getOAuthToken(userId, provider);
  if (!record) return true;
  if (!record.expires_at) return false;

  const expiresAt = new Date(record.expires_at);
  const now = new Date();
  // Consider expired 5 minutes before actual expiry
  return now.getTime() > expiresAt.getTime() - 5 * 60 * 1000;
}

/**
 * Revoke OAuth tokens
 */
export async function revokeOAuthTokens(
  userId: string,
  provider: IntegrationProviderId
): Promise<void> {
  const db = getDatabase();
  await db.deleteOAuthToken(userId, provider);
  await updateIntegrationStatus(userId, provider, 'disabled');

  await writeAuditLog({
    userId,
    action: 'oauth.tokens_revoked',
    category: 'security',
    target: provider,
  });

  logger.info({ provider }, 'OAuth tokens revoked');
}

// ========== OAuth Flow Helpers ==========

/**
 * OAuth provider configurations
 */
export const OAUTH_PROVIDERS: Record<
  IntegrationProviderId,
  {
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    supportsOAuth: boolean;
  } | null
> = {
  discord: {
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scopes: ['identify', 'guilds', 'bot', 'messages.read'],
    supportsOAuth: true,
  },
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read', 'users:read', 'commands'],
    supportsOAuth: true,
  },
  spotify: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
    ],
    supportsOAuth: true,
  },
  gmail: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    supportsOAuth: true,
  },
  google_calendar: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    supportsOAuth: true,
  },
  notion: {
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    supportsOAuth: true,
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read'],
    supportsOAuth: true,
  },
  // Non-OAuth providers (use API keys or local access)
  imessage: null,
  signal: null,
  whatsapp: null,
  telegram: null,
  obsidian: null,
  whoop: null,
  philips_hue: null,
  home_assistant: null,
  elevenlabs: null,
  twilio: null,
  // New OAuth providers (Phase 2.3+)
  jira: {
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: [
      'read:jira-work',
      'write:jira-work',
      'read:jira-user',
      'manage:jira-project',
      'offline_access',
    ],
    supportsOAuth: true,
  },
  atlassian: {
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: [
      'read:confluence-space.summary',
      'read:confluence-content.all',
      'write:confluence-content',
      'offline_access',
    ],
    supportsOAuth: true,
  },
  vercel: {
    authUrl: 'https://vercel.com/oauth/authorize',
    tokenUrl: 'https://api.vercel.com/v2/oauth/access_token',
    scopes: [],
    supportsOAuth: true,
  },
  netlify: {
    authUrl: 'https://app.netlify.com/authorize',
    tokenUrl: 'https://api.netlify.com/oauth/token',
    scopes: [],
    supportsOAuth: true,
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:user', 'read:org', 'workflow'],
    supportsOAuth: true,
  },
  gitlab: {
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    scopes: ['api', 'read_user', 'read_repository', 'write_repository'],
    supportsOAuth: true,
  },
  bitbucket: {
    authUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    scopes: ['repository', 'pullrequest', 'issue', 'account'],
    supportsOAuth: true,
  },
  linear: {
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    scopes: ['read', 'write', 'issues:create', 'comments:create'],
    supportsOAuth: true,
  },
  // Cloud providers (use API keys typically, but some have OAuth)
  aws: null, // Uses access keys
  gcp: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    supportsOAuth: true,
  },
  azure: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['https://management.azure.com/.default', 'offline_access'],
    supportsOAuth: true,
  },
  // Backend-as-a-Service (API keys)
  supabase: null, // Uses project API keys
  firebase: null, // Uses service account or API keys
};

/**
 * Generate OAuth authorization URL
 */
export function generateOAuthUrl(
  provider: IntegrationProviderId,
  redirectUri: string,
  state: string
): string | null {
  const config = OAUTH_PROVIDERS[provider];
  if (!config?.supportsOAuth) return null;

  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  if (!clientId) {
    logger.warn({ provider }, 'OAuth client ID not configured');
    return null;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange OAuth code for tokens
 */
export async function exchangeOAuthCode(
  provider: IntegrationProviderId,
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
} | null> {
  const config = OAUTH_PROVIDERS[provider];
  if (!config?.supportsOAuth) return null;

  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) {
    logger.error({ provider }, 'OAuth credentials not configured');
    return null;
  }

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { provider, status: response.status, error: errorText },
        'OAuth token exchange failed'
      );
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
      tokenType: data.token_type,
    };
  } catch (err) {
    logger.error({ provider, error: (err as Error).message }, 'OAuth token exchange error');
    return null;
  }
}

/**
 * Refresh OAuth tokens
 */
export async function refreshOAuthTokens(
  userId: string,
  provider: IntegrationProviderId
): Promise<boolean> {
  const refreshToken = await getRefreshToken(userId, provider);
  if (!refreshToken) {
    logger.warn({ provider }, 'No refresh token available');
    return false;
  }

  const config = OAUTH_PROVIDERS[provider];
  if (!config?.supportsOAuth) return false;

  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) {
    logger.error({ provider }, 'OAuth credentials not configured');
    return false;
  }

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      logger.error({ provider, status: response.status }, 'OAuth token refresh failed');
      await updateIntegrationStatus(userId, provider, 'error', 'Token refresh failed');
      return false;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined;

    await storeOAuthTokens({
      userId,
      provider,
      accessTokenEnc: data.access_token,
      refreshTokenEnc: data.refresh_token ?? refreshToken,
      expiresAt,
    });

    logger.info({ provider }, 'OAuth tokens refreshed');
    return true;
  } catch (err) {
    logger.error({ provider, error: (err as Error).message }, 'OAuth token refresh error');
    return false;
  }
}

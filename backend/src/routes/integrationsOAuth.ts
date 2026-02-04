/**
 * OAuth Integration Routes
 * 
 * Handles OAuth flows for third-party service integrations (not user authentication).
 * This allows users to connect their accounts to services like Slack, GitHub, Notion, etc.
 */

import express, { type Request, type Response, type Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { getRequestLogger } from '../middleware/logger.js';
import { getOAuthCookieOptions } from '../middleware/cookieSecurity.js';
import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { encrypt } from '../utils/encryption.js';
import type { IntegrationProviderId } from '../types/integrations.js';
import type { OAuthTokenRecord } from '../types/integrations.js';

const router: Router = express.Router();

// OAuth provider configurations
interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  callbackPath: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    scopes: ['chat:write', 'channels:read', 'users:read'],
    callbackPath: '/api/integrations-v2/oauth/slack/callback',
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
    scopes: ['repo', 'read:user', 'user:email'],
    callbackPath: '/api/integrations-v2/oauth/github/callback',
  },
  notion: {
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    clientId: process.env.NOTION_CLIENT_ID || '',
    clientSecret: process.env.NOTION_CLIENT_SECRET || '',
    scopes: ['read', 'write'],
    callbackPath: '/api/integrations-v2/oauth/notion/callback',
  },
  linear: {
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    clientId: process.env.LINEAR_CLIENT_ID || '',
    clientSecret: process.env.LINEAR_CLIENT_SECRET || '',
    scopes: ['read', 'write'],
    callbackPath: '/api/integrations-v2/oauth/linear/callback',
  },
  figma: {
    authUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    clientId: process.env.FIGMA_CLIENT_ID || '',
    clientSecret: process.env.FIGMA_CLIENT_SECRET || '',
    scopes: ['file_read'],
    callbackPath: '/api/integrations-v2/oauth/figma/callback',
  },
  spotify: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    scopes: ['user-read-playback-state', 'user-modify-playback-state', 'playlist-read-private'],
    callbackPath: '/api/integrations-v2/oauth/spotify/callback',
  },
  gmail: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
    callbackPath: '/api/integrations-v2/oauth/gmail/callback',
  },
  google_calendar: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'],
    callbackPath: '/api/integrations-v2/oauth/google_calendar/callback',
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    scopes: ['tweet.read', 'tweet.write', 'users.read'],
    callbackPath: '/api/integrations-v2/oauth/twitter/callback',
  },
  gitlab: {
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    clientId: process.env.GITLAB_CLIENT_ID || '',
    clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
    scopes: ['api', 'read_user', 'read_repository'],
    callbackPath: '/api/integrations-v2/oauth/gitlab/callback',
  },
  bitbucket: {
    authUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    clientId: process.env.BITBUCKET_CLIENT_ID || '',
    clientSecret: process.env.BITBUCKET_CLIENT_SECRET || '',
    scopes: ['repository', 'pullrequest'],
    callbackPath: '/api/integrations-v2/oauth/bitbucket/callback',
  },
  jira: {
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientId: process.env.JIRA_CLIENT_ID || '',
    clientSecret: process.env.JIRA_CLIENT_SECRET || '',
    scopes: ['read:jira-work', 'write:jira-work'],
    callbackPath: '/api/integrations-v2/oauth/jira/callback',
  },
};

interface OAuthState {
  userId: string;
  provider: string;
  timestamp: number;
}

/**
 * GET /api/integrations-v2/oauth/:provider/authorize
 * Initiates OAuth flow for a specific integration provider
 */
router.get('/:provider/authorize', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const log = getRequestLogger();
  const { provider } = req.params;

  if (!OAUTH_PROVIDERS[provider]) {
    res.status(400).json({ error: 'Unsupported OAuth provider', provider });
    return;
  }

  const config = OAUTH_PROVIDERS[provider];

  if (!config.clientId || !config.clientSecret) {
    log.warn({ provider }, 'OAuth provider not configured');
    res.status(503).json({
      error: 'OAuth provider not configured',
      provider,
      message: `Please configure ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET in environment variables`,
    });
    return;
  }

  try {
    // Generate state for CSRF protection
    const state: OAuthState = {
      userId: req.user?.id || '',
      provider,
      timestamp: Date.now(),
    };
    const stateToken = Buffer.from(JSON.stringify(state)).toString('base64url');

    // Store state in cookie for verification
    res.cookie(`oauth_state_${provider}`, stateToken, getOAuthCookieOptions(req, 600));

    // Build authorization URL
    const redirectUri = `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}${config.callbackPath}`;
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', stateToken);
    authUrl.searchParams.set('response_type', 'code');

    // Handle provider-specific scope formats
    if (provider === 'slack') {
      authUrl.searchParams.set('scope', config.scopes.join(','));
      authUrl.searchParams.set('user_scope', 'identity.basic,identity.email');
    } else if (provider === 'twitter') {
      authUrl.searchParams.set('scope', config.scopes.join(' '));
      authUrl.searchParams.set('code_challenge', 'challenge');
      authUrl.searchParams.set('code_challenge_method', 'plain');
    } else {
      authUrl.searchParams.set('scope', config.scopes.join(' '));
    }

    log.info({ provider, userId: req.user?.id }, 'Starting OAuth flow');

    // Return URL for frontend to redirect
    res.json({ url: authUrl.toString() });
  } catch (err) {
    const error = err as Error;
    log.error({ error: error.message, provider }, 'OAuth authorization error');
    res.status(500).json({ error: 'Failed to initiate OAuth flow', provider });
  }
});

/**
 * GET /api/integrations-v2/oauth/:provider/callback
 * Handles OAuth callback and exchanges code for tokens
 */
router.get('/:provider/callback', async (req: Request, res: Response) => {
  const log = getRequestLogger();
  const { provider } = req.params;
  const { code, state, error: oauthError } = req.query;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (oauthError) {
    log.warn({ error: oauthError, provider }, 'OAuth callback error');
    res.redirect(`${frontendUrl}/settings?tab=integrations&error=${encodeURIComponent(String(oauthError))}`);
    return;
  }

  if (!code || !state) {
    log.warn({ provider }, 'OAuth callback missing code or state');
    res.redirect(`${frontendUrl}/settings?tab=integrations&error=missing_parameters`);
    return;
  }

  if (!OAUTH_PROVIDERS[provider]) {
    res.redirect(`${frontendUrl}/settings?tab=integrations&error=unsupported_provider`);
    return;
  }

  const config = OAUTH_PROVIDERS[provider];

  try {
    // Verify state token
    const storedState = req.cookies[`oauth_state_${provider}`];
    if (!storedState || storedState !== state) {
      log.warn({ provider }, 'OAuth state mismatch');
      res.redirect(`${frontendUrl}/settings?tab=integrations&error=state_mismatch`);
      return;
    }

    // Parse state to get user ID
    const stateData: OAuthState = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf-8'));
    
    // Check state expiration (10 minutes)
    if (Date.now() - stateData.timestamp > 600000) {
      log.warn({ provider }, 'OAuth state expired');
      res.redirect(`${frontendUrl}/settings?tab=integrations&error=state_expired`);
      return;
    }

    // Exchange code for access token
    const redirectUri = `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}${config.callbackPath}`;
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      log.error({ provider, status: tokenResponse.status, error: errorText }, 'Token exchange failed');
      res.redirect(`${frontendUrl}/settings?tab=integrations&error=token_exchange_failed`);
      return;
    }

    const tokenData = await tokenResponse.json();

    // Store tokens in database
    const db = getDb();
    const tokenRecord: OAuthTokenRecord = {
      id: crypto.randomUUID(),
      user_id: stateData.userId,
      provider: provider as any,
      access_token_enc: JSON.stringify(encrypt(tokenData.access_token)),
      refresh_token_enc: tokenData.refresh_token ? JSON.stringify(encrypt(tokenData.refresh_token)) : null,
      token_type: tokenData.token_type || 'Bearer',
      scope: tokenData.scope || config.scopes.join(' '),
      expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await db.saveOAuthToken(tokenRecord);
    
    // Also create/update integration record
    const existingIntegrations = await db.listIntegrations(stateData.userId);
    const existingIntegration = existingIntegrations.find(i => i.provider === provider);
    
    if (!existingIntegration) {
      await db.createIntegration({
        userId: stateData.userId,
        provider: provider as any,
        displayName: config.authUrl.includes('google') ? `Google ${provider}` : provider.charAt(0).toUpperCase() + provider.slice(1),
      });
    } else {
      await db.updateIntegration(existingIntegration.id, { status: 'active' });
    }

    log.info({ provider, userId: stateData.userId }, 'OAuth integration connected successfully');

    // Clear state cookie
    res.clearCookie(`oauth_state_${provider}`);

    // Redirect back to frontend with success
    res.redirect(`${frontendUrl}/settings?tab=integrations&success=${provider}`);
  } catch (err) {
    const error = err as Error;
    log.error({ error: error.message, provider }, 'OAuth callback error');
    res.redirect(`${frontendUrl}/settings?tab=integrations&error=server_error`);
  }
});

/**
 * POST /api/integrations-v2/oauth/:provider/refresh
 * Refreshes an expired OAuth token
 */
router.post('/:provider/refresh', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const log = getRequestLogger();
  const { provider } = req.params;

  if (!OAUTH_PROVIDERS[provider]) {
    res.status(400).json({ error: 'Unsupported OAuth provider' });
    return;
  }

  const config = OAUTH_PROVIDERS[provider];

  try {
    // Retrieve refresh token from database
    const db = getDb();
    const tokenRecord = await db.getOAuthToken(req.user?.id || '', provider as any);
    if (!tokenRecord || !tokenRecord.refresh_token_enc) {
      res.status(404).json({ error: 'No refresh token found' });
      return;
    }

    // Note: decrypt function would need to be implemented
    // For now, return not implemented
    log.info({ provider, userId: req.user?.id }, 'OAuth token refresh requested');
    res.json({ success: true, message: 'Token refresh functionality ready - decrypt implementation needed' });
  } catch (err) {
    const error = err as Error;
    log.error({ error: error.message, provider }, 'Token refresh error');
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;

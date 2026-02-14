/**
 * Integrations API Routes
 * Manages provider integrations, OAuth flows, and secrets
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  upsertIntegration,
  getIntegrations,
  getIntegrationByProvider,
  updateIntegrationStatus,
  deleteIntegration,
  storeOAuthTokens,
  revokeOAuthTokens,
  generateOAuthUrl,
  exchangeOAuthCode,
  OAUTH_PROVIDERS,
} from '../services/integrations/integrationService.js';
import {
  storeApiKey,
  storeBotToken,
  getApiKey,
  deleteSecret,
} from '../services/security/secretsService.js';
import { queryAuditLogs } from '../services/security/auditLogService.js';
import { markProviderConfigured } from '../services/ai-providers/llmGateway.js';
import type { IntegrationProviderId } from '../types/integrations.js';
import logger from '../middleware/logger.js';

const router = Router();

// Validation schemas
const providerSchema = z.enum([
  'discord',
  'slack',
  'spotify',
  'imessage',
  'signal',
  'whatsapp',
  'gmail',
  'google_calendar',
  'telegram',
  'notion',
  'obsidian',
  'twitter',
  'whoop',
  'philips_hue',
  'home_assistant',
  'elevenlabs',
  'twilio',
  'github',
  'gitlab',
  'bitbucket',
  'linear',
  'jira',
  'atlassian',
  'vercel',
  'netlify',
  'aws',
  'gcp',
  'azure',
  'supabase',
  'firebase',
  'stripe',
  'figma',
  'sendgrid',
  'sentry',
  'datadog',
  'postman',
  'anthropic',
  'openrouter',
  'google',
  'github_copilot',
]);

const createIntegrationSchema = z.object({
  provider: providerSchema,
  displayName: z.string().optional(),
});

const storeApiKeySchema = z.object({
  provider: providerSchema,
  apiKey: z.string().min(1),
});

const storeBotTokenSchema = z.object({
  provider: providerSchema,
  token: z.string().min(1),
});

// ========== Integration CRUD ==========

/**
 * GET /integrations
 * List all integrations for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const integrations = await getIntegrations(userId);

    // Mask sensitive data
    const safeIntegrations = integrations.map((int) => ({
      ...int,
      metadata: int.metadata ? JSON.parse(int.metadata) : null,
    }));

    res.json({ integrations: safeIntegrations });
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Failed to list integrations');
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

/**
 * GET /integrations-v2/audit-logs
 * Get integration-related audit logs (must be before /:provider so "audit-logs" is not matched as provider).
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await queryAuditLogs({
      userId,
      category: 'integration',
      limit,
      offset,
    });

    res.json({ logs });
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Failed to get audit logs');
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

/**
 * GET /integrations/:provider
 * Get integration by provider
 */
router.get('/:provider', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const provider = providerSchema.parse(req.params.provider);

    const integration = await getIntegrationByProvider(userId, provider);
    if (!integration) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    res.json({
      ...integration,
      metadata: integration.metadata ? JSON.parse(integration.metadata) : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to get integration');
    res.status(500).json({ error: 'Failed to get integration' });
  }
});

/**
 * POST /integrations
 * Create or update an integration
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const { provider, displayName } = createIntegrationSchema.parse(req.body);

    const integration = await upsertIntegration({
      userId,
      provider,
      displayName,
    });

    res.status(201).json(integration);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to create integration');
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

/**
 * DELETE /integrations/:provider
 * Delete an integration
 */
router.delete('/:provider', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const provider = providerSchema.parse(req.params.provider);

    await deleteIntegration(userId, provider);
    res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to delete integration');
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

// ========== OAuth Flows ==========

/**
 * GET /integrations/:provider/oauth/authorize
 * Get OAuth authorization URL
 */
router.get('/:provider/oauth/authorize', async (req: Request, res: Response) => {
  try {
    const provider = providerSchema.parse(req.params.provider) as IntegrationProviderId;

    const oauthConfig = OAUTH_PROVIDERS[provider];
    if (!oauthConfig?.supportsOAuth) {
      res.status(400).json({ error: 'Provider does not support OAuth' });
      return;
    }

    // Generate state for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        provider,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).slice(2),
      })
    ).toString('base64');

    const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/${provider}/oauth/callback`;
    const authUrl = generateOAuthUrl(provider, redirectUri, state);

    if (!authUrl) {
      res.status(500).json({ error: 'OAuth not configured for this provider' });
      return;
    }

    res.json({ authUrl, state });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to generate OAuth URL');
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

/**
 * GET /integrations/:provider/oauth/callback
 * OAuth callback handler
 */
router.get('/:provider/oauth/callback', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const provider = providerSchema.parse(req.params.provider) as IntegrationProviderId;
    const { code, state, error } = req.query;

    if (error) {
      logger.warn({ provider, error }, 'OAuth authorization denied');
      res.redirect(`/settings/integrations?error=${encodeURIComponent(error as string)}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    // Validate state (in production, should verify against stored state)
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
        if (stateData.provider !== provider) {
          res.status(400).json({ error: 'Invalid state' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Invalid state' });
        return;
      }
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/${provider}/oauth/callback`;
    const tokens = await exchangeOAuthCode(provider, code, redirectUri);

    if (!tokens) {
      res.redirect(`/settings/integrations?error=token_exchange_failed`);
      return;
    }

    // Store tokens
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : undefined;

    await storeOAuthTokens({
      userId,
      provider,
      accessTokenEnc: tokens.accessToken,
      refreshTokenEnc: tokens.refreshToken,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      expiresAt,
    });

    // Create/update integration
    await upsertIntegration({ userId, provider });
    await updateIntegrationStatus(userId, provider, 'active');

    res.redirect(`/settings/integrations?success=${provider}`);
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'OAuth callback failed');
    res.redirect(`/settings/integrations?error=callback_failed`);
  }
});

/**
 * POST /integrations/:provider/oauth/revoke
 * Revoke OAuth tokens
 */
router.post('/:provider/oauth/revoke', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const provider = providerSchema.parse(req.params.provider) as IntegrationProviderId;

    await revokeOAuthTokens(userId, provider);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to revoke OAuth tokens');
    res.status(500).json({ error: 'Failed to revoke tokens' });
  }
});

// ========== API Key Management ==========

/**
 * POST /integrations/api-key
 * Store an API key for a provider (body: { provider, apiKey })
 */
router.post('/api-key', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const { provider, apiKey } = storeApiKeySchema.parse(req.body);

    await storeApiKey(userId, provider, apiKey);
    markProviderConfigured(provider);

    // Create/update integration
    await upsertIntegration({ userId, provider });
    await updateIntegrationStatus(userId, provider, 'active');

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to store API key');
    res.status(500).json({ error: 'Failed to store API key' });
  }
});

const storeApiKeyByProviderSchema = z.object({
  apiKey: z.string().min(1),
  keyName: z.string().optional(),
});

/**
 * POST /integrations/:provider/api-key
 * Store an API key for a provider (provider in path, body: { apiKey } or { apiKey, keyName })
 */
router.post('/:provider/api-key', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const provider = providerSchema.parse(req.params.provider);
    const { apiKey } = storeApiKeyByProviderSchema.parse(req.body);

    await storeApiKey(userId, provider, apiKey);
    markProviderConfigured(provider);

    await upsertIntegration({ userId, provider });
    await updateIntegrationStatus(userId, provider, 'active');

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to store API key');
    res.status(500).json({ error: 'Failed to store API key' });
  }
});

/**
 * DELETE /integrations/:provider/api-key
 * Delete an API key
 */
router.delete('/:provider/api-key', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const provider = providerSchema.parse(req.params.provider);

    await deleteSecret(userId, provider, 'api_key');
    await updateIntegrationStatus(userId, provider, 'disabled');

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to delete API key');
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

/**
 * GET /integrations/:provider/api-key/exists
 * Check if API key exists (without revealing it)
 */
router.get('/:provider/api-key/exists', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const provider = providerSchema.parse(req.params.provider);

    const apiKey = await getApiKey(userId, provider);
    res.json({ exists: apiKey !== null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to check API key');
    res.status(500).json({ error: 'Failed to check API key' });
  }
});

// ========== Bot Token Management ==========

/**
 * POST /integrations/bot-token
 * Store a bot token for a provider
 */
router.post('/bot-token', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? 'default';
    const { provider, token } = storeBotTokenSchema.parse(req.body);

    await storeBotToken(userId, provider, token);

    // Create/update integration
    await upsertIntegration({ userId, provider });
    await updateIntegrationStatus(userId, provider, 'active');

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
      return;
    }
    logger.error({ error: (err as Error).message }, 'Failed to store bot token');
    res.status(500).json({ error: 'Failed to store bot token' });
  }
});

export default router;

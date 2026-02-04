/**
 * Integrations V2 Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the integration service
vi.mock('../../src/services/integrationService.js', () => ({
  upsertIntegration: vi.fn(),
  getIntegrations: vi.fn(),
  getIntegrationByProvider: vi.fn(),
  updateIntegrationStatus: vi.fn(),
  deleteIntegration: vi.fn(),
  storeOAuthTokens: vi.fn(),
  revokeOAuthTokens: vi.fn(),
  generateOAuthUrl: vi.fn(),
  exchangeOAuthCode: vi.fn(),
  OAUTH_PROVIDERS: {
    discord: { supportsOAuth: true, authUrl: 'https://discord.com/api/oauth2/authorize' },
    slack: { supportsOAuth: true, authUrl: 'https://slack.com/oauth/v2/authorize' },
    imessage: null,
    signal: null,
  },
}));

// Mock secrets service
vi.mock('../../src/services/secretsService.js', () => ({
  storeApiKey: vi.fn(),
  storeBotToken: vi.fn(),
  getApiKey: vi.fn(),
  deleteSecret: vi.fn(),
}));

// Mock audit log service
vi.mock('../../src/services/auditLogService.js', () => ({
  queryAuditLogs: vi.fn(),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import integrationsRouter from '../../src/routes/integrations-v2.js';
import {
  upsertIntegration,
  getIntegrations,
  getIntegrationByProvider,
  updateIntegrationStatus,
  deleteIntegration,
  revokeOAuthTokens,
  generateOAuthUrl,
  exchangeOAuthCode,
  storeOAuthTokens,
} from '../../src/services/integrationService.js';
import { storeApiKey, storeBotToken, getApiKey, deleteSecret } from '../../src/services/secretsService.js';
import { queryAuditLogs } from '../../src/services/auditLogService.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/integrations', integrationsRouter);
  return app;
}

describe('Integrations V2 Route', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /integrations', () => {
    it('should return list of integrations', async () => {
      const mockIntegrations = [
        {
          id: 'int_discord_1',
          user_id: 'default',
          provider: 'discord',
          status: 'active',
          display_name: 'My Discord',
          metadata: JSON.stringify({ lastConnected: '2025-01-31' }),
          created_at: '2025-01-31T10:00:00.000Z',
          updated_at: '2025-01-31T10:00:00.000Z',
        },
      ];

      vi.mocked(getIntegrations).mockResolvedValue(mockIntegrations);

      const response = await request(app).get('/integrations');

      expect(response.status).toBe(200);
      expect(response.body.integrations).toHaveLength(1);
      expect(response.body.integrations[0].provider).toBe('discord');
      expect(response.body.integrations[0].metadata).toEqual({ lastConnected: '2025-01-31' });
    });

    it('should return empty list', async () => {
      vi.mocked(getIntegrations).mockResolvedValue([]);

      const response = await request(app).get('/integrations');

      expect(response.status).toBe(200);
      expect(response.body.integrations).toEqual([]);
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getIntegrations).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/integrations');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to list integrations');
    });
  });

  describe('GET /integrations/audit-logs', () => {
    it('should return audit logs', async () => {
      const mockLogs = [
        {
          id: 'log_1',
          userId: 'default',
          action: 'integration.created',
          category: 'integration',
          target: 'discord',
          created_at: '2025-01-31T10:00:00.000Z',
        },
      ];

      vi.mocked(queryAuditLogs).mockResolvedValue(mockLogs);

      const response = await request(app).get('/integrations/audit-logs');

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(1);
      expect(queryAuditLogs).toHaveBeenCalledWith({
        userId: 'default',
        category: 'integration',
        limit: 50,
        offset: 0,
      });
    });

    it('should respect limit and offset', async () => {
      vi.mocked(queryAuditLogs).mockResolvedValue([]);

      const response = await request(app).get('/integrations/audit-logs?limit=10&offset=20');

      expect(response.status).toBe(200);
      expect(queryAuditLogs).toHaveBeenCalledWith({
        userId: 'default',
        category: 'integration',
        limit: 10,
        offset: 20,
      });
    });

    it('should return 500 on service error', async () => {
      vi.mocked(queryAuditLogs).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/integrations/audit-logs');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get audit logs');
    });
  });

  describe('GET /integrations/:provider', () => {
    it('should return integration by provider', async () => {
      const mockIntegration = {
        id: 'int_discord_1',
        user_id: 'default',
        provider: 'discord',
        status: 'active',
        display_name: 'My Discord',
        metadata: JSON.stringify({ guildId: '123' }),
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      };

      vi.mocked(getIntegrationByProvider).mockResolvedValue(mockIntegration);

      const response = await request(app).get('/integrations/discord');

      expect(response.status).toBe(200);
      expect(response.body.provider).toBe('discord');
      expect(response.body.metadata).toEqual({ guildId: '123' });
    });

    it('should return 404 if not found', async () => {
      vi.mocked(getIntegrationByProvider).mockResolvedValue(null);

      const response = await request(app).get('/integrations/discord');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Integration not found');
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app).get('/integrations/invalid-provider');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid provider');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getIntegrationByProvider).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/integrations/discord');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get integration');
    });
  });

  describe('POST /integrations', () => {
    it('should create integration', async () => {
      const mockIntegration = {
        id: 'int_slack_1',
        user_id: 'default',
        provider: 'slack',
        status: 'pending',
        display_name: 'My Slack',
        metadata: null,
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      };

      vi.mocked(upsertIntegration).mockResolvedValue(mockIntegration);

      const response = await request(app)
        .post('/integrations')
        .send({
          provider: 'slack',
          displayName: 'My Slack',
        });

      expect(response.status).toBe(201);
      expect(response.body.provider).toBe('slack');
      expect(upsertIntegration).toHaveBeenCalledWith({
        userId: 'default',
        provider: 'slack',
        displayName: 'My Slack',
      });
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app)
        .post('/integrations')
        .send({
          provider: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(upsertIntegration).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/integrations')
        .send({
          provider: 'discord',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create integration');
    });
  });

  describe('DELETE /integrations/:provider', () => {
    it('should delete integration', async () => {
      vi.mocked(deleteIntegration).mockResolvedValue(undefined);

      const response = await request(app).delete('/integrations/discord');

      expect(response.status).toBe(204);
      expect(deleteIntegration).toHaveBeenCalledWith('default', 'discord');
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app).delete('/integrations/invalid-provider');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid provider');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(deleteIntegration).mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/integrations/discord');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete integration');
    });
  });

  describe('GET /integrations/:provider/oauth/authorize', () => {
    it('should return OAuth authorization URL', async () => {
      vi.mocked(generateOAuthUrl).mockReturnValue('https://discord.com/oauth?client_id=123&state=abc');

      const response = await request(app).get('/integrations/discord/oauth/authorize');

      expect(response.status).toBe(200);
      expect(response.body.authUrl).toBe('https://discord.com/oauth?client_id=123&state=abc');
      expect(response.body.state).toBeDefined();
    });

    it('should return 400 for provider that does not support OAuth', async () => {
      const response = await request(app).get('/integrations/imessage/oauth/authorize');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Provider does not support OAuth');
    });

    it('should return 500 if OAuth not configured', async () => {
      vi.mocked(generateOAuthUrl).mockReturnValue(null);

      const response = await request(app).get('/integrations/discord/oauth/authorize');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('OAuth not configured for this provider');
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app).get('/integrations/invalid-provider/oauth/authorize');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid provider');
    });
  });

  describe('GET /integrations/:provider/oauth/callback', () => {
    it('should handle OAuth callback with code', async () => {
      vi.mocked(exchangeOAuthCode).mockResolvedValue({
        accessToken: 'access_123',
        refreshToken: 'refresh_123',
        expiresIn: 3600,
        scope: 'identify guilds',
        tokenType: 'Bearer',
      });
      vi.mocked(storeOAuthTokens).mockResolvedValue(undefined);
      vi.mocked(upsertIntegration).mockResolvedValue({
        id: 'int_1',
        user_id: 'default',
        provider: 'discord',
        status: 'active',
        display_name: null,
        metadata: null,
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      });
      vi.mocked(updateIntegrationStatus).mockResolvedValue(undefined);

      const state = Buffer.from(JSON.stringify({ provider: 'discord', timestamp: Date.now() })).toString('base64');
      const response = await request(app).get(`/integrations/discord/oauth/callback?code=auth_code_123&state=${state}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/settings/integrations?success=discord');
    });

    it('should handle OAuth error', async () => {
      const response = await request(app).get('/integrations/discord/oauth/callback?error=access_denied');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/settings/integrations?error=access_denied');
    });

    it('should return 400 for missing code', async () => {
      const response = await request(app).get('/integrations/discord/oauth/callback');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing authorization code');
    });

    it('should return 400 for invalid state provider mismatch', async () => {
      const state = Buffer.from(JSON.stringify({ provider: 'slack', timestamp: Date.now() })).toString('base64');
      const response = await request(app).get(`/integrations/discord/oauth/callback?code=auth_code&state=${state}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid state');
    });

    it('should redirect on token exchange failure', async () => {
      vi.mocked(exchangeOAuthCode).mockResolvedValue(null);

      const state = Buffer.from(JSON.stringify({ provider: 'discord', timestamp: Date.now() })).toString('base64');
      const response = await request(app).get(`/integrations/discord/oauth/callback?code=bad_code&state=${state}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/settings/integrations?error=token_exchange_failed');
    });
  });

  describe('POST /integrations/:provider/oauth/revoke', () => {
    it('should revoke OAuth tokens', async () => {
      vi.mocked(revokeOAuthTokens).mockResolvedValue(undefined);

      const response = await request(app).post('/integrations/discord/oauth/revoke');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(revokeOAuthTokens).toHaveBeenCalledWith('default', 'discord');
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app).post('/integrations/invalid-provider/oauth/revoke');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid provider');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(revokeOAuthTokens).mockRejectedValue(new Error('DB error'));

      const response = await request(app).post('/integrations/discord/oauth/revoke');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to revoke tokens');
    });
  });

  describe('POST /integrations/api-key', () => {
    it('should store API key', async () => {
      vi.mocked(storeApiKey).mockResolvedValue(undefined);
      vi.mocked(upsertIntegration).mockResolvedValue({
        id: 'int_1',
        user_id: 'default',
        provider: 'elevenlabs',
        status: 'active',
        display_name: null,
        metadata: null,
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      });
      vi.mocked(updateIntegrationStatus).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/integrations/api-key')
        .send({
          provider: 'elevenlabs',
          apiKey: 'sk_test_123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(storeApiKey).toHaveBeenCalledWith('default', 'elevenlabs', 'sk_test_123');
    });

    it('should return 400 for missing apiKey', async () => {
      const response = await request(app)
        .post('/integrations/api-key')
        .send({
          provider: 'elevenlabs',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app)
        .post('/integrations/api-key')
        .send({
          provider: 'invalid',
          apiKey: 'sk_test_123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(storeApiKey).mockRejectedValue(new Error('Encryption failed'));

      const response = await request(app)
        .post('/integrations/api-key')
        .send({
          provider: 'elevenlabs',
          apiKey: 'sk_test_123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to store API key');
    });
  });

  describe('DELETE /integrations/:provider/api-key', () => {
    it('should delete API key', async () => {
      vi.mocked(deleteSecret).mockResolvedValue(undefined);
      vi.mocked(updateIntegrationStatus).mockResolvedValue(undefined);

      const response = await request(app).delete('/integrations/elevenlabs/api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(deleteSecret).toHaveBeenCalledWith('default', 'elevenlabs', 'api_key');
      expect(updateIntegrationStatus).toHaveBeenCalledWith('default', 'elevenlabs', 'disabled');
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app).delete('/integrations/invalid-provider/api-key');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid provider');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(deleteSecret).mockRejectedValue(new Error('DB error'));

      const response = await request(app).delete('/integrations/elevenlabs/api-key');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete API key');
    });
  });

  describe('GET /integrations/:provider/api-key/exists', () => {
    it('should return true if API key exists', async () => {
      vi.mocked(getApiKey).mockResolvedValue('sk_secret');

      const response = await request(app).get('/integrations/elevenlabs/api-key/exists');

      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
    });

    it('should return false if API key does not exist', async () => {
      vi.mocked(getApiKey).mockResolvedValue(null);

      const response = await request(app).get('/integrations/elevenlabs/api-key/exists');

      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(false);
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app).get('/integrations/invalid-provider/api-key/exists');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid provider');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getApiKey).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/integrations/elevenlabs/api-key/exists');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to check API key');
    });
  });

  describe('POST /integrations/bot-token', () => {
    it('should store bot token', async () => {
      vi.mocked(storeBotToken).mockResolvedValue(undefined);
      vi.mocked(upsertIntegration).mockResolvedValue({
        id: 'int_1',
        user_id: 'default',
        provider: 'telegram',
        status: 'active',
        display_name: null,
        metadata: null,
        created_at: '2025-01-31T10:00:00.000Z',
        updated_at: '2025-01-31T10:00:00.000Z',
      });
      vi.mocked(updateIntegrationStatus).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/integrations/bot-token')
        .send({
          provider: 'telegram',
          token: 'bot_token_123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(storeBotToken).toHaveBeenCalledWith('default', 'telegram', 'bot_token_123');
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/integrations/bot-token')
        .send({
          provider: 'telegram',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(storeBotToken).mockRejectedValue(new Error('Encryption failed'));

      const response = await request(app)
        .post('/integrations/bot-token')
        .send({
          provider: 'telegram',
          token: 'bot_token_123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to store bot token');
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  IntegrationRecord,
  OAuthTokenRecord,
  IntegrationProviderId,
  CreateIntegrationInput,
  CreateOAuthTokenInput,
} from '../../src/types/integrations.js';

// Mock the database module
const mockDb = {
  getIntegrationByProvider: vi.fn(),
  getIntegrationsForUser: vi.fn(),
  saveIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  saveOAuthToken: vi.fn(),
  getOAuthToken: vi.fn(),
  deleteOAuthToken: vi.fn(),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock cryptoService
vi.mock('../../src/services/cryptoService.js', () => ({
  encryptValue: vi.fn((value: string) => ({
    iv: 'test-iv',
    encrypted: `encrypted:${value}`,
    authTag: 'test-tag',
    algorithm: 'aes-256-gcm',
  })),
  decryptValue: vi.fn((payload: { encrypted: string }) => 
    payload.encrypted.replace('encrypted:', '')
  ),
}));

// Mock auditLogService
vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('integrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('upsertIntegration', () => {
    it('should create a new integration when none exists', async () => {
      mockDb.getIntegrationByProvider.mockResolvedValue(null);
      mockDb.saveIntegration.mockResolvedValue(undefined);

      const { upsertIntegration } = await import('../../src/services/integrationService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const input: CreateIntegrationInput = {
        userId: 'user_123',
        provider: 'github',
        displayName: 'My GitHub',
        metadata: { org: 'myorg' },
      };

      const result = await upsertIntegration(input);

      expect(result.user_id).toBe('user_123');
      expect(result.provider).toBe('github');
      expect(result.display_name).toBe('My GitHub');
      expect(result.status).toBe('pending');
      expect(result.id).toContain('int_github_');
      expect(JSON.parse(result.metadata!)).toEqual({ org: 'myorg' });
      expect(mockDb.saveIntegration).toHaveBeenCalled();
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'integration.created',
      }));
    });

    it('should update an existing integration', async () => {
      const existing: IntegrationRecord = {
        id: 'int_github_existing',
        user_id: 'user_123',
        provider: 'github',
        status: 'active',
        display_name: 'Old Name',
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getIntegrationByProvider.mockResolvedValue(existing);
      mockDb.saveIntegration.mockResolvedValue(undefined);

      const { upsertIntegration } = await import('../../src/services/integrationService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const input: CreateIntegrationInput = {
        userId: 'user_123',
        provider: 'github',
        displayName: 'New Name',
      };

      const result = await upsertIntegration(input);

      expect(result.id).toBe('int_github_existing');
      expect(result.display_name).toBe('New Name');
      expect(result.status).toBe('active');
      expect(result.created_at).toBe('2024-01-01T00:00:00Z');
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'integration.updated',
      }));
    });

    it('should handle null displayName and metadata', async () => {
      mockDb.getIntegrationByProvider.mockResolvedValue(null);
      mockDb.saveIntegration.mockResolvedValue(undefined);

      const { upsertIntegration } = await import('../../src/services/integrationService.js');

      const input: CreateIntegrationInput = {
        userId: 'user_123',
        provider: 'slack',
      };

      const result = await upsertIntegration(input);

      expect(result.display_name).toBeNull();
      expect(result.metadata).toBeNull();
    });
  });

  describe('getIntegrations', () => {
    it('should return all integrations for a user', async () => {
      const integrations: IntegrationRecord[] = [
        {
          id: 'int_1',
          user_id: 'user_123',
          provider: 'github',
          status: 'active',
          display_name: null,
          metadata: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'int_2',
          user_id: 'user_123',
          provider: 'slack',
          status: 'pending',
          display_name: null,
          metadata: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockDb.getIntegrationsForUser.mockResolvedValue(integrations);

      const { getIntegrations } = await import('../../src/services/integrationService.js');

      const result = await getIntegrations('user_123');

      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('github');
      expect(result[1].provider).toBe('slack');
    });

    it('should return empty array when no integrations exist', async () => {
      mockDb.getIntegrationsForUser.mockResolvedValue([]);

      const { getIntegrations } = await import('../../src/services/integrationService.js');

      const result = await getIntegrations('user_123');

      expect(result).toEqual([]);
    });
  });

  describe('getIntegrationByProvider', () => {
    it('should return integration when found', async () => {
      const integration: IntegrationRecord = {
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'active',
        display_name: 'My GitHub',
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getIntegrationByProvider.mockResolvedValue(integration);

      const { getIntegrationByProvider } = await import('../../src/services/integrationService.js');

      const result = await getIntegrationByProvider('user_123', 'github');

      expect(result).toEqual(integration);
    });

    it('should return null when not found', async () => {
      mockDb.getIntegrationByProvider.mockResolvedValue(null);

      const { getIntegrationByProvider } = await import('../../src/services/integrationService.js');

      const result = await getIntegrationByProvider('user_123', 'github');

      expect(result).toBeNull();
    });
  });

  describe('updateIntegrationStatus', () => {
    it('should update status successfully', async () => {
      const existing: IntegrationRecord = {
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'pending',
        display_name: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getIntegrationByProvider.mockResolvedValue(existing);
      mockDb.saveIntegration.mockResolvedValue(undefined);

      const { updateIntegrationStatus } = await import('../../src/services/integrationService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await updateIntegrationStatus('user_123', 'github', 'active');

      expect(mockDb.saveIntegration).toHaveBeenCalledWith(expect.objectContaining({
        status: 'active',
      }));
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'integration.status_changed',
      }));
    });

    it('should store error message in metadata', async () => {
      const existing: IntegrationRecord = {
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'active',
        display_name: null,
        metadata: JSON.stringify({ existingKey: 'value' }),
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getIntegrationByProvider.mockResolvedValue(existing);
      mockDb.saveIntegration.mockResolvedValue(undefined);

      const { updateIntegrationStatus } = await import('../../src/services/integrationService.js');

      await updateIntegrationStatus('user_123', 'github', 'error', 'Connection failed');

      expect(mockDb.saveIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          metadata: expect.stringContaining('lastError'),
        })
      );
    });

    it('should throw when integration not found', async () => {
      mockDb.getIntegrationByProvider.mockResolvedValue(null);

      const { updateIntegrationStatus } = await import('../../src/services/integrationService.js');

      await expect(updateIntegrationStatus('user_123', 'github', 'active'))
        .rejects.toThrow('Integration not found: github');
    });
  });

  describe('deleteIntegration', () => {
    it('should delete integration and related tokens', async () => {
      const existing: IntegrationRecord = {
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'active',
        display_name: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getIntegrationByProvider.mockResolvedValue(existing);
      mockDb.deleteOAuthToken.mockResolvedValue(undefined);
      mockDb.deleteIntegration.mockResolvedValue(undefined);

      const { deleteIntegration } = await import('../../src/services/integrationService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await deleteIntegration('user_123', 'github');

      expect(mockDb.deleteOAuthToken).toHaveBeenCalledWith('user_123', 'github');
      expect(mockDb.deleteIntegration).toHaveBeenCalledWith('int_1');
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'integration.deleted',
      }));
    });

    it('should do nothing when integration not found', async () => {
      mockDb.getIntegrationByProvider.mockResolvedValue(null);

      const { deleteIntegration } = await import('../../src/services/integrationService.js');

      await deleteIntegration('user_123', 'github');

      expect(mockDb.deleteOAuthToken).not.toHaveBeenCalled();
      expect(mockDb.deleteIntegration).not.toHaveBeenCalled();
    });
  });

  describe('storeOAuthTokens', () => {
    it('should store encrypted tokens', async () => {
      mockDb.saveOAuthToken.mockResolvedValue(undefined);
      mockDb.getIntegrationByProvider.mockResolvedValue({
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'pending',
        display_name: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      mockDb.saveIntegration.mockResolvedValue(undefined);

      const { storeOAuthTokens } = await import('../../src/services/integrationService.js');
      const { encryptValue } = await import('../../src/services/cryptoService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      const input: CreateOAuthTokenInput = {
        userId: 'user_123',
        provider: 'github',
        accessTokenEnc: 'access_token_value',
        refreshTokenEnc: 'refresh_token_value',
        tokenType: 'Bearer',
        scope: 'repo read:user',
        expiresAt: '2024-12-31T23:59:59Z',
      };

      await storeOAuthTokens(input);

      expect(encryptValue).toHaveBeenCalledWith('access_token_value');
      expect(encryptValue).toHaveBeenCalledWith('refresh_token_value');
      expect(mockDb.saveOAuthToken).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user_123',
        provider: 'github',
        token_type: 'Bearer',
        scope: 'repo read:user',
      }));
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'oauth.tokens_stored',
      }));
    });

    it('should handle missing optional fields', async () => {
      mockDb.saveOAuthToken.mockResolvedValue(undefined);
      mockDb.getIntegrationByProvider.mockResolvedValue({
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'pending',
        display_name: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      mockDb.saveIntegration.mockResolvedValue(undefined);

      const { storeOAuthTokens } = await import('../../src/services/integrationService.js');

      const input: CreateOAuthTokenInput = {
        userId: 'user_123',
        provider: 'github',
        accessTokenEnc: 'access_token_value',
      };

      await storeOAuthTokens(input);

      expect(mockDb.saveOAuthToken).toHaveBeenCalledWith(expect.objectContaining({
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
      }));
    });
  });

  describe('getAccessToken', () => {
    it('should decrypt and return access token', async () => {
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({
          iv: 'test-iv',
          encrypted: 'encrypted:my_access_token',
          authTag: 'test-tag',
          algorithm: 'aes-256-gcm',
        }),
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { getAccessToken } = await import('../../src/services/integrationService.js');

      const result = await getAccessToken('user_123', 'github');

      expect(result).toBe('my_access_token');
    });

    it('should return null when no token exists', async () => {
      mockDb.getOAuthToken.mockResolvedValue(null);

      const { getAccessToken } = await import('../../src/services/integrationService.js');

      const result = await getAccessToken('user_123', 'github');

      expect(result).toBeNull();
    });

    it('should return null on decryption error', async () => {
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: 'invalid json',
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { getAccessToken } = await import('../../src/services/integrationService.js');
      const logger = await import('../../src/middleware/logger.js');

      const result = await getAccessToken('user_123', 'github');

      expect(result).toBeNull();
      expect(logger.default.error).toHaveBeenCalled();
    });
  });

  describe('getRefreshToken', () => {
    it('should decrypt and return refresh token', async () => {
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'encrypted:access' }),
        refresh_token_enc: JSON.stringify({
          iv: 'test-iv',
          encrypted: 'encrypted:my_refresh_token',
          authTag: 'test-tag',
          algorithm: 'aes-256-gcm',
        }),
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { getRefreshToken } = await import('../../src/services/integrationService.js');

      const result = await getRefreshToken('user_123', 'github');

      expect(result).toBe('my_refresh_token');
    });

    it('should return null when no refresh token exists', async () => {
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'encrypted:access' }),
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { getRefreshToken } = await import('../../src/services/integrationService.js');

      const result = await getRefreshToken('user_123', 'github');

      expect(result).toBeNull();
    });

    it('should return null when no record exists', async () => {
      mockDb.getOAuthToken.mockResolvedValue(null);

      const { getRefreshToken } = await import('../../src/services/integrationService.js');

      const result = await getRefreshToken('user_123', 'github');

      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true when no token record exists', async () => {
      mockDb.getOAuthToken.mockResolvedValue(null);

      const { isTokenExpired } = await import('../../src/services/integrationService.js');

      const result = await isTokenExpired('user_123', 'github');

      expect(result).toBe(true);
    });

    it('should return false when no expiry is set', async () => {
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'test' }),
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { isTokenExpired } = await import('../../src/services/integrationService.js');

      const result = await isTokenExpired('user_123', 'github');

      expect(result).toBe(false);
    });

    it('should return true when token is expired', async () => {
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'test' }),
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: '2020-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { isTokenExpired } = await import('../../src/services/integrationService.js');

      const result = await isTokenExpired('user_123', 'github');

      expect(result).toBe(true);
    });

    it('should return true when token expires within 5 minutes', async () => {
      const fiveMinutesFromNow = new Date(Date.now() + 4 * 60 * 1000).toISOString();
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'test' }),
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: fiveMinutesFromNow,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { isTokenExpired } = await import('../../src/services/integrationService.js');

      const result = await isTokenExpired('user_123', 'github');

      expect(result).toBe(true);
    });

    it('should return false when token has more than 5 minutes remaining', async () => {
      const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'test' }),
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: tenMinutesFromNow,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { isTokenExpired } = await import('../../src/services/integrationService.js');

      const result = await isTokenExpired('user_123', 'github');

      expect(result).toBe(false);
    });
  });

  describe('revokeOAuthTokens', () => {
    it('should delete token and update status', async () => {
      mockDb.deleteOAuthToken.mockResolvedValue(undefined);
      mockDb.getIntegrationByProvider.mockResolvedValue({
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'active',
        display_name: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      mockDb.saveIntegration.mockResolvedValue(undefined);

      const { revokeOAuthTokens } = await import('../../src/services/integrationService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');

      await revokeOAuthTokens('user_123', 'github');

      expect(mockDb.deleteOAuthToken).toHaveBeenCalledWith('user_123', 'github');
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'oauth.tokens_revoked',
      }));
    });
  });

  describe('OAUTH_PROVIDERS', () => {
    it('should have OAuth config for supported providers', async () => {
      const { OAUTH_PROVIDERS } = await import('../../src/services/integrationService.js');

      expect(OAUTH_PROVIDERS.github).toEqual({
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scopes: ['repo', 'read:user', 'read:org', 'workflow'],
        supportsOAuth: true,
      });

      expect(OAUTH_PROVIDERS.discord).toEqual({
        authUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        scopes: ['identify', 'guilds', 'bot', 'messages.read'],
        supportsOAuth: true,
      });
    });

    it('should have null for non-OAuth providers', async () => {
      const { OAUTH_PROVIDERS } = await import('../../src/services/integrationService.js');

      expect(OAUTH_PROVIDERS.imessage).toBeNull();
      expect(OAUTH_PROVIDERS.signal).toBeNull();
      expect(OAUTH_PROVIDERS.obsidian).toBeNull();
      expect(OAUTH_PROVIDERS.aws).toBeNull();
    });
  });

  describe('generateOAuthUrl', () => {
    it('should generate valid OAuth URL when configured', async () => {
      vi.stubEnv('GITHUB_CLIENT_ID', 'test_client_id');

      const { generateOAuthUrl } = await import('../../src/services/integrationService.js');

      const url = generateOAuthUrl(
        'github',
        'https://example.com/callback',
        'random_state_123'
      );

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test_client_id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('state=random_state_123');
      expect(url).toContain('response_type=code');
    });

    it('should return null for non-OAuth providers', async () => {
      const { generateOAuthUrl } = await import('../../src/services/integrationService.js');

      const url = generateOAuthUrl('imessage', 'https://example.com/callback', 'state');

      expect(url).toBeNull();
    });

    it('should return null when client ID not configured', async () => {
      delete process.env.GITHUB_CLIENT_ID;

      const { generateOAuthUrl } = await import('../../src/services/integrationService.js');
      const logger = await import('../../src/middleware/logger.js');

      const url = generateOAuthUrl('github', 'https://example.com/callback', 'state');

      expect(url).toBeNull();
      expect(logger.default.warn).toHaveBeenCalled();
    });
  });

  describe('exchangeOAuthCode', () => {
    it('should exchange code for tokens successfully', async () => {
      vi.stubEnv('GITHUB_CLIENT_ID', 'test_client_id');
      vi.stubEnv('GITHUB_CLIENT_SECRET', 'test_client_secret');

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
          scope: 'repo',
          token_type: 'bearer',
        }),
      });

      const { exchangeOAuthCode } = await import('../../src/services/integrationService.js');

      const result = await exchangeOAuthCode(
        'github',
        'auth_code_123',
        'https://example.com/callback'
      );

      expect(result).toEqual({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresIn: 3600,
        scope: 'repo',
        tokenType: 'bearer',
      });
    });

    it('should return null for non-OAuth providers', async () => {
      const { exchangeOAuthCode } = await import('../../src/services/integrationService.js');

      const result = await exchangeOAuthCode(
        'imessage',
        'code',
        'https://example.com/callback'
      );

      expect(result).toBeNull();
    });

    it('should return null when credentials not configured', async () => {
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;

      const { exchangeOAuthCode } = await import('../../src/services/integrationService.js');

      const result = await exchangeOAuthCode(
        'github',
        'code',
        'https://example.com/callback'
      );

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      vi.stubEnv('GITHUB_CLIENT_ID', 'test_client_id');
      vi.stubEnv('GITHUB_CLIENT_SECRET', 'test_client_secret');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });

      const { exchangeOAuthCode } = await import('../../src/services/integrationService.js');
      const logger = await import('../../src/middleware/logger.js');

      const result = await exchangeOAuthCode(
        'github',
        'invalid_code',
        'https://example.com/callback'
      );

      expect(result).toBeNull();
      expect(logger.default.error).toHaveBeenCalled();
    });

    it('should return null on fetch error', async () => {
      vi.stubEnv('GITHUB_CLIENT_ID', 'test_client_id');
      vi.stubEnv('GITHUB_CLIENT_SECRET', 'test_client_secret');

      mockFetch.mockRejectedValue(new Error('Network error'));

      const { exchangeOAuthCode } = await import('../../src/services/integrationService.js');
      const logger = await import('../../src/middleware/logger.js');

      const result = await exchangeOAuthCode(
        'github',
        'code',
        'https://example.com/callback'
      );

      expect(result).toBeNull();
      expect(logger.default.error).toHaveBeenCalled();
    });
  });

  describe('refreshOAuthTokens', () => {
    it('should refresh tokens successfully', async () => {
      vi.stubEnv('GITHUB_CLIENT_ID', 'test_client_id');
      vi.stubEnv('GITHUB_CLIENT_SECRET', 'test_client_secret');

      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'encrypted:old_access' }),
        refresh_token_enc: JSON.stringify({ encrypted: 'encrypted:old_refresh' }),
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);
      mockDb.saveOAuthToken.mockResolvedValue(undefined);
      mockDb.getIntegrationByProvider.mockResolvedValue({
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'active',
        display_name: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      mockDb.saveIntegration.mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
        }),
      });

      const { refreshOAuthTokens } = await import('../../src/services/integrationService.js');

      const result = await refreshOAuthTokens('user_123', 'github');

      expect(result).toBe(true);
    });

    it('should return false when no refresh token available', async () => {
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'encrypted:access' }),
        refresh_token_enc: null,
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { refreshOAuthTokens } = await import('../../src/services/integrationService.js');

      const result = await refreshOAuthTokens('user_123', 'github');

      expect(result).toBe(false);
    });

    it('should return false for non-OAuth providers', async () => {
      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'imessage',
        access_token_enc: JSON.stringify({ encrypted: 'encrypted:access' }),
        refresh_token_enc: JSON.stringify({ encrypted: 'encrypted:refresh' }),
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      const { refreshOAuthTokens } = await import('../../src/services/integrationService.js');

      const result = await refreshOAuthTokens('user_123', 'imessage');

      expect(result).toBe(false);
    });

    it('should return false and update status on refresh failure', async () => {
      vi.stubEnv('GITHUB_CLIENT_ID', 'test_client_id');
      vi.stubEnv('GITHUB_CLIENT_SECRET', 'test_client_secret');

      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'encrypted:access' }),
        refresh_token_enc: JSON.stringify({ encrypted: 'encrypted:refresh' }),
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);
      mockDb.getIntegrationByProvider.mockResolvedValue({
        id: 'int_1',
        user_id: 'user_123',
        provider: 'github',
        status: 'active',
        display_name: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
      mockDb.saveIntegration.mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      const { refreshOAuthTokens } = await import('../../src/services/integrationService.js');

      const result = await refreshOAuthTokens('user_123', 'github');

      expect(result).toBe(false);
    });

    it('should return false on fetch error', async () => {
      vi.stubEnv('GITHUB_CLIENT_ID', 'test_client_id');
      vi.stubEnv('GITHUB_CLIENT_SECRET', 'test_client_secret');

      const tokenRecord: OAuthTokenRecord = {
        id: 'oauth_1',
        user_id: 'user_123',
        provider: 'github',
        access_token_enc: JSON.stringify({ encrypted: 'encrypted:access' }),
        refresh_token_enc: JSON.stringify({ encrypted: 'encrypted:refresh' }),
        token_type: 'Bearer',
        scope: null,
        expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockDb.getOAuthToken.mockResolvedValue(tokenRecord);

      mockFetch.mockRejectedValue(new Error('Network error'));

      const { refreshOAuthTokens } = await import('../../src/services/integrationService.js');

      const result = await refreshOAuthTokens('user_123', 'github');

      expect(result).toBe(false);
    });
  });
});

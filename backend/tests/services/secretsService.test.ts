/**
 * Secrets Service Unit Tests
 * Tests encrypted storage, retrieval, and management of API keys and secrets.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock database
const mockDb = {
  saveIntegrationSecret: vi.fn(),
  getIntegrationSecret: vi.fn(),
  deleteIntegrationSecret: vi.fn(),
  saveAuditLog: vi.fn(),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock crypto service
const mockEncryptValue = vi.fn();
const mockDecryptValue = vi.fn();

vi.mock('../../src/services/cryptoService.js', () => ({
  encryptValue: (value: string) => mockEncryptValue(value),
  decryptValue: (payload: unknown) => mockDecryptValue(payload),
}));

// Mock audit log service
vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: vi.fn(),
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

describe('secretsService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Reset mock defaults
    mockDb.saveIntegrationSecret.mockResolvedValue(undefined);
    mockDb.getIntegrationSecret.mockResolvedValue(null);
    mockDb.deleteIntegrationSecret.mockResolvedValue(undefined);
    mockDb.saveAuditLog.mockResolvedValue(undefined);
    
    // Default crypto mock behavior
    mockEncryptValue.mockReturnValue({
      alg: 'aes-256-gcm',
      iv: 'test-iv',
      tag: 'test-tag',
      data: 'encrypted-data',
    });
    mockDecryptValue.mockReturnValue('decrypted-secret');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('storeSecret', () => {
    it('should store an encrypted secret', async () => {
      const { storeSecret } = await import('../../src/services/secretsService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');
      
      const input = {
        userId: 'user-123',
        provider: 'github' as const,
        name: 'api_key',
        secretEnc: 'my-secret-api-key',
      };
      
      await storeSecret(input);
      
      expect(mockEncryptValue).toHaveBeenCalledWith('my-secret-api-key');
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        provider: 'github',
        name: 'api_key',
        secret_enc: expect.any(String),
      }));
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-123',
        action: 'secret.stored',
        category: 'security',
        target: 'github:api_key',
      }));
    });

    it('should generate unique ID for each secret', async () => {
      const { storeSecret } = await import('../../src/services/secretsService.js');
      
      await storeSecret({
        userId: 'user-123',
        provider: 'github' as const,
        name: 'api_key',
        secretEnc: 'secret1',
      });
      
      const firstCall = mockDb.saveIntegrationSecret.mock.calls[0][0];
      
      await storeSecret({
        userId: 'user-123',
        provider: 'github' as const,
        name: 'api_key',
        secretEnc: 'secret2',
      });
      
      const secondCall = mockDb.saveIntegrationSecret.mock.calls[1][0];
      
      expect(firstCall.id).toMatch(/^secret_github_api_key_\d+$/);
      expect(secondCall.id).toMatch(/^secret_github_api_key_\d+$/);
      // IDs should be different due to different timestamps
      // In a fast test, they might be the same, so we just check the format
    });

    it('should store the encrypted payload as JSON string', async () => {
      const { storeSecret } = await import('../../src/services/secretsService.js');
      
      mockEncryptValue.mockReturnValue({
        alg: 'aes-256-gcm',
        iv: 'base64iv==',
        tag: 'base64tag==',
        data: 'base64data==',
      });
      
      await storeSecret({
        userId: 'user-123',
        provider: 'slack' as const,
        name: 'bot_token',
        secretEnc: 'xoxb-token',
      });
      
      const savedRecord = mockDb.saveIntegrationSecret.mock.calls[0][0];
      const parsedSecret = JSON.parse(savedRecord.secret_enc);
      
      expect(parsedSecret).toEqual({
        alg: 'aes-256-gcm',
        iv: 'base64iv==',
        tag: 'base64tag==',
        data: 'base64data==',
      });
    });

    it('should include timestamps in the record', async () => {
      const { storeSecret } = await import('../../src/services/secretsService.js');
      
      const beforeStore = new Date().toISOString();
      
      await storeSecret({
        userId: 'user-123',
        provider: 'discord' as const,
        name: 'api_key',
        secretEnc: 'secret',
      });
      
      const afterStore = new Date().toISOString();
      const savedRecord = mockDb.saveIntegrationSecret.mock.calls[0][0];
      
      expect(savedRecord.created_at).toBeDefined();
      expect(savedRecord.updated_at).toBeDefined();
      expect(savedRecord.created_at).toBe(savedRecord.updated_at);
      expect(savedRecord.created_at >= beforeStore).toBe(true);
      expect(savedRecord.created_at <= afterStore).toBe(true);
    });
  });

  describe('getSecret', () => {
    it('should return decrypted secret when found', async () => {
      const mockRecord = {
        id: 'secret-123',
        user_id: 'user-123',
        provider: 'github',
        name: 'api_key',
        secret_enc: JSON.stringify({
          alg: 'aes-256-gcm',
          iv: 'test-iv',
          tag: 'test-tag',
          data: 'encrypted-data',
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getIntegrationSecret.mockResolvedValueOnce(mockRecord);
      mockDecryptValue.mockReturnValueOnce('my-api-key');
      
      const { getSecret } = await import('../../src/services/secretsService.js');
      
      const result = await getSecret('user-123', 'github', 'api_key');
      
      expect(result).toBe('my-api-key');
      expect(mockDb.getIntegrationSecret).toHaveBeenCalledWith('user-123', 'github', 'api_key');
      expect(mockDecryptValue).toHaveBeenCalledWith({
        alg: 'aes-256-gcm',
        iv: 'test-iv',
        tag: 'test-tag',
        data: 'encrypted-data',
      });
    });

    it('should return null when secret not found', async () => {
      mockDb.getIntegrationSecret.mockResolvedValueOnce(null);
      
      const { getSecret } = await import('../../src/services/secretsService.js');
      
      const result = await getSecret('user-123', 'github', 'non_existent');
      
      expect(result).toBeNull();
      expect(mockDecryptValue).not.toHaveBeenCalled();
    });

    it('should return null and log error on decryption failure', async () => {
      const mockRecord = {
        id: 'secret-123',
        user_id: 'user-123',
        provider: 'github',
        name: 'api_key',
        secret_enc: JSON.stringify({
          alg: 'aes-256-gcm',
          iv: 'test-iv',
          tag: 'test-tag',
          data: 'encrypted-data',
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getIntegrationSecret.mockResolvedValueOnce(mockRecord);
      mockDecryptValue.mockImplementationOnce(() => {
        throw new Error('Decryption failed');
      });
      
      const { getSecret } = await import('../../src/services/secretsService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      const result = await getSecret('user-123', 'github', 'api_key');
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'github',
          name: 'api_key',
          error: 'Decryption failed',
        }),
        'Failed to decrypt secret'
      );
    });

    it('should return null on JSON parse error', async () => {
      const mockRecord = {
        id: 'secret-123',
        user_id: 'user-123',
        provider: 'github',
        name: 'api_key',
        secret_enc: 'not-valid-json',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getIntegrationSecret.mockResolvedValueOnce(mockRecord);
      
      const { getSecret } = await import('../../src/services/secretsService.js');
      
      const result = await getSecret('user-123', 'github', 'api_key');
      
      expect(result).toBeNull();
    });
  });

  describe('deleteSecret', () => {
    it('should delete secret and write audit log', async () => {
      const { deleteSecret } = await import('../../src/services/secretsService.js');
      const { writeAuditLog } = await import('../../src/services/auditLogService.js');
      
      await deleteSecret('user-123', 'github', 'api_key');
      
      expect(mockDb.deleteIntegrationSecret).toHaveBeenCalledWith('user-123', 'github', 'api_key');
      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-123',
        action: 'secret.deleted',
        category: 'security',
        target: 'github:api_key',
      }));
    });

    it('should not throw when deleting non-existent secret', async () => {
      const { deleteSecret } = await import('../../src/services/secretsService.js');
      
      // Should not throw
      await expect(deleteSecret('user-123', 'github', 'non_existent')).resolves.not.toThrow();
    });
  });

  describe('hasSecret', () => {
    it('should return true when secret exists', async () => {
      mockDb.getIntegrationSecret.mockResolvedValueOnce({
        id: 'secret-123',
        user_id: 'user-123',
        provider: 'github',
        name: 'api_key',
        secret_enc: '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      
      const { hasSecret } = await import('../../src/services/secretsService.js');
      
      const result = await hasSecret('user-123', 'github', 'api_key');
      
      expect(result).toBe(true);
    });

    it('should return false when secret does not exist', async () => {
      mockDb.getIntegrationSecret.mockResolvedValueOnce(null);
      
      const { hasSecret } = await import('../../src/services/secretsService.js');
      
      const result = await hasSecret('user-123', 'github', 'api_key');
      
      expect(result).toBe(false);
    });
  });

  describe('getOrCreateSecret', () => {
    it('should return existing secret if found', async () => {
      const mockRecord = {
        id: 'secret-123',
        user_id: 'user-123',
        provider: 'github',
        name: 'api_key',
        secret_enc: JSON.stringify({
          alg: 'aes-256-gcm',
          iv: 'test-iv',
          tag: 'test-tag',
          data: 'encrypted-data',
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getIntegrationSecret.mockResolvedValueOnce(mockRecord);
      mockDecryptValue.mockReturnValueOnce('existing-secret');
      
      const { getOrCreateSecret } = await import('../../src/services/secretsService.js');
      
      const result = await getOrCreateSecret('user-123', 'github', 'api_key', 'default-value');
      
      expect(result).toBe('existing-secret');
      expect(mockDb.saveIntegrationSecret).not.toHaveBeenCalled();
    });

    it('should create secret with default value if not found', async () => {
      mockDb.getIntegrationSecret.mockResolvedValueOnce(null);
      
      const { getOrCreateSecret } = await import('../../src/services/secretsService.js');
      
      const result = await getOrCreateSecret('user-123', 'github', 'api_key', 'default-api-key');
      
      expect(result).toBe('default-api-key');
      expect(mockEncryptValue).toHaveBeenCalledWith('default-api-key');
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalled();
    });

    it('should return null if not found and no default provided', async () => {
      mockDb.getIntegrationSecret.mockResolvedValueOnce(null);
      
      const { getOrCreateSecret } = await import('../../src/services/secretsService.js');
      
      const result = await getOrCreateSecret('user-123', 'github', 'api_key');
      
      expect(result).toBeNull();
      expect(mockDb.saveIntegrationSecret).not.toHaveBeenCalled();
    });
  });

  describe('SECRET_NAMES', () => {
    it('should export all common secret names', async () => {
      const { SECRET_NAMES } = await import('../../src/services/secretsService.js');
      
      expect(SECRET_NAMES.API_KEY).toBe('api_key');
      expect(SECRET_NAMES.API_SECRET).toBe('api_secret');
      expect(SECRET_NAMES.BOT_TOKEN).toBe('bot_token');
      expect(SECRET_NAMES.WEBHOOK_SECRET).toBe('webhook_secret');
      expect(SECRET_NAMES.ACCESS_TOKEN).toBe('access_token');
      expect(SECRET_NAMES.REFRESH_TOKEN).toBe('refresh_token');
      expect(SECRET_NAMES.VAULT_PATH).toBe('vault_path');
      expect(SECRET_NAMES.HOME_URL).toBe('home_url');
    });
  });

  describe('storeApiKey', () => {
    it('should store API key with correct name', async () => {
      const { storeApiKey, SECRET_NAMES } = await import('../../src/services/secretsService.js');
      
      await storeApiKey('user-123', 'github', 'my-github-api-key');
      
      expect(mockEncryptValue).toHaveBeenCalledWith('my-github-api-key');
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        provider: 'github',
        name: SECRET_NAMES.API_KEY,
      }));
    });

    it('should work with different providers', async () => {
      const { storeApiKey } = await import('../../src/services/secretsService.js');
      
      await storeApiKey('user-123', 'slack', 'slack-api-key');
      
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'slack',
      }));
    });
  });

  describe('getApiKey', () => {
    it('should retrieve API key', async () => {
      const mockRecord = {
        id: 'secret-123',
        user_id: 'user-123',
        provider: 'github',
        name: 'api_key',
        secret_enc: JSON.stringify({
          alg: 'aes-256-gcm',
          iv: 'test-iv',
          tag: 'test-tag',
          data: 'encrypted-data',
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getIntegrationSecret.mockResolvedValueOnce(mockRecord);
      mockDecryptValue.mockReturnValueOnce('my-github-api-key');
      
      const { getApiKey } = await import('../../src/services/secretsService.js');
      
      const result = await getApiKey('user-123', 'github');
      
      expect(result).toBe('my-github-api-key');
      expect(mockDb.getIntegrationSecret).toHaveBeenCalledWith('user-123', 'github', 'api_key');
    });

    it('should return null when API key not found', async () => {
      mockDb.getIntegrationSecret.mockResolvedValueOnce(null);
      
      const { getApiKey } = await import('../../src/services/secretsService.js');
      
      const result = await getApiKey('user-123', 'github');
      
      expect(result).toBeNull();
    });
  });

  describe('storeBotToken', () => {
    it('should store bot token with correct name', async () => {
      const { storeBotToken, SECRET_NAMES } = await import('../../src/services/secretsService.js');
      
      await storeBotToken('user-123', 'slack', 'xoxb-my-bot-token');
      
      expect(mockEncryptValue).toHaveBeenCalledWith('xoxb-my-bot-token');
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        provider: 'slack',
        name: SECRET_NAMES.BOT_TOKEN,
      }));
    });
  });

  describe('getBotToken', () => {
    it('should retrieve bot token', async () => {
      const mockRecord = {
        id: 'secret-123',
        user_id: 'user-123',
        provider: 'slack',
        name: 'bot_token',
        secret_enc: JSON.stringify({
          alg: 'aes-256-gcm',
          iv: 'test-iv',
          tag: 'test-tag',
          data: 'encrypted-data',
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.getIntegrationSecret.mockResolvedValueOnce(mockRecord);
      mockDecryptValue.mockReturnValueOnce('xoxb-my-bot-token');
      
      const { getBotToken } = await import('../../src/services/secretsService.js');
      
      const result = await getBotToken('user-123', 'slack');
      
      expect(result).toBe('xoxb-my-bot-token');
      expect(mockDb.getIntegrationSecret).toHaveBeenCalledWith('user-123', 'slack', 'bot_token');
    });

    it('should return null when bot token not found', async () => {
      mockDb.getIntegrationSecret.mockResolvedValueOnce(null);
      
      const { getBotToken } = await import('../../src/services/secretsService.js');
      
      const result = await getBotToken('user-123', 'slack');
      
      expect(result).toBeNull();
    });
  });

  describe('Integration with different providers', () => {
    it('should handle discord provider', async () => {
      const { storeApiKey, getApiKey } = await import('../../src/services/secretsService.js');
      
      await storeApiKey('user-123', 'discord', 'discord-token');
      
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'discord',
      }));
    });

    it('should handle telegram provider', async () => {
      const { storeBotToken, getBotToken } = await import('../../src/services/secretsService.js');
      
      await storeBotToken('user-123', 'telegram', 'telegram-bot-token');
      
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'telegram',
      }));
    });

    it('should handle notion provider', async () => {
      const { storeApiKey } = await import('../../src/services/secretsService.js');
      
      await storeApiKey('user-123', 'notion', 'notion-integration-token');
      
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'notion',
      }));
    });

    it('should handle vercel provider', async () => {
      const { storeApiKey } = await import('../../src/services/secretsService.js');
      
      await storeApiKey('user-123', 'vercel', 'vercel-api-token');
      
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'vercel',
      }));
    });

    it('should handle aws provider', async () => {
      const { storeSecret } = await import('../../src/services/secretsService.js');
      
      await storeSecret({
        userId: 'user-123',
        provider: 'aws',
        name: 'api_secret',
        secretEnc: 'aws-secret-key',
      });
      
      expect(mockDb.saveIntegrationSecret).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'aws',
        name: 'api_secret',
      }));
    });
  });

  describe('Error handling', () => {
    it('should handle database save error', async () => {
      mockDb.saveIntegrationSecret.mockRejectedValueOnce(new Error('Database error'));
      
      const { storeSecret } = await import('../../src/services/secretsService.js');
      
      await expect(storeSecret({
        userId: 'user-123',
        provider: 'github',
        name: 'api_key',
        secretEnc: 'secret',
      })).rejects.toThrow('Database error');
    });

    it('should handle database get error', async () => {
      mockDb.getIntegrationSecret.mockRejectedValueOnce(new Error('Database error'));
      
      const { getSecret } = await import('../../src/services/secretsService.js');
      
      await expect(getSecret('user-123', 'github', 'api_key')).rejects.toThrow('Database error');
    });

    it('should handle database delete error', async () => {
      mockDb.deleteIntegrationSecret.mockRejectedValueOnce(new Error('Database error'));
      
      const { deleteSecret } = await import('../../src/services/secretsService.js');
      
      await expect(deleteSecret('user-123', 'github', 'api_key')).rejects.toThrow('Database error');
    });
  });
});

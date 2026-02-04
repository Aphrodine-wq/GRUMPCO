/**
 * Notion Integration Service unit tests.
 * Tests OAuth configuration check, auth URL generation, and token exchange.
 * Run: npm test -- notionIntegration.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted() for mock variables used in vi.mock() factories
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// Mock fetch globally
vi.stubGlobal('fetch', mockFetch);

describe('notionIntegration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isNotionConfigured', () => {
    it('returns false when NOTION_CLIENT_ID is not set', async () => {
      delete process.env.NOTION_CLIENT_ID;
      process.env.NOTION_CLIENT_SECRET = 'test_secret';
      vi.resetModules();
      const { isNotionConfigured } = await import('../../src/services/notionIntegration.js');
      expect(isNotionConfigured()).toBe(false);
    });

    it('returns false when NOTION_CLIENT_SECRET is not set', async () => {
      process.env.NOTION_CLIENT_ID = 'test_client_id';
      delete process.env.NOTION_CLIENT_SECRET;
      vi.resetModules();
      const { isNotionConfigured } = await import('../../src/services/notionIntegration.js');
      expect(isNotionConfigured()).toBe(false);
    });

    it('returns true when both NOTION_CLIENT_ID and NOTION_CLIENT_SECRET are set', async () => {
      process.env.NOTION_CLIENT_ID = 'test_client_id';
      process.env.NOTION_CLIENT_SECRET = 'test_secret';
      vi.resetModules();
      const { isNotionConfigured } = await import('../../src/services/notionIntegration.js');
      expect(isNotionConfigured()).toBe(true);
    });
  });

  describe('getNotionAuthUrl', () => {
    beforeEach(() => {
      process.env.NOTION_CLIENT_ID = 'test_client_id_123';
      process.env.NOTION_CLIENT_SECRET = 'test_secret_456';
      vi.resetModules();
    });

    it('returns correct OAuth URL with all params', async () => {
      const { getNotionAuthUrl } = await import('../../src/services/notionIntegration.js');
      const state = 'test_state_abc';

      const url = getNotionAuthUrl(state);

      expect(url).toContain('https://api.notion.com/v1/oauth/authorize?');
      expect(url).toContain('client_id=test_client_id_123');
      expect(url).toContain('response_type=code');
      expect(url).toContain('owner=user');
      expect(url).toContain('state=test_state_abc');
      // Default redirect URI
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fnotion%2Fcallback');
    });

    it('uses custom NOTION_REDIRECT_URI when set', async () => {
      process.env.NOTION_REDIRECT_URI = 'https://example.com/callback';
      vi.resetModules();
      const { getNotionAuthUrl } = await import('../../src/services/notionIntegration.js');
      const state = 'custom_state';

      const url = getNotionAuthUrl(state);

      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
    });
  });

  describe('exchangeNotionCode', () => {
    it('returns error when Notion is not configured', async () => {
      delete process.env.NOTION_CLIENT_ID;
      delete process.env.NOTION_CLIENT_SECRET;
      vi.resetModules();
      const { exchangeNotionCode } = await import('../../src/services/notionIntegration.js');

      const result = await exchangeNotionCode('test_code');

      expect(result.error).toBe('Notion not configured');
      expect(result.access_token).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns access_token on successful exchange', async () => {
      process.env.NOTION_CLIENT_ID = 'test_client_id';
      process.env.NOTION_CLIENT_SECRET = 'test_secret';
      vi.resetModules();

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          access_token: 'secret_token_xyz',
        }),
      });

      const { exchangeNotionCode } = await import('../../src/services/notionIntegration.js');

      const result = await exchangeNotionCode('auth_code_123');

      expect(result.access_token).toBe('secret_token_xyz');
      expect(result.error).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notion.com/v1/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringMatching(/^Basic /),
          }),
          body: expect.any(String),
        })
      );

      // Verify the body contains the expected data
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.grant_type).toBe('authorization_code');
      expect(body.code).toBe('auth_code_123');
      expect(body.redirect_uri).toBe('http://localhost:5173/notion/callback');

      // Verify Authorization header is correct Base64 encoding
      const authHeader = fetchCall[1].headers.Authorization;
      const expectedAuth = `Basic ${Buffer.from('test_client_id:test_secret').toString('base64')}`;
      expect(authHeader).toBe(expectedAuth);
    });

    it('returns error on fetch failure', async () => {
      process.env.NOTION_CLIENT_ID = 'test_client_id';
      process.env.NOTION_CLIENT_SECRET = 'test_secret';
      vi.resetModules();

      mockFetch.mockRejectedValue(new Error('Network error'));

      const { exchangeNotionCode } = await import('../../src/services/notionIntegration.js');

      const result = await exchangeNotionCode('auth_code_456');

      expect(result.error).toBe('Network error');
      expect(result.access_token).toBeUndefined();
    });

    it('returns error from Notion API response', async () => {
      process.env.NOTION_CLIENT_ID = 'test_client_id';
      process.env.NOTION_CLIENT_SECRET = 'test_secret';
      vi.resetModules();

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          error: 'invalid_grant',
        }),
      });

      const { exchangeNotionCode } = await import('../../src/services/notionIntegration.js');

      const result = await exchangeNotionCode('invalid_code');

      expect(result.error).toBe('invalid_grant');
      expect(result.access_token).toBeUndefined();
    });
  });
});

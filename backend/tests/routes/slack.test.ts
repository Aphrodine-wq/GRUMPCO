/**
 * Slack Integration Route Tests
 * Comprehensive tests for Slack OAuth and Events API webhook.
 *
 * Tests the actual slack.ts router with proper mocking.
 * 
 * Note: Since slack.ts reads environment variables at module load time,
 * we mock the dependencies to control the behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

// Store original env
const originalEnv = { ...process.env };

// Mock fetch globally
const mockFetch = vi.fn();

// Setup env vars BEFORE module loads
function setupEnv(vars: Record<string, string | undefined>) {
  delete process.env.SLACK_CLIENT_ID;
  delete process.env.SLACK_CLIENT_SECRET;
  delete process.env.SLACK_SIGNING_SECRET;
  delete process.env.FRONTEND_URL;
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.VERCEL_URL;
  
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

vi.mock('../../src/middleware/logger.js', () => ({
  getRequestLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => ({
    saveSlackToken: vi.fn().mockResolvedValue(undefined),
    getSlackToken: vi.fn().mockResolvedValue(null),
    getSlackTokenByWorkspace: vi.fn().mockResolvedValue({
      access_token_enc: JSON.stringify({ encrypted: 'test', iv: 'test', tag: 'test' }),
    }),
    saveSlackUserPairing: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../src/services/messagingService.js', () => ({
  processMessage: vi.fn().mockResolvedValue('Test reply'),
}));

vi.mock('../../src/services/cryptoService.js', () => ({
  encryptValue: vi.fn().mockReturnValue({ encrypted: 'test', iv: 'test', tag: 'test' }),
  decryptValue: vi.fn().mockReturnValue('decrypted-token'),
}));

describe('Slack Integration Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('GET /api/slack/oauth', () => {
    describe('Configuration Checks', () => {
      it('should return 503 when Slack is not configured', async () => {
        vi.resetModules();
        setupEnv({});
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/oauth');

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: 'Slack not configured' });
      });

      it('should return 503 when only SLACK_CLIENT_ID is set', async () => {
        vi.resetModules();
        setupEnv({ SLACK_CLIENT_ID: 'test-client-id' });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/oauth');

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: 'Slack not configured' });
      });

      it('should return 503 when only SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are set', async () => {
        vi.resetModules();
        setupEnv({ 
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/oauth');

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: 'Slack not configured' });
      });
    });

    describe('OAuth Redirect', () => {
      it('should redirect to Slack OAuth URL when configured', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/oauth');

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('https://slack.com/oauth/v2/authorize');
        expect(response.headers.location).toContain('client_id=test-client-id');
      });

      it('should include required scopes in the redirect URL', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/oauth');

        expect(response.status).toBe(302);
        const location = response.headers.location;
        expect(location).toContain('scope=');
      });

      it('should use PUBLIC_BASE_URL when set', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
          PUBLIC_BASE_URL: 'https://myapp.example.com',
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/oauth');

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain(
          'redirect_uri=' + encodeURIComponent('https://myapp.example.com/api/slack/callback')
        );
      });
    });
  });

  describe('GET /api/slack/callback', () => {
    describe('Validation', () => {
      it('should return 400 when code is missing', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/callback');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Missing code' });
      });

      it('should return 400 when code is empty string', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/callback').query({ code: '' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Missing code' });
      });
    });

    describe('Configuration Checks', () => {
      it('should return 503 when Slack is not configured', async () => {
        vi.resetModules();
        setupEnv({});
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/callback').query({ code: 'valid-code' });

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: 'Slack not configured' });
      });
    });

    describe('OAuth Token Exchange', () => {
      it('should exchange code for token and redirect on success', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        mockFetch.mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            access_token: 'xoxb-test-token',
            team: { id: 'T123', name: 'Test Team' },
            authed_user: { id: 'U123' },
          }),
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/callback').query({ code: 'valid-code' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain('/settings?slack=connected');
      });

      it('should use custom FRONTEND_URL for redirect', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
          FRONTEND_URL: 'https://myapp.example.com',
        });
        mockFetch.mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            access_token: 'xoxb-test-token',
          }),
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/callback').query({ code: 'valid-code' });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('https://myapp.example.com/settings?slack=connected');
      });

      it('should call Slack API with correct parameters', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        mockFetch.mockResolvedValueOnce({
          json: async () => ({
            ok: true,
            access_token: 'xoxb-test-token',
          }),
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        await request(app).get('/api/slack/callback').query({ code: 'my-auth-code' });

        expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/oauth.v2.access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: expect.any(URLSearchParams),
        });

        // Verify the body params
        const callArgs = mockFetch.mock.calls[0];
        const body = callArgs[1].body as URLSearchParams;
        expect(body.get('client_id')).toBe('test-client-id');
        expect(body.get('client_secret')).toBe('test-client-secret');
        expect(body.get('code')).toBe('my-auth-code');
      });
    });

    describe('OAuth Error Handling', () => {
      it('should return 400 when Slack API returns ok: false', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        mockFetch.mockResolvedValueOnce({
          json: async () => ({
            ok: false,
            error: 'invalid_code',
          }),
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/callback').query({ code: 'invalid-code' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'invalid_code' });
      });

      it('should return 500 when fetch throws an error', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        mockFetch.mockRejectedValueOnce(new Error('Network error'));
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app).get('/api/slack/callback').query({ code: 'code' });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'OAuth failed' });
      });
    });
  });

  describe('POST /api/slack/events', () => {
    describe('Configuration Checks', () => {
      it('should return 503 when SLACK_SIGNING_SECRET is not set', async () => {
        vi.resetModules();
        setupEnv({});
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json());
        app.use('/api/slack', slackRouter);

        const response = await request(app)
          .post('/api/slack/events')
          .send({ type: 'event_callback', event: {} });

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: 'Slack not configured' });
      });
    });

    describe('Signature Verification', () => {
      it('should return 401 when signature is invalid', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        // Need raw body for signature verification
        app.use(express.json({
          verify: (req: any, _res, buf) => {
            req.rawBody = buf;
          }
        }));
        app.use('/api/slack', slackRouter);

        const response = await request(app)
          .post('/api/slack/events')
          .set('x-slack-request-timestamp', String(Math.floor(Date.now() / 1000)))
          .set('x-slack-signature', 'v0=invalid_signature')
          .send({ type: 'event_callback', event: {} });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Invalid Slack signature' });
      });

      it('should return 401 when signature headers are missing', async () => {
        vi.resetModules();
        setupEnv({
          SLACK_CLIENT_ID: 'test-client-id',
          SLACK_CLIENT_SECRET: 'test-client-secret',
          SLACK_SIGNING_SECRET: 'test-signing-secret',
        });
        const { default: slackRouter } = await import('../../src/routes/slack.js');
        const app = express();
        app.use(express.json({
          verify: (req: any, _res, buf) => {
            req.rawBody = buf;
          }
        }));
        app.use('/api/slack', slackRouter);

        const response = await request(app)
          .post('/api/slack/events')
          .send({ type: 'event_callback', event: {} });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Invalid Slack signature' });
      });
    });
  });

  describe('isSlackConfigured helper function', () => {
    // These tests verify the behavior indirectly through the endpoints

    it('should require all three env vars for OAuth', async () => {
      vi.resetModules();
      // Only set two of three
      setupEnv({
        SLACK_CLIENT_ID: 'id',
        SLACK_CLIENT_SECRET: 'secret',
        // Missing SLACK_SIGNING_SECRET
      });
      const { default: slackRouter } = await import('../../src/routes/slack.js');
      const app = express();
      app.use(express.json());
      app.use('/api/slack', slackRouter);

      const response = await request(app).get('/api/slack/oauth');
      expect(response.status).toBe(503);
    });

    it('should accept configuration when all three are set', async () => {
      vi.resetModules();
      setupEnv({
        SLACK_CLIENT_ID: 'id',
        SLACK_CLIENT_SECRET: 'secret',
        SLACK_SIGNING_SECRET: 'signing',
      });
      const { default: slackRouter } = await import('../../src/routes/slack.js');
      const app = express();
      app.use(express.json());
      app.use('/api/slack', slackRouter);

      const response = await request(app).get('/api/slack/oauth');
      expect(response.status).toBe(302);
    });
  });
});

/**
 * Integrations API integration tests.
 * Tests /api/integrations-v2 endpoints for managing third-party integrations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.NVIDIA_NIM_API_KEY = 'test_key';

// Mock integration storage
const mockIntegrations: Array<{
  id: string;
  userId: string;
  provider: string;
  status: string;
  displayName?: string;
  metadata?: string | null;
  createdAt: string;
}> = [];

// Mock the database
vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    getDb: () => ({
      prepare: () => ({
        get: () => null,
        run: () => ({ changes: 1 }),
        all: () => mockIntegrations,
      }),
    }),
  })),
}));

// Mock integration service - upsertIntegration is called with object { userId, provider, displayName }
vi.mock('../../src/services/integrationService.js', () => ({
  upsertIntegration: vi.fn().mockImplementation(({ userId, provider, displayName }) => {
    const integration = {
      id: `int_${Date.now()}`,
      userId,
      provider,
      status: 'pending',
      displayName,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    mockIntegrations.push(integration);
    return Promise.resolve(integration);
  }),
  getIntegrations: vi.fn().mockImplementation(() => Promise.resolve(mockIntegrations)),
  getIntegrationByProvider: vi.fn().mockImplementation((userId, provider) => 
    Promise.resolve(mockIntegrations.find(i => i.provider === provider && i.userId === userId))
  ),
  updateIntegrationStatus: vi.fn().mockResolvedValue({ success: true }),
  deleteIntegration: vi.fn().mockResolvedValue({ success: true }),
  storeOAuthTokens: vi.fn().mockResolvedValue({ success: true }),
  revokeOAuthTokens: vi.fn().mockResolvedValue({ success: true }),
  generateOAuthUrl: vi.fn().mockReturnValue('https://oauth.example.com/authorize?...'),
  exchangeOAuthCode: vi.fn().mockResolvedValue({ accessToken: 'test_token' }),
  OAUTH_PROVIDERS: {
    slack: { supportsOAuth: true },
    gmail: { supportsOAuth: true },
    spotify: { supportsOAuth: true },
    notion: { supportsOAuth: true },
    discord: { supportsOAuth: false },
  },
}));

// Mock secrets service
vi.mock('../../src/services/secretsService.js', () => ({
  storeApiKey: vi.fn().mockResolvedValue({ success: true }),
  storeBotToken: vi.fn().mockResolvedValue({ success: true }),
  getApiKey: vi.fn().mockResolvedValue(null),
  deleteSecret: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock audit log service
vi.mock('../../src/services/auditLogService.js', () => ({
  queryAuditLogs: vi.fn().mockResolvedValue([]),
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

// Import and setup
const integrationsRoutes = (await import('../../src/routes/integrations-v2.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/integrations-v2', integrationsRoutes);

describe('Integrations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIntegrations.length = 0;
  });

  describe('GET /api/integrations-v2', () => {
    it('returns 200 with integrations array', async () => {
      const res = await request(app).get('/api/integrations-v2').expect(200);
      expect(res.body).toHaveProperty('integrations');
      expect(Array.isArray(res.body.integrations)).toBe(true);
    });

    it('returns empty array when no integrations exist', async () => {
      const res = await request(app).get('/api/integrations-v2').expect(200);
      expect(res.body.integrations).toHaveLength(0);
    });
  });

  describe('POST /api/integrations-v2', () => {
    it('returns 400 when provider is missing', async () => {
      const res = await request(app)
        .post('/api/integrations-v2')
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for invalid provider', async () => {
      const res = await request(app)
        .post('/api/integrations-v2')
        .send({ provider: 'invalid_provider' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('creates integration with valid provider', async () => {
      const res = await request(app)
        .post('/api/integrations-v2')
        .send({ provider: 'discord', displayName: 'My Discord Bot' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('provider', 'discord');
      expect(res.body).toHaveProperty('status');
    });
  });

  // NOTE: The actual routes for api-key and bot-token are:
  // POST /api/integrations-v2/api-key (with { provider, apiKey } in body)
  // POST /api/integrations-v2/bot-token (with { provider, token } in body)
  describe('POST /api/integrations-v2/api-key', () => {
    it('returns 400 when provider is missing', async () => {
      const res = await request(app)
        .post('/api/integrations-v2/api-key')
        .send({ apiKey: 'test-key' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when apiKey is missing', async () => {
      const res = await request(app)
        .post('/api/integrations-v2/api-key')
        .send({ provider: 'elevenlabs' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('stores API key for valid provider', async () => {
      const res = await request(app)
        .post('/api/integrations-v2/api-key')
        .send({ provider: 'elevenlabs', apiKey: 'sk-test-api-key-12345' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/integrations-v2/bot-token', () => {
    it('returns 400 when provider is missing', async () => {
      const res = await request(app)
        .post('/api/integrations-v2/bot-token')
        .send({ token: 'test-token' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when token is missing', async () => {
      const res = await request(app)
        .post('/api/integrations-v2/bot-token')
        .send({ provider: 'discord' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('stores bot token for valid provider', async () => {
      const res = await request(app)
        .post('/api/integrations-v2/bot-token')
        .send({ provider: 'discord', token: 'bot-token-123' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/integrations-v2/:provider', () => {
    // NOTE: DELETE returns 204 No Content (not 200 with body)
    it('deletes integration for valid provider and returns 204', async () => {
      // First create an integration
      await request(app)
        .post('/api/integrations-v2')
        .send({ provider: 'slack' })
        .expect(201);

      // Then delete it - returns 204 No Content
      await request(app)
        .delete('/api/integrations-v2/slack')
        .expect(204);
    });
  });

  describe('GET /api/integrations-v2/audit-logs', () => {
    it('returns 200 with audit logs array', async () => {
      const res = await request(app)
        .get('/api/integrations-v2/audit-logs')
        .expect(200);
      expect(res.body).toHaveProperty('logs');
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    it('accepts category filter', async () => {
      const res = await request(app)
        .get('/api/integrations-v2/audit-logs?category=integration')
        .expect(200);
      expect(res.body).toHaveProperty('logs');
    });

    it('accepts limit and offset parameters', async () => {
      const res = await request(app)
        .get('/api/integrations-v2/audit-logs?limit=10&offset=0')
        .expect(200);
      expect(res.body).toHaveProperty('logs');
    });
  });

  describe('GET /api/integrations-v2/:provider', () => {
    it('returns 404 for non-existent provider integration', async () => {
      const res = await request(app)
        .get('/api/integrations-v2/discord')
        .expect(404);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for invalid provider name', async () => {
      const res = await request(app)
        .get('/api/integrations-v2/invalid_provider_name')
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});

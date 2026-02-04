/**
 * Models Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock ai-core module
vi.mock('@grump/ai-core', () => ({
  MODEL_REGISTRY: [
    {
      id: 'meta/llama-3.1-70b-instruct',
      name: 'Llama 3.1 70B Instruct',
      provider: 'nim',
      maxTokens: 128000,
      capabilities: ['code', 'reasoning', 'tool_use'],
    },
    {
      id: 'moonshotai/kimi-k2.5',
      name: 'Kimi K2.5',
      provider: 'nim',
      maxTokens: 32000,
      capabilities: ['code', 'reasoning', 'tool_use'],
    },
  ],
  PROVIDER_METADATA: {
    nim: {
      displayName: 'NVIDIA NIM',
      icon: '/icons/providers/nvidia.svg',
    },
    mock: {
      displayName: 'Mock Provider',
      icon: '/icons/providers/default.svg',
    },
  },
  getModelsByProvider: vi.fn((provider: string) => {
    const models: Record<string, unknown[]> = {
      nim: [
        {
          id: 'meta/llama-3.1-70b-instruct',
          name: 'Llama 3.1 70B Instruct',
          provider: 'nim',
          maxTokens: 128000,
          capabilities: ['code', 'reasoning', 'tool_use'],
        },
        {
          id: 'moonshotai/kimi-k2.5',
          name: 'Kimi K2.5',
          provider: 'nim',
          maxTokens: 32000,
          capabilities: ['code', 'reasoning', 'tool_use'],
        },
      ],
      mock: [],
    };
    return models[provider] || [];
  }),
}));

import modelsRouter from '../../src/routes/models.js';
import { getModelsByProvider, MODEL_REGISTRY } from '@grump/ai-core';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/models', modelsRouter);
  return app;
}

describe('Models Route', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /models/list', () => {
    it('should return models grouped by provider', async () => {
      const response = await request(app).get('/models/list');

      expect(response.status).toBe(200);
      expect(response.body.groups).toBeDefined();
      expect(Array.isArray(response.body.groups)).toBe(true);
      expect(response.body.defaultModelId).toBe('meta/llama-3.1-70b-instruct');
      expect(response.body.poweredBy).toBe('NVIDIA NIM');
    });

    it('should include provider metadata', async () => {
      const response = await request(app).get('/models/list');

      expect(response.status).toBe(200);
      
      // Find the nim provider group
      const nimGroup = response.body.groups.find((g: { provider: string }) => g.provider === 'nim');
      expect(nimGroup).toBeDefined();
      expect(nimGroup.displayName).toBe('NVIDIA NIM');
      expect(nimGroup.icon).toBe('/icons/providers/nvidia.svg');
    });

    it('should mark recommended model', async () => {
      const response = await request(app).get('/models/list');

      expect(response.status).toBe(200);

      const nimGroup = response.body.groups.find((g: { provider: string }) => g.provider === 'nim');
      const recommendedModel = nimGroup?.models.find((m: { id: string }) => m.id === 'meta/llama-3.1-70b-instruct');
      expect(recommendedModel?.isRecommended).toBe(true);
    });

    it('should only include providers with models', async () => {
      const response = await request(app).get('/models/list');

      expect(response.status).toBe(200);

      // Providers with no models should not be in the groups
      const emptyProvider = response.body.groups.find(
        (g: { provider: string }) => g.provider === 'mock'
      );
      expect(emptyProvider).toBeUndefined();
    });

    it('should include models with capabilities', async () => {
      const response = await request(app).get('/models/list');

      expect(response.status).toBe(200);
      
      const nimGroup = response.body.groups.find((g: { provider: string }) => g.provider === 'nim');
      const model = nimGroup?.models[0];
      expect(model?.capabilities).toContain('code');
      expect(model?.capabilities).toContain('reasoning');
    });
  });

  describe('GET /models/registry', () => {
    it('should return full model registry', async () => {
      const response = await request(app).get('/models/registry');

      expect(response.status).toBe(200);
      expect(response.body.models).toBeDefined();
      expect(Array.isArray(response.body.models)).toBe(true);
      expect(response.body.models).toEqual(MODEL_REGISTRY);
    });

    it('should return models with expected structure', async () => {
      const response = await request(app).get('/models/registry');

      expect(response.status).toBe(200);
      expect(response.body.models.length).toBeGreaterThan(0);
      
      const firstModel = response.body.models[0];
      expect(firstModel).toHaveProperty('id');
      expect(firstModel).toHaveProperty('name');
      expect(firstModel).toHaveProperty('provider');
    });
  });
});

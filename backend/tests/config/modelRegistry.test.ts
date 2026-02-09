/**
 * Model Registry Tests
 * Tests for backend re-exports from @grump/ai-core (NVIDIA NIM exclusive).
 */

import { describe, it, expect } from 'vitest';
import {
  MODEL_REGISTRY,
  getModelById,
  getModelsByCapability,
  getModelsByProvider,
  type ModelConfig,
  type ModelCapability,
  type LLMProvider,
} from '../../src/config/modelRegistry.js';

describe('Model Registry (re-exports)', () => {
  describe('MODEL_REGISTRY', () => {
    it('should be an array of model configurations', () => {
      expect(Array.isArray(MODEL_REGISTRY)).toBe(true);
      expect(MODEL_REGISTRY.length).toBeGreaterThan(0);
    });

    it('should contain model with required fields', () => {
      const model = MODEL_REGISTRY[0];

      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('capabilities');
      expect(model).toHaveProperty('contextWindow');
    });

    it('should include Llama 3.1 405B as a flagship model', () => {
      const llamaModel = MODEL_REGISTRY.find((m) => m.id === 'meta/llama-3.1-405b-instruct');

      expect(llamaModel).toBeDefined();
      expect(llamaModel?.provider).toBe('nim');
      expect(llamaModel?.contextWindow).toBe(128_000);
    });

    it('should include models from nim and mock providers only', () => {
      const providers = new Set(MODEL_REGISTRY.map((m) => m.provider));

      expect(providers.has('nim')).toBe(true);
      expect(providers.has('mock')).toBe(true);
      // No longer has anthropic or other providers
      expect(providers.has('anthropic')).toBe(false);
    });

    it('should have valid capabilities arrays', () => {
      for (const model of MODEL_REGISTRY) {
        expect(Array.isArray(model.capabilities)).toBe(true);
      }
    });

    it('should have positive context window values', () => {
      for (const model of MODEL_REGISTRY) {
        expect(model.contextWindow).toBeGreaterThan(0);
      }
    });
  });

  describe('getModelById', () => {
    it('should return model by ID', () => {
      const model = getModelById('meta/llama-3.1-405b-instruct');

      expect(model).toBeDefined();
      expect(model?.id).toBe('meta/llama-3.1-405b-instruct');
    });

    it('should return undefined for non-existent model', () => {
      const model = getModelById('non-existent-model');

      expect(model).toBeUndefined();
    });

    it('should return correct model for Llama models', () => {
      const model = getModelById('meta/llama-3.1-70b-instruct');

      expect(model).toBeDefined();
      expect(model?.provider).toBe('nim');
    });

    it('should return correct model for Mistral models', () => {
      const model = getModelById('mistralai/mistral-large-2-instruct');

      expect(model).toBeDefined();
      expect(model?.provider).toBe('nim');
    });

    it('should return correct model for Nemotron', () => {
      const model = getModelById('nvidia/llama-3.1-nemotron-ultra-253b-v1');

      expect(model).toBeDefined();
      expect(model?.provider).toBe('nim');
    });
  });

  describe('getModelsByCapability', () => {
    it('should return models with code capability', () => {
      const models = getModelsByCapability('code');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.capabilities.includes('code'))).toBe(true);
    });

    it('should return models with vision capability', () => {
      const models = getModelsByCapability('vision');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.capabilities.includes('vision'))).toBe(true);
    });

    it('should return models with reasoning capability', () => {
      const models = getModelsByCapability('reasoning');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.capabilities.includes('reasoning'))).toBe(true);
    });

    it('should return models with agentic capability', () => {
      const models = getModelsByCapability('agentic');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.capabilities.includes('agentic'))).toBe(true);
    });

    it('should return models with function-calling capability', () => {
      const models = getModelsByCapability('function-calling');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.capabilities.includes('function-calling'))).toBe(true);
    });

    it('should return models with long-context capability', () => {
      const models = getModelsByCapability('long-context');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.capabilities.includes('long-context'))).toBe(true);
    });

    it('should return models with multilingual capability', () => {
      const models = getModelsByCapability('multilingual');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.capabilities.includes('multilingual'))).toBe(true);
    });
  });

  describe('getModelsByProvider', () => {
    it('should return NIM provider models', () => {
      const models = getModelsByProvider('nim');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.provider === 'nim')).toBe(true);
    });

    it('should return empty array for anthropic provider (no longer supported)', () => {
      const models = getModelsByProvider('anthropic' as LLMProvider);

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(0);
    });

    it('should return Mock provider models', () => {
      const models = getModelsByProvider('mock');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(1);
      expect(models.every((m) => m.provider === 'mock')).toBe(true);
    });

    it('should return empty array for removed providers', () => {
      const openrouterModels = getModelsByProvider('openrouter' as LLMProvider);

      expect(openrouterModels.length).toBe(0);
    });
  });

  describe('Type exports', () => {
    it('should export ModelConfig type', () => {
      const model: ModelConfig = {
        id: 'test-model',
        provider: 'nim',
        capabilities: ['code'],
        contextWindow: 32000,
      };

      expect(model.id).toBe('test-model');
    });

    it('should export ModelCapability type', () => {
      const capability: ModelCapability = 'code';

      expect(capability).toBe('code');
    });

    it('should export LLMProvider type', () => {
      const provider: LLMProvider = 'nim';

      expect(provider).toBe('nim');
    });
  });

  describe('Model metadata', () => {
    it('should have cost information for some models', () => {
      const model = getModelById('meta/llama-3.1-405b-instruct');

      expect(model?.costPerMillionInput).toBeDefined();
      expect(model?.costPerMillionOutput).toBeDefined();
    });

    it('should have description for models', () => {
      const model = getModelById('meta/llama-3.1-405b-instruct');

      expect(model?.description).toBeDefined();
      expect(typeof model?.description).toBe('string');
    });

    it('should have publisher for some models', () => {
      const model = getModelById('meta/llama-3.1-405b-instruct');

      expect(model?.publisher).toBe('Meta');
    });

    it('should have parameters info for some models', () => {
      const model = getModelById('meta/llama-3.1-405b-instruct');

      expect(model?.parameters).toBeDefined();
    });
  });

  describe('Specific model families', () => {
    it('should include Nemotron models', () => {
      const nemotronModels = MODEL_REGISTRY.filter((m) => m.id.includes('nemotron'));

      expect(nemotronModels.length).toBeGreaterThan(0);
    });

    it('should include Llama models', () => {
      const llamaModels = MODEL_REGISTRY.filter((m) => m.id.includes('llama'));

      expect(llamaModels.length).toBeGreaterThan(0);
    });

    it('should include Mistral models', () => {
      const mistralModels = MODEL_REGISTRY.filter((m) => m.id.includes('mistral'));

      expect(mistralModels.length).toBeGreaterThan(0);
    });
  });

  describe('Context window ranges', () => {
    it('should have models with 1M context (Nemotron 3 Nano)', () => {
      const context1MModels = MODEL_REGISTRY.filter((m) => m.contextWindow === 1_000_000);

      expect(context1MModels.length).toBeGreaterThan(0);
    });

    it('should have models with 128K context', () => {
      const context128kModels = MODEL_REGISTRY.filter((m) => m.contextWindow === 128_000);

      expect(context128kModels.length).toBeGreaterThan(0);
    });

    it('should have models with various context sizes', () => {
      const allContextSizes = MODEL_REGISTRY.map((m) => m.contextWindow);

      expect(allContextSizes.length).toBeGreaterThan(0);
      expect(Math.max(...allContextSizes)).toBeGreaterThanOrEqual(128_000);
    });
  });
});

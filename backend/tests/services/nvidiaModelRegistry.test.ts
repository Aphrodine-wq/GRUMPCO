/**
 * Tests for NVIDIA Model Registry
 * Tests model registry, helper functions, and configurations
 */

import { describe, it, expect } from 'vitest';
import {
  NVIDIA_MODEL_REGISTRY,
  MODEL_CAPABILITY_LABELS,
  MODEL_CATEGORIES,
  NvidiaModelConfig,
  NvidiaModelCapability,
  getNvidiaModelById,
  getNvidiaModelsByCapability,
  getNvidiaModelsByPublisher,
  getNvidiaChatModels,
  getNvidiaCodeModels,
  getNvidiaVisionModels,
  getNvidiaEmbeddingModels,
  getNvidiaSafetyModels,
  getCheapestNvidiaModel,
  getLargestContextNvidiaModel,
  estimateNvidiaCost,
} from '../../src/services/nvidiaModelRegistry.js';

describe('NVIDIA Model Registry', () => {
  describe('NVIDIA_MODEL_REGISTRY', () => {
    it('should have a non-empty array of models', () => {
      expect(NVIDIA_MODEL_REGISTRY).toBeDefined();
      expect(Array.isArray(NVIDIA_MODEL_REGISTRY)).toBe(true);
      expect(NVIDIA_MODEL_REGISTRY.length).toBeGreaterThan(0);
    });

    it('should have valid model configurations', () => {
      NVIDIA_MODEL_REGISTRY.forEach((model) => {
        expect(model.id).toBeDefined();
        expect(typeof model.id).toBe('string');
        expect(model.id.length).toBeGreaterThan(0);

        expect(model.name).toBeDefined();
        expect(typeof model.name).toBe('string');

        expect(model.publisher).toBeDefined();
        expect(typeof model.publisher).toBe('string');

        expect(Array.isArray(model.capabilities)).toBe(true);
        expect(model.capabilities.length).toBeGreaterThan(0);

        expect(typeof model.contextWindow).toBe('number');
        expect(model.contextWindow).toBeGreaterThanOrEqual(0);

        expect(typeof model.costPerTokenInput).toBe('number');
        expect(model.costPerTokenInput).toBeGreaterThanOrEqual(0);

        expect(typeof model.costPerTokenOutput).toBe('number');
        expect(model.costPerTokenOutput).toBeGreaterThanOrEqual(0);

        expect(typeof model.description).toBe('string');
        expect(Array.isArray(model.bestFor)).toBe(true);

        expect(typeof model.supportsTools).toBe('boolean');
        expect(typeof model.supportsStreaming).toBe('boolean');
      });
    });

    it('should have unique model IDs', () => {
      const ids = NVIDIA_MODEL_REGISTRY.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include Llama models', () => {
      const llamaModels = NVIDIA_MODEL_REGISTRY.filter((m) =>
        m.id.includes('llama') || m.name.toLowerCase().includes('llama')
      );
      expect(llamaModels.length).toBeGreaterThan(0);
    });

    it('should include Mistral models', () => {
      const mistralModels = NVIDIA_MODEL_REGISTRY.filter((m) =>
        m.publisher.toLowerCase().includes('mistral')
      );
      expect(mistralModels.length).toBeGreaterThan(0);
    });

    it('should include NVIDIA models', () => {
      const nvidiaModels = NVIDIA_MODEL_REGISTRY.filter((m) =>
        m.publisher === 'NVIDIA'
      );
      expect(nvidiaModels.length).toBeGreaterThan(0);
    });

    it('should have models with various capabilities', () => {
      const capabilitySet = new Set<NvidiaModelCapability>();
      NVIDIA_MODEL_REGISTRY.forEach((m) => {
        m.capabilities.forEach((cap) => capabilitySet.add(cap));
      });
      
      // Verify key capabilities are represented
      expect(capabilitySet.has('chat')).toBe(true);
      expect(capabilitySet.has('code')).toBe(true);
      expect(capabilitySet.has('vision')).toBe(true);
      expect(capabilitySet.has('embedding')).toBe(true);
    });

    it('should have multimodal models flagged correctly', () => {
      const multimodalModels = NVIDIA_MODEL_REGISTRY.filter((m) => m.multimodal === true);
      expect(multimodalModels.length).toBeGreaterThan(0);
      
      multimodalModels.forEach((model) => {
        // Multimodal models should typically have vision or multimodal capability
        const hasVisionOrMultimodal = 
          model.capabilities.includes('vision') || 
          model.capabilities.includes('multimodal');
        expect(hasVisionOrMultimodal).toBe(true);
      });
    });

    it('should have MoE models flagged correctly', () => {
      const moeModels = NVIDIA_MODEL_REGISTRY.filter((m) => m.moE === true);
      expect(moeModels.length).toBeGreaterThan(0);
    });
  });

  describe('getNvidiaModelById', () => {
    it('should return a model when given a valid ID', () => {
      const model = NVIDIA_MODEL_REGISTRY[0];
      const result = getNvidiaModelById(model.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(model.id);
    });

    it('should return undefined for non-existent model ID', () => {
      const result = getNvidiaModelById('non-existent-model-id');
      expect(result).toBeUndefined();
    });

    it('should find Llama 3.1 8B model', () => {
      const result = getNvidiaModelById('meta/llama-3.1-8b-instruct');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Llama 3.1 8B');
      expect(result?.publisher).toBe('Meta');
    });

    it('should return correct model properties', () => {
      const result = getNvidiaModelById('meta/llama-3.1-70b-instruct');
      expect(result).toBeDefined();
      expect(result?.contextWindow).toBe(128_000);
      expect(result?.supportsTools).toBe(true);
      expect(result?.supportsStreaming).toBe(true);
    });
  });

  describe('getNvidiaModelsByCapability', () => {
    it('should return chat models', () => {
      const chatModels = getNvidiaModelsByCapability('chat');
      expect(chatModels.length).toBeGreaterThan(0);
      chatModels.forEach((model) => {
        expect(model.capabilities).toContain('chat');
      });
    });

    it('should return code models', () => {
      const codeModels = getNvidiaModelsByCapability('code');
      expect(codeModels.length).toBeGreaterThan(0);
      codeModels.forEach((model) => {
        expect(model.capabilities).toContain('code');
      });
    });

    it('should return vision models', () => {
      const visionModels = getNvidiaModelsByCapability('vision');
      expect(visionModels.length).toBeGreaterThan(0);
      visionModels.forEach((model) => {
        expect(model.capabilities).toContain('vision');
      });
    });

    it('should return embedding models', () => {
      const embeddingModels = getNvidiaModelsByCapability('embedding');
      expect(embeddingModels.length).toBeGreaterThan(0);
      embeddingModels.forEach((model) => {
        expect(model.capabilities).toContain('embedding');
      });
    });

    it('should return safety models', () => {
      const safetyModels = getNvidiaModelsByCapability('safety');
      expect(safetyModels.length).toBeGreaterThan(0);
      safetyModels.forEach((model) => {
        expect(model.capabilities).toContain('safety');
      });
    });

    it('should return empty array for non-existent capability', () => {
      // Using a made-up capability to test
      const models = getNvidiaModelsByCapability('non-existent-capability' as NvidiaModelCapability);
      expect(models).toEqual([]);
    });

    it('should return reasoning models', () => {
      const reasoningModels = getNvidiaModelsByCapability('reasoning');
      expect(reasoningModels.length).toBeGreaterThan(0);
    });

    it('should return function-calling models', () => {
      const fcModels = getNvidiaModelsByCapability('function-calling');
      expect(fcModels.length).toBeGreaterThan(0);
    });

    it('should return agentic models', () => {
      const agenticModels = getNvidiaModelsByCapability('agentic');
      expect(agenticModels.length).toBeGreaterThan(0);
    });
  });

  describe('getNvidiaModelsByPublisher', () => {
    it('should return Meta models', () => {
      const metaModels = getNvidiaModelsByPublisher('Meta');
      expect(metaModels.length).toBeGreaterThan(0);
      metaModels.forEach((model) => {
        expect(model.publisher.toLowerCase()).toBe('meta');
      });
    });

    it('should return NVIDIA models', () => {
      const nvidiaModels = getNvidiaModelsByPublisher('NVIDIA');
      expect(nvidiaModels.length).toBeGreaterThan(0);
      nvidiaModels.forEach((model) => {
        expect(model.publisher.toLowerCase()).toBe('nvidia');
      });
    });

    it('should return Mistral AI models', () => {
      const mistralModels = getNvidiaModelsByPublisher('Mistral AI');
      expect(mistralModels.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const models1 = getNvidiaModelsByPublisher('meta');
      const models2 = getNvidiaModelsByPublisher('META');
      const models3 = getNvidiaModelsByPublisher('Meta');
      
      expect(models1.length).toBe(models2.length);
      expect(models2.length).toBe(models3.length);
    });

    it('should return empty array for non-existent publisher', () => {
      const models = getNvidiaModelsByPublisher('NonExistentPublisher');
      expect(models).toEqual([]);
    });
  });

  describe('getNvidiaChatModels', () => {
    it('should return models with chat capability and tool support', () => {
      const chatModels = getNvidiaChatModels();
      expect(chatModels.length).toBeGreaterThan(0);
      
      chatModels.forEach((model) => {
        expect(model.capabilities).toContain('chat');
        expect(model.supportsTools).toBe(true);
      });
    });
  });

  describe('getNvidiaCodeModels', () => {
    it('should return models with code capability', () => {
      const codeModels = getNvidiaCodeModels();
      expect(codeModels.length).toBeGreaterThan(0);
      
      codeModels.forEach((model) => {
        expect(model.capabilities).toContain('code');
      });
    });
  });

  describe('getNvidiaVisionModels', () => {
    it('should return models with vision capability or multimodal flag', () => {
      const visionModels = getNvidiaVisionModels();
      expect(visionModels.length).toBeGreaterThan(0);
      
      visionModels.forEach((model) => {
        const hasVisionOrMultimodal = 
          model.capabilities.includes('vision') || 
          model.multimodal === true;
        expect(hasVisionOrMultimodal).toBe(true);
      });
    });
  });

  describe('getNvidiaEmbeddingModels', () => {
    it('should return models with embedding capability', () => {
      const embeddingModels = getNvidiaEmbeddingModels();
      expect(embeddingModels.length).toBeGreaterThan(0);
      
      embeddingModels.forEach((model) => {
        expect(model.capabilities).toContain('embedding');
      });
    });
  });

  describe('getNvidiaSafetyModels', () => {
    it('should return models with safety capability', () => {
      const safetyModels = getNvidiaSafetyModels();
      expect(safetyModels.length).toBeGreaterThan(0);
      
      safetyModels.forEach((model) => {
        expect(model.capabilities).toContain('safety');
      });
    });
  });

  describe('getCheapestNvidiaModel', () => {
    it('should return a valid model', () => {
      const cheapest = getCheapestNvidiaModel();
      expect(cheapest).toBeDefined();
      expect(cheapest.id).toBeDefined();
    });

    it('should return the model with lowest combined cost', () => {
      const cheapest = getCheapestNvidiaModel();
      const cheapestCost = cheapest.costPerTokenInput + cheapest.costPerTokenOutput;
      
      NVIDIA_MODEL_REGISTRY.forEach((model) => {
        const modelCost = model.costPerTokenInput + model.costPerTokenOutput;
        expect(modelCost).toBeGreaterThanOrEqual(cheapestCost);
      });
    });
  });

  describe('getLargestContextNvidiaModel', () => {
    it('should return a valid model', () => {
      const largest = getLargestContextNvidiaModel();
      expect(largest).toBeDefined();
      expect(largest.id).toBeDefined();
    });

    it('should return the model with largest context window', () => {
      const largest = getLargestContextNvidiaModel();
      
      NVIDIA_MODEL_REGISTRY.forEach((model) => {
        expect(largest.contextWindow).toBeGreaterThanOrEqual(model.contextWindow);
      });
    });

    it('should have a context window greater than 100k tokens', () => {
      const largest = getLargestContextNvidiaModel();
      // Modern large context models should have at least 100k context
      expect(largest.contextWindow).toBeGreaterThanOrEqual(100_000);
    });
  });

  describe('estimateNvidiaCost', () => {
    it('should calculate cost correctly for a valid model', () => {
      const model = NVIDIA_MODEL_REGISTRY[0];
      const inputTokens = 1000;
      const outputTokens = 500;
      
      const result = estimateNvidiaCost(model.id, inputTokens, outputTokens);
      
      expect(result).toBeDefined();
      expect(typeof result.usd).toBe('number');
      expect(typeof result.breakdown).toBe('string');
      
      const expectedCost = 
        (inputTokens * model.costPerTokenInput) + 
        (outputTokens * model.costPerTokenOutput);
      expect(result.usd).toBeCloseTo(expectedCost, 10);
    });

    it('should throw error for non-existent model', () => {
      expect(() => {
        estimateNvidiaCost('non-existent-model', 1000, 500);
      }).toThrow('Model non-existent-model not found in NVIDIA registry');
    });

    it('should include model name in breakdown', () => {
      const model = NVIDIA_MODEL_REGISTRY[0];
      const result = estimateNvidiaCost(model.id, 1000, 500);
      
      expect(result.breakdown).toContain(model.name);
    });

    it('should include token counts in breakdown', () => {
      const model = NVIDIA_MODEL_REGISTRY[0];
      const result = estimateNvidiaCost(model.id, 1000, 500);
      
      expect(result.breakdown).toContain('1000');
      expect(result.breakdown).toContain('500');
    });

    it('should handle zero tokens', () => {
      const model = NVIDIA_MODEL_REGISTRY[0];
      const result = estimateNvidiaCost(model.id, 0, 0);
      
      expect(result.usd).toBe(0);
    });

    it('should handle large token counts', () => {
      const model = NVIDIA_MODEL_REGISTRY[0];
      const result = estimateNvidiaCost(model.id, 1_000_000, 1_000_000);
      
      expect(result.usd).toBeGreaterThan(0);
    });
  });

  describe('MODEL_CAPABILITY_LABELS', () => {
    it('should have labels for all capabilities used in registry', () => {
      const usedCapabilities = new Set<string>();
      NVIDIA_MODEL_REGISTRY.forEach((model) => {
        model.capabilities.forEach((cap) => usedCapabilities.add(cap));
      });

      usedCapabilities.forEach((cap) => {
        expect(MODEL_CAPABILITY_LABELS[cap as NvidiaModelCapability]).toBeDefined();
      });
    });

    it('should have valid label structure', () => {
      Object.entries(MODEL_CAPABILITY_LABELS).forEach(([key, value]) => {
        expect(value.label).toBeDefined();
        expect(typeof value.label).toBe('string');
        
        expect(value.color).toBeDefined();
        expect(typeof value.color).toBe('string');
        
        expect(value.icon).toBeDefined();
        expect(typeof value.icon).toBe('string');
      });
    });

    it('should have chat capability label', () => {
      expect(MODEL_CAPABILITY_LABELS.chat).toBeDefined();
      expect(MODEL_CAPABILITY_LABELS.chat.label).toBe('Chat');
    });

    it('should have code capability label', () => {
      expect(MODEL_CAPABILITY_LABELS.code).toBeDefined();
      expect(MODEL_CAPABILITY_LABELS.code.label).toBe('Code');
    });

    it('should have vision capability label', () => {
      expect(MODEL_CAPABILITY_LABELS.vision).toBeDefined();
      expect(MODEL_CAPABILITY_LABELS.vision.label).toBe('Vision');
    });

    it('should have embedding capability label', () => {
      expect(MODEL_CAPABILITY_LABELS.embedding).toBeDefined();
      expect(MODEL_CAPABILITY_LABELS.embedding.label).toBe('Embedding');
    });
  });

  describe('MODEL_CATEGORIES', () => {
    it('should be defined', () => {
      expect(MODEL_CATEGORIES).toBeDefined();
    });

    it('should have Llama Family category', () => {
      expect(MODEL_CATEGORIES['Llama Family']).toBeDefined();
      expect(MODEL_CATEGORIES['Llama Family']).toContain('Meta');
    });

    it('should have Mistral Family category', () => {
      expect(MODEL_CATEGORIES['Mistral Family']).toBeDefined();
      expect(MODEL_CATEGORIES['Mistral Family']).toContain('Mistral AI');
    });

    it('should have Nemotron category', () => {
      expect(MODEL_CATEGORIES['Nemotron']).toBeDefined();
      expect(MODEL_CATEGORIES['Nemotron']).toContain('NVIDIA');
    });

    it('should have categories for all major model families', () => {
      const expectedCategories = [
        'Llama Family',
        'Mistral Family',
        'DeepSeek',
        'Nemotron',
        'Embeddings',
        'Safety',
      ];

      expectedCategories.forEach((category) => {
        expect(MODEL_CATEGORIES[category as keyof typeof MODEL_CATEGORIES]).toBeDefined();
      });
    });
  });

  describe('Model data integrity', () => {
    it('should have reasonable cost values (not negative)', () => {
      NVIDIA_MODEL_REGISTRY.forEach((model) => {
        expect(model.costPerTokenInput).toBeGreaterThanOrEqual(0);
        expect(model.costPerTokenOutput).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have context windows that are reasonable', () => {
      NVIDIA_MODEL_REGISTRY.forEach((model) => {
        expect(model.contextWindow).toBeGreaterThanOrEqual(0);
        // Max reasonable context window (10M tokens for some new models)
        expect(model.contextWindow).toBeLessThanOrEqual(10_000_000);
      });
    });

    it('should have non-empty bestFor arrays', () => {
      NVIDIA_MODEL_REGISTRY.forEach((model) => {
        expect(model.bestFor.length).toBeGreaterThan(0);
      });
    });

    it('should have non-empty descriptions', () => {
      NVIDIA_MODEL_REGISTRY.forEach((model) => {
        expect(model.description.length).toBeGreaterThan(0);
      });
    });

    it('should have models from multiple publishers', () => {
      const publishers = new Set(NVIDIA_MODEL_REGISTRY.map((m) => m.publisher));
      expect(publishers.size).toBeGreaterThan(5);
    });

    it('should have at least one model with each key capability', () => {
      const keyCapabilities: NvidiaModelCapability[] = [
        'chat',
        'code',
        'vision',
        'embedding',
        'reasoning',
        'safety',
      ];

      keyCapabilities.forEach((cap) => {
        const models = getNvidiaModelsByCapability(cap);
        expect(models.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Specialized model categories', () => {
    it('should have biology/life sciences models', () => {
      const bioModels = getNvidiaModelsByCapability('biology');
      expect(bioModels.length).toBeGreaterThan(0);
    });

    it('should have image generation models', () => {
      const imageGenModels = getNvidiaModelsByCapability('image-generation');
      expect(imageGenModels.length).toBeGreaterThan(0);
    });

    it('should have speech models', () => {
      const sttModels = getNvidiaModelsByCapability('speech-to-text');
      expect(sttModels.length).toBeGreaterThan(0);
    });

    it('should have multilingual models', () => {
      const multilingualModels = NVIDIA_MODEL_REGISTRY.filter((m) => 
        m.languages && m.languages.length > 1
      );
      expect(multilingualModels.length).toBeGreaterThan(0);
    });
  });
});

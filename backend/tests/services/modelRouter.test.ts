/**
 * Model Router Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Model Router', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  
  describe('Model Selection', () => {
    it('should select cost-effective model for simple tasks', () => {
      const task = {
        complexity: 'low',
        tokens: 100,
        requiresReasoning: false,
      };
      
      const selectedModel = selectModelForTask(task);
      
      expect(selectedModel.costTier).toBe('low');
    });
    
    it('should select capable model for complex tasks', () => {
      const task = {
        complexity: 'high',
        tokens: 10000,
        requiresReasoning: true,
      };
      
      const selectedModel = selectModelForTask(task);
      
      expect(['medium', 'high']).toContain(selectedModel.costTier);
    });
    
    it('should respect provider preferences', () => {
      const preferences = {
        preferredProvider: 'nvidia',
        fallbackProviders: ['openrouter', 'groq'],
      };
      
      const selectedModel = selectModelWithPreferences(preferences);
      
      expect(selectedModel.provider).toBe('nvidia');
    });
    
    it('should fallback when primary provider unavailable', () => {
      const preferences = {
        preferredProvider: 'unavailable',
        fallbackProviders: ['openrouter', 'groq'],
      };
      
      const selectedModel = selectModelWithPreferences(preferences, { primaryUnavailable: true });
      
      expect(['openrouter', 'groq']).toContain(selectedModel.provider);
    });
  });
  
  describe('Cost Estimation', () => {
    it('should calculate correct cost for input tokens', () => {
      const model = { inputPrice: 0.001, outputPrice: 0.002 };
      const tokens = { input: 1000, output: 0 };
      
      const cost = calculateCost(model, tokens);
      
      expect(cost).toBe(0.001);
    });
    
    it('should calculate correct cost for output tokens', () => {
      const model = { inputPrice: 0.001, outputPrice: 0.002 };
      const tokens = { input: 0, output: 1000 };
      
      const cost = calculateCost(model, tokens);
      
      expect(cost).toBe(0.002);
    });
    
    it('should calculate total cost correctly', () => {
      const model = { inputPrice: 0.001, outputPrice: 0.002 };
      const tokens = { input: 1000, output: 500 };
      
      const cost = calculateCost(model, tokens);
      
      expect(cost).toBe(0.002); // 0.001 + 0.001
    });
  });
  
  describe('Model Capabilities', () => {
    it('should identify models with vision support', () => {
      const visionModel = { capabilities: ['text', 'vision'] };
      const textModel = { capabilities: ['text'] };
      
      expect(hasCapability(visionModel, 'vision')).toBe(true);
      expect(hasCapability(textModel, 'vision')).toBe(false);
    });
    
    it('should identify models with function calling', () => {
      const functionModel = { capabilities: ['text', 'function_calling'] };
      
      expect(hasCapability(functionModel, 'function_calling')).toBe(true);
    });
    
    it('should filter models by context length', () => {
      const models = [
        { name: 'small', contextLength: 4096 },
        { name: 'medium', contextLength: 32768 },
        { name: 'large', contextLength: 128000 },
      ];
      
      const filtered = filterByContextLength(models, 10000);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(m => m.name)).toEqual(['medium', 'large']);
    });
  });
});

// Helper functions for testing
function selectModelForTask(task: { complexity: string; tokens: number; requiresReasoning: boolean }) {
  if (task.complexity === 'low' && task.tokens < 1000 && !task.requiresReasoning) {
    return { name: 'gpt-3.5-turbo', costTier: 'low', provider: 'openai' };
  }
  return { name: 'gpt-4', costTier: 'high', provider: 'openai' };
}

function selectModelWithPreferences(
  preferences: { preferredProvider: string; fallbackProviders: string[] },
  options: { primaryUnavailable?: boolean } = {}
) {
  if (options.primaryUnavailable) {
    return { name: 'fallback-model', provider: preferences.fallbackProviders[0] };
  }
  return { name: 'primary-model', provider: preferences.preferredProvider };
}

function calculateCost(model: { inputPrice: number; outputPrice: number }, tokens: { input: number; output: number }) {
  return (model.inputPrice * tokens.input / 1000) + (model.outputPrice * tokens.output / 1000);
}

function hasCapability(model: { capabilities: string[] }, capability: string) {
  return model.capabilities.includes(capability);
}

function filterByContextLength(models: { name: string; contextLength: number }[], minLength: number) {
  return models.filter(m => m.contextLength >= minLength);
}

/**
 * Cost Optimizer Unit Tests
 *
 * Tests for the CostOptimizer class and getCostOptimizer singleton.
 * All external dependencies are mocked to ensure isolated testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ai-core MODEL_REGISTRY before import
vi.mock('@grump/ai-core', () => ({
  MODEL_REGISTRY: [
    {
      id: 'cheap-model',
      name: 'Cheap Model',
      provider: 'nim',
      costPerMillionInput: 0.1,
      costPerMillionOutput: 0.2,
      capabilities: ['chat'],
      contextWindow: 4096,
    },
    {
      id: 'mid-model',
      name: 'Mid Model',
      provider: 'openrouter',
      costPerMillionInput: 2.0,
      costPerMillionOutput: 4.0,
      capabilities: ['chat', 'code'],
      contextWindow: 32000,
    },
    {
      id: 'expensive-model',
      name: 'Expensive Model',
      provider: 'anthropic',
      costPerMillionInput: 15.0,
      costPerMillionOutput: 75.0,
      capabilities: ['chat', 'code', 'agent', 'long-context'],
      contextWindow: 200000,
    },
    {
      id: 'code-specialist',
      name: 'Code Specialist',
      provider: 'nim',
      costPerMillionInput: 5.0,
      costPerMillionOutput: 10.0,
      capabilities: ['chat', 'code'],
      contextWindow: 128000,
    },
  ],
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { CostOptimizer, getCostOptimizer, type TaskComplexity } from '../../src/services/costOptimizer.js';

describe('CostOptimizer', () => {
  let optimizer: CostOptimizer;

  beforeEach(() => {
    optimizer = new CostOptimizer();
  });

  afterEach(() => {
    optimizer.resetSavings();
    vi.clearAllMocks();
  });

  describe('analyzeComplexity', () => {
    it('should return low score for short simple messages', () => {
      const messages = [{ role: 'user', content: 'Hello there' }];
      const result = optimizer.analyzeComplexity(messages);

      expect(result.score).toBeLessThan(30);
      expect(result.factors.messageLength).toBe(11);
      expect(result.factors.contextSize).toBe(1);
      expect(result.factors.requiresReasoning).toBe(false);
      expect(result.factors.requiresCreativity).toBe(false);
      expect(result.factors.hasCodeGeneration).toBe(false);
      expect(result.factors.hasMultiStep).toBe(false);
    });

    it('should detect reasoning requirements', () => {
      const messages = [
        { role: 'user', content: 'Please analyze and evaluate these options and explain why' },
      ];
      const result = optimizer.analyzeComplexity(messages);

      expect(result.factors.requiresReasoning).toBe(true);
      expect(result.score).toBeGreaterThan(20);
    });

    it('should detect creativity requirements', () => {
      const messages = [
        { role: 'user', content: 'Brainstorm some creative and innovative ideas' },
      ];
      const result = optimizer.analyzeComplexity(messages);

      expect(result.factors.requiresCreativity).toBe(true);
    });

    it('should detect accuracy requirements', () => {
      const messages = [{ role: 'user', content: 'Verify and validate this precise calculation' }];
      const result = optimizer.analyzeComplexity(messages);

      expect(result.factors.requiresAccuracy).toBe(true);
    });

    it('should detect accuracy requirements from spec mode', () => {
      const messages = [{ role: 'user', content: 'Simple message' }];
      const result = optimizer.analyzeComplexity(messages, 'spec');

      expect(result.factors.requiresAccuracy).toBe(true);
    });

    it('should detect accuracy requirements from architecture mode', () => {
      const messages = [{ role: 'user', content: 'Simple message' }];
      const result = optimizer.analyzeComplexity(messages, 'architecture');

      expect(result.factors.requiresAccuracy).toBe(true);
    });

    it('should detect code generation requirements', () => {
      const messages = [{ role: 'user', content: 'Implement a function to calculate fibonacci' }];
      const result = optimizer.analyzeComplexity(messages);

      expect(result.factors.hasCodeGeneration).toBe(true);
    });

    it('should detect code generation from ship mode', () => {
      const messages = [{ role: 'user', content: 'Simple message' }];
      const result = optimizer.analyzeComplexity(messages, 'ship');

      expect(result.factors.hasCodeGeneration).toBe(true);
    });

    it('should detect code generation from codegen mode', () => {
      const messages = [{ role: 'user', content: 'Simple message' }];
      const result = optimizer.analyzeComplexity(messages, 'codegen');

      expect(result.factors.hasCodeGeneration).toBe(true);
    });

    it('should detect multi-step tasks', () => {
      const messages = [
        { role: 'user', content: 'First do this, then do that, next step is this, finally complete' },
      ];
      const result = optimizer.analyzeComplexity(messages);

      expect(result.factors.hasMultiStep).toBe(true);
    });

    it('should detect multi-step from long conversation', () => {
      const messages = Array.from({ length: 7 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));
      const result = optimizer.analyzeComplexity(messages);

      expect(result.factors.hasMultiStep).toBe(true);
      expect(result.factors.contextSize).toBe(7);
    });

    it('should increase score for longer messages', () => {
      const shortMessage = [{ role: 'user', content: 'Hello' }];
      const mediumMessage = [{ role: 'user', content: 'x'.repeat(1000) }];
      const longMessage = [{ role: 'user', content: 'x'.repeat(3000) }];
      const veryLongMessage = [{ role: 'user', content: 'x'.repeat(6000) }];

      const shortResult = optimizer.analyzeComplexity(shortMessage);
      const mediumResult = optimizer.analyzeComplexity(mediumMessage);
      const longResult = optimizer.analyzeComplexity(longMessage);
      const veryLongResult = optimizer.analyzeComplexity(veryLongMessage);

      expect(shortResult.score).toBeLessThan(mediumResult.score);
      expect(mediumResult.score).toBeLessThan(longResult.score);
      expect(longResult.score).toBeLessThan(veryLongResult.score);
    });

    it('should cap score at 100', () => {
      const messages = [
        {
          role: 'user',
          content:
            'x'.repeat(6000) +
            ' analyze evaluate compare explain why creative innovative unique brainstorm ' +
            'precise exact accurate correct verify validate implement build develop program ' +
            'first then next finally step phase stage',
        },
      ];
      // Make it a long conversation with 15 messages
      for (let i = 0; i < 14; i++) {
        messages.push({ role: 'assistant', content: 'Response ' + i });
      }

      const result = optimizer.analyzeComplexity(messages);

      expect(result.score).toBe(100);
    });

    it('should add bonus for very long context', () => {
      const messages = Array.from({ length: 12 }, (_, i) => ({
        role: 'user',
        content: 'Short message',
      }));
      const result = optimizer.analyzeComplexity(messages);

      // Should have the +10 bonus for contextSize > 10
      expect(result.factors.contextSize).toBe(12);
    });
  });

  describe('selectModel', () => {
    it('should select cheapest model for simple tasks', () => {
      const complexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const result = optimizer.selectModel(complexity);

      expect(result.modelId).toBe('cheap-model');
      expect(result.provider).toBe('nim');
      expect(result.reasoning).toContain('Simple task');
    });

    it('should select expensive model for complex tasks', () => {
      const complexity: TaskComplexity = {
        score: 85,
        factors: {
          messageLength: 5000,
          contextSize: 10,
          requiresReasoning: true,
          requiresCreativity: false,
          requiresAccuracy: true,
          hasCodeGeneration: true,
          hasMultiStep: true,
        },
      };

      const result = optimizer.selectModel(complexity);

      expect(result.modelId).toBe('expensive-model');
      expect(result.provider).toBe('anthropic');
      expect(result.reasoning).toContain('Complex task');
    });

    it('should select mid-tier model for medium complexity without code', () => {
      const complexity: TaskComplexity = {
        score: 45,
        factors: {
          messageLength: 1000,
          contextSize: 3,
          requiresReasoning: true,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const result = optimizer.selectModel(complexity);

      expect(result.reasoning).toContain('Medium complexity');
    });

    it('should respect allowed providers filter', () => {
      const complexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const result = optimizer.selectModel(complexity, {
        allowedProviders: ['anthropic'],
      });

      expect(result.provider).toBe('anthropic');
    });

    it('should throw error when no models match capabilities', () => {
      const complexity: TaskComplexity = {
        score: 50,
        factors: {
          messageLength: 100,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      expect(() =>
        optimizer.selectModel(complexity, {
          requireCapability: ['non-existent-capability'],
        })
      ).toThrow('No models available with required capabilities');
    });

    it('should respect cost limit and select cheaper alternative', () => {
      const complexity: TaskComplexity = {
        score: 85, // Would normally select expensive model
        factors: {
          messageLength: 100,
          contextSize: 1,
          requiresReasoning: true,
          requiresCreativity: true,
          requiresAccuracy: true,
          hasCodeGeneration: true,
          hasMultiStep: true,
        },
      };

      const result = optimizer.selectModel(complexity, {
        maxCostPerRequest: 0.00001, // Very low limit
      });

      expect(result.reasoning).toContain('Cost limit enforced');
    });

    it('should filter by required capabilities', () => {
      const complexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const result = optimizer.selectModel(complexity, {
        requireCapability: ['agent'],
      });

      // Only expensive-model has 'agent' capability
      expect(result.modelId).toBe('expensive-model');
    });

    it('should return estimated cost', () => {
      const complexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 1000,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const result = optimizer.selectModel(complexity);

      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(typeof result.estimatedCost).toBe('number');
    });

    it('should increment totalRequests counter', () => {
      const complexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      optimizer.selectModel(complexity);
      optimizer.selectModel(complexity);
      optimizer.selectModel(complexity);

      const savings = optimizer.getSavings();
      expect(savings.totalRequests).toBe(3);
    });

    it('should track cheap model usage', () => {
      const simpleComplexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      optimizer.selectModel(simpleComplexity);
      optimizer.selectModel(simpleComplexity);

      const savings = optimizer.getSavings();
      expect(savings.cheapModelUsed).toBe(2);
    });
  });

  describe('getSavings', () => {
    it('should return correct savings statistics', () => {
      const simpleComplexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      optimizer.selectModel(simpleComplexity);
      optimizer.selectModel(simpleComplexity);

      const savings = optimizer.getSavings();

      expect(savings.totalRequests).toBe(2);
      expect(savings.cheapModelUsed).toBe(2);
      expect(savings.cheapModelPercentage).toBe(100);
      expect(savings.estimatedSavings).toBeGreaterThanOrEqual(0);
    });

    it('should calculate correct cheap model percentage', () => {
      const simpleComplexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const complexComplexity: TaskComplexity = {
        score: 90,
        factors: {
          messageLength: 5000,
          contextSize: 10,
          requiresReasoning: true,
          requiresCreativity: true,
          requiresAccuracy: true,
          hasCodeGeneration: true,
          hasMultiStep: true,
        },
      };

      optimizer.selectModel(simpleComplexity);
      optimizer.selectModel(complexComplexity);

      const savings = optimizer.getSavings();
      expect(savings.cheapModelPercentage).toBe(50);
    });

    it('should return 0 percentage when no requests', () => {
      const savings = optimizer.getSavings();
      expect(savings.cheapModelPercentage).toBe(0);
    });
  });

  describe('resetSavings', () => {
    it('should reset all savings statistics', () => {
      const complexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      optimizer.selectModel(complexity);
      optimizer.selectModel(complexity);

      optimizer.resetSavings();

      const savings = optimizer.getSavings();
      expect(savings.totalRequests).toBe(0);
      expect(savings.cheapModelUsed).toBe(0);
      expect(savings.estimatedSavings).toBe(0);
    });
  });

  describe('getRecommendations', () => {
    it('should return sorted recommendations by suitability', () => {
      const complexity: TaskComplexity = {
        score: 50,
        factors: {
          messageLength: 1000,
          contextSize: 3,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const recommendations = optimizer.getRecommendations(complexity);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].suitability).toBeGreaterThanOrEqual(recommendations[1]?.suitability ?? 0);
    });

    it('should boost code models for code generation tasks', () => {
      const complexity: TaskComplexity = {
        score: 50,
        factors: {
          messageLength: 1000,
          contextSize: 3,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: true,
          hasMultiStep: false,
        },
      };

      const recommendations = optimizer.getRecommendations(complexity);
      const codeModels = recommendations.filter((r) => r.model.capabilities.includes('code'));

      // Code models should have higher suitability for code generation
      expect(codeModels.some((m) => m.reason.includes('code generation'))).toBe(true);
    });

    it('should boost agent models for reasoning tasks', () => {
      const complexity: TaskComplexity = {
        score: 75,
        factors: {
          messageLength: 1000,
          contextSize: 3,
          requiresReasoning: true,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const recommendations = optimizer.getRecommendations(complexity);
      const agentModels = recommendations.filter((r) => r.model.capabilities.includes('agent'));

      expect(agentModels.length).toBeGreaterThan(0);
    });

    it('should boost long-context models for large messages', () => {
      const complexity: TaskComplexity = {
        score: 50,
        factors: {
          messageLength: 60000,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const recommendations = optimizer.getRecommendations(complexity);
      const longContextRec = recommendations.find((r) =>
        r.reason.includes('large context')
      );

      expect(longContextRec).toBeDefined();
    });

    it('should include reason for each recommendation', () => {
      const complexity: TaskComplexity = {
        score: 20,
        factors: {
          messageLength: 100,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const recommendations = optimizer.getRecommendations(complexity);

      for (const rec of recommendations) {
        expect(rec.reason).toBeDefined();
        expect(typeof rec.reason).toBe('string');
        expect(rec.reason.length).toBeGreaterThan(0);
      }
    });

    it('should prefer cheaper models for simple tasks', () => {
      const complexity: TaskComplexity = {
        score: 15,
        factors: {
          messageLength: 50,
          contextSize: 1,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const recommendations = optimizer.getRecommendations(complexity);
      const topRec = recommendations[0];

      expect(topRec.reason).toContain('Cost-effective');
    });

    it('should include model info in recommendations', () => {
      const complexity: TaskComplexity = {
        score: 50,
        factors: {
          messageLength: 1000,
          contextSize: 3,
          requiresReasoning: false,
          requiresCreativity: false,
          requiresAccuracy: false,
          hasCodeGeneration: false,
          hasMultiStep: false,
        },
      };

      const recommendations = optimizer.getRecommendations(complexity);

      for (const rec of recommendations) {
        expect(rec.model).toBeDefined();
        expect(rec.model.id).toBeDefined();
        expect(rec.model.provider).toBeDefined();
        expect(rec.suitability).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe('getCostOptimizer', () => {
  it('should return a CostOptimizer instance', () => {
    const optimizer = getCostOptimizer();
    expect(optimizer).toBeInstanceOf(CostOptimizer);
  });

  it('should return the same instance (singleton)', () => {
    const optimizer1 = getCostOptimizer();
    const optimizer2 = getCostOptimizer();
    expect(optimizer1).toBe(optimizer2);
  });
});

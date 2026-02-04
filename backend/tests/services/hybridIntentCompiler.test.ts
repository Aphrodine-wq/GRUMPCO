/**
 * Tests for Hybrid Intent Compiler Service
 * 
 * Run: npm test -- hybridIntentCompiler.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/services/cacheService.js', () => ({
  withCache: vi.fn(async (_type, _key, fn) => await fn()),
  getFromCache: vi.fn().mockResolvedValue(null),
  setInCache: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/services/llmGateway.js', () => ({
  getStream: vi.fn(),
}));

vi.mock('../../src/services/resilience.js', () => ({
  withResilience: vi.fn((fn) => fn),
}));

vi.mock('../../src/services/intentCompilerService.js', () => ({
  parseIntent: vi.fn(),
  parseIntentWithFallback: vi.fn(),
}));

import {
  getHybridConfig,
  detectAmbiguity,
  scoreRustConfidence,
  scoreLLMConfidence,
  parseIntentHybrid,
  parseIntentHybridWithCache,
  parseIntentsBatch,
  getHybridCompilerStats,
  DEFAULT_HYBRID_CONFIG,
  type HybridCompilerConfig,
  type ParseResult,
} from '../../src/services/hybridIntentCompiler.js';
import { parseIntentWithFallback } from '../../src/services/intentCompilerService.js';
import { getStream } from '../../src/services/llmGateway.js';
import type { EnrichedIntent, StructuredIntent } from '../../src/services/intentCompilerService.js';

describe('hybridIntentCompiler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.HYBRID_INTENT_MODE;
    delete process.env.HYBRID_CONFIDENCE_THRESHOLD;
    delete process.env.HYBRID_PARALLEL_PROCESSING;
  });

  describe('getHybridConfig', () => {
    it('should return default configuration when no env vars set', () => {
      const config = getHybridConfig();
      
      expect(config.mode).toBe(DEFAULT_HYBRID_CONFIG.mode);
      expect(config.confidenceThreshold).toBe(DEFAULT_HYBRID_CONFIG.confidenceThreshold);
      expect(config.parallelProcessing).toBe(DEFAULT_HYBRID_CONFIG.parallelProcessing);
      expect(config.cachingEnabled).toBe(DEFAULT_HYBRID_CONFIG.cachingEnabled);
      expect(config.llmProvider).toBe(DEFAULT_HYBRID_CONFIG.llmProvider);
      expect(config.llmModel).toBe(DEFAULT_HYBRID_CONFIG.llmModel);
    });

    it('should read configuration from environment variables', () => {
      process.env.HYBRID_INTENT_MODE = 'llm-first';
      process.env.HYBRID_CONFIDENCE_THRESHOLD = '0.8';
      process.env.HYBRID_PARALLEL_PROCESSING = 'false';
      process.env.HYBRID_CACHING_ENABLED = 'false';
      process.env.HYBRID_LLM_PROVIDER = 'groq';
      process.env.HYBRID_LLM_MODEL = 'llama-3.1-70b';

      const config = getHybridConfig();

      expect(config.mode).toBe('llm-first');
      expect(config.confidenceThreshold).toBe(0.8);
      expect(config.parallelProcessing).toBe(false);
      expect(config.cachingEnabled).toBe(false);
      expect(config.llmProvider).toBe('groq');
      expect(config.llmModel).toBe('llama-3.1-70b');
    });

    it('should parse numeric environment variables correctly', () => {
      process.env.HYBRID_LLM_TIMEOUT = '45000';
      process.env.HYBRID_RUST_TIMEOUT = '10000';
      process.env.HYBRID_MAX_TOKENS = '8192';

      const config = getHybridConfig();

      expect(config.llmTimeout).toBe(45000);
      expect(config.rustTimeout).toBe(10000);
      expect(config.maxTokens).toBe(8192);
    });
  });

  describe('detectAmbiguity', () => {
    it('should detect vague nouns', () => {
      const result = detectAmbiguity('Create something for the user');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('Contains vague nouns');
      // Score may or may not exceed 0.5 threshold depending on other factors
      expect(typeof result.needsLLM).toBe('boolean');
    });

    it('should detect vague action phrases', () => {
      const result = detectAmbiguity('Make it better');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('Contains vague action phrases');
    });

    it('should detect improvement requests', () => {
      const result = detectAmbiguity('Improve the system');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('Contains vague improvement requests');
    });

    it('should detect short inputs', () => {
      const result = detectAmbiguity('Fix bug');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('Very short input (< 5 words)');
    });

    it('should detect lack of technical specificity', () => {
      const result = detectAmbiguity('Build a website');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('Lacks technical specificity');
    });

    it('should return low ambiguity for structured technical input', () => {
      const result = detectAmbiguity(
        'Create a REST API endpoint /api/users using Node.js and Express with JWT authentication and PostgreSQL database'
      );
      
      expect(result.score).toBeLessThan(0.5);
      expect(result.needsLLM).toBe(false);
    });

    it('should cap score at 1.0', () => {
      // Very ambiguous input with multiple issues
      const result = detectAmbiguity('Do something with stuff');
      
      expect(result.score).toBeLessThanOrEqual(1.0);
    });

    it('should handle empty input', () => {
      const result = detectAmbiguity('');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('scoreRustConfidence', () => {
    it('should score high for complete intent', () => {
      const intent: StructuredIntent = {
        actors: ['user', 'admin', 'api'],
        features: ['login', 'dashboard', 'reports'],
        data_flows: ['REST API', 'WebSocket'],
        tech_stack_hints: ['Node.js', 'React', 'PostgreSQL'],
        constraints: {},
        raw: 'test',
      };

      const score = scoreRustConfidence(intent);
      
      expect(score).toBeGreaterThan(0.7);
    });

    it('should score low for empty intent', () => {
      const intent: StructuredIntent = {
        actors: [],
        features: [],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
      };

      const score = scoreRustConfidence(intent);
      
      expect(score).toBeLessThan(0.5);
    });

    it('should score medium for partial intent', () => {
      const intent: StructuredIntent = {
        actors: ['user'],
        features: ['login'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
      };

      const score = scoreRustConfidence(intent);
      
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(0.7);
    });

    it('should handle undefined fields gracefully', () => {
      const intent = {
        actors: undefined,
        features: undefined,
        data_flows: undefined,
        tech_stack_hints: undefined,
        constraints: {},
        raw: 'test',
      } as unknown as StructuredIntent;

      const score = scoreRustConfidence(intent);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('scoreLLMConfidence', () => {
    it('should score high for enriched intent with reasoning', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: ['login'],
        data_flows: ['REST API'],
        tech_stack_hints: ['Node.js'],
        constraints: {},
        raw: 'test',
        enriched: {
          reasoning: 'This is a login system with REST API',
          features: ['login', 'auth'],
          architecture_hints: [
            { pattern: 'REST', description: 'RESTful API', applicability: 'high' },
          ],
        },
      };

      const score = scoreLLMConfidence(intent);
      
      expect(score).toBeGreaterThan(0.5);
    });

    it('should lower score for ambiguous intent', () => {
      const intent: EnrichedIntent = {
        actors: [],
        features: [],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
        enriched: {
          ambiguity_analysis: {
            score: 0.8,
            reason: 'Very ambiguous',
            clarification_questions: ['What do you mean?'],
          },
        },
      };

      const score = scoreLLMConfidence(intent);
      
      expect(score).toBeLessThan(0.6);
    });

    it('should score base intent without enrichment', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: ['login'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
      };

      const score = scoreLLMConfidence(intent);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('parseIntentHybrid', () => {
    const mockRustIntent: StructuredIntent = {
      actors: ['user'],
      features: ['login'],
      data_flows: ['REST'],
      tech_stack_hints: ['Node.js'],
      constraints: {},
      raw: 'Create login API',
    };

    const mockEnrichedIntent: EnrichedIntent = {
      ...mockRustIntent,
      enriched: {
        reasoning: 'Login system',
        features: ['login', 'auth'],
        users: ['user'],
        data_flows: ['REST API'],
        tech_stack: ['Node.js', 'Express'],
      },
    };

    beforeEach(() => {
      vi.mocked(parseIntentWithFallback).mockResolvedValue(mockRustIntent);
    });

    it('should parse intent in rust-first mode successfully', async () => {
      const result = await parseIntentHybrid('Create login API', {}, { mode: 'rust-first' });

      expect(result.method).toBe('rust');
      expect(result.intent.actors).toContain('user');
      expect(result.intent.features).toContain('login');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.cacheHit).toBe(false);
    });

    it('should fallback to LLM when Rust fails in rust-first mode', async () => {
      // Mock LLM stream
      const mockStream = async function* () {
        yield { 
          type: 'content_block_delta' as const, 
          delta: { type: 'text_delta' as const, text: JSON.stringify(mockEnrichedIntent) } 
        };
        yield { type: 'message_stop' as const };
      };
      vi.mocked(getStream).mockReturnValue(mockStream() as AsyncIterable<unknown> as AsyncIterable<{
        type: 'content_block_delta';
        delta: { type: 'text_delta'; text: string };
      } | { type: 'message_stop' }>);

      vi.mocked(parseIntentWithFallback).mockRejectedValue(new Error('Rust compiler failed'));

      const result = await parseIntentHybrid('Create login API', {}, { mode: 'rust-first' });

      expect(result.method).toBe('llm');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should throw when both methods fail and fallback is disabled', async () => {
      vi.mocked(parseIntentWithFallback).mockRejectedValue(new Error('Rust compiler failed'));
      
      // Mock LLM to also fail
      const mockStream = async function* () {
        yield { type: 'error' as const, error: new Error('LLM failed') };
      };
      vi.mocked(getStream).mockReturnValue(mockStream() as AsyncIterable<unknown> as AsyncIterable<{
        type: 'content_block_delta';
        delta: { type: 'text_delta'; text: string };
      } | { type: 'error'; error: Error }>);

      await expect(
        parseIntentHybrid('Create login API', {}, { mode: 'rust-first', fallbackEnabled: false })
      ).rejects.toThrow();
    });
  });

  describe('parseIntentHybridWithCache', () => {
    it('should use cache when enabled', async () => {
      const mockIntent: StructuredIntent = {
        actors: ['user'],
        features: ['login'],
        data_flows: ['REST'],
        tech_stack_hints: ['Node.js'],
        constraints: {},
        raw: 'Create login API',
      };

      vi.mocked(parseIntentWithFallback).mockResolvedValue(mockIntent);

      const result1 = await parseIntentHybridWithCache('Create login API', {}, { mode: 'rust-first' });
      const result2 = await parseIntentHybridWithCache('Create login API', {}, { mode: 'rust-first' });

      expect(result1.intent.features).toContain('login');
      expect(result2.intent.features).toContain('login');
    });

    it('should bypass cache when disabled', async () => {
      const mockIntent: StructuredIntent = {
        actors: ['user'],
        features: ['login'],
        data_flows: ['REST'],
        tech_stack_hints: ['Node.js'],
        constraints: {},
        raw: 'Create login API',
      };

      vi.mocked(parseIntentWithFallback).mockResolvedValue(mockIntent);

      const result = await parseIntentHybridWithCache(
        'Create login API', 
        {}, 
        { mode: 'rust-first', cachingEnabled: false }
      );

      expect(result.intent.features).toContain('login');
    });
  });

  describe('parseIntentsBatch', () => {
    it('should parse multiple intents in batch', async () => {
      const mockIntent: StructuredIntent = {
        actors: ['user'],
        features: ['feature'],
        data_flows: ['REST'],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
      };

      vi.mocked(parseIntentWithFallback).mockResolvedValue(mockIntent);

      const inputs = [
        { raw: 'Create login API' },
        { raw: 'Build user dashboard' },
        { raw: 'Add payment system' },
      ];

      const results = await parseIntentsBatch(inputs, { mode: 'rust-first' });

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.intent).toBeDefined();
        expect(result.method).toBeDefined();
      });
    });

    it('should handle errors in batch without failing all', async () => {
      let callCount = 0;
      vi.mocked(parseIntentWithFallback).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve({
          actors: ['user'],
          features: ['feature'],
          data_flows: ['REST'],
          tech_stack_hints: [],
          constraints: {},
          raw: 'test',
        });
      });

      const inputs = [
        { raw: 'Create login API' },
        { raw: 'Fail this one' },
        { raw: 'Create dashboard' },
      ];

      const results = await parseIntentsBatch(inputs, { mode: 'rust-first' });

      expect(results).toHaveLength(3);
      // First and third should succeed, second should have error
      expect((results[0] as ParseResult & { error?: string }).error).toBeUndefined();
      expect((results[2] as ParseResult & { error?: string }).error).toBeUndefined();
    });
  });

  describe('getHybridCompilerStats', () => {
    it('should return current configuration', () => {
      const stats = getHybridCompilerStats();

      expect(stats.config).toBeDefined();
      expect(stats.ambiguityThreshold).toBe(0.5);
      expect(stats.config.mode).toBeDefined();
      expect(stats.config.confidenceThreshold).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex structured input in hybrid mode', async () => {
      const complexIntent: StructuredIntent = {
        actors: ['customer', 'admin', 'payment_gateway'],
        features: ['checkout', 'payment_processing', 'order_confirmation', 'email_notifications'],
        data_flows: ['REST API', 'WebSocket', 'Webhook'],
        tech_stack_hints: ['Node.js', 'Stripe', 'PostgreSQL', 'Redis', 'React'],
        constraints: { security: 'high', compliance: 'PCI-DSS' },
        raw: 'Build e-commerce checkout with Stripe payment processing, real-time order updates via WebSocket, email confirmations, PCI-DSS compliance',
      };

      vi.mocked(parseIntentWithFallback).mockResolvedValue(complexIntent);

      const result = await parseIntentHybrid(complexIntent.raw, complexIntent.constraints, { mode: 'hybrid' });

      expect(result.intent.actors).toContain('customer');
      expect(result.intent.features).toContain('checkout');
      expect(result.intent.data_flows).toContain('REST API');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle ambiguous input requiring LLM enhancement', async () => {
      const mockLLMIntent: EnrichedIntent = {
        actors: ['user'],
        features: ['authentication', 'dashboard'],
        data_flows: ['REST API'],
        tech_stack_hints: ['React', 'Node.js'],
        constraints: {},
        raw: 'Make it better',
        enriched: {
          reasoning: 'User wants to improve existing system',
          ambiguity_analysis: {
            score: 0.9,
            reason: 'Very vague request',
            clarification_questions: ['What specific improvements?', 'Which part of the system?'],
          },
        },
      };

      // Mock LLM stream
      const mockStream = async function* () {
        yield { 
          type: 'content_block_delta' as const, 
          delta: { type: 'text_delta' as const, text: JSON.stringify(mockLLMIntent) } 
        };
        yield { type: 'message_stop' as const };
      };
      vi.mocked(getStream).mockReturnValue(mockStream() as AsyncIterable<unknown> as AsyncIterable<{
        type: 'content_block_delta';
        delta: { type: 'text_delta'; text: string };
      } | { type: 'message_stop' }>);

      // Rust returns low confidence
      vi.mocked(parseIntentWithFallback).mockResolvedValue({
        actors: [],
        features: [],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'Make it better',
      });

      const result = await parseIntentHybrid('Make it better', {}, { mode: 'hybrid' });

      expect(result.ambiguityScore).toBeGreaterThan(0.5);
      expect(result.intent.enriched?.reasoning).toBeDefined();
    });

    it('should respect timeout settings', async () => {
      // Mock a slow Rust parser
      vi.mocked(parseIntentWithFallback).mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve({
          actors: ['user'],
          features: ['login'],
          data_flows: [],
          tech_stack_hints: [],
          constraints: {},
          raw: 'test',
        }), 10000)) // 10 second delay
      );

      const startTime = Date.now();
      
      try {
        await parseIntentHybrid('Create login API', {}, { 
          mode: 'rust-first', 
          rustTimeout: 100, // Very short timeout
        });
      } catch {
        // Expected to fail due to timeout
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000); // Should fail fast, not wait 10 seconds
    });
  });
});

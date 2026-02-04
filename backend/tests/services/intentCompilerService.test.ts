/**
 * Intent Compiler Service Tests
 * Tests parseIntent, enrichIntentViaLLM, optimizeEnrichedIntent, parseIntentWithFallback, etc.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/services/llmGateway.js', () => ({
  getStream: vi.fn(),
}));

vi.mock('../../src/services/resilience.js', () => ({
  withResilience: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

const mockWithCache = vi.fn((_key: string, _cacheKey: string, fn: () => Promise<unknown>) => fn());
vi.mock('../../src/services/cacheService.js', () => ({
  withCache: (...args: unknown[]) => mockWithCache(...args),
}));

vi.mock('../../src/services/intentCliRunner.js', () => ({
  runIntentCli: vi.fn(),
}));

vi.mock('../../src/services/intentParserWasm.js', () => ({
  parseIntentWasm: vi.fn(),
}));

vi.mock('../../src/db/database.js', () => ({
  getDatabase: vi.fn(() => ({
    getDb: vi.fn(() => ({
      prepare: vi.fn(() => ({
        run: vi.fn(),
      })),
    })),
  })),
}));

import {
  optimizeEnrichedIntent,
  parseIntent,
  parseIntentWithFallback,
  storeIntentCompilerFailure,
  type EnrichedIntent,
  type StructuredIntent,
} from '../../src/services/intentCompilerService.js';
import { runIntentCli } from '../../src/services/intentCliRunner.js';
import { parseIntentWasm } from '../../src/services/intentParserWasm.js';

describe('intentCompilerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('optimizeEnrichedIntent', () => {
    it('should deduplicate and sort actors, features, data_flows, tech_stack_hints', () => {
      const intent: EnrichedIntent = {
        actors: ['admin', 'user', 'user', 'admin'],
        features: ['auth', 'crud', 'auth'],
        data_flows: ['a->b', 'b->a'],
        tech_stack_hints: ['ts', 'node', 'ts'],
        constraints: {},
        raw: 'test',
      };
      const result = optimizeEnrichedIntent(intent);
      expect(result.actors).toEqual(['admin', 'user']);
      expect(result.features).toEqual(['auth', 'crud']);
      expect(result.data_flows).toEqual(['a->b', 'b->a']);
      expect(result.tech_stack_hints).toEqual(['node', 'ts']);
    });

    it('should trim and filter empty strings', () => {
      const intent: EnrichedIntent = {
        actors: ['  user  ', '', 'admin'],
        features: [],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
      };
      const result = optimizeEnrichedIntent(intent);
      expect(result.actors).toEqual(['admin', 'user']);
    });

    it('should merge enriched.features with base features when enriched.features missing', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: ['base-feature'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
        enriched: {},
      };
      const result = optimizeEnrichedIntent(intent);
      expect(result.enriched?.features).toEqual(['base-feature']);
    });

    it('should preserve architecture_hints and optimization_opportunities', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: [],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
        enriched: {
          architecture_hints: [{ pattern: 'REST', description: 'REST API', applicability: 'high' }],
          optimization_opportunities: [
            { area: 'performance', suggestion: 'Use caching', impact: 'high' },
          ],
        },
      };
      const result = optimizeEnrichedIntent(intent);
      expect(result.enriched?.architecture_hints).toHaveLength(1);
      expect(result.enriched?.optimization_opportunities).toHaveLength(1);
    });

    it('should dedupe enriched code_patterns when provided', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: [],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
        enriched: {
          code_patterns: ['REST', 'REST', 'GraphQL'],
        },
      };
      const result = optimizeEnrichedIntent(intent);
      expect(result.enriched?.code_patterns).toEqual(['GraphQL', 'REST']);
    });

    it('should handle null/undefined enriched', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: ['f1'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test',
      };
      const result = optimizeEnrichedIntent(intent);
      expect(result.enriched).toBeDefined();
      expect(result.enriched?.features).toEqual(['f1']);
      expect(result.actors).toEqual(['user']);
      expect(result.features).toEqual(['f1']);
    });
  });

  describe('parseIntent', () => {
    it('should use CLI when WASM is disabled', async () => {
      const prev = process.env.GRUMP_USE_WASM_INTENT;
      process.env.GRUMP_USE_WASM_INTENT = 'false';
      const mockIntent: StructuredIntent = {
        actors: ['user'],
        features: ['test'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'build a todo app',
      };
      vi.mocked(runIntentCli).mockResolvedValue(mockIntent);
      const result = await parseIntent('build a todo app');
      expect(runIntentCli).toHaveBeenCalledWith('build a todo app', undefined);
      expect(result).toEqual(mockIntent);
      process.env.GRUMP_USE_WASM_INTENT = prev;
    });

    it('should use WASM when enabled and return valid result', async () => {
      const prev = process.env.GRUMP_USE_WASM_INTENT;
      process.env.GRUMP_USE_WASM_INTENT = 'true';
      const mockIntent: StructuredIntent = {
        actors: ['user'],
        features: ['todo'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'todo app',
      };
      vi.mocked(parseIntentWasm).mockResolvedValue(mockIntent);
      const result = await parseIntent('todo app');
      expect(parseIntentWasm).toHaveBeenCalledWith('todo app', undefined);
      expect(runIntentCli).not.toHaveBeenCalled();
      expect(result).toEqual(mockIntent);
      process.env.GRUMP_USE_WASM_INTENT = prev;
    });

    it('should fall back to CLI when WASM returns invalid result', async () => {
      const prev = process.env.GRUMP_USE_WASM_INTENT;
      process.env.GRUMP_USE_WASM_INTENT = 'true';
      vi.mocked(parseIntentWasm).mockResolvedValue({} as never);
      const mockIntent: StructuredIntent = {
        actors: ['user'],
        features: [],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'todo',
      };
      vi.mocked(runIntentCli).mockResolvedValue(mockIntent);
      const result = await parseIntent('todo');
      expect(runIntentCli).toHaveBeenCalledWith('todo', undefined);
      expect(result).toEqual(mockIntent);
      process.env.GRUMP_USE_WASM_INTENT = prev;
    });

    it('should fall back to CLI when WASM throws', async () => {
      const prev = process.env.GRUMP_USE_WASM_INTENT;
      process.env.GRUMP_USE_WASM_INTENT = 'true';
      vi.mocked(parseIntentWasm).mockRejectedValue(new Error('WASM error'));
      const mockIntent: StructuredIntent = {
        actors: ['user'],
        features: [],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'todo',
      };
      vi.mocked(runIntentCli).mockResolvedValue(mockIntent);
      const result = await parseIntent('todo');
      expect(runIntentCli).toHaveBeenCalledWith('todo', undefined);
      expect(result).toEqual(mockIntent);
      process.env.GRUMP_USE_WASM_INTENT = prev;
    });
  });

  describe('parseIntentWithFallback', () => {
    it('should return Rust result when CLI succeeds', async () => {
      const { parseIntentWithFallback } = await import('../../src/services/intentCompilerService.js');
      const mockIntent: StructuredIntent = {
        actors: ['user'],
        features: ['auth'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'auth app',
      };
      vi.mocked(runIntentCli).mockResolvedValue(mockIntent);
      const result = await parseIntentWithFallback('auth app');
      expect(result).toEqual(mockIntent);
    });
  });

  describe('parseAndEnrichIntent modes', () => {
    it('should accept mode option', async () => {
      vi.mocked(runIntentCli).mockResolvedValue({
        actors: ['user'],
        features: ['todo'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'todo app',
      });
      vi.mock('../../src/services/llmGateway.js', () => ({ getStream: vi.fn() }));
      const { parseAndEnrichIntent } = await import('../../src/services/intentCompilerService.js');
      const result = await parseAndEnrichIntent('todo app', undefined, { mode: 'rust-first' });
      expect(result).toBeDefined();
      expect(result.actors).toBeDefined();
      expect(mockWithCache).toHaveBeenCalled();
    });
  });

  describe('storeIntentCompilerFailure', () => {
    it('should not throw when storing failure', () => {
      expect(() => {
        storeIntentCompilerFailure(
          'input text',
          'rust error',
          {
            actors: ['user'],
            features: [],
            data_flows: [],
            tech_stack_hints: [],
            constraints: {},
            raw: 'input text',
          }
        );
      }).not.toThrow();
    });
  });
});

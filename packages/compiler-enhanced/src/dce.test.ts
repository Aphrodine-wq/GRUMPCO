/**
 * Tests for Dead Code Elimination
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeadCodeEliminator, createDeadCodeEliminator, treeShakeIntent } from './dce.js';
import type { CompilerConfig, EnrichedIntent } from './types.js';

describe('DeadCodeEliminator', () => {
  let config: CompilerConfig;
  let eliminator: DeadCodeEliminator;

  beforeEach(() => {
    config = {};
    eliminator = createDeadCodeEliminator(config);
  });

  describe('registerIntent', () => {
    it('should register intent with exports', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: ['login', 'logout'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test'
      };

      eliminator.registerIntent('auth', intent, true);
      
      const stats = eliminator.getStats();
      expect(stats.totalIntents).toBe(1);
      expect(stats.totalExports).toBe(2);
    });
  });

  describe('eliminate', () => {
    it('should mark entry point exports as used', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: ['login', 'logout'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test'
      };

      eliminator.registerIntent('auth', intent, true);
      const result = eliminator.eliminate();
      
      expect(result.usedExports).toContain('auth:login');
      expect(result.usedExports).toContain('auth:logout');
    });

    it('should identify unused exports in non-entry intents', () => {
      const authIntent: EnrichedIntent = {
        actors: ['user'],
        features: ['login'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test'
      };

      const utilsIntent: EnrichedIntent = {
        actors: [],
        features: ['hash', 'encrypt'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test'
      };

      eliminator.registerIntent('auth', authIntent, true);
      eliminator.registerIntent('utils', utilsIntent, false);
      
      // Auth imports hash from utils
      eliminator.registerImport('auth', 'utils', ['hash']);
      
      const result = eliminator.eliminate();
      
      // hash is used
      expect(result.usedExports).toContain('utils:hash');
      // encrypt is not used
      expect(result.unusedExports).toContain('utils:encrypt');
    });
  });

  describe('treeShakeIntent', () => {
    it('should filter unused features', () => {
      const intent: EnrichedIntent = {
        actors: ['user'],
        features: ['feature1', 'feature2', 'feature3'],
        data_flows: [],
        tech_stack_hints: [],
        constraints: {},
        raw: 'test'
      };

      const shaken = treeShakeIntent(intent, ['feature1', 'feature3']);
      
      expect(shaken.features).toContain('feature1');
      expect(shaken.features).toContain('feature3');
      expect(shaken.features).not.toContain('feature2');
    });
  });
});

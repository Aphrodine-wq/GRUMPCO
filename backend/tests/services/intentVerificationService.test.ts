import { describe, it, expect } from 'vitest';
import { verifyIntent, VerificationResult } from '../../src/services/intentVerificationService.ts';
import { EnrichedIntent } from '../../src/services/intentCompilerService.ts';

/**
 * Helper to create a valid base EnrichedIntent for testing
 */
function createBaseIntent(overrides?: Partial<EnrichedIntent>): EnrichedIntent {
  return {
    actors: ['user'],
    features: ['login', 'dashboard'],
    data_flows: ['user -> api -> database'],
    tech_stack_hints: ['typescript', 'express'],
    constraints: {},
    raw: 'Build a login page with dashboard',
    enriched: {},
    ...overrides,
  };
}

describe('intentVerificationService', () => {
  describe('verifyIntent', () => {
    describe('valid intent with no issues', () => {
      it('should return valid=true when intent is valid with no issues', async () => {
        const intent = createBaseIntent();

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.clarification).toBeUndefined();
      });

      it('should return valid=true when ambiguity score is 0', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0,
              reason: 'Clear intent',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('should return valid=true when ambiguity score is exactly 0.3', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.3,
              reason: 'Borderline clear',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toEqual([]);
      });
    });

    describe('high ambiguity (score > 0.6)', () => {
      it('should return valid=false when ambiguity score > 0.6 with clarification', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.7,
              reason: 'Intent is unclear about target platform',
              clarification_questions: ['What platform are you targeting?', 'Web or mobile?'],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(false);
        expect(result.clarification).toBeDefined();
        expect(result.clarification?.reason).toBe('Intent is unclear about target platform');
        expect(result.clarification?.questions).toEqual([
          'What platform are you targeting?',
          'Web or mobile?',
        ]);
      });

      it('should use default reason when reason is not provided', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.8,
              reason: '',
              clarification_questions: ['Please clarify'],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(false);
        expect(result.clarification?.reason).toBe('Intent is too ambiguous');
      });

      it('should use provided empty array when clarification_questions is empty', async () => {
        // The || operator treats [] as truthy, so empty array is preserved
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.9,
              reason: 'Very ambiguous',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(false);
        // Empty array is truthy, so it's used as-is (not the fallback)
        expect(result.clarification?.questions).toEqual([]);
      });

      it('should use default question when clarification_questions is undefined', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.9,
              reason: 'Very ambiguous',
              clarification_questions: undefined as unknown as string[],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(false);
        expect(result.clarification?.questions).toEqual(['Can you be more specific?']);
      });

      it('should use default reason but preserve empty questions array', async () => {
        // Empty string is falsy (triggers default), but empty array is truthy (preserved)
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 1.0,
              reason: '',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(false);
        expect(result.clarification?.reason).toBe('Intent is too ambiguous');
        // Empty array is truthy, so it's preserved
        expect(result.clarification?.questions).toEqual([]);
      });

      it('should use both defaults when reason and questions are undefined', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 1.0,
              reason: undefined as unknown as string,
              clarification_questions: undefined as unknown as string[],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(false);
        expect(result.clarification?.reason).toBe('Intent is too ambiguous');
        expect(result.clarification?.questions).toEqual(['Can you be more specific?']);
      });

      it('should return early when ambiguity is too high', async () => {
        // Even with other issues (no features, React in stack), high ambiguity returns immediately
        const intent = createBaseIntent({
          features: [],
          tech_stack_hints: ['react'],
          enriched: {
            features: [],
            ambiguity_analysis: {
              score: 0.65,
              reason: 'Unclear',
              clarification_questions: ['What do you mean?'],
            },
          },
        });

        const result = await verifyIntent(intent);

        // Should return early without checking other conditions
        expect(result.valid).toBe(false);
        expect(result.warnings).toEqual([]); // No warnings because we returned early
        expect(result.clarification).toBeDefined();
      });
    });

    describe('moderate ambiguity (score > 0.3 but <= 0.6)', () => {
      it('should add warning when ambiguity score > 0.3 but <= 0.6', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.4,
              reason: 'Could use more details about UI preferences',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Intent is slightly ambiguous: Could use more details about UI preferences'
        );
      });

      it('should add warning when ambiguity score is exactly 0.6', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.6,
              reason: 'Borderline ambiguous',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Intent is slightly ambiguous: Borderline ambiguous');
      });

      it('should add warning at score 0.31', async () => {
        const intent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.31,
              reason: 'Just above threshold',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Intent is slightly ambiguous: Just above threshold');
      });
    });

    describe('no features identified', () => {
      it('should add warning when no features in both intent.features and enriched.features', async () => {
        const intent = createBaseIntent({
          features: [],
          enriched: {
            features: [],
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('No specific features identified.');
      });

      it('should add warning when features arrays are undefined', async () => {
        const intent: EnrichedIntent = {
          actors: ['user'],
          features: [],
          data_flows: [],
          tech_stack_hints: [],
          constraints: {},
          raw: 'hello',
          enriched: {},
        };

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('No specific features identified.');
      });

      it('should not warn when intent.features has items', async () => {
        const intent = createBaseIntent({
          features: ['authentication'],
          enriched: {
            features: [],
          },
        });

        const result = await verifyIntent(intent);

        expect(result.warnings).not.toContain('No specific features identified.');
      });

      it('should not warn when enriched.features has items', async () => {
        const intent = createBaseIntent({
          features: [],
          enriched: {
            features: ['user-management'],
          },
        });

        const result = await verifyIntent(intent);

        expect(result.warnings).not.toContain('No specific features identified.');
      });
    });

    describe('React in tech stack', () => {
      it('should add warning when React mentioned in enriched.tech_stack', async () => {
        const intent = createBaseIntent({
          enriched: {
            tech_stack: ['react', 'typescript'],
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });

      it('should add warning when React mentioned in tech_stack_hints', async () => {
        const intent = createBaseIntent({
          tech_stack_hints: ['React', 'Node.js'],
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });

      it('should add warning for case-insensitive React match', async () => {
        const intent = createBaseIntent({
          tech_stack_hints: ['REACT'],
        });

        const result = await verifyIntent(intent);

        expect(result.warnings).toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });

      it('should add warning when React is part of a larger string', async () => {
        const intent = createBaseIntent({
          tech_stack_hints: ['react-native'],
        });

        const result = await verifyIntent(intent);

        expect(result.warnings).toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });

      it('should not warn when no React in stack', async () => {
        const intent = createBaseIntent({
          tech_stack_hints: ['svelte', 'vite'],
          enriched: {
            tech_stack: ['tailwind', 'express'],
          },
        });

        const result = await verifyIntent(intent);

        expect(result.warnings).not.toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });

      it('should prefer enriched.tech_stack over tech_stack_hints when both exist', async () => {
        const intent = createBaseIntent({
          tech_stack_hints: ['svelte'], // no react here
          enriched: {
            tech_stack: ['react'], // react here
          },
        });

        const result = await verifyIntent(intent);

        // Should check enriched.tech_stack first
        expect(result.warnings).toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });

      it('should fall back to tech_stack_hints when enriched.tech_stack is undefined', async () => {
        const intent = createBaseIntent({
          tech_stack_hints: ['react'],
          enriched: {},
        });

        const result = await verifyIntent(intent);

        expect(result.warnings).toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });

      it('should handle empty tech stack arrays', async () => {
        const intent = createBaseIntent({
          tech_stack_hints: [],
          enriched: {
            tech_stack: [],
          },
        });

        const result = await verifyIntent(intent);

        expect(result.warnings).not.toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });

      it('should fall back to empty array when both tech stacks are undefined', async () => {
        // This tests the final fallback: || []
        const intent: EnrichedIntent = {
          actors: ['user'],
          features: ['feature1'],
          data_flows: [],
          tech_stack_hints: undefined as unknown as string[],
          constraints: {},
          raw: 'test',
          enriched: {
            // tech_stack is undefined
          },
        };

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).not.toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });
    });

    describe('multiple warnings', () => {
      it('should accumulate multiple warnings', async () => {
        const intent = createBaseIntent({
          features: [],
          tech_stack_hints: ['react'],
          enriched: {
            features: [],
            ambiguity_analysis: {
              score: 0.5,
              reason: 'Somewhat unclear',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(3);
        expect(result.warnings).toContain('Intent is slightly ambiguous: Somewhat unclear');
        expect(result.warnings).toContain('No specific features identified.');
        expect(result.warnings).toContain(
          'Intent mentions React, but verify if this project supports it.'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle undefined enriched object', async () => {
        const intent: EnrichedIntent = {
          actors: ['user'],
          features: ['feature1'],
          data_flows: [],
          tech_stack_hints: [],
          constraints: {},
          raw: 'test',
        };

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should handle undefined ambiguity_analysis', async () => {
        const intent = createBaseIntent({
          enriched: {
            features: ['login'],
            // no ambiguity_analysis
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
      });

      it('should handle null-like values gracefully', async () => {
        const intent = createBaseIntent({
          features: [],
          tech_stack_hints: [],
          enriched: {
            features: [],
            tech_stack: [],
            ambiguity_analysis: {
              score: 0.1,
              reason: '',
              clarification_questions: [],
            },
          },
        });

        const result = await verifyIntent(intent);

        expect(result.valid).toBe(true);
        // Should have warning for no features
        expect(result.warnings).toContain('No specific features identified.');
      });
    });

    describe('return type structure', () => {
      it('should always return correct VerificationResult structure', async () => {
        const intent = createBaseIntent();

        const result = await verifyIntent(intent);

        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('warnings');
        expect(typeof result.valid).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });

      it('should include clarification only when invalid due to ambiguity', async () => {
        const validIntent = createBaseIntent();
        const invalidIntent = createBaseIntent({
          enriched: {
            ambiguity_analysis: {
              score: 0.8,
              reason: 'Too vague',
              clarification_questions: ['Please elaborate'],
            },
          },
        });

        const validResult = await verifyIntent(validIntent);
        const invalidResult = await verifyIntent(invalidIntent);

        expect(validResult.clarification).toBeUndefined();
        expect(invalidResult.clarification).toBeDefined();
        expect(invalidResult.clarification).toHaveProperty('reason');
        expect(invalidResult.clarification).toHaveProperty('questions');
      });
    });
  });
});

/**
 * Intent Optimizer UI utils tests
 */

import { describe, it, expect } from 'vitest';
import { buildOptimizedDescription } from './intentOptimizer';

describe('intentOptimizer', () => {
  describe('buildOptimizedDescription', () => {
    it('returns original when optimized has no extra content', () => {
      const result = {
        optimized: {
          features: [],
          constraints: [],
          nonFunctionalRequirements: [],
          reasoning: '',
          techStack: [],
          actors: [],
          dataFlows: [],
          ambiguity: { score: 0, reason: '', ambiguousAreas: [] },
          clarifications: [],
          confidence: 0.9,
        },
        original: 'Build a todo app',
        confidence: 0.9,
        metadata: { processingTime: 100, model: 'test', mode: 'architecture' as const },
      };
      expect(buildOptimizedDescription(result)).toBe('Build a todo app');
    });

    it('appends features when present', () => {
      const result = {
        optimized: {
          features: ['auth', 'CRUD', 'tests'],
          constraints: [],
          nonFunctionalRequirements: [],
          reasoning: '',
          techStack: [],
          actors: [],
          dataFlows: [],
          ambiguity: { score: 0, reason: '', ambiguousAreas: [] },
          clarifications: [],
          confidence: 0.9,
        },
        original: 'Todo app',
        confidence: 0.9,
        metadata: { processingTime: 100, model: 'test', mode: 'architecture' as const },
      };
      expect(buildOptimizedDescription(result)).toContain('Todo app');
      expect(buildOptimizedDescription(result)).toContain('Features: auth, CRUD, tests');
    });

    it('appends constraints when present', () => {
      const result = {
        optimized: {
          features: [],
          constraints: [
            {
              type: 'technical' as const,
              description: 'Use TypeScript',
              priority: 'must' as const,
              impact: 'type safety',
            },
            {
              type: 'business' as const,
              description: 'Launch in Q2',
              priority: 'should' as const,
              impact: 'timeline',
            },
          ],
          nonFunctionalRequirements: [],
          reasoning: '',
          techStack: [],
          actors: [],
          dataFlows: [],
          ambiguity: { score: 0, reason: '', ambiguousAreas: [] },
          clarifications: [],
          confidence: 0.9,
        },
        original: 'SaaS platform',
        confidence: 0.85,
        metadata: { processingTime: 80, model: 'test', mode: 'codegen' as const },
      };
      const out = buildOptimizedDescription(result);
      expect(out).toContain('SaaS platform');
      expect(out).toContain('Constraints: Use TypeScript; Launch in Q2');
    });

    it('appends NFRs when present', () => {
      const result = {
        optimized: {
          features: [],
          constraints: [],
          nonFunctionalRequirements: [
            {
              category: 'performance' as const,
              requirement: 'Response < 200ms',
              priority: 'high' as const,
            },
            {
              category: 'security' as const,
              requirement: 'HTTPS only',
              priority: 'critical' as const,
            },
          ],
          reasoning: '',
          techStack: [],
          actors: [],
          dataFlows: [],
          ambiguity: { score: 0, reason: '', ambiguousAreas: [] },
          clarifications: [],
          confidence: 0.9,
        },
        original: 'API service',
        confidence: 0.9,
        metadata: { processingTime: 90, model: 'test', mode: 'architecture' as const },
      };
      const out = buildOptimizedDescription(result);
      expect(out).toContain('NFRs: Response < 200ms; HTTPS only');
    });

    it('appends reasoning when present', () => {
      const result = {
        optimized: {
          features: ['f1'],
          constraints: [],
          nonFunctionalRequirements: [],
          reasoning: 'Recommended microservices for scale.',
          techStack: [],
          actors: [],
          dataFlows: [],
          ambiguity: { score: 0, reason: '', ambiguousAreas: [] },
          clarifications: [],
          confidence: 0.9,
        },
        original: 'E-commerce backend',
        confidence: 0.9,
        metadata: { processingTime: 100, model: 'test', mode: 'architecture' as const },
      };
      const out = buildOptimizedDescription(result);
      expect(out).toContain('Recommended microservices for scale.');
    });

    it('combines all sections when fully populated', () => {
      const result = {
        optimized: {
          features: ['auth', 'payments'],
          constraints: [
            {
              type: 'technical' as const,
              description: 'PostgreSQL',
              priority: 'must' as const,
              impact: 'data',
            },
          ],
          nonFunctionalRequirements: [
            {
              category: 'scalability' as const,
              requirement: 'Horizontal scaling',
              priority: 'high' as const,
            },
          ],
          reasoning: 'E-commerce best practices.',
          techStack: [],
          actors: [],
          dataFlows: [],
          ambiguity: { score: 0, reason: '', ambiguousAreas: [] },
          clarifications: [],
          confidence: 0.95,
        },
        original: 'Online store',
        confidence: 0.95,
        metadata: { processingTime: 120, model: 'test', mode: 'architecture' as const },
      };
      const out = buildOptimizedDescription(result);
      expect(out).toContain('Online store');
      expect(out).toContain('Features: auth, payments');
      expect(out).toContain('Constraints: PostgreSQL');
      expect(out).toContain('NFRs: Horizontal scaling');
      expect(out).toContain('E-commerce best practices.');
    });
  });
});

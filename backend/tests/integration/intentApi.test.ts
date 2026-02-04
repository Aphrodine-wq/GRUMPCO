/**
 * Intent API integration tests.
 * Tests POST /api/intent/parse (intent routes) and POST /api/intent/optimize (intent-optimizer feature).
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.NVIDIA_NIM_API_KEY = 'test_key';

vi.mock('../../src/services/intentCompilerService.js', () => ({
  parseAndEnrichIntent: vi.fn().mockResolvedValue({
    raw: 'test app',
    features: ['f1'],
    actors: [],
    data_flows: [],
    tech_stack_hints: [],
    constraints: {},
  }),
}));

const mockOptimizeIntentWithMetadata = vi.fn().mockResolvedValue({
  optimized: {
    features: ['posts', 'comments'],
    constraints: [],
    nonFunctionalRequirements: [],
    techStack: [],
    actors: [],
    dataFlows: [],
    ambiguity: { score: 0.2, reason: 'Clear', ambiguousAreas: [] },
    reasoning: 'Structured for architecture',
    clarifications: [],
    confidence: 0.9,
  },
  original: 'Build a blog',
  confidence: 0.9,
  metadata: { processingTime: 100, model: 'kimi-k2.5', mode: 'architecture' },
});

vi.mock('../../src/features/intent-optimizer/intentOptimizer.js', () => ({
  optimizeIntentWithMetadata: (...args: unknown[]) =>
    mockOptimizeIntentWithMetadata(...args),
}));

const intentOptimizerRoutes = (await import('../../src/features/intent-optimizer/routes.js')).default;
const intentRoutes = (await import('../../src/routes/intent.js')).default;

const app: Express = express();
app.use(express.json());
// Intent-optimizer first (handles /optimize); intent routes handle /parse
app.use('/api/intent', intentOptimizerRoutes);
app.use('/api/intent', intentRoutes);

describe('Intent API', () => {
  describe('POST /api/intent/parse', () => {
    it('returns 400 when raw is missing', async () => {
      const res = await request(app)
        .post('/api/intent/parse')
        .send({})
        .expect(400);
      expect(res.body.type).toBe('validation_error');
      expect(res.body.error).toContain('raw');
    });

    it('returns 400 when raw is not a string', async () => {
      const res = await request(app)
        .post('/api/intent/parse')
        .send({ raw: 123 })
        .expect(400);
      expect(res.body.type).toBe('validation_error');
    });

    it('returns 200 with enriched intent when raw is valid', async () => {
      const res = await request(app)
        .post('/api/intent/parse')
        .send({ raw: 'A todo app with auth' })
        .expect(200);
      expect(res.body).toHaveProperty('raw');
      expect(res.body).toHaveProperty('features');
    });
  });

  describe('POST /api/intent/optimize (intent-optimizer feature)', () => {
    it('returns 400 when intent is missing', async () => {
      const res = await request(app)
        .post('/api/intent/optimize')
        .send({ mode: 'architecture' })
        .expect(400);
      expect(res.body.type).toBe('validation_error');
      expect(res.body.error).toContain('intent');
    });

    it('returns 400 when intent is not a string', async () => {
      const res = await request(app)
        .post('/api/intent/optimize')
        .send({ intent: 123, mode: 'codegen' })
        .expect(400);
      expect(res.body.type).toBe('validation_error');
    });

    it('returns 400 when mode is missing or invalid', async () => {
      const res = await request(app)
        .post('/api/intent/optimize')
        .send({ intent: 'Build a blog' })
        .expect(400);
      expect(res.body.type).toBe('validation_error');

      const res2 = await request(app)
        .post('/api/intent/optimize')
        .send({ intent: 'Build a blog', mode: 'invalid' })
        .expect(400);
      expect(res2.body.type).toBe('validation_error');
    });

    it('returns 200 with optimized intent when intent and mode are valid', async () => {
      const res = await request(app)
        .post('/api/intent/optimize')
        .send({ intent: 'Build a blog', mode: 'architecture' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.optimized).toBeDefined();
      expect(res.body.data.optimized.features).toEqual(['posts', 'comments']);
      expect(res.body.data.original).toBe('Build a blog');
      expect(res.body.data.confidence).toBe(0.9);
      expect(mockOptimizeIntentWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: 'Build a blog',
          mode: 'architecture',
        })
      );
    });

    it('returns 200 with optimized intent for codegen mode', async () => {
      mockOptimizeIntentWithMetadata.mockResolvedValueOnce({
        optimized: {
          features: ['CRUD', 'auth'],
          constraints: [],
          nonFunctionalRequirements: [],
          techStack: [],
          actors: [],
          dataFlows: [],
          ambiguity: { score: 0.1, reason: 'Clear', ambiguousAreas: [] },
          reasoning: 'Structured for codegen',
          clarifications: [],
          confidence: 0.85,
        },
        original: 'Todo app',
        confidence: 0.85,
        metadata: { processingTime: 80, model: 'kimi-k2.5', mode: 'codegen' },
      });

      const res = await request(app)
        .post('/api/intent/optimize')
        .send({ intent: 'Todo app', mode: 'codegen' })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.optimized.features).toContain('CRUD');
      expect(res.body.data.metadata.mode).toBe('codegen');
    });
  });
});

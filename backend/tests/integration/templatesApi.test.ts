/**
 * Templates API integration tests.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';

const templatesRoutes = (await import('../../src/routes/templates.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/templates', templatesRoutes);

describe('Templates API', () => {
  describe('GET /api/templates', () => {
    it('returns 200 with templates array', async () => {
      const res = await request(app).get('/api/templates').expect(200);
      expect(res.body).toHaveProperty('templates');
      expect(Array.isArray(res.body.templates)).toBe(true);
    });

    it('accepts query and tags params', async () => {
      const res = await request(app)
        .get('/api/templates')
        .query({ q: 'blog', tags: 'web' })
        .expect(200);
      expect(res.body).toHaveProperty('templates');
    });
  });

  describe('GET /api/templates/:id', () => {
    it('returns 404 for unknown template', async () => {
      await request(app).get('/api/templates/nonexistent-id').expect(404);
    });

    it('returns 200 for existing template', async () => {
      const res = await request(app).get('/api/templates/rest-api-node').expect(200);
      expect(res.body).toHaveProperty('id', 'rest-api-node');
      expect(res.body).toHaveProperty('name');
    });
  });
});

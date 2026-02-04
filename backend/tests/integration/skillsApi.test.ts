/**
 * Skills API integration tests.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';

const skillsApiRoutes = (await import('../../src/routes/skillsApi.js')).default;
const app: Express = express();
app.use(express.json());
app.use('/api/skills-api', skillsApiRoutes);

describe('Skills API', () => {
  describe('POST /api/skills-api/generate-skill-md', () => {
    it('returns 400 when description missing', async () => {
      const res = await request(app)
        .post('/api/skills-api/generate-skill-md')
        .send({})
        .expect(400);
      expect(res.body.error).toContain('description');
    });

    it('returns 400 when description is not a string', async () => {
      await request(app)
        .post('/api/skills-api/generate-skill-md')
        .send({ description: 123 })
        .expect(400);
    });

    it('returns 200 with SKILL.md content', async () => {
      const res = await request(app)
        .post('/api/skills-api/generate-skill-md')
        .send({ description: 'Refactor TypeScript code' })
        .expect(200);
      expect(res.body).toHaveProperty('content');
      expect(res.body.content).toContain('# Skill:');
      expect(res.body.content).toContain('Refactor TypeScript code');
      expect(res.body.content).toContain('When to use');
      expect(res.body.content).toContain('Steps');
      expect(res.body.content).toContain('Rules');
    });
  });
});

/**
 * Codegen routes smoke tests: status and download return consistent error shape for CLI/UI.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

process.env.ANTHROPIC_API_KEY = 'test_key_for_codegen_routes';
process.env.NODE_ENV = 'test';

const { default: app, appReady } = await import('../../src/index.js');

describe('Codegen routes', () => {
  beforeAll(async () => {
    await appReady;
  });

  describe('GET /api/codegen/status/:sessionId', () => {
    it('returns 404 with type not_found when session does not exist', async () => {
      const res = await request(app)
        .get('/api/codegen/status/nonexistent-session-id-12345')
        .expect(404);

      expect(res.body).toMatchObject({
        error: 'Session not found',
        type: 'not_found',
      });
    });
  });

  describe('GET /api/codegen/download/:sessionId', () => {
    it('returns 404 with type not_found when session does not exist', async () => {
      const res = await request(app)
        .get('/api/codegen/download/nonexistent-session-id-12345')
        .expect(404);

      expect(res.body).toMatchObject({
        error: 'Session not found',
        type: 'not_found',
      });
    });
  });
});

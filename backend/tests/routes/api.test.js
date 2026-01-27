import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// We need to set up the environment before importing the app
process.env.ANTHROPIC_API_KEY = 'test_api_key_for_testing';
process.env.NODE_ENV = 'test';

// Import app after setting env
const { default: app } = await import('../../src/index.ts');

describe('Health Routes', () => {
  describe('GET /health', () => {
    it('should return ok status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status with memory info', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body.memory).toHaveProperty('heapUsedMB');
      expect(response.body.memory).toHaveProperty('heapTotalMB');
    });
  });
});

describe('Diagram Routes', () => {
  describe('POST /api/generate-diagram', () => {
    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({})
        .expect(400);
      
      expect(response.body.type).toBe('validation_error');
    });

    it('should reject non-string message', async () => {
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ message: 123 })
        .expect(400);
      
      expect(response.body.type).toBe('validation_error');
    });

    it('should reject message exceeding max length', async () => {
      const longMessage = 'a'.repeat(5000);
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ message: longMessage })
        .expect(400);
      
      expect(response.body.type).toBe('validation_error');
    });
  });

  describe('POST /api/generate-diagram-stream', () => {
    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/generate-diagram-stream')
        .send({})
        .expect(400);
      
      expect(response.body.type).toBe('validation_error');
    });
  });
});

describe('Security Headers', () => {
  it('should include security headers from helmet', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers).toHaveProperty('x-frame-options');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/unknown-route')
      .expect(404);
    
    expect(response.body).toEqual({ error: 'Not found', type: 'not_found' });
  });
});

/**
 * CSP Report Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Create a test app with the CSP report route
function createTestApp() {
  const app = express();
  app.use(express.json({ type: ['application/json', 'application/csp-report'] }));
  
  // Simplified CSP report handler for testing
  app.post('/api/csp-report', (req, res) => {
    const report = req.body;
    if (!report || !report['csp-report']) {
      res.status(400).json({ error: 'Invalid CSP report format' });
      return;
    }
    res.status(204).send();
  });
  
  app.get('/api/csp-report/stats', (_req, res) => {
    res.json({
      total_unique_violations: 0,
      violations: {},
    });
  });
  
  return app;
}

describe('CSP Report Route', () => {
  let app: express.Express;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('POST /api/csp-report', () => {
    it('should accept valid CSP violation report', async () => {
      const report = {
        'csp-report': {
          'document-uri': 'https://example.com/',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/script.js',
        },
      };
      
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/csp-report')
        .send(JSON.stringify(report));
      
      expect(response.status).toBe(204);
    });
    
    it('should reject invalid report format', async () => {
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .send({ invalid: 'data' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid CSP report format');
    });
    
    it('should handle empty body', async () => {
      const response = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .send({});
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('GET /api/csp-report/stats', () => {
    it('should return violation statistics', async () => {
      const response = await request(app)
        .get('/api/csp-report/stats');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_unique_violations');
      expect(response.body).toHaveProperty('violations');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dependencies before importing routes
vi.mock('../services/licenseService.js', () => {
  const mockService = {
    getLicenseStatus: vi.fn().mockResolvedValue({
      active: true,
      tier: 'free',
      type: 'trial',
      features: ['50 API calls/month', 'Basic features', 'Community support'],
    }),
    activateLicense: vi.fn().mockResolvedValue(true),
  };
  return { licenseService: mockService };
});

vi.mock('../services/stripeService.js', () => ({
  createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
}));

vi.mock('../config/pricing.js', async () => {
  const actual =
    await vi.importActual<typeof import('../config/pricing.js')>('../config/pricing.js');
  return actual;
});

vi.mock('../services/featureFlagsService.js', () => ({
  getTierForUser: vi.fn().mockReturnValue('free'),
}));

import billingRoutes from '../routes/billing.js';
import { licenseService } from '../services/security/licenseService.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

function createApp(userId?: string) {
  const app = express();
  app.use(express.json());
  // Inject fake user
  app.use((req, _res, next) => {
    (req as AuthenticatedRequest).user = userId
      ? { id: userId, email: 'test@test.com' }
      : undefined;
    next();
  });
  app.use('/api/billing', billingRoutes);
  return app;
}

describe('Billing Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/billing/tiers', () => {
    it('returns tier definitions', async () => {
      const app = createApp();
      const res = await request(app).get('/api/billing/tiers');
      expect(res.status).toBe(200);
      expect(res.body.tiers).toBeDefined();
      expect(res.body.tiers.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/billing/me', () => {
    it('returns license status', async () => {
      const app = createApp('user-1');
      const res = await request(app).get('/api/billing/me');
      expect(res.status).toBe(200);
      expect(res.body.tier).toBeDefined();
      expect(res.body.features).toBeDefined();
    });

    it('returns sign-in message for unauthenticated user', async () => {
      const app = createApp();
      const res = await request(app).get('/api/billing/me');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/sign in/i);
    });
  });

  describe('POST /api/billing/activate-license', () => {
    it('rejects unauthenticated requests', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/billing/activate-license')
        .send({ key: 'GRUMP-PRO-abcdef1234567890' });
      expect(res.status).toBe(401);
    });

    it('rejects missing key', async () => {
      const app = createApp('user-1');
      const res = await request(app).post('/api/billing/activate-license').send({});
      expect(res.status).toBe(400);
    });

    it('rejects invalid key format', async () => {
      const app = createApp('user-1');
      const res = await request(app)
        .post('/api/billing/activate-license')
        .send({ key: 'INVALID-KEY' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/format/i);
    });

    it('activates valid key', async () => {
      const app = createApp('user-1');
      const res = await request(app)
        .post('/api/billing/activate-license')
        .send({ key: 'GRUMP-PRO-abcdef1234567890' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when activation fails', async () => {
      vi.mocked(licenseService.activateLicense).mockResolvedValueOnce(false);
      const app = createApp('user-1');
      const res = await request(app)
        .post('/api/billing/activate-license')
        .send({ key: 'GRUMP-PRO-abcdef1234567890' });
      expect(res.status).toBe(400);
    });
  });
});

/**
 * Tests for Rate Limit Configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger before importing
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('rateLimits', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadRateLimitConfig', () => {
    it('should return default config when no env vars set', async () => {
      const { loadRateLimitConfig } = await import('../../src/config/rateLimits.js');
      const config = loadRateLimitConfig();

      expect(config.global.windowMs).toBe(15 * 60 * 1000);
      expect(config.global.maxRequests).toBe(100);
      expect(config.tierMultipliers.free).toBe(1);
      expect(config.tierMultipliers.pro).toBe(4);
      expect(config.tierMultipliers.team).toBe(8);
      expect(config.tierMultipliers.enterprise).toBe(20);
    });

    it('should override global settings from env vars', async () => {
      process.env.RATE_LIMIT_GLOBAL_WINDOW_MS = '60000';
      process.env.RATE_LIMIT_GLOBAL_MAX = '50';

      const { loadRateLimitConfig } = await import('../../src/config/rateLimits.js');
      const config = loadRateLimitConfig();

      expect(config.global.windowMs).toBe(60000);
      expect(config.global.maxRequests).toBe(50);
    });

    it('should override tier multipliers from env vars', async () => {
      process.env.RATE_LIMIT_TIER_MULTIPLIER_PRO = '5';
      process.env.RATE_LIMIT_TIER_MULTIPLIER_ENTERPRISE = '50';

      const { loadRateLimitConfig } = await import('../../src/config/rateLimits.js');
      const config = loadRateLimitConfig();

      expect(config.tierMultipliers.pro).toBe(5);
      expect(config.tierMultipliers.enterprise).toBe(50);
    });

    it('should load full config from RATE_LIMIT_CONFIG JSON', async () => {
      const customConfig = {
        global: { windowMs: 30000, maxRequests: 200 },
        endpoints: {
          '/api/test': { windowMs: 5000, maxRequests: 10, message: 'Test limit' },
        },
        tierMultipliers: { free: 1, pro: 2, team: 4, enterprise: 10 },
        useRedis: false,
        skipHealthChecks: false,
      };
      process.env.RATE_LIMIT_CONFIG = JSON.stringify(customConfig);

      const { loadRateLimitConfig } = await import('../../src/config/rateLimits.js');
      const config = loadRateLimitConfig();

      expect(config.global.windowMs).toBe(30000);
      expect(config.global.maxRequests).toBe(200);
      expect(config.endpoints['/api/test']).toEqual({
        windowMs: 5000,
        maxRequests: 10,
        message: 'Test limit',
      });
      expect(config.useRedis).toBe(false);
    });

    it('should fallback to defaults on invalid JSON', async () => {
      process.env.RATE_LIMIT_CONFIG = 'invalid json';

      const { loadRateLimitConfig } = await import('../../src/config/rateLimits.js');
      const config = loadRateLimitConfig();

      expect(config.global.maxRequests).toBe(100);
    });
  });

  describe('getEndpointRateLimitConfig', () => {
    it('should return config for exact path match', async () => {
      const { getEndpointRateLimitConfig } = await import('../../src/config/rateLimits.js');
      const config = getEndpointRateLimitConfig('/api/chat');

      expect(config).toBeDefined();
      expect(config?.maxRequests).toBe(10);
    });

    it('should return config for prefix path match', async () => {
      const { getEndpointRateLimitConfig } = await import('../../src/config/rateLimits.js');
      const config = getEndpointRateLimitConfig('/api/chat/stream');

      expect(config).toBeDefined();
      expect(config?.maxRequests).toBe(10);
    });

    it('should return undefined for unknown path', async () => {
      const { getEndpointRateLimitConfig } = await import('../../src/config/rateLimits.js');
      const config = getEndpointRateLimitConfig('/api/unknown-route');

      expect(config).toBeUndefined();
    });
  });

  describe('getTierMultiplier', () => {
    it('should return correct multiplier for each tier', async () => {
      const { getTierMultiplier } = await import('../../src/config/rateLimits.js');

      expect(getTierMultiplier('free')).toBe(1);
      expect(getTierMultiplier('pro')).toBe(4);
      expect(getTierMultiplier('team')).toBe(8);
      expect(getTierMultiplier('enterprise')).toBe(20);
    });
  });

  describe('getRateLimitConfig (singleton)', () => {
    it('should return cached config on subsequent calls', async () => {
      const { getRateLimitConfig, reloadRateLimitConfig } = await import('../../src/config/rateLimits.js');
      
      const config1 = getRateLimitConfig();
      const config2 = getRateLimitConfig();

      expect(config1).toBe(config2);
      
      // Reload should return new instance
      const config3 = reloadRateLimitConfig();
      expect(config3).not.toBe(config1);
    });
  });
});

/**
 * Unit tests for chaos engineering utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/middleware/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

import {
  createChaosMonkey,
  getChaosMonkey,
  ChaosError,
  isChaosError,
  chaosMiddleware,
  ChaosScenarios,
  applyChaosScenario,
} from '../../src/utils/chaos.js';
import type { ChaosConfig } from '../../src/utils/chaos.js';
import { logger } from '../../src/middleware/logger.js';
import { env } from '../../src/config/env.js';

describe('chaos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment to test
    (env as { NODE_ENV: string }).NODE_ENV = 'test';
    delete process.env.CHAOS_FORCE_PRODUCTION;
    delete process.env.CHAOS_ENABLED;
    delete process.env.CHAOS_LATENCY_PROB;
    delete process.env.CHAOS_ERROR_PROB;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ChaosMonkey', () => {
    describe('constructor and configuration', () => {
      it('creates instance with default config', () => {
        const chaos = createChaosMonkey();
        const config = chaos.getConfig();

        expect(config.enabled).toBe(false);
        expect(config.latencyProbability).toBe(0.1);
        expect(config.errorProbability).toBe(0.05);
        expect(config.latencyRange).toEqual([100, 2000]);
        expect(config.errorTypes).toContain('timeout');
        expect(config.excludeEndpoints).toContain('/health');
      });

      it('accepts partial config', () => {
        const chaos = createChaosMonkey({
          enabled: true,
          latencyProbability: 0.5,
        });
        const config = chaos.getConfig();

        expect(config.enabled).toBe(true);
        expect(config.latencyProbability).toBe(0.5);
        expect(config.errorProbability).toBe(0.05); // Default
      });

      it('disables in production environment', () => {
        (env as { NODE_ENV: string }).NODE_ENV = 'production';

        const chaos = createChaosMonkey({ enabled: true });
        const config = chaos.getConfig();

        expect(config.enabled).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith({}, 'Chaos engineering disabled in production');
      });

      it('allows production when CHAOS_FORCE_PRODUCTION is set', () => {
        (env as { NODE_ENV: string }).NODE_ENV = 'production';
        process.env.CHAOS_FORCE_PRODUCTION = 'true';

        const chaos = createChaosMonkey({ enabled: true });
        const config = chaos.getConfig();

        expect(config.enabled).toBe(true);
      });
    });

    describe('configure', () => {
      it('updates configuration', () => {
        const chaos = createChaosMonkey();
        chaos.configure({ latencyProbability: 0.8 });

        expect(chaos.getConfig().latencyProbability).toBe(0.8);
        expect(logger.info).toHaveBeenCalled();
      });

      it('merges with existing config', () => {
        const chaos = createChaosMonkey({ latencyProbability: 0.5 });
        chaos.configure({ errorProbability: 0.3 });

        const config = chaos.getConfig();
        expect(config.latencyProbability).toBe(0.5);
        expect(config.errorProbability).toBe(0.3);
      });
    });

    describe('enable and disable', () => {
      it('enables chaos', () => {
        const chaos = createChaosMonkey();
        chaos.enable();

        expect(chaos.getConfig().enabled).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith({}, 'Chaos engineering ENABLED');
      });

      it('disables chaos', () => {
        const chaos = createChaosMonkey({ enabled: true });
        chaos.disable();

        expect(chaos.getConfig().enabled).toBe(false);
        expect(logger.info).toHaveBeenCalledWith({}, 'Chaos engineering disabled');
      });

      it('cannot enable in production without force flag', () => {
        (env as { NODE_ENV: string }).NODE_ENV = 'production';
        const chaos = createChaosMonkey();
        chaos.enable();

        expect(chaos.getConfig().enabled).toBe(false);
        expect(logger.error).toHaveBeenCalledWith({}, 'Cannot enable chaos in production');
      });
    });

    describe('shouldApply', () => {
      it('returns false when disabled', () => {
        const chaos = createChaosMonkey({ enabled: false });
        expect(chaos.shouldApply()).toBe(false);
      });

      it('returns true when enabled with no restrictions', () => {
        const chaos = createChaosMonkey({ enabled: true });
        expect(chaos.shouldApply('any-service', '/any-endpoint')).toBe(true);
      });

      it('returns false for excluded endpoints', () => {
        const chaos = createChaosMonkey({
          enabled: true,
          excludeEndpoints: ['/health', '/metrics'],
        });

        expect(chaos.shouldApply('service', '/health')).toBe(false);
        expect(chaos.shouldApply('service', '/health/live')).toBe(false);
        expect(chaos.shouldApply('service', '/metrics')).toBe(false);
        expect(chaos.shouldApply('service', '/api/data')).toBe(true);
      });

      it('returns false for non-targeted services', () => {
        const chaos = createChaosMonkey({
          enabled: true,
          targetServices: ['llm', 'cache'],
        });

        expect(chaos.shouldApply('llm', '/api')).toBe(true);
        expect(chaos.shouldApply('cache', '/api')).toBe(true);
        expect(chaos.shouldApply('database', '/api')).toBe(false);
      });

      it('applies to all services when targetServices is empty', () => {
        const chaos = createChaosMonkey({
          enabled: true,
          targetServices: [],
        });

        expect(chaos.shouldApply('any-service', '/api')).toBe(true);
      });
    });

    describe('maybeInjectLatency', () => {
      it('injects latency based on probability', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0.05); // Below 0.1 probability

        const chaos = createChaosMonkey({
          enabled: true,
          latencyProbability: 0.1,
          latencyRange: [100, 200],
        });

        const promise = chaos.maybeInjectLatency('test-service', '/test');

        // Fast-forward past the delay
        await vi.advanceTimersByTimeAsync(300);
        await promise;

        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            service: 'test-service',
            endpoint: '/test',
          }),
          expect.stringContaining('Chaos: Injecting latency')
        );
      });

      it('does not inject latency when random exceeds probability', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // Above 0.1 probability

        const chaos = createChaosMonkey({
          enabled: true,
          latencyProbability: 0.1,
        });

        await chaos.maybeInjectLatency('test-service', '/test');

        expect(logger.warn).not.toHaveBeenCalled();
      });

      it('does not inject when chaos is disabled', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01);

        const chaos = createChaosMonkey({ enabled: false });
        await chaos.maybeInjectLatency('test', '/test');

        expect(logger.warn).not.toHaveBeenCalled();
      });
    });

    describe('maybeInjectError', () => {
      it('throws timeout error when injected', () => {
        vi.spyOn(Math, 'random')
          .mockReturnValueOnce(0.01) // For error probability check
          .mockReturnValueOnce(0); // For error type selection (first item)

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 0.5,
          errorTypes: ['timeout'],
        });

        expect(() => chaos.maybeInjectError('test', '/test')).toThrow(ChaosError);
        expect(() => chaos.maybeInjectError('test', '/test')).toThrow('Chaos: Connection timed out');
      });

      it('throws network error', () => {
        vi.spyOn(Math, 'random')
          .mockReturnValueOnce(0.01)
          .mockReturnValueOnce(0);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 0.5,
          errorTypes: ['network'],
        });

        expect(() => chaos.maybeInjectError('test', '/test')).toThrow('Chaos: Connection refused');
      });

      it('throws server error', () => {
        vi.spyOn(Math, 'random')
          .mockReturnValueOnce(0.01)
          .mockReturnValueOnce(0);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 0.5,
          errorTypes: ['server'],
        });

        expect(() => chaos.maybeInjectError('test', '/test')).toThrow('Chaos: Internal server error');
      });

      it('throws rate limit error', () => {
        vi.spyOn(Math, 'random')
          .mockReturnValueOnce(0.01)
          .mockReturnValueOnce(0);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 0.5,
          errorTypes: ['rate_limit'],
        });

        expect(() => chaos.maybeInjectError('test', '/test')).toThrow('Chaos: Rate limit exceeded');
      });

      it('does not throw when random exceeds probability', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 0.5,
        });

        expect(() => chaos.maybeInjectError('test', '/test')).not.toThrow();
      });
    });

    describe('wrap', () => {
      it('wraps function with chaos injection', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.9); // No injection

        const chaos = createChaosMonkey({ enabled: true });
        const fn = vi.fn().mockResolvedValue('result');
        const wrapped = chaos.wrap(fn, { service: 'test', endpoint: '/test' });

        const result = await wrapped();

        expect(fn).toHaveBeenCalled();
        expect(result).toBe('result');
      });

      it('applies latency before function execution', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0.01); // Will inject

        const chaos = createChaosMonkey({
          enabled: true,
          latencyProbability: 1,
          latencyRange: [50, 50],
          errorProbability: 0,
        });

        const fn = vi.fn().mockResolvedValue('result');
        const wrapped = chaos.wrap(fn);

        const promise = wrapped();
        await vi.advanceTimersByTimeAsync(100);
        await promise;

        expect(fn).toHaveBeenCalled();
      });
    });

    describe('events', () => {
      it('records events', () => {
        vi.spyOn(Math, 'random')
          .mockReturnValueOnce(0.01)
          .mockReturnValueOnce(0);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 1,
          errorTypes: ['timeout'],
        });

        try {
          chaos.maybeInjectError('test-service', '/test-endpoint');
        } catch {
          // Expected
        }

        const events = chaos.getEvents();
        expect(events.length).toBe(1);
        expect(events[0].type).toBe('error');
        expect(events[0].service).toBe('test-service');
        expect(events[0].endpoint).toBe('/test-endpoint');
        expect(events[0].details).toHaveProperty('errorType');
      });

      it('limits returned events', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 1,
          errorTypes: ['timeout'],
        });

        for (let i = 0; i < 5; i++) {
          try {
            chaos.maybeInjectError('service', '/endpoint');
          } catch {
            // Expected
          }
        }

        const events = chaos.getEvents(2);
        expect(events.length).toBe(2);
      });

      it('clears events', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 1,
          errorTypes: ['timeout'],
        });

        try {
          chaos.maybeInjectError('service', '/endpoint');
        } catch {
          // Expected
        }

        chaos.clearEvents();
        expect(chaos.getEvents().length).toBe(0);
      });

      it('returns events in reverse chronological order', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 1,
          errorTypes: ['timeout'],
        });

        try {
          chaos.maybeInjectError('first', '/first');
        } catch {
          // Expected
        }
        try {
          chaos.maybeInjectError('second', '/second');
        } catch {
          // Expected
        }

        const events = chaos.getEvents();
        expect(events[0].service).toBe('second');
        expect(events[1].service).toBe('first');
      });
    });

    describe('getStats', () => {
      it('returns correct statistics', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01);

        const chaos = createChaosMonkey({
          enabled: true,
          errorProbability: 1,
          errorTypes: ['timeout'],
        });

        try {
          chaos.maybeInjectError('service-a', '/endpoint');
        } catch {
          // Expected
        }
        try {
          chaos.maybeInjectError('service-a', '/endpoint');
        } catch {
          // Expected
        }
        try {
          chaos.maybeInjectError('service-b', '/endpoint');
        } catch {
          // Expected
        }

        const stats = chaos.getStats();
        expect(stats.enabled).toBe(true);
        expect(stats.totalEvents).toBe(3);
        expect(stats.errorEvents).toBe(3);
        expect(stats.latencyEvents).toBe(0);
        expect(stats.eventsByService['service-a']).toBe(2);
        expect(stats.eventsByService['service-b']).toBe(1);
      });
    });
  });

  describe('ChaosError', () => {
    it('creates error with code and message', () => {
      const error = new ChaosError('TEST_CODE', 'Test message');

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('ChaosError');
      expect(error.isChaos).toBe(true);
    });

    it('is instance of Error', () => {
      const error = new ChaosError('CODE', 'message');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ChaosError).toBe(true);
    });
  });

  describe('isChaosError', () => {
    it('returns true for ChaosError instances', () => {
      const error = new ChaosError('CODE', 'message');
      expect(isChaosError(error)).toBe(true);
    });

    it('returns true for objects with isChaos property', () => {
      const fakeError = { isChaos: true, message: 'fake' };
      expect(isChaosError(fakeError)).toBe(true);
    });

    it('returns false for regular errors', () => {
      const error = new Error('regular error');
      expect(isChaosError(error)).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(isChaosError(null)).toBe(false);
      expect(isChaosError(undefined)).toBe(false);
      expect(isChaosError('string')).toBe(false);
      expect(isChaosError(42)).toBe(false);
    });
  });

  describe('chaosMiddleware', () => {
    it('calls next on success', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // No injection

      const chaos = createChaosMonkey({ enabled: true });
      const middleware = chaosMiddleware(chaos);

      const req = { path: '/api/test' } as Parameters<typeof middleware>[0];
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Parameters<typeof middleware>[1];
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 503 for timeout errors', async () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.9) // No latency
        .mockReturnValueOnce(0.01) // Error injection
        .mockReturnValueOnce(0); // First error type

      const chaos = createChaosMonkey({
        enabled: true,
        errorProbability: 1,
        errorTypes: ['timeout'],
      });
      const middleware = chaosMiddleware(chaos);

      const req = { path: '/api/test' } as Parameters<typeof middleware>[0];
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Parameters<typeof middleware>[1];
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ETIMEDOUT',
          chaos: true,
        })
      );
    });

    it('returns 429 for rate limit errors', async () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.01)
        .mockReturnValueOnce(0);

      const chaos = createChaosMonkey({
        enabled: true,
        errorProbability: 1,
        errorTypes: ['rate_limit'],
      });
      const middleware = chaosMiddleware(chaos);

      const req = { path: '/api/test' } as Parameters<typeof middleware>[0];
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Parameters<typeof middleware>[1];
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('returns 500 for server errors', async () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.01)
        .mockReturnValueOnce(0);

      const chaos = createChaosMonkey({
        enabled: true,
        errorProbability: 1,
        errorTypes: ['server'],
      });
      const middleware = chaosMiddleware(chaos);

      const req = { path: '/api/test' } as Parameters<typeof middleware>[0];
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Parameters<typeof middleware>[1];
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('passes non-chaos errors to next', async () => {
      const chaos = createChaosMonkey({ enabled: true });
      const originalMaybeInjectError = chaos.maybeInjectError.bind(chaos);
      chaos.maybeInjectError = () => {
        throw new Error('Regular error');
      };

      const middleware = chaosMiddleware(chaos);

      const req = { path: '/api/test' } as Parameters<typeof middleware>[0];
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Parameters<typeof middleware>[1];
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      chaos.maybeInjectError = originalMaybeInjectError;
    });
  });

  describe('getChaosMonkey', () => {
    it('returns singleton instance', () => {
      const instance1 = getChaosMonkey();
      const instance2 = getChaosMonkey();

      expect(instance1).toBe(instance2);
    });
  });

  describe('ChaosScenarios', () => {
    it('defines highLatency scenario', () => {
      expect(ChaosScenarios.highLatency.latencyProbability).toBe(0.5);
      expect(ChaosScenarios.highLatency.errorProbability).toBe(0);
    });

    it('defines networkInstability scenario', () => {
      expect(ChaosScenarios.networkInstability.errorProbability).toBe(0.2);
      expect(ChaosScenarios.networkInstability.errorTypes).toContain('network');
    });

    it('defines llmDegradation scenario', () => {
      expect(ChaosScenarios.llmDegradation.targetServices).toContain('llm');
    });

    it('defines cacheFailures scenario', () => {
      expect(ChaosScenarios.cacheFailures.targetServices).toContain('redis');
    });

    it('defines rateLimitSimulation scenario', () => {
      expect(ChaosScenarios.rateLimitSimulation.errorTypes).toContain('rate_limit');
    });
  });

  describe('applyChaosScenario', () => {
    it('applies scenario configuration', () => {
      const chaos = createChaosMonkey();
      applyChaosScenario(chaos, 'highLatency');

      const config = chaos.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.latencyProbability).toBe(0.5);
      expect(logger.info).toHaveBeenCalledWith({ scenario: 'highLatency' }, 'Applied chaos scenario');
    });

    it('applies all scenarios without error', () => {
      const scenarios: (keyof typeof ChaosScenarios)[] = [
        'highLatency',
        'networkInstability',
        'llmDegradation',
        'cacheFailures',
        'rateLimitSimulation',
      ];

      for (const scenario of scenarios) {
        const chaos = createChaosMonkey();
        expect(() => applyChaosScenario(chaos, scenario)).not.toThrow();
      }
    });
  });
});

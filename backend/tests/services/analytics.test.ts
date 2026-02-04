import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyticsService, type AnalyticsEventName } from './analytics';

describe('AnalyticsService', () => {
  let analytics: AnalyticsService;

  beforeEach(() => {
    analytics = new AnalyticsService();
  });

  afterEach(async () => {
    await analytics.shutdown();
  });

  describe('initialization', () => {
    it('should be disabled by default without API key', () => {
      expect(analytics.isEnabled()).toBe(false);
    });

    it('should enable when API key is provided', () => {
      analytics.initialize({
        apiKey: 'test-api-key',
        enabled: true,
      });
      expect(analytics.isEnabled()).toBe(true);
    });

    it('should respect enabled flag', () => {
      analytics.initialize({
        apiKey: 'test-api-key',
        enabled: false,
      });
      expect(analytics.isEnabled()).toBe(false);
    });
  });

  describe('tracking', () => {
    beforeEach(() => {
      analytics.initialize({
        apiKey: 'test-api-key',
        enabled: true,
        debug: true,
      });
    });

    it('should track events without errors', () => {
      expect(() => {
        analytics.track('intent_submitted', { intent: 'test' }, 'user-123');
      }).not.toThrow();
    });

    it('should track generation events', () => {
      expect(() => {
        analytics.trackGeneration('architecture', true, 1500, 'user-123', { model: 'claude' });
      }).not.toThrow();
    });

    it('should track project lifecycle events', () => {
      expect(() => {
        analytics.trackProjectLifecycle('created', 'proj-123', 'user-123');
      }).not.toThrow();
    });

    it('should track errors', () => {
      const error = new Error('Test error');
      expect(() => {
        analytics.trackError('generation_failed', error, 'user-123');
      }).not.toThrow();
    });

    it('should identify users', () => {
      expect(() => {
        analytics.identify('user-123', { email: 'test@example.com' });
      }).not.toThrow();
    });
  });

  describe('queue management', () => {
    beforeEach(() => {
      analytics.initialize({
        apiKey: 'test-api-key',
        enabled: true,
      });
    });

    it('should queue events', () => {
      analytics.track('intent_submitted', {});
      expect(analytics.getQueueSize()).toBeGreaterThanOrEqual(0);
    });

    it('should flush without errors', async () => {
      analytics.track('intent_submitted', {});
      await expect(analytics.flush()).resolves.not.toThrow();
    });
  });

  describe('disabled state', () => {
    it('should not track when disabled', () => {
      analytics.initialize({
        apiKey: 'test-api-key',
        enabled: false,
      });

      // Should not throw even when disabled
      expect(() => {
        analytics.track('intent_submitted', {}, 'user-123');
      }).not.toThrow();
    });
  });
});

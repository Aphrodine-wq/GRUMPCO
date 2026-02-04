import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analytics, isAnalyticsReady, currentUser } from './analytics';
import { get } from 'svelte/store';

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true,
}));

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn((key, options) => {
      options?.loaded?.({} as typeof import('posthog-js'));
    }),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
  },
}));

describe('Frontend Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analytics.reset();
  });

  describe('initialization', () => {
    it('should initialize with API key', () => {
      analytics.initialize({
        apiKey: 'test-api-key',
        debug: true,
      });

      expect(analytics.isInitialized()).toBe(true);
      expect(get(isAnalyticsReady)).toBe(true);
    });

    it('should not initialize without API key', () => {
      analytics.initialize({
        apiKey: '',
      });

      expect(analytics.isInitialized()).toBe(false);
    });
  });

  describe('tracking', () => {
    beforeEach(() => {
      analytics.initialize({
        apiKey: 'test-api-key',
        debug: true,
      });
    });

    it('should track events', () => {
      expect(() => {
        analytics.track('intent_submitted', { test: true });
      }).not.toThrow();
    });

    it('should track page views', () => {
      expect(() => {
        analytics.pageView('test_page');
      }).not.toThrow();
    });

    it('should track button clicks', () => {
      expect(() => {
        analytics.buttonClick('submit_button');
      }).not.toThrow();
    });

    it('should track feature discovery', () => {
      expect(() => {
        analytics.featureDiscovered('new_feature');
      }).not.toThrow();
    });

    it('should identify users', () => {
      analytics.identify('user-123', { email: 'test@example.com' });

      const user = get(currentUser);
      expect(user?.id).toBe('user-123');
    });

    it('should reset user on logout', () => {
      analytics.identify('user-123');
      analytics.reset();

      const user = get(currentUser);
      expect(user).toBeNull();
    });
  });

  describe('timing', () => {
    beforeEach(() => {
      analytics.initialize({
        apiKey: 'test-api-key',
      });
    });

    it('should track operation timing', () => {
      const stopTiming = analytics.startTiming('test_operation');

      // Small delay
      const duration = stopTiming();

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate session duration', () => {
      const duration = analytics.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('opt out', () => {
    beforeEach(() => {
      analytics.initialize({
        apiKey: 'test-api-key',
      });
    });

    it('should allow users to opt out', () => {
      expect(() => {
        analytics.optOut();
      }).not.toThrow();
    });

    it('should allow users to opt in', () => {
      expect(() => {
        analytics.optIn();
      }).not.toThrow();
    });
  });
});

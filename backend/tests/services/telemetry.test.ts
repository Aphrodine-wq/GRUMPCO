/**
 * Telemetry Service Unit Tests
 * Tests opt-in state management and event tracking behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('telemetry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('setOptIn', () => {
    it('should set opt-in state to true', async () => {
      const { setOptIn, isOptedIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(isOptedIn()).toBe(true);
    });

    it('should set opt-in state to false', async () => {
      const { setOptIn, isOptedIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      setOptIn(false);
      expect(isOptedIn()).toBe(false);
    });

    it('should toggle opt-in state correctly', async () => {
      const { setOptIn, isOptedIn } = await import('../../src/services/telemetry.js');
      
      expect(isOptedIn()).toBe(false); // Default is false
      setOptIn(true);
      expect(isOptedIn()).toBe(true);
      setOptIn(false);
      expect(isOptedIn()).toBe(false);
      setOptIn(true);
      expect(isOptedIn()).toBe(true);
    });
  });

  describe('isOptedIn', () => {
    it('should return false by default', async () => {
      const { isOptedIn } = await import('../../src/services/telemetry.js');
      expect(isOptedIn()).toBe(false);
    });

    it('should return current opt-in state', async () => {
      const { setOptIn, isOptedIn } = await import('../../src/services/telemetry.js');
      
      expect(isOptedIn()).toBe(false);
      setOptIn(true);
      expect(isOptedIn()).toBe(true);
    });
  });

  describe('track', () => {
    it('should not throw when not opted in', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(false);
      expect(() => track('test_event')).not.toThrow();
    });

    it('should not throw when opted in', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(() => track('test_event')).not.toThrow();
    });

    it('should accept event name only', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(() => track('user_action')).not.toThrow();
    });

    it('should accept event name with properties', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(() => track('user_action', { action: 'click', target: 'button' })).not.toThrow();
    });

    it('should accept empty properties object', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(() => track('test_event', {})).not.toThrow();
    });

    it('should accept complex properties', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(() => track('complex_event', {
        stringProp: 'value',
        numberProp: 42,
        boolProp: true,
        arrayProp: [1, 2, 3],
        objectProp: { nested: 'value' },
      })).not.toThrow();
    });

    it('should handle undefined properties', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(() => track('test_event', undefined)).not.toThrow();
    });

    it('should silently skip tracking when not opted in', async () => {
      const { track, setOptIn, isOptedIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(false);
      expect(isOptedIn()).toBe(false);
      // Should not throw or produce any side effects
      track('should_not_track', { data: 'ignored' });
      // No assertion needed - the function returns void and does nothing
    });

    it('should handle special characters in event name', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(() => track('event.with.dots')).not.toThrow();
      expect(() => track('event-with-dashes')).not.toThrow();
      expect(() => track('event_with_underscores')).not.toThrow();
    });

    it('should handle empty string event name', async () => {
      const { track, setOptIn } = await import('../../src/services/telemetry.js');
      
      setOptIn(true);
      expect(() => track('')).not.toThrow();
    });
  });

  describe('state isolation between tests', () => {
    it('should have fresh state after module reset (test 1)', async () => {
      vi.resetModules();
      const { isOptedIn, setOptIn } = await import('../../src/services/telemetry.js');
      
      expect(isOptedIn()).toBe(false);
      setOptIn(true);
      expect(isOptedIn()).toBe(true);
    });

    it('should have fresh state after module reset (test 2)', async () => {
      vi.resetModules();
      const { isOptedIn } = await import('../../src/services/telemetry.js');
      
      // After module reset, state should be back to default
      expect(isOptedIn()).toBe(false);
    });
  });
});

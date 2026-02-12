/**
 * Analytics Tests
 *
 * Comprehensive tests for analytics tracking utilities including
 * event tracking, user identification, and session management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  track,
  trackScreenView,
  trackMessageSent,
  trackDiagramGenerated,
  trackError,
  trackFeedback,
  trackTemplateUsed,
  trackAction,
  trackSessionResume,
  trackSetupComplete,
  trackSetupSkipped,
  getSessionDuration,
  getEventLog,
  resetAnalyticsState,
  type AnalyticsEvent,
} from './analytics';

// Mock the api module
vi.mock('./api.js', () => ({
  fetchApi: vi.fn().mockResolvedValue({ ok: true }),
}));

import { fetchApi } from './api.js';

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyticsState();
    vi.stubGlobal('console', {
      warn: vi.fn(),
      log: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('track', () => {
    it('should track an event with name', () => {
      track('test_event');

      const events = getEventLog();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('test_event');
    });

    it('should track an event with properties', () => {
      track('test_event', { key: 'value', number: 42 });

      const events = getEventLog();
      expect(events[0].properties).toEqual({ key: 'value', number: 42 });
    });

    it('should add timestamp to events', () => {
      const before = Date.now();
      track('test_event');
      const after = Date.now();

      const events = getEventLog();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should store multiple events', () => {
      track('event1');
      track('event2');
      track('event3');

      const events = getEventLog();
      expect(events).toHaveLength(3);
      expect(events.map((e) => e.name)).toEqual(['event1', 'event2', 'event3']);
    });

    it('should send events to backend', async () => {
      track('test_event', { test: true });

      // Wait for async sendToBackend
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/analytics/events',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test_event'),
        })
      );
    });

    it('should fail silently when backend fails', async () => {
      mockFetchApi.mockRejectedValue(new Error('Network error'));

      expect(() => track('test_event')).not.toThrow();

      // Wait for async sendToBackend
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Event should still be logged locally
      const events = getEventLog();
      expect(events).toHaveLength(1);
    });

    it('should not send in non-browser environment', async () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      track('test_event');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetchApi).not.toHaveBeenCalled();

      global.window = originalWindow;
    });
  });

  describe('trackScreenView', () => {
    it('should track screen view event', () => {
      trackScreenView('settings');

      const events = getEventLog();
      expect(events[0].name).toBe('screen_view');
      expect(events[0].properties).toEqual({ screen: 'settings' });
    });

    it('should track different screens', () => {
      trackScreenView('home');
      trackScreenView('chat');
      trackScreenView('diagram');

      const events = getEventLog();
      expect(events.map((e) => e.properties?.screen)).toEqual(['home', 'chat', 'diagram']);
    });
  });

  describe('trackMessageSent', () => {
    it('should track message sent event', () => {
      trackMessageSent(100);

      const events = getEventLog();
      expect(events[0].name).toBe('message_sent');
      expect(events[0].properties?.messageLength).toBe(100);
    });

    it('should include session duration', () => {
      trackMessageSent(50);

      const events = getEventLog();
      expect(events[0].properties?.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track different message lengths', () => {
      trackMessageSent(0);
      trackMessageSent(100);
      trackMessageSent(1000);

      const events = getEventLog();
      expect(events.map((e) => e.properties?.messageLength)).toEqual([0, 100, 1000]);
    });
  });

  describe('trackDiagramGenerated', () => {
    it('should track diagram generated event', () => {
      trackDiagramGenerated('flowchart', true);

      const events = getEventLog();
      const diagramEvent = events.find((e) => e.name === 'diagram_generated');
      expect(diagramEvent).toBeDefined();
      expect(diagramEvent?.properties?.diagramType).toBe('flowchart');
      expect(diagramEvent?.properties?.success).toBe(true);
    });

    it('should track failed diagram generation', () => {
      trackDiagramGenerated('sequence', false);

      const events = getEventLog();
      const diagramEvent = events.find((e) => e.name === 'diagram_generated');
      expect(diagramEvent?.properties?.success).toBe(false);
    });

    it('should track first diagram event', () => {
      trackDiagramGenerated('flowchart', true);

      const events = getEventLog();
      const firstDiagramEvent = events.find((e) => e.name === 'first_diagram');

      expect(firstDiagramEvent).toBeDefined();
      expect(firstDiagramEvent?.properties?.timeToFirstDiagram).toBeGreaterThanOrEqual(0);
    });

    it('should not track first diagram twice', () => {
      trackDiagramGenerated('flowchart', true);
      trackDiagramGenerated('sequence', true);

      const events = getEventLog();
      const firstDiagramEvents = events.filter((e) => e.name === 'first_diagram');

      expect(firstDiagramEvents).toHaveLength(1);
    });

    it('should not track first diagram on failure', () => {
      trackDiagramGenerated('flowchart', false);

      const events = getEventLog();
      const firstDiagramEvent = events.find((e) => e.name === 'first_diagram');

      expect(firstDiagramEvent).toBeUndefined();
    });

    it('should include session duration', () => {
      trackDiagramGenerated('er', true);

      const events = getEventLog();
      const diagramEvent = events.find((e) => e.name === 'diagram_generated');
      expect(diagramEvent?.properties?.sessionDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trackError', () => {
    it('should track error event', () => {
      trackError('API_ERROR', 'Failed to fetch data');

      const events = getEventLog();
      expect(events[0].name).toBe('error');
      expect(events[0].properties?.errorType).toBe('API_ERROR');
      expect(events[0].properties?.errorMessage).toBe('Failed to fetch data');
    });

    it('should include session duration', () => {
      trackError('TEST_ERROR', 'Test');

      const events = getEventLog();
      expect(events[0].properties?.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should track different error types', () => {
      trackError('NETWORK_ERROR', 'Connection failed');
      trackError('VALIDATION_ERROR', 'Invalid input');

      const events = getEventLog();
      expect(events.map((e) => e.properties?.errorType)).toEqual([
        'NETWORK_ERROR',
        'VALIDATION_ERROR',
      ]);
    });
  });

  describe('trackFeedback', () => {
    it('should track positive feedback', () => {
      trackFeedback('diagram-123', true);

      const events = getEventLog();
      expect(events[0].name).toBe('feedback');
      expect(events[0].properties?.diagramId).toBe('diagram-123');
      expect(events[0].properties?.helpful).toBe(true);
    });

    it('should track negative feedback', () => {
      trackFeedback('diagram-456', false);

      const events = getEventLog();
      expect(events[0].properties?.helpful).toBe(false);
    });

    it('should track feedback with comment', () => {
      trackFeedback('diagram-789', true, 'Great diagram!');

      const events = getEventLog();
      expect(events[0].properties?.comment).toBe('Great diagram!');
    });

    it('should track feedback without comment', () => {
      trackFeedback('diagram-123', true);

      const events = getEventLog();
      expect(events[0].properties?.comment).toBeUndefined();
    });
  });

  describe('trackTemplateUsed', () => {
    it('should track template usage', () => {
      trackTemplateUsed('user-flow');

      const events = getEventLog();
      expect(events[0].name).toBe('template_used');
      expect(events[0].properties?.templateType).toBe('user-flow');
    });

    it('should track different templates', () => {
      trackTemplateUsed('er-diagram');
      trackTemplateUsed('sequence-diagram');

      const events = getEventLog();
      expect(events.map((e) => e.properties?.templateType)).toEqual([
        'er-diagram',
        'sequence-diagram',
      ]);
    });
  });

  describe('trackAction', () => {
    it('should track generic action', () => {
      trackAction('button_click', 'submit-btn');

      const events = getEventLog();
      expect(events[0].name).toBe('action');
      expect(events[0].properties?.action).toBe('button_click');
      expect(events[0].properties?.target).toBe('submit-btn');
    });

    it('should track action without target', () => {
      trackAction('scroll');

      const events = getEventLog();
      expect(events[0].properties?.action).toBe('scroll');
      expect(events[0].properties?.target).toBeUndefined();
    });
  });

  describe('trackSessionResume', () => {
    it('should track session resume', () => {
      trackSessionResume(10);

      const events = getEventLog();
      expect(events[0].name).toBe('session_resume');
      expect(events[0].properties?.messagesCount).toBe(10);
    });

    it('should track different message counts', () => {
      trackSessionResume(0);
      trackSessionResume(50);
      trackSessionResume(100);

      const events = getEventLog();
      expect(events.map((e) => e.properties?.messagesCount)).toEqual([0, 50, 100]);
    });
  });

  describe('trackSetupComplete', () => {
    it('should track setup complete', () => {
      const preferences = { theme: 'dark', language: 'typescript' };
      trackSetupComplete(preferences);

      const events = getEventLog();
      expect(events[0].name).toBe('setup_complete');
      expect(events[0].properties).toEqual(preferences);
    });

    it('should track setup with empty preferences', () => {
      trackSetupComplete({});

      const events = getEventLog();
      expect(events[0].properties).toEqual({});
    });
  });

  describe('trackSetupSkipped', () => {
    it('should track setup skipped', () => {
      trackSetupSkipped();

      const events = getEventLog();
      expect(events[0].name).toBe('setup_skipped');
    });

    it('should have no properties', () => {
      trackSetupSkipped();

      const events = getEventLog();
      expect(events[0].properties).toBeUndefined();
    });
  });

  describe('getSessionDuration', () => {
    it('should return duration greater than or equal to 0', () => {
      const duration = getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should increase over time', async () => {
      const duration1 = getSessionDuration();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const duration2 = getSessionDuration();

      expect(duration2).toBeGreaterThan(duration1);
    });
  });

  describe('getEventLog', () => {
    it('should return empty array initially', () => {
      const events = getEventLog();
      expect(events).toEqual([]);
    });

    it('should return copy of events array', () => {
      track('event1');
      const events1 = getEventLog();
      events1.push({ name: 'tampered', timestamp: 0 });
      const events2 = getEventLog();

      expect(events2).toHaveLength(1);
      expect(events2[0].name).toBe('event1');
    });

    it('should return all tracked events', () => {
      track('event1');
      track('event2');

      const events = getEventLog();
      expect(events).toHaveLength(2);
    });
  });

  describe('resetAnalyticsState', () => {
    it('should clear all events', () => {
      track('event1');
      track('event2');

      resetAnalyticsState();

      const events = getEventLog();
      expect(events).toEqual([]);
    });

    it('should reset first diagram timer', () => {
      trackDiagramGenerated('flowchart', true);
      resetAnalyticsState();
      trackDiagramGenerated('sequence', true);

      const events = getEventLog();
      const firstDiagramEvents = events.filter((e) => e.name === 'first_diagram');
      expect(firstDiagramEvents).toHaveLength(1);
    });

    it('should not affect session start time', () => {
      const duration1 = getSessionDuration();
      resetAnalyticsState();
      const duration2 = getSessionDuration();

      // Duration should continue from original start
      expect(duration2).toBeGreaterThanOrEqual(duration1);
    });
  });
});

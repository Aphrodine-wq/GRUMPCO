/**
 * @fileoverview Frontend analytics tracking module.
 *
 * This module provides client-side analytics tracking for user interactions,
 * screen views, diagram generation, errors, and session metrics.
 *
 * ## Key Features
 *
 * - **Session tracking**: Tracks session duration and time to first diagram
 * - **Event logging**: Logs events locally and sends to backend API
 * - **Silent failures**: Analytics errors don't break the application
 *
 * ## Tracked Events
 *
 * | Event               | Description                              |
 * |---------------------|------------------------------------------|
 * | screen_view         | User navigated to a screen               |
 * | message_sent        | User sent a chat message                 |
 * | diagram_generated   | Diagram was generated (success/failure)  |
 * | first_diagram       | First successful diagram in session      |
 * | error               | Application error occurred               |
 * | feedback            | User provided feedback on a diagram      |
 * | template_used       | User selected a template                 |
 * | action              | Generic user action                      |
 * | session_resume      | User resumed a saved session             |
 * | setup_complete      | User completed onboarding setup          |
 * | setup_skipped       | User skipped onboarding                  |
 *
 * ## Usage
 *
 * ```typescript
 * import { track, trackScreenView, trackDiagramGenerated } from './analytics';
 *
 * // Track a custom event
 * track('custom_event', { customProp: 'value' });
 *
 * // Track screen view
 * trackScreenView('settings');
 *
 * // Track diagram generation
 * trackDiagramGenerated('flowchart', true);
 * ```
 *
 * @module lib/analytics
 */

/**
 * Represents a tracked analytics event.
 */
export interface AnalyticsEvent {
  /** Event name identifier (e.g., 'screen_view', 'message_sent') */
  name: string;
  /** Optional key-value properties associated with the event */
  properties?: Record<string, unknown>;
  /** Unix timestamp when the event occurred */
  timestamp: number;
}

// Session tracking
const sessionStart = Date.now();
const events: AnalyticsEvent[] = [];

// Track time to first diagram
let firstDiagramTime: number | null = null;

/**
 * Tracks a custom analytics event.
 *
 * Events are stored locally and sent to the backend API asynchronously.
 * Failures are logged in development but don't throw errors.
 *
 * @param eventName - The name of the event to track
 * @param properties - Optional properties to attach to the event
 *
 * @example
 * ```typescript
 * track('button_click', { buttonId: 'submit', page: 'settings' });
 * ```
 */
export function track(eventName: string, properties?: Record<string, unknown>): void {
  const event: AnalyticsEvent = {
    name: eventName,
    properties,
    timestamp: Date.now(),
  };

  events.push(event);

  // In development, log to console (use warn so lint allows)
  if (import.meta.env.DEV) {
    console.warn('[Analytics]', eventName, properties || '');
  }

  // Send to backend for persistence and analytics
  sendToBackend(event).catch(() => {
    // Fail silently - analytics failures shouldn't break the app
  });
}

/**
 * Sends an analytics event to the backend for persistence.
 *
 * @param event - The event to send
 * @internal
 */
async function sendToBackend(event: AnalyticsEvent): Promise<void> {
  try {
    // Only send if we have a backend to send to
    if (typeof window === 'undefined') return;

    const { fetchApi } = await import('./api.js');
    const response = await fetchApi('/api/analytics/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    if (!response.ok && import.meta.env.DEV) {
      console.warn(`[Analytics] Failed to send event: ${response.status}`);
    }
  } catch (error) {
    // Silently fail - don't break the app for analytics errors
    if (import.meta.env.DEV) {
      console.warn('[Analytics] Failed to send event:', error);
    }
  }
}

/**
 * Tracks a screen/view navigation event.
 *
 * @param screen - The screen name or identifier
 */
export function trackScreenView(screen: string): void {
  track('screen_view', { screen });
}

/**
 * Tracks when a user sends a chat message.
 *
 * @param messageLength - The length of the message in characters
 */
export function trackMessageSent(messageLength: number): void {
  track('message_sent', {
    messageLength,
    sessionDuration: Date.now() - sessionStart,
  });
}

/**
 * Tracks when a diagram is generated.
 * Also tracks the first successful diagram in the session.
 *
 * @param diagramType - Optional type of diagram (e.g., 'flowchart', 'sequence')
 * @param success - Whether the diagram generation succeeded (default: true)
 */
export function trackDiagramGenerated(diagramType?: string, success: boolean = true): void {
  const now = Date.now();

  // Track time to first diagram
  if (firstDiagramTime === null && success) {
    firstDiagramTime = now - sessionStart;
    track('first_diagram', {
      timeToFirstDiagram: firstDiagramTime,
      diagramType,
    });
  }

  track('diagram_generated', {
    diagramType,
    success,
    sessionDuration: now - sessionStart,
  });
}

/**
 * Tracks an application error.
 *
 * @param errorType - Category or type of the error
 * @param errorMessage - The error message
 */
export function trackError(errorType: string, errorMessage: string): void {
  track('error', {
    errorType,
    errorMessage,
    sessionDuration: Date.now() - sessionStart,
  });
}

/**
 * Tracks user feedback on a diagram.
 *
 * @param diagramId - Unique identifier of the diagram
 * @param helpful - Whether the user found the diagram helpful
 * @param comment - Optional user comment
 */
export function trackFeedback(diagramId: string, helpful: boolean, comment?: string): void {
  track('feedback', {
    diagramId,
    helpful,
    comment,
  });
}

/**
 * Tracks when a user selects a template.
 *
 * @param templateType - The type/name of the template used
 */
export function trackTemplateUsed(templateType: string): void {
  track('template_used', { templateType });
}

/**
 * Tracks a generic user action.
 *
 * @param action - The action identifier
 * @param target - Optional target of the action (e.g., button ID, element)
 */
export function trackAction(action: string, target?: string): void {
  track('action', { action, target });
}

/**
 * Tracks when a user resumes a saved session.
 *
 * @param messagesCount - Number of messages in the resumed session
 */
export function trackSessionResume(messagesCount: number): void {
  track('session_resume', { messagesCount });
}

/**
 * Tracks when a user completes the onboarding setup.
 *
 * @param preferences - The preferences selected during setup
 */
export function trackSetupComplete(preferences: object): void {
  track('setup_complete', preferences as Record<string, unknown>);
}

/**
 * Tracks when a user skips the onboarding setup.
 */
export function trackSetupSkipped(): void {
  track('setup_skipped');
}

/**
 * Returns the current session duration in milliseconds.
 *
 * @returns Session duration in ms since module load
 */
export function getSessionDuration(): number {
  return Date.now() - sessionStart;
}

/**
 * Returns a copy of all tracked events in the current session.
 *
 * @returns Array of all tracked AnalyticsEvent objects
 */
export function getEventLog(): AnalyticsEvent[] {
  return [...events];
}

/**
 * Resets the analytics state for testing purposes.
 * Clears all tracked events and resets the first diagram timer.
 *
 * Note: sessionStart is module-level and only resets on module reload.
 */
export function resetAnalyticsState(): void {
  events.length = 0;
  firstDiagramTime = null;
  // Note: sessionStart is module-level and resets on module reload
}

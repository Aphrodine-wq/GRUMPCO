export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

// Session tracking
const sessionStart = Date.now();
const events: AnalyticsEvent[] = [];

// Track time to first diagram
let firstDiagramTime: number | null = null;

export function track(eventName: string, properties?: Record<string, unknown>): void {
  const event: AnalyticsEvent = {
    name: eventName,
    properties,
    timestamp: Date.now()
  };

  events.push(event);

  // In development, log to console
  if (import.meta.env.DEV) {
    console.log('[Analytics]', eventName, properties || '');
  }

  // Send to backend for persistence and analytics
  sendToBackend(event).catch(() => {
    // Fail silently - analytics failures shouldn't break the app
  });
}

/**
 * Send analytics event to backend for persistence
 */
async function sendToBackend(event: AnalyticsEvent): Promise<void> {
  try {
    // Only send if we have a backend to send to
    if (typeof window === 'undefined') return;

    const response = await fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

export function trackScreenView(screen: string): void {
  track('screen_view', { screen });
}

export function trackMessageSent(messageLength: number): void {
  track('message_sent', { 
    messageLength,
    sessionDuration: Date.now() - sessionStart 
  });
}

export function trackDiagramGenerated(diagramType?: string, success: boolean = true): void {
  const now = Date.now();
  
  // Track time to first diagram
  if (firstDiagramTime === null && success) {
    firstDiagramTime = now - sessionStart;
    track('first_diagram', { 
      timeToFirstDiagram: firstDiagramTime,
      diagramType 
    });
  }
  
  track('diagram_generated', { 
    diagramType,
    success,
    sessionDuration: now - sessionStart
  });
}

export function trackError(errorType: string, errorMessage: string): void {
  track('error', { 
    errorType, 
    errorMessage,
    sessionDuration: Date.now() - sessionStart
  });
}

export function trackFeedback(diagramId: string, helpful: boolean, comment?: string): void {
  track('feedback', { 
    diagramId, 
    helpful, 
    comment 
  });
}

export function trackTemplateUsed(templateType: string): void {
  track('template_used', { templateType });
}

export function trackAction(action: string, target?: string): void {
  track('action', { action, target });
}

export function trackSessionResume(messagesCount: number): void {
  track('session_resume', { messagesCount });
}

export function trackSetupComplete(preferences: object): void {
  track('setup_complete', preferences as Record<string, unknown>);
}

export function trackSetupSkipped(): void {
  track('setup_skipped');
}

export function getSessionDuration(): number {
  return Date.now() - sessionStart;
}

export function getEventLog(): AnalyticsEvent[] {
  return [...events];
}

export function resetAnalyticsState(): void {
  events.length = 0;
  firstDiagramTime = null;
  // Note: sessionStart is module-level and resets on module reload
}

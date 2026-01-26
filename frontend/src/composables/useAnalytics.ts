import { ref } from 'vue';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

// Session tracking
const sessionStart = Date.now();
const events = ref<AnalyticsEvent[]>([]);

// Track time to first diagram
let firstDiagramTime: number | null = null;

export function useAnalytics() {
  
  function track(eventName: string, properties?: Record<string, unknown>): void {
    const event: AnalyticsEvent = {
      name: eventName,
      properties,
      timestamp: Date.now()
    };
    
    events.value.push(event);
    
    // Log to console for now (replace with Posthog/Mixpanel later)
    console.log('[Analytics]', eventName, properties || '');
    
    // Could send to backend:
    // sendToBackend(event);
  }

  function trackScreenView(screen: string): void {
    track('screen_view', { screen });
  }

  function trackMessageSent(messageLength: number): void {
    track('message_sent', { 
      messageLength,
      sessionDuration: Date.now() - sessionStart 
    });
  }

  function trackDiagramGenerated(diagramType?: string, success: boolean = true): void {
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

  function trackError(errorType: string, errorMessage: string): void {
    track('error', { 
      errorType, 
      errorMessage,
      sessionDuration: Date.now() - sessionStart
    });
  }

  function trackFeedback(diagramId: string, helpful: boolean, comment?: string): void {
    track('feedback', { 
      diagramId, 
      helpful, 
      comment 
    });
  }

  function trackTemplateUsed(templateType: string): void {
    track('template_used', { templateType });
  }

  function trackAction(action: string, target?: string): void {
    track('action', { action, target });
  }

  function trackSessionResume(messagesCount: number): void {
    track('session_resume', { messagesCount });
  }

  function trackSetupComplete(preferences: object): void {
    track('setup_complete', preferences as Record<string, unknown>);
  }

  function trackSetupSkipped(): void {
    track('setup_skipped');
  }

  function getSessionDuration(): number {
    return Date.now() - sessionStart;
  }

  function getEventLog(): AnalyticsEvent[] {
    return events.value;
  }

  // Async function to send events to backend (implement when ready)
  // async function sendToBackend(event: AnalyticsEvent): Promise<void> {
  //   try {
  //     await fetch('/api/analytics', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify(event)
  //     });
  //   } catch (e) {
  //     console.warn('Failed to send analytics:', e);
  //   }
  // }

  return {
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
    getEventLog
  };
}

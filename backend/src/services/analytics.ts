import { PostHog } from "posthog-node";
import { v4 as uuidv4 } from "uuid";

// Event types for analytics
export type AnalyticsEventName =
  // Onboarding events
  | "user_signed_up"
  | "tour_started"
  | "tour_completed"
  | "first_project_created"
  // Core usage events
  | "intent_submitted"
  | "architecture_viewed"
  | "code_generated"
  | "project_downloaded"
  | "project_shipped"
  // Feature events
  | "skill_used"
  | "chat_message_sent"
  | "diagram_exported"
  // Error events
  | "generation_failed"
  | "timeout_occurred"
  | "provider_error"
  | "error_occurred"
  // Business events
  | "user_upgraded"
  | "payment_processed"
  // Session events
  | "session_started"
  | "session_ended"
  // Page events
  | "page_view"
  // API request events
  | "api_request_started"
  | "api_request_completed"
  | "api_request_failed";

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  userId?: string;
  anonymousId?: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

export interface AnalyticsUser {
  userId: string;
  traits?: Record<string, unknown>;
}

// Configuration options
interface AnalyticsConfig {
  apiKey?: string;
  host?: string;
  enabled?: boolean;
  debug?: boolean;
  flushInterval?: number;
}

class AnalyticsService {
  private client: PostHog | null = null;
  private enabled: boolean = false;
  private debug: boolean = false;
  private queue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv(): void {
    const config: AnalyticsConfig = {
      apiKey: process.env.POSTHOG_API_KEY,
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      enabled: process.env.ANALYTICS_ENABLED !== "false",
      debug: process.env.ANALYTICS_DEBUG === "true",
      flushInterval: parseInt(process.env.ANALYTICS_FLUSH_INTERVAL || "10000"),
    };

    this.initialize(config);
  }

  initialize(config: AnalyticsConfig): void {
    this.enabled = config.enabled ?? true;
    this.debug = config.debug ?? false;

    if (!this.enabled) {
      this.log("Analytics disabled");
      return;
    }

    if (!config.apiKey) {
      console.warn(
        "[Analytics] POSTHOG_API_KEY not set. Analytics will be disabled.",
      );
      this.enabled = false;
      return;
    }

    try {
      this.client = new PostHog(config.apiKey, {
        host: config.host,
      });

      this.log("PostHog client initialized");

      // Setup periodic flush
      if (config.flushInterval) {
        this.flushInterval = setInterval(() => {
          this.flush();
        }, config.flushInterval);
      }
    } catch (error) {
      console.error("[Analytics] Failed to initialize PostHog:", error);
      this.enabled = false;
    }
  }

  /**
   * Track an analytics event
   */
  track(
    event: AnalyticsEventName,
    properties: Record<string, unknown> = {},
    userId?: string,
  ): void {
    if (!this.enabled) {
      this.log("Skipping event (disabled):", event);
      return;
    }

    const eventData: AnalyticsEvent = {
      event,
      userId,
      anonymousId: userId ? undefined : uuidv4(),
      properties: {
        ...properties,
        source: "backend",
        environment: process.env.NODE_ENV || "development",
        version: process.env.npm_package_version || "unknown",
      },
      timestamp: new Date(),
    };

    // Add to queue for batching
    this.queue.push(eventData);

    // Track immediately in PostHog
    if (this.client) {
      this.client.capture({
        distinctId: userId || eventData.anonymousId!,
        event,
        properties: eventData.properties,
      });
    }

    this.log("Tracked:", event, properties);
  }

  /**
   * Identify a user with traits
   */
  identify(userId: string, traits: Record<string, unknown> = {}): void {
    if (!this.enabled || !this.client) {
      return;
    }

    this.client.identify({
      distinctId: userId,
      properties: traits,
    });

    this.log("Identified user:", userId, traits);
  }

  /**
   * Track page views (for SSR/server-side rendering)
   */
  pageView(
    userId: string | undefined,
    pageName: string,
    properties: Record<string, unknown> = {},
  ): void {
    this.track(
      "page_view",
      {
        page: pageName,
        ...properties,
      },
      userId,
    );
  }

  /**
   * Track feature usage
   */
  featureUsed(
    featureName: string,
    userId: string | undefined,
    properties: Record<string, unknown> = {},
  ): void {
    this.track(
      "skill_used",
      {
        feature: featureName,
        ...properties,
      },
      userId,
    );
  }

  /**
   * Track generation events with timing
   */
  trackGeneration(
    type: "architecture" | "code" | "intent",
    success: boolean,
    durationMs: number,
    userId: string | undefined,
    properties: Record<string, unknown> = {},
  ): void {
    const eventName: AnalyticsEventName = success
      ? type === "architecture"
        ? "architecture_viewed"
        : type === "code"
          ? "code_generated"
          : "intent_submitted"
      : "generation_failed";

    this.track(
      eventName,
      {
        generation_type: type,
        success,
        duration_ms: durationMs,
        ...properties,
      },
      userId,
    );
  }

  /**
   * Track error events
   */
  trackError(
    errorType:
      | "generation_failed"
      | "timeout_occurred"
      | "provider_error"
      | "error_occurred",
    error: Error,
    userId: string | undefined,
    properties: Record<string, unknown> = {},
  ): void {
    this.track(
      errorType,
      {
        error_message: error.message,
        error_name: error.name,
        error_stack:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
        ...properties,
      },
      userId,
    );
  }

  /**
   * Track project lifecycle events
   */
  trackProjectLifecycle(
    stage: "created" | "downloaded" | "shipped",
    projectId: string,
    userId: string | undefined,
    properties: Record<string, unknown> = {},
  ): void {
    const eventMap: Record<string, AnalyticsEventName> = {
      created: "first_project_created",
      downloaded: "project_downloaded",
      shipped: "project_shipped",
    };

    this.track(
      eventMap[stage],
      {
        project_id: projectId,
        ...properties,
      },
      userId,
    );
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.flush();
      this.queue = [];
      this.log("Flushed events to PostHog");
    } catch (error) {
      console.error("[Analytics] Failed to flush events:", error);
    }
  }

  /**
   * Shutdown the analytics client
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    await this.flush();

    if (this.client) {
      await this.client.shutdown();
      this.client = null;
    }

    this.log("Analytics service shutdown complete");
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log("[Analytics]", ...args);
    }
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Export for testing
export { AnalyticsService };

// Default export
export default analytics;

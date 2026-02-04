declare module "posthog-node" {
  export class PostHog {
    constructor(apiKey: string, options?: { host?: string });
    capture(options: {
      distinctId: string;
      event: string;
      properties?: Record<string, unknown>;
    }): void;
    identify(options: {
      distinctId: string;
      properties?: Record<string, unknown>;
    }): void;
    flush(): Promise<void>;
    shutdown(): Promise<void>;
  }
}

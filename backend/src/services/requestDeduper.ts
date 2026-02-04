/**
 * Request Deduper
 * Deduplicates in-flight requests by key to avoid duplicate LLM calls.
 */

export interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

interface RequestStats {
  totalRequests: number;
  totalDeduped: number;
  activeRequests: number;
}

export class RequestDeduper {
  private inFlight = new Map<string, InFlightRequest<unknown>>();
  private readonly maxAgeMs: number;
  private stats: RequestStats = {
    totalRequests: 0,
    totalDeduped: 0,
    activeRequests: 0,
  };

  constructor(maxAgeMs = 30_000) {
    this.maxAgeMs = maxAgeMs;
  }

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as InFlightRequest<T> | undefined;
    if (existing && Date.now() - existing.timestamp < this.maxAgeMs) {
      this.stats.totalDeduped++;
      this.stats.totalRequests++;
      return existing.promise;
    }

    this.stats.totalRequests++;
    this.stats.activeRequests++;

    const promise = fn()
      .catch((error) => {
        // Remove from inFlight on error so retry is possible
        this.inFlight.delete(key);
        this.stats.activeRequests--;
        throw error;
      })
      .finally(() => {
        // Only cleanup if not already removed (success case)
        if (this.inFlight.has(key)) {
          this.stats.activeRequests--;
          setTimeout(() => this.inFlight.delete(key), 100);
        }
      });

    this.inFlight.set(key, { promise, timestamp: Date.now() });
    return promise;
  }

  getStats(): RequestStats {
    return {
      totalRequests: this.stats.totalRequests,
      totalDeduped: this.stats.totalDeduped,
      activeRequests: this.inFlight.size,
    };
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      totalDeduped: 0,
      activeRequests: 0,
    };
  }

  getActiveKeys(): string[] {
    return Array.from(this.inFlight.keys());
  }
}

/**
 * Create a deduplication key from multiple parts
 */
export function createDedupeKey(
  ...parts: (string | number | boolean | undefined)[]
): string {
  return parts
    .map((part) => (part === undefined ? "_" : String(part)))
    .join(":");
}

export const requestDeduper = new RequestDeduper();

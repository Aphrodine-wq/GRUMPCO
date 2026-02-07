/**
 * Parallel Provider Racing
 * Sends requests to multiple providers simultaneously, returns fastest response
 *
 * Features:
 * - Race multiple providers
 * - Cancel slow responses
 * - Automatic winner caching
 * - Provider performance tracking
 */

import { connectionPool as _connectionPool } from "./connectionPool.js";
import { getTieredCache } from "./tieredCache.js";
import logger from "../middleware/logger.js";
import type { LLMProvider, StreamParams, StreamEvent } from "./llmGateway.js";

export interface RaceResult {
  provider: LLMProvider;
  stream: AsyncGenerator<StreamEvent>;
  timeToFirstByte: number;
}

interface ProviderPerformance {
  wins: number;
  totalRequests: number;
  avgTimeToFirstByte: number;
  lastUsed: number;
}

class ProviderRacingService {
  private cache = getTieredCache();
  private performanceMetrics = new Map<LLMProvider, ProviderPerformance>();
  private readonly maxRacers = 3; // Race top 3 providers

  /**
   * Race multiple providers and return the fastest
   */
  async race(
    providers: LLMProvider[],
    params: StreamParams,
    streamFactory: (
      provider: LLMProvider,
      params: StreamParams,
    ) => AsyncGenerator<StreamEvent>,
  ): Promise<RaceResult> {
    // Select top providers to race
    const racers = this.selectRacers(providers);

    logger.info(
      {
        racers,
        model: params.model,
      },
      "Starting provider race",
    );

    const abortControllers = new Map<LLMProvider, AbortController>();

    // Create promises that resolve on first byte
    const racePromises = racers.map(async (provider) => {
        const controller = new AbortController();
        abortControllers.set(provider, controller);

        // Merge signals: either params.signal (user cancel) or controller.signal (we cancel)
        const signals = [controller.signal];
        if (params.signal) signals.push(params.signal);

        // Use AbortSignal.any (Node 20+)
        const signal = AbortSignal.any(signals);

        const raceParams = { ...params, signal };
        const startTime = Date.now();

        try {
            const generator = streamFactory(provider, raceParams);
            const iterator = generator[Symbol.asyncIterator]();

            // Wait for the first chunk
            const firstResult = await iterator.next();

            if (firstResult.done) {
                 // Empty stream is a failure for racing purposes
                 throw new Error(`Provider ${provider} returned empty stream`);
            }

            const timeToFirstByte = Date.now() - startTime;

            // Create a new generator that yields the first chunk then the rest
            const stream = async function* () {
                yield firstResult.value;
                yield* { [Symbol.asyncIterator]: () => iterator };
            };

            return {
                provider,
                stream: stream(),
                timeToFirstByte
            } as RaceResult;

        } catch (error) {
             logger.warn(
                { provider, error: (error as Error).message },
                "Provider failed in race",
              );
              return null;
        }
    });

    // Race to first success
    const winner = await this.raceToSuccess(racePromises);

    if (!winner) {
      throw new Error("All providers failed in race");
    }

    // Cancel losers
    for (const [provider, controller] of abortControllers) {
      if (provider !== winner.provider) {
        controller.abort();
      }
    }

    // Update metrics
    this.updateMetrics(winner);

    // Cache winner for future requests
    await this.cacheWinner(params, winner);

    logger.info(
      {
        winner: winner.provider,
        timeToFirstByte: winner.timeToFirstByte,
        racers: racers.length,
      },
      "Provider race completed",
    );

    return winner;
  }

    /**
   * Race promises to first success (ignoring failures until all fail)
   */
  private async raceToSuccess<T>(promises: Promise<T | null>[]): Promise<T | null> {
    return new Promise((resolve) => {
        let failureCount = 0;
        let resolved = false;

        promises.forEach(p => {
            p.then(result => {
                if (resolved) return;
                if (result) {
                    resolved = true;
                    resolve(result);
                } else {
                    failureCount++;
                    if (failureCount === promises.length) resolve(null);
                }
            }).catch(() => {
                if (resolved) return;
                failureCount++;
                if (failureCount === promises.length) resolve(null);
            });
        });

        if (promises.length === 0) resolve(null);
    });
  }

  /**
   * Select top providers to race based on performance history
   */
  private selectRacers(available: LLMProvider[]): LLMProvider[] {
    // Score each provider
    const scored = available.map((provider) => {
      const perf = this.performanceMetrics.get(provider);
      if (!perf) {
        // New provider, give it a chance
        return { provider, score: 100 };
      }

      // Calculate score based on win rate and speed
      const winRate = perf.wins / Math.max(1, perf.totalRequests);
      const speedScore = 1000 / Math.max(1, perf.avgTimeToFirstByte);

      return {
        provider,
        score: winRate * 50 + speedScore * 50,
      };
    });

    // Sort by score and take top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxRacers)
      .map((s) => s.provider);
  }

  /**
   * Update performance metrics for a provider
   */
  private updateMetrics(winner: RaceResult): void {
    const perf = this.performanceMetrics.get(winner.provider) || {
      wins: 0,
      totalRequests: 0,
      avgTimeToFirstByte: 0,
      lastUsed: Date.now(),
    };

    perf.wins++;
    perf.totalRequests++;
    perf.avgTimeToFirstByte =
      (perf.avgTimeToFirstByte * (perf.totalRequests - 1) +
        winner.timeToFirstByte) /
      perf.totalRequests;
    perf.lastUsed = Date.now();

    this.performanceMetrics.set(winner.provider, perf);
  }

  /**
   * Cache winner for future identical requests
   */
  private async cacheWinner(
    params: StreamParams,
    winner: RaceResult,
  ): Promise<void> {
    const cacheKey = this.createCacheKey(params);

    await this.cache.set(
      "race-winner",
      cacheKey,
      {
        provider: winner.provider,
        timestamp: Date.now(),
      },
      300,
    ); // 5 min cache
  }

  /**
   * Get cached winner for params
   */
  async getCachedWinner(params: StreamParams): Promise<LLMProvider | null> {
    const cacheKey = this.createCacheKey(params);
    const cached = await this.cache.get<{
      provider: LLMProvider;
      timestamp: number;
    }>("race-winner", cacheKey);

    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 min
      return cached.provider;
    }

    return null;
  }

  /**
   * Create cache key from params
   */
  private createCacheKey(params: StreamParams): string {
    const content =
      typeof params.messages[0]?.content === "string"
        ? params.messages[0].content
        : "";
    return content.slice(0, 100).replace(/[^a-zA-Z0-9]/g, "");
  }

  /**
   * Get performance statistics
   */
  getStats(): Record<LLMProvider, ProviderPerformance> {
    const stats = {} as Record<LLMProvider, ProviderPerformance>;

    for (const [provider, perf] of this.performanceMetrics.entries()) {
      stats[provider] = perf;
    }

    return stats;
  }
}

// Singleton instance
export const providerRacing = new ProviderRacingService();

// Export class for testing
export { ProviderRacingService };

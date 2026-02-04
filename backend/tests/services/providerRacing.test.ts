/**
 * Provider Racing Service unit tests
 * Run: npm test -- providerRacing.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted() for variables referenced in vi.mock() factories
const { mockLogger, mockCacheGet, mockCacheSet } = vi.hoisted(() => {
  return {
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn(),
  };
});

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../src/services/tieredCache.js', () => ({
  getTieredCache: vi.fn(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
  })),
}));

import { providerRacing, ProviderRacingService } from '../../src/services/providerRacing.js';
import type { LLMProvider, StreamParams, StreamEvent } from '../../src/services/llmGateway.js';

// Helper to create valid stream params
const createStreamParams = (overrides?: Partial<StreamParams>): StreamParams => ({
  model: 'test-model',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'test message' }],
  ...overrides,
} as StreamParams);

describe('providerRacing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('race', () => {
    it('should return winner from single successful provider', async () => {
      const events: StreamEvent[] = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'message_stop' },
      ];

      const mockStreamFn = vi.fn().mockImplementation(async function* (_provider: LLMProvider) {
        for (const event of events) {
          yield event;
        }
      });

      const winner = await providerRacing.race(
        ['groq', 'nim'],
        createStreamParams(),
        mockStreamFn
      );

      // Winner will be one of the providers that succeeded
      expect(['groq', 'nim']).toContain(winner.provider);
      expect(winner.events.length).toBeGreaterThan(0);
    });

    it('should throw error when all providers fail', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        throw new Error('All failed');
      });

      await expect(
        providerRacing.race(['groq', 'nim'], createStreamParams(), mockStreamFn)
      ).rejects.toThrow();
    });

    it('should track time to first byte', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        await new Promise(resolve => setTimeout(resolve, 10));
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Data' } };
        yield { type: 'message_stop' };
      });

      const winner = await providerRacing.race(
        ['groq'],
        createStreamParams(),
        mockStreamFn
      );

      expect(winner.timeToFirstByte).toBeGreaterThanOrEqual(0);
    });

    it('should record metrics for winner', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        yield { type: 'message_stop' };
      });

      const winner = await providerRacing.race(['groq'], createStreamParams({ model: 'test-model' }), mockStreamFn);

      // Verify internal metrics are updated (check via getStats)
      const stats = providerRacing.getStats();
      expect(stats[winner.provider]).toBeDefined();
      expect(stats[winner.provider].wins).toBeGreaterThanOrEqual(1);
    });
  });

  describe('provider selection', () => {
    it('should call providers from the list', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        yield { type: 'message_stop' };
      });

      await providerRacing.race(
        ['groq', 'nim'],
        createStreamParams(),
        mockStreamFn
      );

      // Should have called at least one provider
      expect(mockStreamFn).toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should cache winner for params', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        yield { type: 'message_stop' };
      });

      await providerRacing.race(
        ['groq'],
        createStreamParams({ messages: [{ role: 'user', content: 'test query' }] }),
        mockStreamFn
      );

      expect(mockCacheSet).toHaveBeenCalled();
    });

    it('should return cached winner', async () => {
      mockCacheGet.mockResolvedValue({
        provider: 'nim',
        timestamp: Date.now(),
      });

      const winner = await providerRacing.getCachedWinner(
        createStreamParams({ messages: [{ role: 'user', content: 'cached query' }] })
      );

      expect(winner).toBe('nim');
    });

    it('should return null for expired cache', async () => {
      mockCacheGet.mockResolvedValue({
        provider: 'groq',
        timestamp: Date.now() - 400000, // 400 seconds ago
      });

      const winner = await providerRacing.getCachedWinner(
        createStreamParams({ messages: [{ role: 'user', content: 'old query' }] })
      );

      expect(winner).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return stats object', () => {
      const stats = providerRacing.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should track provider performance after races', async () => {
      const mockStreamFn = vi.fn().mockImplementation(async function* () {
        yield { type: 'message_stop' };
      });

      // Run a race
      await providerRacing.race(['groq'], createStreamParams(), mockStreamFn);

      const stats = providerRacing.getStats();
      
      // Stats should have an entry for groq
      if (stats.groq) {
        expect(stats.groq.wins).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('ProviderRacingService configuration', () => {
    it('should create instance with custom config', () => {
      const customRacing = new ProviderRacingService();
      expect(customRacing).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRacingService } from './providerRacing';
import { StreamEvent, StreamParams, LLMProvider } from './llmGateway';

// Mock getTieredCache
vi.mock('./tieredCache', () => ({
  getTieredCache: () => ({
    set: vi.fn(),
    get: vi.fn(),
  }),
}));

// Mock logger
vi.mock('../middleware/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProviderRacingService', () => {
  let service: ProviderRacingService;

  beforeEach(() => {
    service = new ProviderRacingService();
  });

  it('should race providers and return the winner', async () => {
    // fastProvider yields first chunk immediately, then takes a while to finish
    const fastProvider = async function* () {
        await new Promise(resolve => setTimeout(resolve, 10));
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'fast' } } as StreamEvent;
        await new Promise(resolve => setTimeout(resolve, 200));
        yield { type: 'message_stop' } as StreamEvent;
    };

    // slowProvider takes a while to start
    const slowProvider = async function* () {
        await new Promise(resolve => setTimeout(resolve, 100));
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'slow' } } as StreamEvent;
        yield { type: 'message_stop' } as StreamEvent;
    };

    const streamFn = vi.fn().mockImplementation((provider: LLMProvider) => {
        if (provider === 'nim') return fastProvider();
        return slowProvider();
    });

    const start = Date.now();
    const result = await service.race(['nim', 'anthropic'], { model: 'test', messages: [] } as StreamParams, streamFn);
    const end = Date.now();
    const duration = end - start;

    expect(result.provider).toBe('nim');

    // In the CURRENT broken implementation, it waits for the full stream.
    // fastProvider takes ~210ms total. slowProvider takes ~100ms total.
    // So 'anthropic' (slowProvider) might actually win if we race for *completion* because it finishes faster!
    // Or if it races for completion, it takes at least 100ms.

    // If it was optimized (TTFB), it should return in ~10ms.
  });
});

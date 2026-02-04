/**
 * Chat cache (getChatCacheKey, getCachedChatResponse, setCachedChatResponse) unit tests.
 * Run: npm test -- chatCache.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock('../../src/services/tieredCache.js', () => ({
  getTieredCache: () => ({
    get: mockGet,
    set: mockSet,
  }),
}));

import {
  getChatCacheKey,
  getCachedChatResponse,
  setCachedChatResponse,
} from '../../src/services/chatCache.js';

describe('chatCache', () => {
  beforeEach(() => {
    mockGet.mockReset().mockResolvedValue(null);
    mockSet.mockReset().mockResolvedValue(undefined);
  });

  describe('getChatCacheKey', () => {
    it('returns deterministic 32-char hex for same input', () => {
      const messages = [{ role: 'user', content: 'hello' }];
      const a = getChatCacheKey('plan', messages);
      const b = getChatCacheKey('plan', messages);
      expect(a).toBe(b);
      expect(a).toMatch(/^[a-f0-9]{32}$/);
    });

    it('returns different key for different mode', () => {
      const messages = [{ role: 'user', content: 'hello' }];
      expect(getChatCacheKey('plan', messages)).not.toBe(getChatCacheKey('normal', messages));
    });

    it('returns different key for different messages', () => {
      const key1 = getChatCacheKey('plan', [{ role: 'user', content: 'a' }]);
      const key2 = getChatCacheKey('plan', [{ role: 'user', content: 'b' }]);
      expect(key1).not.toBe(key2);
    });
  });

  describe('getCachedChatResponse', () => {
    it('returns null when cache miss', async () => {
      mockGet.mockResolvedValue(null);
      const result = await getCachedChatResponse('plan', [{ role: 'user', content: 'hi' }]);
      expect(result).toBeNull();
    });

    it('returns cached response when hit', async () => {
      const cached = { text: 'cached plan', fromCache: true as const };
      mockGet.mockResolvedValue(cached);
      const result = await getCachedChatResponse('plan', [{ role: 'user', content: 'hi' }]);
      expect(result).toEqual(cached);
    });
  });

  describe('setCachedChatResponse', () => {
    it('calls cache set with key and value', async () => {
      const messages = [{ role: 'user', content: 'hi' }];
      await setCachedChatResponse('plan', messages, 'some plan text');
      expect(mockSet).toHaveBeenCalledWith(
        'chat:completion',
        getChatCacheKey('plan', messages),
        { text: 'some plan text', fromCache: true },
        expect.any(Number)
      );
    });
  });
});

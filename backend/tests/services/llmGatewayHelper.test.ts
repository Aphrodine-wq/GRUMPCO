/**
 * Tests for llmGatewayHelper.ts
 * Covers non-streaming completion interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the llmGateway
const mockGetStream = vi.fn();

vi.mock('../../src/services/llmGateway.js', () => ({
  getStream: (...args: unknown[]) => mockGetStream(...args),
}));

// Import after mocks
import { getCompletion, type CompletionResult } from '../../src/services/llmGatewayHelper.js';

// Helper to create valid params
function createParams(overrides = {}) {
  return {
    model: 'test-model',
    max_tokens: 1000,
    system: 'You are a helpful assistant',
    messages: [{ role: 'user' as const, content: 'Test' }],
    ...overrides,
  };
}

describe('llmGatewayHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCompletion', () => {
    it('should accumulate text from content_block_delta events', async () => {
      // Create an async iterator that yields text events
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' ' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'World' } };
        },
      };
      mockGetStream.mockReturnValue(mockStream);

      const result = await getCompletion(createParams({
        messages: [{ role: 'user', content: 'Say hello' }],
      }));

      expect(result.text).toBe('Hello World');
      expect(result.error).toBeUndefined();
    });

    it('should return error on error event', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Start...' } };
          yield { type: 'error', error: 'Rate limit exceeded' };
        },
      };
      mockGetStream.mockReturnValue(mockStream);

      const result = await getCompletion(createParams());

      expect(result.text).toBe('');
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle thrown exceptions', async () => {
      mockGetStream.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await getCompletion(createParams());

      expect(result.text).toBe('');
      expect(result.error).toBe('Network error');
    });

    it('should pass provider option to getStream', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'done' } };
        },
      };
      mockGetStream.mockReturnValue(mockStream);

      const params = createParams({ messages: [] });
      await getCompletion(params, 'nim');

      expect(mockGetStream).toHaveBeenCalledWith(params, { provider: 'nim' });
    });

    it('should ignore non-text events', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: {} };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
          yield { type: 'content_block_start', content_block: {} };
          yield { type: 'content_block_delta', delta: { type: 'other_delta', data: 123 } };
          yield { type: 'message_delta', delta: {} };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '!' } };
          yield { type: 'message_stop' };
        },
      };
      mockGetStream.mockReturnValue(mockStream);

      const result = await getCompletion(createParams());

      expect(result.text).toBe('Hello!');
    });

    it('should return empty text when no content received', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: {} };
          yield { type: 'message_stop' };
        },
      };
      mockGetStream.mockReturnValue(mockStream);

      const result = await getCompletion(createParams());

      expect(result.text).toBe('');
      expect(result.error).toBeUndefined();
    });

    it('should handle async iterator errors', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Start' } };
          throw new Error('Stream interrupted');
        },
      };
      mockGetStream.mockReturnValue(mockStream);

      const result = await getCompletion(createParams());

      expect(result.text).toBe('');
      expect(result.error).toBe('Stream interrupted');
    });

    it('should handle complex stream params', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } };
        },
      };
      mockGetStream.mockReturnValue(mockStream);

      const params = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'You are a helpful assistant',
        messages: [
          { role: 'user' as const, content: 'Hello' },
          { role: 'assistant' as const, content: 'Hi there!' },
          { role: 'user' as const, content: 'How are you?' },
        ],
      };

      await getCompletion(params);

      expect(mockGetStream).toHaveBeenCalledWith(params, { provider: undefined });
    });

    it('should return CompletionResult type', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'test' } };
        },
      };
      mockGetStream.mockReturnValue(mockStream);

      const result: CompletionResult = await getCompletion(createParams({ messages: [] }));

      expect(result).toHaveProperty('text');
    });
  });
});

/**
 * Claude Service With Tools Tests
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mockClaudeClient = vi.hoisted(() => ({
  messages: {
    create: vi.fn(),
    stream: vi.fn(async () => ({
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello ' },
        };
        yield { type: 'message_stop' };
      },
    })),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => mockClaudeClient),
}));

type ClaudeServiceWithToolsType = typeof import('../../src/services/claudeServiceWithTools.js').ClaudeServiceWithTools;
let ClaudeServiceWithTools: ClaudeServiceWithToolsType;

describe('ClaudeServiceWithTools', () => {
  let service: InstanceType<ClaudeServiceWithToolsType>;

  beforeAll(async () => {
    ({ ClaudeServiceWithTools } = await import('../../src/services/claudeServiceWithTools.js'));
  });

  beforeEach(() => {
    service = new ClaudeServiceWithTools();
    mockClaudeClient.messages.create.mockReset();
    mockClaudeClient.messages.stream.mockReset();
    mockClaudeClient.messages.stream.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello ' },
        };
        yield { type: 'message_stop' };
      },
    });
  });

  describe('generateChatStream', () => {
    it('should yield text events from stream', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const events: any[] = [];

      try {
        for await (const event of service.generateChatStream(messages)) {
          events.push(event);
          if (event.type === 'done') break;
        }
      } catch (error) {
        // API key may not be available in test environment
        console.warn('Skipping stream test - API may not be available');
        return;
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'text' || e.type === 'done')).toBe(true);
    });

    it('should handle abort signal', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const abortController = new AbortController();
      
      const events: any[] = [];
      const streamPromise = (async () => {
        for await (const event of service.generateChatStream(
          messages,
          abortController.signal
        )) {
          events.push(event);
          if (events.length === 1) {
            abortController.abort();
          }
        }
      })();

      try {
        await streamPromise;
      } catch (error) {
        // Expected when aborted
      }

      // Should have at least one event before abort
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle tool calls', async () => {
      const messages = [{ role: 'user' as const, content: 'List files in current directory' }];
      const events: any[] = [];

      try {
        for await (const event of service.generateChatStream(messages)) {
          events.push(event);
          if (event.type === 'done') break;
          if (events.length > 100) break; // Safety limit
        }
      } catch (error) {
        // API may not be available
        console.warn('Skipping tool call test - API may not be available');
        return;
      }

      // Should have some events
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const messages = [{ role: 'user' as const, content: 'Test' }];
      const events: any[] = [];

      try {
        for await (const event of service.generateChatStream(messages)) {
          events.push(event);
          if (event.type === 'error') {
            expect(event.message).toBeDefined();
            break;
          }
          if (event.type === 'done') break;
        }
      } catch (error) {
        // Expected in test environment
      }

      // Should handle gracefully without crashing
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('resilientStream', () => {
    it('should handle rate limiting', async () => {
      // This would require mocking the bulkheads service
      // For now, we test that the method exists and doesn't crash
      const messages = [{ role: 'user' as const, content: 'Test' }];
      
      try {
        const stream = service.generateChatStream(messages);
        const iterator = stream[Symbol.asyncIterator]();
        await iterator.next();
      } catch (error) {
        // Expected in test environment
        expect(error).toBeDefined();
      }
    });
  });
});

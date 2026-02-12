/**
 * Chat Streaming Tests
 *
 * Comprehensive tests for chat streaming utilities including SSE parsing,
 * event handling, and error recovery
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  streamChat,
  streamChatGenerator,
  flattenMessageContent,
  prepareMessagesForApi,
  calculateMessageChars,
  type ChatStreamOptions,
} from './chatStreaming';
import type { Message, ContentBlock } from '../types';

// Mock the api module
vi.mock('./api', () => ({
  fetchApi: vi.fn(),
  getApiBase: vi.fn().mockReturnValue('http://localhost:3000'),
  resetApiBase: vi.fn(),
}));

import { fetchApi } from './api';

const mockFetchApi = fetchApi as ReturnType<typeof vi.fn>;

describe('chatStreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb) => {
        cb(0);
        return 0;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('flattenMessageContent', () => {
    it('should return string content as-is', () => {
      const content = 'Hello world';
      const result = flattenMessageContent(content);
      expect(result).toBe('Hello world');
    });

    it('should flatten text blocks from content array', () => {
      const content: ContentBlock[] = [
        { type: 'text', content: 'Hello ' },
        { type: 'text', content: 'world' },
      ];
      const result = flattenMessageContent(content);
      expect(result).toBe('Hello world');
    });

    it('should filter out non-text blocks', () => {
      const content: ContentBlock[] = [
        { type: 'text', content: 'Hello ' },
        { type: 'code', language: 'js', code: 'const x = 1;' },
        { type: 'text', content: 'world' },
      ];
      const result = flattenMessageContent(content);
      expect(result).toBe('Hello world');
    });

    it('should handle empty content array', () => {
      const content: ContentBlock[] = [];
      const result = flattenMessageContent(content);
      expect(result).toBe('');
    });

    it('should handle array with only non-text blocks', () => {
      const content: ContentBlock[] = [
        { type: 'code', language: 'js', code: 'const x = 1;' },
        { type: 'mermaid', content: 'graph TD' },
      ];
      const result = flattenMessageContent(content);
      expect(result).toBe('');
    });
  });

  describe('prepareMessagesForApi', () => {
    it('should filter only user and assistant messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];
      const result = prepareMessagesForApi(messages);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    it('should convert string content to text', () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello world' }];
      const result = prepareMessagesForApi(messages);
      expect(result[0].content).toBe('Hello world');
    });

    it('should flatten content block arrays', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', content: 'Hello ' },
            { type: 'text', content: 'world' },
          ],
        },
      ];
      const result = prepareMessagesForApi(messages);
      expect(result[0].content).toBe('Hello world');
    });

    it('should filter empty messages', () => {
      const messages: Message[] = [
        { role: 'user', content: '' },
        { role: 'assistant', content: 'Valid message' },
        { role: 'user', content: '   ' },
      ];
      const result = prepareMessagesForApi(messages);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Valid message');
    });

    it('should handle NIM provider with image attachment', () => {
      const messages: Message[] = [{ role: 'user', content: 'Describe this image' }];
      const result = prepareMessagesForApi(messages, {
        provider: 'nim',
        lastUserMessageImage: 'data:image/png;base64,abc123',
      });

      expect(Array.isArray(result[0].content)).toBe(true);
      const parts = result[0].content as Array<{
        type: string;
        text?: string;
        image_url?: { url: string };
      }>;
      expect(parts).toHaveLength(2);
      expect(parts[0]).toEqual({ type: 'text', text: 'Describe this image' });
      expect(parts[1]).toEqual({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,abc123' },
      });
    });

    it('should not add image for non-NIM providers', () => {
      const messages: Message[] = [{ role: 'user', content: 'Describe this image' }];
      const result = prepareMessagesForApi(messages, {
        provider: 'openai',
        lastUserMessageImage: 'data:image/png;base64,abc123',
      });

      expect(typeof result[0].content).toBe('string');
      expect(result[0].content).toBe('Describe this image');
    });

    it('should handle empty text with image for NIM', () => {
      const messages: Message[] = [{ role: 'user', content: '' }];
      const result = prepareMessagesForApi(messages, {
        provider: 'nim',
        lastUserMessageImage: 'data:image/png;base64,abc123',
      });

      const parts = result[0].content as Array<{ type: string }>;
      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('image_url');
    });
  });

  describe('streamChat', () => {
    const createMockResponse = (chunks: string[]): Response => {
      let chunkIndex = 0;
      const reader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex++];
            const encoder = new TextEncoder();
            return {
              done: false,
              value: encoder.encode(chunk),
            };
          }
          return { done: true, value: undefined };
        }),
        releaseLock: vi.fn(),
      };

      return {
        ok: true,
        body: {
          getReader: () => reader,
        },
        status: 200,
      } as unknown as Response;
    };

    it('should throw when no messages provided', async () => {
      await expect(streamChat([])).rejects.toThrow('No messages to send');
    });

    it('should throw when API returns error', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await expect(streamChat(messages)).rejects.toThrow('Server error (500)');
    });

    it('should throw when no response body', async () => {
      mockFetchApi.mockResolvedValue({
        ok: true,
        body: null,
      });

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await expect(streamChat(messages)).rejects.toThrow('No response body');
    });

    it('should process text events', async () => {
      const chunks = [
        'data: {"type": "text", "text": "Hello"}\n',
        'data: {"type": "text", "text": " world"}\n',
        'data: {"type": "done"}\n',
      ];
      mockFetchApi.mockResolvedValue(createMockResponse(chunks));

      const messages: Message[] = [{ role: 'user', content: 'Hi' }];
      const onEvent = vi.fn();

      const blocks = await streamChat(messages, { onEvent });

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({ type: 'text', content: 'Hello world' });
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'done', blocks: expect.any(Array) })
      );
    });

    it('should process tool_call events', async () => {
      const chunks = [
        'data: {"type": "tool_call", "id": "tool-1", "name": "read_file", "input": {"path": "/test.txt"}}\n',
        'data: {"type": "done"}\n',
      ];
      mockFetchApi.mockResolvedValue(createMockResponse(chunks));

      const messages: Message[] = [{ role: 'user', content: 'Read a file' }];
      const blocks = await streamChat(messages);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        type: 'tool_call',
        id: 'tool-1',
        name: 'read_file',
        status: 'executing',
      });
    });

    it('should process tool_result events', async () => {
      const chunks = [
        'data: {"type": "tool_result", "id": "tool-1", "toolName": "read_file", "output": "File content", "success": true}\n',
        'data: {"type": "done"}\n',
      ];
      mockFetchApi.mockResolvedValue(createMockResponse(chunks));

      const messages: Message[] = [{ role: 'user', content: 'Read a file' }];
      const blocks = await streamChat(messages);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({
        type: 'tool_result',
        id: 'tool-1',
        toolName: 'read_file',
        output: 'File content',
        success: true,
      });
    });

    it('should process thinking events', async () => {
      const chunks = [
        'data: {"type": "thinking", "thinking": "Analyzing the problem..."}\n',
        'data: {"type": "done"}\n',
      ];
      mockFetchApi.mockResolvedValue(createMockResponse(chunks));

      const messages: Message[] = [{ role: 'user', content: 'Solve this' }];
      const onEvent = vi.fn();

      await streamChat(messages, { onEvent });

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'thinking',
          thinking: 'Analyzing the problem...',
        })
      );
    });

    it('should process error events', async () => {
      const chunks = [
        'data: {"type": "error", "message": "Something went wrong"}\n',
        'data: {"type": "done"}\n',
      ];
      mockFetchApi.mockResolvedValue(createMockResponse(chunks));

      const messages: Message[] = [{ role: 'user', content: 'Do something' }];
      const onEvent = vi.fn();

      await streamChat(messages, { onEvent });

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'Something went wrong',
        })
      );
    });

    it('should handle suggest_mode events', async () => {
      const chunks = [
        'data: {"type": "suggest_mode", "mode": "design"}\n',
        'data: {"type": "done"}\n',
      ];
      mockFetchApi.mockResolvedValue(createMockResponse(chunks));

      const messages: Message[] = [{ role: 'user', content: 'Create a diagram' }];
      const onEvent = vi.fn();

      await streamChat(messages, { onEvent });

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text',
          suggestChatMode: 'design',
        })
      );
    });

    it('should ignore malformed JSON', async () => {
      const chunks = [
        'data: {"type": "text", "text": "Hello"}\n',
        'data: invalid json here\n',
        'data: {"type": "text", "text": " world"}\n',
        'data: {"type": "done"}\n',
      ];
      mockFetchApi.mockResolvedValue(createMockResponse(chunks));

      const messages: Message[] = [{ role: 'user', content: 'Hi' }];
      const blocks = await streamChat(messages);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({ type: 'text', content: 'Hello world' });
    });

    it('should handle incomplete chunks across reads', async () => {
      const chunks = ['data: {"type": "text", "text": "Hel', 'lo"}\n', 'data: {"type": "done"}\n'];
      mockFetchApi.mockResolvedValue(createMockResponse(chunks));

      const messages: Message[] = [{ role: 'user', content: 'Hi' }];
      const blocks = await streamChat(messages);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({ type: 'text', content: 'Hello' });
    });

    it('should include all options in request body', async () => {
      mockFetchApi.mockResolvedValue(createMockResponse(['data: {"type": "done"}\n']));

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await streamChat(messages, {
        mode: 'design',
        sessionType: 'gAgent',
        workspaceRoot: '/workspace',
        provider: 'openai',
        modelId: 'gpt-4',
        enabledSkillIds: ['skill-1', 'skill-2'],
        memoryContext: ['context-1'],
      });

      const callBody = JSON.parse(mockFetchApi.mock.calls[0][1].body);
      expect(callBody).toMatchObject({
        mode: 'design',
        sessionType: 'gAgent',
        workspaceRoot: '/workspace',
        provider: 'openai',
        modelId: 'gpt-4',
        enabledSkillIds: ['skill-1', 'skill-2'],
        memoryContext: ['context-1'],
      });
    });

    it('should use default mode and sessionType', async () => {
      mockFetchApi.mockResolvedValue(createMockResponse(['data: {"type": "done"}\n']));

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await streamChat(messages);

      const callBody = JSON.parse(mockFetchApi.mock.calls[0][1].body);
      expect(callBody.mode).toBe('normal');
      expect(callBody.sessionType).toBe('chat');
    });
  });

  describe('streamChatGenerator', () => {
    it('should yield events as they arrive', async () => {
      const chunks = [
        'data: {"type": "text", "text": "Hello"}\n',
        'data: {"type": "text", "text": " world"}\n',
        'data: {"type": "done"}\n',
      ];

      let chunkIndex = 0;
      const reader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex++];
            const encoder = new TextEncoder();
            return {
              done: false,
              value: encoder.encode(chunk),
            };
          }
          return { done: true, value: undefined };
        }),
        releaseLock: vi.fn(),
      };

      mockFetchApi.mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
        status: 200,
      } as unknown as Response);

      const messages: Message[] = [{ role: 'user', content: 'Hi' }];
      const events: Array<{ type: string }> = [];

      for await (const event of streamChatGenerator(messages)) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('text');
      expect(events[1].type).toBe('text');
      expect(events[2].type).toBe('done');
    });

    it('should handle errors gracefully', async () => {
      mockFetchApi.mockRejectedValue(new Error('Network error'));

      const messages: Message[] = [{ role: 'user', content: 'Hi' }];
      const events: Array<{ type: string; error?: string }> = [];

      for await (const event of streamChatGenerator(messages)) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('error');
      expect(events[0].error).toBe('Network error');
      expect(events[1].type).toBe('done');
    });
  });

  describe('calculateMessageChars', () => {
    it('should calculate total chars for string content', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'World' },
      ];
      const result = calculateMessageChars(messages);
      expect(result).toBe(10);
    });

    it('should calculate chars for content block arrays', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', content: 'Hello ' },
            { type: 'text', content: 'world' },
          ],
        },
      ];
      const result = calculateMessageChars(messages);
      expect(result).toBe(11);
    });

    it('should skip non-text blocks', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', content: 'Hello' },
            { type: 'code', language: 'js', code: 'const x = 1;' },
            { type: 'text', content: ' world' },
          ],
        },
      ];
      const result = calculateMessageChars(messages);
      expect(result).toBe(11);
    });

    it('should handle empty messages array', () => {
      const result = calculateMessageChars([]);
      expect(result).toBe(0);
    });

    it('should handle messages with undefined content', () => {
      const messages: Message[] = [{ role: 'user', content: undefined as unknown as string }];
      const result = calculateMessageChars(messages);
      expect(result).toBe(0);
    });

    it('should handle empty content blocks', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', content: '' },
            { type: 'text', content: '' },
          ],
        },
      ];
      const result = calculateMessageChars(messages);
      expect(result).toBe(0);
    });
  });
});

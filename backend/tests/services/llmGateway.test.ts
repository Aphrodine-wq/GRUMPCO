/**
 * LLM Gateway Unit Tests
 * 
 * Tests the core LLM gateway functionality without requiring real API keys.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally before imports
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('../../src/middleware/metrics.js', () => ({
  recordLlmStreamMetrics: vi.fn(),
}));

// Mock nim config
vi.mock('../../src/config/nim.js', () => ({
  getNimChatUrl: vi.fn(() => 'https://api.nim.nvidia.com/v1/chat/completions'),
}));

// Mock ai-core
vi.mock('@grump/ai-core', () => ({
  getStreamProvider: vi.fn(() => null),
  registerStreamProvider: vi.fn(),
}));

describe('LLM Gateway', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Provider Selection', () => {
    it('should throw for unsupported provider', async () => {
      const { getStream } = await import('../../src/services/llmGateway.js');
      const params = {
        model: 'glm-4',
        max_tokens: 100,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };
      await expect(async () => {
        const gen = getStream(params, { provider: 'zhipu' as 'nim' });
        for await (const _ of gen) {
          // consume
        }
      }).rejects.toThrow('Unsupported provider');
    });
  });

  describe('NIM Provider', () => {
    it('should format request correctly for NIM', async () => {
      // Create a mock response stream
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { getStream } = await import('../../src/services/llmGateway.js');
      
      const params = {
        model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        max_tokens: 1024,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const gen = getStream(params, { provider: 'nim' });
      const events: unknown[] = [];
      
      for await (const event of gen) {
        events.push(event);
      }

      // Verify fetch was called with correct structure
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('chat/completions');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toContain('Bearer');
      
      const body = JSON.parse(options.body);
      expect(body.stream).toBe(true);
      expect(body.messages[0].role).toBe('system');
    });

    it('should handle API errors with proper error events', async () => {
      // Disable retry to ensure error throws
      process.env.NIM_RETRY_ENABLED = 'false';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '{"error": "Unauthorized"}',
      });

      const { getStream } = await import('../../src/services/llmGateway.js');

      const params = {
        model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        max_tokens: 1024,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      // API errors throw exceptions that should be caught by caller
      await expect(async () => {
        const gen = getStream(params, { provider: 'nim' });
        for await (const _ of gen) {
          // consume
        }
      }).rejects.toThrow('NVIDIA NIM API error');
    });

    it('should handle network errors', async () => {
      // Disable retry to ensure error throws
      process.env.NIM_RETRY_ENABLED = 'false';

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { getStream } = await import('../../src/services/llmGateway.js');

      const params = {
        model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        max_tokens: 1024,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      // Network errors throw exceptions that should be caught by caller
      await expect(async () => {
        const gen = getStream(params, { provider: 'nim' });
        for await (const _ of gen) {
          // consume
        }
      }).rejects.toThrow('Network error');
    });
  });

  describe('Tool Handling', () => {
    it('should pass tools to the API correctly', async () => {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Using tool..."}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { getStream } = await import('../../src/services/llmGateway.js');
      
      const params = {
        model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        max_tokens: 1024,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Read a file' }],
        tools: [
          {
            name: 'read_file',
            description: 'Read contents of a file',
            input_schema: {
              type: 'object' as const,
              properties: {
                path: { type: 'string', description: 'File path' },
              },
              required: ['path'],
            },
          },
        ],
      };

      const gen = getStream(params, { provider: 'nim' });
      for await (const _ of gen) {
        // consume
      }

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.tools).toBeDefined();
      expect(body.tools[0].function.name).toBe('read_file');
    });
  });

  describe('Multimodal Content', () => {
    it('should handle image content correctly', async () => {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"I see an image"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
      });

      const { getStream } = await import('../../src/services/llmGateway.js');
      
      const params = {
        model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        max_tokens: 1024,
        system: 'You are helpful',
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: 'What is this?' },
              { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,abc123' } },
            ],
          },
        ],
      };

      const gen = getStream(params, { provider: 'nim' });
      for await (const _ of gen) {
        // consume
      }

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.messages[1].content).toBeInstanceOf(Array);
    });
  });
});

describe('LLM Gateway - Input Validation', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  it('should handle empty messages array (system message only)', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    
    const params = {
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
    };

    const gen = getStream(params, { provider: 'nim' });
    for await (const _ of gen) {
      // consume
    }
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle extremely long system prompts', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"OK"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    
    const longSystem = 'x'.repeat(100000); // 100K chars
    const params = {
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      max_tokens: 1024,
      system: longSystem,
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'nim' });
    for await (const _ of gen) {
      // Should not throw
    }

    expect(mockFetch).toHaveBeenCalled();
  });
});

describe.skip('Anthropic Provider', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('should format request correctly for Anthropic', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello from Claude"}}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    
    const params = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'anthropic' });
    const events: unknown[] = [];
    
    for await (const event of gen) {
      events.push(event);
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('test-anthropic-key');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(true);
    expect(body.system).toBe('You are helpful');
  });

  it('should handle tool use responses', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"content_block_start","content_block":{"type":"tool_use","id":"toolu_123","name":"read_file","input":{}}}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    
    const params = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Read a file' }],
      tools: [
        {
          name: 'read_file',
          description: 'Read a file',
          input_schema: { type: 'object' as const, properties: {} },
        },
      ],
    };

    const gen = getStream(params, { provider: 'anthropic' });
    const events: unknown[] = [];
    
    for await (const event of gen) {
      events.push(event);
    }

    expect(events.some((e: any) => 
      e.type === 'content_block_start' && 
      e.content_block?.type === 'tool_use'
    )).toBe(true);
  });

  it('should handle error events', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"error","error":{"message":"Overloaded"}}\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    
    const params = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'anthropic' });
    const events: unknown[] = [];
    
    for await (const event of gen) {
      events.push(event);
    }

    expect(events.some((e: any) => e.type === 'error')).toBe(true);
  });
});

describe('Stream Metrics', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
  });

  it('should record metrics on message_stop', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    const { recordLlmStreamMetrics } = await import('../../src/middleware/metrics.js');
    
    const params = {
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'nim' });
    for await (const _ of gen) {
      // consume
    }

    expect(recordLlmStreamMetrics).toHaveBeenCalled();
  });
});

describe('Default Model Selection', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('should use default model for NIM when not specified', async () => {
    process.env.NVIDIA_NIM_API_KEY = 'test-key';

    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream, getDefaultModelId } = await import('../../src/services/llmGateway.js');

    const params = {
      model: '',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'nim' });
    for await (const _ of gen) {
      // consume
    }

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.model).toBe(getDefaultModelId());
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('should handle no response body', async () => {
    process.env.NVIDIA_NIM_API_KEY = 'test-key';
    process.env.NIM_RETRY_ENABLED = 'false';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: null,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');

    const params = {
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    // Missing response body throws exception
    await expect(async () => {
      const gen = getStream(params, { provider: 'nim' });
      for await (const _ of gen) {
        // consume
      }
    }).rejects.toThrow('no response body');
  });

  it('should handle malformed JSON chunks gracefully', async () => {
    process.env.NVIDIA_NIM_API_KEY = 'test-key';
    
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {invalid json}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    
    const params = {
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    // Should not throw, just skip malformed chunks
    const gen = getStream(params, { provider: 'nim' });
    const events: unknown[] = [];
    for await (const event of gen) {
      events.push(event);
    }

    // Should have received valid content
    expect(events.some((e: any) => 
      e.type === 'content_block_delta' && 
      e.delta?.text === 'Hello'
    )).toBe(true);
  });

  it('should handle HTTP errors with proper error messages', async () => {
    process.env.NVIDIA_NIM_API_KEY = 'test-key';
    process.env.NIM_RETRY_ENABLED = 'false';

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'Service temporarily unavailable',
    });

    const { getStream } = await import('../../src/services/llmGateway.js');

    const params = {
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    // HTTP errors throw exceptions with status code and message
    await expect(async () => {
      const gen = getStream(params, { provider: 'nim' });
      for await (const _ of gen) {
        // consume
      }
    }).rejects.toThrow('NVIDIA NIM API error: 503');
  });
});

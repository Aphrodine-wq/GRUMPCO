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
    // Set up environment for tests
    process.env.NVIDIA_NIM_API_KEY = 'test-nim-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.TOGETHER_API_KEY = 'test-together-key';
    process.env.OLLAMA_HOST = 'localhost:11434';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Provider Selection', () => {
    it('should handle missing API key for Zhipu gracefully', async () => {
      delete process.env.ZHIPU_API_KEY;
      const { getStream } = await import('../../src/services/llmGateway.js');
      
      const params = {
        model: 'glm-4',
        max_tokens: 100,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };
      
      await expect(async () => {
        const gen = getStream(params, { provider: 'zhipu' });
        for await (const _ of gen) {
          // consume
        }
      }).rejects.toThrow('ZHIPU_API_KEY is not set');
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
        model: 'moonshotai/kimi-k2.5',
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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '{"error": "Unauthorized"}',
      });

      const { getStream } = await import('../../src/services/llmGateway.js');
      
      const params = {
        model: 'moonshotai/kimi-k2.5',
        max_tokens: 1024,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      await expect(async () => {
        const gen = getStream(params, { provider: 'nim' });
        for await (const _ of gen) {
          // consume
        }
      }).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { getStream } = await import('../../src/services/llmGateway.js');
      
      const params = {
        model: 'moonshotai/kimi-k2.5',
        max_tokens: 1024,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      await expect(async () => {
        const gen = getStream(params, { provider: 'nim' });
        for await (const _ of gen) {
          // consume
        }
      }).rejects.toThrow('Network error');
    });
  });

  describe('OpenRouter Provider', () => {
    it('should format request correctly for OpenRouter', async () => {
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
        model: 'anthropic/claude-3.5-sonnet',
        max_tokens: 1024,
        system: 'You are helpful',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const gen = getStream(params, { provider: 'openrouter' });
      for await (const _ of gen) {
        // consume
      }

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('openrouter.ai');
      expect(options.headers['Authorization']).toContain('Bearer');
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
        model: 'moonshotai/kimi-k2.5',
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
        model: 'moonshotai/kimi-k2.5',
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
      model: 'moonshotai/kimi-k2.5',
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
      model: 'moonshotai/kimi-k2.5',
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

describe('Groq Provider', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.GROQ_API_KEY = 'test-groq-key';
  });

  it('should format request correctly for Groq', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello from Groq"}}]}\n\n'));
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
      model: 'llama-3.1-70b-versatile',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'groq' });
    const events: unknown[] = [];
    
    for await (const event of gen) {
      events.push(event);
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer test-groq-key');
    
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(true);
    expect(body.model).toBe('llama-3.1-70b-versatile');
  });

  it('should use default model when not specified', async () => {
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
      model: '',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'groq' });
    for await (const _ of gen) {
      // consume
    }

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.model).toBe('llama-3.1-70b-versatile');
  });
});

describe('Together AI Provider', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.TOGETHER_API_KEY = 'test-together-key';
  });

  it('should format request correctly for Together AI', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello from Together"}}]}\n\n'));
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
      model: 'togethercomputer/llama-3-70b',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'together' });
    const events: unknown[] = [];
    
    for await (const event of gen) {
      events.push(event);
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.together.xyz/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer test-together-key');
    
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(true);
    expect(body.model).toBe('togethercomputer/llama-3-70b');
  });
});

describe('Ollama Provider', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.OLLAMA_HOST = 'localhost:11434';
  });

  it('should format request correctly for Ollama', async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"content":"Hello from Ollama"}}\n'));
        controller.enqueue(encoder.encode('{"message":{"content":""},"done":true}\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    
    const params = {
      model: 'llama3.1',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'ollama' });
    const events: unknown[] = [];
    
    for await (const event of gen) {
      events.push(event);
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(options.method).toBe('POST');
    
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(true);
    expect(body.model).toBe('llama3.1');
    expect(body.options.num_predict).toBe(1024);
  });

  it('should use custom OLLAMA_HOST when set', async () => {
    process.env.OLLAMA_HOST = '192.168.1.100:11434';
    
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"content":"Hello"}}\n'));
        controller.enqueue(encoder.encode('{"message":{"content":""},"done":true}\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { getStream } = await import('../../src/services/llmGateway.js');
    
    const params = {
      model: 'llama3.1',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const gen = getStream(params, { provider: 'ollama' });
    for await (const _ of gen) {
      // consume
    }

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('http://192.168.1.100:11434/api/chat');
  });
});

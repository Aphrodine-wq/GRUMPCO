import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Set up environment before importing app
process.env.ANTHROPIC_API_KEY = 'test_api_key_for_testing';
process.env.NODE_ENV = 'test';

// Mock Anthropic SDK before importing services
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
        stream: vi.fn(),
      },
    })),
  };
});

// Import app after mocks are set up
const { default: app } = await import('../../src/index.ts');

describe('Diagram Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/generate-diagram', () => {
    it('should generate diagram through full request flow', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const mockResponse = {
        content: [
          {
            type: 'text',
            text: '```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```',
          },
        ],
      };

      vi.mocked(mockClient.messages.create).mockResolvedValue(mockResponse as never);

      const response = await request(app)
        .post('/api/generate-diagram')
        .send({
          message: 'Create a simple flowchart',
          preferences: {
            diagramStyle: 'technical',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.mermaidCode).toContain('flowchart');
      expect(mockClient.messages.create).toHaveBeenCalled();
    });

    it('should handle Claude API errors gracefully', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const error: Error & { status?: number } = new Error('API Error');
      error.status = 503;
      vi.mocked(mockClient.messages.create).mockRejectedValue(error);

      const response = await request(app)
        .post('/api/generate-diagram')
        .send({
          message: 'Create a diagram',
        })
        .expect(503);

      expect(response.body.type).toBe('service_unavailable');
      expect(response.body.retryable).toBe(true);
    });

    it('should handle authentication errors', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const error: Error & { status?: number } = new Error('Invalid API key');
      error.status = 401;
      vi.mocked(mockClient.messages.create).mockRejectedValue(error);

      const response = await request(app)
        .post('/api/generate-diagram')
        .send({
          message: 'Create a diagram',
        })
        .expect(401);

      expect(response.body.type).toBe('auth_error');
      expect(response.body.retryable).toBe(false);
    });
  });

  describe('POST /api/generate-diagram-stream', () => {
    it('should stream diagram generation through SSE', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: '```mermaid\n' } };
          yield { type: 'content_block_delta', delta: { text: 'flowchart TD\n' } };
          yield { type: 'content_block_delta', delta: { text: '  A --> B\n' } };
          yield { type: 'content_block_delta', delta: { text: '```' } };
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(mockClient.messages.stream).mockReturnValue(mockStream as never);

      const response = await request(app)
        .post('/api/generate-diagram-stream')
        .send({
          message: 'Create a flowchart',
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.text).toContain('data:');
    });

    it('should handle client disconnect gracefully', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'chunk1' } };
          // Simulate abort
          await new Promise(resolve => setTimeout(resolve, 10));
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(mockClient.messages.stream).mockReturnValue(mockStream as never);

      const req = request(app)
        .post('/api/generate-diagram-stream')
        .send({
          message: 'Create a diagram',
        });

      // Simulate client disconnect
      setTimeout(() => {
        req.abort();
      }, 50);

      // Should not throw
      await req.catch(() => {
        // Expected on abort
      });
    });

    it('should include conversation history in request', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'test' } };
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(mockClient.messages.stream).mockReturnValue(mockStream as never);

      await request(app)
        .post('/api/generate-diagram-stream')
        .send({
          message: 'Refine the previous diagram',
          conversationHistory: [
            { role: 'user', content: 'Create a flowchart' },
            { role: 'assistant', content: 'Here is your diagram' },
          ],
        })
        .expect(200);

      const callArgs = vi.mocked(mockClient.messages.stream).mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
      expect(Array.isArray(callArgs.messages)).toBe(true);
      expect(callArgs.messages.length).toBeGreaterThan(1);
    });
  });
});

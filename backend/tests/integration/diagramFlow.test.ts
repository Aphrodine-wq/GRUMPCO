import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import supertest from 'supertest';

const request = supertest as unknown as (app: any) => any;

// Set up environment before importing app
process.env.ANTHROPIC_API_KEY = 'test_api_key_for_testing';
process.env.NVIDIA_NIM_API_KEY = 'test_nim_key';
process.env.NODE_ENV = 'test';
process.env.CSRF_PROTECTION = 'false'; // Disable CSRF for tests
process.env.REQUIRE_AUTH_FOR_API = 'false'; // Disable auth requirement for tests

// Mock the LLM gateway to prevent real API calls
const mockStreamLLM = vi.fn();
const mockGetStream = vi.fn();

vi.mock('../../src/services/llmGateway.js', () => ({
  streamLLM: mockStreamLLM,
  getStream: mockGetStream,
  COPILOT_SUB_MODELS: ['copilot-codex', 'copilot-codebase'],
}));

// Import app after mocks are set up
const { default: app, appReady } = await import('../../src/index.ts');

describe('Diagram Flow Integration', () => {
  beforeAll(async () => {
    await appReady;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation
    mockGetStream.mockImplementation(async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```' } };
      yield { type: 'message_stop' };
    });
    
    mockStreamLLM.mockImplementation(async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```' } };
      yield { type: 'message_stop' };
    });
  });

  describe('POST /api/generate-diagram', () => {
    it('should generate diagram through full request flow', async () => {
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
    });

    it('should handle API errors gracefully', async () => {
      mockGetStream.mockImplementation(async function* () {
        const error: Error & { status?: number; code?: string } = new Error('API Error');
        error.status = 503;
        throw error;
      });

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
      mockGetStream.mockImplementation(async function* () {
        const error: Error & { status?: number } = new Error('Invalid API key');
        error.status = 401;
        throw error;
      });

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
      const response = await request(app)
        .post('/api/generate-diagram-stream')
        .send({
          message: 'Refine the previous diagram',
          conversationHistory: [
            { role: 'user', content: 'Create a flowchart' },
            { role: 'assistant', content: 'Here is your diagram' },
          ],
        })
        .expect(200);

      // Verify we get a streaming response
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.text).toBeDefined();
    });
  });
});

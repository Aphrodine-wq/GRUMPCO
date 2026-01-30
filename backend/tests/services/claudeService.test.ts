import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDiagram, generateDiagramStream } from '../../src/services/claudeService.ts';
import * as mermaidUtils from '../../src/services/mermaidUtils.ts';
import * as intentParser from '../../src/services/intentParser.ts';

const mockClaudeClient = vi.hoisted(() => ({
  messages: {
    create: vi.fn(),
    stream: vi.fn(),
  },
}));

// Mock dependencies
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(() => mockClaudeClient),
  };
});

vi.mock('../../src/services/mermaidUtils.ts', () => ({
  extractMermaidCode: vi.fn(),
  validateMermaidCode: vi.fn(),
}));

vi.mock('../../src/services/intentParser.ts', () => ({
  analyzeIntent: vi.fn(),
  getIntentAugmentation: vi.fn(),
}));

vi.mock('../../src/services/llmGateway.ts', () => ({
  getStream: vi.fn(),
}));

vi.mock('../../src/middleware/logger.ts', () => ({
  getRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/middleware/metrics.ts', () => ({
  createApiTimer: vi.fn(() => ({
    success: vi.fn(),
    failure: vi.fn(),
  })),
  updateCircuitState: vi.fn(),
}));

vi.mock('../../src/prompts/index.ts', () => ({
  getSystemPrompt: vi.fn(() => 'System prompt'),
}));

describe('claudeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClaudeClient.messages.create.mockReset();
    mockClaudeClient.messages.stream.mockReset();
    // Set required env var
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  describe('generateDiagram', () => {
    it('should generate diagram from valid response', async () => {
      const { getStream } = await import('../../src/services/llmGateway.ts');

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '```mermaid\nflowchart TD\n  A --> B\n```' } };
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(getStream).mockReturnValue(mockStream as never);
      vi.mocked(mermaidUtils.extractMermaidCode).mockReturnValue({
        extracted: true,
        code: 'flowchart TD\n  A --> B',
        method: 'mermaid_block',
      });
      vi.mocked(intentParser.analyzeIntent).mockReturnValue({
        isValid: true,
        confidence: 0.9,
        suggestedType: 'flowchart',
        constraints: {},
        requiresClarification: false,
      });
      vi.mocked(intentParser.getIntentAugmentation).mockReturnValue(null);

      const result = await generateDiagram('Create a flowchart');

      expect(result).toBe('flowchart TD\n  A --> B');
      expect(getStream).toHaveBeenCalled();
    });

    it('should handle extraction failure', async () => {
      const { getStream } = await import('../../src/services/llmGateway.ts');

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'I cannot create a diagram for this request.' } };
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(getStream).mockReturnValue(mockStream as never);
      vi.mocked(mermaidUtils.extractMermaidCode).mockReturnValue({
        extracted: false,
        code: null,
        method: 'none',
      });
      vi.mocked(intentParser.analyzeIntent).mockReturnValue({
        isValid: true,
        confidence: 0.5,
        suggestedType: null,
        constraints: {},
        requiresClarification: true,
      });

      await expect(generateDiagram('Invalid request')).rejects.toThrow();
    });

    it('should include conversation history', async () => {
      const { getStream } = await import('../../src/services/llmGateway.ts');

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '```mermaid\nflowchart TD\n  A --> B\n```' } };
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(getStream).mockReturnValue(mockStream as never);
      vi.mocked(mermaidUtils.extractMermaidCode).mockReturnValue({
        extracted: true,
        code: 'flowchart TD\n  A --> B',
        method: 'mermaid_block',
      });
      vi.mocked(intentParser.analyzeIntent).mockReturnValue({
        isValid: true,
        confidence: 0.9,
        suggestedType: 'flowchart',
        constraints: {},
        requiresClarification: false,
      });

      const conversationHistory = [
        { role: 'user' as const, content: 'First message' },
        { role: 'assistant' as const, content: 'First response' },
      ];

      await generateDiagram('Create a diagram', undefined, conversationHistory);

      expect(getStream).toHaveBeenCalled();
      const callArgs = vi.mocked(getStream).mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
      expect(Array.isArray(callArgs.messages)).toBe(true);
    });
  });

  describe('generateDiagramStream', () => {
    it('should stream diagram chunks', async () => {
      const { getStream } = await import('../../src/services/llmGateway.ts');

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '```mermaid\n' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'flowchart TD\n' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '  A --> B\n' } };
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '```' } };
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(getStream).mockReturnValue(mockStream as never);
      vi.mocked(intentParser.analyzeIntent).mockReturnValue({
        isValid: true,
        confidence: 0.9,
        suggestedType: 'flowchart',
        constraints: {},
        requiresClarification: false,
      });

      const chunks: string[] = [];
      for await (const chunk of generateDiagramStream('Create a flowchart')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('flowchart');
    });

    it('should handle abort signal', async () => {
      const { getStream } = await import('../../src/services/llmGateway.ts');

      const abortController = new AbortController();
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'chunk1' } };
          abortController.abort();
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'chunk2' } };
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(getStream).mockReturnValue(mockStream as never);
      vi.mocked(intentParser.analyzeIntent).mockReturnValue({
        isValid: true,
        confidence: 0.9,
        suggestedType: 'flowchart',
        constraints: {},
        requiresClarification: false,
      });

      const chunks: string[] = [];
      for await (const chunk of generateDiagramStream(
        'Create a flowchart',
        undefined,
        abortController.signal
      )) {
        chunks.push(chunk);
      }

      // Should stop after abort
      expect(chunks.length).toBeLessThanOrEqual(1);
    });
  });
});

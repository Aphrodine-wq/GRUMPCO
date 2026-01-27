import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDiagram, generateDiagramStream } from '../../src/services/claudeService.ts';
import * as mermaidUtils from '../../src/services/mermaidUtils.ts';
import * as intentParser from '../../src/services/intentParser.ts';

// Mock dependencies
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

vi.mock('../../src/services/mermaidUtils.ts', () => ({
  extractMermaidCode: vi.fn(),
  validateMermaidCode: vi.fn(),
}));

vi.mock('../../src/services/intentParser.ts', () => ({
  analyzeIntent: vi.fn(),
  getIntentAugmentation: vi.fn(),
}));

vi.mock('../../src/middleware/logger.ts', () => ({
  getRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/middleware/metrics.ts', () => ({
  createApiTimer: vi.fn(() => ({
    success: vi.fn(),
    failure: vi.fn(),
  })),
}));

vi.mock('../../src/prompts/index.ts', () => ({
  getSystemPrompt: vi.fn(() => 'System prompt'),
}));

describe('claudeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required env var
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  describe('generateDiagram', () => {
    it('should generate diagram from valid response', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const mockResponse = {
        content: [
          {
            type: 'text',
            text: '```mermaid\nflowchart TD\n  A --> B\n```',
          },
        ],
      };

      vi.mocked(mockClient.messages.create).mockResolvedValue(mockResponse as never);
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
      expect(mockClient.messages.create).toHaveBeenCalled();
    });

    it('should handle extraction failure', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'I cannot create a diagram for this request.',
          },
        ],
      };

      vi.mocked(mockClient.messages.create).mockResolvedValue(mockResponse as never);
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
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const mockResponse = {
        content: [
          {
            type: 'text',
            text: '```mermaid\nflowchart TD\n  A --> B\n```',
          },
        ],
      };

      vi.mocked(mockClient.messages.create).mockResolvedValue(mockResponse as never);
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

      const callArgs = vi.mocked(mockClient.messages.create).mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
      expect(Array.isArray(callArgs.messages)).toBe(true);
    });
  });

  describe('generateDiagramStream', () => {
    it('should stream diagram chunks', async () => {
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
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockClient = new Anthropic({ apiKey: 'test-key' });

      const abortController = new AbortController();
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'chunk1' } };
          abortController.abort();
          yield { type: 'content_block_delta', delta: { text: 'chunk2' } };
        },
        controller: {
          abort: vi.fn(),
        },
      };

      vi.mocked(mockClient.messages.stream).mockReturnValue(mockStream as never);
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

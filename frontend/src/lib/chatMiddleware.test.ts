/**
 * Chat Middleware Tests
 *
 * Tests for chat middleware including verdict command processing,
 * message transformation, and middleware chaining
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  processMessageWithVerdictSupport,
  verdictMiddleware,
  getVerdictCommandsHelp,
  VerdictCommands,
} from './chatMiddleware';
import {
  detectVerdictCommand,
  formatVerdictAsMessage,
  generateMockVerdict,
} from './verdictChatIntegration';

// Mock the verdictChatIntegration module
vi.mock('./verdictChatIntegration', () => ({
  detectVerdictCommand: vi.fn(),
  formatVerdictAsMessage: vi.fn(),
  generateMockVerdict: vi.fn(),
}));

const mockDetectVerdictCommand = detectVerdictCommand as ReturnType<typeof vi.fn>;
const mockFormatVerdictAsMessage = formatVerdictAsMessage as ReturnType<typeof vi.fn>;
const mockGenerateMockVerdict = generateMockVerdict as ReturnType<typeof vi.fn>;

describe('chatMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processMessageWithVerdictSupport', () => {
    it('should pass through non-verdict messages', async () => {
      mockDetectVerdictCommand.mockReturnValue({ type: 'none', query: 'Hello' });

      const result = await processMessageWithVerdictSupport('Hello world');

      expect(result).toEqual({ isVerdictCommand: false });
      expect(mockDetectVerdictCommand).toHaveBeenCalledWith('Hello world');
    });

    it('should detect verdict command', async () => {
      mockDetectVerdictCommand.mockReturnValue({
        type: 'verdict',
        query: "what's the verdict on AI",
      });
      mockGenerateMockVerdict.mockReturnValue({ verdict: 'BuildNow' });

      const onVerdictDetected = vi.fn();
      const result = await processMessageWithVerdictSupport(
        "what's the verdict on AI",
        onVerdictDetected
      );

      expect(result.isVerdictCommand).toBe(true);
      expect(result.transformedMessage).toContain('verdict engine');
      expect(mockGenerateMockVerdict).toHaveBeenCalled();
      expect(onVerdictDetected).toHaveBeenCalled();
    });

    it('should handle verdict command without callback', async () => {
      mockDetectVerdictCommand.mockReturnValue({
        type: 'verdict',
        query: "what's the verdict",
      });

      const result = await processMessageWithVerdictSupport("what's the verdict");

      expect(result.isVerdictCommand).toBe(true);
      expect(mockGenerateMockVerdict).not.toHaveBeenCalled();
    });

    it('should transform message for verdict commands', async () => {
      mockDetectVerdictCommand.mockReturnValue({
        type: 'verdict',
        query: 'analyze this startup',
      });

      const result = await processMessageWithVerdictSupport('analyze this startup');

      expect(result.isVerdictCommand).toBe(true);
      expect(result.transformedMessage).toBe(
        "I'll analyze this using the verdict engine: analyze this startup"
      );
    });

    it('should handle different command types', async () => {
      const commandTypes = ['verdict', 'network', 'batch', 'market'];

      for (const type of commandTypes) {
        mockDetectVerdictCommand.mockReturnValue({
          type,
          query: `${type} test query`,
        });

        const result = await processMessageWithVerdictSupport(`${type} test query`);

        expect(result.isVerdictCommand).toBe(true);
      }
    });
  });

  describe('verdictMiddleware', () => {
    it('should return false for non-verdict messages', async () => {
      mockDetectVerdictCommand.mockReturnValue({ type: 'none', query: 'Hello' });

      const onVerdictResult = vi.fn();
      const result = await verdictMiddleware('Hello world', onVerdictResult);

      expect(result).toBe(false);
      expect(onVerdictResult).not.toHaveBeenCalled();
    });

    it('should return true and call callback for verdict commands', async () => {
      const mockVerdict = { verdict: 'BuildNow' };
      const mockBlocks = [{ type: 'text', content: 'Verdict: BuildNow' }];

      mockDetectVerdictCommand.mockReturnValue({
        type: 'verdict',
        query: "what's the verdict",
      });
      mockGenerateMockVerdict.mockReturnValue(mockVerdict);
      mockFormatVerdictAsMessage.mockReturnValue(mockBlocks);

      const onVerdictResult = vi.fn();
      const result = await verdictMiddleware("what's the verdict", onVerdictResult);

      expect(result).toBe(true);
      expect(mockGenerateMockVerdict).toHaveBeenCalledWith("what's the verdict");
      expect(mockFormatVerdictAsMessage).toHaveBeenCalledWith(mockVerdict);
      expect(onVerdictResult).toHaveBeenCalledWith(mockBlocks);
    });

    it('should handle analyze command', async () => {
      mockDetectVerdictCommand.mockReturnValue({
        type: 'verdict',
        query: 'analyze @alice-dev',
      });
      mockGenerateMockVerdict.mockReturnValue({ verdict: 'AnalyzeResult' });
      mockFormatVerdictAsMessage.mockReturnValue([]);

      const onVerdictResult = vi.fn();
      await verdictMiddleware('analyze @alice-dev', onVerdictResult);

      expect(mockDetectVerdictCommand).toHaveBeenCalledWith('analyze @alice-dev');
    });

    it('should handle network command', async () => {
      mockDetectVerdictCommand.mockReturnValue({
        type: 'network',
        query: 'network analysis for alice',
      });
      mockGenerateMockVerdict.mockReturnValue({ verdict: 'NetworkResult' });
      mockFormatVerdictAsMessage.mockReturnValue([]);

      const onVerdictResult = vi.fn();
      await verdictMiddleware('network analysis for alice', onVerdictResult);

      expect(mockDetectVerdictCommand).toHaveBeenCalledWith('network analysis for alice');
    });

    it('should handle batch command', async () => {
      mockDetectVerdictCommand.mockReturnValue({
        type: 'batch',
        query: 'batch upload founders.csv',
      });
      mockGenerateMockVerdict.mockReturnValue({ verdict: 'BatchResult' });
      mockFormatVerdictAsMessage.mockReturnValue([]);

      const onVerdictResult = vi.fn();
      await verdictMiddleware('batch upload founders.csv', onVerdictResult);

      expect(mockDetectVerdictCommand).toHaveBeenCalledWith('batch upload founders.csv');
    });

    it('should handle market command', async () => {
      mockDetectVerdictCommand.mockReturnValue({
        type: 'market',
        query: 'market check for AI',
      });
      mockGenerateMockVerdict.mockReturnValue({ verdict: 'MarketResult' });
      mockFormatVerdictAsMessage.mockReturnValue([]);

      const onVerdictResult = vi.fn();
      await verdictMiddleware('market check for AI', onVerdictResult);

      expect(mockDetectVerdictCommand).toHaveBeenCalledWith('market check for AI');
    });
  });

  describe('VerdictCommands', () => {
    it('should have analyze command with correct pattern', () => {
      expect(VerdictCommands.analyze).toBeDefined();
      expect(VerdictCommands.analyze.description).toBe('Analyze a founder or startup idea');
      expect(VerdictCommands.analyze.example).toBe('analyze @alice-dev for SaaS platform');
      expect(VerdictCommands.analyze.pattern).toBeInstanceOf(RegExp);

      // Test pattern
      const match = 'analyze @alice-dev for SaaS platform'.match(VerdictCommands.analyze.pattern);
      expect(match).toBeTruthy();
    });

    it('should have verdict command with correct pattern', () => {
      expect(VerdictCommands.verdict).toBeDefined();
      expect(VerdictCommands.verdict.description).toBe('Get verdict for a market or idea');
      expect(VerdictCommands.verdict.example).toBe("what's the verdict on AI developer tools?");
      expect(VerdictCommands.verdict.pattern).toBeInstanceOf(RegExp);

      const match = "what's the verdict on AI?".match(VerdictCommands.verdict.pattern);
      expect(match).toBeTruthy();
    });

    it('should have network command with correct pattern', () => {
      expect(VerdictCommands.network).toBeDefined();
      expect(VerdictCommands.network.description).toBe('Analyze founder network');
      expect(VerdictCommands.network.example).toBe('network analysis for alice-chen');
      expect(VerdictCommands.network.pattern).toBeInstanceOf(RegExp);

      const match = 'network analysis for alice-chen'.match(VerdictCommands.network.pattern);
      expect(match).toBeTruthy();
    });

    it('should have market command with correct pattern', () => {
      expect(VerdictCommands.market).toBeDefined();
      expect(VerdictCommands.market.description).toBe('Check market opportunity');
      expect(VerdictCommands.market.example).toBe('market check for enterprise AI');
      expect(VerdictCommands.market.pattern).toBeInstanceOf(RegExp);

      const match = 'market check for enterprise AI'.match(VerdictCommands.market.pattern);
      expect(match).toBeTruthy();
    });

    it('should have batch command with correct pattern', () => {
      expect(VerdictCommands.batch).toBeDefined();
      expect(VerdictCommands.batch.description).toBe('Process multiple founders');
      expect(VerdictCommands.batch.example).toBe('batch upload founders.csv');
      expect(VerdictCommands.batch.pattern).toBeInstanceOf(RegExp);

      const match = 'batch upload founders.csv'.match(VerdictCommands.batch.pattern);
      expect(match).toBeTruthy();
    });

    it('should match analyze command variations', () => {
      // Pattern requires @handle format: /analyze\s+(@[\w-]+)?\s+(?:for\s+)?(.+)/i
      const variations = [
        'analyze @alice-dev for SaaS platform',
        'analyze @alice-dev SaaS platform',
        'analyze @user123 for some idea',
      ];

      variations.forEach((text) => {
        const match = text.match(VerdictCommands.analyze.pattern);
        expect(match).toBeTruthy();
      });
    });

    it('should match verdict command variations', () => {
      // Pattern: /what'?s?\s+(?:the\s+)?verdict\s+on\s+(.+)/i
      // Supports: "what's", "whats", "what"
      const variations = [
        "what's the verdict on AI?",
        'whats the verdict on AI?',
        'what verdict on this idea',
      ];

      variations.forEach((text) => {
        const match = text.match(VerdictCommands.verdict.pattern);
        expect(match).toBeTruthy();
      });
    });
  });

  describe('getVerdictCommandsHelp', () => {
    it('should return help text with all commands', () => {
      const help = getVerdictCommandsHelp();

      expect(help).toContain('Verdict Engine Commands');
      expect(help).toContain('analyze');
      expect(help).toContain('verdict');
      expect(help).toContain('network');
      expect(help).toContain('market');
      expect(help).toContain('batch');
    });

    it('should include descriptions for each command', () => {
      const help = getVerdictCommandsHelp();

      expect(help).toContain('Analyze a founder or startup idea');
      expect(help).toContain('Get verdict for a market or idea');
    });

    it('should include examples for each command', () => {
      const help = getVerdictCommandsHelp();

      expect(help).toContain('analyze @alice-dev for SaaS platform');
      expect(help).toContain("what's the verdict on AI developer tools?");
    });

    it('should format with markdown', () => {
      const help = getVerdictCommandsHelp();

      expect(help).toContain('**');
      expect(help).toContain('🎯');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  KIMI_K25_CONFIG,
  containsNonEnglish,
  calculateKimiContextRetention,
  optimizePromptForKimi,
  shouldRouteToKimi,
  estimateKimiSavings,
  optimizeConversationForKimi,
  getKimiTaskConfig,
  getKimiRoutingDecision,
  type KimiRoutingInput,
} from '../../src/services/kimiOptimizer.js';

// Mock the logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('kimiOptimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('KIMI_K25_CONFIG', () => {
    it('should have correct model configuration', () => {
      expect(KIMI_K25_CONFIG.modelId).toBe('moonshotai/kimi-k2.5');
      expect(KIMI_K25_CONFIG.contextWindow).toBe(256_000);
      expect(KIMI_K25_CONFIG.maxInputTokens).toBe(240_000);
      expect(KIMI_K25_CONFIG.contextAdvantage).toBe(56_000);
    });

    it('should have correct temperature settings', () => {
      expect(KIMI_K25_CONFIG.temperature.coding).toBe(0.1);
      expect(KIMI_K25_CONFIG.temperature.creative).toBe(0.7);
      expect(KIMI_K25_CONFIG.temperature.default).toBe(0.3);
    });

    it('should have token efficiency defined', () => {
      expect(KIMI_K25_CONFIG.tokenEfficiency).toBe(0.95);
    });
  });

  describe('containsNonEnglish', () => {
    it('should detect Chinese characters', () => {
      expect(containsNonEnglish('Hello 你好')).toBe(true);
      expect(containsNonEnglish('这是中文')).toBe(true);
    });

    it('should detect Japanese hiragana', () => {
      expect(containsNonEnglish('こんにちは')).toBe(true);
    });

    it('should detect Japanese katakana', () => {
      expect(containsNonEnglish('コンピューター')).toBe(true);
    });

    it('should detect Korean characters', () => {
      expect(containsNonEnglish('안녕하세요')).toBe(true);
    });

    it('should detect Arabic characters', () => {
      expect(containsNonEnglish('مرحبا')).toBe(true);
    });

    it('should detect Cyrillic characters', () => {
      expect(containsNonEnglish('Привет')).toBe(true);
    });

    it('should detect Hindi/Devanagari characters', () => {
      expect(containsNonEnglish('नमस्ते')).toBe(true);
    });

    it('should return false for English only', () => {
      expect(containsNonEnglish('Hello World')).toBe(false);
      expect(containsNonEnglish('This is a test')).toBe(false);
    });

    it('should return false for numbers and punctuation', () => {
      expect(containsNonEnglish('123 test! @#$')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(containsNonEnglish('')).toBe(false);
    });
  });

  describe('calculateKimiContextRetention', () => {
    it('should recommend adding context when under Claude limit', () => {
      const result = calculateKimiContextRetention(100_000);
      
      expect(result.retainTokens).toBe(100_000);
      expect(result.advantageUsed).toBe(0);
      expect(result.recommendation).toBe('Can add up to 56K more tokens of context');
    });

    it('should use Kimi advantage when between Claude and Kimi limits', () => {
      const result = calculateKimiContextRetention(220_000);
      
      expect(result.retainTokens).toBe(220_000);
      expect(result.advantageUsed).toBe(20_000);
      expect(result.recommendation).toContain('Using 20000 of 56000 extra tokens');
    });

    it('should truncate when exceeding Kimi limit', () => {
      const result = calculateKimiContextRetention(250_000);
      
      expect(result.retainTokens).toBe(240_000);
      expect(result.advantageUsed).toBe(56_000);
      expect(result.recommendation).toContain('Truncating to 240000 tokens');
    });

    it('should use custom max tokens for comparison', () => {
      const result = calculateKimiContextRetention(150_000, 100_000);
      
      expect(result.retainTokens).toBe(150_000);
      expect(result.advantageUsed).toBe(50_000);
    });

    it('should handle edge case at Claude limit exactly', () => {
      const result = calculateKimiContextRetention(200_000);
      
      expect(result.retainTokens).toBe(200_000);
      expect(result.advantageUsed).toBe(0);
      expect(result.recommendation).toBe('Can add up to 56K more tokens of context');
    });

    it('should handle edge case at Kimi limit exactly', () => {
      const result = calculateKimiContextRetention(240_000);
      
      expect(result.retainTokens).toBe(240_000);
      expect(result.advantageUsed).toBe(40_000);
    });
  });

  describe('optimizePromptForKimi', () => {
    it('should add output format guidance if not present', () => {
      const result = optimizePromptForKimi('You are a helpful assistant.', 'Hello');
      
      expect(result.optimizedSystem).toContain('## Output Format');
      expect(result.optimizations).toContain('Added output format guidance');
    });

    it('should not add output format if already present', () => {
      const system = 'You are a helpful assistant.\n## Output Format\nProvide clear responses.';
      const result = optimizePromptForKimi(system, 'Hello');
      
      expect(result.optimizations).not.toContain('Added output format guidance');
    });

    it('should add multilingual support for non-English content', () => {
      const result = optimizePromptForKimi('You are a helper.', '你好，请帮助我');
      
      expect(result.optimizedSystem).toContain('## Multilingual Support');
      expect(result.optimizations).toContain('Added multilingual support instruction');
    });

    it('should detect Chinese content specifically', () => {
      const result = optimizePromptForKimi('Assistant prompt', '这是中文内容');
      
      expect(result.optimizations).toContain('Chinese content detected - using optimized processing');
    });

    it('should note long content without structure', () => {
      const longContent = 'A'.repeat(11000);
      const result = optimizePromptForKimi('Prompt', longContent);
      
      expect(result.optimizations).toContain('Content is long but lacks structure');
    });

    it('should not note long content if it has headers', () => {
      const longContent = '# Header\n' + 'A'.repeat(11000);
      const result = optimizePromptForKimi('Prompt', longContent);
      
      expect(result.optimizations).not.toContain('Content is long but lacks structure');
    });

    it('should not note long non-English content', () => {
      const longContent = '这' + 'A'.repeat(11000);
      const result = optimizePromptForKimi('Prompt', longContent);
      
      expect(result.optimizations).not.toContain('Content is long but lacks structure');
    });

    it('should return original user content', () => {
      const userContent = 'Original content here';
      const result = optimizePromptForKimi('Prompt', userContent);
      
      expect(result.optimizedUser).toBe(userContent);
    });
  });

  describe('shouldRouteToKimi', () => {
    it('should recommend Kimi for multilingual content', () => {
      const result = shouldRouteToKimi({
        content: '请生成代码',
        requiresTools: false,
        isComplex: false,
        hasImage: false,
        isCodeGeneration: false,
      });
      
      expect(result.useKimi).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      expect(result.reasons).toContain('Multilingual content detected');
    });

    it('should recommend Kimi for code generation without tools', () => {
      const result = shouldRouteToKimi({
        content: 'Write a function to sort an array',
        requiresTools: false,
        isComplex: false,
        hasImage: false,
        isCodeGeneration: true,
      });
      
      expect(result.reasons).toContain('Code generation without tools - Kimi is 5x cheaper');
    });

    it('should recommend Kimi for long context', () => {
      const result = shouldRouteToKimi({
        content: 'A'.repeat(160000),
        requiresTools: false,
        isComplex: false,
        hasImage: false,
        isCodeGeneration: false,
      });
      
      expect(result.reasons).toContain("Long context - using Kimi's 256K window");
    });

    it('should recommend Kimi for simple tasks', () => {
      const result = shouldRouteToKimi({
        content: 'What is 2+2?',
        requiresTools: false,
        isComplex: false,
        hasImage: false,
        isCodeGeneration: false,
      });
      
      expect(result.reasons).toContain('Simple task - cost optimization with Kimi');
    });

    it('should add confidence for vision tasks', () => {
      const result = shouldRouteToKimi({
        content: 'Describe this image',
        requiresTools: false,
        isComplex: false,
        hasImage: true,
        isCodeGeneration: false,
      });
      
      expect(result.reasons).toContain('Vision task - Kimi has vision capabilities');
    });

    it('should reduce confidence when tools are required', () => {
      const result = shouldRouteToKimi({
        content: 'Run this command',
        requiresTools: true,
        isComplex: false,
        hasImage: false,
        isCodeGeneration: false,
      });
      expect(result.reasons).toContain('Note: Tool use may benefit from Llama 405B for complex scenarios');
    });

    it('should cap confidence at 1.0', () => {
      const result = shouldRouteToKimi({
        content: '请帮我写代码 ' + 'A'.repeat(160000),
        requiresTools: false,
        isComplex: false,
        hasImage: true,
        isCodeGeneration: true,
      });
      
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should not recommend Kimi when confidence is low', () => {
      const result = shouldRouteToKimi({
        content: 'Complex task with tools',
        requiresTools: true,
        isComplex: true,
        hasImage: false,
        isCodeGeneration: false,
      });
      
      expect(result.useKimi).toBe(false);
    });
  });

  describe('estimateKimiSavings', () => {
    it('should calculate costs and savings correctly', () => {
      const result = estimateKimiSavings(1_000_000, 500_000);

      // Llama 405B: (1M * $5/M) + (0.5M * $15/M) = $5 + $7.5 = $12.5
      expect(result.llama405bCost).toBeCloseTo(12.5, 2);

      // Kimi: (1M * $0.6/M) + (0.5M * $0.6/M) = $0.6 + $0.3 = $0.9
      expect(result.kimiCost).toBeCloseTo(0.9, 2);

      // Savings: $12.5 - $0.9 = $11.6
      expect(result.savings).toBeCloseTo(11.6, 2);

      // Savings percent: (11.6 / 12.5) * 100 ≈ 92.8%
      expect(result.savingsPercent).toBeGreaterThan(90);
    });

    it('should handle request count multiplier', () => {
      const singleResult = estimateKimiSavings(1_000_000, 500_000, 1);
      const tripleResult = estimateKimiSavings(1_000_000, 500_000, 3);
      expect(tripleResult.llama405bCost).toBeCloseTo(singleResult.llama405bCost * 3, 2);
      expect(tripleResult.kimiCost).toBeCloseTo(singleResult.kimiCost * 3, 2);
      expect(tripleResult.savings).toBeCloseTo(singleResult.savings * 3, 2);
    });

    it('should handle zero tokens', () => {
      const result = estimateKimiSavings(0, 0);
      expect(result.llama405bCost).toBe(0);
      expect(result.kimiCost).toBe(0);
      expect(result.savings).toBe(0);
      expect(result.savingsPercent).toBe(0);
    });

    it('should handle small token counts', () => {
      const result = estimateKimiSavings(1000, 500);
      expect(result.llama405bCost).toBeGreaterThan(0);
      expect(result.kimiCost).toBeGreaterThan(0);
      expect(result.savings).toBeGreaterThan(0);
    });
  });

  describe('optimizeConversationForKimi', () => {
    const createMessage = (role: 'user' | 'assistant', content: string) => ({ role, content });

    it('should return all messages when under Claude limit', () => {
      const messages = [
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi there'),
      ];
      
      const result = optimizeConversationForKimi(messages, 50_000);
      
      expect(result.optimizedMessages).toEqual(messages);
      expect(result.tokensRetained).toBe(50_000);
      expect(result.advantageUtilized).toBe(false);
      expect(result.summary).toBeUndefined();
    });

    it('should utilize advantage when between Claude and Kimi limits', () => {
      const messages = [createMessage('user', 'Hello')];
      
      const result = optimizeConversationForKimi(messages, 220_000);
      
      expect(result.optimizedMessages).toEqual(messages);
      expect(result.tokensRetained).toBe(220_000);
      expect(result.advantageUtilized).toBe(true);
    });

    it('should truncate to recent messages when exceeding Kimi limit', () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`)
      );
      
      const result = optimizeConversationForKimi(messages, 250_000);
      
      expect(result.optimizedMessages.length).toBe(20);
      expect(result.tokensRetained).toBe(240_000);
      expect(result.advantageUtilized).toBe(true);
      expect(result.summary).toContain('Retained 20 most recent messages');
    });

    it('should keep last 20 messages when truncating', () => {
      const messages = Array.from({ length: 30 }, (_, i) =>
        createMessage('user', `Message ${i}`)
      );
      
      const result = optimizeConversationForKimi(messages, 250_000);
      
      expect(result.optimizedMessages[0]).toEqual(createMessage('user', 'Message 10'));
      expect(result.optimizedMessages[19]).toEqual(createMessage('user', 'Message 29'));
    });

    it('should handle empty messages array', () => {
      const result = optimizeConversationForKimi([], 0);
      
      expect(result.optimizedMessages).toEqual([]);
      expect(result.tokensRetained).toBe(0);
      expect(result.advantageUtilized).toBe(false);
    });
  });

  describe('getKimiTaskConfig', () => {
    it('should return coding config', () => {
      const config = getKimiTaskConfig('coding');
      
      expect(config.temperature).toBe(0.1);
      expect(config.maxTokens).toBe(8192);
      expect(config.topP).toBe(0.95);
      expect(config.presencePenalty).toBe(0);
      expect(config.frequencyPenalty).toBe(0);
    });

    it('should return chat config', () => {
      const config = getKimiTaskConfig('chat');
      
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(4096);
      expect(config.topP).toBe(0.9);
      expect(config.presencePenalty).toBe(0.1);
      expect(config.frequencyPenalty).toBe(0.1);
    });

    it('should return analysis config', () => {
      const config = getKimiTaskConfig('analysis');
      
      expect(config.temperature).toBe(0.3);
      expect(config.maxTokens).toBe(4096);
      expect(config.topP).toBe(0.95);
      expect(config.presencePenalty).toBe(0);
      expect(config.frequencyPenalty).toBe(0);
    });

    it('should return creative config', () => {
      const config = getKimiTaskConfig('creative');
      
      expect(config.temperature).toBe(0.8);
      expect(config.maxTokens).toBe(4096);
      expect(config.topP).toBe(0.95);
      expect(config.presencePenalty).toBe(0.2);
      expect(config.frequencyPenalty).toBe(0.2);
    });
  });

  describe('getKimiRoutingDecision', () => {
    it('should recommend Kimi for multilingual input', () => {
      const input: KimiRoutingInput = {
        messageChars: 1000,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        detectedLanguage: 'Chinese',
        hasCode: false,
        contextSize: 1000,
      };
      
      const result = getKimiRoutingDecision(input);
      
      expect(result.rationale).toContain('Multilingual content (Chinese) - Kimi excels here');
    });

    it('should recommend Kimi for large context', () => {
      const input: KimiRoutingInput = {
        messageChars: 5000,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        hasCode: false,
        contextSize: 160000,
      };
      
      const result = getKimiRoutingDecision(input);
      
      expect(result.rationale).toContain("Large context - using Kimi's 256K window");
    });

    it('should recommend Kimi for code generation without tools', () => {
      const input: KimiRoutingInput = {
        messageChars: 1000,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        hasCode: true,
        contextSize: 1000,
      };
      
      const result = getKimiRoutingDecision(input);
      
      expect(result.rationale).toContain('Code generation - Kimi is capable and 5x cheaper');
    });

    it('should recommend Kimi for simple tasks', () => {
      const input: KimiRoutingInput = {
        messageChars: 100,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        hasCode: false,
        contextSize: 100,
      };
      
      const result = getKimiRoutingDecision(input);
      
      expect(result.rationale).toContain('Simple task - cost-effective with Kimi');
    });

    it('should favor Llama 405B for tool use', () => {
      const input: KimiRoutingInput = {
        messageChars: 1000,
        messageCount: 1,
        toolsRequested: true,
        multimodal: false,
        isComplex: false,
        hasCode: false,
        contextSize: 1000,
      };

      const result = getKimiRoutingDecision(input);
      expect(result.rationale).toContain('Tool use required - Llama 405B may be more reliable for complex tool chains');
    });

    it('should favor Llama 405B for complex tasks with long content', () => {
      const input: KimiRoutingInput = {
        messageChars: 15000,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: true,
        hasCode: false,
        contextSize: 15000,
      };

      const result = getKimiRoutingDecision(input);
      expect(result.rationale).toContain('Complex task - Llama 405B reasoning may be superior');
    });

    it('should return Kimi recommendation with high score', () => {
      const input: KimiRoutingInput = {
        messageChars: 100,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        detectedLanguage: 'Chinese',
        hasCode: true,
        contextSize: 160000,
      };

      const result = getKimiRoutingDecision(input);

      expect(result.recommendedModel).toBe('kimi');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return Llama 405B recommendation with low score', () => {
      const input: KimiRoutingInput = {
        messageChars: 15000,
        messageCount: 1,
        toolsRequested: true,
        multimodal: false,
        isComplex: true,
        hasCode: false,
        contextSize: 5000,
      };

      const result = getKimiRoutingDecision(input);
      expect(result.recommendedModel).toBe('llama405b');
    });

    it('should return either recommendation for neutral score', () => {
      const input: KimiRoutingInput = {
        messageChars: 1000,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        detectedLanguage: 'en',
        hasCode: false,
        contextSize: 1000,
      };
      
      const result = getKimiRoutingDecision(input);
      
      // Score: +15 (simple) = 15, which is between -20 and 40
      expect(result.recommendedModel).toBe('either');
      expect(result.confidence).toBe(0.5);
    });

    it('should cap confidence at 0.95', () => {
      const input: KimiRoutingInput = {
        messageChars: 100,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        detectedLanguage: 'Chinese',
        hasCode: true,
        contextSize: 200000,
      };
      
      const result = getKimiRoutingDecision(input);
      
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    it('should include estimated savings', () => {
      const input: KimiRoutingInput = {
        messageChars: 10000,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        hasCode: false,
        contextSize: 10000,
      };
      
      const result = getKimiRoutingDecision(input);
      
      expect(result.estimatedSavings).toBeDefined();
      expect(result.estimatedSavings).toBeGreaterThanOrEqual(0);
    });

    it('should ignore English language detection', () => {
      const input: KimiRoutingInput = {
        messageChars: 1000,
        messageCount: 1,
        toolsRequested: false,
        multimodal: false,
        isComplex: false,
        detectedLanguage: 'english',
        hasCode: false,
        contextSize: 1000,
      };
      
      const result = getKimiRoutingDecision(input);
      
      expect(result.rationale).not.toContain('Multilingual content');
    });
  });
});

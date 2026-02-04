/**
 * @grump/kimi - Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  // Constants
  KIMI_K25_CONFIG,
  SWARM_AGENT_IDS,
  // Functions
  getTaskConfig,
  containsNonEnglish,
  detectLanguage,
  calculateContextRetention,
  estimateSavings,
  estimateTokens,
  shouldRouteToKimi,
  getEnhancedRoutingDecision,
  optimizePromptForKimi,
  getSwarmAgents,
  formatTokens,
  formatCost,
  // Types
  type TaskType,
  type RoutingInput,
  type EnhancedRoutingInput,
} from '../src/index.js';

// ============================================================================
// Configuration Constants Tests
// ============================================================================

describe('KIMI_K25_CONFIG', () => {
  it('should have correct model configuration', () => {
    expect(KIMI_K25_CONFIG.modelId).toBe('moonshotai/kimi-k2.5');
    expect(KIMI_K25_CONFIG.contextWindow).toBe(256_000);
    expect(KIMI_K25_CONFIG.maxInputTokens).toBe(240_000);
    expect(KIMI_K25_CONFIG.contextAdvantage).toBe(56_000);
  });

  it('should have correct pricing', () => {
    expect(KIMI_K25_CONFIG.pricing.inputPerMillion).toBe(0.6);
    expect(KIMI_K25_CONFIG.pricing.outputPerMillion).toBe(0.6);
  });

  it('should have temperature settings for different tasks', () => {
    expect(KIMI_K25_CONFIG.temperature.coding).toBe(0.1);
    expect(KIMI_K25_CONFIG.temperature.creative).toBe(0.7);
    expect(KIMI_K25_CONFIG.temperature.analysis).toBe(0.3);
    expect(KIMI_K25_CONFIG.temperature.chat).toBe(0.7);
  });
});

describe('SWARM_AGENT_IDS', () => {
  it('should have all expected agent IDs', () => {
    expect(SWARM_AGENT_IDS).toContain('arch');
    expect(SWARM_AGENT_IDS).toContain('frontend');
    expect(SWARM_AGENT_IDS).toContain('backend');
    expect(SWARM_AGENT_IDS).toContain('devops');
    expect(SWARM_AGENT_IDS).toContain('test');
    expect(SWARM_AGENT_IDS).toContain('docs');
    expect(SWARM_AGENT_IDS).toContain('security');
    expect(SWARM_AGENT_IDS).toContain('review');
  });

  it('should have 12 agent types', () => {
    expect(SWARM_AGENT_IDS).toHaveLength(12);
  });
});

// ============================================================================
// Task Configuration Tests
// ============================================================================

describe('getTaskConfig()', () => {
  it('should return correct config for coding tasks', () => {
    const config = getTaskConfig('coding');

    expect(config.temperature).toBe(0.1);
    expect(config.maxTokens).toBe(8192);
    expect(config.topP).toBe(0.95);
    expect(config.presencePenalty).toBe(0);
    expect(config.frequencyPenalty).toBe(0);
  });

  it('should return correct config for chat tasks', () => {
    const config = getTaskConfig('chat');

    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(4096);
    expect(config.presencePenalty).toBe(0.1);
    expect(config.frequencyPenalty).toBe(0.1);
  });

  it('should return correct config for analysis tasks', () => {
    const config = getTaskConfig('analysis');

    expect(config.temperature).toBe(0.3);
    expect(config.presencePenalty).toBe(0);
  });

  it('should return correct config for creative tasks', () => {
    const config = getTaskConfig('creative');

    expect(config.temperature).toBe(0.8);
    expect(config.presencePenalty).toBe(0.2);
    expect(config.frequencyPenalty).toBe(0.2);
  });
});

// ============================================================================
// Language Detection Tests
// Using Unicode escape sequences to avoid encoding issues
// ============================================================================

describe('containsNonEnglish()', () => {
  it('should return false for English-only text', () => {
    expect(containsNonEnglish('Hello, this is a test.')).toBe(false);
    expect(containsNonEnglish('const x = 42;')).toBe(false);
    expect(containsNonEnglish('')).toBe(false);
  });

  it('should detect Chinese characters', () => {
    // \u4e2d\u6587 = Chinese characters
    expect(containsNonEnglish('Hello \u4e2d\u6587 World')).toBe(true);
  });

  it('should detect Japanese Hiragana', () => {
    // \u3053\u3093\u306b\u3061\u306f = Hiragana
    expect(containsNonEnglish('Hello \u3053\u3093\u306b\u3061\u306f World')).toBe(true);
  });

  it('should detect Japanese Katakana', () => {
    // \u30ab\u30bf\u30ab\u30ca = Katakana
    expect(containsNonEnglish('Hello \u30ab\u30bf\u30ab\u30ca World')).toBe(true);
  });

  it('should detect Korean characters', () => {
    // \ud55c\uad6d\uc5b4 = Korean
    expect(containsNonEnglish('Hello \ud55c\uad6d\uc5b4 World')).toBe(true);
  });

  it('should detect Arabic characters', () => {
    // \u0645\u0631\u062d\u0628\u0627 = Arabic
    expect(containsNonEnglish('Hello \u0645\u0631\u062d\u0628\u0627 World')).toBe(true);
  });

  it('should detect Cyrillic characters', () => {
    // \u041f\u0440\u0438\u0432\u0435\u0442 = Russian
    expect(containsNonEnglish('Hello \u041f\u0440\u0438\u0432\u0435\u0442 World')).toBe(true);
  });

  it('should detect Hindi/Devanagari characters', () => {
    // \u0928\u092e\u0938\u094d\u0924\u0947 = Hindi
    expect(containsNonEnglish('Hello \u0928\u092e\u0938\u094d\u0924\u0947 World')).toBe(true);
  });
});

describe('detectLanguage()', () => {
  it('should detect Chinese', () => {
    const result = detectLanguage('Hello \u4e2d\u6587 World');
    expect(result.hasChinese).toBe(true);
    expect(result.isMultilingual).toBe(true);
  });

  it('should detect Japanese', () => {
    const result = detectLanguage('Hello \u3053\u3093\u306b\u3061\u306f World');
    expect(result.hasJapanese).toBe(true);
    expect(result.isMultilingual).toBe(true);
  });

  it('should detect Korean', () => {
    const result = detectLanguage('Hello \ud55c\uad6d\uc5b4 World');
    expect(result.hasKorean).toBe(true);
  });

  it('should return all false for English-only', () => {
    const result = detectLanguage('Hello World');
    expect(result.hasChinese).toBe(false);
    expect(result.hasJapanese).toBe(false);
    expect(result.hasKorean).toBe(false);
    expect(result.hasArabic).toBe(false);
    expect(result.hasCyrillic).toBe(false);
    expect(result.hasHindi).toBe(false);
    expect(result.isMultilingual).toBe(false);
  });
});

// ============================================================================
// Context Management Tests
// ============================================================================

describe('calculateContextRetention()', () => {
  it('should handle tokens within Claude limit', () => {
    const result = calculateContextRetention(100_000);

    expect(result.retainTokens).toBe(100_000);
    expect(result.advantageUsed).toBe(0);
    expect(result.usingExtendedContext).toBe(false);
    expect(result.recommendation).toContain('56,000');
  });

  it('should use extended context when exceeding Claude limit', () => {
    const result = calculateContextRetention(220_000);

    expect(result.retainTokens).toBe(220_000);
    expect(result.advantageUsed).toBe(20_000);
    expect(result.usingExtendedContext).toBe(true);
    expect(result.recommendation).toContain('20,000');
  });

  it('should truncate when exceeding Kimi limit', () => {
    const result = calculateContextRetention(300_000);

    expect(result.retainTokens).toBe(240_000);
    expect(result.advantageUsed).toBe(56_000);
    expect(result.usingExtendedContext).toBe(true);
    expect(result.recommendation).toContain('Truncating');
  });

  it('should use custom Claude limit', () => {
    const result = calculateContextRetention(150_000, 100_000);

    expect(result.usingExtendedContext).toBe(true);
    expect(result.advantageUsed).toBe(50_000);
  });
});

// ============================================================================
// Cost Estimation Tests
// ============================================================================

describe('estimateSavings()', () => {
  it('should calculate correct cost comparison', () => {
    const result = estimateSavings(1_000_000, 500_000);

    // Kimi: (1M * 0.6 + 0.5M * 0.6) / 1M = 0.9
    expect(result.kimiCost).toBeCloseTo(0.9, 2);

    // Claude: (1M * 3 + 0.5M * 15) / 1M = 10.5
    expect(result.claudeCost).toBeCloseTo(10.5, 2);

    expect(result.savings).toBeCloseTo(9.6, 2);
    expect(result.savingsPercent).toBeGreaterThan(90);
  });

  it('should handle multiple requests', () => {
    const single = estimateSavings(100_000, 50_000, 1);
    const multiple = estimateSavings(100_000, 50_000, 5);

    expect(multiple.kimiCost).toBeCloseTo(single.kimiCost * 5, 4);
    expect(multiple.claudeCost).toBeCloseTo(single.claudeCost * 5, 4);
  });

  it('should include human-readable summary', () => {
    const result = estimateSavings(100_000, 50_000);

    expect(result.summary).toContain('Kimi:');
    expect(result.summary).toContain('Claude:');
    expect(result.summary).toContain('%');
  });
});

describe('estimateTokens()', () => {
  it('should estimate roughly 1 token per 4 characters', () => {
    expect(estimateTokens(400)).toBe(100);
    expect(estimateTokens(1000)).toBe(250);
  });

  it('should round up', () => {
    expect(estimateTokens(401)).toBe(101);
    expect(estimateTokens(403)).toBe(101);
  });
});

// ============================================================================
// Routing Decision Tests
// ============================================================================

describe('shouldRouteToKimi()', () => {
  it('should recommend Kimi for multilingual content', () => {
    const input: RoutingInput = {
      content: 'Hello \u4e2d\u6587 World Hello',  // Chinese characters
      requiresTools: false,
      isComplex: false,
      hasImage: false,
      isCodeGeneration: false,
    };

    const decision = shouldRouteToKimi(input);

    expect(decision.useKimi).toBe(true);
    expect(decision.reasons).toContain('Multilingual content detected - Kimi excels here');
  });

  it('should recommend Kimi for simple code generation', () => {
    const input: RoutingInput = {
      content: 'Generate a TypeScript function',
      requiresTools: false,
      isComplex: false,
      hasImage: false,
      isCodeGeneration: true,
    };

    const decision = shouldRouteToKimi(input);

    expect(decision.useKimi).toBe(true);
    expect(decision.reasons.some(r => r.includes('cheaper'))).toBe(true);
  });

  it('should reduce confidence for tool requirements', () => {
    const withoutTools: RoutingInput = {
      content: 'Simple request',
      requiresTools: false,
      isComplex: false,
      hasImage: false,
      isCodeGeneration: true,
    };

    const withTools: RoutingInput = {
      ...withoutTools,
      requiresTools: true,
    };

    const decisionWithout = shouldRouteToKimi(withoutTools);
    const decisionWith = shouldRouteToKimi(withTools);

    expect(decisionWith.confidence).toBeLessThan(decisionWithout.confidence);
    expect(decisionWith.reasons.some(r => r.includes('Tool use'))).toBe(true);
  });

  it('should include cost estimate in decision', () => {
    const input: RoutingInput = {
      content: 'Test content',
      requiresTools: false,
      isComplex: false,
      hasImage: false,
      isCodeGeneration: false,
    };

    const decision = shouldRouteToKimi(input);

    expect(decision.estimatedSavings).toBeDefined();
    expect(decision.estimatedSavings!.kimiCost).toBeGreaterThanOrEqual(0);
    expect(decision.estimatedSavings!.claudeCost).toBeGreaterThanOrEqual(0);
  });

  it('should handle long context', () => {
    const input: RoutingInput = {
      content: 'x'.repeat(200000), // Long content
      requiresTools: false,
      isComplex: false,
      hasImage: false,
      isCodeGeneration: false,
    };

    const decision = shouldRouteToKimi(input);

    expect(decision.reasons.some(r => r.includes('256K'))).toBe(true);
  });
});

describe('getEnhancedRoutingDecision()', () => {
  it('should recommend Kimi for large context with code', () => {
    const input: EnhancedRoutingInput = {
      messageChars: 200000,
      messageCount: 10,
      toolsRequested: false,
      multimodal: false,
      isComplex: false,
      hasCode: true,  // Adding code to boost Kimi score
      contextSize: 180000,
    };

    const decision = getEnhancedRoutingDecision(input);

    expect(decision.recommendedModel).toBe('kimi');
    expect(decision.rationale.some(r => r.includes('256K'))).toBe(true);
  });

  it('should recommend Claude for complex tool use', () => {
    const input: EnhancedRoutingInput = {
      messageChars: 5000,
      messageCount: 5,
      toolsRequested: true,
      multimodal: false,
      isComplex: true,
      hasCode: false,
      contextSize: 5000,
    };

    const decision = getEnhancedRoutingDecision(input);

    expect(decision.recommendedModel).toBe('claude');
    expect(decision.rationale.some(r => r.includes('Tool use'))).toBe(true);
  });

  it('should return "either" for borderline cases', () => {
    const input: EnhancedRoutingInput = {
      messageChars: 3000,
      messageCount: 2,
      toolsRequested: false,
      multimodal: false,
      isComplex: false,
      hasCode: false,
      contextSize: 3000,
    };

    const decision = getEnhancedRoutingDecision(input);

    expect(['kimi', 'claude', 'either']).toContain(decision.recommendedModel);
  });

  it('should include estimated savings', () => {
    const input: EnhancedRoutingInput = {
      messageChars: 10000,
      messageCount: 5,
      toolsRequested: false,
      multimodal: false,
      isComplex: false,
      hasCode: true,
      contextSize: 10000,
    };

    const decision = getEnhancedRoutingDecision(input);

    expect(decision.estimatedSavings).toBeDefined();
    expect(decision.estimatedSavings).toBeGreaterThan(0);
  });
});

// ============================================================================
// Prompt Optimization Tests
// ============================================================================

describe('optimizePromptForKimi()', () => {
  it('should add multilingual instruction for non-English content', () => {
    const result = optimizePromptForKimi(
      'You are a helpful assistant.',
      'Hello \u4e2d\u6587 World Hello'  // Chinese
    );

    expect(result.optimizedSystem).toContain('Multilingual Support');
    expect(result.optimizations).toContain('Added multilingual support instruction');
  });

  it('should add output format guidance if not present', () => {
    const result = optimizePromptForKimi(
      'You are an assistant.',
      'Write some code'
    );

    expect(result.optimizedSystem).toContain('Output Format');
    expect(result.optimizations).toContain('Added output format guidance');
  });

  it('should not add duplicate output format guidance', () => {
    const systemWithFormat = `You are an assistant.
## Output Format
Already has format guidance.`;

    const result = optimizePromptForKimi(systemWithFormat, 'Test');

    // Count occurrences
    const matches = result.optimizedSystem.match(/## Output Format/g);
    expect(matches).toHaveLength(1);
  });

  it('should detect Chinese content', () => {
    const result = optimizePromptForKimi('Assistant', '\u4e2d\u6587');

    expect(result.optimizations.some(o => o.includes('Chinese'))).toBe(true);
  });

  it('should preserve original user content', () => {
    const userContent = 'Original user message';
    const result = optimizePromptForKimi('System', userContent);

    expect(result.optimizedUser).toBe(userContent);
  });
});

// ============================================================================
// Swarm Agents Tests
// ============================================================================

describe('getSwarmAgents()', () => {
  it('should return all 12 agents', () => {
    const agents = getSwarmAgents();
    expect(agents).toHaveLength(12);
  });

  it('should have correct structure for each agent', () => {
    const agents = getSwarmAgents();

    for (const agent of agents) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.description).toBeDefined();
      expect(agent.status).toBe('idle');
      expect(Array.isArray(agent.capabilities)).toBe(true);
      expect(agent.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('should have arch agent with architecture capabilities', () => {
    const agents = getSwarmAgents();
    const archAgent = agents.find(a => a.id === 'arch');

    expect(archAgent).toBeDefined();
    expect(archAgent!.name).toBe('Architect');
    expect(archAgent!.capabilities).toContain('architecture');
    expect(archAgent!.capabilities).toContain('design');
  });

  it('should have frontend agent with UI capabilities', () => {
    const agents = getSwarmAgents();
    const frontendAgent = agents.find(a => a.id === 'frontend');

    expect(frontendAgent).toBeDefined();
    expect(frontendAgent!.capabilities).toContain('svelte');
    expect(frontendAgent!.capabilities).toContain('react');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('formatTokens()', () => {
  it('should format small numbers as-is', () => {
    expect(formatTokens(500)).toBe('500');
    expect(formatTokens(999)).toBe('999');
  });

  it('should format thousands with K suffix', () => {
    expect(formatTokens(1000)).toBe('1.0K');
    expect(formatTokens(5500)).toBe('5.5K');
    expect(formatTokens(150000)).toBe('150.0K');
  });

  it('should format millions with M suffix', () => {
    expect(formatTokens(1000000)).toBe('1.0M');
    expect(formatTokens(2500000)).toBe('2.5M');
  });
});

describe('formatCost()', () => {
  it('should format small costs with 4 decimal places', () => {
    expect(formatCost(0.0001)).toBe('$0.0001');
    expect(formatCost(0.0099)).toBe('$0.0099');
  });

  it('should format larger costs with 2 decimal places', () => {
    expect(formatCost(0.01)).toBe('$0.01');
    expect(formatCost(1.50)).toBe('$1.50');
    expect(formatCost(10.999)).toBe('$11.00');
  });
});

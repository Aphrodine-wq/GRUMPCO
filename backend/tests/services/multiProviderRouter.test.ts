/**
 * @fileoverview Multi-Provider AI Router Tests
 * Run: npm test -- multiProviderRouter.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted() for variables referenced in vi.mock() factories
const { mockLogger } = vi.hoisted(() => {
  return {
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock('../../src/middleware/logger.js', () => ({
  default: mockLogger,
}));

vi.mock('../../src/middleware/metrics.js', () => ({
  recordLlmStreamMetrics: vi.fn(),
}));

vi.mock('../../src/middleware/tracing.js', () => ({
  addNimSpanAttributes: vi.fn(),
}));

vi.mock('../../src/config/nim.js', () => ({
  getNimChatUrl: vi.fn().mockReturnValue('https://integrate.api.nvidia.com/v1/chat/completions'),
}));

// Mock env module - must be self-contained
vi.mock('../../src/config/env.js', () => ({
  env: {
    MULTI_PROVIDER_ROUTING: true,
    NVIDIA_NIM_API_KEY: 'test-nim-key',
    OPENROUTER_API_KEY: 'test-openrouter-key',
    GROQ_API_KEY: 'test-groq-key',
    TOGETHER_API_KEY: 'test-together-key',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    PUBLIC_BASE_URL: 'https://test.example.com',
  },
  getApiKey: vi.fn((provider: string) => {
    const keys: Record<string, string | undefined> = {
      nvidia_nim: 'test-nim-key',
      openrouter: 'test-openrouter-key',
      groq: 'test-groq-key',
      together: 'test-together-key',
      ollama: undefined,
    };
    return keys[provider];
  }),
  isProviderConfigured: vi.fn((provider: string) => {
    return ['nvidia_nim', 'openrouter', 'groq', 'together', 'ollama'].includes(provider);
  }),
  getConfiguredProviders: vi.fn().mockReturnValue([
    'nvidia_nim',
    'openrouter',
    'groq',
    'together',
    'ollama',
  ]),
}));

// Import only after mocks are set up
import {
  type LLMProvider,
  PROVIDER_CONFIGS,
  getDefaultModelId,
} from '../../src/services/llmGateway.js';

import {
  classifyRequest,
  getRoutingDecision,
} from '../../src/services/modelRouter.js';

describe('Multi-Provider AI Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Configuration', () => {
    it('should have all provider configs defined', () => {
      const providers: Exclude<LLMProvider, 'mock'>[] = [
        'groq',
        'nim',
        'openrouter',
        'together',
        'ollama',
      ];

      for (const provider of providers) {
        expect(PROVIDER_CONFIGS[provider]).toBeDefined();
        expect(PROVIDER_CONFIGS[provider].name).toBe(provider);
        expect(PROVIDER_CONFIGS[provider].baseUrl).toBeDefined();
        expect(PROVIDER_CONFIGS[provider].defaultModel).toBeDefined();
        expect(PROVIDER_CONFIGS[provider].models.length).toBeGreaterThan(0);
        expect(PROVIDER_CONFIGS[provider].capabilities.length).toBeGreaterThan(0);
      }
    });

    it('should have correct provider rankings', () => {
      expect(PROVIDER_CONFIGS.groq.speedRank).toBe(1);
      expect(PROVIDER_CONFIGS.openrouter.qualityRank).toBe(1);
      expect(PROVIDER_CONFIGS.ollama.speedRank).toBe(5);
    });

    it('should have correct cost rankings', () => {
      expect(PROVIDER_CONFIGS.ollama.costPer1kTokens).toBe(0);
      expect(PROVIDER_CONFIGS.groq.costPer1kTokens).toBeLessThan(
        PROVIDER_CONFIGS.openrouter.costPer1kTokens
      );
    });

    it('should identify tool support correctly', () => {
      expect(PROVIDER_CONFIGS.groq.supportsTools).toBe(true);
      expect(PROVIDER_CONFIGS.nim.supportsTools).toBe(true);
      expect(PROVIDER_CONFIGS.openrouter.supportsTools).toBe(true);
      expect(PROVIDER_CONFIGS.together.supportsTools).toBe(true);
      expect(PROVIDER_CONFIGS.ollama.supportsTools).toBe(false);
    });
  });

  describe('Request Classification', () => {
    it('should classify simple queries', () => {
      const params = {
        model: 'test',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user' as const, content: 'What is 2+2?' }],
      };

      const type = classifyRequest(params);
      expect(type).toBe('simple');
    });

    it('should classify coding tasks', () => {
      const params = {
        model: 'test',
        max_tokens: 500,
        system: '',
        messages: [
          { role: 'user' as const, content: 'Write a function to sort an array in TypeScript' },
        ],
      };

      const type = classifyRequest(params);
      expect(type).toBe('coding');
    });

    it('should classify complex tasks', () => {
      const params = {
        model: 'test',
        max_tokens: 2000,
        system: '',
        messages: [
          {
            role: 'user' as const,
            content:
              'Design a microservices architecture for a high-scale e-commerce platform with distributed transactions',
          },
        ],
      };

      const type = classifyRequest(params);
      expect(type).toBe('complex');
    });

    it('should detect vision requests', () => {
      const params = {
        model: 'test',
        max_tokens: 1000,
        system: '',
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: 'What is in this image?' },
              { type: 'image_url' as const, image_url: { url: 'https://example.com/image.jpg' } },
            ],
          },
        ],
      };

      const type = classifyRequest(params);
      expect(type).toBe('vision');
    });

    it('should classify creative writing', () => {
      const params = {
        model: 'test',
        max_tokens: 1000,
        system: '',
        messages: [
          { role: 'user' as const, content: 'Write a short story about a robot learning to feel' },
        ],
      };

      const type = classifyRequest(params);
      expect(type).toBe('creative');
    });

    it('should classify unknown requests as default', () => {
      const params = {
        model: 'test',
        max_tokens: 500,
        system: '',
        messages: [
          { role: 'user' as const, content: 'Please summarize this document for me' },
        ],
      };

      const type = classifyRequest(params);
      expect(type).toBe('default');
    });
  });

  describe('Routing Decisions', () => {
    it('should route simple queries to fast providers', () => {
      const params = {
        model: 'test',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user' as const, content: 'Hello!' }],
      };

      const decision = getRoutingDecision(params, {
        requestType: 'simple',
      });

      expect(decision.estimatedLatency).toBe('fast');
      expect(decision.reason).toContain('fast');
    });

    it('should route coding tasks to coding providers', () => {
      const params = {
        model: 'test',
        max_tokens: 500,
        system: '',
        messages: [
          { role: 'user' as const, content: 'Implement a binary search tree' },
        ],
      };

      const decision = getRoutingDecision(params, {
        requestType: 'coding',
      });

      expect(decision.reason).toContain('coding');
    });

    it('should respect user provider preference', () => {
      const params = {
        model: 'test',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const decision = getRoutingDecision(params, {
        provider: 'openrouter',
      });

      expect(decision.provider).toBe('openrouter');
      expect(decision.reason).toContain('User-specified');
    });

    it('should respect user speed preference', () => {
      const params = {
        model: 'test',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const decision = getRoutingDecision(params, {
        preferSpeed: true,
        requestType: 'default',
      });

      expect(decision.estimatedLatency).toBe('fast');
    });

    it('should respect user quality preference', () => {
      const params = {
        model: 'test',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const decision = getRoutingDecision(params, {
        preferQuality: true,
        requestType: 'complex',
      });

      expect(decision.provider).toBe('openrouter');
    });

    it('should include fallback chain', () => {
      const params = {
        model: 'test',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const decision = getRoutingDecision(params);

      expect(decision.fallbackChain.length).toBeGreaterThan(0);
      expect(decision.fallbackChain).not.toContain(decision.provider);
    });

    it('should estimate cost correctly', () => {
      const params = {
        model: 'test',
        max_tokens: 100,
        system: '',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const decision = getRoutingDecision(params, {
        provider: 'groq',
      });

      expect(decision.estimatedCost).toBe(PROVIDER_CONFIGS.groq.costPer1kTokens);
    });
  });

  describe('Default Models', () => {
    it('should return default model for each provider', () => {
      const providers: LLMProvider[] = ['groq', 'nim', 'openrouter', 'together', 'ollama'];

      for (const provider of providers) {
        const defaultModel = getDefaultModelId(provider);
        expect(defaultModel).toBeDefined();
        expect(typeof defaultModel).toBe('string');
        expect(defaultModel.length).toBeGreaterThan(0);
      }
    });

    it('should return NIM default when provider not specified', () => {
      const defaultModel = getDefaultModelId();
      expect(defaultModel).toBe(PROVIDER_CONFIGS.nim.defaultModel);
    });
  });

  describe('Provider Capabilities', () => {
    it('should identify streaming support', () => {
      expect(PROVIDER_CONFIGS.groq.capabilities).toContain('streaming');
      expect(PROVIDER_CONFIGS.nim.capabilities).toContain('streaming');
      expect(PROVIDER_CONFIGS.openrouter.capabilities).toContain('streaming');
      expect(PROVIDER_CONFIGS.together.capabilities).toContain('streaming');
      expect(PROVIDER_CONFIGS.ollama.capabilities).toContain('streaming');
    });

    it('should identify vision support', () => {
      expect(PROVIDER_CONFIGS.groq.capabilities).toContain('vision');
      expect(PROVIDER_CONFIGS.nim.capabilities).toContain('vision');
      expect(PROVIDER_CONFIGS.openrouter.capabilities).toContain('vision');
    });

    it('should identify JSON mode support', () => {
      expect(PROVIDER_CONFIGS.groq.capabilities).toContain('json_mode');
      expect(PROVIDER_CONFIGS.nim.capabilities).toContain('json_mode');
      expect(PROVIDER_CONFIGS.openrouter.capabilities).toContain('json_mode');
    });

    it('should identify function calling support', () => {
      expect(PROVIDER_CONFIGS.groq.capabilities).toContain('function_calling');
      expect(PROVIDER_CONFIGS.nim.capabilities).toContain('function_calling');
      expect(PROVIDER_CONFIGS.openrouter.capabilities).toContain('function_calling');
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have unique fallback chains', () => {
    const params = {
      model: 'test',
      max_tokens: 100,
      system: '',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const decision = getRoutingDecision(params);

    expect(new Set(decision.fallbackChain).size).toBe(decision.fallbackChain.length);
  });

  it('should fallback chain not include primary', () => {
    const params = {
      model: 'test',
      max_tokens: 100,
      system: '',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    const decision = getRoutingDecision(params);

    expect(decision.fallbackChain).not.toContain(decision.provider);
  });
});

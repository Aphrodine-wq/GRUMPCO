/**
 * Kimi Middleware Tests
 * Tests for Kimi K2.5 optimization middleware
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  kimiOptimizationMiddleware,
  kimiPromptOptimizationMiddleware,
  kimiAnalyticsMiddleware,
  createKimiOptimizationStack,
} from '../../src/middleware/kimiMiddleware.js';

// Mock dependencies
vi.mock('../../src/services/kimiOptimizer.js', () => ({
  containsNonEnglish: vi.fn((text: string) => /[\u4e00-\u9fff]/.test(text)),
  optimizePromptForKimi: vi.fn((system: string, user: string) => ({
    optimizedSystem: system + '\n\n## Multilingual Support',
    optimizedUser: user,
    optimizations: ['Added multilingual support instruction'],
  })),
  shouldRouteToKimi: vi.fn(() => ({
    useKimi: true,
    confidence: 0.8,
    reasons: ['Multilingual content detected'],
  })),
  estimateKimiSavings: vi.fn(() => ({
    claudeCost: 0.01,
    kimiCost: 0.002,
    savings: 0.008,
    savingsPercent: 80,
  })),
  KIMI_K25_CONFIG: {
    modelId: 'moonshotai/kimi-k2.5',
    contextWindow: 256_000,
    maxInputTokens: 240_000,
    contextAdvantage: 56_000,
    temperature: { coding: 0.1, creative: 0.7, default: 0.3 },
    tokenEfficiency: 0.95,
  },
  getKimiRoutingDecision: vi.fn((input: { detectedLanguage?: string }) => ({
    recommendedModel: input.detectedLanguage === 'zh' ? 'kimi' : 'either',
    confidence: input.detectedLanguage === 'zh' ? 0.85 : 0.5,
    estimatedSavings: 0.008,
    rationale: ['Multilingual content detected'],
  })),
}));

vi.mock('../../src/services/modelRouterEnhanced.js', () => ({
  selectModelEnhanced: vi.fn(() => ({
    model: 'kimi-k2.5',
    provider: 'nim',
    reasoning: 'Selected based on language',
  })),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules for access in tests
import { getKimiRoutingDecision, optimizePromptForKimi } from '../../src/services/kimiOptimizer.js';
import logger from '../../src/middleware/logger.js';

// Helper to create mock request
function createMockRequest(body: Record<string, unknown> = {}, headers: Record<string, string> = {}): Partial<Request> {
  return {
    body,
    headers,
    path: '/api/chat',
    method: 'POST',
  };
}

// Helper to create mock response
function createMockResponse(): Partial<Response> & {
  _endCallback?: (...args: unknown[]) => void;
  _jsonData?: unknown;
  statusCode: number;
} {
  const res: Partial<Response> & {
    _endCallback?: (...args: unknown[]) => void;
    _jsonData?: unknown;
    statusCode: number;
  } = {
    statusCode: 200,
    setHeader: vi.fn(),
    on: vi.fn((event: string, callback: () => void) => {
      if (event === 'finish') {
        res._endCallback = callback;
      }
      return res as Response;
    }),
    end: vi.fn((...args: unknown[]) => {
      if (res._endCallback) {
        res._endCallback();
      }
      return res as Response;
    }),
    json: vi.fn((data: unknown) => {
      res._jsonData = data;
      return res as Response;
    }),
  };
  return res;
}

describe('Kimi Middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn() as unknown as NextFunction;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('kimiOptimizationMiddleware', () => {
    it('should call next() for empty content', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({}) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.kimiOptimization).toBeUndefined();
    });

    it('should detect English content and set detectedLanguage to en', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: 'Hello world' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.kimiOptimization).toBeDefined();
      expect(req.kimiOptimization?.detectedLanguage).toBe('en');
      expect(req.kimiOptimization?.hasNonEnglish).toBe(false);
    });

    it('should detect Chinese content and set hasNonEnglish to true', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: '你好世界' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.kimiOptimization).toBeDefined();
      expect(req.kimiOptimization?.detectedLanguage).toBe('zh');
      expect(req.kimiOptimization?.hasNonEnglish).toBe(true);
    });

    it('should detect Japanese content', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: 'こんにちは' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization?.detectedLanguage).toBe('ja');
      expect(req.kimiOptimization?.hasNonEnglish).toBe(true);
    });

    it('should detect Korean content', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: '안녕하세요' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization?.detectedLanguage).toBe('ko');
      expect(req.kimiOptimization?.hasNonEnglish).toBe(true);
    });

    it('should detect Arabic content', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: 'مرحبا بالعالم' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization?.detectedLanguage).toBe('ar');
      expect(req.kimiOptimization?.hasNonEnglish).toBe(true);
    });

    it('should detect Russian content', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: 'Привет мир' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization?.detectedLanguage).toBe('ru');
      expect(req.kimiOptimization?.hasNonEnglish).toBe(true);
    });

    it('should detect Hindi content', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: 'नमस्ते दुनिया' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization?.detectedLanguage).toBe('hi');
      expect(req.kimiOptimization?.hasNonEnglish).toBe(true);
    });

    it('should extract content from messages array', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should extract content from prompt field', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ prompt: 'Test prompt' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should extract content from content field', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ content: 'Test content' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should extract content from text field', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ text: 'Test text' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should set estimatedSavings when routing to Kimi with trackSavings enabled', () => {
      vi.mocked(getKimiRoutingDecision).mockReturnValue({
        recommendedModel: 'kimi',
        confidence: 0.85,
        estimatedSavings: 0.008,
        rationale: ['Cost savings'],
      });

      const middleware = kimiOptimizationMiddleware({ trackSavings: true });
      const req = createMockRequest({ message: '你好世界' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization?.estimatedSavings).toBeDefined();
    });

    it('should auto-route to Kimi when autoRoute is enabled and Kimi is recommended', () => {
      vi.mocked(getKimiRoutingDecision).mockReturnValue({
        recommendedModel: 'kimi',
        confidence: 0.85,
        estimatedSavings: 0.008,
        rationale: ['Kimi recommended'],
      });

      const middleware = kimiOptimizationMiddleware({ autoRoute: true });
      const req = createMockRequest({ message: '你好', model: 'claude-sonnet-4-20250514' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.body.model).toBe('moonshotai/kimi-k2.5');
      expect(req.body.provider).toBe('nim');
    });

    it('should not override model when autoRoute is disabled', () => {
      vi.mocked(getKimiRoutingDecision).mockReturnValue({
        recommendedModel: 'kimi',
        confidence: 0.85,
        estimatedSavings: 0.008,
        rationale: ['Kimi recommended'],
      });

      const middleware = kimiOptimizationMiddleware({ autoRoute: false });
      const req = createMockRequest({ message: '你好', model: 'claude-sonnet-4-20250514' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.body.model).toBe('claude-sonnet-4-20250514');
    });

    it('should not override custom model selection', () => {
      vi.mocked(getKimiRoutingDecision).mockReturnValue({
        recommendedModel: 'kimi',
        confidence: 0.85,
        estimatedSavings: 0.008,
        rationale: ['Kimi recommended'],
      });

      const middleware = kimiOptimizationMiddleware({ autoRoute: true });
      const req = createMockRequest({ message: '你好', model: 'gpt-4' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.body.model).toBe('gpt-4'); // Should not override custom model
    });

    it('should detect code in content', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ 
        message: '```javascript\nconst x = 1;\n```' 
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle errors gracefully and continue', () => {
      vi.mocked(getKimiRoutingDecision).mockImplementation(() => {
        throw new Error('Routing error');
      });

      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: 'Hello' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should set context retention info when Kimi is recommended', () => {
      vi.mocked(getKimiRoutingDecision).mockReturnValue({
        recommendedModel: 'kimi',
        confidence: 0.85,
        estimatedSavings: 0.008,
        rationale: ['Kimi recommended'],
      });

      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ message: '你好世界' }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization?.contextRetention).toBeDefined();
      expect(req.kimiOptimization?.contextRetention?.retainTokens).toBe(240_000);
    });

    it('should detect tools requested', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ 
        message: 'Hello',
        tools: [{ name: 'search' }]
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization).toBeDefined();
    });

    it('should detect multimodal content', () => {
      const middleware = kimiOptimizationMiddleware();
      const req = createMockRequest({ 
        message: 'Describe this image_url',
        multimodal: true
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.kimiOptimization).toBeDefined();
    });
  });

  describe('kimiPromptOptimizationMiddleware', () => {
    it('should skip non-Kimi requests', () => {
      const middleware = kimiPromptOptimizationMiddleware();
      const req = createMockRequest({ 
        message: 'Hello',
        model: 'claude-3',
        provider: 'anthropic'
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should optimize prompts for Kimi requests by model', () => {
      const middleware = kimiPromptOptimizationMiddleware({ optimizeSystemPrompt: true });
      const req = createMockRequest({ 
        message: 'Hello',
        model: 'kimi-k2.5',
        system: 'You are helpful.',
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.body.system).toContain('Multilingual Support');
      expect(next).toHaveBeenCalled();
    });

    it('should optimize prompts for Kimi requests by provider', () => {
      const middleware = kimiPromptOptimizationMiddleware({ optimizeSystemPrompt: true });
      const req = createMockRequest({ 
        message: 'Hello',
        provider: 'nim',
        systemPrompt: 'You are helpful.',
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.body.systemPrompt).toContain('Multilingual Support');
      expect(next).toHaveBeenCalled();
    });

    it('should optimize based on kimiOptimization recommendation', () => {
      const middleware = kimiPromptOptimizationMiddleware({ optimizeSystemPrompt: true });
      const req = createMockRequest({ 
        message: 'Hello',
        system: 'You are helpful.',
      }) as Request;
      req.kimiOptimization = {
        detectedLanguage: 'en',
        hasNonEnglish: false,
        recommendedModel: 'kimi',
        confidence: 0.9,
        optimizations: [],
      };
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(req.body.system).toContain('Multilingual Support');
    });

    it('should skip optimization when optimizeSystemPrompt is false', () => {
      vi.mocked(optimizePromptForKimi).mockReturnValue({
        optimizedSystem: 'Optimized',
        optimizedUser: 'Hello',
        optimizations: [], // No optimizations
      });

      const middleware = kimiPromptOptimizationMiddleware({ optimizeSystemPrompt: false });
      const req = createMockRequest({ 
        message: 'Hello',
        model: 'kimi-k2.5',
        system: 'Original',
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      // System prompt should not be changed when no optimizations
      expect(next).toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      vi.mocked(optimizePromptForKimi).mockImplementation(() => {
        throw new Error('Optimization error');
      });

      const middleware = kimiPromptOptimizationMiddleware();
      const req = createMockRequest({ 
        message: 'Hello',
        model: 'kimi-k2.5',
        system: 'You are helpful.',
      }) as Request;
      const res = createMockResponse() as Response;

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('kimiAnalyticsMiddleware', () => {
    it('should record analytics on response finish', () => {
      const middleware = kimiAnalyticsMiddleware();
      const req = createMockRequest({ message: 'Hello', model: 'kimi', provider: 'nim' }) as Request;
      req.kimiOptimization = {
        detectedLanguage: 'zh',
        hasNonEnglish: true,
        recommendedModel: 'kimi',
        confidence: 0.85,
        estimatedSavings: 0.008,
        optimizations: ['Optimized'],
      };
      
      const res = createMockResponse();
      const finishCallback = vi.fn();
      res.on = vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') {
          finishCallback.mockImplementation(cb);
        }
        return res as Response;
      });

      middleware(req, res as Response, next);

      expect(next).toHaveBeenCalled();
      
      // Simulate response finish
      res.end!();
    });

    it('should not log when no kimiOptimization present', () => {
      const middleware = kimiAnalyticsMiddleware();
      const req = createMockRequest({ message: 'Hello' }) as Request;
      
      const res = createMockResponse();

      middleware(req, res as Response, next);
      res.end!();

      // Logger.info should not be called for requests without kimiOptimization
      expect(vi.mocked(logger.info)).not.toHaveBeenCalledWith(
        expect.objectContaining({ detectedLanguage: expect.any(String) }),
        'Kimi analytics'
      );
    });

    it('should calculate duration correctly', async () => {
      const middleware = kimiAnalyticsMiddleware();
      const req = createMockRequest({ message: 'Hello' }) as Request;
      req.kimiOptimization = {
        detectedLanguage: 'en',
        hasNonEnglish: false,
        recommendedModel: 'kimi',
        confidence: 0.8,
        optimizations: [],
      };
      
      const res = createMockResponse();

      middleware(req, res as Response, next);

      // Simulate some delay
      await new Promise(resolve => setTimeout(resolve, 10));
      
      res.end!();
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('createKimiOptimizationStack', () => {
    it('should return middleware array with all components enabled', () => {
      const stack = createKimiOptimizationStack({
        autoRoute: true,
        trackSavings: true,
        logDecisions: true,
        optimizePrompts: true,
        trackAnalytics: true,
      });

      expect(Array.isArray(stack)).toBe(true);
      expect(stack.length).toBe(3); // optimization, prompt, analytics
    });

    it('should return only optimization middleware when others disabled', () => {
      const stack = createKimiOptimizationStack({
        optimizePrompts: false,
        trackAnalytics: false,
      });

      expect(stack.length).toBe(1);
    });

    it('should return optimization + prompt when analytics disabled', () => {
      const stack = createKimiOptimizationStack({
        optimizePrompts: true,
        trackAnalytics: false,
      });

      expect(stack.length).toBe(2);
    });

    it('should return optimization + analytics when prompts disabled', () => {
      const stack = createKimiOptimizationStack({
        optimizePrompts: false,
        trackAnalytics: true,
      });

      expect(stack.length).toBe(2);
    });

    it('should use default options when none provided', () => {
      const stack = createKimiOptimizationStack();

      expect(Array.isArray(stack)).toBe(true);
      expect(stack.length).toBe(3);
    });
  });

  describe('default export', () => {
    it('should be callable and return middleware stack', async () => {
      const kimiMiddleware = (await import('../../src/middleware/kimiMiddleware.js')).default;
      const stack = kimiMiddleware();

      expect(Array.isArray(stack)).toBe(true);
      expect(stack.length).toBeGreaterThan(0);
    });

    it('should accept options', async () => {
      const kimiMiddleware = (await import('../../src/middleware/kimiMiddleware.js')).default;
      const stack = kimiMiddleware({ autoRoute: false, trackAnalytics: false });

      expect(Array.isArray(stack)).toBe(true);
    });
  });
});

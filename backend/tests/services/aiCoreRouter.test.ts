/**
 * Unit tests for the real model router from @grump/ai-core.
 * Verifies route(), routeByTaskType(), getRAGModel(), getReasoningModel(), getVisionModel().
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  route,
  routeByTaskType,
  getRAGModel,
  getReasoningModel,
  getVisionModel,
} from '@grump/ai-core';

const NEMOTRON_ULTRA = 'nvidia/llama-3.1-nemotron-ultra-253b-v1';
const NEMOTRON_3_NANO = 'nvidia/nemotron-3-nano-30b-a3b';
const NEMOTRON_VISION = 'nvidia/nemotron-nano-12b-v2-vl';
const NEMOTRON_SUPER = 'nvidia/llama-3.3-nemotron-super-49b-v1.5';
const LLAMA_405B = 'meta/llama-3.1-405b-instruct';
const LLAMA_70B = 'meta/llama-3.1-70b-instruct';

describe('ai-core model router (real)', () => {
  const origNim = process.env.NVIDIA_NIM_API_KEY;
  const origMock = process.env.MOCK_AI_MODE;

  beforeEach(() => {
    process.env.NVIDIA_NIM_API_KEY = 'test-key';
    process.env.MOCK_AI_MODE = '';
  });

  afterEach(() => {
    if (origNim !== undefined) process.env.NVIDIA_NIM_API_KEY = origNim;
    else delete process.env.NVIDIA_NIM_API_KEY;
    if (origMock !== undefined) process.env.MOCK_AI_MODE = origMock;
    else delete process.env.MOCK_AI_MODE;
  });

  describe('route()', () => {
    it('returns Nemotron Ultra for preferCapability reasoning', () => {
      const result = route({
        preferCapability: 'reasoning',
        costOptimization: false,
      });
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_ULTRA);
      expect(result.reasoning).toContain('Nemotron');
    });

    it('returns Nemotron 3 Nano for very long context (messageChars > 100K)', () => {
      const result = route({ messageChars: 150_000 });
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_3_NANO);
      expect(result.reasoning).toContain('Nemotron 3 Nano');
    });

    it('returns Nemotron 3 Nano for long-context capability when requiredContext > 100K', () => {
      const result = route({
        preferCapability: 'long-context',
        requiredContext: 200_000,
        costOptimization: false,
      });
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_3_NANO);
    });

    it('returns Llama 405B for long context when messageChars 50K–100K', () => {
      const result = route({
        messageChars: 60_000,
        costOptimization: false,
      });
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(LLAMA_405B);
      expect(result.reasoning).toContain('Long context');
    });

    it('returns default (Nemotron Super) for minimal context', () => {
      const result = route({
        messageChars: 100,
        costOptimization: false,
      });
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_SUPER);
      expect(result.reasoning).toContain('Nemotron Super');
    });

    it('returns mock when MOCK_AI_MODE is true', () => {
      process.env.MOCK_AI_MODE = 'true';
      const result = route({ messageChars: 100 });
      expect(result.provider).toBe('mock');
      expect(result.modelId).toBe('mock-ai');
    });
  });

  describe('routeByTaskType()', () => {
    it('returns Nemotron Ultra for reasoning task', () => {
      const result = routeByTaskType('reasoning');
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_ULTRA);
    });

    it('returns Nemotron Vision for vision task', () => {
      const result = routeByTaskType('vision');
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_VISION);
    });

    it('returns Nemotron Super for chat task', () => {
      const result = routeByTaskType('chat');
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_SUPER);
    });
  });

  describe('getRAGModel()', () => {
    it('returns Nemotron 3 Nano for context size > 100K', () => {
      const result = getRAGModel(200_000);
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_3_NANO);
      expect(result.reasoning).toContain('Nemotron 3 Nano');
    });

    it('returns Llama 70B for context size <= 100K', () => {
      const result = getRAGModel(50_000);
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(LLAMA_70B);
      expect(result.reasoning).toContain('RAG');
    });
  });

  describe('getReasoningModel()', () => {
    it('returns Nemotron Ultra when tools not required', () => {
      const result = getReasoningModel(false);
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_ULTRA);
      expect(result.reasoning).toContain('Nemotron Ultra');
    });

    it('returns Llama 405B when tools required', () => {
      const result = getReasoningModel(true);
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(LLAMA_405B);
    });
  });

  describe('getVisionModel()', () => {
    it('returns Nemotron Vision model', () => {
      const result = getVisionModel();
      expect(result.provider).toBe('nim');
      expect(result.modelId).toBe(NEMOTRON_VISION);
      expect(result.reasoning).toContain('Nemotron');
      expect(result.reasoning).toContain('Vision');
    });
  });
});

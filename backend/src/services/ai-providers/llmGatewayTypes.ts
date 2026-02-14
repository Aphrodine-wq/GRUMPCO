/**
 * @fileoverview LLM Gateway - Types, Interfaces & Provider Configuration
 *
 * Shared type definitions and static configuration for all LLM providers.
 * Extracted from the monolithic llmGateway.ts for better modularity.
 *
 * @module services/ai-providers/llmGatewayTypes
 */

import { getNimChatUrl } from '../../config/nim.js';
import { env } from '../../config/env.js';

// =============================================================================
// Core Types
// =============================================================================

/** Supported LLM provider identifiers */
export type LLMProvider =
  | 'nim'
  | 'openrouter'
  | 'ollama'
  | 'anthropic'
  | 'google'
  | 'github_copilot'
  | 'grump'
  | 'mock';

/**
 * Multimodal content part for vision-capable models.
 * Supports text and image URL content in messages.
 */
export type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * Parameters for LLM streaming requests.
 * Unified format for all providers.
 */
export interface StreamParams {
  /** Model identifier (provider-specific model ID) */
  model: string;
  /** Maximum tokens to generate */
  max_tokens: number;
  /** Optional user ID for resolving user-stored API keys */
  userId?: string;

  /** System prompt/instructions */
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  system: string;
  /** Conversation messages */
  messages: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string | MultimodalContentPart[];
    /** AbortSignal for request cancellation */
    signal?: AbortSignal;
    /** Tool call ID (required for role="tool" messages) */
    tool_call_id?: string;
    /** Tool calls made by the assistant (for assistant messages requesting tools) */
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  }>;
  /** Optional tool definitions for function calling */
  tools?: Array<{
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties?: Record<string, unknown>;
      required?: string[];
    };
  }>;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Top-p sampling */
  top_p?: number;
}

/**
 * Unified stream event format.
 * All providers emit these event types for consistent consumption.
 */
export type StreamEvent =
  /** Text content chunk */
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } }
  /** Tool invocation start */
  | {
      type: 'content_block_start';
      content_block: {
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      };
    }
  /** End of message stream */
  | { type: 'message_stop' }
  /** Stream error */
  | { type: 'error'; error?: unknown };

// =============================================================================
// Provider Configuration
// =============================================================================

/** Provider configuration interface */
export interface ProviderConfig {
  name: LLMProvider;
  baseUrl: string;
  apiKeyEnvVar: string;
  models: string[];
  capabilities: ('streaming' | 'vision' | 'json_mode' | 'function_calling')[];
  costPer1kTokens: number;
  speedRank: number; // Lower is faster
  qualityRank: number; // Lower is better quality
  defaultModel: string;
  supportsTools: boolean;
  headers?: Record<string, string>;
}

/** Provider configurations */
export const PROVIDER_CONFIGS: Record<Exclude<LLMProvider, 'mock'>, ProviderConfig> = {
  nim: {
    name: 'nim',
    baseUrl: getNimChatUrl(),
    apiKeyEnvVar: 'NVIDIA_NIM_API_KEY',
    models: [
      'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      'meta/llama-3.1-405b-instruct',
      'meta/llama-3.1-70b-instruct',
      'mistralai/mistral-large-2-instruct',
      'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      'mistralai/codestral-22b-instruct-v0.1',
      'moonshotai/kimi-k2.5',
    ],
    capabilities: ['streaming', 'vision', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.0002,
    speedRank: 2,
    qualityRank: 2,
    defaultModel: 'moonshotai/kimi-k2.5',
    supportsTools: true,
  },
  openrouter: {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    models: [
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-opus-4.6',
      'openai/gpt-5',
      'openai/gpt-5.2',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.1-405b-instruct',
    ],
    capabilities: ['streaming', 'vision', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.003,
    speedRank: 3,
    qualityRank: 1,
    defaultModel: 'anthropic/claude-sonnet-4.5',
    supportsTools: true,
    headers: {
      'HTTP-Referer': env.PUBLIC_BASE_URL || 'https://g-rump.com',
      'X-Title': 'G-Rump AI',
    },
  },
  ollama: {
    name: 'ollama',
    baseUrl: `${env.OLLAMA_BASE_URL}/api/chat`,
    apiKeyEnvVar: '',
    models: [
      'qwen2.5-coder:32b',
      'devstral',
      'llama3.2',
      'llama3.1',
      'deepseek-coder-v2',
      'qwen2.5-coder',
      'mistral',
      'codellama',
      'gemma3:4b',
    ],
    capabilities: ['streaming', 'function_calling'],
    costPer1kTokens: 0, // Local = free
    speedRank: 5,
    qualityRank: 4,
    defaultModel: 'qwen2.5-coder:32b',
    supportsTools: true,
  },

  anthropic: {
    name: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    models: [
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-6-20260206',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ],
    capabilities: ['streaming', 'vision', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.003,
    speedRank: 3,
    qualityRank: 1,
    defaultModel: 'claude-sonnet-4-5-20250929',
    supportsTools: true,
    headers: {
      'anthropic-version': '2023-06-01',
    },
  },

  google: {
    name: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    capabilities: ['streaming', 'vision', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.001,
    speedRank: 2,
    qualityRank: 2,
    defaultModel: 'gemini-2.5-pro',
    supportsTools: true,
  },
  github_copilot: {
    name: 'github_copilot',
    baseUrl: 'https://api.githubcopilot.com/chat/completions',
    apiKeyEnvVar: '', // OAuth-based
    models: ['claude-sonnet-4.5', 'gpt-5', 'gemini-2.5-pro', 'o3-mini'],
    capabilities: ['streaming', 'function_calling'],
    costPer1kTokens: 0, // included in Copilot subscription
    speedRank: 3,
    qualityRank: 2,
    defaultModel: 'claude-sonnet-4.5',
    supportsTools: true,
  },

  grump: {
    name: 'grump',
    baseUrl: '', // Meta-provider; routes to sub-providers
    apiKeyEnvVar: '',
    models: ['g-compn1-auto', 'g-compn1-quality', 'g-compn1-fast', 'g-compn1-balanced'],
    capabilities: ['streaming', 'vision', 'json_mode', 'function_calling'],
    costPer1kTokens: 0.0015, // Blended average of sub-providers
    speedRank: 2,
    qualityRank: 1,
    defaultModel: 'g-compn1-auto',
    supportsTools: true,
  },
};

// =============================================================================
// Timeout Configuration
// =============================================================================

// SPEED OPTIMIZATION: Tighter timeouts — fail faster and let retry/fallback handle it
const TIMEOUT_DEFAULT_MS = Number(
  process.env.LLM_TIMEOUT_DEFAULT_MS ?? 120_000 // Increased from 90s for larger token requests
);
const TIMEOUT_FAST_MS = Number(process.env.LLM_TIMEOUT_FAST_MS ?? 20_000);
const TIMEOUT_SLOW_MS = Number(process.env.LLM_TIMEOUT_SLOW_MS ?? 86_400_000); // 24 hours for local models (Ollama) — effectively no timeout

export function getTimeoutMs(provider: LLMProvider, maxTokens?: number): number {
  // Ollama depends on local hardware
  if (provider === 'ollama') return TIMEOUT_SLOW_MS;

  // Large token requests need more time
  if (typeof maxTokens === 'number' && maxTokens > 4096) {
    return Math.max(TIMEOUT_DEFAULT_MS, 180_000); // Increased from 120s for 32K+ token requests
  }

  return TIMEOUT_DEFAULT_MS;
}

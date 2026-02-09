/**
 * @fileoverview LLM Gateway - Types, Interfaces & Provider Configuration
 *
 * Shared type definitions and static configuration for all LLM providers.
 * Extracted from the monolithic llmGateway.ts for better modularity.
 *
 * @module services/ai-providers/llmGatewayTypes
 */

import { getNimChatUrl } from "../../config/nim.js";
import { env } from "../../config/env.js";

// =============================================================================
// Core Types
// =============================================================================

/** Supported LLM provider identifiers */
export type LLMProvider =
    | "nim"
    | "openrouter"
    | "ollama"
    | "jan"
    | "github-copilot"
    | "kimi"
    | "anthropic"
    | "mistral"
    | "google"
    | "grump"
    | "mock";

/**
 * Multimodal content part for vision-capable models.
 * Supports text and image URL content in messages.
 */
export type MultimodalContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

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
    /** Optional JAN_BASE_URL override (e.g. from user settings) */
    janBaseUrlOverride?: string;
    /** System prompt/instructions */
    /** AbortSignal for request cancellation */
    signal?: AbortSignal;
    system: string;
    /** Conversation messages */
    messages: Array<{
        role: "user" | "assistant" | "tool";
        content: string | MultimodalContentPart[];
        /** AbortSignal for request cancellation */
        signal?: AbortSignal;
        /** Tool call ID (required for role="tool" messages) */
        tool_call_id?: string;
        /** Tool calls made by the assistant (for assistant messages requesting tools) */
        tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
        }>;
    }>;
    /** Optional tool definitions for function calling */
    tools?: Array<{
        name: string;
        description: string;
        input_schema: {
            type: "object";
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
    | { type: "content_block_delta"; delta: { type: "text_delta"; text: string } }
    /** Tool invocation start */
    | {
        type: "content_block_start";
        content_block: {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        };
    }
    /** End of message stream */
    | { type: "message_stop" }
    /** Stream error */
    | { type: "error"; error?: unknown };

// =============================================================================
// Provider Configuration
// =============================================================================

/** Provider configuration interface */
export interface ProviderConfig {
    name: LLMProvider;
    baseUrl: string;
    apiKeyEnvVar: string;
    models: string[];
    capabilities: ("streaming" | "vision" | "json_mode" | "function_calling")[];
    costPer1kTokens: number;
    speedRank: number; // Lower is faster
    qualityRank: number; // Lower is better quality
    defaultModel: string;
    supportsTools: boolean;
    headers?: Record<string, string>;
}

/** Provider configurations */
export const PROVIDER_CONFIGS: Record<
    Exclude<LLMProvider, "mock">,
    ProviderConfig
> = {
    nim: {
        name: "nim",
        baseUrl: getNimChatUrl(),
        apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
        models: [
            "nvidia/llama-3.3-nemotron-super-49b-v1.5",
            "meta/llama-3.1-405b-instruct",
            "meta/llama-3.1-70b-instruct",
            "mistralai/mistral-large-2-instruct",
            "nvidia/llama-3.1-nemotron-ultra-253b-v1",
            "mistralai/codestral-22b-instruct-v0.1",
            "moonshotai/kimi-k2.5",
        ],
        capabilities: ["streaming", "vision", "json_mode", "function_calling"],
        costPer1kTokens: 0.0002,
        speedRank: 2,
        qualityRank: 2,
        defaultModel: "moonshotai/kimi-k2.5",
        supportsTools: true,
    },
    openrouter: {
        name: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        models: [
            "anthropic/claude-3.5-sonnet",
            "anthropic/claude-3-opus",
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "meta-llama/llama-3.1-405b-instruct",
            "meta-llama/llama-3.1-70b-instruct",
            "google/gemini-pro-1.5",
        ],
        capabilities: ["streaming", "vision", "json_mode", "function_calling"],
        costPer1kTokens: 0.003, // Variable, using Claude as reference
        speedRank: 3,
        qualityRank: 1, // Best quality
        defaultModel: "anthropic/claude-3.5-sonnet",
        supportsTools: true,
        headers: {
            "HTTP-Referer": env.PUBLIC_BASE_URL || "https://g-rump.com",
            "X-Title": "G-Rump AI",
        },
    },
    ollama: {
        name: "ollama",
        baseUrl: `${env.OLLAMA_BASE_URL}/api/chat`,
        apiKeyEnvVar: "",
        models: [
            "llama3.2",
            "llama3.1",
            "mistral",
            "codellama",
            "qwen2.5-coder",
            "deepseek-coder",
            "gemma3:4b",
            "kimi-k2.5:cloud",
        ],
        capabilities: ["streaming", "function_calling"],
        costPer1kTokens: 0, // Local = free
        speedRank: 5,
        qualityRank: 4,
        defaultModel: "llama3.2",
        supportsTools: true,
    },
    "github-copilot": {
        name: "github-copilot",
        baseUrl: "https://api.githubcopilot.com/chat/completions",
        apiKeyEnvVar: "GITHUB_COPILOT_TOKEN",
        models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "claude-3.5-sonnet"],
        capabilities: ["streaming", "json_mode", "function_calling"],
        costPer1kTokens: 0.0003,
        speedRank: 2,
        qualityRank: 1,
        defaultModel: "gpt-4",
        supportsTools: true,
        headers: {
            "Editor-Version": "vscode/1.85.0",
            "Editor-Plugin-Version": "copilot/1.150.0",
        },
    },
    kimi: {
        name: "kimi",
        baseUrl: "https://api.moonshot.cn/v1/chat/completions",
        apiKeyEnvVar: "KIMI_API_KEY",
        models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        capabilities: ["streaming", "json_mode", "function_calling"],
        costPer1kTokens: 0.0002,
        speedRank: 3,
        qualityRank: 2,
        defaultModel: "moonshot-v1-32k",
        supportsTools: true,
    },
    anthropic: {
        name: "anthropic",
        baseUrl: "https://api.anthropic.com/v1/messages",
        apiKeyEnvVar: "ANTHROPIC_API_KEY",
        models: [
            "claude-3-5-sonnet-20241022",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "claude-opus-4-6-20260206",
        ],
        capabilities: ["streaming", "vision", "json_mode", "function_calling"],
        costPer1kTokens: 0.003,
        speedRank: 3,
        qualityRank: 1,
        defaultModel: "claude-3-5-sonnet-20241022",
        supportsTools: true,
        headers: {
            "anthropic-version": "2023-06-01",
        },
    },
    mistral: {
        name: "mistral",
        baseUrl: "https://api.mistral.ai/v1/chat/completions",
        apiKeyEnvVar: "MISTRAL_API_KEY",
        models: [
            "mistral-large-latest",
            "mistral-medium-latest",
            "mistral-small-latest",
            "codestral-latest",
        ],
        capabilities: ["streaming", "json_mode", "function_calling"],
        costPer1kTokens: 0.002,
        speedRank: 2,
        qualityRank: 2,
        defaultModel: "mistral-large-latest",
        supportsTools: true,
    },

    jan: {
        name: "jan",
        baseUrl: `${process.env.JAN_BASE_URL || "http://localhost:1337"}/v1/chat/completions`,
        apiKeyEnvVar: "",
        models: [
            "llama3.1",
            "mistral",
            "codellama",
            "gemma2",
            "phi-3",
            "deepseek-coder-v2",
        ],
        capabilities: ["streaming", "function_calling"],
        costPer1kTokens: 0, // Local = free
        speedRank: 5,
        qualityRank: 4,
        defaultModel: "llama3.1",
        supportsTools: true,
    },
    google: {
        name: "google",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKeyEnvVar: "GOOGLE_AI_API_KEY",
        models: [
            "gemini-3-pro",
            "gemini-2.5-pro-preview-06-05",
            "gemini-2.5-flash-preview-05-20",
            "gemini-2.0-flash",
        ],
        capabilities: ["streaming", "vision", "json_mode", "function_calling"],
        costPer1kTokens: 0.00125,
        speedRank: 2,
        qualityRank: 2,
        defaultModel: "gemini-3-pro",
        supportsTools: true,
    },
    grump: {
        name: "grump",
        baseUrl: "", // Meta-provider; routes to sub-providers
        apiKeyEnvVar: "",
        models: [
            "g-compn1-auto",
            "g-compn1-quality",
            "g-compn1-fast",
            "g-compn1-balanced",
        ],
        capabilities: ["streaming", "vision", "json_mode", "function_calling"],
        costPer1kTokens: 0.0015, // Blended average of sub-providers
        speedRank: 2,
        qualityRank: 1,
        defaultModel: "g-compn1-auto",
        supportsTools: true,
    },
};

// =============================================================================
// Timeout Configuration
// =============================================================================

// SPEED OPTIMIZATION: Tighter timeouts — fail faster and let retry/fallback handle it
const TIMEOUT_DEFAULT_MS = Number(
    process.env.LLM_TIMEOUT_DEFAULT_MS ?? 120_000,   // Increased from 90s for larger token requests
);
const TIMEOUT_FAST_MS = Number(process.env.LLM_TIMEOUT_FAST_MS ?? 20_000);
const TIMEOUT_SLOW_MS = Number(process.env.LLM_TIMEOUT_SLOW_MS ?? 600_000); // 10 min for local models (Ollama)

export function getTimeoutMs(provider: LLMProvider, maxTokens?: number): number {

    // GitHub Copilot is consistently fast
    if (provider === "github-copilot")
        return TIMEOUT_FAST_MS;

    // Ollama depends on local hardware
    if (provider === "ollama") return TIMEOUT_SLOW_MS;

    // Large token requests need more time
    if (typeof maxTokens === "number" && maxTokens > 4096) {
        return Math.max(TIMEOUT_DEFAULT_MS, 180_000); // Increased from 120s for 32K+ token requests
    }

    return TIMEOUT_DEFAULT_MS;
}

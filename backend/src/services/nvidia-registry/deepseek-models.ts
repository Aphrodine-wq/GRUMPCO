import type { NvidiaModelConfig } from "./types.js";

/**
 * DeepSeek Models (DeepSeek AI)
 */
export const DEEPSEEK_MODELS: NvidiaModelConfig[] = [
  {
    id: "deepseek-ai/deepseek-v3.2",
    name: "DeepSeek V3.2",
    publisher: "DeepSeek AI",
    capabilities: ["chat", "reasoning", "long-context", "function-calling"],
    contextWindow: 128_000,
    costPerTokenInput: 0.45 / 1_000_000,
    costPerTokenOutput: 0.45 / 1_000_000,
    description:
      "685B reasoning LLM with sparse attention and integrated agentic tools",
    bestFor: ["advanced reasoning", "agentic workflows", "long-context tasks"],
    parameters: "685B",
    moE: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: "deepseek-ai/deepseek-v3.1",
    name: "DeepSeek V3.1",
    publisher: "DeepSeek AI",
    capabilities: ["chat", "reasoning", "function-calling", "agentic"],
    contextWindow: 128_000,
    costPerTokenInput: 0.4 / 1_000_000,
    costPerTokenOutput: 0.4 / 1_000_000,
    description: "Hybrid AI model with fast reasoning and strong tool use",
    bestFor: ["general chat", "tool use", "reasoning tasks"],
    parameters: "685B",
    moE: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: "deepseek-ai/deepseek-v3.1-terminus",
    name: "DeepSeek V3.1 Terminus",
    publisher: "DeepSeek AI",
    capabilities: ["chat", "reasoning", "tool-calling", "agentic"],
    contextWindow: 128_000,
    costPerTokenInput: 0.45 / 1_000_000,
    costPerTokenOutput: 0.45 / 1_000_000,
    description:
      "Hybrid inference LLM with Think/Non-Think modes and strict function calling",
    bestFor: [
      "complex agents",
      "structured reasoning",
      "tool-intensive workflows",
    ],
    parameters: "685B",
    moE: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: "deepseek-ai/deepseek-r1-distill-llama-8b",
    name: "DeepSeek R1 Distill Llama 8B",
    publisher: "DeepSeek AI",
    capabilities: ["chat", "reasoning", "code"],
    contextWindow: 128_000,
    costPerTokenInput: 0.02 / 1_000_000,
    costPerTokenOutput: 0.02 / 1_000_000,
    description: "Distilled reasoning model based on Llama 3.1 8B",
    bestFor: ["edge reasoning", "lightweight reasoning tasks", "mobile"],
    parameters: "8B",
    supportsTools: false,
    supportsStreaming: true,
  },
];

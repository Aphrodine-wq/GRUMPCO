import type { NvidiaModelConfig } from "./types.js";

/**
 * Safety and Security Models (NVIDIA)
 */
export const SAFETY_MODELS: NvidiaModelConfig[] = [
  {
    id: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
    name: "Nemotron Safety Guard 8B",
    publisher: "NVIDIA",
    capabilities: ["safety", "multilingual"],
    contextWindow: 128_000,
    costPerTokenInput: 0.05 / 1_000_000,
    costPerTokenOutput: 0.05 / 1_000_000,
    description:
      "Leading multilingual content safety model for LLM safety and moderation",
    bestFor: ["content moderation", "safety guardrails", "multilingual safety"],
    parameters: "8B",
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "nvidia/nemotron-content-safety-reasoning-4b",
    name: "Nemotron Content Safety Reasoning 4B",
    publisher: "NVIDIA",
    capabilities: ["safety", "reasoning"],
    contextWindow: 32_000,
    costPerTokenInput: 0.03 / 1_000_000,
    costPerTokenOutput: 0.03 / 1_000_000,
    description:
      "Context-aware safety model that applies reasoning to enforce domain-specific policies",
    bestFor: [
      "policy enforcement",
      "context-aware moderation",
      "reasoning safety",
    ],
    parameters: "4B",
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "nvidia/nemoguard-jailbreak-detect",
    name: "NeMo Guard Jailbreak Detect",
    publisher: "NVIDIA",
    capabilities: ["safety", "security"],
    contextWindow: 8_000,
    costPerTokenInput: 0.02 / 1_000_000,
    costPerTokenOutput: 0.02 / 1_000_000,
    description:
      "Industry-leading jailbreak classification model for adversarial protection",
    bestFor: ["jailbreak detection", "prompt injection defense", "security"],
    supportsTools: false,
    supportsStreaming: false,
  },
];

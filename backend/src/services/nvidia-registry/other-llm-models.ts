import type { NvidiaModelConfig } from "./types.js";

/**
 * Other LLM Models (Google, OpenAI, ByteDance, MiniMax, IBM, GLM, THUDM, Sarvam, Microsoft)
 */
export const OTHER_LLM_MODELS: NvidiaModelConfig[] = [
  // ==================== GOOGLE GEMMA MODELS ====================
  {
    id: "google/gemma-3n-e2b-it",
    name: "Gemma 3N E2B IT",
    publisher: "Google",
    capabilities: ["chat", "vision", "multimodal", "speech-recognition"],
    contextWindow: 128_000,
    costPerTokenInput: 0.08 / 1_000_000,
    costPerTokenOutput: 0.08 / 1_000_000,
    description:
      "Edge computing AI model accepting text, audio and image input",
    bestFor: ["edge deployment", "multimodal edge apps", "voice+vision tasks"],
    parameters: "2B",
    multimodal: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: "google/gemma-3n-e4b-it",
    name: "Gemma 3N E4B IT",
    publisher: "Google",
    capabilities: ["chat", "vision", "multimodal", "speech-recognition"],
    contextWindow: 128_000,
    costPerTokenInput: 0.12 / 1_000_000,
    costPerTokenOutput: 0.12 / 1_000_000,
    description: "Edge computing AI model with enhanced capabilities",
    bestFor: ["edge deployment", "rich multimodal apps", "mobile AI"],
    parameters: "4B",
    multimodal: true,
    supportsTools: true,
    supportsStreaming: true,
  },

  // ==================== OPENAI MODELS ====================
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    publisher: "OpenAI",
    capabilities: ["chat", "reasoning", "math"],
    contextWindow: 128_000,
    costPerTokenInput: 0.1 / 1_000_000,
    costPerTokenOutput: 0.1 / 1_000_000,
    description: "Smaller MoE text-only LLM for efficient reasoning and math",
    bestFor: [
      "efficient reasoning",
      "mathematical tasks",
      "cost-effective inference",
    ],
    parameters: "20B (MoE)",
    moE: true,
    supportsTools: false,
    supportsStreaming: true,
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    publisher: "OpenAI",
    capabilities: ["chat", "reasoning", "math"],
    contextWindow: 128_000,
    costPerTokenInput: 0.5 / 1_000_000,
    costPerTokenOutput: 0.5 / 1_000_000,
    description: "MoE reasoning LLM designed to fit within 80GB GPU",
    bestFor: ["complex reasoning", "research", "on-premise deployment"],
    parameters: "120B (MoE)",
    moE: true,
    supportsTools: false,
    supportsStreaming: true,
  },

  // ==================== BYTEDANCE MODELS ====================
  {
    id: "bytedance/seed-oss-36b-instruct",
    name: "SEED-OSS 36B",
    publisher: "ByteDance",
    capabilities: ["chat", "reasoning", "text-generation"],
    contextWindow: 128_000,
    costPerTokenInput: 0.2 / 1_000_000,
    costPerTokenOutput: 0.2 / 1_000_000,
    description:
      "Open-source LLM with long-context, reasoning, and agentic intelligence",
    bestFor: ["long-document processing", "reasoning", "agent applications"],
    parameters: "36B",
    supportsTools: true,
    supportsStreaming: true,
  },

  // ==================== MINIMAX MODELS ====================
  {
    id: "minimaxai/minimax-m2",
    name: "MiniMax M2",
    publisher: "MiniMax",
    capabilities: [
      "chat",
      "reasoning",
      "function-calling",
      "agentic",
      "long-context",
    ],
    contextWindow: 256_000,
    costPerTokenInput: 0.4 / 1_000_000,
    costPerTokenOutput: 0.4 / 1_000_000,
    description:
      "Open Mixture of Experts LLM (230B, 10B active) for reasoning and tool-use",
    bestFor: [
      "agentic workflows",
      "long-context reasoning",
      "tool-intensive tasks",
    ],
    parameters: "230B (10B active)",
    moE: true,
    supportsTools: true,
    supportsStreaming: true,
  },

  // ==================== IBM MODELS ====================
  {
    id: "ibm/granite-3.3-8b-instruct",
    name: "Granite 3.3 8B",
    publisher: "IBM",
    capabilities: ["chat", "code", "reasoning", "instruction-following"],
    contextWindow: 128_000,
    costPerTokenInput: 0.05 / 1_000_000,
    costPerTokenOutput: 0.05 / 1_000_000,
    description:
      "Small language model fine-tuned for reasoning, coding, and instruction-following",
    bestFor: [
      "enterprise coding",
      "reliable instruction following",
      "IBM ecosystem",
    ],
    parameters: "8B",
    supportsTools: true,
    supportsStreaming: true,
  },

  // ==================== GLM MODELS ====================
  {
    id: "z-ai/glm4.7",
    name: "GLM-4.7",
    publisher: "Z-AI",
    capabilities: ["chat", "code", "reasoning", "tool-calling", "multilingual"],
    contextWindow: 128_000,
    costPerTokenInput: 0.25 / 1_000_000,
    costPerTokenOutput: 0.25 / 1_000_000,
    description:
      "Multilingual agentic coding partner with stronger reasoning and tool use",
    bestFor: ["multilingual coding", "tool use", "UI development"],
    parameters: "Unknown",
    supportsTools: true,
    supportsStreaming: true,
  },

  // ==================== THUDM MODELS ====================
  {
    id: "thudm/chatglm3-6b",
    name: "ChatGLM3 6B",
    publisher: "THUDM",
    capabilities: ["chat", "code", "translation", "multilingual"],
    contextWindow: 32_000,
    costPerTokenInput: 0.03 / 1_000_000,
    costPerTokenOutput: 0.03 / 1_000_000,
    description:
      "Chinese and English model for chatbots, content generation, coding",
    bestFor: ["Chinese language tasks", "translation", "lightweight chat"],
    parameters: "6B",
    supportsTools: true,
    supportsStreaming: true,
    languages: ["zh", "en"],
  },

  // ==================== SARVAM MODELS ====================
  {
    id: "sarvamai/sarvam-m",
    name: "Sarvam M",
    publisher: "Sarvam AI",
    capabilities: ["chat", "code", "reasoning", "math", "multilingual"],
    contextWindow: 128_000,
    costPerTokenInput: 0.15 / 1_000_000,
    costPerTokenOutput: 0.15 / 1_000_000,
    description:
      "Multilingual hybrid-reasoning model optimized for Indian languages",
    bestFor: [
      "Indian language tasks",
      "multilingual apps",
      "Indic programming",
    ],
    parameters: "Unknown",
    supportsTools: true,
    supportsStreaming: true,
    languages: ["hi", "ta", "te", "kn", "ml", "mr", "bn", "gu", "pa", "en"],
  },

  // ==================== MICROSOFT MODELS ====================
  {
    id: "microsoft/phi-4-mini-flash-reasoning",
    name: "Phi-4 Mini Flash Reasoning",
    publisher: "Microsoft",
    capabilities: ["chat", "reasoning", "text-generation", "math"],
    contextWindow: 16_000,
    costPerTokenInput: 0.02 / 1_000_000,
    costPerTokenOutput: 0.02 / 1_000_000,
    description:
      "Lightweight reasoning model for latency-bound, memory-constrained environments",
    bestFor: ["edge reasoning", "mobile math", "fast reasoning"],
    parameters: "Unknown",
    supportsTools: false,
    supportsStreaming: true,
  },
];

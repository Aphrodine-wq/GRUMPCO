import type { NvidiaModelConfig } from "./types.js";

/**
 * Vision and Physical AI Models (NVIDIA)
 */
export const VISION_PHYSICAL_MODELS: NvidiaModelConfig[] = [
  {
    id: "nvidia/cosmos-reason1-7b",
    name: "Cosmos Reason1 7B",
    publisher: "NVIDIA",
    capabilities: ["vision", "reasoning", "multimodal"],
    contextWindow: 8_000,
    costPerTokenInput: 0.1 / 1_000_000,
    costPerTokenOutput: 0.1 / 1_000_000,
    description: "Reasoning vision language model for physical AI and robotics",
    bestFor: ["robotics", "physical AI", "video understanding", "industrial"],
    parameters: "7B",
    multimodal: true,
    supportsTools: false,
    supportsStreaming: true,
  },
  {
    id: "nvidia/cosmos-reason2-8b",
    name: "Cosmos Reason2 8B",
    publisher: "NVIDIA",
    capabilities: ["vision", "reasoning", "multimodal"],
    contextWindow: 8_000,
    costPerTokenInput: 0.12 / 1_000_000,
    costPerTokenOutput: 0.12 / 1_000_000,
    description:
      "Vision language model for structured reasoning on videos or images",
    bestFor: [
      "video reasoning",
      "synthetic data generation",
      "autonomous vehicles",
    ],
    parameters: "8B",
    multimodal: true,
    supportsTools: false,
    supportsStreaming: true,
  },
  {
    id: "nvidia/nvclip",
    name: "NV-CLIP",
    publisher: "NVIDIA",
    capabilities: ["embedding", "vision", "multimodal"],
    contextWindow: 77,
    costPerTokenInput: 0.02 / 1_000_000,
    costPerTokenOutput: 0,
    description: "Multimodal embeddings model for image and text",
    bestFor: [
      "image-text similarity",
      "multimodal search",
      "visual embeddings",
    ],
    multimodal: true,
    supportsTools: false,
    supportsStreaming: false,
  },
];

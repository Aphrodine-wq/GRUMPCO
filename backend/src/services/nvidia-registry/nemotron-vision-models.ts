import type { NvidiaModelConfig } from "./types.js";

/**
 * Nemotron Vision Models (NVIDIA)
 */
export const NEMOTRON_VISION_MODELS: NvidiaModelConfig[] = [
  {
    id: "nvidia/nemotron-nano-12b-v2-vl",
    name: "Nemotron Nano 12B v2 VL",
    publisher: "NVIDIA",
    capabilities: ["chat", "vision", "multimodal", "reasoning"],
    contextWindow: 128_000,
    costPerTokenInput: 0.1 / 1_000_000,
    costPerTokenOutput: 0.1 / 1_000_000,
    description:
      "Multi-image and video understanding with visual Q&A and summarization",
    bestFor: ["video understanding", "multi-image analysis", "visual QA"],
    parameters: "12B",
    multimodal: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    name: "Nemotron Nano VL 8B",
    publisher: "NVIDIA",
    capabilities: ["chat", "vision", "multimodal", "reasoning", "OCR"],
    contextWindow: 128_000,
    costPerTokenInput: 0.08 / 1_000_000,
    costPerTokenOutput: 0.08 / 1_000_000,
    description:
      "Multi-modal vision-language model for text/img understanding and OCR",
    bestFor: [
      "document intelligence",
      "OCR",
      "visual understanding",
      "edge vision",
    ],
    parameters: "8B",
    multimodal: true,
    supportsTools: true,
    supportsStreaming: true,
  },
];

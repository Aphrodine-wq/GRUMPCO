import type { NvidiaModelConfig } from "./types.js";

/**
 * Creative Generation Models
 * - Image Generation
 * - 3D Generation
 * - Video Generation
 */
export const CREATIVE_MODELS: NvidiaModelConfig[] = [
  // ==================== IMAGE GENERATION MODELS ====================
  {
    id: "stabilityai/stable-diffusion-3.5-large",
    name: "Stable Diffusion 3.5 Large",
    publisher: "Stability AI",
    capabilities: ["image-generation"],
    contextWindow: 0,
    costPerTokenInput: 0.03 / 1_000_000,
    costPerTokenOutput: 0.003 / 1_000_000,
    description:
      "Popular text-to-image generation model with high quality outputs",
    bestFor: ["text-to-image", "art generation", "design"],
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "black-forest-labs/flux_1-kontext-dev",
    name: "FLUX.1 Kontext Dev",
    publisher: "Black Forest Labs",
    capabilities: ["image-generation"],
    contextWindow: 0,
    costPerTokenInput: 0.04 / 1_000_000,
    costPerTokenOutput: 0.004 / 1_000_000,
    description: "Multimodal model for in-context image generation and editing",
    bestFor: [
      "image editing",
      "context-aware generation",
      "visual manipulation",
    ],
    supportsTools: false,
    supportsStreaming: false,
  },

  // ==================== 3D GENERATION MODELS ====================
  {
    id: "microsoft/trellis",
    name: "TRELLIS",
    publisher: "Microsoft",
    capabilities: ["3d-generation", "image-to-3d", "text-to-3d"],
    contextWindow: 0,
    costPerTokenInput: 0.05 / 1_000_000,
    costPerTokenOutput: 0.005 / 1_000_000,
    description:
      "3D AI model that generates high-quality 3D assets from text or image inputs",
    bestFor: ["3D asset generation", "game development", "3D modeling"],
    supportsTools: false,
    supportsStreaming: false,
  },

  // ==================== VIDEO GENERATION MODELS ====================
  {
    id: "nvidia/cosmos-transfer1-7b",
    name: "Cosmos Transfer1 7B",
    publisher: "NVIDIA",
    capabilities: ["video-generation", "physical-ai"],
    contextWindow: 0,
    costPerTokenInput: 0.2 / 1_000_000,
    costPerTokenOutput: 0.02 / 1_000_000,
    description:
      "Generates physics-aware video world states for physical AI development",
    bestFor: [
      "synthetic video generation",
      "physical simulation",
      "robotics training",
    ],
    supportsTools: false,
    supportsStreaming: false,
  },
];

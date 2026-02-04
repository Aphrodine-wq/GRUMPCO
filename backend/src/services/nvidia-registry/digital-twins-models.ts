import type { NvidiaModelConfig } from "./types.js";

/**
 * OpenUSD/Digital Twins Models (NVIDIA)
 */
export const DIGITAL_TWINS_MODELS: NvidiaModelConfig[] = [
  {
    id: "nvidia/usdcode",
    name: "USD Code",
    publisher: "NVIDIA",
    capabilities: ["chat", "code", "OpenUSD"],
    contextWindow: 32_000,
    costPerTokenInput: 0.15 / 1_000_000,
    costPerTokenOutput: 0.15 / 1_000_000,
    description:
      "State-of-the-art LLM for OpenUSD knowledge and USD-Python code generation",
    bestFor: [
      "OpenUSD development",
      "digital twins",
      "synthetic data generation",
    ],
    supportsTools: true,
    supportsStreaming: true,
  },
];

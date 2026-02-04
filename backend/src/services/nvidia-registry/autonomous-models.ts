import type { NvidiaModelConfig } from "./types.js";

/**
 * Autonomous Vehicle Models (NVIDIA)
 */
export const AUTONOMOUS_MODELS: NvidiaModelConfig[] = [
  {
    id: "nvidia/streampetr",
    name: "StreamPETR",
    publisher: "NVIDIA",
    capabilities: ["autonomous-vehicles", "3d-detection", "perception"],
    contextWindow: 0,
    costPerTokenInput: 0.1 / 1_000_000,
    costPerTokenOutput: 0,
    description:
      "Efficient 3D object detection for autonomous driving with temporal propagation",
    bestFor: ["autonomous vehicles", "3D perception", "temporal tracking"],
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "nvidia/sparsedrive",
    name: "SparseDrive",
    publisher: "NVIDIA",
    capabilities: [
      "autonomous-vehicles",
      "end-to-end",
      "perception",
      "planning",
    ],
    contextWindow: 0,
    costPerTokenInput: 0.15 / 1_000_000,
    costPerTokenOutput: 0,
    description:
      "End-to-end autonomous driving stack with sparse scene representations",
    bestFor: [
      "autonomous driving",
      "perception-prediction-planning",
      "AV stack",
    ],
    supportsTools: false,
    supportsStreaming: false,
  },
  {
    id: "nvidia/bevformer",
    name: "BEVFormer",
    publisher: "NVIDIA",
    capabilities: ["autonomous-vehicles", "perception", "3d-detection"],
    contextWindow: 0,
    costPerTokenInput: 0.12 / 1_000_000,
    costPerTokenOutput: 0,
    description:
      "Advanced transformer for multi-frame bird's-eye-view 3D perception",
    bestFor: ["BEV perception", "autonomous vehicles", "multi-frame detection"],
    supportsTools: false,
    supportsStreaming: false,
  },
];

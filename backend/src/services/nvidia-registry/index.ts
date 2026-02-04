/**
 * NVIDIA Model Registry
 *
 * Comprehensive registry of all available models from build.nvidia.com.
 * Includes all LLMs, VLMs, embeddings, and specialized models.
 *
 * This is the main barrel file that re-exports everything from the modular registry.
 *
 * @see https://build.nvidia.com/models
 */

// Re-export types
export type { NvidiaModelCapability, NvidiaModelConfig } from "./types.js";

// Re-export cost constants
export {
  COST_TIER_LOW,
  COST_TIER_MEDIUM,
  COST_TIER_HIGH,
  COST_TIER_PREMIUM,
} from "./types.js";

// Re-export model arrays
export { LLAMA_MODELS } from "./llama-models.js";
export { MISTRAL_MODELS } from "./mistral-models.js";
export { DEEPSEEK_MODELS } from "./deepseek-models.js";
export { NEMOTRON_MODELS } from "./nemotron-models.js";
export { NEMOTRON_VISION_MODELS } from "./nemotron-vision-models.js";
export { KIMI_MODELS } from "./kimi-models.js";
export { QWEN_MODELS } from "./qwen-models.js";
export { OTHER_LLM_MODELS } from "./other-llm-models.js";
export { REGIONAL_MODELS } from "./regional-models.js";
export { EMBEDDING_MODELS } from "./embedding-models.js";
export { SAFETY_MODELS } from "./safety-models.js";
export { DOCUMENT_AI_MODELS } from "./document-ai-models.js";
export { SPEECH_MODELS } from "./speech-models.js";
export { VISION_PHYSICAL_MODELS } from "./vision-physical-models.js";
export { CREATIVE_MODELS } from "./creative-models.js";
export { AUTONOMOUS_MODELS } from "./autonomous-models.js";
export { LIFE_SCIENCES_MODELS } from "./life-sciences-models.js";
export { AUDIO_VISUAL_MODELS } from "./audio-visual-models.js";
export { DIGITAL_TWINS_MODELS } from "./digital-twins-models.js";

// Re-export helpers and UI components
export {
  // Helper functions
  getNvidiaModelById,
  getNvidiaModelsByCapability,
  getNvidiaModelsByPublisher,
  getNvidiaChatModels,
  getNvidiaCodeModels,
  getNvidiaVisionModels,
  getNvidiaEmbeddingModels,
  getNvidiaSafetyModels,
  getCheapestNvidiaModel,
  getLargestContextNvidiaModel,
  estimateNvidiaCost,
  // UI labels and categories
  MODEL_CAPABILITY_LABELS,
  MODEL_CATEGORIES,
  // Main registry (re-exported from helpers to avoid circular dependency)
  NVIDIA_MODEL_REGISTRY,
} from "./helpers.js";

// Backward compatibility: also export as default
export { NVIDIA_MODEL_REGISTRY as default } from "./helpers.js";

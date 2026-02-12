/**
 * NVIDIA Model Registry - Types and Interfaces
 *
 * Core type definitions for the NVIDIA model registry.
 *
 * @see https://build.nvidia.com/models
 */

export type NvidiaModelCapability =
  | 'chat'
  | 'code'
  | 'vision'
  | 'multimodal'
  | 'reasoning'
  | 'embedding'
  | 'image-generation'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'translation'
  | 'reranking'
  | 'safety'
  | 'agentic'
  | 'long-context'
  | 'function-calling'
  | 'tool-calling'
  | 'multilingual'
  | 'OCR'
  | 'text-generation'
  | 'math'
  | 'speech-recognition'
  | 'instruction-following'
  | 'summarization'
  | 'security'
  | '3d-generation'
  | 'image-to-3d'
  | 'text-to-3d'
  | 'video-generation'
  | 'physical-ai'
  | 'autonomous-vehicles'
  | 'end-to-end'
  | 'perception'
  | '3d-detection'
  | 'planning'
  | 'biology'
  | 'chemistry'
  | 'molecule-generation'
  | 'docking'
  | 'protein-folding'
  | 'drug-discovery'
  | 'protein-generation'
  | 'sequence-alignment'
  | 'speech-to-animation'
  | 'digital-humans'
  | 'speech-enhancement'
  | 'audio-processing'
  | 'OpenUSD';

export interface NvidiaModelConfig {
  id: string;
  name: string;
  publisher: string;
  capabilities: NvidiaModelCapability[];
  contextWindow: number;
  costPerTokenInput: number;
  costPerTokenOutput: number;
  description: string;
  bestFor: string[];
  parameters?: string;
  multimodal?: boolean;
  moE?: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  languages?: string[];
}

// Cost constants (per 1M tokens for consistency with industry standard)
export const COST_TIER_LOW = 0.1; // ~$0.10 per 1M tokens
export const COST_TIER_MEDIUM = 0.6; // ~$0.60 per 1M tokens
export const COST_TIER_HIGH = 1.0; // ~$1.00 per 1M tokens
export const COST_TIER_PREMIUM = 3.0; // ~$3.00+ per 1M tokens

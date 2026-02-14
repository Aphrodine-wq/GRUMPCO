import type { NvidiaModelCapability, NvidiaModelConfig } from './types.js';

// Helper functions
export function getNvidiaModelById(id: string): NvidiaModelConfig | undefined {
  return NVIDIA_MODEL_REGISTRY.find((m) => m.id === id);
}

export function getNvidiaModelsByCapability(cap: NvidiaModelCapability): NvidiaModelConfig[] {
  return NVIDIA_MODEL_REGISTRY.filter((m) => m.capabilities.includes(cap));
}

export function getNvidiaModelsByPublisher(publisher: string): NvidiaModelConfig[] {
  return NVIDIA_MODEL_REGISTRY.filter((m) => m.publisher.toLowerCase() === publisher.toLowerCase());
}

export function getNvidiaChatModels(): NvidiaModelConfig[] {
  return NVIDIA_MODEL_REGISTRY.filter((m) => m.capabilities.includes('chat') && m.supportsTools);
}

export function getNvidiaCodeModels(): NvidiaModelConfig[] {
  return NVIDIA_MODEL_REGISTRY.filter((m) => m.capabilities.includes('code'));
}

export function getNvidiaVisionModels(): NvidiaModelConfig[] {
  return NVIDIA_MODEL_REGISTRY.filter((m) => m.capabilities.includes('vision') || m.multimodal);
}

export function getNvidiaEmbeddingModels(): NvidiaModelConfig[] {
  return NVIDIA_MODEL_REGISTRY.filter((m) => m.capabilities.includes('embedding'));
}

export function getNvidiaSafetyModels(): NvidiaModelConfig[] {
  return NVIDIA_MODEL_REGISTRY.filter((m) => m.capabilities.includes('safety'));
}

export function getCheapestNvidiaModel(): NvidiaModelConfig {
  return NVIDIA_MODEL_REGISTRY.reduce((cheapest, model) => {
    const modelCost = model.costPerTokenInput + model.costPerTokenOutput;
    const cheapestCost = cheapest.costPerTokenInput + cheapest.costPerTokenOutput;
    return modelCost < cheapestCost ? model : cheapest;
  });
}

export function getLargestContextNvidiaModel(): NvidiaModelConfig {
  return NVIDIA_MODEL_REGISTRY.reduce((largest, model) =>
    model.contextWindow > largest.contextWindow ? model : largest
  );
}

export function estimateNvidiaCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): { usd: number; breakdown: string } {
  const model = getNvidiaModelById(modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found in NVIDIA registry`);
  }

  const inputCost = inputTokens * model.costPerTokenInput;
  const outputCost = outputTokens * model.costPerTokenOutput;
  const total = inputCost + outputCost;

  return {
    usd: total,
    breakdown: `${model.name}: ${inputTokens} input + ${outputTokens} output tokens`,
  };
}

// Model capability tags for UI
export const MODEL_CAPABILITY_LABELS: Record<
  NvidiaModelCapability,
  { label: string; color: string; icon: string }
> = {
  chat: { label: 'Chat', color: 'blue', icon: '💬' },
  code: { label: 'Code', color: 'green', icon: '💻' },
  vision: { label: 'Vision', color: 'purple', icon: '👁️' },
  multimodal: { label: 'Multimodal', color: 'orange', icon: '🎨' },
  reasoning: { label: 'Reasoning', color: 'red', icon: '🧠' },
  embedding: { label: 'Embedding', color: 'gray', icon: '📊' },
  'image-generation': { label: 'Image Gen', color: 'pink', icon: '🖼️' },
  'speech-to-text': { label: 'Speech-to-Text', color: 'cyan', icon: '🎤' },
  'text-to-speech': { label: 'Text-to-Speech', color: 'teal', icon: '🔊' },
  translation: { label: 'Translation', color: 'indigo', icon: '🌐' },
  reranking: { label: 'Reranking', color: 'yellow', icon: '📈' },
  safety: { label: 'Safety', color: 'red', icon: '🛡️' },
  agentic: { label: 'Agentic', color: 'violet', icon: '🤖' },
  'long-context': { label: 'Long Context', color: 'amber', icon: '📚' },
  'function-calling': {
    label: 'Function Calling',
    color: 'emerald',
    icon: '⚡',
  },
  'tool-calling': { label: 'Tool Calling', color: 'lime', icon: '🔧' },
  multilingual: { label: 'Multilingual', color: 'sky', icon: '🌍' },
  OCR: { label: 'OCR', color: 'slate', icon: '📄' },
  'text-generation': { label: 'Text Gen', color: 'blue', icon: '✍️' },
  math: { label: 'Math', color: 'orange', icon: '🔢' },
  'speech-recognition': {
    label: 'Speech Recognition',
    color: 'cyan',
    icon: '🎙️',
  },
  'instruction-following': {
    label: 'Instruction Following',
    color: 'green',
    icon: '📋',
  },
  summarization: { label: 'Summarization', color: 'teal', icon: '📝' },
  security: { label: 'Security', color: 'red', icon: '🔒' },
  '3d-generation': { label: '3D Generation', color: 'purple', icon: '🎲' },
  'image-to-3d': { label: 'Image to 3D', color: 'purple', icon: '🖼️' },
  'text-to-3d': { label: 'Text to 3D', color: 'purple', icon: '📦' },
  'video-generation': { label: 'Video Gen', color: 'pink', icon: '🎬' },
  'physical-ai': { label: 'Physical AI', color: 'amber', icon: '🦾' },
  'autonomous-vehicles': {
    label: 'Autonomous Vehicles',
    color: 'blue',
    icon: '🚗',
  },
  'end-to-end': { label: 'End-to-End', color: 'green', icon: '🔄' },
  perception: { label: 'Perception', color: 'violet', icon: '👁️' },
  '3d-detection': { label: '3D Detection', color: 'indigo', icon: '📍' },
  planning: { label: 'Planning', color: 'emerald', icon: '🗺️' },
  biology: { label: 'Biology', color: 'green', icon: '🧬' },
  chemistry: { label: 'Chemistry', color: 'yellow', icon: '⚗️' },
  'molecule-generation': { label: 'Molecule Gen', color: 'lime', icon: '🔬' },
  docking: { label: 'Docking', color: 'teal', icon: '🎯' },
  'protein-folding': { label: 'Protein Folding', color: 'green', icon: '🧪' },
  'drug-discovery': { label: 'Drug Discovery', color: 'red', icon: '💊' },
  'protein-generation': { label: 'Protein Gen', color: 'emerald', icon: '🦠' },
  'sequence-alignment': {
    label: 'Sequence Alignment',
    color: 'blue',
    icon: '🔗',
  },
  'speech-to-animation': {
    label: 'Speech to Animation',
    color: 'pink',
    icon: '🎭',
  },
  'digital-humans': { label: 'Digital Humans', color: 'violet', icon: '🧑' },
  'speech-enhancement': {
    label: 'Speech Enhancement',
    color: 'cyan',
    icon: '🔉',
  },
  'audio-processing': { label: 'Audio Processing', color: 'teal', icon: '🎵' },
  OpenUSD: { label: 'OpenUSD', color: 'orange', icon: '🏗️' },
};

// Model categories for grouping in UI
export const MODEL_CATEGORIES = {
  'Llama Family': ['Meta'],
  'Mistral Family': ['Mistral AI'],
  DeepSeek: ['DeepSeek AI'],
  Nemotron: ['NVIDIA'],
  Kimi: ['Moonshot AI'],
  Qwen: ['Qwen'],
  Specialized: [
    'IBM',
    'Google',
    'OpenAI',
    'ByteDance',
    'MiniMax',
    'Z-AI',
    'THUDM',
    'Sarvam AI',
    'Microsoft',
  ],
  'Regional AI': ['Stockmark', 'SpeakLeash', 'OpenGPT-X', 'Utter Project', 'Goto Company'],
  Embeddings: ['NVIDIA'], // Will be filtered by capability
  Safety: ['NVIDIA', 'Meta'], // Will be filtered by capability
  'Document AI': ['NVIDIA', 'Baidu'],
  Speech: ['NVIDIA'],
  'Vision & Physical AI': ['NVIDIA'],
  Creative: ['Stability AI', 'Black Forest Labs', 'Microsoft'],
  'Autonomous Vehicles': ['NVIDIA'],
  'Life Sciences': ['NVIDIA', 'MIT', 'OpenFold', 'IPD', 'ColabFold'],
  'Audio/Visual': ['NVIDIA'],
  'Digital Twins': ['NVIDIA'],
} as const;

// Import all model arrays for the main registry (will be set in index.ts)
import { LLAMA_MODELS } from './llama-models.js';
import { MISTRAL_MODELS } from './mistral-models.js';
import { DEEPSEEK_MODELS } from './deepseek-models.js';
import { NEMOTRON_MODELS } from './nemotron-models.js';
import { NEMOTRON_VISION_MODELS } from './nemotron-vision-models.js';
import { KIMI_MODELS } from './kimi-models.js';
import { QWEN_MODELS } from './qwen-models.js';
import { OTHER_LLM_MODELS } from './other-llm-models.js';
import { REGIONAL_MODELS } from './regional-models.js';
import { EMBEDDING_MODELS } from './embedding-models.js';
import { SAFETY_MODELS } from './safety-models.js';
import { DOCUMENT_AI_MODELS } from './document-ai-models.js';
import { SPEECH_MODELS } from './speech-models.js';
import { VISION_PHYSICAL_MODELS } from './vision-physical-models.js';
import { CREATIVE_MODELS } from './creative-models.js';
import { AUTONOMOUS_MODELS } from './autonomous-models.js';
import { LIFE_SCIENCES_MODELS } from './life-sciences-models.js';
import { AUDIO_VISUAL_MODELS } from './audio-visual-models.js';
import { DIGITAL_TWINS_MODELS } from './digital-twins-models.js';

// Combined model registry
export const NVIDIA_MODEL_REGISTRY: NvidiaModelConfig[] = [
  ...LLAMA_MODELS,
  ...MISTRAL_MODELS,
  ...DEEPSEEK_MODELS,
  ...NEMOTRON_MODELS,
  ...NEMOTRON_VISION_MODELS,
  ...KIMI_MODELS,
  ...QWEN_MODELS,
  ...OTHER_LLM_MODELS,
  ...REGIONAL_MODELS,
  ...EMBEDDING_MODELS,
  ...SAFETY_MODELS,
  ...DOCUMENT_AI_MODELS,
  ...SPEECH_MODELS,
  ...VISION_PHYSICAL_MODELS,
  ...CREATIVE_MODELS,
  ...AUTONOMOUS_MODELS,
  ...LIFE_SCIENCES_MODELS,
  ...AUDIO_VISUAL_MODELS,
  ...DIGITAL_TWINS_MODELS,
];

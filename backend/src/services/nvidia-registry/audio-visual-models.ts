import type { NvidiaModelConfig } from './types.js';

/**
 * Audio/Visual Models (NVIDIA)
 */
export const AUDIO_VISUAL_MODELS: NvidiaModelConfig[] = [
  {
    id: 'nvidia/audio2face-3d',
    name: 'Audio2Face 3D',
    publisher: 'NVIDIA',
    capabilities: ['speech-to-animation', 'digital-humans'],
    contextWindow: 0,
    costPerTokenInput: 0.1 / 1_000_000,
    costPerTokenOutput: 0,
    description: 'Converts streamed audio to facial blendshapes for realtime lipsyncing',
    bestFor: ['digital humans', 'lipsync', 'facial animation', 'realtime performance'],
    supportsTools: false,
    supportsStreaming: true,
  },
  {
    id: 'nvidia/background-noise-removal',
    name: 'Background Noise Removal',
    publisher: 'NVIDIA',
    capabilities: ['speech-enhancement', 'audio-processing'],
    contextWindow: 0,
    costPerTokenInput: 0.05 / 1_000_000,
    costPerTokenOutput: 0,
    description: 'Removes unwanted noises from audio improving speech intelligibility',
    bestFor: ['speech enhancement', 'noise reduction', 'call centers', 'meetings'],
    supportsTools: false,
    supportsStreaming: true,
  },
];

/**
 * @grump/voice – shared types for ASR/TTS and persona.
 */

export type VoicePersona = 'grump' | 'neutral';

export interface TranscribePayload {
  audio: string;
  language?: string;
}

export interface SynthesizePayload {
  text: string;
  voice?: string;
  persona?: VoicePersona;
}

export interface SynthesizeResponse {
  audio: string;
}

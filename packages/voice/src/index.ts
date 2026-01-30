/**
 * @grump/voice - ASR/TTS and voice persona for G-Rump.
 * Provides voice transcription, synthesis, and persona management.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type VoicePersona = 'grump' | 'neutral' | 'professional' | 'friendly';

export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'webm' | 'flac';

export interface TranscribePayload {
  /** Base64 encoded audio data */
  audio: string;
  /** Audio format */
  format?: AudioFormat;
  /** Language code (e.g., 'en', 'es', 'fr') */
  language?: string;
  /** Enable word-level timestamps */
  timestamps?: boolean;
}

export interface TranscribeResponse {
  /** Transcribed text */
  text: string;
  /** Detected or confirmed language */
  language?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Word-level timestamps if requested */
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  /** Processing duration in ms */
  durationMs?: number;
}

export interface SynthesizePayload {
  /** Text to synthesize */
  text: string;
  /** Voice ID or name */
  voice?: string;
  /** Voice persona for G-Rump personality */
  persona?: VoicePersona;
  /** Speech speed (0.5 - 2.0, default 1.0) */
  speed?: number;
  /** Pitch adjustment (-1.0 to 1.0) */
  pitch?: number;
  /** Output format */
  format?: AudioFormat;
  /** Sample rate in Hz */
  sampleRate?: number;
}

export interface SynthesizeResponse {
  /** Base64 encoded audio data */
  audio: string;
  /** Audio format */
  format: AudioFormat;
  /** Duration in seconds */
  duration?: number;
  /** Sample rate used */
  sampleRate?: number;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
  description?: string;
  previewUrl?: string;
}

// ============================================================================
// Voice Provider Interface
// ============================================================================

export interface IASRProvider {
  transcribe(payload: TranscribePayload): Promise<TranscribeResponse>;
  getSupportedLanguages(): Promise<string[]>;
}

export interface ITTSProvider {
  synthesize(payload: SynthesizePayload): Promise<SynthesizeResponse>;
  getVoices(): Promise<VoiceInfo[]>;
}

export interface IVoiceProvider extends IASRProvider, ITTSProvider {}

// ============================================================================
// Persona Prompts
// ============================================================================

/**
 * System prompts that adjust the voice synthesis style based on persona.
 */
export const PERSONA_STYLES: Record<VoicePersona, {
  description: string;
  ssmlEmphasis?: 'reduced' | 'moderate' | 'strong';
  prosodyRate?: string;
  prosodyPitch?: string;
}> = {
  grump: {
    description: 'Sardonic, witty, slightly exasperated but helpful',
    ssmlEmphasis: 'moderate',
    prosodyRate: '-5%',
    prosodyPitch: '-2st',
  },
  neutral: {
    description: 'Clear, professional, neutral tone',
    ssmlEmphasis: 'moderate',
    prosodyRate: '0%',
    prosodyPitch: '0st',
  },
  professional: {
    description: 'Formal, authoritative, business-like',
    ssmlEmphasis: 'reduced',
    prosodyRate: '-10%',
    prosodyPitch: '-1st',
  },
  friendly: {
    description: 'Warm, encouraging, upbeat',
    ssmlEmphasis: 'moderate',
    prosodyRate: '+5%',
    prosodyPitch: '+2st',
  },
};

// ============================================================================
// Audio Utilities
// ============================================================================

/**
 * Convert audio format between types (placeholder - actual conversion
 * would require ffmpeg or similar).
 */
export async function convertAudioFormat(
  audio: string,
  fromFormat: AudioFormat,
  toFormat: AudioFormat
): Promise<string> {
  if (fromFormat === toFormat) return audio;

  // This would require actual audio conversion library
  throw new Error(
    `Audio conversion from ${fromFormat} to ${toFormat} not implemented. ` +
    'Use ffmpeg or web audio APIs for conversion.'
  );
}

/**
 * Estimate audio duration from base64 data (approximate).
 */
export function estimateAudioDuration(
  base64Audio: string,
  format: AudioFormat,
  sampleRate: number = 16000
): number {
  // Rough estimation based on data size
  const bytes = (base64Audio.length * 3) / 4; // Base64 to bytes

  // Bytes per second varies by format
  const bytesPerSecond: Record<AudioFormat, number> = {
    wav: sampleRate * 2, // 16-bit mono
    mp3: 16000, // ~128kbps
    ogg: 12000, // ~96kbps
    webm: 12000, // ~96kbps
    flac: sampleRate * 2.5, // Lossless varies
  };

  return bytes / (bytesPerSecond[format] || 16000);
}

/**
 * Validate audio data format.
 */
export function validateAudioData(base64Audio: string): {
  valid: boolean;
  format?: AudioFormat;
  error?: string;
} {
  if (!base64Audio || base64Audio.length === 0) {
    return { valid: false, error: 'Empty audio data' };
  }

  // Check for base64 validity
  try {
    // Check if it's valid base64 (browser or Node)
    if (typeof atob !== 'undefined') {
      atob(base64Audio.slice(0, 100));
    } else {
      Buffer.from(base64Audio.slice(0, 100), 'base64');
    }
  } catch {
    return { valid: false, error: 'Invalid base64 encoding' };
  }

  // Try to detect format from magic bytes
  let decoded: Uint8Array;
  try {
    if (typeof atob !== 'undefined') {
      const binary = atob(base64Audio.slice(0, 20));
      decoded = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        decoded[i] = binary.charCodeAt(i);
      }
    } else {
      decoded = new Uint8Array(Buffer.from(base64Audio.slice(0, 20), 'base64'));
    }
  } catch {
    return { valid: true }; // Can't detect, assume valid
  }

  // Magic byte detection
  if (decoded[0] === 0x52 && decoded[1] === 0x49 && decoded[2] === 0x46 && decoded[3] === 0x46) {
    return { valid: true, format: 'wav' };
  }
  if (decoded[0] === 0xFF && (decoded[1] & 0xE0) === 0xE0) {
    return { valid: true, format: 'mp3' };
  }
  if (decoded[0] === 0x4F && decoded[1] === 0x67 && decoded[2] === 0x67 && decoded[3] === 0x53) {
    return { valid: true, format: 'ogg' };
  }
  if (decoded[0] === 0x66 && decoded[1] === 0x4C && decoded[2] === 0x61 && decoded[3] === 0x43) {
    return { valid: true, format: 'flac' };
  }
  if (decoded[0] === 0x1A && decoded[1] === 0x45 && decoded[2] === 0xDF && decoded[3] === 0xA3) {
    return { valid: true, format: 'webm' };
  }

  return { valid: true }; // Unknown format but valid base64
}

// ============================================================================
// SSML Builder
// ============================================================================

/**
 * Build SSML (Speech Synthesis Markup Language) for TTS providers.
 */
export class SSMLBuilder {
  private parts: string[] = [];
  private persona: VoicePersona = 'neutral';

  constructor(persona?: VoicePersona) {
    if (persona) this.persona = persona;
  }

  /** Add plain text */
  text(content: string): this {
    this.parts.push(this.escapeXml(content));
    return this;
  }

  /** Add a pause */
  pause(ms: number): this {
    this.parts.push(`<break time="${ms}ms"/>`);
    return this;
  }

  /** Add emphasis */
  emphasis(content: string, level: 'reduced' | 'moderate' | 'strong' = 'moderate'): this {
    this.parts.push(`<emphasis level="${level}">${this.escapeXml(content)}</emphasis>`);
    return this;
  }

  /** Adjust prosody (rate, pitch, volume) */
  prosody(
    content: string,
    options: { rate?: string; pitch?: string; volume?: string }
  ): this {
    const attrs = Object.entries(options)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    this.parts.push(`<prosody ${attrs}>${this.escapeXml(content)}</prosody>`);
    return this;
  }

  /** Say as a specific type (date, time, telephone, etc.) */
  sayAs(content: string, interpretAs: string, format?: string): this {
    const formatAttr = format ? ` format="${format}"` : '';
    this.parts.push(
      `<say-as interpret-as="${interpretAs}"${formatAttr}>${this.escapeXml(content)}</say-as>`
    );
    return this;
  }

  /** Build the final SSML string */
  build(): string {
    const style = PERSONA_STYLES[this.persona];
    const content = this.parts.join('');

    if (style.prosodyRate || style.prosodyPitch) {
      const rate = style.prosodyRate || '0%';
      const pitch = style.prosodyPitch || '0st';
      return `<speak><prosody rate="${rate}" pitch="${pitch}">${content}</prosody></speak>`;
    }

    return `<speak>${content}</speak>`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// ============================================================================
// Voice Session
// ============================================================================

export interface VoiceSessionOptions {
  provider: IVoiceProvider;
  persona?: VoicePersona;
  defaultVoice?: string;
  defaultLanguage?: string;
}

/**
 * Manages a voice conversation session with consistent settings.
 */
export class VoiceSession {
  private provider: IVoiceProvider;
  private persona: VoicePersona;
  private defaultVoice?: string;
  private defaultLanguage: string;
  private history: Array<{ role: 'user' | 'assistant'; text: string; audio?: string }> = [];

  constructor(options: VoiceSessionOptions) {
    this.provider = options.provider;
    this.persona = options.persona ?? 'neutral';
    this.defaultVoice = options.defaultVoice;
    this.defaultLanguage = options.defaultLanguage ?? 'en';
  }

  /**
   * Transcribe user audio input.
   */
  async transcribe(audio: string, format?: AudioFormat): Promise<string> {
    const result = await this.provider.transcribe({
      audio,
      format,
      language: this.defaultLanguage,
    });

    this.history.push({ role: 'user', text: result.text, audio });
    return result.text;
  }

  /**
   * Synthesize assistant response.
   */
  async synthesize(text: string): Promise<string> {
    const result = await this.provider.synthesize({
      text,
      voice: this.defaultVoice,
      persona: this.persona,
    });

    this.history.push({ role: 'assistant', text, audio: result.audio });
    return result.audio;
  }

  /**
   * Get conversation history.
   */
  getHistory(): Array<{ role: 'user' | 'assistant'; text: string }> {
    return this.history.map(({ role, text }) => ({ role, text }));
  }

  /**
   * Clear conversation history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Change persona mid-session.
   */
  setPersona(persona: VoicePersona): void {
    this.persona = persona;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an SSML builder with persona styling.
 */
export function createSSMLBuilder(persona?: VoicePersona): SSMLBuilder {
  return new SSMLBuilder(persona);
}

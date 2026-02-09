/**
 * Voice Service – ASR (Parakeet) and TTS (Magpie) via NVIDIA Build / NVCF REST.
 * Uses configurable env URLs and API key. Audio in/out as Buffer or base64.
 */

import logger from '../../middleware/logger.js';

function getApiKey(): string | null {
  return process.env.NVIDIA_BUILD_API_KEY || process.env.NVIDIA_NIM_API_KEY || null;
}

function getAsrUrl(): string | null {
  const full = process.env.NVIDIA_ASR_URL;
  if (full) return full;
  const base = process.env.NVIDIA_BUILD_SPEECH_URL || 'https://api.nvcf.nvidia.com/v2/nvcf/exec/functions';
  const id = process.env.NVIDIA_ASR_FUNCTION_ID;
  if (!id) return null;
  return `${base}/${id}`;
}

function getTtsUrl(): string | null {
  const full = process.env.NVIDIA_TTS_URL;
  if (full) return full;
  const base = process.env.NVIDIA_BUILD_SPEECH_URL || 'https://api.nvcf.nvidia.com/v2/nvcf/exec/functions';
  const id = process.env.NVIDIA_TTS_FUNCTION_ID;
  if (!id) return null;
  return `${base}/${id}`;
}

/**
 * Transcribe audio to text via NVIDIA Build Parakeet ASR.
 * Expects 16-bit mono WAV/OGG/OPUS; pass raw bytes or base64.
 */
export async function transcribe(
  audio: Buffer,
  options?: { language?: string }
): Promise<{ text: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NVIDIA_BUILD_API_KEY or NVIDIA_NIM_API_KEY is not set');

  const url = getAsrUrl();
  if (!url) throw new Error('NVIDIA_ASR_FUNCTION_ID is not set (required for voice ASR)');

  const body = {
    audio: audio.toString('base64'),
    ...(options?.language && { language_code: options.language }),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Voice ASR error');
    throw new Error(`Voice ASR: ${res.status} ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as { text?: string; transcript?: string; output?: string };
  const text = data.text ?? data.transcript ?? data.output ?? '';
  return { text: String(text).trim() };
}

/**
 * G-Rump persona: lightly rewrite or append text for TTS (e.g. sarcastic tone).
 * Configurable via persona: 'grump' | 'neutral'.
 */
function applyGrumpPersona(text: string, persona: 'grump' | 'neutral'): string {
  if (persona !== 'grump' || !text.trim()) return text.trim();
  const trimmed = text.trim();
  if (trimmed.length > 100 && !trimmed.endsWith('…')) {
    return trimmed + ' … I guess.';
  }
  if (trimmed.length <= 100 && !/\.\.\.|\.$|!$|\?$/.test(trimmed)) {
    return trimmed + '. … Unfortunately.';
  }
  return trimmed;
}

/**
 * Synthesize text to speech via NVIDIA Build Magpie TTS.
 * Returns audio as Buffer (WAV or format returned by API).
 * Option persona: 'grump' | 'neutral' – when 'grump', appends G-Rump-appropriate phrasing.
 */
export async function synthesize(
  text: string,
  options?: { voice?: string; stream?: boolean; persona?: 'grump' | 'neutral' }
): Promise<{ audio: Buffer }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NVIDIA_BUILD_API_KEY or NVIDIA_NIM_API_KEY is not set');

  const url = getTtsUrl();
  if (!url) throw new Error('NVIDIA_TTS_FUNCTION_ID is not set (required for voice TTS)');

  const persona = options?.persona ?? 'neutral';
  const finalText = applyGrumpPersona(text, persona);

  const body = {
    text: finalText,
    ...(options?.voice && { voice: options.voice }),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Voice TTS error');
    throw new Error(`Voice TTS: ${res.status} ${t.slice(0, 200)}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = (await res.json()) as { audio?: string; data?: string };
    const b64 = data.audio ?? data.data ?? '';
    return { audio: Buffer.from(b64, 'base64') };
  }
  const arrayBuffer = await res.arrayBuffer();
  return { audio: Buffer.from(arrayBuffer) };
}

/**
 * Check if voice (ASR + TTS) is configured and available.
 */
export function isVoiceConfigured(): boolean {
  return !!(getApiKey() && getAsrUrl() && getTtsUrl());
}

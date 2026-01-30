/**
 * Voice Service Unit Tests
 * Tests transcribe, synthesize, isVoiceConfigured, and persona application.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock logger to avoid thread-stream issues
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('voiceService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Set up test environment
    process.env.NVIDIA_NIM_API_KEY = 'test_api_key';
    process.env.NVIDIA_ASR_FUNCTION_ID = 'asr_function_123';
    process.env.NVIDIA_TTS_FUNCTION_ID = 'tts_function_456';
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('isVoiceConfigured', () => {
    it('should return true when all required env vars are set', async () => {
      const { isVoiceConfigured } = await import('../../src/services/voiceService.js');
      expect(isVoiceConfigured()).toBe(true);
    });

    it('should return false when API key is missing', async () => {
      delete process.env.NVIDIA_NIM_API_KEY;
      delete process.env.NVIDIA_BUILD_API_KEY;
      
      const { isVoiceConfigured } = await import('../../src/services/voiceService.js');
      expect(isVoiceConfigured()).toBe(false);
    });

    it('should return false when ASR function ID is missing', async () => {
      delete process.env.NVIDIA_ASR_FUNCTION_ID;
      delete process.env.NVIDIA_ASR_URL;
      
      const { isVoiceConfigured } = await import('../../src/services/voiceService.js');
      expect(isVoiceConfigured()).toBe(false);
    });

    it('should return false when TTS function ID is missing', async () => {
      delete process.env.NVIDIA_TTS_FUNCTION_ID;
      delete process.env.NVIDIA_TTS_URL;
      
      const { isVoiceConfigured } = await import('../../src/services/voiceService.js');
      expect(isVoiceConfigured()).toBe(false);
    });
  });

  describe('transcribe', () => {
    it('should throw error when API key is not set', async () => {
      delete process.env.NVIDIA_NIM_API_KEY;
      delete process.env.NVIDIA_BUILD_API_KEY;
      
      const { transcribe } = await import('../../src/services/voiceService.js');
      
      await expect(transcribe(Buffer.from('test audio'))).rejects.toThrow(
        'NVIDIA_BUILD_API_KEY or NVIDIA_NIM_API_KEY is not set'
      );
    });

    it('should throw error when ASR URL is not configured', async () => {
      delete process.env.NVIDIA_ASR_FUNCTION_ID;
      delete process.env.NVIDIA_ASR_URL;
      
      const { transcribe } = await import('../../src/services/voiceService.js');
      
      await expect(transcribe(Buffer.from('test audio'))).rejects.toThrow(
        'NVIDIA_ASR_FUNCTION_ID is not set'
      );
    });

    it('should successfully transcribe audio', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Hello world' }),
      });

      const { transcribe } = await import('../../src/services/voiceService.js');
      const result = await transcribe(Buffer.from('test audio data'));

      expect(result).toEqual({ text: 'Hello world' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('asr_function_123'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_api_key',
          }),
        })
      );
    });

    it('should handle transcript field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transcript: 'Transcribed text' }),
      });

      const { transcribe } = await import('../../src/services/voiceService.js');
      const result = await transcribe(Buffer.from('audio'));

      expect(result).toEqual({ text: 'Transcribed text' });
    });

    it('should handle output field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ output: 'Output text' }),
      });

      const { transcribe } = await import('../../src/services/voiceService.js');
      const result = await transcribe(Buffer.from('audio'));

      expect(result).toEqual({ text: 'Output text' });
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const { transcribe } = await import('../../src/services/voiceService.js');
      
      await expect(transcribe(Buffer.from('audio'))).rejects.toThrow(
        'Voice ASR: 500'
      );
    });

    it('should pass language option to API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Bonjour' }),
      });

      const { transcribe } = await import('../../src/services/voiceService.js');
      await transcribe(Buffer.from('audio'), { language: 'fr' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.language_code).toBe('fr');
    });
  });

  describe('synthesize', () => {
    it('should throw error when API key is not set', async () => {
      delete process.env.NVIDIA_NIM_API_KEY;
      delete process.env.NVIDIA_BUILD_API_KEY;
      
      const { synthesize } = await import('../../src/services/voiceService.js');
      
      await expect(synthesize('Hello')).rejects.toThrow(
        'NVIDIA_BUILD_API_KEY or NVIDIA_NIM_API_KEY is not set'
      );
    });

    it('should throw error when TTS URL is not configured', async () => {
      delete process.env.NVIDIA_TTS_FUNCTION_ID;
      delete process.env.NVIDIA_TTS_URL;
      
      const { synthesize } = await import('../../src/services/voiceService.js');
      
      await expect(synthesize('Hello')).rejects.toThrow(
        'NVIDIA_TTS_FUNCTION_ID is not set'
      );
    });

    it('should successfully synthesize text with JSON response', async () => {
      const audioBase64 = Buffer.from('audio data').toString('base64');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ audio: audioBase64 }),
      });

      const { synthesize } = await import('../../src/services/voiceService.js');
      const result = await synthesize('Hello world');

      expect(result.audio).toBeInstanceOf(Buffer);
    });

    it('should handle binary audio response', async () => {
      const audioBuffer = new ArrayBuffer(100);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'audio/wav' },
        arrayBuffer: async () => audioBuffer,
      });

      const { synthesize } = await import('../../src/services/voiceService.js');
      const result = await synthesize('Hello');

      expect(result.audio).toBeInstanceOf(Buffer);
      expect(result.audio.length).toBe(100);
    });

    it('should apply grump persona for long text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ audio: 'dGVzdA==' }),
      });

      const { synthesize } = await import('../../src/services/voiceService.js');
      const longText = 'A'.repeat(101);
      await synthesize(longText, { persona: 'grump' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.text).toContain('I guess');
    });

    it('should apply grump persona for short text without punctuation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ audio: 'dGVzdA==' }),
      });

      const { synthesize } = await import('../../src/services/voiceService.js');
      await synthesize('Short text', { persona: 'grump' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.text).toContain('Unfortunately');
    });

    it('should not apply grump persona when neutral', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ audio: 'dGVzdA==' }),
      });

      const { synthesize } = await import('../../src/services/voiceService.js');
      await synthesize('Short text', { persona: 'neutral' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.text).toBe('Short text');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      const { synthesize } = await import('../../src/services/voiceService.js');
      
      await expect(synthesize('Hello')).rejects.toThrow('Voice TTS: 400');
    });

    it('should pass voice option to API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ audio: 'dGVzdA==' }),
      });

      const { synthesize } = await import('../../src/services/voiceService.js');
      await synthesize('Hello', { voice: 'custom_voice' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.voice).toBe('custom_voice');
    });
  });
});

/**
 * Limits Configuration Tests
 * Tests for backend/src/config/limits.ts
 */

import { describe, it, expect } from 'vitest';
import {
  MAX_USER_REQUEST_LENGTH,
  MAX_AUDIO_SIZE,
  TTS_MAX_CHARS,
  PLATFORM_MESSAGE_LIMITS,
} from '../../src/config/limits.js';

describe('Limits Configuration', () => {
  describe('MAX_USER_REQUEST_LENGTH', () => {
    it('should be defined', () => {
      expect(MAX_USER_REQUEST_LENGTH).toBeDefined();
    });

    it('should be 16000 characters', () => {
      expect(MAX_USER_REQUEST_LENGTH).toBe(16_000);
    });

    it('should be a positive number', () => {
      expect(MAX_USER_REQUEST_LENGTH).toBeGreaterThan(0);
    });

    it('should be reasonable for user requests', () => {
      // Should be at least a few thousand characters for complex requests
      expect(MAX_USER_REQUEST_LENGTH).toBeGreaterThanOrEqual(1000);
      // Should not be unreasonably large (< 100KB)
      expect(MAX_USER_REQUEST_LENGTH).toBeLessThan(100_000);
    });
  });

  describe('MAX_AUDIO_SIZE', () => {
    it('should be defined', () => {
      expect(MAX_AUDIO_SIZE).toBeDefined();
    });

    it('should be 10 MB in bytes', () => {
      expect(MAX_AUDIO_SIZE).toBe(10 * 1024 * 1024);
    });

    it('should be exactly 10485760 bytes', () => {
      expect(MAX_AUDIO_SIZE).toBe(10485760);
    });

    it('should be a positive number', () => {
      expect(MAX_AUDIO_SIZE).toBeGreaterThan(0);
    });

    it('should be reasonable for audio uploads', () => {
      // Should be at least 1 MB
      expect(MAX_AUDIO_SIZE).toBeGreaterThanOrEqual(1024 * 1024);
      // Should not exceed 100 MB
      expect(MAX_AUDIO_SIZE).toBeLessThanOrEqual(100 * 1024 * 1024);
    });
  });

  describe('TTS_MAX_CHARS', () => {
    it('should be defined', () => {
      expect(TTS_MAX_CHARS).toBeDefined();
    });

    it('should be 2000 characters', () => {
      expect(TTS_MAX_CHARS).toBe(2_000);
    });

    it('should be a positive number', () => {
      expect(TTS_MAX_CHARS).toBeGreaterThan(0);
    });

    it('should be reasonable for TTS synthesis', () => {
      // Should be at least a few hundred characters
      expect(TTS_MAX_CHARS).toBeGreaterThanOrEqual(100);
      // Should not be too large for real-time synthesis
      expect(TTS_MAX_CHARS).toBeLessThanOrEqual(10_000);
    });
  });

  describe('PLATFORM_MESSAGE_LIMITS', () => {
    it('should be defined', () => {
      expect(PLATFORM_MESSAGE_LIMITS).toBeDefined();
    });

    it('should be an object', () => {
      expect(typeof PLATFORM_MESSAGE_LIMITS).toBe('object');
    });

    describe('telegram', () => {
      it('should have telegram limit defined', () => {
        expect(PLATFORM_MESSAGE_LIMITS.telegram).toBeDefined();
      });

      it('should have 4096 character limit', () => {
        expect(PLATFORM_MESSAGE_LIMITS.telegram).toBe(4096);
      });

      it('should be a positive number', () => {
        expect(PLATFORM_MESSAGE_LIMITS.telegram).toBeGreaterThan(0);
      });
    });

    describe('discord', () => {
      it('should have discord limit defined', () => {
        expect(PLATFORM_MESSAGE_LIMITS.discord).toBeDefined();
      });

      it('should have 2000 character limit', () => {
        expect(PLATFORM_MESSAGE_LIMITS.discord).toBe(2000);
      });

      it('should be a positive number', () => {
        expect(PLATFORM_MESSAGE_LIMITS.discord).toBeGreaterThan(0);
      });
    });

    describe('twilio', () => {
      it('should have twilio limit defined', () => {
        expect(PLATFORM_MESSAGE_LIMITS.twilio).toBeDefined();
      });

      it('should have 1600 character limit', () => {
        expect(PLATFORM_MESSAGE_LIMITS.twilio).toBe(1600);
      });

      it('should be a positive number', () => {
        expect(PLATFORM_MESSAGE_LIMITS.twilio).toBeGreaterThan(0);
      });
    });

    describe('platform limit comparisons', () => {
      it('should have telegram as largest limit', () => {
        expect(PLATFORM_MESSAGE_LIMITS.telegram).toBeGreaterThan(PLATFORM_MESSAGE_LIMITS.discord);
        expect(PLATFORM_MESSAGE_LIMITS.telegram).toBeGreaterThan(PLATFORM_MESSAGE_LIMITS.twilio);
      });

      it('should have discord as middle limit', () => {
        expect(PLATFORM_MESSAGE_LIMITS.discord).toBeLessThan(PLATFORM_MESSAGE_LIMITS.telegram);
        expect(PLATFORM_MESSAGE_LIMITS.discord).toBeGreaterThan(PLATFORM_MESSAGE_LIMITS.twilio);
      });

      it('should have twilio as smallest limit', () => {
        expect(PLATFORM_MESSAGE_LIMITS.twilio).toBeLessThan(PLATFORM_MESSAGE_LIMITS.telegram);
        expect(PLATFORM_MESSAGE_LIMITS.twilio).toBeLessThan(PLATFORM_MESSAGE_LIMITS.discord);
      });
    });

    describe('platform limit values', () => {
      it('should only contain expected platforms', () => {
        const keys = Object.keys(PLATFORM_MESSAGE_LIMITS);
        
        expect(keys).toContain('telegram');
        expect(keys).toContain('discord');
        expect(keys).toContain('twilio');
        expect(keys.length).toBe(3);
      });

      it('should have all numeric values', () => {
        for (const key of Object.keys(PLATFORM_MESSAGE_LIMITS) as Array<keyof typeof PLATFORM_MESSAGE_LIMITS>) {
          expect(typeof PLATFORM_MESSAGE_LIMITS[key]).toBe('number');
        }
      });

      it('should have all positive values', () => {
        for (const key of Object.keys(PLATFORM_MESSAGE_LIMITS) as Array<keyof typeof PLATFORM_MESSAGE_LIMITS>) {
          expect(PLATFORM_MESSAGE_LIMITS[key]).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Limit relationships', () => {
    it('should have user request length greater than TTS max chars', () => {
      expect(MAX_USER_REQUEST_LENGTH).toBeGreaterThan(TTS_MAX_CHARS);
    });

    it('should have user request length greater than all platform limits', () => {
      expect(MAX_USER_REQUEST_LENGTH).toBeGreaterThan(PLATFORM_MESSAGE_LIMITS.telegram);
      expect(MAX_USER_REQUEST_LENGTH).toBeGreaterThan(PLATFORM_MESSAGE_LIMITS.discord);
      expect(MAX_USER_REQUEST_LENGTH).toBeGreaterThan(PLATFORM_MESSAGE_LIMITS.twilio);
    });

    it('should have TTS max chars less than telegram limit', () => {
      expect(TTS_MAX_CHARS).toBeLessThan(PLATFORM_MESSAGE_LIMITS.telegram);
    });
  });

  describe('Type safety', () => {
    it('should have PLATFORM_MESSAGE_LIMITS as const object', () => {
      // The object should be readonly
      const limits = PLATFORM_MESSAGE_LIMITS;
      
      expect(limits.telegram).toBe(4096);
      expect(limits.discord).toBe(2000);
      expect(limits.twilio).toBe(1600);
    });
  });

  describe('Usage validation scenarios', () => {
    it('should allow a typical user request', () => {
      const typicalRequest = 'Create a React component with TypeScript that displays a list of users';
      
      expect(typicalRequest.length).toBeLessThan(MAX_USER_REQUEST_LENGTH);
    });

    it('should allow a moderate audio file', () => {
      const moderateAudioSizeKB = 500;
      const moderateAudioSizeBytes = moderateAudioSizeKB * 1024;
      
      expect(moderateAudioSizeBytes).toBeLessThan(MAX_AUDIO_SIZE);
    });

    it('should allow a typical TTS message', () => {
      const typicalTTSMessage = 'Hello! I am your AI assistant. How can I help you today?';
      
      expect(typicalTTSMessage.length).toBeLessThan(TTS_MAX_CHARS);
    });

    it('should allow a typical Discord message', () => {
      const typicalDiscordMessage = 'Here is the response to your question. The solution involves...';
      
      expect(typicalDiscordMessage.length).toBeLessThan(PLATFORM_MESSAGE_LIMITS.discord);
    });

    it('should allow a typical Telegram message', () => {
      const typicalTelegramMessage = 'Processing your request. Here are the results...'.repeat(10);
      
      expect(typicalTelegramMessage.length).toBeLessThan(PLATFORM_MESSAGE_LIMITS.telegram);
    });

    it('should allow a typical Twilio SMS', () => {
      const typicalSMS = 'Your code is ready! Check the dashboard for details.';
      
      expect(typicalSMS.length).toBeLessThan(PLATFORM_MESSAGE_LIMITS.twilio);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string within limits', () => {
      const empty = '';
      
      expect(empty.length).toBeLessThan(MAX_USER_REQUEST_LENGTH);
      expect(empty.length).toBeLessThan(TTS_MAX_CHARS);
      expect(empty.length).toBeLessThan(PLATFORM_MESSAGE_LIMITS.telegram);
    });

    it('should handle string at exact limit boundary', () => {
      const atLimit = 'x'.repeat(MAX_USER_REQUEST_LENGTH);
      
      expect(atLimit.length).toBe(MAX_USER_REQUEST_LENGTH);
    });

    it('should detect string over limit', () => {
      const overLimit = 'x'.repeat(MAX_USER_REQUEST_LENGTH + 1);
      
      expect(overLimit.length).toBeGreaterThan(MAX_USER_REQUEST_LENGTH);
    });
  });

  describe('Limit calculations', () => {
    it('should calculate correct MB from audio size', () => {
      const audioSizeMB = MAX_AUDIO_SIZE / (1024 * 1024);
      
      expect(audioSizeMB).toBe(10);
    });

    it('should calculate correct KB from audio size', () => {
      const audioSizeKB = MAX_AUDIO_SIZE / 1024;
      
      expect(audioSizeKB).toBe(10240);
    });
  });
});

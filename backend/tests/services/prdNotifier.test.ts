/**
 * Messaging Ship Notifier (PRD Notifier) Unit Tests
 *
 * Tests for the messaging notification service that notifies users
 * when SHIP mode completes or fails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  subscribe,
  notify,
  sendTelegram,
  sendDiscord,
  sendTwilio,
  setDiscordSendFn,
} from '../../src/services/messagingShipNotifier.js';

describe('Messaging Ship Notifier', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_NUMBER;
    delete process.env.TWILIO_REPLY_TO_NUMBER;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subscribe', () => {
    it('should add subscription for telegram', () => {
      subscribe('session-1', 'telegram', '12345678');
      // Subscription is internal, we verify by calling notify
    });

    it('should add subscription for discord', () => {
      subscribe('session-2', 'discord', 'channel-id');
    });

    it('should add subscription for twilio', () => {
      subscribe('session-3', 'twilio', '+1234567890');
    });
  });

  describe('notify', () => {
    it('should notify telegram subscriber', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      subscribe('session-1', 'telegram', '12345678');
      await notify('session-1', 'SHIP completed successfully!');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.telegram.org'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should notify discord subscriber', async () => {
      const mockDiscordSend = vi.fn().mockResolvedValue(undefined);
      setDiscordSendFn(mockDiscordSend);

      subscribe('session-2', 'discord', 'channel-123');
      await notify('session-2', 'SHIP completed successfully!');

      expect(mockDiscordSend).toHaveBeenCalledWith('channel-123', 'SHIP completed successfully!');
    });

    it('should notify twilio subscriber', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
      process.env.TWILIO_REPLY_TO_NUMBER = '+1234567890';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'msg-123' }),
      });

      subscribe('session-3', 'twilio', '+0987654321');
      await notify('session-3', 'SHIP completed successfully!');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.twilio.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );
    });

    it('should do nothing for non-existent subscription', async () => {
      await notify('non-existent-session', 'Message');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should remove subscription after notifying', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

      subscribe('session-1', 'telegram', '12345678');
      await notify('session-1', 'First message');
      await notify('session-1', 'Second message');

      // Second notify should not trigger fetch as subscription was removed
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle send errors gracefully', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      subscribe('session-1', 'telegram', '12345678');
      // Should not throw
      await expect(notify('session-1', 'Message')).resolves.toBeUndefined();
    });
  });

  describe('sendTelegram', () => {
    it('should send message to Telegram API', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendTelegram('123456789', 'Hello from test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: '123456789',
            text: 'Hello from test',
          }),
        })
      );
    });

    it('should truncate message to 4096 characters', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const longMessage = 'x'.repeat(5000);
      await sendTelegram('123456789', longMessage);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.text.length).toBe(4096);
    });

    it('should not send when token not set', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;

      await sendTelegram('123456789', 'Hello');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(sendTelegram('123456789', 'Hello')).rejects.toThrow(
        'Telegram send failed: 401 Unauthorized'
      );
    });
  });

  describe('sendDiscord', () => {
    it('should send message via discord send function', async () => {
      const mockSend = vi.fn().mockResolvedValue(undefined);
      setDiscordSendFn(mockSend);

      await sendDiscord('channel-123', 'Hello Discord');

      expect(mockSend).toHaveBeenCalledWith('channel-123', 'Hello Discord');
    });

    it('should truncate message to 2000 characters', async () => {
      const mockSend = vi.fn().mockResolvedValue(undefined);
      setDiscordSendFn(mockSend);

      const longMessage = 'x'.repeat(3000);
      await sendDiscord('channel-123', longMessage);

      expect(mockSend).toHaveBeenCalledWith('channel-123', 'x'.repeat(2000));
    });

    it('should not send when discord function not configured', async () => {
      // Reset discord send function by calling with null-like value
      // Since we can't directly reset, we'll just verify the function handles it
      setDiscordSendFn(null as any);

      // Should not throw
      await expect(sendDiscord('channel-123', 'Hello')).resolves.toBeUndefined();
    });
  });

  describe('sendTwilio', () => {
    it('should send message to Twilio API', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC123456';
      process.env.TWILIO_AUTH_TOKEN = 'auth-token-123';
      process.env.TWILIO_REPLY_TO_NUMBER = '+1234567890';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123' }),
      });

      await sendTwilio('+0987654321', 'Hello from Twilio');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC123456/Messages.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );
    });

    it('should use WhatsApp format for WhatsApp numbers', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC123456';
      process.env.TWILIO_AUTH_TOKEN = 'auth-token-123';
      process.env.TWILIO_WHATSAPP_NUMBER = '+1234567890';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123' }),
      });

      await sendTwilio('whatsapp:+0987654321', 'Hello via WhatsApp');

      const call = mockFetch.mock.calls[0];
      const body = new URLSearchParams(call[1].body as string);
      expect(body.get('From')).toContain('whatsapp:');
    });

    it('should truncate message to 1600 characters', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC123456';
      process.env.TWILIO_AUTH_TOKEN = 'auth-token-123';
      process.env.TWILIO_REPLY_TO_NUMBER = '+1234567890';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'SM123' }),
      });

      const longMessage = 'x'.repeat(2000);
      await sendTwilio('+0987654321', longMessage);

      const call = mockFetch.mock.calls[0];
      const body = new URLSearchParams(call[1].body as string);
      expect(body.get('Body')?.length).toBe(1600);
    });

    it('should not send when credentials not set', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      await sendTwilio('+0987654321', 'Hello');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC123456';
      process.env.TWILIO_AUTH_TOKEN = 'auth-token-123';
      process.env.TWILIO_REPLY_TO_NUMBER = '+1234567890';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid phone number',
      });

      await expect(sendTwilio('+0987654321', 'Hello')).rejects.toThrow(
        'Twilio send failed: 400 Invalid phone number'
      );
    });
  });

  describe('setDiscordSendFn', () => {
    it('should set the discord send function', () => {
      const mockSend = vi.fn().mockResolvedValue(undefined);
      setDiscordSendFn(mockSend);

      // Verify by sending a message
      sendDiscord('channel', 'test');
      expect(mockSend).toHaveBeenCalled();
    });
  });
});

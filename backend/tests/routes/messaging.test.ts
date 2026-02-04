/**
 * Messaging Routes Tests
 * Tests for Twilio and Telegram webhook endpoints.
 * Uses the actual messaging router with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Store original env
const originalEnv = { ...process.env };

// Mock dependencies - must be before importing the router
vi.mock('../../src/services/messagingService.js', () => ({
  processMessage: vi.fn(),
}));

vi.mock('../../src/services/messagingShipNotifier.js', () => ({
  sendTelegram: vi.fn(),
  sendTwilio: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/utils/security.js', () => ({
  timingSafeEqualString: vi.fn((a: string, b: string) => a === b),
}));

// Helper to create test app with fresh router import
async function createTestApp() {
  // Reset modules to pick up new env vars
  vi.resetModules();
  
  // Re-mock after reset
  vi.mock('../../src/services/messagingService.js', () => ({
    processMessage: vi.fn(),
  }));
  vi.mock('../../src/services/messagingShipNotifier.js', () => ({
    sendTelegram: vi.fn(),
    sendTwilio: vi.fn(),
  }));
  vi.mock('../../src/middleware/logger.js', () => ({
    default: {
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }));
  vi.mock('../../src/utils/security.js', () => ({
    timingSafeEqualString: vi.fn((a: string, b: string) => a === b),
  }));
  
  const { default: messagingRouter } = await import('../../src/routes/messaging.js');
  const { processMessage: pm } = await import('../../src/services/messagingService.js');
  const { sendTelegram: st, sendTwilio: stw } = await import('../../src/services/messagingShipNotifier.js');
  const { timingSafeEqualString: tse } = await import('../../src/utils/security.js');
  const { default: log } = await import('../../src/middleware/logger.js');
  
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/messaging', messagingRouter);
  
  return { 
    app, 
    mocks: { 
      processMessage: pm as ReturnType<typeof vi.fn>, 
      sendTelegram: st as ReturnType<typeof vi.fn>, 
      sendTwilio: stw as ReturnType<typeof vi.fn>,
      timingSafeEqualString: tse as ReturnType<typeof vi.fn>,
      logger: log as unknown as { warn: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> },
    }
  };
}

describe('Messaging Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env to clean state
    process.env = { ...originalEnv };
    // Reset NODE_ENV to test (not production) by default
    delete process.env.NODE_ENV;
    delete process.env.MESSAGING_PROVIDER;
    delete process.env.TWILIO_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.PHONE_TO_USER_ID;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  describe('POST /api/messaging/inbound (Twilio)', () => {
    describe('Webhook verification', () => {
      it('should return 503 when secret not configured in production with twilio provider', async () => {
        process.env.NODE_ENV = 'production';
        process.env.MESSAGING_PROVIDER = 'twilio';
        delete process.env.TWILIO_WEBHOOK_SECRET;

        const { app } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(503);
        expect(response.body.error).toBe('Messaging webhook secret not configured');
        expect(response.body.type).toBe('config_error');
      });

      it('should return 403 when webhook secret is invalid', async () => {
        process.env.TWILIO_WEBHOOK_SECRET = 'valid-secret';

        const { app, mocks } = await createTestApp();
        mocks.timingSafeEqualString.mockReturnValue(false);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .set('x-webhook-secret', 'wrong-secret')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid webhook secret');
      });

      it('should accept request with valid x-webhook-secret header', async () => {
        process.env.TWILIO_WEBHOOK_SECRET = 'valid-secret';

        const { app, mocks } = await createTestApp();
        mocks.timingSafeEqualString.mockReturnValue(true);
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .set('x-webhook-secret', 'valid-secret')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(mocks.timingSafeEqualString).toHaveBeenCalledWith('valid-secret', 'valid-secret');
      });

      it('should accept request with valid x-twilio-secret header', async () => {
        process.env.TWILIO_WEBHOOK_SECRET = 'valid-secret';

        const { app, mocks } = await createTestApp();
        mocks.timingSafeEqualString.mockReturnValue(true);
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .set('x-twilio-secret', 'valid-secret')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(200);
      });

      it('should skip auth in development when no secret configured', async () => {
        delete process.env.TWILIO_WEBHOOK_SECRET;

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(mocks.timingSafeEqualString).not.toHaveBeenCalled();
      });
    });

    describe('Provider handling', () => {
      it('should return 200 empty when provider is not twilio', async () => {
        process.env.MESSAGING_PROVIDER = 'other';

        const { app, mocks } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(response.text).toBe('');
        expect(mocks.processMessage).not.toHaveBeenCalled();
      });

      it('should default to twilio when MESSAGING_PROVIDER is not set', async () => {
        delete process.env.MESSAGING_PROVIDER;

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTwilio.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalled();
      });
    });

    describe('Message processing', () => {
      it('should return 200 empty when From is missing', async () => {
        const { app, mocks } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ Body: 'Hello without from' });

        expect(response.status).toBe(200);
        expect(response.text).toBe('');
        expect(mocks.processMessage).not.toHaveBeenCalled();
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ body: expect.any(String) }),
          'Messaging inbound: missing From'
        );
      });

      it('should process message with From and Body', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply message');
        mocks.sendTwilio.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', 'Hello');
        expect(mocks.sendTwilio).toHaveBeenCalledWith('+1234567890', 'Reply message');
      });

      it('should handle SpeechResult field for voice', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', SpeechResult: 'Voice message' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', 'Voice message');
      });

      it('should handle TranscriptionText field', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', TranscriptionText: 'Transcribed text' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', 'Transcribed text');
      });

      it('should handle lowercase from and body fields', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ from: '+1234567890', body: 'Hello lowercase' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', 'Hello lowercase');
      });

      it('should send (empty) when text is blank', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: '' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', '(empty)');
      });

      it('should trim whitespace from text', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: '   ' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', '(empty)');
      });

      it('should not send reply when processMessage returns falsy value', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(mocks.sendTwilio).not.toHaveBeenCalled();
      });

      it('should not send reply when processMessage returns empty string', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('');

        await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        // Empty string is falsy so sendTwilio should not be called
        expect(mocks.sendTwilio).not.toHaveBeenCalled();
      });

      it('should handle Twilio send errors gracefully', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTwilio.mockRejectedValue(new Error('Send failed'));

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        // Should not crash, just log warning
        expect(response.status).toBe(200);
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error) }),
          'Twilio send error'
        );
      });

      it('should handle url-encoded form data from Twilio', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTwilio.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .type('form')
          .send({ From: '+1234567890', Body: 'Form message', MessageSid: 'SM123' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', 'Form message');
      });

      it('should handle WhatsApp From format', async () => {
        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTwilio.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: 'whatsapp:+1234567890', Body: 'WhatsApp message' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', 'whatsapp:+1234567890', 'WhatsApp message');
        expect(mocks.sendTwilio).toHaveBeenCalledWith('whatsapp:+1234567890', 'Reply');
      });
    });

    describe('Phone mapping', () => {
      it('should ignore unmapped phone when PHONE_TO_USER_ID is set', async () => {
        process.env.PHONE_TO_USER_ID = JSON.stringify({ '+1111111111': 'user1' });

        const { app, mocks } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+9999999999', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(response.text).toBe('');
        expect(mocks.processMessage).not.toHaveBeenCalled();
        expect(mocks.logger.debug).toHaveBeenCalledWith(
          expect.objectContaining({ from: '+9999999999' }),
          'Messaging: phone not mapped, ignoring'
        );
      });

      it('should process message from mapped phone', async () => {
        process.env.PHONE_TO_USER_ID = JSON.stringify({ '+1234567890': 'user1' });

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', 'Hello');
      });

      it('should normalize phone number when mapping (strip non-digits)', async () => {
        process.env.PHONE_TO_USER_ID = JSON.stringify({ '1234567890': 'user1' });

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1-234-567-890', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1-234-567-890', 'Hello');
      });

      it('should handle invalid PHONE_TO_USER_ID JSON gracefully', async () => {
        process.env.PHONE_TO_USER_ID = 'invalid-json{';

        const { app, mocks } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        // Invalid JSON causes fallback to 'default', which is filtered when PHONE_TO_USER_ID is set
        expect(response.status).toBe(200);
        expect(mocks.processMessage).not.toHaveBeenCalled();
      });

      it('should process message when PHONE_TO_USER_ID is not set', async () => {
        delete process.env.PHONE_TO_USER_ID;

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/inbound')
          .send({ From: '+1234567890', Body: 'Hello' });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalled();
      });
    });
  });

  describe('POST /api/messaging/telegram', () => {
    describe('Webhook verification', () => {
      it('should return 403 when webhook secret is invalid via query', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'valid-secret';

        const { app, mocks } = await createTestApp();
        mocks.timingSafeEqualString.mockReturnValue(false);

        const response = await request(app)
          .post('/api/messaging/telegram?secret=wrong-secret')
          .send({ message: { chat: { id: 123 }, text: 'Hello' } });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid webhook secret');
      });

      it('should accept request with valid secret query param', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'valid-secret';

        const { app, mocks } = await createTestApp();
        mocks.timingSafeEqualString.mockReturnValue(true);
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram?secret=valid-secret')
          .send({ message: { chat: { id: 123 }, text: 'Hello' } });

        expect(response.status).toBe(200);
        expect(mocks.timingSafeEqualString).toHaveBeenCalledWith('valid-secret', 'valid-secret');
      });

      it('should accept request with valid token query param', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'valid-secret';

        const { app, mocks } = await createTestApp();
        mocks.timingSafeEqualString.mockReturnValue(true);
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram?token=valid-secret')
          .send({ message: { chat: { id: 123 }, text: 'Hello' } });

        expect(response.status).toBe(200);
      });

      it('should accept request with valid x-telegram-bot-api-secret-token header', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'valid-secret';

        const { app, mocks } = await createTestApp();
        mocks.timingSafeEqualString.mockReturnValue(true);
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram')
          .set('x-telegram-bot-api-secret-token', 'valid-secret')
          .send({ message: { chat: { id: 123 }, text: 'Hello' } });

        expect(response.status).toBe(200);
      });

      it('should skip auth when no secret configured', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
        delete process.env.TELEGRAM_WEBHOOK_SECRET;

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({ message: { chat: { id: 123 }, text: 'Hello' } });

        expect(response.status).toBe(200);
        expect(mocks.timingSafeEqualString).not.toHaveBeenCalled();
      });

      it('should return 403 when no query param and no header match secret', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'valid-secret';

        const { app } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({ message: { chat: { id: 123 }, text: 'Hello' } });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Invalid webhook secret');
      });
    });

    describe('Configuration', () => {
      it('should return 503 when TELEGRAM_BOT_TOKEN is not set', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;

        const { app, mocks } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({ message: { chat: { id: 123 }, text: 'Hello' } });

        expect(response.status).toBe(503);
        expect(response.body.error).toBe('Telegram not configured');
        expect(response.body.type).toBe('config_error');
        expect(mocks.logger.warn).toHaveBeenCalledWith('TELEGRAM_BOT_TOKEN not set');
      });
    });

    describe('Message processing', () => {
      it('should return 200 ok when chat id is missing', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({ message: { text: 'Hello without chat' } });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(mocks.processMessage).not.toHaveBeenCalled();
      });

      it('should return 200 ok when message is missing', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(mocks.processMessage).not.toHaveBeenCalled();
      });

      it('should return 200 ok when chat is missing in message', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({ message: {} });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(mocks.processMessage).not.toHaveBeenCalled();
      });

      it('should process valid Telegram message', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('AI response');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({
            message: {
              chat: { id: 123456 },
              text: 'Hello from Telegram',
            },
          });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(mocks.processMessage).toHaveBeenCalledWith('telegram', '123456', 'Hello from Telegram');
        expect(mocks.sendTelegram).toHaveBeenCalledWith('123456', 'AI response');
      });

      it('should handle empty text message', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({
            message: {
              chat: { id: 123456 },
              text: '',
            },
          });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('telegram', '123456', '(empty)');
      });

      it('should handle undefined text in message', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({
            message: {
              chat: { id: 123456 },
            },
          });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('telegram', '123456', '(empty)');
      });

      it('should handle whitespace-only text in message', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({
            message: {
              chat: { id: 123456 },
              text: '   ',
            },
          });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('telegram', '123456', '(empty)');
      });

      it('should handle Telegram send errors gracefully', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockRejectedValue(new Error('Send failed'));

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({
            message: {
              chat: { id: 123456 },
              text: 'Hello',
            },
          });

        // Should not crash, just log warning
        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error) }),
          'Telegram send error'
        );
      });

      it('should always call sendTelegram even when processMessage returns empty string', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({
            message: {
              chat: { id: 123456 },
              text: 'Hello',
            },
          });

        expect(response.status).toBe(200);
        // Telegram endpoint always sends reply (unlike Twilio which checks for truthy reply)
        expect(mocks.sendTelegram).toHaveBeenCalledWith('123456', '');
      });

      it('should convert numeric chat id to string', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

        const { app, mocks } = await createTestApp();
        mocks.processMessage.mockResolvedValue('Reply');
        mocks.sendTelegram.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/messaging/telegram')
          .send({
            message: {
              chat: { id: 987654321 },
              text: 'Test',
            },
          });

        expect(response.status).toBe(200);
        expect(mocks.processMessage).toHaveBeenCalledWith('telegram', '987654321', 'Test');
        expect(mocks.sendTelegram).toHaveBeenCalledWith('987654321', 'Reply');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty object body in Twilio request', async () => {
      const { app, mocks } = await createTestApp();

      const response = await request(app)
        .post('/api/messaging/inbound')
        .send({});

      expect(response.status).toBe(200);
      expect(response.text).toBe('');
      expect(mocks.processMessage).not.toHaveBeenCalled();
    });

    it('should handle request with no body in Twilio request', async () => {
      const { app } = await createTestApp();

      const response = await request(app)
        .post('/api/messaging/inbound')
        .set('Content-Type', 'application/json')
        .send();

      expect(response.status).toBe(200);
      expect(response.text).toBe('');
    });

    it('should handle chat id of 0 in Telegram (falsy but valid)', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';

      const { app, mocks } = await createTestApp();
      mocks.processMessage.mockResolvedValue('Reply');
      mocks.sendTelegram.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/messaging/telegram')
        .send({
          message: {
            chat: { id: 0 },
            text: 'Test',
          },
        });

      expect(response.status).toBe(200);
      // id: 0 is truthy comparison with == null fails, so it should process
      expect(mocks.processMessage).toHaveBeenCalledWith('telegram', '0', 'Test');
    });

    it('should handle non-string header values for Twilio secret', async () => {
      process.env.TWILIO_WEBHOOK_SECRET = 'secret';

      const { app, mocks } = await createTestApp();
      mocks.timingSafeEqualString.mockReturnValue(false);

      // Header not provided - should use empty string
      const response = await request(app)
        .post('/api/messaging/inbound')
        .send({ From: '+1234567890', Body: 'Test' });

      expect(response.status).toBe(403);
      expect(mocks.timingSafeEqualString).toHaveBeenCalledWith('', 'secret');
    });

    it('should handle body with non-string From field', async () => {
      const { app, mocks } = await createTestApp();
      mocks.processMessage.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/messaging/inbound')
        .send({ From: 12345, Body: 'Hello' });

      expect(response.status).toBe(200);
      // From should be converted to string
      expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '12345', 'Hello');
    });

    it('should handle body with non-string Body field', async () => {
      const { app, mocks } = await createTestApp();
      mocks.processMessage.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/messaging/inbound')
        .send({ From: '+1234567890', Body: 12345 });

      expect(response.status).toBe(200);
      // Body should be converted to string
      expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', '12345');
    });

    it('should prefer From over from in request body', async () => {
      const { app, mocks } = await createTestApp();
      mocks.processMessage.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/messaging/inbound')
        .send({ From: '+1111111111', from: '+2222222222', Body: 'Hello' });

      expect(response.status).toBe(200);
      expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1111111111', 'Hello');
    });

    it('should prefer Body over body and SpeechResult in request body', async () => {
      const { app, mocks } = await createTestApp();
      mocks.processMessage.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/messaging/inbound')
        .send({ From: '+1234567890', Body: 'Text', body: 'lowercase', SpeechResult: 'speech' });

      expect(response.status).toBe(200);
      expect(mocks.processMessage).toHaveBeenCalledWith('twilio', '+1234567890', 'Text');
    });
  });
});

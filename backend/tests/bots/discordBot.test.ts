/**
 * Discord Bot Unit Tests
 * Tests bot initialization, message handling, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock discord.js
const mockChannelFetch = vi.fn();
const mockChannelSend = vi.fn();
const mockClientLogin = vi.fn();
const mockClientOn = vi.fn();
const mockClientOnce = vi.fn();

const mockChannel = {
  isSendable: () => true,
  send: mockChannelSend,
};

const mockClient = {
  channels: {
    fetch: mockChannelFetch,
  },
  on: mockClientOn,
  once: mockClientOnce,
  login: mockClientLogin,
  user: { tag: 'TestBot#1234' },
};

vi.mock('discord.js', () => ({
  Client: vi.fn(() => mockClient),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    DirectMessages: 4,
    MessageContent: 8,
  },
}));

// Mock dependencies
const mockProcessMessage = vi.fn();
const mockSetDiscordSendFn = vi.fn();

vi.mock('../../src/services/messagingService.js', () => ({
  processMessage: (...args: unknown[]) => mockProcessMessage(...args),
}));

vi.mock('../../src/services/messagingShipNotifier.js', () => ({
  setDiscordSendFn: (fn: unknown) => mockSetDiscordSendFn(fn),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('discordBot', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockChannelFetch.mockReset();
    mockChannelSend.mockReset();
    mockClientLogin.mockReset();
    mockClientOn.mockReset();
    mockClientOnce.mockReset();
    mockProcessMessage.mockReset();
    mockSetDiscordSendFn.mockReset();
    // Clear Discord-related env vars
    delete process.env.DISCORD_BOT_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('startDiscordBot', () => {
    it('should not start when DISCORD_BOT_TOKEN is not set', async () => {
      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockClientLogin).not.toHaveBeenCalled();
      expect(mockSetDiscordSendFn).not.toHaveBeenCalled();
    });

    it('should not start when DISCORD_BOT_TOKEN is empty string', async () => {
      process.env.DISCORD_BOT_TOKEN = '';

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockClientLogin).not.toHaveBeenCalled();
    });

    it('should not start when DISCORD_BOT_TOKEN is whitespace only', async () => {
      process.env.DISCORD_BOT_TOKEN = '   ';

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockClientLogin).not.toHaveBeenCalled();
    });

    it('should start when DISCORD_BOT_TOKEN is set', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
      mockClientLogin.mockResolvedValue(undefined);

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockClientLogin).toHaveBeenCalledWith('test-bot-token');
    });

    it('should trim DISCORD_BOT_TOKEN before using', async () => {
      process.env.DISCORD_BOT_TOKEN = '  test-bot-token  ';
      mockClientLogin.mockResolvedValue(undefined);

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockClientLogin).toHaveBeenCalledWith('test-bot-token');
    });

    it('should register setDiscordSendFn with the send function', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockSetDiscordSendFn).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should register messageCreate event handler', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockClientOn).toHaveBeenCalledWith('messageCreate', expect.any(Function));
    });

    it('should register ready event handler', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockClientOnce).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should register error event handler', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(mockClientOn).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('messageCreate event handler', () => {
    let messageHandler: (message: {
      author: { bot: boolean };
      content?: string;
      channel: { id: string; send: Mock };
    }) => Promise<void>;

    beforeEach(async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      // Capture the messageCreate handler when it's registered
      mockClientOn.mockImplementation((event: string, handler: unknown) => {
        if (event === 'messageCreate') {
          messageHandler = handler as typeof messageHandler;
        }
        return mockClient;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');
      await startDiscordBot();
    });

    it('should ignore messages from bots', async () => {
      const message = {
        author: { bot: true },
        content: 'Hello',
        channel: { id: '123', send: vi.fn() },
      };

      await messageHandler(message);

      expect(mockProcessMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages with no content', async () => {
      const message = {
        author: { bot: false },
        content: undefined,
        channel: { id: '123', send: vi.fn() },
      };

      await messageHandler(message);

      expect(mockProcessMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages with empty content', async () => {
      const message = {
        author: { bot: false },
        content: '',
        channel: { id: '123', send: vi.fn() },
      };

      await messageHandler(message);

      expect(mockProcessMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages with whitespace-only content', async () => {
      const message = {
        author: { bot: false },
        content: '   ',
        channel: { id: '123', send: vi.fn() },
      };

      await messageHandler(message);

      expect(mockProcessMessage).not.toHaveBeenCalled();
    });

    it('should process valid user messages', async () => {
      mockProcessMessage.mockResolvedValue('AI response');
      const messageSend = vi.fn().mockResolvedValue(undefined);
      const message = {
        author: { bot: false },
        content: 'Hello AI',
        channel: { id: 'channel-123', send: messageSend },
      };

      await messageHandler(message);

      expect(mockProcessMessage).toHaveBeenCalledWith('discord', 'channel-123', 'Hello AI');
      expect(messageSend).toHaveBeenCalledWith('AI response');
    });

    it('should trim message content before processing', async () => {
      mockProcessMessage.mockResolvedValue('Response');
      const messageSend = vi.fn().mockResolvedValue(undefined);
      const message = {
        author: { bot: false },
        content: '  Hello with spaces  ',
        channel: { id: 'channel-123', send: messageSend },
      };

      await messageHandler(message);

      expect(mockProcessMessage).toHaveBeenCalledWith(
        'discord',
        'channel-123',
        'Hello with spaces'
      );
    });

    it('should not send reply when processMessage returns null', async () => {
      mockProcessMessage.mockResolvedValue(null);
      const messageSend = vi.fn();
      const message = {
        author: { bot: false },
        content: 'Hello',
        channel: { id: '123', send: messageSend },
      };

      await messageHandler(message);

      expect(messageSend).not.toHaveBeenCalled();
    });

    it('should not send reply when processMessage returns empty string', async () => {
      mockProcessMessage.mockResolvedValue('');
      const messageSend = vi.fn();
      const message = {
        author: { bot: false },
        content: 'Hello',
        channel: { id: '123', send: messageSend },
      };

      await messageHandler(message);

      expect(messageSend).not.toHaveBeenCalled();
    });

    it('should truncate reply to 2000 characters', async () => {
      const longReply = 'a'.repeat(3000);
      mockProcessMessage.mockResolvedValue(longReply);
      const messageSend = vi.fn().mockResolvedValue(undefined);
      const message = {
        author: { bot: false },
        content: 'Hello',
        channel: { id: '123', send: messageSend },
      };

      await messageHandler(message);

      expect(messageSend).toHaveBeenCalledWith('a'.repeat(2000));
    });

    it('should send error message when processMessage throws', async () => {
      mockProcessMessage.mockRejectedValue(new Error('Processing failed'));
      const messageSend = vi.fn().mockResolvedValue(undefined);
      const message = {
        author: { bot: false },
        content: 'Hello',
        channel: { id: '123', send: messageSend },
      };

      await messageHandler(message);

      expect(messageSend).toHaveBeenCalledWith('Sorry, something went wrong.');
    });

    it('should handle error when sending error message fails', async () => {
      mockProcessMessage.mockRejectedValue(new Error('Processing failed'));
      const messageSend = vi.fn().mockRejectedValue(new Error('Send failed'));
      const message = {
        author: { bot: false },
        content: 'Hello',
        channel: { id: '123', send: messageSend },
      };

      // Should not throw
      await expect(messageHandler(message)).resolves.toBeUndefined();
    });
  });

  describe('ready event handler', () => {
    it('should log bot connection info', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      let readyHandler: () => void;
      mockClientOnce.mockImplementation((event: string, handler: unknown) => {
        if (event === 'ready') {
          readyHandler = handler as () => void;
        }
        return mockClient;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');
      const logger = await import('../../src/middleware/logger.js');

      await startDiscordBot();
      readyHandler!();

      expect(logger.default.info).toHaveBeenCalledWith(
        { user: 'TestBot#1234' },
        'Discord bot connected'
      );
    });
  });

  describe('error event handler', () => {
    it('should log client errors', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      let errorHandler: (err: Error) => void;
      mockClientOn.mockImplementation((event: string, handler: unknown) => {
        if (event === 'error') {
          errorHandler = handler as (err: Error) => void;
        }
        return mockClient;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');
      const logger = await import('../../src/middleware/logger.js');

      await startDiscordBot();
      errorHandler!(new Error('WebSocket connection lost'));

      expect(logger.default.error).toHaveBeenCalledWith(
        { err: 'WebSocket connection lost' },
        'Discord client error'
      );
    });
  });

  describe('sendToChannel function', () => {
    it('should send message to channel via setDiscordSendFn', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);
      mockChannelFetch.mockResolvedValue(mockChannel);
      mockChannelSend.mockResolvedValue(undefined);

      let sendFn: (channelId: string, text: string) => Promise<void>;
      mockSetDiscordSendFn.mockImplementation((fn: typeof sendFn) => {
        sendFn = fn;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();
      await sendFn!('channel-456', 'Hello from test');

      expect(mockChannelFetch).toHaveBeenCalledWith('channel-456');
      expect(mockChannelSend).toHaveBeenCalledWith('Hello from test');
    });

    it('should truncate message to 2000 characters in sendToChannel', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);
      mockChannelFetch.mockResolvedValue(mockChannel);
      mockChannelSend.mockResolvedValue(undefined);

      let sendFn: (channelId: string, text: string) => Promise<void>;
      mockSetDiscordSendFn.mockImplementation((fn: typeof sendFn) => {
        sendFn = fn;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();
      const longMessage = 'x'.repeat(2500);
      await sendFn!('channel-456', longMessage);

      expect(mockChannelSend).toHaveBeenCalledWith('x'.repeat(2000));
    });

    it('should not send if channel is not sendable', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      const nonSendableChannel = {
        isSendable: () => false,
        send: vi.fn(),
      };
      mockChannelFetch.mockResolvedValue(nonSendableChannel);

      let sendFn: (channelId: string, text: string) => Promise<void>;
      mockSetDiscordSendFn.mockImplementation((fn: typeof sendFn) => {
        sendFn = fn;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();
      await sendFn!('channel-456', 'Hello');

      expect(nonSendableChannel.send).not.toHaveBeenCalled();
    });

    it('should not send if channel fetch returns null', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);
      mockChannelFetch.mockResolvedValue(null);

      let sendFn: (channelId: string, text: string) => Promise<void>;
      mockSetDiscordSendFn.mockImplementation((fn: typeof sendFn) => {
        sendFn = fn;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      // Should not throw
      await expect(sendFn!('channel-456', 'Hello')).resolves.toBeUndefined();
    });

    it('should log warning and rethrow on send failure', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);
      mockChannelFetch.mockResolvedValue(mockChannel);
      mockChannelSend.mockRejectedValue(new Error('Rate limited'));

      let sendFn: (channelId: string, text: string) => Promise<void>;
      mockSetDiscordSendFn.mockImplementation((fn: typeof sendFn) => {
        sendFn = fn;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');
      const logger = await import('../../src/middleware/logger.js');

      await startDiscordBot();

      await expect(sendFn!('channel-456', 'Hello')).rejects.toThrow('Rate limited');
      expect(logger.default.warn).toHaveBeenCalledWith(
        { err: 'Rate limited', channelId: 'channel-456' },
        'Discord send failed'
      );
    });

    it('should log warning on channel fetch failure', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);
      mockChannelFetch.mockRejectedValue(new Error('Unknown channel'));

      let sendFn: (channelId: string, text: string) => Promise<void>;
      mockSetDiscordSendFn.mockImplementation((fn: typeof sendFn) => {
        sendFn = fn;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');
      const logger = await import('../../src/middleware/logger.js');

      await startDiscordBot();

      await expect(sendFn!('invalid-channel', 'Hello')).rejects.toThrow('Unknown channel');
      expect(logger.default.warn).toHaveBeenCalledWith(
        { err: 'Unknown channel', channelId: 'invalid-channel' },
        'Discord send failed'
      );
    });
  });

  describe('client initialization', () => {
    it('should create client with correct intents', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      const { Client } = await import('discord.js');
      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      await startDiscordBot();

      expect(Client).toHaveBeenCalledWith({
        intents: [1, 2, 4, 8], // Guilds, GuildMessages, DirectMessages, MessageContent
      });
    });
  });

  describe('module state', () => {
    it('should handle multiple startDiscordBot calls gracefully', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');

      // First call
      await startDiscordBot();
      expect(mockClientLogin).toHaveBeenCalledTimes(1);

      // Second call - in real implementation this would create a new client
      // The test verifies that the function completes without error
      vi.resetModules();
      const { startDiscordBot: startDiscordBot2 } = await import('../../src/bots/discordBot.js');
      await startDiscordBot2();
    });
  });

  describe('edge cases', () => {
    it('should handle message with special characters', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      let messageHandler: (message: unknown) => Promise<void>;
      mockClientOn.mockImplementation((event: string, handler: unknown) => {
        if (event === 'messageCreate') {
          messageHandler = handler as typeof messageHandler;
        }
        return mockClient;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');
      await startDiscordBot();

      mockProcessMessage.mockResolvedValue('Response');
      const messageSend = vi.fn().mockResolvedValue(undefined);
      const message = {
        author: { bot: false },
        content: 'Hello! @everyone <#123> :emoji: ```code```',
        channel: { id: '123', send: messageSend },
      };

      await messageHandler!(message);

      expect(mockProcessMessage).toHaveBeenCalledWith(
        'discord',
        '123',
        'Hello! @everyone <#123> :emoji: ```code```'
      );
    });

    it('should handle unicode content in messages', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      let messageHandler: (message: unknown) => Promise<void>;
      mockClientOn.mockImplementation((event: string, handler: unknown) => {
        if (event === 'messageCreate') {
          messageHandler = handler as typeof messageHandler;
        }
        return mockClient;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');
      await startDiscordBot();

      mockProcessMessage.mockResolvedValue('OK');
      const messageSend = vi.fn().mockResolvedValue(undefined);
      const message = {
        author: { bot: false },
        content: 'Hello world! Bonjour le monde!',
        channel: { id: '123', send: messageSend },
      };

      await messageHandler!(message);

      expect(mockProcessMessage).toHaveBeenCalled();
    });

    it('should handle very long channel IDs', async () => {
      process.env.DISCORD_BOT_TOKEN = 'test-token';
      mockClientLogin.mockResolvedValue(undefined);

      let messageHandler: (message: unknown) => Promise<void>;
      mockClientOn.mockImplementation((event: string, handler: unknown) => {
        if (event === 'messageCreate') {
          messageHandler = handler as typeof messageHandler;
        }
        return mockClient;
      });

      const { startDiscordBot } = await import('../../src/bots/discordBot.js');
      await startDiscordBot();

      mockProcessMessage.mockResolvedValue('Response');
      const longChannelId = '1234567890'.repeat(10);
      const messageSend = vi.fn().mockResolvedValue(undefined);
      const message = {
        author: { bot: false },
        content: 'Hello',
        channel: { id: longChannelId, send: messageSend },
      };

      await messageHandler!(message);

      expect(mockProcessMessage).toHaveBeenCalledWith('discord', longChannelId, 'Hello');
    });
  });
});

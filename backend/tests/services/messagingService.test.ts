/**
 * Messaging Service Unit Tests
 * Tests chat, ship integration, and Free Agent messaging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock database
const mockConversationStore = new Map<string, { role: string; content: string }[]>();
const mockDb = {
  getSettings: vi.fn(),
  getConversationMemory: vi.fn(async (platform: string, platformUserId: string) => {
    const key = `${platform}:${platformUserId}`;
    const msgs = mockConversationStore.get(key);
    if (!msgs) return null;
    return { messages: JSON.stringify(msgs), id: key, platform, platform_user_id: platformUserId } as unknown;
  }),
  saveConversationMemory: vi.fn(async (record: { platform: string; platform_user_id: string; messages: string }) => {
    const key = `${record.platform}:${record.platform_user_id}`;
    try {
      const msgs = JSON.parse(record.messages) as { role: string; content: string }[];
      mockConversationStore.set(key, msgs);
    } catch {
      mockConversationStore.set(key, []);
    }
  }),
};
vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock claudeServiceWithTools
const mockGenerateChatStream = vi.fn();
vi.mock('../../src/services/claudeServiceWithTools.js', () => ({
  claudeServiceWithTools: {
    generateChatStream: (...args: unknown[]) => mockGenerateChatStream(...args),
  },
}));

// Mock shipModeService
const mockStartShipMode = vi.fn();
vi.mock('../../src/services/shipModeService.js', () => ({
  startShipMode: (...args: unknown[]) => mockStartShipMode(...args),
}));

// Mock jobQueue
const mockEnqueueShipJob = vi.fn();
vi.mock('../../src/services/jobQueue.js', () => ({
  enqueueShipJob: (...args: unknown[]) => mockEnqueueShipJob(...args),
}));

// Mock messagingShipNotifier
const mockSubscribe = vi.fn();
vi.mock('../../src/services/messagingShipNotifier.js', () => ({
  subscribe: (...args: unknown[]) => mockSubscribe(...args),
}));

// Mock messagingPermissions
const mockPermissions = {
  getEffectivePermissions: vi.fn(),
  checkRateLimit: vi.fn(),
  requiresConfirmation: vi.fn(),
  createConfirmationRequest: vi.fn(),
  confirmRequest: vi.fn(),
  cancelRequest: vi.fn(),
  getUserPermissions: vi.fn(),
};
vi.mock('../../src/config/messagingPermissions.js', () => mockPermissions);

describe('messagingService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockConversationStore.clear();

    // Restore DB mock methods
    mockDb.getConversationMemory.mockImplementation(async (platform: string, platformUserId: string) => {
      const key = `${platform}:${platformUserId}`;
      const msgs = mockConversationStore.get(key);
      if (!msgs) return null;
      return { messages: JSON.stringify(msgs), id: key, platform, platform_user_id: platformUserId } as unknown;
    });
    mockDb.saveConversationMemory.mockImplementation(async (record: { platform: string; platform_user_id: string; messages: string }) => {
      const key = `${record.platform}:${record.platform_user_id}`;
      try {
        const msgs = JSON.parse(record.messages) as { role: string; content: string }[];
        mockConversationStore.set(key, msgs);
      } catch {
        mockConversationStore.set(key, []);
      }
    });

    // Default mock implementations
    mockPermissions.getEffectivePermissions.mockReturnValue({
      gAgentEnabled: false,
      allowedCapabilities: [],
      rateLimitPerHour: 100,
    });
    mockPermissions.checkRateLimit.mockReturnValue({ allowed: true });
    mockPermissions.getUserPermissions.mockReturnValue(null);
    mockDb.getSettings.mockResolvedValue(null);
  });

  describe('parseIntent', () => {
    it('should parse SHIP command with colon', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('ship: Build a todo app');
      
      expect(result).toEqual({
        action: 'ship',
        projectDescription: 'build a todo app', // lowercased by parseIntent
      });
    });

    it('should parse SHIP command without colon', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('ship Build a todo app');
      
      expect(result).toEqual({
        action: 'ship',
        projectDescription: 'build a todo app', // lowercased by parseIntent
      });
    });

    it('should parse /ship command', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('/ship Create a blog');
      
      expect(result).toEqual({
        action: 'ship',
        projectDescription: 'create a blog', // lowercased by parseIntent
      });
    });

    it('should parse /fa free agent command', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('/fa list files in src');
      
      expect(result).toEqual({
        action: 'freeagent',
        command: 'list files in src',
      });
    });

    it('should parse /freeagent command', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('/freeagent run npm test');
      
      expect(result).toEqual({
        action: 'freeagent',
        command: 'run npm test',
      });
    });

    it('should parse confirmation response', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('yes confirm_abc123');
      
      expect(result).toEqual({
        action: 'confirm',
        confirmationId: 'confirm_abc123',
      });
    });

    it('should parse cancel response', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      expect(parseIntent('no')).toEqual({ action: 'cancel' });
      expect(parseIntent('cancel')).toEqual({ action: 'cancel' });
    });

    it('should parse cancel with confirmation ID', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('no confirm_xyz789');
      
      expect(result).toEqual({
        action: 'cancel',
        confirmationId: 'confirm_xyz789',
      });
    });

    it('should parse /status command', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      expect(parseIntent('/status')).toEqual({ action: 'status' });
      expect(parseIntent('status')).toEqual({ action: 'status' });
    });

    it('should default to chat action', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('Hello, how are you?');
      
      expect(result).toEqual({ action: 'chat' });
    });

    it('should handle case insensitivity', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      expect(parseIntent('SHIP: test')).toEqual({
        action: 'ship',
        projectDescription: 'test',
      });
      expect(parseIntent('Ship: Test')).toEqual({
        action: 'ship',
        projectDescription: 'test', // lowercased
      });
    });

    it('should trim whitespace', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      const result = parseIntent('  ship: My project  ');
      
      expect(result).toEqual({
        action: 'ship',
        projectDescription: 'my project', // lowercased
      });
    });

    it('should match ship: with trailing spaces as ship with ":" description', async () => {
      const { parseIntent } = await import('../../src/services/messagingService.js');
      
      // The regex ^ship\s*:?\s*(.+) matches "ship:" with capture group being ":"
      // Since ":" is truthy after trim, it returns a ship action
      const result = parseIntent('ship:   ');
      
      expect(result).toEqual({ action: 'ship', projectDescription: ':' });
    });
  });

  describe('getOrCreateConversation', () => {
    it('should create new conversation', async () => {
      const { getOrCreateConversation } = await import('../../src/services/messagingService.js');

      const conv = await getOrCreateConversation('telegram', 'user123');

      expect(conv).toEqual([]);
    });

    it('should return existing conversation', async () => {
      const { getOrCreateConversation } = await import('../../src/services/messagingService.js');

      const conv1 = await getOrCreateConversation('telegram', 'user123');
      conv1.push({ role: 'user', content: 'Hello' });
      await (await import('../../src/services/conversationMemoryService.js')).saveConversation(
        'telegram',
        'user123',
        conv1
      );

      const conv2 = await getOrCreateConversation('telegram', 'user123');

      expect(conv2).toHaveLength(1);
      expect(conv2[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should maintain separate conversations per platform', async () => {
      const { getOrCreateConversation } = await import('../../src/services/messagingService.js');
      const { saveConversation } = await import('../../src/services/conversationMemoryService.js');

      const telegramConv = await getOrCreateConversation('telegram', 'user123');
      telegramConv.push({ role: 'user', content: 'Telegram message' });
      await saveConversation('telegram', 'user123', telegramConv);

      const discordConv = await getOrCreateConversation('discord', 'user123');

      expect(discordConv).toHaveLength(0);
    });

    it('should maintain separate conversations per user', async () => {
      const { getOrCreateConversation } = await import('../../src/services/messagingService.js');
      const { saveConversation } = await import('../../src/services/conversationMemoryService.js');

      const user1Conv = await getOrCreateConversation('telegram', 'user1');
      user1Conv.push({ role: 'user', content: 'User 1 message' });
      await saveConversation('telegram', 'user1', user1Conv);

      const user2Conv = await getOrCreateConversation('telegram', 'user2');

      expect(user2Conv).toHaveLength(0);
    });
  });

  describe('runChatAndGetReply', () => {
    it('should return chat response', async () => {
      async function* mockStream() {
        yield { type: 'text', text: 'Hello ' };
        yield { type: 'text', text: 'world!' };
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { runChatAndGetReply } = await import('../../src/services/messagingService.js');
      
      const reply = await runChatAndGetReply([
        { role: 'user', content: 'Hi' },
      ]);
      
      expect(reply).toBe('Hello world!');
    });

    it('should handle error events', async () => {
      async function* mockStream() {
        yield { type: 'error', message: 'Something went wrong' };
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { runChatAndGetReply } = await import('../../src/services/messagingService.js');
      
      const reply = await runChatAndGetReply([
        { role: 'user', content: 'Hi' },
      ]);
      
      expect(reply).toContain('Something went wrong');
    });

    it('should handle stream error', async () => {
      mockGenerateChatStream.mockImplementation(() => {
        throw new Error('Stream failed');
      });
      
      const { runChatAndGetReply } = await import('../../src/services/messagingService.js');
      
      const reply = await runChatAndGetReply([
        { role: 'user', content: 'Hi' },
      ]);
      
      expect(reply).toContain('Sorry');
    });

    it('should truncate long responses', async () => {
      const longText = 'A'.repeat(2000);
      async function* mockStream() {
        yield { type: 'text', text: longText };
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { runChatAndGetReply } = await import('../../src/services/messagingService.js');
      
      const reply = await runChatAndGetReply([
        { role: 'user', content: 'Hi' },
      ]);
      
      expect(reply.length).toBeLessThanOrEqual(1600);
    });

    it('should return Done for empty response', async () => {
      async function* mockStream() {
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { runChatAndGetReply } = await import('../../src/services/messagingService.js');
      
      const reply = await runChatAndGetReply([
        { role: 'user', content: 'Hi' },
      ]);
      
      expect(reply).toBe('Done.');
    });
  });

  describe('executeShipFromMessaging', () => {
    it('should start ship mode successfully', async () => {
      mockStartShipMode.mockResolvedValue({ id: 'session_123' });
      mockEnqueueShipJob.mockResolvedValue(undefined);
      
      const { executeShipFromMessaging } = await import('../../src/services/messagingService.js');
      
      const result = await executeShipFromMessaging(
        'Build a todo app',
        'telegram',
        'user123'
      );
      
      expect(result.ok).toBe(true);
      expect(result.sessionId).toBe('session_123');
    });

    it('should subscribe to ship notifier', async () => {
      mockStartShipMode.mockResolvedValue({ id: 'session_456' });
      mockEnqueueShipJob.mockResolvedValue(undefined);
      
      const { executeShipFromMessaging } = await import('../../src/services/messagingService.js');
      
      await executeShipFromMessaging('Build app', 'discord', 'user789');
      
      expect(mockSubscribe).toHaveBeenCalledWith('session_456', 'discord', 'user789');
    });

    it('should handle ship start failure', async () => {
      mockStartShipMode.mockRejectedValue(new Error('Ship failed'));
      
      const { executeShipFromMessaging } = await import('../../src/services/messagingService.js');
      
      const result = await executeShipFromMessaging(
        'Build app',
        'telegram',
        'user123'
      );
      
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Ship failed');
      expect(result.sessionId).toBe('');
    });
  });

  describe('processMessage', () => {
    it('should process SHIP command', async () => {
      mockStartShipMode.mockResolvedValue({ id: 'session_123' });
      mockEnqueueShipJob.mockResolvedValue(undefined);
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', 'ship: Todo app');
      
      expect(reply).toContain('SHIP started');
    });

    it('should handle SHIP failure', async () => {
      mockStartShipMode.mockRejectedValue(new Error('No API key'));
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', 'ship: Todo app');
      
      expect(reply).toContain('Failed to start SHIP');
      expect(reply).toContain('No API key');
    });

    it('should process confirmation response', async () => {
      mockPermissions.confirmRequest.mockReturnValue({
        tool: 'bash_execute',
      });
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', 'yes confirm_abc');
      
      expect(reply).toContain('Confirmed');
      expect(reply).toContain('bash_execute');
    });

    it('should handle expired confirmation', async () => {
      mockPermissions.confirmRequest.mockReturnValue(null);
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', 'yes confirm_expired');
      
      expect(reply).toContain('not found');
    });

    it('should process cancel response', async () => {
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', 'cancel');
      
      expect(reply).toBe('Cancelled.');
    });

    it('should process status request', async () => {
      mockPermissions.getEffectivePermissions.mockReturnValue({
        gAgentEnabled: true,
        allowedCapabilities: ['file_read', 'bash_execute'],
        rateLimitPerHour: 50,
      });
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', '/status');
      
      expect(reply).toContain('telegram');
      expect(reply).toContain('Enabled');
    });

    it('should route to Free Agent when enabled', async () => {
      mockPermissions.getEffectivePermissions.mockReturnValue({
        gAgentEnabled: true,
        allowedCapabilities: ['file_read'],
        rateLimitPerHour: 100,
      });
      mockPermissions.checkRateLimit.mockReturnValue({ allowed: true });
      mockDb.getSettings.mockResolvedValue({
        preferences: {
          gAgentCapabilities: ['file_read'],
          gAgentExternalAllowlist: [],
        },
        tier: 'pro',
      });
      
      async function* mockStream() {
        yield { type: 'text', text: 'Free Agent response' };
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', 'Hello there');
      
      expect(reply).toContain('Free Agent response');
    });

    it('should use standard chat when Free Agent is disabled', async () => {
      mockPermissions.getEffectivePermissions.mockReturnValue({
        gAgentEnabled: false,
        allowedCapabilities: [],
        rateLimitPerHour: 100,
      });
      
      async function* mockStream() {
        yield { type: 'text', text: 'Standard chat response' };
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', 'Hello');
      
      expect(reply).toBe('Standard chat response');
    });

    it('should handle empty message', async () => {
      mockPermissions.getEffectivePermissions.mockReturnValue({
        gAgentEnabled: false,
        allowedCapabilities: [],
        rateLimitPerHour: 100,
      });
      
      async function* mockStream() {
        yield { type: 'text', text: 'Response' };
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', '');
      
      expect(reply).toBeDefined();
    });

    it('should handle /freeagent command', async () => {
      mockPermissions.getEffectivePermissions.mockReturnValue({
        gAgentEnabled: true,
        allowedCapabilities: ['bash_execute'],
        rateLimitPerHour: 100,
      });
      mockPermissions.checkRateLimit.mockReturnValue({ allowed: true });
      mockDb.getSettings.mockResolvedValue({
        preferences: { gAgentCapabilities: ['bash_execute'] },
        tier: 'pro',
      });
      
      async function* mockStream() {
        yield { type: 'text', text: 'Files listed' };
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', '/fa list files');
      
      expect(reply).toBe('Files listed');
    });

    it('should return error when Free Agent is disabled for /fa command', async () => {
      mockPermissions.getEffectivePermissions.mockReturnValue({
        gAgentEnabled: false,
        allowedCapabilities: [],
        rateLimitPerHour: 100,
      });
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', '/fa list files');
      
      expect(reply).toContain('not enabled');
    });

    it('should enforce rate limiting', async () => {
      mockPermissions.getEffectivePermissions.mockReturnValue({
        gAgentEnabled: true,
        allowedCapabilities: ['file_read'],
        rateLimitPerHour: 10,
      });
      mockPermissions.checkRateLimit.mockReturnValue({
        allowed: false,
        resetIn: 300000, // 5 minutes
      });
      
      const { processMessage } = await import('../../src/services/messagingService.js');
      
      const reply = await processMessage('telegram', 'user123', '/fa do something');
      
      expect(reply).toContain('Rate limit exceeded');
      expect(reply).toContain('minutes');
    });
  });

  describe('conversation persistence', () => {
    it('should maintain conversation history in chat', async () => {
      mockPermissions.getEffectivePermissions.mockReturnValue({
        gAgentEnabled: false,
        allowedCapabilities: [],
        rateLimitPerHour: 100,
      });
      
      async function* mockStream() {
        yield { type: 'text', text: 'Response' };
        yield { type: 'done' };
      }
      mockGenerateChatStream.mockReturnValue(mockStream());
      
      const { processMessage, getOrCreateConversation } = await import('../../src/services/messagingService.js');

      await processMessage('telegram', 'userX', 'First message');
      await processMessage('telegram', 'userX', 'Second message');

      const conv = await getOrCreateConversation('telegram', 'userX');

      expect(conv.length).toBeGreaterThan(0);
    });
  });
});

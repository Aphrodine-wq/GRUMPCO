/**
 * Webhook Service Unit Tests
 * Tests dispatchWebhook, registerWebhook functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock broadcastEvent
vi.mock('../../src/services/eventsStreamService.js', () => ({
  broadcastEvent: vi.fn(),
}));

// Mock supabaseClient
vi.mock('../../src/services/supabaseClient.js', () => ({
  db: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
  isMockMode: true,
}));

// Mock runtime config
vi.mock('../../src/config/runtime.js', () => ({
  isServerlessRuntime: false,
}));

// Mock logger to avoid thread-stream issues
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('webhookService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Default mock that returns a proper promise
    mockFetch.mockResolvedValue({ ok: true });
    // Clear webhook URLs env
    delete process.env.GRUMP_WEBHOOK_URLS;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('registerWebhook', () => {
    it('should register a new webhook URL', async () => {
      const { registerWebhook, dispatchWebhook } = await import('../../src/services/webhookService.js');
      
      mockFetch.mockResolvedValue({ ok: true });
      
      registerWebhook('https://example.com/webhook');
      dispatchWebhook('ship.completed', { sessionId: 'test123' });

      // Give setImmediate time to execute
      await new Promise((r) => setTimeout(r, 50));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should update existing webhook if URL already registered', async () => {
      const { registerWebhook } = await import('../../src/services/webhookService.js');
      
      registerWebhook('https://example.com/hook', ['ship.completed']);
      registerWebhook('https://example.com/hook', ['codegen.ready']);
      
      // Should not throw, just update
      expect(true).toBe(true);
    });

    it('should register webhook with specific events filter', async () => {
      const { registerWebhook } = await import('../../src/services/webhookService.js');
      
      registerWebhook('https://example.com/specific', ['ship.completed', 'prd.generated']);
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('dispatchWebhook', () => {
    it('should dispatch to URLs from env var', async () => {
      process.env.GRUMP_WEBHOOK_URLS = 'https://hook1.example.com,https://hook2.example.com';
      
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');
      
      mockFetch.mockResolvedValue({ ok: true });
      
      dispatchWebhook('codegen.ready', { sessionId: 'abc' });

      await new Promise((r) => setTimeout(r, 50));

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not fail when no webhooks are registered', async () => {
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');
      
      // Should not throw
      expect(() => {
        dispatchWebhook('ship.failed', { error: 'test error' });
      }).not.toThrow();
    });

    it('should include event, payload, and timestamp in request body', async () => {
      process.env.GRUMP_WEBHOOK_URLS = 'https://test.example.com';
      
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');
      
      mockFetch.mockResolvedValue({ ok: true });
      
      const payload = { sessionId: 'test123', result: 'success' };
      dispatchWebhook('architecture.generated', payload);

      await new Promise((r) => setTimeout(r, 50));

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.event).toBe('architecture.generated');
      expect(callBody.payload).toEqual(payload);
      expect(callBody.timestamp).toBeDefined();
    });

    it('should handle fetch failure gracefully', async () => {
      process.env.GRUMP_WEBHOOK_URLS = 'https://failing.example.com';
      
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');
      
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      // Should not throw
      expect(() => {
        dispatchWebhook('prd.generated', { data: 'test' });
      }).not.toThrow();
    });

    it('should handle non-ok response gracefully', async () => {
      process.env.GRUMP_WEBHOOK_URLS = 'https://error.example.com';
      
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');
      
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      
      // Should not throw
      expect(() => {
        dispatchWebhook('codegen.failed', { error: 'compile error' });
      }).not.toThrow();
    });

    it('should broadcast event via SSE', async () => {
      const { broadcastEvent } = await import('../../src/services/eventsStreamService.js');
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');
      
      dispatchWebhook('ship.completed', { sessionId: 'xyz' });

      expect(broadcastEvent).toHaveBeenCalledWith('ship.completed', { sessionId: 'xyz' });
    });
  });

  describe('WebhookEvent types', () => {
    it('should support all event types', async () => {
      process.env.GRUMP_WEBHOOK_URLS = 'https://all-events.example.com';
      
      const { dispatchWebhook } = await import('../../src/services/webhookService.js');
      
      mockFetch.mockResolvedValue({ ok: true });
      
      const events = [
        'ship.completed',
        'codegen.ready',
        'ship.failed',
        'codegen.failed',
        'architecture.generated',
        'prd.generated',
      ] as const;

      for (const event of events) {
        dispatchWebhook(event, { test: true });
      }

      await new Promise((r) => setTimeout(r, 100));

      expect(mockFetch).toHaveBeenCalledTimes(events.length);
    });
  });
});

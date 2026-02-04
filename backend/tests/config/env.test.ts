/**
 * Environment Configuration Tests
 * Tests for backend/src/config/env.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test env.ts which runs validation at import time.
// We'll test the getApiKey function and the env schema behavior.

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    // Preserve test environment
    process.env = { 
      ...originalEnv,
      NODE_ENV: 'test',
      NVIDIA_NIM_API_KEY: 'test-nvidia-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getApiKey', () => {
    it('should return NVIDIA NIM API key when provider is nvidia_nim', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nvidia-test-key';

      const { getApiKey } = await import('../../src/config/env.js');

      expect(getApiKey('nvidia_nim')).toBe('nvidia-test-key');
    });

    it('should return undefined when provider is openrouter (unsupported)', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nvidia-test-key';

      const { getApiKey } = await import('../../src/config/env.js');

      // @ts-expect-error Testing unsupported provider
      expect(getApiKey('openrouter')).toBeUndefined();
    });

    it('should return undefined for unknown provider', async () => {
      const { getApiKey } = await import('../../src/config/env.js');

      // @ts-expect-error Testing invalid provider
      expect(getApiKey('unknown')).toBeUndefined();
    });
  });

  describe('env object', () => {
    it('should have default NODE_ENV value', async () => {
      const { env } = await import('../../src/config/env.js');
      
      expect(env.NODE_ENV).toBe('test');
    });

    it('should have default PORT value', async () => {
      const { env } = await import('../../src/config/env.js');
      
      expect(env.PORT).toBe(3000);
    });

    it('should have default DB_PATH value', async () => {
      const { env } = await import('../../src/config/env.js');
      
      expect(env.DB_PATH).toBe('./data/grump.db');
    });

    it('should have default Redis port', async () => {
      const { env } = await import('../../src/config/env.js');
      
      expect(env.REDIS_PORT).toBe(6379);
    });

    it('should have default Docker host', async () => {
      const { env } = await import('../../src/config/env.js');
      
      expect(env.DOCKER_HOST).toBe('unix:///var/run/docker.sock');
    });

    it('should have default sandbox timeout', async () => {
      const { env } = await import('../../src/config/env.js');
      
      expect(env.SANDBOX_TIMEOUT_MS).toBe(60000);
    });

    it('should have default sandbox memory limit', async () => {
      const { env } = await import('../../src/config/env.js');
      
      expect(env.SANDBOX_MEMORY_LIMIT).toBe('512m');
    });

    it('should have default agent access policy', async () => {
      const { env } = await import('../../src/config/env.js');
      
      expect(env.AGENT_ACCESS_POLICY).toBe('block');
    });

    it('should transform boolean env vars correctly', async () => {
      process.env.BLOCK_SUSPICIOUS_PROMPTS = 'true';
      process.env.REQUIRE_AUTH_FOR_API = 'false';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.BLOCK_SUSPICIOUS_PROMPTS).toBe(true);
      expect(env.REQUIRE_AUTH_FOR_API).toBe(false);
    });

    it('should transform FREE_AGENT_ENABLED correctly', async () => {
      process.env.FREE_AGENT_ENABLED = 'true';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.FREE_AGENT_ENABLED).toBe(true);
    });

    it('should transform GRUMP_USE_WASM_INTENT correctly', async () => {
      process.env.GRUMP_USE_WASM_INTENT = '1';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.GRUMP_USE_WASM_INTENT).toBe(true);
    });

    it('should parse PORT as number', async () => {
      process.env.PORT = '8080';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.PORT).toBe(8080);
      expect(typeof env.PORT).toBe('number');
    });

    it('should parse SANDBOX_TIMEOUT_MS as number', async () => {
      process.env.SANDBOX_TIMEOUT_MS = '30000';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.SANDBOX_TIMEOUT_MS).toBe(30000);
    });
  });

  describe('Env type export', () => {
    it('should export Env type', async () => {
      const module = await import('../../src/config/env.js');
      
      // Type export is available if module compiles
      expect(module.env).toBeDefined();
    });
  });

  describe('default export', () => {
    it('should export process.env as default', async () => {
      const defaultExport = await import('../../src/config/env.js');
      
      expect(defaultExport.default).toBe(process.env);
    });
  });

  describe('validation in test environment', () => {
    it('should skip API key requirement in test environment', async () => {
      // In test environment, API keys are not required
      delete process.env.NVIDIA_NIM_API_KEY;
      process.env.NODE_ENV = 'test';

      vi.resetModules();

      // Should not throw even without API keys in test mode
      const { env } = await import('../../src/config/env.js');
      expect(env).toBeDefined();
    });
  });

  describe('CORS_ORIGINS', () => {
    it('should accept CORS_ORIGINS string', async () => {
      process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:5173';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.CORS_ORIGINS).toBe('http://localhost:3000,http://localhost:5173');
    });
  });

  describe('Supabase configuration', () => {
    it('should accept valid Supabase URL', async () => {
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.SUPABASE_URL).toBe('https://example.supabase.co');
      expect(env.SUPABASE_ANON_KEY).toBe('test-anon-key');
    });
  });

  describe('Optional API keys', () => {
    it('should accept Stripe keys', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.STRIPE_SECRET_KEY).toBe('sk_test_xxx');
      expect(env.STRIPE_WEBHOOK_SECRET).toBe('whsec_xxx');
    });

    it('should accept Twilio configuration', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'AC123';
      process.env.TWILIO_AUTH_TOKEN = 'auth-token';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.TWILIO_ACCOUNT_SID).toBe('AC123');
      expect(env.TWILIO_AUTH_TOKEN).toBe('auth-token');
    });

    it('should accept Discord configuration', async () => {
      process.env.DISCORD_CLIENT_ID = 'discord-client';
      process.env.DISCORD_CLIENT_SECRET = 'discord-secret';
      process.env.DISCORD_BOT_TOKEN = 'discord-bot-token';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.DISCORD_CLIENT_ID).toBe('discord-client');
      expect(env.DISCORD_CLIENT_SECRET).toBe('discord-secret');
      expect(env.DISCORD_BOT_TOKEN).toBe('discord-bot-token');
    });

    it('should accept Slack configuration', async () => {
      process.env.SLACK_CLIENT_ID = 'slack-client';
      process.env.SLACK_CLIENT_SECRET = 'slack-secret';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.SLACK_CLIENT_ID).toBe('slack-client');
      expect(env.SLACK_CLIENT_SECRET).toBe('slack-secret');
    });

    it('should accept ElevenLabs configuration', async () => {
      process.env.ELEVENLABS_API_KEY = 'elevenlabs-key';
      process.env.ELEVENLABS_VOICE_ID = 'voice-123';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.ELEVENLABS_API_KEY).toBe('elevenlabs-key');
      expect(env.ELEVENLABS_VOICE_ID).toBe('voice-123');
    });
  });

  describe('NVIDIA NIM URL validation', () => {
    it('should accept valid HTTP URL', async () => {
      process.env.NVIDIA_NIM_URL = 'http://localhost:8000';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.NVIDIA_NIM_URL).toBe('http://localhost:8000');
    });

    it('should accept valid HTTPS URL', async () => {
      process.env.NVIDIA_NIM_URL = 'https://nim.example.com';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.NVIDIA_NIM_URL).toBe('https://nim.example.com');
    });
  });

  describe('Serverless configuration', () => {
    it('should accept vercel serverless mode', async () => {
      process.env.SERVERLESS_MODE = 'vercel';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.SERVERLESS_MODE).toBe('vercel');
    });

    it('should accept SSE events mode', async () => {
      process.env.EVENTS_MODE = 'sse';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.EVENTS_MODE).toBe('sse');
    });

    it('should accept poll events mode', async () => {
      process.env.EVENTS_MODE = 'poll';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.EVENTS_MODE).toBe('poll');
    });
  });

  describe('QStash configuration', () => {
    it('should accept QStash tokens', async () => {
      process.env.QSTASH_TOKEN = 'qstash-token';
      process.env.QSTASH_URL = 'https://qstash.upstash.io';
      process.env.JOB_WORKER_SECRET = 'worker-secret';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.QSTASH_TOKEN).toBe('qstash-token');
      expect(env.QSTASH_URL).toBe('https://qstash.upstash.io');
      expect(env.JOB_WORKER_SECRET).toBe('worker-secret');
    });
  });

  describe('Home Assistant configuration', () => {
    it('should accept valid Home Assistant URL', async () => {
      process.env.HOME_ASSISTANT_URL = 'http://homeassistant.local:8123';
      process.env.HOME_ASSISTANT_TOKEN = 'ha-token';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.HOME_ASSISTANT_URL).toBe('http://homeassistant.local:8123');
      expect(env.HOME_ASSISTANT_TOKEN).toBe('ha-token');
    });
  });

  describe('Notion configuration', () => {
    it('should accept Notion OAuth settings', async () => {
      process.env.NOTION_CLIENT_ID = 'notion-client';
      process.env.NOTION_CLIENT_SECRET = 'notion-secret';
      process.env.NOTION_REDIRECT_URI = 'https://example.com/callback';
      
      vi.resetModules();
      const { env } = await import('../../src/config/env.js');
      
      expect(env.NOTION_CLIENT_ID).toBe('notion-client');
      expect(env.NOTION_CLIENT_SECRET).toBe('notion-secret');
      expect(env.NOTION_REDIRECT_URI).toBe('https://example.com/callback');
    });
  });
});

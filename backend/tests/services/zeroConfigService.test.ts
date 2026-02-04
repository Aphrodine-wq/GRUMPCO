/**
 * Zero-Config Service Unit Tests
 * Tests automatic configuration, provider detection, and quick-start templates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock database
const mockDb = {
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
};

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('zeroConfigService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Reset process.env to original + clear provider keys
    process.env = { ...originalEnv };
    delete process.env.NVIDIA_NIM_API_KEY;
    delete     delete     delete     delete     delete     delete     delete process.env.REDIS_HOST;
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.NVIDIA_RIVA_URL;
    delete process.env.NVIDIA_RIVA_API_KEY;
    delete process.env.NVIDIA_NEMO_GUARDRAILS_URL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.GITHUB_TOKEN;
    
    // Reset mock defaults
    mockDb.getSettings.mockResolvedValue(null);
    mockDb.saveSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('detectProviders', () => {
    it('should return all providers with configured status false when no keys set', async () => {
      const { detectProviders } = await import('../../src/services/zeroConfigService.js');
      
      const providers = detectProviders();
      
      expect(providers).toHaveLength(1);
      expect(providers.every(p => p.configured === false)).toBe(true);
    });

    it('should detect NVIDIA NIM provider when key is set', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      
      const { detectProviders } = await import('../../src/services/zeroConfigService.js');
      
      const providers = detectProviders();
      const nimProvider = providers.find(p => p.provider === 'nim');
      
      expect(nimProvider).toBeDefined();
      expect(nimProvider?.configured).toBe(true);
      expect(nimProvider?.envVar).toBe('NVIDIA_NIM_API_KEY');
    });

    

    

    

    

    

    

    
  });

  describe('getBestProvider', () => {
    it('should return null when no providers configured', async () => {
      const { getBestProvider } = await import('../../src/services/zeroConfigService.js');
      
      const result = getBestProvider();
      
      expect(result).toBeNull();
    });

    it('should return NIM when configured', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      const { getBestProvider } = await import('../../src/services/zeroConfigService.js');
      const result = getBestProvider();
      expect(result).not.toBeNull();
      expect(result?.provider).toBe('nim');
      expect(result?.modelId).toBe('meta/llama-3.1-70b-instruct');
    });

    

    

    

    

    

    
  });

  describe('detectFeatures', () => {
    it('should return empty array when no features configured', async () => {
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toEqual([]);
    });

    it('should detect Redis features when REDIS_HOST is set', async () => {
      process.env.REDIS_HOST = 'localhost';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('redis_cache');
      expect(features).toContain('redis_sessions');
    });

    it('should detect Postgres storage when DATABASE_URL is set', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('postgres_storage');
    });

    it('should detect Supabase features when both URL and key are set', async () => {
      process.env.SUPABASE_URL = 'https://project.supabase.co';
      process.env.SUPABASE_SERVICE_KEY = 'service-key';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('supabase_auth');
      expect(features).toContain('supabase_storage');
    });

    it('should not detect Supabase features when only URL is set', async () => {
      process.env.SUPABASE_URL = 'https://project.supabase.co';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).not.toContain('supabase_auth');
      expect(features).not.toContain('supabase_storage');
    });

    it('should detect NVIDIA Riva speech feature when RIVA_URL is set', async () => {
      process.env.NVIDIA_RIVA_URL = 'http://localhost:50051';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('nvidia_riva_speech');
    });

    it('should detect NVIDIA Riva speech feature when RIVA_API_KEY is set', async () => {
      process.env.NVIDIA_RIVA_API_KEY = 'riva-key';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('nvidia_riva_speech');
    });

    it('should detect NVIDIA guardrails when NeMo URL is set', async () => {
      process.env.NVIDIA_NEMO_GUARDRAILS_URL = 'http://localhost:8080';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('nvidia_guardrails');
    });

    it('should detect Telegram bot when token is set', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'telegram-bot-token';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('telegram_bot');
    });

    it('should detect Discord bot when token is set', async () => {
      process.env.DISCORD_BOT_TOKEN = 'discord-bot-token';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('discord_bot');
    });

    it('should detect Twilio SMS when account SID is set', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'twilio-sid';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('twilio_sms');
    });

    it('should detect GitHub integration when token is set', async () => {
      process.env.GITHUB_TOKEN = 'github-token';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('github_integration');
    });

    it('should detect multiple features', async () => {
      process.env.REDIS_HOST = 'localhost';
      process.env.GITHUB_TOKEN = 'github-token';
      process.env.TELEGRAM_BOT_TOKEN = 'telegram-token';
      
      const { detectFeatures } = await import('../../src/services/zeroConfigService.js');
      
      const features = detectFeatures();
      
      expect(features).toContain('redis_cache');
      expect(features).toContain('redis_sessions');
      expect(features).toContain('github_integration');
      expect(features).toContain('telegram_bot');
    });
  });

  describe('performZeroConfig', () => {
    it('should return warning when no provider configured', async () => {
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await performZeroConfig('user-123');
      
      expect(result.configured).toBe(false);
      expect(result.provider).toBeNull();
      expect(result.warnings).toContain('No API provider configured. Add NVIDIA_NIM_API_KEY or another provider key to enable AI features.');
      expect(result.suggestions).toContain('Get a free NVIDIA NIM API key at build.nvidia.com');
    });

    it('should return configured when provider is available', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await performZeroConfig('user-123');
      
      expect(result.configured).toBe(true);
      expect(result.provider).toBe('nim');
      expect(result.warnings).toHaveLength(0);
    });

    it('should suggest Redis when not configured', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await performZeroConfig('user-123');
      
      expect(result.suggestions).toContain('Add Redis for improved caching and session persistence');
    });

    it('should not suggest Redis when already configured', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      process.env.REDIS_HOST = 'localhost';
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await performZeroConfig('user-123');
      
      expect(result.suggestions).not.toContain('Add Redis for improved caching and session persistence');
      expect(result.features).toContain('redis_cache');
    });

    it('should save default settings for first-time user', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      mockDb.getSettings.mockResolvedValueOnce(null);
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      await performZeroConfig('user-123');
      
      expect(mockDb.saveSettings).toHaveBeenCalledWith('user-123', expect.objectContaining({
        models: expect.objectContaining({
          defaultProvider: 'nim',
          defaultModelId: 'meta/llama-3.1-70b-instruct',
          modelPreset: 'balanced',
        }),
        preferences: expect.objectContaining({
          diagramStyle: 'detailed',
          primaryTechStack: ['React', 'Node.js', 'PostgreSQL'],
          theme: 'auto',
          analyticsOptIn: true,
          setupComplete: false,
        }),
        guardRails: expect.objectContaining({
          confirmEveryWrite: true,
          autonomousMode: false,
          useLargeContext: false,
        }),
        updatedAt: expect.any(String),
      }));
    });

    it('should not overwrite existing settings', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      mockDb.getSettings.mockResolvedValueOnce({ existing: true });
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      await performZeroConfig('user-123');
      
      expect(mockDb.saveSettings).not.toHaveBeenCalled();
    });

    it('should handle database error gracefully', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      mockDb.getSettings.mockRejectedValueOnce(new Error('Database error'));
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      const result = await performZeroConfig('user-123');
      
      expect(result.configured).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'Failed to apply zero-config settings'
      );
    });

    it('should include detected features in result', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      process.env.REDIS_HOST = 'localhost';
      process.env.GITHUB_TOKEN = 'github-token';
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await performZeroConfig('user-123');
      
      expect(result.features).toContain('redis_cache');
      expect(result.features).toContain('redis_sessions');
      expect(result.features).toContain('github_integration');
    });

    it('should create settings with no provider when none available', async () => {
      mockDb.getSettings.mockResolvedValueOnce(null);
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      await performZeroConfig('user-123');
      
      expect(mockDb.saveSettings).toHaveBeenCalledWith('user-123', expect.objectContaining({
        models: expect.objectContaining({
          modelPreset: 'balanced',
        }),
      }));
      
      // Verify no defaultProvider or defaultModelId when no provider configured
      const savedSettings = mockDb.saveSettings.mock.calls[0][1];
      expect(savedSettings.models.defaultProvider).toBeUndefined();
      expect(savedSettings.models.defaultModelId).toBeUndefined();
    });
  });

  describe('QUICK_START_TEMPLATES', () => {
    it('should export all quick-start templates', async () => {
      const { QUICK_START_TEMPLATES } = await import('../../src/services/zeroConfigService.js');
      
      expect(QUICK_START_TEMPLATES).toHaveLength(6);
      expect(QUICK_START_TEMPLATES.map(t => t.id)).toContain('fullstack-react');
      expect(QUICK_START_TEMPLATES.map(t => t.id)).toContain('python-api');
      expect(QUICK_START_TEMPLATES.map(t => t.id)).toContain('static-site');
      expect(QUICK_START_TEMPLATES.map(t => t.id)).toContain('microservices');
      expect(QUICK_START_TEMPLATES.map(t => t.id)).toContain('mobile-backend');
      expect(QUICK_START_TEMPLATES.map(t => t.id)).toContain('ai-agent');
    });

    it('should have all required fields for each template', async () => {
      const { QUICK_START_TEMPLATES } = await import('../../src/services/zeroConfigService.js');
      
      for (const template of QUICK_START_TEMPLATES) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.techStack).toBeInstanceOf(Array);
        expect(template.diagramStyle).toMatch(/^(minimal|detailed|comprehensive)$/);
        expect(template.freeAgentCapabilities).toBeInstanceOf(Array);
      }
    });

    it('should have fullstack-react template with correct config', async () => {
      const { QUICK_START_TEMPLATES } = await import('../../src/services/zeroConfigService.js');
      
      const template = QUICK_START_TEMPLATES.find(t => t.id === 'fullstack-react');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Full-Stack React App');
      expect(template?.techStack).toContain('React');
      expect(template?.techStack).toContain('Node.js');
      expect(template?.techStack).toContain('PostgreSQL');
      expect(template?.diagramStyle).toBe('detailed');
      expect(template?.freeAgentCapabilities).toContain('file');
      expect(template?.freeAgentCapabilities).toContain('git');
    });

    it('should have static-site template with minimal diagram style', async () => {
      const { QUICK_START_TEMPLATES } = await import('../../src/services/zeroConfigService.js');
      
      const template = QUICK_START_TEMPLATES.find(t => t.id === 'static-site');
      
      expect(template).toBeDefined();
      expect(template?.diagramStyle).toBe('minimal');
    });

    it('should have microservices template with comprehensive diagram style', async () => {
      const { QUICK_START_TEMPLATES } = await import('../../src/services/zeroConfigService.js');
      
      const template = QUICK_START_TEMPLATES.find(t => t.id === 'microservices');
      
      expect(template).toBeDefined();
      expect(template?.diagramStyle).toBe('comprehensive');
      expect(template?.freeAgentCapabilities).toContain('cloud');
      expect(template?.freeAgentCapabilities).toContain('monitoring');
    });
  });

  describe('applyQuickStartTemplate', () => {
    it('should return false when template not found', async () => {
      const { applyQuickStartTemplate } = await import('../../src/services/zeroConfigService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      const result = await applyQuickStartTemplate('user-123', 'non-existent');
      
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', templateId: 'non-existent' }),
        'Template not found'
      );
    });

    it('should apply template to existing settings', async () => {
      mockDb.getSettings.mockResolvedValueOnce({
        preferences: {
          theme: 'dark',
          analyticsOptIn: true,
          setupComplete: true,
        },
      });
      
      const { applyQuickStartTemplate } = await import('../../src/services/zeroConfigService.js');
      
      const result = await applyQuickStartTemplate('user-123', 'fullstack-react');
      
      expect(result).toBe(true);
      expect(mockDb.saveSettings).toHaveBeenCalledWith('user-123', expect.objectContaining({
        preferences: expect.objectContaining({
          diagramStyle: 'detailed',
          primaryTechStack: ['React', 'Node.js', 'PostgreSQL', 'Docker'],
          freeAgentCapabilities: ['file', 'git', 'bash', 'npm', 'docker'],
          theme: 'dark',
          analyticsOptIn: true,
          setupComplete: true,
        }),
        updatedAt: expect.any(String),
      }));
    });

    it('should apply template when no existing settings', async () => {
      mockDb.getSettings.mockResolvedValueOnce(null);
      
      const { applyQuickStartTemplate } = await import('../../src/services/zeroConfigService.js');
      
      const result = await applyQuickStartTemplate('user-123', 'python-api');
      
      expect(result).toBe(true);
      expect(mockDb.saveSettings).toHaveBeenCalledWith('user-123', expect.objectContaining({
        preferences: expect.objectContaining({
          diagramStyle: 'detailed',
          primaryTechStack: ['Python', 'PostgreSQL', 'Redis', 'Docker'],
          freeAgentCapabilities: ['file', 'git', 'bash', 'docker'],
          theme: 'auto',
          analyticsOptIn: false,
          setupComplete: false,
        }),
      }));
    });

    it('should handle database error gracefully', async () => {
      mockDb.getSettings.mockRejectedValueOnce(new Error('Database error'));
      
      const { applyQuickStartTemplate } = await import('../../src/services/zeroConfigService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      const result = await applyQuickStartTemplate('user-123', 'fullstack-react');
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', templateId: 'fullstack-react' }),
        'Failed to apply template'
      );
    });

    it('should apply ai-agent template with all capabilities', async () => {
      mockDb.getSettings.mockResolvedValueOnce({});
      
      const { applyQuickStartTemplate } = await import('../../src/services/zeroConfigService.js');
      
      const result = await applyQuickStartTemplate('user-123', 'ai-agent');
      
      expect(result).toBe(true);
      expect(mockDb.saveSettings).toHaveBeenCalledWith('user-123', expect.objectContaining({
        preferences: expect.objectContaining({
          diagramStyle: 'comprehensive',
          primaryTechStack: ['Python', 'Redis', 'Docker'],
          freeAgentCapabilities: expect.arrayContaining(['file', 'git', 'bash', 'docker', 'api_call', 'webhooks', 'heartbeats']),
        }),
      }));
    });

    it('should log success when template applied', async () => {
      mockDb.getSettings.mockResolvedValueOnce({});
      
      const { applyQuickStartTemplate } = await import('../../src/services/zeroConfigService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await applyQuickStartTemplate('user-123', 'static-site');
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', templateId: 'static-site' }),
        'Quick-start template applied'
      );
    });
  });

  describe('getProgressiveConfig', () => {
    it('should return beginner config for new user', async () => {
      mockDb.getSettings.mockResolvedValueOnce(null);
      
      const { getProgressiveConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getProgressiveConfig('user-123');
      
      expect(result.basicMode).toBe(true);
      expect(result.experienceLevel).toBe('beginner');
      expect(result.hiddenFeatures).toContain('agent_swarm');
      expect(result.hiddenFeatures).toContain('multi_platform_msg');
      expect(result.hiddenFeatures).toContain('cicd');
      expect(result.hiddenFeatures).toContain('cloud');
    });

    it('should return intermediate config when setup is complete', async () => {
      mockDb.getSettings.mockResolvedValueOnce({
        preferences: { setupComplete: true },
      });
      
      const { getProgressiveConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getProgressiveConfig('user-123');
      
      expect(result.basicMode).toBe(false);
      expect(result.experienceLevel).toBe('intermediate');
      expect(result.hiddenFeatures).toHaveLength(0);
    });

    it('should include premium features for free tier', async () => {
      mockDb.getSettings.mockResolvedValueOnce({
        tier: 'free',
        preferences: { setupComplete: true },
      });
      
      const { getProgressiveConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getProgressiveConfig('user-123');
      
      expect(result.premiumFeatures).toContain('cloud');
      expect(result.premiumFeatures).toContain('cicd');
      expect(result.premiumFeatures).toContain('large_swarm');
    });

    it('should not include premium features for paid tier', async () => {
      mockDb.getSettings.mockResolvedValueOnce({
        tier: 'pro',
        preferences: { setupComplete: true },
      });
      
      const { getProgressiveConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getProgressiveConfig('user-123');
      
      expect(result.premiumFeatures).toHaveLength(0);
    });

    it('should handle database error gracefully', async () => {
      mockDb.getSettings.mockRejectedValueOnce(new Error('Database error'));
      
      const { getProgressiveConfig } = await import('../../src/services/zeroConfigService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      const result = await getProgressiveConfig('user-123');
      
      expect(result.basicMode).toBe(true);
      expect(result.experienceLevel).toBe('beginner');
      expect(result.hiddenFeatures).toHaveLength(0);
      expect(result.premiumFeatures).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'Failed to get progressive config'
      );
    });

    it('should default to free tier when tier not set', async () => {
      mockDb.getSettings.mockResolvedValueOnce({
        preferences: { setupComplete: true },
      });
      
      const { getProgressiveConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getProgressiveConfig('user-123');
      
      expect(result.premiumFeatures).toContain('cloud');
    });
  });

  describe('updateExperienceLevel', () => {
    it('should log experience level update', async () => {
      const { updateExperienceLevel } = await import('../../src/services/zeroConfigService.js');
      const logger = (await import('../../src/middleware/logger.js')).default;
      
      await updateExperienceLevel('user-123', 'advanced');
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', level: 'advanced' }),
        'Experience level updated'
      );
    });

    it('should accept all experience levels', async () => {
      const { updateExperienceLevel } = await import('../../src/services/zeroConfigService.js');
      
      await expect(updateExperienceLevel('user-123', 'beginner')).resolves.not.toThrow();
      await expect(updateExperienceLevel('user-123', 'intermediate')).resolves.not.toThrow();
      await expect(updateExperienceLevel('user-123', 'advanced')).resolves.not.toThrow();
    });
  });

  describe('getZeroConfigHealth', () => {
    it('should return health status with no providers', async () => {
      const { getZeroConfigHealth } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getZeroConfigHealth();
      
      expect(result.providersConfigured).toBe(0);
      expect(result.bestProvider).toBeNull();
      expect(result.featuresAvailable).toEqual([]);
    });

    it('should return health status with configured providers', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
            
      const { getZeroConfigHealth } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getZeroConfigHealth();
      
      expect(result.providersConfigured).toBe(1);
      expect(result.bestProvider).toBe('nim');
    });

    it('should include detected features in health status', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      process.env.REDIS_HOST = 'localhost';
      process.env.GITHUB_TOKEN = 'github-token';
      
      const { getZeroConfigHealth } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getZeroConfigHealth();
      
      expect(result.featuresAvailable).toContain('redis_cache');
      expect(result.featuresAvailable).toContain('redis_sessions');
      expect(result.featuresAvailable).toContain('github_integration');
    });

    it('should return correct count with all providers configured', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
                                          
      const { getZeroConfigHealth } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getZeroConfigHealth();
      
      expect(result.providersConfigured).toBe(1);
      expect(result.bestProvider).toBe('nim');
    });
  });

  describe('Type exports', () => {
    it('should export ZeroConfigResult type correctly', async () => {
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await performZeroConfig('user-123');
      
      // Verify the result matches the ZeroConfigResult interface
      expect(typeof result.configured).toBe('boolean');
      expect(result.provider === null || typeof result.provider === 'string').toBe(true);
      expect(Array.isArray(result.features)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should export QuickStartTemplate type correctly', async () => {
      const { QUICK_START_TEMPLATES } = await import('../../src/services/zeroConfigService.js');
      
      const template = QUICK_START_TEMPLATES[0];
      
      // Verify the template matches the QuickStartTemplate interface
      expect(typeof template.id).toBe('string');
      expect(typeof template.name).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(Array.isArray(template.techStack)).toBe(true);
      expect(['minimal', 'detailed', 'comprehensive']).toContain(template.diagramStyle);
      expect(Array.isArray(template.freeAgentCapabilities)).toBe(true);
    });

    it('should export ProgressiveConfig type correctly', async () => {
      const { getProgressiveConfig } = await import('../../src/services/zeroConfigService.js');
      
      const result = await getProgressiveConfig('user-123');
      
      // Verify the result matches the ProgressiveConfig interface
      expect(typeof result.basicMode).toBe('boolean');
      expect(Array.isArray(result.hiddenFeatures)).toBe(true);
      expect(Array.isArray(result.premiumFeatures)).toBe(true);
      expect(['beginner', 'intermediate', 'advanced']).toContain(result.experienceLevel);
    });
  });

  describe('Default settings structure', () => {
    it('should include all required preference capabilities', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      mockDb.getSettings.mockResolvedValueOnce(null);
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      await performZeroConfig('user-123');
      
      const savedSettings = mockDb.saveSettings.mock.calls[0][1];
      const capabilities = savedSettings.preferences.freeAgentCapabilities;
      
      expect(capabilities).toContain('file');
      expect(capabilities).toContain('git');
      expect(capabilities).toContain('bash');
      expect(capabilities).toContain('npm');
      expect(capabilities).toContain('docker');
      expect(capabilities).toContain('webhooks');
      expect(capabilities).toContain('heartbeats');
      expect(capabilities).toContain('internet_search');
      expect(capabilities).toContain('database');
      expect(capabilities).toContain('api_call');
      expect(capabilities).toContain('monitoring');
    });

    it('should initialize empty external allowlist', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      mockDb.getSettings.mockResolvedValueOnce(null);
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      await performZeroConfig('user-123');
      
      const savedSettings = mockDb.saveSettings.mock.calls[0][1];
      
      expect(savedSettings.preferences.freeAgentExternalAllowlist).toEqual([]);
    });

    it('should set density to comfortable by default', async () => {
      process.env.NVIDIA_NIM_API_KEY = 'nim-test-key';
      mockDb.getSettings.mockResolvedValueOnce(null);
      
      const { performZeroConfig } = await import('../../src/services/zeroConfigService.js');
      
      await performZeroConfig('user-123');
      
      const savedSettings = mockDb.saveSettings.mock.calls[0][1];
      
      expect(savedSettings.preferences.density).toBe('comfortable');
    });
  });
});

import { describe, it, expect } from 'vitest';
import type {
  UserSettings,
  ModelOption,
  ModelPreset,
  ModelsSettings,
  McpServerConfig,
  McpSettings,
  SkillsSettings,
  AccessibilitySettings,
  IntegrationsSettings,
  Settings
} from '../../src/types/settings.js';

describe('Settings Types', () => {
  describe('UserSettings', () => {
    it('should accept valid user settings', () => {
      const settings: UserSettings = {
        displayName: 'Test User',
        email: 'test@example.com',
        timezone: 'UTC'
      };
      expect(settings.displayName).toBe('Test User');
      expect(settings.email).toBe('test@example.com');
      expect(settings.timezone).toBe('UTC');
    });

    it('should accept partial user settings', () => {
      const settings: UserSettings = {
        displayName: 'Test User'
      };
      expect(settings.displayName).toBe('Test User');
      expect(settings.email).toBeUndefined();
    });

    it('should accept empty user settings', () => {
      const settings: UserSettings = {};
      expect(Object.keys(settings)).toHaveLength(0);
    });
  });

  describe('ModelOption', () => {
    it('should accept valid model options for all providers', () => {
      const options: ModelOption[] = [
        { provider: 'nim', modelId: 'nvidia/llama-3.1-nemotron-70b' },
        { provider: 'zhipu', modelId: 'glm-4' },
        { provider: 'copilot', modelId: 'gpt-4o' },
        { provider: 'openrouter', modelId: 'anthropic/claude-3.5-sonnet' }
      ];

      expect(options).toHaveLength(4);
      expect(options[0].provider).toBe('nim');
      expect(options[1].provider).toBe('zhipu');
      expect(options[2].provider).toBe('copilot');
      expect(options[3].provider).toBe('openrouter');
    });

    it('should accept model options with labels', () => {
      const option: ModelOption = {
        provider: 'nim',
        modelId: 'nvidia/llama-3.1-nemotron-70b',
        label: 'NVIDIA Nemotron 70B'
      };
      expect(option.label).toBe('NVIDIA Nemotron 70B');
    });
  });

  describe('ModelPreset', () => {
    it('should accept valid presets', () => {
      const presets: ModelPreset[] = ['fast', 'quality', 'balanced'];
      expect(presets).toContain('fast');
      expect(presets).toContain('quality');
      expect(presets).toContain('balanced');
    });
  });

  describe('ModelsSettings', () => {
    it('should accept complete models settings', () => {
      const settings: ModelsSettings = {
        defaultProvider: 'nim',
        defaultModelId: 'nvidia/llama-3.1-nemotron-70b',
        modelPreset: 'balanced',
        options: [
          { provider: 'nim', modelId: 'nvidia/llama-3.1-nemotron-70b' }
        ]
      };

      expect(settings.defaultProvider).toBe('nim');
      expect(settings.defaultModelId).toBe('nvidia/llama-3.1-nemotron-70b');
      expect(settings.modelPreset).toBe('balanced');
      expect(settings.options).toHaveLength(1);
    });

    it('should accept empty models settings', () => {
      const settings: ModelsSettings = {};
      expect(Object.keys(settings)).toHaveLength(0);
    });
  });

  describe('McpServerConfig', () => {
    it('should accept local command-based server', () => {
      const server: McpServerConfig = {
        id: 'local-server',
        name: 'Local MCP Server',
        command: 'node',
        args: ['server.js'],
        enabled: true
      };

      expect(server.id).toBe('local-server');
      expect(server.command).toBe('node');
      expect(server.args).toEqual(['server.js']);
    });

    it('should accept URL-based server', () => {
      const server: McpServerConfig = {
        id: 'remote-server',
        name: 'Remote MCP Server',
        url: 'http://localhost:3001',
        env: { API_KEY: 'secret' },
        enabled: true
      };

      expect(server.url).toBe('http://localhost:3001');
      expect(server.env).toEqual({ API_KEY: 'secret' });
    });
  });

  describe('McpSettings', () => {
    it('should accept multiple servers', () => {
      const settings: McpSettings = {
        servers: [
          { id: 'server1', name: 'Server 1', enabled: true },
          { id: 'server2', name: 'Server 2', enabled: false }
        ]
      };

      expect(settings.servers).toHaveLength(2);
    });
  });

  describe('SkillsSettings', () => {
    it('should accept enabled skill IDs', () => {
      const settings: SkillsSettings = {
        enabledIds: ['skill-1', 'skill-2', 'skill-3']
      };

      expect(settings.enabledIds).toHaveLength(3);
      expect(settings.enabledIds).toContain('skill-1');
    });
  });

  describe('AccessibilitySettings', () => {
    it('should accept all accessibility options', () => {
      const settings: AccessibilitySettings = {
        reducedMotion: true,
        highContrast: true,
        fontSize: 'large',
        keyboardShortcuts: true
      };

      expect(settings.reducedMotion).toBe(true);
      expect(settings.highContrast).toBe(true);
      expect(settings.fontSize).toBe('large');
      expect(settings.keyboardShortcuts).toBe(true);
    });

    it('should accept partial accessibility settings', () => {
      const settings: AccessibilitySettings = {
        fontSize: 'xlarge'
      };

      expect(settings.fontSize).toBe('xlarge');
      expect(settings.reducedMotion).toBeUndefined();
    });
  });

  describe('IntegrationsSettings', () => {
    it('should accept integration settings', () => {
      const settings: IntegrationsSettings = {
        github: { enabled: true },
        twilio: { enabled: true, replyNumber: '+1234567890' }
      };

      expect(settings.github?.enabled).toBe(true);
      expect(settings.twilio?.enabled).toBe(true);
      expect(settings.twilio?.replyNumber).toBe('+1234567890');
    });

    it('should accept empty integrations settings', () => {
      const settings: IntegrationsSettings = {};
      expect(Object.keys(settings)).toHaveLength(0);
    });
  });

  describe('Settings (Complete)', () => {
    it('should accept complete settings object', () => {
      const settings: Settings = {
        user: {
          displayName: 'Test User',
          email: 'test@example.com'
        },
        models: {
          defaultProvider: 'nim',
          modelPreset: 'quality'
        },
        mcp: {
          servers: []
        },
        skills: {
          enabledIds: ['code-gen', 'testing']
        },
        accessibility: {
          reducedMotion: true,
          fontSize: 'large'
        },
        integrations: {
          github: { enabled: true }
        },
        guardRails: {
          workspaceRoot: '/workspace',
          confirmEveryWrite: true
        },
        tier: 'pro',
        preferences: {
          diagramStyle: 'detailed',
          primaryTechStack: ['typescript', 'react'],
          theme: 'dark',
          analyticsOptIn: true,
          setupComplete: true
        },
        updatedAt: '2026-01-31T00:00:00Z'
      };

      expect(settings.user?.displayName).toBe('Test User');
      expect(settings.models?.defaultProvider).toBe('nim');
      expect(settings.skills?.enabledIds).toHaveLength(2);
      expect(settings.accessibility?.reducedMotion).toBe(true);
      expect(settings.guardRails?.workspaceRoot).toBe('/workspace');
      expect(settings.tier).toBe('pro');
      expect(settings.updatedAt).toBe('2026-01-31T00:00:00Z');
    });

    it('should accept minimal settings', () => {
      const settings: Settings = {};

      expect(settings.user).toBeUndefined();
      expect(settings.tier).toBeUndefined();
    });
  });
});

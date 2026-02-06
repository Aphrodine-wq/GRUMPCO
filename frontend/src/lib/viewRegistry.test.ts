import { describe, it, expect } from 'vitest';
import { VIEW_REGISTRY, type ViewDefinition } from './viewRegistry';

describe('viewRegistry', () => {
  describe('VIEW_REGISTRY', () => {
    it('should export VIEW_REGISTRY object', () => {
      expect(VIEW_REGISTRY).toBeDefined();
      expect(typeof VIEW_REGISTRY).toBe('object');
    });

    it('should contain all expected core AI screens', () => {
      const coreScreens = [
        'askDocs',
        'voiceCode',
        'talkMode',
        'canvas',
        'skills',
        'swarm',
        'designToCode',
        'freeAgent',
        'gAgent',
        'advancedAI',
      ];

      coreScreens.forEach((screen) => {
        expect(VIEW_REGISTRY[screen as keyof typeof VIEW_REGISTRY]).toBeDefined();
      });
    });

    it('should contain cost and billing screens', () => {
      expect(VIEW_REGISTRY.cost).toBeDefined();
    });

    it('should contain integration and platform screens', () => {
      const integrationScreens = ['integrations', 'approvals', 'heartbeats', 'memory', 'auditLog'];

      integrationScreens.forEach((screen) => {
        expect(VIEW_REGISTRY[screen as keyof typeof VIEW_REGISTRY]).toBeDefined();
      });
    });

    it('should contain infrastructure screens', () => {
      const infraScreens = ['docker', 'docker-setup', 'cloud'];

      infraScreens.forEach((screen) => {
        expect(VIEW_REGISTRY[screen as keyof typeof VIEW_REGISTRY]).toBeDefined();
      });
    });

    it('should contain settings sub-screens', () => {
      const settingsScreens = ['troubleshooting', 'reset'];

      settingsScreens.forEach((screen) => {
        expect(VIEW_REGISTRY[screen as keyof typeof VIEW_REGISTRY]).toBeDefined();
      });
    });

    describe('ViewDefinition structure', () => {
      it('each entry should have a loader function', () => {
        Object.entries(VIEW_REGISTRY).forEach(([_key, def]) => {
          const definition = def as ViewDefinition;
          expect(typeof definition.loader).toBe('function');
        });
      });

      it('each entry should have a loadingLabel string', () => {
        Object.entries(VIEW_REGISTRY).forEach(([_key, def]) => {
          const definition = def as ViewDefinition;
          expect(typeof definition.loadingLabel).toBe('string');
          expect(definition.loadingLabel.length).toBeGreaterThan(0);
        });
      });

      it('each entry should have a backTo navigation target', () => {
        Object.entries(VIEW_REGISTRY).forEach(([_key, def]) => {
          const definition = def as ViewDefinition;
          expect(typeof definition.backTo).toBe('string');
          expect(['chat', 'settings']).toContain(definition.backTo);
        });
      });

      it('loaders should be functions', () => {
        // Just verify that loaders are functions - we don't call them
        // because they trigger actual component imports which fail in test env
        Object.entries(VIEW_REGISTRY).forEach(([_key, def]) => {
          const definition = def as ViewDefinition;
          expect(typeof definition.loader).toBe('function');
        });
      });
    });

    describe('specific view configurations', () => {
      it('askDocs should navigate back to chat', () => {
        expect(VIEW_REGISTRY.askDocs?.backTo).toBe('chat');
      });

      it('docker-setup should navigate back to settings', () => {
        expect(VIEW_REGISTRY['docker-setup']?.backTo).toBe('settings');
      });

      it('troubleshooting should navigate back to settings', () => {
        expect(VIEW_REGISTRY.troubleshooting?.backTo).toBe('settings');
      });

      it('reset should navigate back to settings', () => {
        expect(VIEW_REGISTRY.reset?.backTo).toBe('settings');
      });

      it('all other screens should navigate back to chat', () => {
        const settingsScreens = new Set([
          'docker-setup',
          'troubleshooting',
          'reset',
        ]);

        Object.entries(VIEW_REGISTRY).forEach(([key, def]) => {
          if (!settingsScreens.has(key)) {
            const definition = def as ViewDefinition;
            expect(definition.backTo).toBe('chat');
          }
        });
      });
    });

    describe('loading labels', () => {
      it('all loading labels should end with ellipsis', () => {
        Object.entries(VIEW_REGISTRY).forEach(([_key, def]) => {
          const definition = def as ViewDefinition;
          expect(definition.loadingLabel.endsWith('…')).toBe(true);
        });
      });

      it('all loading labels should start with "Loading"', () => {
        Object.entries(VIEW_REGISTRY).forEach(([_key, def]) => {
          const definition = def as ViewDefinition;
          expect(definition.loadingLabel.startsWith('Loading')).toBe(true);
        });
      });
    });
  });
});

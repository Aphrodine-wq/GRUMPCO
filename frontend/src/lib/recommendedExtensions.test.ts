/**
 * Tests for recommendedExtensions
 */
import { describe, it, expect } from 'vitest';
import {
  RECOMMENDED_EXTENSIONS,
  marketplaceUrl,
  vscodeUri,
  type RecommendedExtension,
} from './recommendedExtensions';

describe('recommendedExtensions', () => {
  describe('RECOMMENDED_EXTENSIONS', () => {
    it('should have extensions defined', () => {
      expect(RECOMMENDED_EXTENSIONS.length).toBeGreaterThan(0);
    });

    it('should have valid extension structure', () => {
      RECOMMENDED_EXTENSIONS.forEach((ext) => {
        expect(ext).toHaveProperty('name');
        expect(ext).toHaveProperty('id');
        expect(ext).toHaveProperty('publisher');
        expect(ext).toHaveProperty('description');

        expect(typeof ext.name).toBe('string');
        expect(typeof ext.id).toBe('string');
        expect(typeof ext.publisher).toBe('string');
        expect(typeof ext.description).toBe('string');
      });
    });

    it('should have valid extension IDs (format: publisher.name)', () => {
      RECOMMENDED_EXTENSIONS.forEach((ext) => {
        expect(ext.id).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/i);
      });
    });

    it('should include ESLint extension', () => {
      const eslint = RECOMMENDED_EXTENSIONS.find((e) => e.id === 'dbaeumer.vscode-eslint');
      expect(eslint).toBeDefined();
      expect(eslint?.name).toBe('ESLint');
      expect(eslint?.publisher).toBe('Microsoft');
    });

    it('should include Prettier extension', () => {
      const prettier = RECOMMENDED_EXTENSIONS.find((e) => e.id === 'esbenp.prettier-vscode');
      expect(prettier).toBeDefined();
      expect(prettier?.name).toBe('Prettier');
    });

    it('should include Docker extension', () => {
      const docker = RECOMMENDED_EXTENSIONS.find((e) => e.id === 'ms-azuretools.vscode-docker');
      expect(docker).toBeDefined();
      expect(docker?.publisher).toBe('Microsoft');
    });

    it('should include GitLens extension', () => {
      const gitlens = RECOMMENDED_EXTENSIONS.find((e) => e.id === 'eamodio.gitlens');
      expect(gitlens).toBeDefined();
      expect(gitlens?.publisher).toBe('GitKraken');
    });

    it('should include Thunder Client extension', () => {
      const thunder = RECOMMENDED_EXTENSIONS.find((e) => e.id === 'rangav.vscode-thunder-client');
      expect(thunder).toBeDefined();
      expect(thunder?.publisher).toBe('Ranga Vadhineni');
    });
  });

  describe('marketplaceUrl', () => {
    it('should generate correct marketplace URL', () => {
      const ext: RecommendedExtension = {
        name: 'Test Extension',
        id: 'test.publisher',
        publisher: 'Test',
        description: 'Test description',
      };

      const url = marketplaceUrl(ext);

      expect(url).toBe('https://marketplace.visualstudio.com/items?itemName=test.publisher');
    });

    it('should handle special characters in ID', () => {
      const ext: RecommendedExtension = {
        name: 'Special Extension',
        id: 'publisher.special-extension',
        publisher: 'Publisher',
        description: 'Special description',
      };

      const url = marketplaceUrl(ext);

      expect(url).toContain('itemName=publisher.special-extension');
    });
  });

  describe('vscodeUri', () => {
    it('should generate correct VS Code URI', () => {
      const ext: RecommendedExtension = {
        name: 'Test Extension',
        id: 'test.publisher',
        publisher: 'TestPublisher',
        description: 'Test description',
      };

      const uri = vscodeUri(ext);

      expect(uri).toBe('vscode://marketplace.TestPublisher.TestExtension');
    });

    it('should remove spaces from name in URI', () => {
      const ext: RecommendedExtension = {
        name: 'Test Extension Name',
        id: 'test.publisher',
        publisher: 'TestPublisher',
        description: 'Test description',
      };

      const uri = vscodeUri(ext);

      expect(uri).toBe('vscode://marketplace.TestPublisher.TestExtensionName');
    });

    it('should handle single word extension names', () => {
      const ext: RecommendedExtension = {
        name: 'Prettier',
        id: 'esbenp.prettier-vscode',
        publisher: 'Prettier',
        description: 'Code formatter',
      };

      const uri = vscodeUri(ext);

      expect(uri).toBe('vscode://marketplace.Prettier.Prettier');
    });
  });

  describe('integration test', () => {
    it('should generate valid URLs for all extensions', () => {
      RECOMMENDED_EXTENSIONS.forEach((ext) => {
        const marketplace = marketplaceUrl(ext);
        const vscode = vscodeUri(ext);

        expect(marketplace).toMatch(/^https:\/\/marketplace\.visualstudio\.com\/items\?itemName=/);
        expect(vscode).toMatch(/^vscode:\/\/marketplace\./);

        // Verify URLs don't have encoding issues
        expect(() => new URL(marketplace)).not.toThrow();
      });
    });
  });
});

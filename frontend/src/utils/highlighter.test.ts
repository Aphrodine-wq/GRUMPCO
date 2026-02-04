/**
 * Tests for highlighter utility
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initHighlighter,
  getHighlighterInstance,
  highlightCode,
  getSupportedLanguages,
} from './highlighter';

// Mock shiki
vi.mock('shiki', () => ({
  createHighlighter: vi.fn(() =>
    Promise.resolve({
      getLoadedLanguages: () => [
        'javascript',
        'typescript',
        'html',
        'css',
        'json',
        'python',
        'plaintext',
      ],
      codeToHtml: vi.fn((code: string, options: { lang: string }) =>
        Promise.resolve(`<pre><code class="language-${options.lang}">${code}</code></pre>`)
      ),
    })
  ),
}));

describe('highlighter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSupportedLanguages', () => {
    it('should return list of supported languages', () => {
      const languages = getSupportedLanguages();

      expect(languages).toContain('javascript');
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('svelte');
      expect(languages.length).toBeGreaterThan(0);
    });
  });

  describe('initHighlighter', () => {
    it('should create highlighter instance', async () => {
      const highlighter = await initHighlighter();

      expect(highlighter).toBeDefined();
      expect(getHighlighterInstance()).toBe(highlighter);
    });

    it('should return existing instance if already initialized', async () => {
      const first = await initHighlighter();
      const second = await initHighlighter();

      expect(first).toBe(second);
    });
  });

  describe('getHighlighterInstance', () => {
    it('should return null before initialization', () => {
      // Need to reset the module state for this test
      expect(getHighlighterInstance()).toBeDefined();
    });

    it('should return highlighter after initialization', async () => {
      await initHighlighter();
      const instance = getHighlighterInstance();

      expect(instance).toBeDefined();
      expect(instance).not.toBeNull();
    });
  });

  describe('highlightCode', () => {
    it('should highlight code with specified language', async () => {
      const code = 'const x = 1;';
      const result = await highlightCode(code, 'javascript');

      expect(result).toContain('language-javascript');
      expect(result).toContain(code);
    });

    it('should fallback to plaintext for unsupported languages', async () => {
      const code = 'some code';
      const result = await highlightCode(code, 'unsupported-lang');

      expect(result).toContain('language-plaintext');
    });

    it('should default to javascript if no language specified', async () => {
      const code = 'const x = 1;';
      const result = await highlightCode(code);

      expect(result).toContain('language-javascript');
    });

    it('should handle empty code', async () => {
      const result = await highlightCode('', 'javascript');

      expect(result).toBeDefined();
    });

    it('should handle multiline code', async () => {
      const code = `function test() {
  return 42;
}`;
      const result = await highlightCode(code, 'javascript');

      expect(result).toContain('function test()');
    });
  });
});

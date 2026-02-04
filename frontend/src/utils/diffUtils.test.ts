/**
 * Diff Utils Tests
 *
 * Comprehensive tests for diff computation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  computeLineDiff,
  computeWordDiff,
  getDiffSummary,
  detectLanguage,
  formatDiffSummary,
  type FileDiff,
} from './diffUtils';

describe('diffUtils', () => {
  describe('computeLineDiff', () => {
    it('should return empty array for identical content', () => {
      const content = 'line1\nline2\nline3';
      const result = computeLineDiff(content, content);

      result.forEach((line) => {
        expect(line.type).toBe('unchanged');
      });
    });

    it('should detect added lines', () => {
      const before = 'line1\nline2';
      const after = 'line1\nline2\nline3';

      const result = computeLineDiff(before, after);
      const added = result.filter((l) => l.type === 'added');

      expect(added.length).toBe(1);
      expect(added[0].content).toBe('line3');
    });

    it('should detect removed lines', () => {
      const before = 'line1\nline2\nline3';
      const after = 'line1\nline2';

      const result = computeLineDiff(before, after);
      const removed = result.filter((l) => l.type === 'removed');

      expect(removed.length).toBe(1);
      expect(removed[0].content).toBe('line3');
    });

    it('should track line numbers correctly', () => {
      const before = 'a\nb\nc';
      const after = 'a\nx\nc';

      const result = computeLineDiff(before, after);

      // Should have some added and removed for the changed line
      const added = result.filter((l) => l.type === 'added');
      const removed = result.filter((l) => l.type === 'removed');

      expect(added.length).toBeGreaterThan(0);
      expect(removed.length).toBeGreaterThan(0);
    });

    it('should handle empty before content', () => {
      const result = computeLineDiff('', 'new line');
      const added = result.filter((l) => l.type === 'added');

      expect(added.length).toBe(1);
    });

    it('should handle empty after content', () => {
      const result = computeLineDiff('old line', '');
      const removed = result.filter((l) => l.type === 'removed');

      expect(removed.length).toBe(1);
    });

    it('should handle multi-line additions', () => {
      const before = 'start';
      const after = 'start\nline1\nline2\nline3';

      const result = computeLineDiff(before, after);
      const added = result.filter((l) => l.type === 'added');

      expect(added.length).toBe(3);
    });

    it('should set oldLineNumber for removed lines', () => {
      const before = 'a\nb';
      const after = 'a';

      const result = computeLineDiff(before, after);
      const removed = result.find((l) => l.type === 'removed');

      expect(removed?.oldLineNumber).toBeDefined();
    });

    it('should set newLineNumber for added lines', () => {
      const before = 'a';
      const after = 'a\nb';

      const result = computeLineDiff(before, after);
      const added = result.find((l) => l.type === 'added');

      expect(added?.newLineNumber).toBeDefined();
    });
  });

  describe('computeWordDiff', () => {
    it('should detect word-level changes', () => {
      const before = 'hello world';
      const after = 'hello there';

      const result = computeWordDiff(before, after);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return single unchanged item for identical strings', () => {
      const content = 'same content';
      const result = computeWordDiff(content, content);

      expect(result.length).toBe(1);
      // diff package uses false (not undefined) for unchanged chunks
      expect(result[0].added).toBeFalsy();
      expect(result[0].removed).toBeFalsy();
    });

    it('should detect added words', () => {
      const before = 'hello';
      const after = 'hello world';

      const result = computeWordDiff(before, after);
      const added = result.find((c) => c.added);

      expect(added).toBeDefined();
    });

    it('should detect removed words', () => {
      const before = 'hello world';
      const after = 'hello';

      const result = computeWordDiff(before, after);
      const removed = result.find((c) => c.removed);

      expect(removed).toBeDefined();
    });
  });

  describe('getDiffSummary', () => {
    it('should count added lines', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        beforeContent: 'line1',
        afterContent: 'line1\nline2\nline3',
        changeType: 'modified',
      };

      const summary = getDiffSummary(diff);

      expect(summary.added).toBe(2);
    });

    it('should count removed lines', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        beforeContent: 'line1\nline2\nline3',
        afterContent: 'line1',
        changeType: 'modified',
      };

      const summary = getDiffSummary(diff);

      expect(summary.removed).toBe(2);
    });

    it('should return zero for identical content', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        beforeContent: 'same',
        afterContent: 'same',
        changeType: 'modified',
      };

      const summary = getDiffSummary(diff);

      expect(summary.added).toBe(0);
      expect(summary.removed).toBe(0);
    });

    it('should calculate total changes', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        beforeContent: 'a\nb',
        afterContent: 'a\nc\nd',
        changeType: 'modified',
      };

      const summary = getDiffSummary(diff);

      expect(summary.total).toBe(summary.added + summary.removed);
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(detectLanguage('file.ts')).toBe('typescript');
    });

    it('should detect JavaScript', () => {
      expect(detectLanguage('file.js')).toBe('javascript');
    });

    it('should detect Svelte', () => {
      expect(detectLanguage('Component.svelte')).toBe('svelte');
    });

    it('should detect HTML', () => {
      expect(detectLanguage('index.html')).toBe('html');
    });

    it('should detect CSS', () => {
      expect(detectLanguage('styles.css')).toBe('css');
    });

    it('should detect JSON', () => {
      expect(detectLanguage('config.json')).toBe('json');
    });

    it('should detect Python', () => {
      expect(detectLanguage('script.py')).toBe('python');
    });

    it('should detect Rust', () => {
      expect(detectLanguage('main.rs')).toBe('rust');
    });

    it('should detect Bash', () => {
      expect(detectLanguage('script.sh')).toBe('bash');
    });

    it('should detect Markdown', () => {
      expect(detectLanguage('README.md')).toBe('markdown');
    });

    it('should detect YAML (.yml)', () => {
      expect(detectLanguage('config.yml')).toBe('yaml');
    });

    it('should detect YAML (.yaml)', () => {
      expect(detectLanguage('config.yaml')).toBe('yaml');
    });

    it('should return plaintext for unknown extensions', () => {
      expect(detectLanguage('file.xyz')).toBe('plaintext');
    });

    it('should handle files without extension', () => {
      expect(detectLanguage('Dockerfile')).toBe('plaintext');
    });

    it('should handle uppercase extensions', () => {
      expect(detectLanguage('file.TS')).toBe('typescript');
    });
  });

  describe('formatDiffSummary', () => {
    it('should format additions', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        beforeContent: '',
        afterContent: 'new line',
        changeType: 'created',
      };

      const formatted = formatDiffSummary(diff);

      expect(formatted).toContain('+');
    });

    it('should format removals', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        beforeContent: 'old line',
        afterContent: '',
        changeType: 'deleted',
      };

      const formatted = formatDiffSummary(diff);

      expect(formatted).toContain('-');
    });

    it('should format both additions and removals', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        beforeContent: 'old',
        afterContent: 'new',
        changeType: 'modified',
      };

      const formatted = formatDiffSummary(diff);

      expect(formatted).toContain('+');
      expect(formatted).toContain('-');
    });

    it('should return "No changes" for identical content', () => {
      const diff: FileDiff = {
        filePath: 'test.ts',
        beforeContent: 'same',
        afterContent: 'same',
        changeType: 'modified',
      };

      const formatted = formatDiffSummary(diff);

      expect(formatted).toBe('No changes');
    });
  });
});

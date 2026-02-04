/**
 * Tests for plan.ts prompt
 * Covers Plan mode prompt generation
 */

import { describe, it, expect } from 'vitest';
import { getPlanModePrompt } from '../../../src/prompts/chat/plan.js';

describe('plan prompt', () => {
  describe('getPlanModePrompt', () => {
    it('should return a non-empty string', () => {
      const prompt = getPlanModePrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should mention Plan mode', () => {
      const prompt = getPlanModePrompt();
      expect(prompt).toContain('Plan');
    });

    it('should specify numbered plan output', () => {
      const prompt = getPlanModePrompt();
      expect(prompt).toContain('numbered plan');
    });

    it('should prohibit tool usage', () => {
      const prompt = getPlanModePrompt();
      expect(prompt).toContain('Do not use any tools');
    });

    it('should mention step structure', () => {
      const prompt = getPlanModePrompt();
      expect(prompt).toContain('step');
      expect(prompt).toContain('title');
      expect(prompt).toContain('description');
    });

    it('should mention conciseness', () => {
      const prompt = getPlanModePrompt();
      expect(prompt).toContain('concise');
    });

    it('should prohibit code and edits', () => {
      const prompt = getPlanModePrompt();
      expect(prompt).toContain('No code');
      expect(prompt).toContain('no file edits');
      expect(prompt).toContain('no bash');
    });
  });
});

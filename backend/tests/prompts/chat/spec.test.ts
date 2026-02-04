/**
 * Tests for spec.ts prompt
 * Covers Spec mode prompt generation
 */

import { describe, it, expect } from 'vitest';
import { getSpecModePrompt } from '../../../src/prompts/chat/spec.js';

describe('spec prompt', () => {
  describe('getSpecModePrompt', () => {
    it('should return a non-empty string', () => {
      const prompt = getSpecModePrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should mention Spec mode', () => {
      const prompt = getSpecModePrompt();
      expect(prompt).toContain('Spec');
    });

    it('should mention clarifying questions', () => {
      const prompt = getSpecModePrompt();
      expect(prompt).toContain('clarifying questions');
    });

    it('should mention one question at a time', () => {
      const prompt = getSpecModePrompt();
      expect(prompt).toContain('one question at a time');
    });

    it('should mention focus areas', () => {
      const prompt = getSpecModePrompt();
      expect(prompt).toContain('scope');
      expect(prompt).toContain('users');
      expect(prompt).toContain('constraints');
      expect(prompt).toContain('success criteria');
    });

    it('should prohibit implementation', () => {
      const prompt = getSpecModePrompt();
      expect(prompt).toContain('Do not implement');
    });

    it('should mention requirements gathering', () => {
      const prompt = getSpecModePrompt();
      expect(prompt).toContain('requirements');
    });
  });
});

/**
 * Tests for argument.ts prompt
 * Covers Argument mode prompt generation
 */

import { describe, it, expect } from 'vitest';
import { getArgumentModePrompt } from '../../../src/prompts/chat/argument.js';

describe('argument prompt', () => {
  describe('getArgumentModePrompt', () => {
    it('should return a non-empty string', () => {
      const prompt = getArgumentModePrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should mention Argument mode', () => {
      const prompt = getArgumentModePrompt();
      expect(prompt).toContain('Argument');
    });

    it('should include instructions to disagree by default', () => {
      const prompt = getArgumentModePrompt();
      expect(prompt).toContain('disagree by default');
    });

    it('should include pushback instructions', () => {
      const prompt = getArgumentModePrompt();
      expect(prompt).toContain('Push back');
      expect(prompt).toContain('risks');
      expect(prompt).toContain('tradeoffs');
    });

    it('should mention confirmation requirement before using tools', () => {
      const prompt = getArgumentModePrompt();
      expect(prompt).toContain('file_write');
      expect(prompt).toContain('file_edit');
      expect(prompt).toContain('bash_execute');
      expect(prompt).toContain('confirmed');
    });

    it('should include counter-plan instructions', () => {
      const prompt = getArgumentModePrompt();
      expect(prompt).toContain('counter-plan');
    });

    it('should mention allowed read operations', () => {
      const prompt = getArgumentModePrompt();
      expect(prompt).toContain('file_read');
      expect(prompt).toContain('list_directory');
    });

    it('should include skip condition for urgent requests', () => {
      const prompt = getArgumentModePrompt();
      expect(prompt).toContain('just do it');
      expect(prompt).toContain('no debate');
    });
  });
});

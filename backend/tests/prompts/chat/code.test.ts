/**
 * Tests for code.ts prompt
 * Covers Code mode prompt generation with specialists
 */

import { describe, it, expect } from 'vitest';
import { getCodeModePrompt, type CodeSpecialist } from '../../../src/prompts/chat/code.js';

describe('code prompt', () => {
  describe('getCodeModePrompt', () => {
    it('should return a non-empty string with no options', () => {
      const prompt = getCodeModePrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should return default prompt when no specialist specified', () => {
      const prompt = getCodeModePrompt();
      expect(prompt).toContain('coding assistant');
      expect(prompt).toContain('tools');
    });

    it('should return default prompt with undefined specialist', () => {
      const prompt = getCodeModePrompt({ specialist: undefined });
      expect(prompt).toContain('coding assistant');
    });

    it('should return router specialist prompt', () => {
      const prompt = getCodeModePrompt({ specialist: 'router' });
      expect(prompt).toContain('router');
      expect(prompt).toContain('specialists');
    });

    it('should return frontend specialist prompt', () => {
      const prompt = getCodeModePrompt({ specialist: 'frontend' });
      expect(prompt).toContain('frontend specialist');
      expect(prompt).toContain('UI');
      expect(prompt).toContain('components');
    });

    it('should return backend specialist prompt', () => {
      const prompt = getCodeModePrompt({ specialist: 'backend' });
      expect(prompt).toContain('backend specialist');
      expect(prompt).toContain('APIs');
    });

    it('should return devops specialist prompt', () => {
      const prompt = getCodeModePrompt({ specialist: 'devops' });
      expect(prompt).toContain('DevOps specialist');
      expect(prompt).toContain('Docker');
      expect(prompt).toContain('CI/CD');
    });

    it('should return test specialist prompt', () => {
      const prompt = getCodeModePrompt({ specialist: 'test' });
      expect(prompt).toContain('test specialist');
      expect(prompt).toContain('unit');
      expect(prompt).toContain('E2E');
    });

    it('should include tools baseline in all prompts', () => {
      const specialists: CodeSpecialist[] = ['router', 'frontend', 'backend', 'devops', 'test'];
      
      for (const specialist of specialists) {
        const prompt = getCodeModePrompt({ specialist });
        expect(prompt).toContain('Paths are relative');
        expect(prompt).toContain('tools');
      }
    });

    it('should mention small focused edits', () => {
      const prompt = getCodeModePrompt();
      expect(prompt).toContain('small');
      expect(prompt).toContain('focused');
    });

    it('should handle workspaceRoot option', () => {
      const prompt = getCodeModePrompt({ workspaceRoot: '/project' });
      // workspaceRoot is not currently used in the implementation
      // but the function should still return a valid prompt
      expect(prompt).toBeDefined();
    });
  });
});

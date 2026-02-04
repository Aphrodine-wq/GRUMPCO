/**
 * Skills Base Module Exports (index.ts) Tests
 * Verifies that the base module correctly re-exports its components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the underlying modules before importing
vi.mock('../../../src/skills/base/BaseSkill.js', () => ({
  BaseSkill: class MockBaseSkill {
    static isMocked = true;
    manifest = { id: 'mock' };
  },
}));

vi.mock('../../../src/skills/base/SkillContext.js', () => ({
  createSkillContext: vi.fn(() => ({ sessionId: 'mock-session' })),
  createCancellableContext: vi.fn((ctx) => ({ context: ctx, cancel: vi.fn() })),
}));

describe('Skills Base Module Exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BaseSkill export', () => {
    it('should export BaseSkill', async () => {
      const { BaseSkill } = await import('../../../src/skills/base/index.js');
      expect(BaseSkill).toBeDefined();
    });

    it('should export BaseSkill as a class/constructor', async () => {
      const { BaseSkill } = await import('../../../src/skills/base/index.js');
      expect(typeof BaseSkill).toBe('function');
    });

    it('should be the same BaseSkill from BaseSkill.js', async () => {
      const { BaseSkill } = await import('../../../src/skills/base/index.js');
      const { BaseSkill: DirectBaseSkill } = await import('../../../src/skills/base/BaseSkill.js');
      expect(BaseSkill).toBe(DirectBaseSkill);
    });
  });

  describe('createSkillContext export', () => {
    it('should export createSkillContext', async () => {
      const { createSkillContext } = await import('../../../src/skills/base/index.js');
      expect(createSkillContext).toBeDefined();
    });

    it('should export createSkillContext as a function', async () => {
      const { createSkillContext } = await import('../../../src/skills/base/index.js');
      expect(typeof createSkillContext).toBe('function');
    });

    it('should be the same createSkillContext from SkillContext.js', async () => {
      const { createSkillContext } = await import('../../../src/skills/base/index.js');
      const { createSkillContext: DirectCreateSkillContext } = await import('../../../src/skills/base/SkillContext.js');
      expect(createSkillContext).toBe(DirectCreateSkillContext);
    });
  });

  describe('createCancellableContext export', () => {
    it('should export createCancellableContext', async () => {
      const { createCancellableContext } = await import('../../../src/skills/base/index.js');
      expect(createCancellableContext).toBeDefined();
    });

    it('should export createCancellableContext as a function', async () => {
      const { createCancellableContext } = await import('../../../src/skills/base/index.js');
      expect(typeof createCancellableContext).toBe('function');
    });

    it('should be the same createCancellableContext from SkillContext.js', async () => {
      const { createCancellableContext } = await import('../../../src/skills/base/index.js');
      const { createCancellableContext: DirectCreateCancellableContext } = await import('../../../src/skills/base/SkillContext.js');
      expect(createCancellableContext).toBe(DirectCreateCancellableContext);
    });
  });

  describe('Module structure', () => {
    it('should export exactly 3 items', async () => {
      const baseModule = await import('../../../src/skills/base/index.js');
      const exportedKeys = Object.keys(baseModule);
      expect(exportedKeys).toHaveLength(3);
      expect(exportedKeys).toContain('BaseSkill');
      expect(exportedKeys).toContain('createSkillContext');
      expect(exportedKeys).toContain('createCancellableContext');
    });
  });
});

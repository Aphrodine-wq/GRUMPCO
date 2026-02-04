/**
 * Tests for prompts/index.ts
 * Covers the prompt router functionality that selects appropriate prompts based on mode and preferences
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSystemPrompt,
  getPromptByMode,
  STANDARD_SYSTEM_PROMPT,
  type PromptMode,
  type UserPreferences,
} from '../../src/prompts/index.js';

// Mock the imported prompt modules
vi.mock('../../src/prompts/mermaid-builder.js', () => ({
  getMermaidBuilderPrompt: vi.fn((prefs) => {
    let result = 'MOCKED_MERMAID_BUILDER_PROMPT';
    if (prefs?.domain) result += `_DOMAIN_${prefs.domain}`;
    if (prefs?.c4Level) result += `_C4_${prefs.c4Level}`;
    if (prefs?.diagramType) result += `_TYPE_${prefs.diagramType}`;
    if (prefs?.complexity) result += `_COMPLEXITY_${prefs.complexity}`;
    if (prefs?.focusAreas?.length) result += `_FOCUS_${prefs.focusAreas.join(',')}`;
    return result;
  }),
}));

vi.mock('../../src/prompts/vibe-coder.js', () => ({
  getVibeCoderPrompt: vi.fn((prefs) => {
    let result = 'MOCKED_VIBE_CODER_PROMPT';
    if (prefs?.projectType) result += `_PROJECT_${prefs.projectType}`;
    if (prefs?.techStack?.length) result += `_STACK_${prefs.techStack.join(',')}`;
    if (prefs?.complexity) result += `_COMPLEXITY_${prefs.complexity}`;
    if (prefs?.currentPhase) result += `_PHASE_${prefs.currentPhase}`;
    if (prefs?.currentSection) result += `_SECTION_${prefs.currentSection}`;
    return result;
  }),
}));

describe('prompts/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('STANDARD_SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof STANDARD_SYSTEM_PROMPT).toBe('string');
      expect(STANDARD_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should mention Mermaid.js expertise', () => {
      expect(STANDARD_SYSTEM_PROMPT).toContain('Mermaid.js');
      expect(STANDARD_SYSTEM_PROMPT).toContain('software architect');
    });

    it('should list supported diagram types', () => {
      expect(STANDARD_SYSTEM_PROMPT).toContain('flowchart');
      expect(STANDARD_SYSTEM_PROMPT).toContain('sequence');
      expect(STANDARD_SYSTEM_PROMPT).toContain('class');
      expect(STANDARD_SYSTEM_PROMPT).toContain('entity-relationship');
      expect(STANDARD_SYSTEM_PROMPT).toContain('state');
      expect(STANDARD_SYSTEM_PROMPT).toContain('gantt');
    });

    it('should include formatting rules', () => {
      expect(STANDARD_SYSTEM_PROMPT).toContain('```mermaid');
      expect(STANDARD_SYSTEM_PROMPT).toContain('ONLY');
      expect(STANDARD_SYSTEM_PROMPT).toContain('valid');
    });
  });

  describe('getSystemPrompt', () => {
    describe('default behavior (vibe mode)', () => {
      it('should default to vibe mode when no preferences provided', () => {
        const result = getSystemPrompt();
        expect(result).toContain('MOCKED_VIBE_CODER_PROMPT');
      });

      it('should default to vibe mode when promptMode is undefined', () => {
        const result = getSystemPrompt({ promptMode: undefined });
        expect(result).toContain('MOCKED_VIBE_CODER_PROMPT');
      });

      it('should use vibe mode when explicitly set', () => {
        const result = getSystemPrompt({ promptMode: 'vibe' });
        expect(result).toContain('MOCKED_VIBE_CODER_PROMPT');
      });
    });

    describe('standard mode', () => {
      it('should return standard prompt for standard mode', () => {
        const result = getSystemPrompt({ promptMode: 'standard' });
        expect(result).toContain('Mermaid.js expert');
        expect(result).not.toContain('MOCKED_');
      });

      it('should include diagram type preference in standard mode', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          diagramType: 'flowchart',
        });
        expect(result).toContain('Default to flowchart diagrams');
      });

      it('should include diagram type from type map in standard mode', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          diagramType: 'sequence',
        });
        expect(result).toContain('Default to sequence diagram diagrams');
      });

      it('should handle erd diagram type in standard mode', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          diagramType: 'erd',
        });
        expect(result).toContain('Default to entity-relationship diagram diagrams');
      });

      it('should handle class diagram type in standard mode', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          diagramType: 'class',
        });
        expect(result).toContain('Default to class diagram diagrams');
      });

      it('should fallback to raw diagramType if not in type map', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          diagramType: 'custom-diagram',
        });
        expect(result).toContain('Default to custom-diagram diagrams');
      });

      it('should include simple complexity preference in standard mode', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          complexity: 'simple',
        });
        expect(result).toContain('minimal and focused');
        expect(result).toContain('essential nodes');
      });

      it('should include detailed complexity preference in standard mode', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          complexity: 'detailed',
        });
        expect(result).toContain('comprehensive diagrams');
        expect(result).toContain('detailed labels');
      });

      it('should not add complexity text for other complexity values in standard mode', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          complexity: 'mvp',
        });
        expect(result).not.toContain('minimal and focused');
        expect(result).not.toContain('comprehensive diagrams');
      });

      it('should combine diagram type and complexity preferences in standard mode', () => {
        const result = getSystemPrompt({
          promptMode: 'standard',
          diagramType: 'flowchart',
          complexity: 'simple',
        });
        expect(result).toContain('Default to flowchart diagrams');
        expect(result).toContain('minimal and focused');
      });
    });

    describe('builder mode', () => {
      it('should use mermaid builder prompt for builder mode', () => {
        const result = getSystemPrompt({ promptMode: 'builder' });
        expect(result).toContain('MOCKED_MERMAID_BUILDER_PROMPT');
      });

      it('should pass diagramType to builder', () => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          diagramType: 'flowchart',
        });
        expect(result).toContain('TYPE_flowchart');
      });

      it('should pass simple complexity to builder', () => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          complexity: 'simple',
        });
        expect(result).toContain('COMPLEXITY_simple');
      });

      it('should pass detailed complexity to builder', () => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          complexity: 'detailed',
        });
        expect(result).toContain('COMPLEXITY_detailed');
      });

      it('should pass c4Level to builder', () => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          c4Level: 'container',
        });
        expect(result).toContain('C4_container');
      });

      it('should pass focusAreas to builder', () => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          focusAreas: ['security', 'performance'],
        });
        expect(result).toContain('FOCUS_security,performance');
      });

      it('should pass domain to builder', () => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          domain: 'devops',
        });
        expect(result).toContain('DOMAIN_devops');
      });

      it('should pass all builder preferences together', () => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          diagramType: 'c4-container',
          complexity: 'detailed',
          c4Level: 'component',
          focusAreas: ['scalability'],
          domain: 'data',
        });
        expect(result).toContain('TYPE_c4-container');
        expect(result).toContain('COMPLEXITY_detailed');
        expect(result).toContain('C4_component');
        expect(result).toContain('FOCUS_scalability');
        expect(result).toContain('DOMAIN_data');
      });
    });

    describe('vibe mode with preferences', () => {
      it('should pass projectType to vibe coder', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          projectType: 'web',
        });
        expect(result).toContain('PROJECT_web');
      });

      it('should pass techStack to vibe coder', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          techStack: ['React', 'TypeScript', 'Node.js'],
        });
        expect(result).toContain('STACK_React,TypeScript,Node.js');
      });

      it('should pass mvp complexity to vibe coder', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          complexity: 'mvp',
        });
        expect(result).toContain('COMPLEXITY_mvp');
      });

      it('should pass standard complexity to vibe coder', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          complexity: 'standard',
        });
        expect(result).toContain('COMPLEXITY_standard');
      });

      it('should pass enterprise complexity to vibe coder', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          complexity: 'enterprise',
        });
        expect(result).toContain('COMPLEXITY_enterprise');
      });

      it('should pass currentPhase to vibe coder', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          currentPhase: 'architecture',
        });
        expect(result).toContain('PHASE_architecture');
      });

      it('should pass currentSection to vibe coder', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          currentSection: 'frontend',
        });
        expect(result).toContain('SECTION_frontend');
      });

      it('should pass all vibe preferences together', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          projectType: 'fullstack',
          techStack: ['Next.js', 'Prisma'],
          complexity: 'standard',
          currentPhase: 'coding',
          currentSection: 'backend',
        });
        expect(result).toContain('PROJECT_fullstack');
        expect(result).toContain('STACK_Next.js,Prisma');
        expect(result).toContain('COMPLEXITY_standard');
        expect(result).toContain('PHASE_coding');
        expect(result).toContain('SECTION_backend');
      });

      it('should handle mobile project type', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          projectType: 'mobile',
        });
        expect(result).toContain('PROJECT_mobile');
      });

      it('should handle api project type', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          projectType: 'api',
        });
        expect(result).toContain('PROJECT_api');
      });

      it('should handle general project type', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          projectType: 'general',
        });
        expect(result).toContain('PROJECT_general');
      });

      it('should handle intent phase', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          currentPhase: 'intent',
        });
        expect(result).toContain('PHASE_intent');
      });

      it('should handle coding phase', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          currentPhase: 'coding',
        });
        expect(result).toContain('PHASE_coding');
      });
    });

    describe('preferences isolation between modes', () => {
      it('should not pass vibe preferences to builder mode', () => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          projectType: 'web', // vibe-specific
          currentPhase: 'coding', // vibe-specific
        });
        expect(result).not.toContain('PROJECT_');
        expect(result).not.toContain('PHASE_');
      });

      it('should not pass builder preferences to vibe mode', () => {
        const result = getSystemPrompt({
          promptMode: 'vibe',
          c4Level: 'container', // builder-specific
          focusAreas: ['security'], // builder-specific
          domain: 'devops', // builder-specific
        });
        expect(result).not.toContain('C4_');
        expect(result).not.toContain('FOCUS_');
        expect(result).not.toContain('DOMAIN_');
      });
    });
  });

  describe('getPromptByMode', () => {
    it('should return standard prompt for standard mode', () => {
      const result = getPromptByMode('standard');
      expect(result).toContain('Mermaid.js expert');
      expect(result).toContain('software architect');
    });

    it('should return builder prompt for builder mode', () => {
      const result = getPromptByMode('builder');
      expect(result).toContain('MOCKED_MERMAID_BUILDER_PROMPT');
    });

    it('should return vibe coder prompt for vibe mode', () => {
      const result = getPromptByMode('vibe');
      expect(result).toContain('MOCKED_VIBE_CODER_PROMPT');
    });

    it('should return same standard prompt as STANDARD_SYSTEM_PROMPT', () => {
      const result = getPromptByMode('standard');
      expect(result).toBe(STANDARD_SYSTEM_PROMPT);
    });

    it('should not include any preference-based customizations', () => {
      const builderResult = getPromptByMode('builder');
      const vibeResult = getPromptByMode('vibe');
      
      // Builder should not have domain/c4/etc customizations
      expect(builderResult).not.toContain('DOMAIN_');
      expect(builderResult).not.toContain('C4_');
      expect(builderResult).not.toContain('TYPE_');
      
      // Vibe should not have project/phase/etc customizations
      expect(vibeResult).not.toContain('PROJECT_');
      expect(vibeResult).not.toContain('PHASE_');
      expect(vibeResult).not.toContain('SECTION_');
    });
  });

  describe('type exports', () => {
    it('should accept all valid PromptMode values', () => {
      const modes: PromptMode[] = ['standard', 'builder', 'vibe'];
      modes.forEach((mode) => {
        expect(() => getPromptByMode(mode)).not.toThrow();
      });
    });

    it('should accept complete UserPreferences object', () => {
      const prefs: UserPreferences = {
        diagramType: 'flowchart',
        complexity: 'detailed',
        promptMode: 'builder',
        c4Level: 'container',
        focusAreas: ['security', 'performance'],
        domain: 'devops',
        projectType: 'fullstack',
        techStack: ['React', 'Node.js'],
        currentPhase: 'architecture',
        currentSection: 'backend',
      };
      expect(() => getSystemPrompt(prefs)).not.toThrow();
    });

    it('should accept partial UserPreferences object', () => {
      const partialPrefs: UserPreferences = {
        promptMode: 'vibe',
      };
      expect(() => getSystemPrompt(partialPrefs)).not.toThrow();
    });

    it('should accept empty UserPreferences object', () => {
      const emptyPrefs: UserPreferences = {};
      expect(() => getSystemPrompt(emptyPrefs)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty focus areas array', () => {
      const result = getSystemPrompt({
        promptMode: 'builder',
        focusAreas: [],
      });
      expect(result).not.toContain('FOCUS_');
    });

    it('should handle empty tech stack array', () => {
      const result = getSystemPrompt({
        promptMode: 'vibe',
        techStack: [],
      });
      expect(result).not.toContain('STACK_');
    });

    it('should handle all c4Level values', () => {
      const c4Levels = ['context', 'container', 'component', 'code'] as const;
      c4Levels.forEach((level) => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          c4Level: level,
        });
        expect(result).toContain(`C4_${level}`);
      });
    });

    it('should handle all domain values', () => {
      const domains = ['devops', 'data', 'business', 'general'] as const;
      domains.forEach((domain) => {
        const result = getSystemPrompt({
          promptMode: 'builder',
          domain: domain,
        });
        if (domain !== 'general') {
          expect(result).toContain(`DOMAIN_${domain}`);
        }
      });
    });

    it('should handle string complexity values that are not simple/detailed in standard mode', () => {
      const result = getSystemPrompt({
        promptMode: 'standard',
        complexity: 'enterprise', // string but not simple or detailed
      });
      // Should not add any complexity text since it's not simple or detailed
      expect(result).not.toContain('minimal and focused');
      expect(result).not.toContain('comprehensive diagrams');
    });
  });
});

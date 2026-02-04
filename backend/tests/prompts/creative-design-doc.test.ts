/**
 * Tests for prompts/creative-design-doc.ts
 * Covers the Creative Design Document (CDD) prompt generation for layout, UI/UX, key screens, and UX flows
 */

import { describe, it, expect } from 'vitest';
import {
  getCreativeDesignDocPrompt,
  getCreativeDesignDocUserPrompt,
} from '../../src/prompts/creative-design-doc.js';

describe('prompts/creative-design-doc', () => {
  describe('getCreativeDesignDocPrompt', () => {
    it('should return a string', () => {
      const result = getCreativeDesignDocPrompt();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include creative design lead role', () => {
      const result = getCreativeDesignDocPrompt();
      expect(result).toContain('creative design lead');
      expect(result).toContain('Creative Design Document');
    });

    it('should include responsibilities section', () => {
      const result = getCreativeDesignDocPrompt();
      expect(result).toContain('Your Responsibilities');
    });

    describe('layout section', () => {
      it('should include layout requirements', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('layout');
        expect(result).toContain('regions');
      });

      it('should specify layout region types', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('header');
        expect(result).toContain('sidebar');
        expect(result).toContain('main');
        expect(result).toContain('footer');
        expect(result).toContain('modal');
        expect(result).toContain('drawer');
      });

      it('should include breakpoints requirements', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('breakpoints');
        expect(result).toContain('grid');
      });
    });

    describe('UI principles section', () => {
      it('should include UI/UX principles requirements', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('UI/UX principles');
      });

      it('should specify principle categories', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('visual hierarchy');
        expect(result).toContain('spacing');
        expect(result).toContain('typography');
        expect(result).toContain('interactions');
      });
    });

    describe('key screens section', () => {
      it('should include key screens requirements', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('key screens');
      });

      it('should specify screen attributes', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('name');
        expect(result).toContain('purpose');
        expect(result).toContain('elements');
      });
    });

    describe('UX flows section', () => {
      it('should include UX flows requirements', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('UX flows');
      });

      it('should specify flow attributes', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('user journeys');
        expect(result).toContain('interaction steps');
      });
    });

    describe('accessibility and responsiveness', () => {
      it('should include accessibility requirements', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('accessibility');
        expect(result).toContain('Accessibility');
      });

      it('should include responsiveness requirements', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('responsiveness');
        expect(result).toContain('Responsiveness');
      });
    });

    describe('JSON format instructions', () => {
      it('should include JSON format specification', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('Output Format');
        expect(result).toContain('JSON object');
        expect(result).toContain('VALID JSON');
      });

      it('should include JSON schema structure', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('"id"');
        expect(result).toContain('"layout"');
        expect(result).toContain('"uiPrinciples"');
        expect(result).toContain('"keyScreens"');
        expect(result).toContain('"uxFlows"');
        expect(result).toContain('"accessibilityNotes"');
        expect(result).toContain('"responsivenessNotes"');
        expect(result).toContain('"metadata"');
      });

      it('should include layout schema details', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('"regions"');
        expect(result).toContain('"breakpoints"');
        expect(result).toContain('"gridDescription"');
        expect(result).toContain('"placement"');
      });

      it('should include uiPrinciples schema details', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('"visualHierarchy"');
        expect(result).toContain('"spacing"');
        expect(result).toContain('"typography"');
        expect(result).toContain('"keyInteractions"');
      });
    });

    describe('guidelines section', () => {
      it('should include guidelines for each section', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('Guidelines');
        expect(result).toContain('Layout');
        expect(result).toContain('UI principles');
        expect(result).toContain('Key screens');
        expect(result).toContain('UX flows');
      });

      it('should include WCAG reference for accessibility', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('WCAG');
      });

      it('should include breakpoint references', () => {
        const result = getCreativeDesignDocPrompt();
        expect(result).toContain('mobile');
        expect(result).toContain('tablet');
        expect(result).toContain('desktop');
      });
    });

    it('should be consistent across calls', () => {
      const result1 = getCreativeDesignDocPrompt();
      const result2 = getCreativeDesignDocPrompt();
      expect(result1).toBe(result2);
    });
  });

  describe('getCreativeDesignDocUserPrompt', () => {
    const testProjectDescription = 'A task management app for teams';
    const testArchitectureJson = '{"components": ["frontend", "backend", "database"]}';

    describe('basic functionality', () => {
      it('should return a string', () => {
        const result = getCreativeDesignDocUserPrompt(testProjectDescription, testArchitectureJson);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it('should include project description', () => {
        const result = getCreativeDesignDocUserPrompt(testProjectDescription, testArchitectureJson);
        expect(result).toContain('Project description:');
        expect(result).toContain(testProjectDescription);
      });

      it('should include architecture JSON', () => {
        const result = getCreativeDesignDocUserPrompt(testProjectDescription, testArchitectureJson);
        expect(result).toContain('Architecture:');
        expect(result).toContain(testArchitectureJson);
      });

      it('should include generation instructions', () => {
        const result = getCreativeDesignDocUserPrompt(testProjectDescription, testArchitectureJson);
        expect(result).toContain('Generate a Creative Design Document');
        expect(result).toContain('layout');
        expect(result).toContain('UI/UX principles');
        expect(result).toContain('key screens');
        expect(result).toContain('UX flows');
        expect(result).toContain('accessibility');
        expect(result).toContain('responsiveness');
        expect(result).toContain('Return only valid JSON');
      });
    });

    describe('without PRD overview', () => {
      it('should work without PRD overview parameter', () => {
        const result = getCreativeDesignDocUserPrompt(testProjectDescription, testArchitectureJson);
        expect(result).not.toContain('PRD overview:');
        expect(result).toContain(testProjectDescription);
        expect(result).toContain(testArchitectureJson);
      });

      it('should work with undefined PRD overview', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          undefined
        );
        expect(result).not.toContain('PRD overview:');
      });

      it('should work with empty PRD overview object', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          {}
        );
        expect(result).not.toContain('PRD overview:');
      });
    });

    describe('with complete PRD overview', () => {
      const completePrdOverview = {
        vision: 'Revolutionize team productivity',
        problem: 'Teams struggle with task coordination',
        solution: 'AI-powered task management with smart prioritization',
        targetMarket: 'Small to medium tech companies',
      };

      it('should include PRD overview section', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          completePrdOverview
        );
        expect(result).toContain('PRD overview:');
      });

      it('should include vision', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          completePrdOverview
        );
        expect(result).toContain('Vision: Revolutionize team productivity');
      });

      it('should include problem', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          completePrdOverview
        );
        expect(result).toContain('Problem: Teams struggle with task coordination');
      });

      it('should include solution', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          completePrdOverview
        );
        expect(result).toContain('Solution: AI-powered task management with smart prioritization');
      });

      it('should include target market', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          completePrdOverview
        );
        expect(result).toContain('Target market: Small to medium tech companies');
      });

      it('should include all fields in correct order', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          completePrdOverview
        );

        const visionIndex = result.indexOf('Vision:');
        const problemIndex = result.indexOf('Problem:');
        const solutionIndex = result.indexOf('Solution:');
        const targetMarketIndex = result.indexOf('Target market:');

        expect(visionIndex).toBeLessThan(problemIndex);
        expect(problemIndex).toBeLessThan(solutionIndex);
        expect(solutionIndex).toBeLessThan(targetMarketIndex);
      });
    });

    describe('with partial PRD overview - vision only', () => {
      it('should include PRD overview with vision only', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'Make work fun' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Vision: Make work fun');
        expect(result).not.toContain('Problem:');
        expect(result).not.toContain('Solution:');
        expect(result).not.toContain('Target market:');
      });
    });

    describe('with partial PRD overview - problem only', () => {
      it('should include PRD overview with problem only', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { problem: 'Current tools are too complex' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Problem: Current tools are too complex');
        expect(result).not.toContain('Vision:');
        expect(result).not.toContain('Solution:');
        expect(result).not.toContain('Target market:');
      });
    });

    describe('with partial PRD overview - solution only', () => {
      it('should include PRD overview with solution only', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { solution: 'Simple drag-and-drop interface' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Solution: Simple drag-and-drop interface');
        expect(result).not.toContain('Vision:');
        expect(result).not.toContain('Problem:');
        expect(result).not.toContain('Target market:');
      });
    });

    describe('with partial PRD overview - targetMarket only', () => {
      it('should NOT include PRD overview with targetMarket only', () => {
        // Based on the source code logic: prdOverview.vision || prdOverview.problem || prdOverview.solution
        // targetMarket alone does not trigger PRD overview section
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { targetMarket: 'Enterprise customers' }
        );
        expect(result).not.toContain('PRD overview:');
        expect(result).not.toContain('Target market:');
      });
    });

    describe('with partial PRD overview - various combinations', () => {
      it('should include vision and problem', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'Test vision', problem: 'Test problem' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Vision: Test vision');
        expect(result).toContain('Problem: Test problem');
        expect(result).not.toContain('Solution:');
        expect(result).not.toContain('Target market:');
      });

      it('should include problem and solution', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { problem: 'Test problem', solution: 'Test solution' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Problem: Test problem');
        expect(result).toContain('Solution: Test solution');
        expect(result).not.toContain('Vision:');
        expect(result).not.toContain('Target market:');
      });

      it('should include vision and targetMarket (vision triggers PRD section)', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'Test vision', targetMarket: 'Test market' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Vision: Test vision');
        expect(result).toContain('Target market: Test market');
        expect(result).not.toContain('Problem:');
        expect(result).not.toContain('Solution:');
      });

      it('should include solution and targetMarket (solution triggers PRD section)', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { solution: 'Test solution', targetMarket: 'Test market' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Solution: Test solution');
        expect(result).toContain('Target market: Test market');
        expect(result).not.toContain('Vision:');
        expect(result).not.toContain('Problem:');
      });

      it('should include all except targetMarket', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'V', problem: 'P', solution: 'S' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Vision: V');
        expect(result).toContain('Problem: P');
        expect(result).toContain('Solution: S');
        expect(result).not.toContain('Target market:');
      });
    });

    describe('with empty string values in PRD overview', () => {
      it('should not include empty vision', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: '', problem: 'Real problem' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).not.toContain('Vision:');
        expect(result).toContain('Problem: Real problem');
      });

      it('should not include empty problem', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'Real vision', problem: '' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Vision: Real vision');
        expect(result).not.toContain('Problem:');
      });

      it('should not include empty solution', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'Real vision', solution: '' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Vision: Real vision');
        expect(result).not.toContain('Solution:');
      });

      it('should not include empty targetMarket', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'Real vision', targetMarket: '' }
        );
        expect(result).toContain('PRD overview:');
        expect(result).toContain('Vision: Real vision');
        expect(result).not.toContain('Target market:');
      });

      it('should not include PRD section when all values are empty strings', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: '', problem: '', solution: '', targetMarket: '' }
        );
        expect(result).not.toContain('PRD overview:');
      });
    });

    describe('edge cases', () => {
      it('should handle empty project description', () => {
        const result = getCreativeDesignDocUserPrompt('', testArchitectureJson);
        expect(result).toContain('Project description:');
        expect(result).toContain('Architecture:');
        expect(result).toContain(testArchitectureJson);
      });

      it('should handle empty architecture JSON', () => {
        const result = getCreativeDesignDocUserPrompt(testProjectDescription, '');
        expect(result).toContain('Project description:');
        expect(result).toContain(testProjectDescription);
        expect(result).toContain('Architecture:');
      });

      it('should handle special characters in project description', () => {
        const specialDescription = 'App with "quotes" and <tags> & symbols';
        const result = getCreativeDesignDocUserPrompt(specialDescription, testArchitectureJson);
        expect(result).toContain(specialDescription);
      });

      it('should handle multiline project description', () => {
        const multilineDescription = 'Line 1\nLine 2\nLine 3';
        const result = getCreativeDesignDocUserPrompt(multilineDescription, testArchitectureJson);
        expect(result).toContain(multilineDescription);
      });

      it('should handle complex architecture JSON', () => {
        const complexJson = JSON.stringify({
          layers: ['presentation', 'business', 'data'],
          services: { auth: 'JWT', storage: 'S3' },
        });
        const result = getCreativeDesignDocUserPrompt(testProjectDescription, complexJson);
        expect(result).toContain(complexJson);
      });
    });

    describe('output structure', () => {
      it('should have project description before architecture', () => {
        const result = getCreativeDesignDocUserPrompt(testProjectDescription, testArchitectureJson);
        const projectIndex = result.indexOf('Project description:');
        const archIndex = result.indexOf('Architecture:');
        expect(projectIndex).toBeLessThan(archIndex);
      });

      it('should have PRD overview after architecture when present', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'Test' }
        );
        const archIndex = result.indexOf('Architecture:');
        const prdIndex = result.indexOf('PRD overview:');
        expect(archIndex).toBeLessThan(prdIndex);
      });

      it('should have generation instructions at the end', () => {
        const result = getCreativeDesignDocUserPrompt(
          testProjectDescription,
          testArchitectureJson,
          { vision: 'Test' }
        );
        const prdIndex = result.indexOf('PRD overview:');
        const generateIndex = result.indexOf('Generate a Creative Design Document');
        expect(prdIndex).toBeLessThan(generateIndex);
      });
    });

    it('should be consistent with same inputs', () => {
      const prdOverview = { vision: 'Test', problem: 'Test', solution: 'Test' };
      const result1 = getCreativeDesignDocUserPrompt(
        testProjectDescription,
        testArchitectureJson,
        prdOverview
      );
      const result2 = getCreativeDesignDocUserPrompt(
        testProjectDescription,
        testArchitectureJson,
        prdOverview
      );
      expect(result1).toBe(result2);
    });
  });
});

/**
 * Tests for prompts/prd-writer.ts
 * Covers PRD writer prompt generation for Product Requirements Documents
 */

import { describe, it, expect } from 'vitest';
import { getPRDWriterPrompt, getPRDStructurePrompt } from '../../src/prompts/prd-writer.js';

describe('prompts/prd-writer', () => {
  describe('getPRDWriterPrompt', () => {
    it('should return a string', () => {
      const result = getPRDWriterPrompt();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include product manager role', () => {
      const result = getPRDWriterPrompt();
      expect(result).toContain('expert product manager');
      expect(result).toContain('Product Requirements Documents');
    });

    describe('responsibilities section', () => {
      it('should include Your Responsibilities section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('## Your Responsibilities:');
      });

      it('should include product vision responsibility', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Create clear product vision and problem statement');
      });

      it('should include user personas responsibility', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Define user personas and their goals');
      });

      it('should include features breakdown responsibility', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Break down system components into features');
      });

      it('should include user stories responsibility', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Write user stories with acceptance criteria');
      });

      it('should include non-functional requirements responsibility', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Define non-functional requirements');
      });

      it('should include API contracts responsibility', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Specify API contracts');
      });

      it('should include data models responsibility', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Document data models');
      });

      it('should include success metrics responsibility', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Define success metrics and KPIs');
      });
    });

    describe('output format section', () => {
      it('should include Output Format section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('## Output Format:');
      });

      it('should specify JSON response requirement', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('VALID JSON object');
        expect(result).toContain('no markdown');
        expect(result).toContain('no code blocks');
      });

      it('should include projectName field', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"projectName"');
      });

      it('should include projectDescription field', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"projectDescription"');
      });

      it('should include version field', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"version"');
      });

      it('should include sections field', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"sections"');
      });
    });

    describe('overview section in JSON format', () => {
      it('should include overview section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"overview"');
      });

      it('should include vision field', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"vision"');
      });

      it('should include problem field', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"problem"');
      });

      it('should include solution field', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"solution"');
      });

      it('should include targetMarket field', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"targetMarket"');
      });
    });

    describe('personas section in JSON format', () => {
      it('should include personas section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"personas"');
      });

      it('should include persona fields', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"id": "persona_1"');
        expect(result).toContain('"name"');
        expect(result).toContain('"role"');
        expect(result).toContain('"goals"');
        expect(result).toContain('"painPoints"');
        expect(result).toContain('"successCriteria"');
      });
    });

    describe('features section in JSON format', () => {
      it('should include features section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"features"');
      });

      it('should include feature fields', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"id": "feature_1"');
        expect(result).toContain('"priority": "must|should|could|wont"');
        expect(result).toContain('"userStories"');
        expect(result).toContain('"acceptanceCriteria"');
        expect(result).toContain('"estimatedEffort": "S|M|L|XL"');
      });

      it('should include BDD acceptance criteria format', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('Given... When... Then...');
      });
    });

    describe('userStories section in JSON format', () => {
      it('should include userStories section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"userStories"');
      });

      it('should include user story fields', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"id": "story_1"');
        expect(result).toContain('"title"');
        expect(result).toContain('"asA"');
        expect(result).toContain('"iWant"');
        expect(result).toContain('"soThat"');
        expect(result).toContain('"relatedFeature"');
      });
    });

    describe('nonFunctionalRequirements section in JSON format', () => {
      it('should include nonFunctionalRequirements section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"nonFunctionalRequirements"');
      });

      it('should include NFR fields', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"id": "nfr_1"');
        expect(result).toContain('"category": "performance|security|scalability|reliability|usability"');
        expect(result).toContain('"requirement"');
        expect(result).toContain('"metric"');
        expect(result).toContain('"targetValue"');
      });
    });

    describe('apis section in JSON format', () => {
      it('should include apis section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"apis"');
      });

      it('should include API fields', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"method": "GET|POST|PUT|DELETE|PATCH"');
        expect(result).toContain('"path": "/api/resource"');
        expect(result).toContain('"authentication": "none|bearer|api_key"');
        expect(result).toContain('"requestBody"');
        expect(result).toContain('"responses"');
      });

      it('should include response status codes', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"status": 200');
        expect(result).toContain('"status": 400');
      });
    });

    describe('dataModels section in JSON format', () => {
      it('should include dataModels section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"dataModels"');
      });

      it('should include data model example', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"name": "User"');
        expect(result).toContain('"fields"');
        expect(result).toContain('"type": "string"');
        expect(result).toContain('"required": true');
      });
    });

    describe('successMetrics section in JSON format', () => {
      it('should include successMetrics section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"successMetrics"');
      });

      it('should include success metric fields', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('"id": "metric_1"');
        expect(result).toContain('"measurementMethod"');
        expect(result).toContain('"reviewFrequency": "weekly|monthly|quarterly"');
      });
    });

    describe('PRD Structure Guidelines section', () => {
      it('should include PRD Structure Guidelines header', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('## PRD Structure Guidelines:');
      });

      it('should include Overview Section guidelines', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('### Overview Section:');
        expect(result).toContain('Vision: Inspiring statement');
        expect(result).toContain('Problem: Clear articulation');
        expect(result).toContain('Solution: How product solves');
        expect(result).toContain('Target Market: Specific audience');
      });

      it('should include UI guidance in Overview Section', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('visible UI');
        expect(result).toContain('primary UI surfaces');
        expect(result).toContain('Creative Design Document');
      });

      it('should include Personas Section guidelines', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('### Personas Section:');
        expect(result).toContain('2-4 realistic user personas');
        expect(result).toContain('goals, pain points, success criteria');
      });

      it('should include Features Section guidelines', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('### Features Section:');
        expect(result).toContain('MoSCoW method');
        expect(result).toContain('BDD format');
        expect(result).toContain('Link to user stories');
      });

      it('should include User Stories Section guidelines', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('### User Stories Section:');
        expect(result).toContain('As a [persona], I want [feature], so that [benefit]');
        expect(result).toContain('Given [context], When [action], Then [outcome]');
      });

      it('should include Non-Functional Requirements guidelines', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('### Non-Functional Requirements:');
        expect(result).toContain('Performance: response times');
        expect(result).toContain('Security: authentication');
        expect(result).toContain('Scalability: concurrent users');
        expect(result).toContain('Reliability: uptime');
        expect(result).toContain('Usability: accessibility');
      });

      it('should include APIs Section guidelines', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('### APIs Section:');
        expect(result).toContain('REST/GraphQL API specification');
        expect(result).toContain('request/response examples');
        expect(result).toContain('authentication method');
        expect(result).toContain('status codes and error responses');
      });

      it('should include Data Models Section guidelines', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('### Data Models Section:');
        expect(result).toContain('entity types and relationships');
        expect(result).toContain('field types and requirements');
      });

      it('should include Success Metrics Section guidelines', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('### Success Metrics Section:');
        expect(result).toContain('KPIs');
        expect(result).toContain('target values');
        expect(result).toContain('Measurement methods');
        expect(result).toContain('Review frequency');
      });
    });

    describe('Quality Standards section', () => {
      it('should include Quality Standards header', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('## Quality Standards:');
      });

      it('should include quality guidance', () => {
        const result = getPRDWriterPrompt();
        expect(result).toContain('clear, concise language');
        expect(result).toContain('Avoid ambiguity');
        expect(result).toContain('specific examples');
        expect(result).toContain('acceptance criteria testable');
        expect(result).toContain('Ensure completeness');
        expect(result).toContain('Link related items');
      });
    });

    it('should be consistent across calls', () => {
      const result1 = getPRDWriterPrompt();
      const result2 = getPRDWriterPrompt();
      expect(result1).toBe(result2);
    });
  });

  describe('getPRDStructurePrompt', () => {
    const testProjectName = 'TestProject';
    const testArchitectureJson = JSON.stringify({
      components: ['Frontend', 'Backend', 'Database'],
      integrations: ['PaymentAPI', 'EmailService'],
    });

    it('should return a string', () => {
      const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include the base PRD writer prompt', () => {
      const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      const basePrompt = getPRDWriterPrompt();
      expect(result).toContain(basePrompt);
    });

    it('should include Project Context header', () => {
      const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      expect(result).toContain('## Project Context:');
    });

    it('should include the project name', () => {
      const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      expect(result).toContain(`Project Name: ${testProjectName}`);
    });

    it('should include Architecture Information header', () => {
      const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      expect(result).toContain('Architecture Information:');
    });

    it('should include the architecture JSON', () => {
      const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      expect(result).toContain(testArchitectureJson);
    });

    it('should include instructions for using architecture', () => {
      const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      expect(result).toContain('Use the provided architecture to inform your PRD generation');
      expect(result).toContain('Extract components to define features');
      expect(result).toContain('Use integrations to define APIs');
      expect(result).toContain('Use data models directly');
      expect(result).toContain('Identify stakeholders based on system actors');
      expect(result).toContain('Create appropriate personas based on who uses the system');
    });

    it('should include final instruction for comprehensive PRD', () => {
      const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      expect(result).toContain(
        'Generate a comprehensive PRD that maps the architecture to user-facing features and requirements'
      );
    });

    describe('with various project names', () => {
      it('should handle simple project names', () => {
        const result = getPRDStructurePrompt('MyApp', '{}');
        expect(result).toContain('Project Name: MyApp');
      });

      it('should handle project names with spaces', () => {
        const result = getPRDStructurePrompt('My Awesome App', '{}');
        expect(result).toContain('Project Name: My Awesome App');
      });

      it('should handle project names with special characters', () => {
        const result = getPRDStructurePrompt('App-v2.0_beta', '{}');
        expect(result).toContain('Project Name: App-v2.0_beta');
      });

      it('should handle empty project name', () => {
        const result = getPRDStructurePrompt('', '{}');
        expect(result).toContain('Project Name: ');
      });
    });

    describe('with various architecture JSON', () => {
      it('should handle empty JSON object', () => {
        const result = getPRDStructurePrompt('Test', '{}');
        expect(result).toContain('{}');
      });

      it('should handle complex JSON', () => {
        const complexJson = JSON.stringify({
          projectName: 'E-Commerce',
          components: [
            { name: 'Frontend', tech: 'React' },
            { name: 'API', tech: 'Node.js' },
            { name: 'Database', tech: 'PostgreSQL' },
          ],
          integrations: ['Stripe', 'SendGrid'],
          dataModels: ['User', 'Product', 'Order'],
        });
        const result = getPRDStructurePrompt('E-Commerce', complexJson);
        expect(result).toContain(complexJson);
        expect(result).toContain('E-Commerce');
        expect(result).toContain('React');
        expect(result).toContain('PostgreSQL');
      });

      it('should handle JSON with special characters', () => {
        const jsonWithSpecialChars = JSON.stringify({
          description: 'Test with "quotes" and \\ backslash',
        });
        const result = getPRDStructurePrompt('Test', jsonWithSpecialChars);
        expect(result).toContain(jsonWithSpecialChars);
      });

      it('should handle multi-line architecture JSON', () => {
        const prettyJson = JSON.stringify({ key: 'value' }, null, 2);
        const result = getPRDStructurePrompt('Test', prettyJson);
        expect(result).toContain(prettyJson);
      });
    });

    describe('prompt structure ordering', () => {
      it('should have base prompt before Project Context', () => {
        const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
        const basePromptEnd = result.indexOf('## Quality Standards:');
        const contextStart = result.indexOf('## Project Context:');
        expect(basePromptEnd).toBeLessThan(contextStart);
      });

      it('should have project name before architecture JSON', () => {
        const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
        const projectNameIndex = result.indexOf(`Project Name: ${testProjectName}`);
        const architectureIndex = result.indexOf('Architecture Information:');
        expect(projectNameIndex).toBeLessThan(architectureIndex);
      });

      it('should have architecture JSON inside code block', () => {
        const result = getPRDStructurePrompt(testProjectName, testArchitectureJson);
        expect(result).toContain('```json');
        expect(result).toContain(testArchitectureJson);
        expect(result).toContain('```');
      });
    });

    it('should be consistent across calls with same parameters', () => {
      const result1 = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      const result2 = getPRDStructurePrompt(testProjectName, testArchitectureJson);
      expect(result1).toBe(result2);
    });

    it('should produce different results with different project names', () => {
      const result1 = getPRDStructurePrompt('Project1', testArchitectureJson);
      const result2 = getPRDStructurePrompt('Project2', testArchitectureJson);
      expect(result1).not.toBe(result2);
      expect(result1).toContain('Project1');
      expect(result2).toContain('Project2');
    });

    it('should produce different results with different architecture JSON', () => {
      const result1 = getPRDStructurePrompt(testProjectName, '{"v": 1}');
      const result2 = getPRDStructurePrompt(testProjectName, '{"v": 2}');
      expect(result1).not.toBe(result2);
      expect(result1).toContain('"v": 1');
      expect(result2).toContain('"v": 2');
    });
  });
});

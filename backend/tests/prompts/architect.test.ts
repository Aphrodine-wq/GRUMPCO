/**
 * Tests for prompts/architect.ts
 * Covers the architect prompt generation for system architectures and C4 diagrams
 */

import { describe, it, expect } from 'vitest';
import {
  getArchitectPrompt,
  getArchitectExamples,
  type ArchitectPromptOptions,
} from '../../src/prompts/architect.js';

describe('prompts/architect', () => {
  describe('getArchitectPrompt', () => {
    describe('base prompt (no options)', () => {
      it('should return base prompt when called without options', () => {
        const result = getArchitectPrompt();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it('should return base prompt when called with undefined', () => {
        const result = getArchitectPrompt(undefined);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it('should return base prompt when called with empty options', () => {
        const result = getArchitectPrompt({});
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it('should include senior software architect role', () => {
        const result = getArchitectPrompt();
        expect(result).toContain('senior software architect');
        expect(result).toContain('C4 modeling');
      });

      it('should include responsibilities section', () => {
        const result = getArchitectPrompt();
        expect(result).toContain('Your Responsibilities');
        expect(result).toContain('Analyze the project description');
        expect(result).toContain('Design a scalable');
        expect(result).toContain('Generate C4 diagrams');
      });

      it('should include output format specification', () => {
        const result = getArchitectPrompt();
        expect(result).toContain('Output Format');
        expect(result).toContain('JSON object');
        expect(result).toContain('projectName');
        expect(result).toContain('projectDescription');
        expect(result).toContain('c4Diagrams');
      });

      it('should include C4 diagram guidelines', () => {
        const result = getArchitectPrompt();
        expect(result).toContain('C4 Diagram Guidelines');
        expect(result).toContain('Context Diagram');
        expect(result).toContain('Container Diagram');
        expect(result).toContain('Component Diagram');
      });

      it('should include mermaid syntax examples', () => {
        const result = getArchitectPrompt();
        expect(result).toContain('Mermaid Syntax');
        expect(result).toContain('graph TB');
        expect(result).toContain('User["');
      });

      it('should include quality standards', () => {
        const result = getArchitectPrompt();
        expect(result).toContain('Quality Standards');
        expect(result).toContain('production-ready');
        expect(result).toContain('security');
        expect(result).toContain('scalability');
      });
    });

    describe('complexity option', () => {
      it('should add mvp complexity guidance', () => {
        const result = getArchitectPrompt({ complexity: 'mvp' });
        expect(result).toContain('Complexity Level: mvp');
        expect(result).toContain('minimum viable product');
        expect(result).toContain('simple, straightforward architecture');
        expect(result).toContain('minimal components');
      });

      it('should add standard complexity guidance', () => {
        const result = getArchitectPrompt({ complexity: 'standard' });
        expect(result).toContain('Complexity Level: standard');
        expect(result).toContain('Balance between simplicity and scalability');
        expect(result).toContain('common patterns');
        expect(result).toContain('avoid over-engineering');
      });

      it('should add enterprise complexity guidance', () => {
        const result = getArchitectPrompt({ complexity: 'enterprise' });
        expect(result).toContain('Complexity Level: enterprise');
        expect(result).toContain('Design for scale');
        expect(result).toContain('reliability');
        expect(result).toContain('redundancy');
        expect(result).toContain('monitoring');
        expect(result).toContain('sophisticated patterns');
      });
    });

    describe('techStack option', () => {
      it('should add tech stack when provided with values', () => {
        const techStack = ['React', 'Node.js', 'PostgreSQL'];
        const result = getArchitectPrompt({ techStack });
        expect(result).toContain('Preferred Technologies');
        expect(result).toContain('React, Node.js, PostgreSQL');
        expect(result).toContain('Use these technologies where appropriate');
      });

      it('should add tech stack with single item', () => {
        const result = getArchitectPrompt({ techStack: ['Docker'] });
        expect(result).toContain('Preferred Technologies: Docker');
      });

      it('should not add tech stack section when array is empty', () => {
        const result = getArchitectPrompt({ techStack: [] });
        expect(result).not.toContain('Preferred Technologies');
      });

      it('should not add tech stack section when undefined', () => {
        const result = getArchitectPrompt({ techStack: undefined });
        expect(result).not.toContain('Preferred Technologies');
      });
    });

    describe('projectType option', () => {
      it('should add web project type guidance', () => {
        const result = getArchitectPrompt({ projectType: 'web' });
        expect(result).toContain('Project Type: web');
        expect(result).toContain('Design for web browsers');
        expect(result).toContain('frontend framework');
        expect(result).toContain('backend API');
        expect(result).toContain('database');
      });

      it('should add mobile project type guidance', () => {
        const result = getArchitectPrompt({ projectType: 'mobile' });
        expect(result).toContain('Project Type: mobile');
        expect(result).toContain('Design for mobile apps');
        expect(result).toContain('offline capabilities');
        expect(result).toContain('push notifications');
        expect(result).toContain('mobile-specific patterns');
      });

      it('should add api project type guidance', () => {
        const result = getArchitectPrompt({ projectType: 'api' });
        expect(result).toContain('Project Type: api');
        expect(result).toContain('Focus on backend API design');
        expect(result).toContain('RESTful or GraphQL');
        expect(result).toContain('databases');
        expect(result).toContain('microservices');
      });

      it('should add fullstack project type guidance', () => {
        const result = getArchitectPrompt({ projectType: 'fullstack' });
        expect(result).toContain('Project Type: fullstack');
        expect(result).toContain('Design complete system');
        expect(result).toContain('UI to database');
        expect(result).toContain('frontend and backend');
      });

      it('should add saas project type guidance', () => {
        const result = getArchitectPrompt({ projectType: 'saas' });
        expect(result).toContain('Project Type: saas');
        expect(result).toContain('multi-tenant SaaS');
        expect(result).toContain('user management');
        expect(result).toContain('billing');
        expect(result).toContain('authentication');
        expect(result).toContain('tenant isolation');
      });

      it('should handle unknown project type gracefully', () => {
        const result = getArchitectPrompt({ projectType: 'unknown-type' });
        expect(result).toContain('Project Type: unknown-type');
        // Should not throw and should not contain guidance for known types
        expect(result).not.toContain('Design for web browsers');
        expect(result).not.toContain('Design for mobile apps');
      });

      it('should handle general project type (not in typeGuidance)', () => {
        const result = getArchitectPrompt({ projectType: 'general' });
        expect(result).toContain('Project Type: general');
        // general is not in the typeGuidance map, so no specific guidance
      });
    });

    describe('combined options', () => {
      it('should combine all options correctly', () => {
        const options: ArchitectPromptOptions = {
          projectType: 'saas',
          complexity: 'enterprise',
          techStack: ['Next.js', 'Prisma', 'PostgreSQL', 'Redis'],
        };
        const result = getArchitectPrompt(options);

        // Base prompt
        expect(result).toContain('senior software architect');

        // Complexity
        expect(result).toContain('Complexity Level: enterprise');
        expect(result).toContain('Design for scale');

        // Tech stack
        expect(result).toContain('Preferred Technologies');
        expect(result).toContain('Next.js, Prisma, PostgreSQL, Redis');

        // Project type
        expect(result).toContain('Project Type: saas');
        expect(result).toContain('multi-tenant SaaS');
      });

      it('should combine complexity and techStack without projectType', () => {
        const result = getArchitectPrompt({
          complexity: 'mvp',
          techStack: ['Vue.js', 'Firebase'],
        });

        expect(result).toContain('Complexity Level: mvp');
        expect(result).toContain('Preferred Technologies');
        expect(result).toContain('Vue.js, Firebase');
        expect(result).not.toContain('Project Type:');
      });

      it('should combine projectType and complexity without techStack', () => {
        const result = getArchitectPrompt({
          projectType: 'api',
          complexity: 'standard',
        });

        expect(result).toContain('Project Type: api');
        expect(result).toContain('Complexity Level: standard');
        expect(result).not.toContain('Preferred Technologies');
      });

      it('should combine projectType and techStack without complexity', () => {
        const result = getArchitectPrompt({
          projectType: 'mobile',
          techStack: ['React Native', 'Expo'],
        });

        expect(result).toContain('Project Type: mobile');
        expect(result).toContain('Preferred Technologies');
        expect(result).toContain('React Native, Expo');
        expect(result).not.toContain('Complexity Level:');
      });
    });

    describe('option ordering in output', () => {
      it('should append complexity before techStack', () => {
        const result = getArchitectPrompt({
          complexity: 'standard',
          techStack: ['Node.js'],
        });

        const complexityIndex = result.indexOf('Complexity Level:');
        const techStackIndex = result.indexOf('Preferred Technologies:');

        expect(complexityIndex).toBeLessThan(techStackIndex);
      });

      it('should append techStack before projectType', () => {
        const result = getArchitectPrompt({
          techStack: ['Python'],
          projectType: 'api',
        });

        const techStackIndex = result.indexOf('Preferred Technologies:');
        const projectTypeIndex = result.indexOf('Project Type:');

        expect(techStackIndex).toBeLessThan(projectTypeIndex);
      });

      it('should maintain order: complexity -> techStack -> projectType', () => {
        const result = getArchitectPrompt({
          complexity: 'enterprise',
          techStack: ['Go', 'Kubernetes'],
          projectType: 'saas',
        });

        const complexityIndex = result.indexOf('Complexity Level:');
        const techStackIndex = result.indexOf('Preferred Technologies:');
        const projectTypeIndex = result.indexOf('Project Type:');

        expect(complexityIndex).toBeLessThan(techStackIndex);
        expect(techStackIndex).toBeLessThan(projectTypeIndex);
      });
    });
  });

  describe('getArchitectExamples', () => {
    it('should return examples string', () => {
      const result = getArchitectExamples();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include Examples header', () => {
      const result = getArchitectExamples();
      expect(result).toContain('## Examples');
    });

    it('should include MVP example (Todo App)', () => {
      const result = getArchitectExamples();
      expect(result).toContain('Example 1');
      expect(result).toContain('Simple Todo App');
      expect(result).toContain('MVP');
      expect(result).toContain('create, edit, and delete tasks');
      expect(result).toContain('React SPA');
      expect(result).toContain('Node.js/Express');
      expect(result).toContain('PostgreSQL');
      expect(result).toContain('No authentication initially');
    });

    it('should include Standard example (E-Commerce)', () => {
      const result = getArchitectExamples();
      expect(result).toContain('Example 2');
      expect(result).toContain('E-Commerce Platform');
      expect(result).toContain('Standard');
      expect(result).toContain('products');
      expect(result).toContain('shopping cart');
      expect(result).toContain('checkout');
      expect(result).toContain('Stripe/PayPal');
      expect(result).toContain('JWT tokens');
      expect(result).toContain('Elasticsearch');
    });

    it('should include Enterprise example (SaaS Analytics)', () => {
      const result = getArchitectExamples();
      expect(result).toContain('Example 3');
      expect(result).toContain('SaaS Analytics Platform');
      expect(result).toContain('Enterprise');
      expect(result).toContain('real-time dashboards');
      expect(result).toContain('user management');
      expect(result).toContain('billing');
      expect(result).toContain('API Gateway');
      expect(result).toContain('Microservices');
      expect(result).toContain('TimescaleDB');
      expect(result).toContain('Redis');
      expect(result).toContain('RabbitMQ/Kafka');
      expect(result).toContain('Prometheus + Grafana');
    });

    it('should be consistent across calls', () => {
      const result1 = getArchitectExamples();
      const result2 = getArchitectExamples();
      expect(result1).toBe(result2);
    });
  });

  describe('ArchitectPromptOptions type', () => {
    it('should accept all valid complexity values', () => {
      const complexities: Array<'mvp' | 'standard' | 'enterprise'> = [
        'mvp',
        'standard',
        'enterprise',
      ];
      complexities.forEach((complexity) => {
        expect(() => getArchitectPrompt({ complexity })).not.toThrow();
      });
    });

    it('should accept any string for projectType', () => {
      const projectTypes = ['web', 'mobile', 'api', 'fullstack', 'saas', 'custom'];
      projectTypes.forEach((projectType) => {
        expect(() => getArchitectPrompt({ projectType })).not.toThrow();
      });
    });

    it('should accept any string array for techStack', () => {
      const techStacks = [
        [],
        ['single'],
        ['multi', 'values'],
        ['a', 'b', 'c', 'd', 'e'],
      ];
      techStacks.forEach((techStack) => {
        expect(() => getArchitectPrompt({ techStack })).not.toThrow();
      });
    });
  });
});

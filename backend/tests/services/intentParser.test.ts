import { describe, it, expect } from 'vitest';
import {
  analyzeIntent,
  detectDiagramType,
  detectC4Level,
  extractConstraints,
  isDiagramRequest,
} from '../../src/services/intentParser.ts';

describe('intentParser', () => {
  describe('detectDiagramType', () => {
    it('should detect flowchart from keywords', () => {
      const result = detectDiagramType('Create a flow diagram showing the process');
      expect(result.type).toBe('flowchart');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect sequence diagram', () => {
      const result = detectDiagramType('Show the sequence of API calls');
      expect(result.type).toBe('sequence');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect class diagram', () => {
      const result = detectDiagramType('Create a class diagram with inheritance');
      expect(result.type).toBe('class');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect ER diagram', () => {
      const result = detectDiagramType('Show the database schema with entities');
      expect(result.type).toBe('er');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect C4 context diagram', () => {
      const result = detectDiagramType('Create a system context diagram');
      expect(result.type).toBe('c4-context');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return null for ambiguous input', () => {
      const result = detectDiagramType('hello world');
      expect(result.type).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectC4Level', () => {
    it('should detect context level', () => {
      const result = detectC4Level('Show the system context with external actors');
      expect(result).toBe('context');
    });

    it('should detect container level', () => {
      const result = detectC4Level('Show the containers and microservices');
      expect(result).toBe('container');
    });

    it('should detect component level', () => {
      const result = detectC4Level('Show the internal components and modules');
      expect(result).toBe('component');
    });

    it('should return null for non-architecture requests', () => {
      const result = detectC4Level('Create a simple flowchart');
      expect(result).toBeNull();
    });
  });

  describe('extractConstraints', () => {
    it('should detect simple complexity', () => {
      const result = extractConstraints('Create a simple diagram');
      expect(result.complexity).toBe('simple');
    });

    it('should detect detailed complexity', () => {
      const result = extractConstraints('Create a detailed comprehensive diagram');
      expect(result.complexity).toBe('detailed');
    });

    it('should detect business style', () => {
      const result = extractConstraints('Create a business-friendly diagram');
      expect(result.style).toBe('business');
    });

    it('should detect technical style', () => {
      const result = extractConstraints('Create a technical diagram for developers');
      expect(result.style).toBe('technical');
    });

    it('should extract focus areas', () => {
      const result = extractConstraints('Focus on authentication and authorization');
      expect(result.focusAreas).toBeDefined();
      expect(result.focusAreas?.length).toBeGreaterThan(0);
    });
  });

  describe('isDiagramRequest', () => {
    it('should identify diagram requests', () => {
      expect(isDiagramRequest('Create a diagram')).toBe(true);
      expect(isDiagramRequest('Show me a flowchart')).toBe(true);
      expect(isDiagramRequest('Draw a sequence diagram')).toBe(true);
    });

    it('should identify architecture requests', () => {
      expect(isDiagramRequest('Show the system architecture')).toBe(true);
      expect(isDiagramRequest('Create a database schema')).toBe(true);
    });

    it('should reject non-diagram requests', () => {
      expect(isDiagramRequest('What is the weather?')).toBe(false);
      expect(isDiagramRequest('Hello there')).toBe(false);
    });
  });

  describe('analyzeIntent', () => {
    it('should analyze a valid flowchart request', () => {
      const result = analyzeIntent('Create a flowchart showing the login process');
      expect(result.isValid).toBe(true);
      expect(result.suggestedType).toBe('flowchart');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should analyze a sequence diagram request', () => {
      const result = analyzeIntent('Show the sequence of API calls between services');
      expect(result.isValid).toBe(true);
      expect(result.suggestedType).toBe('sequence');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect C4 container level', () => {
      const result = analyzeIntent('Create a C4 container diagram of the microservices');
      expect(result.isValid).toBe(true);
      expect(result.c4Level).toBe('container');
    });

    it('should require clarification for ambiguous requests', () => {
      const result = analyzeIntent('Create something');
      expect(result.requiresClarification).toBe(true);
      expect(result.confidence).toBeLessThan(0.6);
    });

    it('should handle empty input', () => {
      const result = analyzeIntent('');
      expect(result.isValid).toBe(false);
      expect(result.requiresClarification).toBe(true);
    });

    it('should extract constraints from request', () => {
      const result = analyzeIntent('Create a simple business diagram focusing on payments');
      expect(result.constraints.complexity).toBe('simple');
      expect(result.constraints.style).toBe('business');
      expect(result.constraints.focusAreas).toBeDefined();
    });
  });
});

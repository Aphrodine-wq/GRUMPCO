import { describe, it, expect } from 'vitest';
import {
  parseAssistantResponse,
  hasCompleteClarification,
  isStartingClarification,
} from './responseParser';
import type { ClarificationPayload } from '@grump/shared-types';

describe('responseParser', () => {
  describe('parseAssistantResponse', () => {
    it('should parse a simple text response', () => {
      const content = 'Hello, this is a simple text response.';
      const result = parseAssistantResponse(content);
      expect(result.type).toBe('text');
      expect(result.textContent).toBe(content);
    });

    it('should parse a response with a mermaid diagram', () => {
      const mermaidCode = 'graph TD;\nA-->B;';
      const content = 'Here is your diagram:\n```mermaid\ngraph TD;\nA-->B;\n```';
      const result = parseAssistantResponse(content);
      expect(result.type).toBe('mixed');
      expect(result.mermaidCode).toBe('graph TD;\nA-->B;');
      expect(result.textContent).toBe('Here is your diagram:');
    });

    it('should parse a response with only a mermaid diagram', () => {
      const mermaidCode = 'graph TD;\nA-->B;';
      const content = '```mermaid\ngraph TD;\nA-->B;\n```';
      const result = parseAssistantResponse(content);
      expect(result.type).toBe('diagram');
      expect(result.mermaidCode).toBe('graph TD;\nA-->B;');
      expect(result.textContent).toBeUndefined();
    });

    it('should parse a response with a clarification request', () => {
      const clarification: ClarificationPayload = {
        questions: [{ id: 'q1', text: 'What is the primary goal?' }],
      };
      const content = `<!--CLARIFICATION_START-->\n${JSON.stringify(
        clarification
      )}
<!--CLARIFICATION_END-->`;
      const result = parseAssistantResponse(content);
      expect(result.type).toBe('clarification');
      expect(result.clarification).toEqual(clarification);
    });

    it('should handle malformed clarification JSON gracefully', () => {
      const content =
        '<!--CLARIFICATION_START-->\n{ "questions": "invalid" 
<!--CLARIFICATION_END-->';
      const result = parseAssistantResponse(content);
      expect(result.type).toBe('text');
    });
  });

  describe('clarification helpers', () => {
    const completeClarification =
      '<!--CLARIFICATION_START-->\n{ "questions": [] }\n<!--CLARIFICATION_END-->';
    const startingClarification = '<!--CLARIFICATION_START-->\n{ "questions": [] }';
    const noClarification = 'Just some text.';

    it('hasCompleteClarification should return true for complete clarification', () => {
      expect(hasCompleteClarification(completeClarification)).toBe(true);
    });

    it('hasCompleteClarification should return false for incomplete clarification', () => {
      expect(hasCompleteClarification(startingClarification)).toBe(false);
      expect(hasCompleteClarification(noClarification)).toBe(false);
    });

    it('isStartingClarification should return true for starting clarification', () => {
      expect(isStartingClarification(startingClarification)).toBe(true);
      expect(isStartingClarification(completeClarification)).toBe(true);
    });

    it('isStartingClarification should return false for no clarification', () => {
      expect(isStartingClarification(noClarification)).toBe(false);
    });
  });
});

import type { ClarificationPayload } from '../stores/clarificationStore';

export interface ParsedResponse {
  type: 'diagram' | 'clarification' | 'text' | 'mixed';
  mermaidCode?: string;
  clarification?: ClarificationPayload;
  textContent?: string;
}

/**
 * Parse Claude's response to detect clarification questions, mermaid diagrams, or plain text.
 * Clarifications are wrapped in <!--CLARIFICATION_START--> and <!--CLARIFICATION_END--> markers.
 */
export function parseAssistantResponse(content: string): ParsedResponse {
  // Check for clarification markers
  const clarificationMatch = content.match(
    /<!--CLARIFICATION_START-->\s*([\s\S]*?)\s*<!--CLARIFICATION_END-->/
  );

  if (clarificationMatch) {
    try {
      const clarification = JSON.parse(clarificationMatch[1]) as ClarificationPayload;
      // Validate the structure
      if (clarification.questions && Array.isArray(clarification.questions)) {
        return { type: 'clarification', clarification };
      }
    } catch (e) {
      console.warn('Failed to parse clarification JSON:', e);
      // Fall through to other parsing
    }
  }

  // Check for mermaid code blocks
  const mermaidMatch = content.match(/```mermaid\s*([\s\S]*?)```/);
  if (mermaidMatch) {
    const textWithoutMermaid = content.replace(/```mermaid[\s\S]*?```/g, '').trim();
    return {
      type: textWithoutMermaid ? 'mixed' : 'diagram',
      mermaidCode: mermaidMatch[1].trim(),
      textContent: textWithoutMermaid || undefined
    };
  }

  // Plain text response
  return { type: 'text', textContent: content };
}

/**
 * Check if a streaming response contains a complete clarification.
 * Used during streaming to detect when we have a full clarification payload.
 */
export function hasCompleteClarification(content: string): boolean {
  return content.includes('<!--CLARIFICATION_START-->') && content.includes('<!--CLARIFICATION_END-->');
}

/**
 * Check if a streaming response is starting a clarification (but may not be complete yet).
 */
export function isStartingClarification(content: string): boolean {
  return content.includes('<!--CLARIFICATION_START-->');
}

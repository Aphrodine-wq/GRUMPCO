/**
 * Clarification Types
 * For interactive clarification dialogs in chat
 */

export interface ClarificationOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface ClarificationQuestion {
  id: string;
  category: 'complexity' | 'domain' | 'scope' | 'features' | 'diagramType' | 'custom';
  question: string;
  selectionType: 'single' | 'multiple';
  options: ClarificationOption[];
  required?: boolean;
}

export interface ClarificationPayload {
  questions: ClarificationQuestion[];
  context?: string;
}

export interface ClarificationAnswer {
  questionId: string;
  selectedOptionIds: string[];
}

export interface ClarificationResponse {
  answers: ClarificationAnswer[];
}

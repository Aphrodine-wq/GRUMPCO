/**
 * Spec Mode Types (Frontend)
 * Re-exports from shared-types
 */

// Re-export all spec types from shared package
export type {
  SpecStatus,
  QuestionType,
  SpecQuestion,
  SpecAnswer,
  SpecSession,
  Specification,
  Requirement,
  TechnicalSpec,
  DataModelSpec,
  APISpec,
  UIComponentSpec,
} from '@grump/shared-types';

// Frontend-specific request types
export interface SpecStartRequest {
  userRequest: string;
  workspaceRoot?: string;
  maxQuestions?: number;
}

export interface SpecAnswerRequest {
  questionId: string;
  value: string | number | boolean | string[];
}

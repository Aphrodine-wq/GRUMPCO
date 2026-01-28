/**
 * Spec Mode Types
 * Interactive Q&A for requirements gathering and specification generation
 */

export type SpecStatus = 'collecting' | 'generating' | 'completed' | 'cancelled';

export type QuestionType = 'text' | 'choice' | 'multi-choice' | 'number' | 'boolean' | 'code';

export interface SpecQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[]; // For choice/multi-choice
  required: boolean;
  placeholder?: string;
  helpText?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  order: number;
  category?: string; // Group related questions
}

export interface SpecAnswer {
  questionId: string;
  value: string | number | boolean | string[];
  answeredAt: string;
}

export interface SpecSession {
  id: string;
  status: SpecStatus;
  originalRequest: string;
  questions: SpecQuestion[];
  answers: Record<string, SpecAnswer>;
  specification: Specification | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  workspaceRoot?: string;
}

export interface Specification {
  id: string;
  title: string;
  description: string;
  sections: {
    overview?: string;
    requirements?: Requirement[];
    technicalSpecs?: TechnicalSpec[];
    dataModels?: DataModelSpec[];
    apis?: APISpec[];
    uiComponents?: UIComponentSpec[];
    constraints?: string[];
    assumptions?: string[];
  };
  metadata: {
    generatedAt: string;
    sessionId: string;
    tags?: string[];
  };
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  acceptanceCriteria: string[];
}

export interface TechnicalSpec {
  id: string;
  name: string;
  description: string;
  type: 'framework' | 'library' | 'service' | 'pattern' | 'architecture';
  details?: Record<string, any>;
}

export interface DataModelSpec {
  id: string;
  name: string;
  fields: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
  relationships?: {
    target: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }[];
}

export interface APISpec {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  requestBody?: {
    schema: Record<string, any>;
  };
  responseBody?: {
    schema: Record<string, any>;
  };
  authentication?: boolean;
}

export interface UIComponentSpec {
  id: string;
  name: string;
  description: string;
  type: 'page' | 'component' | 'layout' | 'form' | 'modal';
  region?: string;
  placement?: string;
  layoutNotes?: string;
  props?: {
    name: string;
    type: string;
    required: boolean;
  }[];
}

export interface SpecStartRequest {
  userRequest: string;
  workspaceRoot?: string;
  maxQuestions?: number;
}

export interface SpecStartResponse {
  session: SpecSession;
}

export interface SpecAnswerRequest {
  questionId: string;
  value: string | number | boolean | string[];
}

export interface SpecAnswerResponse {
  session: SpecSession;
  nextQuestion?: SpecQuestion;
  isComplete: boolean;
}

/** Context-only spec generation (no Q&A): used by Ship when design result provides PRD + CDD */
export interface SpecDesignContext {
  projectDescription: string;
  prdOverview?: { vision?: string; problem?: string; solution?: string; targetMarket?: string };
  creativeDesignDoc?: unknown;
}

export interface SpecGenerateRequest {
  sessionId: string;
  /** When provided, generate spec from context without requiring Q&A answers */
  designContext?: SpecDesignContext;
  /** Optional head + mode prompt prepended for SHIP/chat consistency */
  systemPromptPrefix?: string;
}

export interface SpecGenerateResponse {
  specification: Specification;
  session: SpecSession;
}

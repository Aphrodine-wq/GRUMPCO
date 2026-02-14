import type { Request, Response, NextFunction } from 'express';

// API types
export interface DiagramRequest {
  prompt: string;
}

export interface DiagramResponse {
  code: string;
}

export interface ErrorResponse {
  error: string;
  type: string;
  details?: string;
  retryAfter?: number;
}

// Mermaid extraction result
export interface MermaidExtractionResult {
  extracted: boolean;
  code: string | null;
  method: 'block' | 'raw' | null;
}

// Claude service types
export interface ClaudeStreamEvent {
  type: string;
  delta?: {
    type: string;
    text?: string;
  };
}

// Conversation context types
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RefinementContext {
  baseDiagram?: string;
  refinementType?: 'modify' | 'convert' | 'expand' | 'simplify';
  instruction?: string;
}

// Express extended types
export interface TypedRequest<T = unknown> extends Request {
  body: T;
}

export type TypedRequestHandler<T = unknown> = (
  req: TypedRequest<T>,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// Error with code
export interface ServiceError extends Error {
  code?: string;
  rawText?: string;
  status?: number;
}

// Code Generation Types
export type TechStack = 'react-express-prisma' | 'fastapi-sqlalchemy' | 'nextjs-prisma';
export type DiagramType = 'er' | 'sequence' | 'flowchart' | 'class';

export interface CodeGenerationRequest {
  diagramType: DiagramType;
  mermaidCode: string;
  techStack: TechStack;
  projectName?: string;
}

export interface FileDefinition {
  path: string;
  content: string;
}

export interface CodeGenerationResult {
  files: FileDefinition[];
  techStack: TechStack;
  warnings?: string[];
}

// Clarification Modal Types
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

// Re-export new types for convenience
export type {
  SystemArchitecture,
  ArchitectureRequest,
  ArchitectureResponse,
  ArchitectureMetadata,
  Component,
  Integration,
  DataModel,
  APIEndpoint,
  C4Diagrams,
  ProjectType as ArchProjectType,
  Complexity,
} from './architecture.js';
export type {
  PRD,
  PRDRequest,
  PRDResponse,
  Persona,
  Feature,
  UserStory,
  APIEndpointSpec,
  NonFunctionalRequirement,
  SuccessMetric,
} from './prd.js';
export type {
  GenerationSession,
  AgentType,
  GenerationPreferences,
  CodeGenRequest,
  GeneratedFile,
  CodeGenResponse,
} from './agents.js';
export type {
  CreativeDesignDoc,
  LayoutSpec,
  UIPrinciples,
  KeyScreen,
  UXFlow,
  PRDOverviewForCDD,
} from './creativeDesignDoc.js';

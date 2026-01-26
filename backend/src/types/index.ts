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

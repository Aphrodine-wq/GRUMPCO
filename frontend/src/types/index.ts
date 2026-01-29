/* eslint-disable @typescript-eslint/no-explicit-any -- TODO: replace with proper types (Phase 1.1) */
// User preferences
export interface UserPreferences {
  diagramType: 'flowchart' | 'sequence' | 'erd' | 'class';
  complexity: 'simple' | 'medium' | 'detailed';
}

// ============================================================================
// CONTENT BLOCKS (for structured message content)
// ============================================================================

export interface TextBlock {
  type: 'text';
  content: string;
}

export interface CodeBlockType {
  type: 'code';
  language: string;
  code: string;
  fileName?: string;
}

export interface MermaidBlock {
  type: 'mermaid';
  content: string;
}

export interface ToolCallBlock {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, any>;
  status: 'pending' | 'executing' | 'success' | 'error';
}

export interface FileDiff {
  filePath: string;
  beforeContent: string;
  afterContent: string;
  changeType: 'created' | 'modified' | 'deleted';
  operations?: Array<{ type: string; lineStart: number; lineEnd?: number }>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  id: string;
  toolName: string;
  output: string;
  success: boolean;
  executionTime?: number;
  diff?: FileDiff;
}

export type ContentBlock = TextBlock | CodeBlockType | MermaidBlock | ToolCallBlock | ToolResultBlock;

// Message types
export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  diagramCode?: string;
  timestamp?: number;
}

// Diagram version for tracking refinement history
export interface DiagramVersion {
  id: string;
  code: string;
  timestamp: number;
  userPrompt: string;
  parentVersionId?: string; // For tracking refinement lineage
}

// Refinement context for AI
export interface RefinementContext {
  baseDiagram?: string;
  refinementType?: 'modify' | 'convert' | 'expand' | 'simplify';
  instruction?: string;
}

// Session types
export interface Session {
  id: string;
  name: string;
  messages: Message[];
  timestamp: number;
  updatedAt: number;
  diagramVersions?: DiagramVersion[]; // Track diagram history
  currentDiagramId?: string; // Current active diagram version
  /** Optional project id; when present, include in backend calls (e.g. ship/codegen from chat). */
  projectId?: string | null;
}

// Legacy session type for migration
export interface LegacySession {
  messages: Message[];
  timestamp: number;
}

// Mermaid types
export interface MermaidRenderResult {
  svg: string;
}

export interface MermaidThemeVariables {
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  lineColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  background: string;
  mainBkg: string;
  nodeBorder: string;
  clusterBkg: string;
  titleColor: string;
  edgeLabelBackground: string;
  fontFamily: string;
}

export interface MermaidConfig {
  startOnLoad: boolean;
  theme: string;
  securityLevel: string;
  flowchart: {
    useMaxWidth: boolean;
    htmlLabels: boolean;
  };
  themeVariables: MermaidThemeVariables;
}

// API types
export interface DiagramRequest {
  prompt: string;
  apiKey: string;
  preferences?: UserPreferences;
}

export interface DiagramResponse {
  code: string;
  title?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode?: number;
}

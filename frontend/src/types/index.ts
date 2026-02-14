// Types for frontend application
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
  input: Record<string, unknown>;
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

export interface IntentBlock {
  type: 'intent';
  content: Record<string, unknown>;
}

export interface ContextBlock {
  type: 'context';
  content: { mode: string; capabilities?: string[]; toolCount?: number };
}

export interface PhaseResultBlock {
  type: 'phase_result';
  phase: 'architecture' | 'prd' | 'plan' | 'code';
  data: unknown;
}

export interface FilesSummaryBlock {
  type: 'files_summary';
  files: Array<{
    path: string;
    changeType: 'created' | 'modified' | 'deleted';
    linesAdded: number;
    linesRemoved: number;
  }>;
  commandsRun: number;
  commandsPassed: number;
  totalTurns: number;
}

export type ContentBlock =
  | TextBlock
  | CodeBlockType
  | MermaidBlock
  | ToolCallBlock
  | ToolResultBlock
  | IntentBlock
  | ContextBlock
  | PhaseResultBlock
  | FilesSummaryBlock;

// Routing decision (transparent model selection)
export interface RoutingDecision {
  complexity?: number;
  reason?: string;
  alternatives?: string[];
  estimatedCost?: number;
}

// Message types
export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  diagramCode?: string;
  timestamp?: number;
  /** Model used for this message (transparent routing) */
  model?: string;
  /** Why this model was chosen (when available) */
  routingDecision?: RoutingDecision;
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

// Session types ('freeAgent' kept for backward compat with stored sessions)
export type SessionType = 'chat' | 'gAgent' | 'freeAgent';

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
  /** Optional session type; when 'gAgent' (or legacy 'freeAgent'), session uses Agent capabilities and is shown with a badge. */
  sessionType?: SessionType;
  /** Optional project description. */
  description?: string;
  /** Design workflow state for inline Architecture → PRD → Plan → Code workflow. */
  designWorkflow?: DesignWorkflowState;
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

// Design Workflow Types (re-exported from store)
export type DesignPhase = 'architecture' | 'prd' | 'plan' | 'code' | 'completed';

export interface PhaseData {
  architecture?: {
    mermaidCode: string;
    description: string;
  };
  prd?: {
    content: string;
    summary: string;
  };
  plan?: {
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      status: 'pending' | 'in-progress' | 'completed';
    }>;
  };
  code?: {
    files: Array<{
      path: string;
      content: string;
      language: string;
    }>;
  };
}

export interface DesignWorkflowState {
  currentPhase: DesignPhase;
  phaseData: PhaseData;
  userApprovals: Record<DesignPhase, boolean>;
  isActive: boolean;
  projectDescription?: string;
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

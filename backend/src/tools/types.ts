/**
 * Common types and base interfaces for all tools
 */

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface FileDiff {
  filePath: string;
  beforeContent: string;
  afterContent: string;
  changeType: 'created' | 'modified' | 'deleted';
  operations?: Array<{ type: string; lineStart: number; lineEnd?: number }>;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  executionTime: number;
  toolName: string;
  diff?: FileDiff;
  /** Optional metadata for guardrails, approvals, etc. */
  metadata?: {
    blockedByGuardrails?: boolean;
    requiresApproval?: boolean;
    approvalId?: string;
    riskLevel?: string;
    action?: string;
    [key: string]: unknown;
  };
}

export interface ToolExecutionEvent {
  type: 'tool_call' | 'tool_result' | 'tool_progress';
  toolName: string;
  toolId: string;
  input?: Record<string, unknown>;
  result?: ToolExecutionResult;
  status?: 'pending' | 'executing' | 'success' | 'error';
}

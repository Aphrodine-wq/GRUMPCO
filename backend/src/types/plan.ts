/**
 * Plan Mode Types
 * Structured planning with approval workflow and multi-phase execution
 */

export type PlanStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executing"
  | "completed"
  | "rejected"
  | "cancelled";

export type PlanPhase =
  | "exploration"
  | "preparation"
  | "implementation"
  | "validation";

export type RiskLevel = "low" | "medium" | "high";

export type FileChangeType = "create" | "modify" | "delete" | "move";

export interface FileChange {
  path: string;
  type: FileChangeType;
  description: string;
  estimatedLines?: number;
  newPath?: string; // For move operations
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  fileChanges: FileChange[];
  dependencies: string[]; // IDs of steps that must complete first
  estimatedTime: number; // Minutes
  risk: RiskLevel;
  phase: PlanPhase;
  order: number; // Order within phase
}

export interface Phase {
  id: PlanPhase;
  name: string;
  description: string;
  steps: string[]; // Step IDs
  checkpoint: boolean; // Requires approval before proceeding
  status: "pending" | "in_progress" | "completed" | "skipped";
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  steps: PlanStep[];
  phases: Phase[];
  totalEstimatedTime: number; // Minutes
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  startedAt?: string;
  completedAt?: string;
  workspaceRoot?: string;
  metadata?: {
    originalRequest?: string;
    agentProfile?: string;
    tags?: string[];
  };
}

export interface PlanGenerationRequest {
  userRequest: string;
  workspaceRoot?: string;
  agentProfile?: string;
  includePhases?: boolean;
  /** Optional head + mode prompt prepended for SHIP/chat consistency */
  systemPromptPrefix?: string;
  /** Optional namespace for RAG context (workspace/project id) */
  namespace?: string;
}

export interface PlanGenerationResponse {
  plan: Plan;
}

export interface PlanApprovalRequest {
  approved: boolean;
  comments?: string;
}

export interface PlanEditRequest {
  steps?: Partial<PlanStep>[];
  phases?: Partial<Phase>[];
  title?: string;
  description?: string;
}

export interface PlanExecutionRequest {
  planId: string;
  startFromPhase?: PlanPhase;
  skipPhases?: PlanPhase[];
}

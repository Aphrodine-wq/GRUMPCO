// Frontend plan types (mirror of backend types)
export type PlanStatus = 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'rejected' | 'cancelled';
export type PlanPhase = 'exploration' | 'preparation' | 'implementation' | 'validation';
export type RiskLevel = 'low' | 'medium' | 'high';
export type FileChangeType = 'create' | 'modify' | 'delete' | 'move';

export interface FileChange {
  path: string;
  type: FileChangeType;
  description: string;
  estimatedLines?: number;
  newPath?: string;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  fileChanges: FileChange[];
  dependencies: string[];
  estimatedTime: number;
  risk: RiskLevel;
  phase: PlanPhase;
  order: number;
}

export interface Phase {
  id: PlanPhase;
  name: string;
  description: string;
  steps: string[];
  checkpoint: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  steps: PlanStep[];
  phases: Phase[];
  totalEstimatedTime: number;
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
    rejectionComments?: string;
  };
}

export interface PlanGenerationRequest {
  userRequest: string;
  workspaceRoot?: string;
  agentProfile?: string;
  includePhases?: boolean;
}

export interface PlanEditRequest {
  steps?: Partial<PlanStep>[];
  phases?: Partial<Phase>[];
  title?: string;
  description?: string;
}

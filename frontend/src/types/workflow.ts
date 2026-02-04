/**
 * Workflow Types for 3-Phase VibeCode IDE
 * Architecture -> PRD -> Code Generation
 * Re-exports from shared-types with frontend-specific additions
 */

// Re-export architecture types from shared package
export type {
  C4Level,
  ProjectType,
  Complexity,
  C4Diagrams,
  Component,
  Integration,
  DataModel,
  APIEndpoint,
  ArchitectureMetadata,
  SystemArchitecture,
} from '@grump/shared-types';

// Re-export PRD types from shared package
export type {
  Feature,
  UserStory,
  Persona,
  NonFunctionalRequirement,
  APIEndpointSpec,
  SuccessMetric,
  PRD,
} from '@grump/shared-types';

// Re-export agent types from shared package
export type {
  AgentType,
  AgentStatus,
  AgentTask,
  GenerationPreferences,
  GeneratedFile,
} from '@grump/shared-types';

// ============================================================================
// CODE GENERATION SESSION (Frontend view - subset of full GenerationSession)
// ============================================================================

export interface CodeGenSession {
  sessionId: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  progress: number;
  agents: Record<import('@grump/shared-types').AgentType, import('@grump/shared-types').AgentTask>;
  generatedFileCount: number;
  error?: string;
}

// ============================================================================
// WORKFLOW STATE
// ============================================================================

export type WorkflowPhase = 'idle' | 'architecture' | 'prd' | 'codegen' | 'complete';

export interface WorkflowState {
  phase: WorkflowPhase;
  isStreaming: boolean;
  error: string | null;

  // Phase 1: Architecture
  architecture: import('@grump/shared-types').SystemArchitecture | null;
  architectureRaw: string; // Raw streamed content

  // Phase 2: PRD
  prd: import('@grump/shared-types').PRD | null;
  prdRaw: string; // Raw streamed content

  // Phase 3: Code Generation
  codegenSession: CodeGenSession | null;
  preferences: import('@grump/shared-types').GenerationPreferences;
}

export const DEFAULT_PREFERENCES: import('@grump/shared-types').GenerationPreferences = {
  frontendFramework: 'vue',
  backendRuntime: 'node',
  database: 'postgres',
  includeTests: true,
  includeDocs: true,
};

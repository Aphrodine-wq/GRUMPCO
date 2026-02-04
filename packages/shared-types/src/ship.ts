/**
 * SHIP Mode Types
 * Types for sequential Design -> Spec -> Plan -> Code workflow
 */

import type { SystemArchitecture } from './architecture.js';
import type { PRD } from './prd.js';
import type { Specification } from './spec.js';
import type { Plan } from './plan.js';
import type { GenerationSession } from './agents.js';
import type { CreativeDesignDoc } from './creativeDesignDoc.js';

export type ShipPhase = 'design' | 'spec' | 'plan' | 'code' | 'completed' | 'failed';

export interface ShipPreferences {
  frontendFramework?: 'svelte' | 'next' | 'angular' | 'vue' | 'react';
  backendRuntime?: 'node' | 'bun' | 'deno' | 'python' | 'go';
  database?: 'postgres' | 'mongodb' | 'sqlite';
  includeTests?: boolean;
  includeDocs?: boolean;
  workspaceRoot?: string;
}

export interface DesignPhaseResult {
  phase: 'design';
  status: 'completed' | 'failed';
  architecture: SystemArchitecture;
  prd: PRD;
  creativeDesignDoc?: CreativeDesignDoc;
  completedAt: string;
  error?: string;
}

export interface SpecPhaseResult {
  phase: 'spec';
  status: 'completed' | 'failed';
  specification: Specification;
  completedAt: string;
  error?: string;
}

export interface PlanPhaseResult {
  phase: 'plan';
  status: 'completed' | 'failed';
  plan: Plan;
  completedAt: string;
  error?: string;
}

export interface CodePhaseResult {
  phase: 'code';
  status: 'completed' | 'failed';
  session: GenerationSession;
  completedAt: string;
  error?: string;
}

export interface ShipSession {
  id: string;
  projectDescription: string;
  phase: ShipPhase;
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  projectName?: string;
  repoOrg?: string;
  deploymentTarget?: string;
  phases?: ShipRunnablePhase[];
  designResult?: DesignPhaseResult;
  specResult?: SpecPhaseResult;
  planResult?: PlanPhaseResult;
  codeResult?: CodePhaseResult;
  preferences?: ShipPreferences;
  error?: string;
}

export type ShipRunnablePhase = 'design' | 'spec' | 'plan' | 'code';

export interface ShipStartRequest {
  projectDescription: string;
  preferences?: ShipPreferences;
  projectId?: string;
  /** Optional project display name */
  projectName?: string;
  /** Optional repo or org (e.g. for GitHub) */
  repoOrg?: string;
  /** Optional deployment target: none, vercel, aws, gcp, etc. */
  deploymentTarget?: string;
  /** Phases to run; default all. If set, only these phases execute. */
  phases?: ShipRunnablePhase[];
}

export interface ShipPhaseResponse {
  sessionId: string;
  phase: ShipPhase;
  status: 'running' | 'completed' | 'failed';
  result?: DesignPhaseResult | SpecPhaseResult | PlanPhaseResult | CodePhaseResult;
  error?: string;
  nextPhase?: ShipPhase;
}

/** SSE stream event types for SHIP mode */
export interface ShipStreamEvent {
  type: 'phase_start' | 'phase_complete' | 'complete' | 'error' | 'progress';
  phase?: ShipPhase;
  result?: unknown;
  nextPhase?: ShipPhase;
  error?: string;
  progress?: number;
  message?: string;
}

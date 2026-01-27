/**
 * SHIP Mode Types
 * Types for sequential Design → Spec → Plan → Code workflow
 */

import type { SystemArchitecture } from './architecture.js';
import type { PRD } from './prd.js';
import type { Specification } from './spec.js';
import type { Plan } from './plan.js';
import type { GenerationSession } from './agents.js';
import type { CreativeDesignDoc } from './creativeDesignDoc.js';

export type ShipPhase = 'design' | 'spec' | 'plan' | 'code' | 'completed' | 'failed';

export interface ShipSession {
  id: string;
  projectDescription: string;
  phase: ShipPhase;
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  
  // Phase results
  designResult?: DesignPhaseResult;
  specResult?: SpecPhaseResult;
  planResult?: PlanPhaseResult;
  codeResult?: CodePhaseResult;
  
  // Preferences
  preferences?: ShipPreferences;
  
  // Error tracking
  error?: string;
}

export interface ShipPreferences {
  frontendFramework?: 'vue' | 'react';
  backendRuntime?: 'node' | 'python' | 'go';
  database?: 'postgres' | 'mongodb';
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

export interface ShipStartRequest {
  projectDescription: string;
  preferences?: ShipPreferences;
}

export interface ShipPhaseResponse {
  sessionId: string;
  phase: ShipPhase;
  status: 'running' | 'completed' | 'failed';
  result?: DesignPhaseResult | SpecPhaseResult | PlanPhaseResult | CodePhaseResult;
  error?: string;
  nextPhase?: ShipPhase;
}

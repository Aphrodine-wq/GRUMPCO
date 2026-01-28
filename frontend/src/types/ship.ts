/**
 * SHIP Mode Types (Frontend)
 */

export type ShipPhase = 'design' | 'spec' | 'plan' | 'code' | 'completed' | 'failed';

export interface ShipSession {
  id: string;
  projectDescription: string;
  phase: ShipPhase;
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  /** Optional project/workspace id linking chat, ship, and codegen */
  projectId?: string;

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

/** Minimal Creative Design Document shape for UI display (full type lives in backend) */
export interface CreativeDesignDocSummary {
  layout?: { gridDescription?: string; regions?: Array<{ name: string; description: string }> };
  uiPrinciples?: { visualHierarchy?: string[]; keyInteractions?: string[] };
  keyScreens?: Array<{ name: string; purpose: string }>;
  uxFlows?: Array<{ name: string; steps?: string[] }>;
  accessibilityNotes?: string[];
  responsivenessNotes?: string[];
}

export interface DesignPhaseResult {
  phase: 'design';
  status: 'completed' | 'failed';
  architecture: any; // SystemArchitecture
  prd: any; // PRD
  creativeDesignDoc?: CreativeDesignDocSummary;
  completedAt: string;
  error?: string;
}

export interface SpecPhaseResult {
  phase: 'spec';
  status: 'completed' | 'failed';
  specification: any; // Specification
  completedAt: string;
  error?: string;
}

export interface PlanPhaseResult {
  phase: 'plan';
  status: 'completed' | 'failed';
  plan: any; // Plan
  completedAt: string;
  error?: string;
}

export interface CodePhaseResult {
  phase: 'code';
  status: 'completed' | 'failed';
  session: any; // GenerationSession
  completedAt: string;
  error?: string;
}

export interface ShipStartRequest {
  projectDescription: string;
  preferences?: ShipPreferences;
  /** Optional project/workspace id to associate with this session */
  projectId?: string;
}

/**
 * Agent Types
 * Communication structures for multi-agent code generation system
 */

import type { PRD } from '../types/prd.js';
import type { SystemArchitecture } from '../types/architecture.js';

export type AgentType = 'architect' | 'frontend' | 'backend' | 'devops' | 'test' | 'docs' | 'security' | 'i18n' | 'wrunner';
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export interface AgentMessage {
  agentId: string;
  agentType: AgentType;
  type: 'request' | 'response' | 'error' | 'log';
  status: AgentStatus;
  content: Record<string, unknown>;
  timestamp: string;
  dependencies?: AgentType[];
}

export interface AgentTask {
  taskId: string;
  agentType: AgentType;
  description: string;
  status: AgentStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface GenerationSession {
  sessionId: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  prdId: string;
  architectureId: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  /** Optional project/workspace id linking chat, ship, and codegen */
  projectId?: string;
  agents: Record<AgentType, AgentTask>;
  preferences: GenerationPreferences;
  generatedFiles?: GeneratedFile[];
  error?: string;
  /** Multi-PRD mode */
  prds?: PRD[];
  architecture?: SystemArchitecture;
  subTasksByPrdId?: Record<string, SubTask[]>;
  componentMapping?: Partial<Record<AgentType, string[]>>;
  /** Design mode work reports */
  workReports?: Record<AgentType, AgentWorkReport>;
  /** WRunner analysis results */
  wrunnerAnalysis?: WRunnerAnalysis;
  /** Auto-fixes applied by WRunner */
  autoFixesApplied?: Array<{ issueId: string; fix: string; status: 'applied' | 'failed' }>;
}

export interface GenerationPreferences {
  frontendFramework?: 'vue' | 'react';
  backendRuntime?: 'node' | 'python' | 'go';
  database?: 'postgres' | 'mongodb';
  includeTests?: boolean;
  includeDocs?: boolean;
  styleGuide?: 'airbnb' | 'google' | 'standard';
}

export interface GeneratedFile {
  path: string;
  type: 'source' | 'test' | 'config' | 'doc';
  language: string;
  size: number;
  content: string;
}

export interface CodeGenRequest {
  prdId: string;
  architectureId: string;
  preferences: GenerationPreferences;
  /** Optional project/workspace id to associate with this session */
  projectId?: string;
}

export interface SubTask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface CodeGenRequestMulti {
  prds: Array<{ prd: PRD; componentId?: string; componentLabel?: string }>;
  architecture: SystemArchitecture;
  preferences: GenerationPreferences;
  /** Map agent type to component ids (or prd ids) it owns */
  componentMapping?: Partial<Record<AgentType, string[]>>;
  /** Optional project/workspace id to associate with this session */
  projectId?: string;
}

export interface CodeGenResponse {
  sessionId: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  agents: Record<AgentType, AgentTask>;
  progress?: number;
  message?: string;
  timestamp: string;
}

export interface CodeGenDownloadResponse {
  sessionId: string;
  zipPath: string;
  fileCount: number;
  totalSize: number;
  timestamp: string;
}

export interface AgentWorkReport {
  agentType: AgentType;
  sessionId: string;
  taskId: string;
  report: {
    summary: string;
    filesGenerated: Array<{ path: string; purpose: string; keyDecisions: string[] }>;
    architectureDecisions: Array<{ decision: string; rationale: string; alternatives: string[] }>;
    codeQualityMetrics: { coverage?: number; complexity?: number; issues: string[] };
    integrationPoints: Array<{ component: string; dependencies: string[]; contracts: string }>;
    testingStrategy: string;
    knownIssues: Array<{ issue: string; severity: 'low' | 'medium' | 'high'; suggestedFix: string }>;
    recommendations: string[];
  };
  generatedAt: string;
}

export interface WRunnerAnalysis {
  sessionId: string;
  issues: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'missing' | 'inconsistency' | 'quality' | 'integration' | 'security';
    description: string;
    affectedAgents: AgentType[];
    suggestedFixes: Array<{ action: string; files: string[]; code?: string }>;
  }>;
  missingComponents: string[];
  integrationGaps: Array<{ component: string; missingConnection: string }>;
  qualityConcerns: string[];
  recommendations: string[];
  autoFixable: boolean;
}

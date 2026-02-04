/**
 * Agent Types
 * Communication structures for multi-agent code generation system
 */

import type { PRD } from './prd.js';
import type { SystemArchitecture } from './architecture.js';

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

export interface GenerationPreferences {
  frontendFramework?: 'svelte' | 'next' | 'angular' | 'vue' | 'react';
  backendRuntime?: 'node' | 'bun' | 'deno' | 'python' | 'go';
  database?: 'postgres' | 'mongodb' | 'sqlite';
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

export interface SubTask {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface GenerationSession {
  sessionId: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  prdId: string;
  architectureId: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  projectId?: string;
  agents: Record<AgentType, AgentTask>;
  preferences: GenerationPreferences;
  generatedFiles?: GeneratedFile[];
  error?: string;
  prds?: PRD[];
  architecture?: SystemArchitecture;
  subTasksByPrdId?: Record<string, SubTask[]>;
  componentMapping?: Partial<Record<AgentType, string[]>>;
  workReports?: Record<AgentType, AgentWorkReport>;
  wrunnerAnalysis?: WRunnerAnalysis;
  autoFixesApplied?: Array<{ issueId: string; fix: string; status: 'applied' | 'failed' }>;
}

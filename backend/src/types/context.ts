/**
 * Context Types
 * Types for master context and agent context management
 */

import type { EnrichedIntent } from '../services/intentCompilerService.js';
import type { SystemArchitecture } from './architecture.js';
import type { PRD } from './prd.js';
import type { AgentType } from './agents.js';
import type { CodePattern, OptimizationOpportunity, CodeQualityRequirements } from '../services/intentCompilerService.js';

export interface ArchitectureHint {
  pattern: string;
  description: string;
  applicability: 'high' | 'medium' | 'low';
}

export interface MasterContext {
  id: string;
  projectDescription: string;
  enrichedIntent: EnrichedIntent;
  architecture: SystemArchitecture;
  prd: PRD;
  codePatterns: CodePattern[];
  architectureHints: ArchitectureHint[];
  qualityRequirements: CodeQualityRequirements;
  optimizationOpportunities: OptimizationOpportunity[];
  createdAt: string;
}

export interface AgentContext {
  agentType: AgentType;
  masterContext: MasterContext;
  agentSpecificContext: {
    focusAreas: string[];
    relevantPatterns: CodePattern[];
    relevantHints: ArchitectureHint[];
    qualityFocus: CodeQualityRequirements;
  };
  contextSummary: string;
}

export interface ContextGenerationRequest {
  projectDescription: string;
  enrichedIntent?: EnrichedIntent;
  architecture?: SystemArchitecture;
  prd?: PRD;
}

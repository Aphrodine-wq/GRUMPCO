/**
 * Workflow Types for 3-Phase VibeCode IDE
 * Architecture → PRD → Code Generation
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- TODO: replace with proper types (Phase 1.1) */

// ============================================================================
// ARCHITECTURE TYPES (matching backend)
// ============================================================================

export type C4Level = 'context' | 'container' | 'component' | 'code';
export type ProjectType = 'web' | 'mobile' | 'api' | 'fullstack' | 'saas' | 'general';
export type Complexity = 'mvp' | 'standard' | 'enterprise';

export interface C4Diagrams {
    context: string;
    container: string;
    component: string;
}

export interface Component {
    id: string;
    name: string;
    description: string;
    type: 'frontend' | 'backend' | 'database' | 'service' | 'external' | 'queue';
    technology?: string[];
}

export interface SystemArchitecture {
    id: string;
    projectName: string;
    projectDescription: string;
    projectType: ProjectType;
    complexity: Complexity;
    techStack: string[];
    c4Diagrams: C4Diagrams;
    metadata: {
        components: Component[];
        integrations: any[];
        dataModels: any[];
        apiEndpoints: any[];
    };
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// PRD TYPES (matching backend)
// ============================================================================

export interface Feature {
    id: string;
    name: string;
    description: string;
    priority: 'must' | 'should' | 'could' | 'wont';
    userStories: string[];
    acceptanceCriteria: string[];
}

export interface UserStory {
    id: string;
    title: string;
    asA: string;
    iWant: string;
    soThat: string;
    acceptanceCriteria: string[];
}

export interface PRD {
    id: string;
    projectName: string;
    projectDescription: string;
    version: string;
    createdAt: string;
    updatedAt: string;
    sections: {
        overview: {
            vision: string;
            problem: string;
            solution: string;
            targetMarket: string;
        };
        personas: any[];
        features: Feature[];
        userStories: UserStory[];
        nonFunctionalRequirements: any[];
        apis: any[];
        dataModels: any[];
        successMetrics: any[];
    };
}

// ============================================================================
// CODE GENERATION TYPES (matching backend)
// ============================================================================

export type AgentType = 'architect' | 'frontend' | 'backend' | 'devops' | 'test' | 'docs';
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export interface AgentTask {
    taskId: string;
    agentType: AgentType;
    description: string;
    status: AgentStatus;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    error?: string;
}

export interface GenerationPreferences {
    frontendFramework: 'vue' | 'react';
    backendRuntime: 'node' | 'python' | 'go';
    database: 'postgres' | 'mongodb';
    includeTests: boolean;
    includeDocs: boolean;
}

export interface GeneratedFile {
    path: string;
    type: 'source' | 'test' | 'config' | 'doc';
    language: string;
    size: number;
}

export interface CodeGenSession {
    sessionId: string;
    status: 'initializing' | 'running' | 'completed' | 'failed';
    progress: number;
    agents: Record<AgentType, AgentTask>;
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
    architecture: SystemArchitecture | null;
    architectureRaw: string; // Raw streamed content

    // Phase 2: PRD
    prd: PRD | null;
    prdRaw: string; // Raw streamed content

    // Phase 3: Code Generation
    codegenSession: CodeGenSession | null;
    preferences: GenerationPreferences;
}

export const DEFAULT_PREFERENCES: GenerationPreferences = {
    frontendFramework: 'vue',
    backendRuntime: 'node',
    database: 'postgres',
    includeTests: true,
    includeDocs: true,
};

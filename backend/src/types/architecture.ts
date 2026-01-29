/**
 * Architecture Types
 * Structures for system architecture generation and PRD
 */

export type C4Level = 'context' | 'container' | 'component' | 'code';
export type ProjectType = 'web' | 'mobile' | 'api' | 'fullstack' | 'saas' | 'general';
export type Complexity = 'mvp' | 'standard' | 'enterprise';

export interface Component {
  id: string;
  name: string;
  description: string;
  type: 'frontend' | 'backend' | 'database' | 'service' | 'external' | 'queue';
  technology?: string[];
  responsibilities?: string[];
}

export interface Integration {
  id: string;
  source: string;
  target: string;
  protocol: string;
  description: string;
}

export interface DataModel {
  id: string;
  name: string;
  fields: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
  relationships?: {
    field: string;
    references: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }[];
}

export interface APIEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
  requestBody?: {
    type: string;
    description?: string;
    schema?: Record<string, unknown>;
  };
  responses?: {
    status: number;
    description: string;
    schema?: Record<string, unknown>;
  }[];
}

export interface ArchitectureMetadata {
  components: Component[];
  integrations: Integration[];
  dataModels: DataModel[];
  apiEndpoints: APIEndpoint[];
  technologies: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    infrastructure?: string[];
  };
}

export interface C4Diagrams {
  context: string; // Mermaid diagram code
  container: string; // Mermaid diagram code
  component: string; // Mermaid diagram code
}

export interface SystemArchitecture {
  id: string;
  projectName: string;
  projectDescription: string;
  projectType: ProjectType;
  complexity: Complexity;
  techStack: string[];
  c4Diagrams: C4Diagrams;
  metadata: ArchitectureMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectureRequest {
  projectDescription: string;
  projectType?: ProjectType;
  techStack?: string[];
  complexity?: Complexity;
  refinements?: string[];
  /** Optional head + mode prompt prepended for SHIP/chat consistency */
  systemPromptPrefix?: string;
}

export interface ArchitectureResponse {
  id: string;
  status: 'generating' | 'complete' | 'error';
  architecture?: SystemArchitecture;
  error?: string;
  timestamp: string;
}

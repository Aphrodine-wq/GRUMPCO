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
  /** Optional namespace for RAG context (workspace/project id) */
  namespace?: string;
}

export interface ArchitectureResponse {
  id: string;
  status: 'generating' | 'complete' | 'error';
  architecture?: SystemArchitecture;
  error?: string;
  timestamp: string;
}

// ============================================================================
// Drift Detection Types
// ============================================================================

export type DriftSeverity = 'error' | 'warning' | 'info';

export type DriftCategory =
  | 'layer_crossing'
  | 'undeclared_integration'
  | 'tech_mismatch'
  | 'component_boundary'
  | 'reverse_dependency';

export interface DriftViolation {
  /** Unique rule ID for filtering/suppressing */
  ruleId: string;
  /** Severity of the violation */
  severity: DriftSeverity;
  /** Which detection category triggered this */
  category: DriftCategory;
  /** File where the violation was detected */
  file: string;
  /** Line number (if determinable) */
  line?: number;
  /** The offending import/reference */
  offendingCode: string;
  /** Human-readable description of the violation */
  message: string;
  /** Suggested fix */
  suggestion: string;
}

export interface ArchitectureRuleset {
  /** Component types and their allowed layers */
  components: Array<{
    id: string;
    name: string;
    type: Component['type'];
    technology: string[];
  }>;
  /** Declared integrations (source → target pairs) */
  allowedIntegrations: Array<{
    sourceId: string;
    targetId: string;
    protocol: string;
  }>;
  /** Declared tech stack per layer */
  declaredTech: {
    frontend: string[];
    backend: string[];
    database: string[];
    infrastructure: string[];
  };
  /** All declared tech stack items (flat) */
  allTech: string[];
}

export interface DriftReport {
  /** Architecture ID that rules were derived from */
  architectureId: string;
  /** Timestamp of the analysis */
  analyzedAt: string;
  /** Total files scanned */
  filesScanned: number;
  /** All violations found */
  violations: DriftViolation[];
  /** Summary counts by severity */
  summary: {
    errors: number;
    warnings: number;
    info: number;
    total: number;
  };
  /** Whether the code passes (no errors) */
  passes: boolean;
}

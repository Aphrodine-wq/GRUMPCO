/**
 * Intent Optimizer Types
 *
 * Type definitions for intent optimization service
 */

export type OptimizationMode = 'codegen' | 'architecture';

export interface OptimizationOptions {
  /** Include implementation details for codegen mode */
  includeImplementationDetails?: boolean;
  /** Include high-level design for architecture mode */
  includeDesignPatterns?: boolean;
  /** Number of clarification questions to generate (1-5) */
  clarificationQuestionsCount?: number;
  /** Whether to include NFRs in the output */
  includeNFRs?: boolean;
  /** Maximum features to include in output */
  maxFeatures?: number;
  /** Additional project context */
  projectContext?: ProjectContext;
}

export interface ProjectContext {
  /** Project name */
  name?: string;
  /** Existing tech stack */
  existingTechStack?: string[];
  /** Project phase (greenfield, maintenance, migration) */
  phase?: 'greenfield' | 'maintenance' | 'migration';
  /** Team size */
  teamSize?: number;
  /** Timeline constraints */
  timeline?: string;
  /** Budget constraints */
  budget?: string;
}

export interface OptimizedIntent {
  /** Optimized and cleaned feature list */
  features: string[];
  /** Explicit constraints identified */
  constraints: Constraint[];
  /** Non-functional requirements */
  nonFunctionalRequirements: NonFunctionalRequirement[];
  /** Tech stack recommendations */
  techStack: TechStackHint[];
  /** Actor/stakeholder definitions */
  actors: ActorDefinition[];
  /** Data flow summaries */
  dataFlows: DataFlowSummary[];
  /** Ambiguity analysis */
  ambiguity: AmbiguityAnalysis;
  /** Optimization reasoning */
  reasoning: string;
  /** Suggested clarifications */
  clarifications: ClarificationQuestion[];
  /** Confidence score (0-1) */
  confidence: number;
}

export interface Constraint {
  /** Type of constraint */
  type: 'technical' | 'business' | 'regulatory' | 'resource';
  /** Constraint description */
  description: string;
  /** Constraint priority */
  priority: 'must' | 'should' | 'nice_to_have';
  /** How this affects implementation */
  impact: string;
}

export interface NonFunctionalRequirement {
  /** NFR category */
  category: 'performance' | 'security' | 'scalability' | 'reliability' | 'usability' | 'maintainability';
  /** Specific requirement */
  requirement: string;
  /** Target metric if applicable */
  metric?: string;
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface TechStackHint {
  /** Technology name */
  technology: string;
  /** Category (frontend, backend, database, etc.) */
  category: string;
  /** Rationale for recommendation */
  rationale: string;
  /** Confidence in recommendation (0-1) */
  confidence: number;
}

export interface ActorDefinition {
  /** Actor identifier */
  id: string;
  /** Actor name */
  name: string;
  /** Actor type */
  type: 'human' | 'system' | 'external_service';
  /** Actor responsibilities */
  responsibilities: string[];
  /** Stakeholder priority */
  priority: 'primary' | 'secondary' | 'tertiary';
}

export interface DataFlowSummary {
  /** Flow name */
  name: string;
  /** Source actor/component */
  source: string;
  /** Target actor/component */
  target: string;
  /** Data description */
  data: string;
  /** Flow direction */
  direction: 'inbound' | 'outbound' | 'bidirectional';
}

export interface AmbiguityAnalysis {
  /** Ambiguity score (0-1, higher = more ambiguous) */
  score: number;
  /** Reasoning for ambiguity score */
  reason: string;
  /** Areas of ambiguity */
  ambiguousAreas: string[];
}

export interface ClarificationQuestion {
  /** Question ID */
  id: string;
  /** Question text */
  question: string;
  /** Why this matters */
  importance: string;
  /** Suggested options if applicable */
  suggestedOptions?: string[];
}

export interface OptimizationRequest {
  /** Raw intent text */
  intent: string;
  /** Optimization mode */
  mode: OptimizationMode;
  /** Additional project context */
  projectContext?: ProjectContext;
  /** Optimization options */
  options?: OptimizationOptions;
}

export interface OptimizationResponse {
  /** Optimized intent result */
  optimized: OptimizedIntent;
  /** Original input */
  original: string;
  /** Confidence score */
  confidence: number;
  /** Processing metadata */
  metadata: {
    /** Time taken in ms */
    processingTime: number;
    /** Model used */
    model: string;
    /** Optimization mode used */
    mode: OptimizationMode;
  };
}

export interface OptimizeIntentInput {
  /** Raw intent string */
  rawIntent: string;
  /** Optimization mode */
  mode: OptimizationMode;
  /** Optional configuration */
  options?: OptimizationOptions;
}

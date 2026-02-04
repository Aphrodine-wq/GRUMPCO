/**
 * @grump/shared-types
 * Shared TypeScript types for G-Rump frontend and backend
 */

// Architecture types
export type {
  C4Level,
  ProjectType,
  Complexity,
  Component,
  Integration,
  DataModel,
  APIEndpoint,
  ArchitectureMetadata,
  C4Diagrams,
  SystemArchitecture,
} from './architecture.js';

// PRD types
export type {
  Persona,
  Feature,
  UserStory,
  APIEndpointSpec,
  NonFunctionalRequirement,
  SuccessMetric,
  PRD,
} from './prd.js';

// Spec types
export type {
  SpecStatus,
  QuestionType,
  SpecQuestion,
  SpecAnswer,
  Requirement,
  TechnicalSpec,
  DataModelSpec,
  APISpec,
  UIComponentSpec,
  Specification,
  SpecSession,
} from './spec.js';

// Plan types
export type {
  PlanStatus,
  PlanPhase,
  RiskLevel,
  FileChangeType,
  FileChange,
  PlanStep,
  Phase,
  Plan,
} from './plan.js';

// Agent types
export type {
  AgentType,
  AgentStatus,
  AgentMessage,
  AgentTask,
  GenerationPreferences,
  GeneratedFile,
  AgentWorkReport,
  WRunnerAnalysis,
  SubTask,
  GenerationSession,
} from './agents.js';

// Ship types
export type {
  ShipPhase,
  ShipRunnablePhase,
  ShipPreferences,
  DesignPhaseResult,
  SpecPhaseResult,
  PlanPhaseResult,
  CodePhaseResult,
  ShipSession,
  ShipStartRequest,
  ShipPhaseResponse,
  ShipStreamEvent,
} from './ship.js';

// Clarification types
export type {
  ClarificationOption,
  ClarificationQuestion,
  ClarificationPayload,
  ClarificationAnswer,
  ClarificationResponse,
} from './clarification.js';

// Creative Design Doc types
export type {
  LayoutRegion,
  LayoutSpec,
  UIPrinciples,
  KeyScreen,
  UXFlow,
  CreativeDesignDoc,
} from './creativeDesignDoc.js';

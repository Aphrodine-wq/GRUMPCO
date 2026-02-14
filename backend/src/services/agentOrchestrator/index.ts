/**
 * Agent Orchestrator
 *
 * Re-exports the full public API from submodules. Consumers should import from
 * this barrel file or from `agentOrchestrator.ts` (the legacy shim).
 *
 * @module agentOrchestrator
 */

// Session management
export {
  initializeSession,
  getSession,
  initializeSessionMulti,
  defaultComponentMapping,
  getPrdsAndSubTasksForAgent,
} from './sessionManager.js';

// Pipeline execution
export { executeCodeGeneration, executeCodeGenerationMulti } from './pipeline.js';
export type { CodeGenerationOptions } from './pipeline.js';

// Agent executors
export type { SpecUiContext } from './agentExecutors.js';

// Shared utilities
export {
  convertAgentOutputToFiles,
  getLanguageFromPath,
  extractJsonFromResponse,
} from './shared.js';

// Fix engine
export { applyAutoFixes, validateFixes, regenerateAgentOutput } from './fixEngine.js';

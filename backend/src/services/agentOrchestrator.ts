/**
 * Agent Orchestrator Service (re-export shim)
 *
 * This file re-exports the full public API from the refactored submodules
 * in `./agentOrchestrator/`. Existing import paths continue to work unchanged.
 *
 * @see ./agentOrchestrator/index.ts
 */
export {
  initializeSession,
  getSession,
  initializeSessionMulti,
  defaultComponentMapping,
  getPrdsAndSubTasksForAgent,
  executeCodeGeneration,
  executeCodeGenerationMulti,
  convertAgentOutputToFiles,
  getLanguageFromPath,
  extractJsonFromResponse,
  applyAutoFixes,
  validateFixes,
  regenerateAgentOutput,
} from "./agentOrchestrator/index.js";

export type {
  CodeGenerationOptions,
  SpecUiContext,
} from "./agentOrchestrator/index.js";

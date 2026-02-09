/**
 * Tool definitions for LLM tool use
 * Modular exports from categorized tool modules
 *
 * @module tools
 */

// Base types
export type {
  Tool,
  FileDiff,
  ToolExecutionResult,
  ToolExecutionEvent,
} from "./types.js";

// File tools
export {
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  searchAndReplaceTool,
  listDirectoryTool,
  fileReadInputSchema,
  fileWriteInputSchema,
  fileEditInputSchema,
  fileEditOperationSchema,
  searchAndReplaceInputSchema,
  listDirectoryInputSchema,
  type FileReadInput,
  type FileWriteInput,
  type FileEditInput,
  type SearchAndReplaceInput,
  type ListDirectoryInput,
  FILE_TOOLS,
} from "./file/index.js";

// Codebase tools
export {
  codebaseSearchTool,
  grepSearchTool,
  codebaseSearchInputSchema,
  grepSearchInputSchema,
  type CodebaseSearchInput,
  type GrepSearchInput,
  CODEBASE_TOOLS,
} from "./codebase/index.js";

// Database tools
export {
  generateDbSchemaTool,
  generateMigrationsTool,
  generateDbSchemaInputSchema,
  generateMigrationsInputSchema,
  type GenerateDbSchemaInput,
  type GenerateMigrationsInput,
  DB_TOOLS,
} from "./db/index.js";

// Browser tools
export {
  screenshotUrlTool,
  browserRunScriptTool,
  browserNavigateTool,
  browserClickTool,
  browserTypeTool,
  browserGetContentTool,
  browserScreenshotTool,
  browserSnapshotTool,
  browserUploadTool,
  browserProfilesListTool,
  browserProfileSwitchTool,
  screenshotUrlInputSchema,
  browserRunScriptInputSchema,
  browserNavigateInputSchema,
  browserClickInputSchema,
  browserTypeInputSchema,
  browserGetContentInputSchema,
  browserScreenshotInputSchema,
  type ScreenshotUrlInput,
  type BrowserRunScriptInput,
  type BrowserNavigateInput,
  type BrowserClickInput,
  type BrowserTypeInput,
  type BrowserGetContentInput,
  type BrowserScreenshotInput,
  BROWSER_TOOLS,
} from "./browser/index.js";

// Git tools
export {
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  gitCommitTool,
  gitBranchTool,
  gitPushTool,
  gitStatusInputSchema,
  gitDiffInputSchema,
  gitLogInputSchema,
  gitCommitInputSchema,
  gitBranchInputSchema,
  gitPushInputSchema,
  type GitStatusInput,
  type GitDiffInput,
  type GitLogInput,
  type GitCommitInput,
  type GitBranchInput,
  type GitPushInput,
  GIT_TOOLS,
} from "./git/index.js";

// Terminal tools
export {
  bashExecuteTool,
  terminalExecuteTool,
  bashExecuteInputSchema,
  terminalExecuteInputSchema,
  type BashExecuteInput,
  type TerminalExecuteInput,
  TERMINAL_TOOLS,
} from "./terminal/index.js";

// Skill tools
export {
  skillCreateTool,
  skillEditTool,
  skillRunTestTool,
  skillListTool,
  skillCreateInputSchema,
  skillEditInputSchema,
  skillRunTestInputSchema,
  SKILL_TOOLS,
} from "./skill/index.js";

// Planning tools
export {
  sessionsListTool,
  sessionsHistoryTool,
  sessionsSendTool,
  PLANNING_TOOLS,
} from "./planning/index.js";

// Electron tools
export {
  cameraCaptureTool,
  screenRecordTool,
  locationGetTool,
  systemExecTool,
  canvasUpdateTool,
  ELECTRON_TOOLS,
} from "./electron/index.js";

// Outline / code navigation tools
export {
  fileOutlineTool,
  fileOutlineInputSchema,
  type FileOutlineInput,
  OUTLINE_TOOLS,
} from "./outline/index.js";

// ============================================================================
// ALL TOOLS AGGREGATION
// ============================================================================

import { FILE_TOOLS } from "./file/index.js";
import { CODEBASE_TOOLS } from "./codebase/index.js";
import { DB_TOOLS } from "./db/index.js";
import { BROWSER_TOOLS } from "./browser/index.js";
import { GIT_TOOLS } from "./git/index.js";
import { TERMINAL_TOOLS } from "./terminal/index.js";
import { SKILL_TOOLS } from "./skill/index.js";
import { PLANNING_TOOLS } from "./planning/index.js";
import { ELECTRON_TOOLS } from "./electron/index.js";
import { OUTLINE_TOOLS } from "./outline/index.js";

/**
 * All available base tools. Can be extended by MCP or dynamic registration.
 * @deprecated Import specific tool arrays from category modules instead
 */
export const AVAILABLE_TOOLS = [
  ...TERMINAL_TOOLS,
  ...FILE_TOOLS,
  ...CODEBASE_TOOLS,
  ...DB_TOOLS,
  ...BROWSER_TOOLS,
  ...GIT_TOOLS,
  ...SKILL_TOOLS,
  ...PLANNING_TOOLS,
  ...ELECTRON_TOOLS,
  ...OUTLINE_TOOLS,
];

/**
 * Tool categories for organized access
 */
export const ToolCategories = {
  file: FILE_TOOLS,
  codebase: CODEBASE_TOOLS,
  database: DB_TOOLS,
  browser: BROWSER_TOOLS,
  git: GIT_TOOLS,
  terminal: TERMINAL_TOOLS,
  skill: SKILL_TOOLS,
  planning: PLANNING_TOOLS,
  electron: ELECTRON_TOOLS,
  outline: OUTLINE_TOOLS,
} as const;

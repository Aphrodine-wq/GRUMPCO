/**
 * G-Rump Skills System - Type Definitions
 * Modular, discoverable capabilities for the platform
 */

import type { Router } from 'express';
import type { StreamEvent } from '../services/llmGateway.js';

/**
 * Skill manifest - metadata about a skill
 */
export interface SkillManifest {
  /** Unique identifier for the skill */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Description of what the skill does */
  description: string;

  /** Author/maintainer */
  author?: string;

  /** Category for organization */
  category: SkillCategory;

  /** What this skill can do */
  capabilities: SkillCapabilities;

  /** Dependencies on other skills */
  dependencies?: string[];

  /** Permissions required */
  permissions: SkillPermission[];

  /** Triggers that activate this skill */
  triggers?: SkillTriggers;

  /** Icon for UI (emoji or icon name) */
  icon?: string;

  /** Tags for search/filtering */
  tags?: string[];
}

export type SkillCategory =
  | 'code' // Code analysis, generation, refactoring
  | 'git' // Git operations
  | 'docs' // Documentation
  | 'test' // Testing
  | 'deploy' // Deployment, CI/CD
  | 'analyze' // Analysis, metrics
  | 'security' // Security scanning
  | 'life' // Life automation: reminders, calendar, inbox
  | 'custom'; // User-defined

export interface SkillCapabilities {
  /** Skill provides LLM tools */
  providesTools: boolean;

  /** Skill provides HTTP routes */
  providesRoutes: boolean;

  /** Skill provides system prompts */
  providesPrompts: boolean;

  /** Skill requires a workspace path */
  requiresWorkspace: boolean;

  /** Skill supports streaming responses */
  supportsStreaming: boolean;

  /** Skill can run in background */
  supportsBackground?: boolean;
}

export type SkillPermission =
  | 'file_read' // Read files
  | 'file_write' // Write/modify files
  | 'file_delete' // Delete files
  | 'bash_execute' // Execute shell commands
  | 'network' // Make network requests
  | 'git' // Git operations
  | 'env_read'; // Read environment variables

export interface SkillTriggers {
  /** Keywords that suggest this skill */
  keywords?: string[];

  /** Regex patterns that match this skill */
  patterns?: string[];

  /** File extensions this skill handles */
  fileExtensions?: string[];

  /** Commands that invoke this skill (e.g., "/review") */
  commands?: string[];
}

/**
 * Execution context passed to skills
 */
export interface SkillContext {
  /** Current session ID */
  sessionId: string;

  /** Workspace root path (if applicable) */
  workspacePath?: string;

  /** User-provided configuration */
  config?: Record<string, unknown>;

  /** Request metadata */
  request: {
    id: string;
    timestamp: Date;
    source: 'chat' | 'api' | 'command' | 'skill_test';
  };

  /** Available services */
  services: {
    llm: LLMService;
    fileSystem: FileSystemService;
    git?: GitService;
    logger: LoggerService;
  };

  /** Emit events during execution */
  emit: (event: SkillEvent) => void;

  /** Check if execution was cancelled */
  isCancelled: () => boolean;
}

/**
 * Tool definition for LLM function calling
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool definitions for a skill
 */
export interface SkillTools {
  /** Tool definitions for LLM function calling */
  definitions: ToolDefinition[];

  /** Handler functions for each tool */
  handlers: Record<string, SkillToolHandler>;
}

export type SkillToolHandler = (
  input: Record<string, unknown>,
  context: SkillContext
) => Promise<ToolExecutionResult>;

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Prompts for a skill
 */
export interface SkillPrompts {
  /** System prompt for this skill */
  system: string;

  /** Example conversations */
  examples?: Array<{
    user: string;
    assistant: string;
  }>;

  /** Named prompt templates */
  templates?: Record<string, string>;
}

/**
 * Events emitted during skill execution
 */
export type SkillEvent =
  | { type: 'started'; skillId: string; timestamp: Date }
  | { type: 'progress'; percent: number; message?: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; result: ToolExecutionResult }
  | { type: 'output'; content: string }
  | { type: 'file_change'; path: string; action: 'created' | 'modified' | 'deleted' }
  | { type: 'error'; error: Error; recoverable: boolean }
  | { type: 'completed'; summary?: string; duration: number };

/**
 * Input to skill execution
 */
export interface SkillExecutionInput {
  /** User's message/request */
  message: string;

  /** Conversation history */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;

  /** Files to operate on */
  files?: string[];

  /** Additional parameters */
  params?: Record<string, unknown>;
}

/**
 * Result of skill execution
 */
export interface SkillExecutionResult {
  success: boolean;
  output: string;
  events: SkillEvent[];
  duration: number;
  error?: Error;
  filesChanged?: string[];
}

/**
 * The Skill interface
 */
export interface Skill {
  /** Skill metadata */
  manifest: SkillManifest;

  /** LLM tools (optional) */
  tools?: SkillTools;

  /** System prompts (optional) */
  prompts?: SkillPrompts;

  /** HTTP routes (optional) */
  routes?: Router;

  // Lifecycle hooks

  /** Called once when skill is loaded */
  initialize?(context: Partial<SkillContext>): Promise<void>;

  /** Called when skill is activated for a session */
  activate?(context: SkillContext): Promise<void>;

  /** Called when skill is deactivated */
  deactivate?(context: SkillContext): Promise<void>;

  /** Called when skill is unloaded */
  cleanup?(): Promise<void>;

  // Execution

  /** Main execution method (streaming) */
  execute?(
    input: SkillExecutionInput,
    context: SkillContext
  ): AsyncGenerator<SkillEvent, SkillExecutionResult, undefined>;

  /** Quick execution (non-streaming) */
  run?(input: SkillExecutionInput, context: SkillContext): Promise<SkillExecutionResult>;

  /** Check if this skill should handle the input */
  shouldHandle?(input: string, context: SkillContext): boolean | Promise<boolean>;
}

/**
 * Skill registration entry
 */
export interface SkillRegistration {
  skill: Skill;
  loadedAt: Date;
  path: string;
  active: boolean;
}

/**
 * Service interfaces for SkillContext
 */
export interface LLMService {
  /** Complete a message (non-streaming) and return the full response text */
  complete(params: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
    tools?: ToolDefinition[];
    maxTokens?: number;
  }): Promise<string>;

  /** Stream message events from the LLM */
  stream(params: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
    tools?: ToolDefinition[];
    maxTokens?: number;
  }): AsyncGenerator<StreamEvent>;
}

export interface FileSystemService {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listDirectory(path: string): Promise<string[]>;
  deleteFile(path: string): Promise<void>;
  isWithinWorkspace(path: string): boolean;
}

export interface GitService {
  status(): Promise<GitStatus>;
  diff(options?: { staged?: boolean }): Promise<string>;
  commit(message: string, files?: string[]): Promise<string>;
  log(count?: number): Promise<GitLogEntry[]>;
  branch(): Promise<string>;
  branches(): Promise<string[]>;
}

export interface GitStatus {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface GitLogEntry {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

export interface LoggerService {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

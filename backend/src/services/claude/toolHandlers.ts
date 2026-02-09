/**
 * Tool Handlers Module
 * Extracted from claudeServiceWithTools.ts for better maintainability
 * Each tool has its own handler function with validation and execution logic
 */

import type { ToolExecutionResult } from "../../tools/types.js";
import {
  bashExecuteInputSchema,
  fileReadInputSchema,
  fileWriteInputSchema,
  fileEditInputSchema,
  listDirectoryInputSchema,
  codebaseSearchInputSchema,
  type BashExecuteInput,
  type FileReadInput,
  type FileWriteInput,
  type FileEditInput,
  type ListDirectoryInput,
} from "../../tools/index.js";
import { type ToolExecutionService } from "../workspace/toolExecutionService.js";
import logger from "../../middleware/logger.js";

// ============================================================================
// EXECUTION HANDLERS
// ============================================================================

export async function executeBash(
  input: Record<string, unknown>,
  tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const validation = bashExecuteInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
      toolName: "bash_execute",
      executionTime: 0,
    };
  }
  const data = validation.data as BashExecuteInput;
  try {
    const result = await tes.executeBash(
      data.command,
      data.workingDirectory,
      data.timeout,
    );
    return { ...result, executionTime: Date.now() - start };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message,
      toolName: "bash_execute",
      executionTime: Date.now() - start,
    };
  }
}

export async function executeFileRead(
  input: Record<string, unknown>,
  tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const validation = fileReadInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
      toolName: "file_read",
      executionTime: 0,
    };
  }
  const data = validation.data as FileReadInput;
  try {
    const result = await tes.readFile(data.path, data.encoding);
    return { ...result, executionTime: Date.now() - start };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message,
      toolName: "file_read",
      executionTime: Date.now() - start,
    };
  }
}

export async function executeFileWrite(
  input: Record<string, unknown>,
  tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const validation = fileWriteInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
      toolName: "file_write",
      executionTime: 0,
    };
  }
  const data = validation.data as FileWriteInput;
  try {
    const result = await tes.writeFile(
      data.path,
      data.content,
      data.createDirectories,
    );
    return { ...result, executionTime: Date.now() - start };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message,
      toolName: "file_write",
      executionTime: Date.now() - start,
    };
  }
}

export async function executeFileEdit(
  input: Record<string, unknown>,
  tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const validation = fileEditInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
      toolName: "file_edit",
      executionTime: 0,
    };
  }
  const data = validation.data as FileEditInput;
  try {
    const result = await tes.editFile(data.path, data.operations);
    return { ...result, executionTime: Date.now() - start };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message,
      toolName: "file_edit",
      executionTime: Date.now() - start,
    };
  }
}

export async function executeListDirectory(
  input: Record<string, unknown>,
  tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const validation = listDirectoryInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
      toolName: "list_directory",
      executionTime: 0,
    };
  }
  const data = validation.data as ListDirectoryInput;
  try {
    const result = await tes.listDirectory(data.path, data.recursive);
    return { ...result, executionTime: Date.now() - start };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message,
      toolName: "list_directory",
      executionTime: Date.now() - start,
    };
  }
}

export async function executeCodebaseSearch(
  input: Record<string, unknown>,
  tes: ToolExecutionService,
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const validation = codebaseSearchInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: `Invalid input: ${validation.error.message}`,
      toolName: "codebase_search",
      executionTime: 0,
    };
  }
  const { query, workingDirectory, maxResults } = validation.data;
  try {
    const result = await tes.searchCodebase(
      query,
      workingDirectory,
      maxResults,
    );
    return { ...result, executionTime: Date.now() - start };
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message,
      toolName: "codebase_search",
      executionTime: Date.now() - start,
    };
  }
}

// ============================================================================
// TOOL HANDLER REGISTRY
// ============================================================================

export type ToolHandler = (
  input: Record<string, unknown>,
  tes: ToolExecutionService,
) => Promise<ToolExecutionResult>;

export const toolHandlers: Map<string, ToolHandler> = new Map([
  ["bash_execute", executeBash],
  ["file_read", executeFileRead],
  ["file_write", executeFileWrite],
  ["file_edit", executeFileEdit],
  ["list_directory", executeListDirectory],
  ["codebase_search", executeCodebaseSearch],
]);

export function getToolHandler(toolName: string): ToolHandler | undefined {
  return toolHandlers.get(toolName);
}

export function registerToolHandler(
  toolName: string,
  handler: ToolHandler,
): void {
  toolHandlers.set(toolName, handler);
  logger.debug({ toolName }, "Registered tool handler");
}

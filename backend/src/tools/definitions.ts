/**
 * Tool definitions for Claude tool use
 * Defines all available tools with Zod schemas
 */

import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// BASH EXECUTION TOOL
// ============================================================================

export const bashExecuteInputSchema = z.object({
  command: z
    .string()
    .describe('Bash command to execute in the sandbox'),
  workingDirectory: z
    .string()
    .optional()
    .describe('Working directory for command execution (default: /workspace)'),
  timeout: z
    .number()
    .optional()
    .default(30000)
    .describe('Timeout in milliseconds (max 30000)'),
});

export type BashExecuteInput = z.infer<typeof bashExecuteInputSchema>;

export const bashExecuteTool: Anthropic.Tool = {
  name: 'bash_execute',
  description:
    'Execute bash commands in a sandboxed Docker environment. Useful for running CLI tools, npm commands, git operations, etc.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Bash command to execute in the sandbox',
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory for command execution (default: /workspace)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (max 30000)',
      },
    },
    required: ['command'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// FILE READ TOOL
// ============================================================================

export const fileReadInputSchema = z.object({
  path: z
    .string()
    .describe('Absolute file path to read from'),
  encoding: z
    .enum(['utf8', 'base64'])
    .optional()
    .default('utf8')
    .describe('File encoding (utf8 or base64)'),
});

export type FileReadInput = z.infer<typeof fileReadInputSchema>;

export const fileReadTool: Anthropic.Tool = {
  name: 'file_read',
  description:
    'Read the contents of a file. Use this to inspect code, configuration files, or any text content.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute file path to read from',
      },
      encoding: {
        type: 'string',
        enum: ['utf8', 'base64'],
        description: 'File encoding (utf8 or base64)',
      },
    },
    required: ['path'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// FILE WRITE TOOL
// ============================================================================

export const fileWriteInputSchema = z.object({
  path: z
    .string()
    .describe('Absolute file path to write to'),
  content: z
    .string()
    .describe('File content to write'),
  createDirectories: z
    .boolean()
    .optional()
    .default(true)
    .describe('Create parent directories if they do not exist'),
});

export type FileWriteInput = z.infer<typeof fileWriteInputSchema>;

export const fileWriteTool: Anthropic.Tool = {
  name: 'file_write',
  description:
    'Write content to a file. If the file does not exist, it will be created. Parent directories are created automatically.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute file path to write to',
      },
      content: {
        type: 'string',
        description: 'File content to write',
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they do not exist',
      },
    },
    required: ['path', 'content'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// FILE EDIT TOOL
// ============================================================================

export const fileEditOperationSchema = z.object({
  type: z
    .enum(['insert', 'replace', 'delete'])
    .describe('Operation type'),
  lineStart: z
    .number()
    .describe('Starting line number (1-indexed)'),
  lineEnd: z
    .number()
    .optional()
    .describe('Ending line number (1-indexed), inclusive'),
  content: z
    .string()
    .optional()
    .describe('Content to insert or replace with'),
});

export const fileEditInputSchema = z.object({
  path: z
    .string()
    .describe('Absolute file path to edit'),
  operations: z
    .array(fileEditOperationSchema)
    .describe('Array of edit operations to apply'),
});

export type FileEditInput = z.infer<typeof fileEditInputSchema>;

export const fileEditTool: Anthropic.Tool = {
  name: 'file_edit',
  description:
    'Edit specific lines in an existing file. Supports insert, replace, and delete operations. Line numbers are 1-indexed.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute file path to edit',
      },
      operations: {
        type: 'array',
        description: 'Array of edit operations to apply',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['insert', 'replace', 'delete'],
              description: 'Operation type',
            },
            lineStart: {
              type: 'number',
              description: 'Starting line number (1-indexed)',
            },
            lineEnd: {
              type: 'number',
              description: 'Ending line number (1-indexed), inclusive',
            },
            content: {
              type: 'string',
              description: 'Content to insert or replace with',
            },
          },
          required: ['type', 'lineStart'],
        },
      },
    },
    required: ['path', 'operations'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// LIST DIRECTORY TOOL
// ============================================================================

export const listDirectoryInputSchema = z.object({
  path: z
    .string()
    .describe('Directory path to list'),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe('Recursively list all files and directories'),
});

export type ListDirectoryInput = z.infer<typeof listDirectoryInputSchema>;

export const listDirectoryTool: Anthropic.Tool = {
  name: 'list_directory',
  description:
    'List files and directories in a directory. Can be recursive to show the full directory tree.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list',
      },
      recursive: {
        type: 'boolean',
        description: 'Recursively list all files and directories',
      },
    },
    required: ['path'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// ALL TOOLS ARRAY
// ============================================================================

export const AVAILABLE_TOOLS: Anthropic.Tool[] = [
  bashExecuteTool,
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  listDirectoryTool,
];

// ============================================================================
// TOOL RESULT TYPE
// ============================================================================

export interface FileDiff {
  filePath: string;
  beforeContent: string;
  afterContent: string;
  changeType: 'created' | 'modified' | 'deleted';
  operations?: Array<{ type: string; lineStart: number; lineEnd?: number }>;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  executionTime: number;
  toolName: string;
  diff?: FileDiff;
}

// ============================================================================
// TOOL EXECUTION EVENT
// ============================================================================

export interface ToolExecutionEvent {
  type: 'tool_call' | 'tool_result' | 'tool_progress';
  toolName: string;
  toolId: string;
  input?: Record<string, any>;
  result?: ToolExecutionResult;
  status?: 'pending' | 'executing' | 'success' | 'error';
}

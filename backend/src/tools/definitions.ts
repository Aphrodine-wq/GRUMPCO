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
// CODEBASE SEARCH TOOL
// ============================================================================

export const codebaseSearchInputSchema = z.object({
  query: z.string().describe('Search query or path pattern (e.g. "auth", "*.ts")'),
  workingDirectory: z
    .string()
    .optional()
    .describe('Directory to search (default: workspace root)'),
  maxResults: z
    .number()
    .optional()
    .default(20)
    .describe('Maximum number of matching paths or snippets to return'),
});

export type CodebaseSearchInput = z.infer<typeof codebaseSearchInputSchema>;

export const codebaseSearchTool: Anthropic.Tool = {
  name: 'codebase_search',
  description:
    'Search the codebase for files or content matching a query. Use for finding relevant files before reading. Prefer list_directory + file_read for targeted exploration.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query or path pattern' },
      workingDirectory: { type: 'string', description: 'Directory to search (default: workspace root)' },
      maxResults: { type: 'number', description: 'Maximum results (default 20)' },
    },
    required: ['query'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// DB SCHEMA TOOL (schema-from-diagram/PRD, Drizzle/SQL)
// ============================================================================

export const generateDbSchemaInputSchema = z.object({
  description: z.string().describe('Architecture description, PRD excerpt, or diagram/design summary'),
  targetDb: z
    .enum(['sqlite', 'postgres', 'mysql'])
    .optional()
    .default('sqlite')
    .describe('Target database type'),
  format: z
    .enum(['sql', 'drizzle'])
    .optional()
    .default('sql')
    .describe('Output format: sql (DDL only) or drizzle (DDL + Drizzle schema)'),
});

export type GenerateDbSchemaInput = z.infer<typeof generateDbSchemaInputSchema>;

export const generateDbSchemaTool: Anthropic.Tool = {
  name: 'generate_db_schema',
  description:
    'Generate database schema (SQL DDL and optionally Drizzle) from an architecture description, PRD excerpt, or diagram summary. Use for user DB creation, not G-Rump internal DB.',
  input_schema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Architecture/PRD/diagram description' },
      targetDb: { type: 'string', enum: ['sqlite', 'postgres', 'mysql'], description: 'Target DB (default sqlite)' },
      format: { type: 'string', enum: ['sql', 'drizzle'], description: 'Output format (default sql)' },
    },
    required: ['description'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// MIGRATIONS TOOL
// ============================================================================

export const generateMigrationsInputSchema = z.object({
  schemaDdl: z.string().describe('Existing schema DDL (CREATE TABLE ...) to turn into migrations'),
  targetDb: z
    .enum(['sqlite', 'postgres'])
    .optional()
    .default('sqlite')
    .describe('Target database for migration SQL'),
});

export type GenerateMigrationsInput = z.infer<typeof generateMigrationsInputSchema>;

export const generateMigrationsTool: Anthropic.Tool = {
  name: 'generate_migrations',
  description:
    'Generate migration files (raw SQL) from schema DDL for SQLite or Postgres. Does not apply migrations; output is for user to review and apply with guard rails.',
  input_schema: {
    type: 'object',
    properties: {
      schemaDdl: { type: 'string', description: 'Schema DDL to migrate' },
      targetDb: { type: 'string', enum: ['sqlite', 'postgres'], description: 'Target DB (default sqlite)' },
    },
    required: ['schemaDdl'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// BROWSER TOOLS (headless screenshot / run script; requires Playwright)
// ============================================================================

export const screenshotUrlInputSchema = z.object({
  url: z.string().url().describe('URL to capture (e.g. https://example.com)'),
});

export type ScreenshotUrlInput = z.infer<typeof screenshotUrlInputSchema>;

export const screenshotUrlTool: Anthropic.Tool = {
  name: 'screenshot_url',
  description:
    'Capture a screenshot of a URL using headless browser. Requires Playwright. Use for E2E checks or visual verification.',
  input_schema: {
    type: 'object',
    properties: { url: { type: 'string', description: 'URL to capture' } },
    required: ['url'],
  } as unknown as Anthropic.Tool['input_schema'],
};

export const browserRunScriptInputSchema = z.object({
  steps: z
    .array(
      z.object({
        action: z.enum(['navigate', 'click', 'type', 'screenshot', 'wait']),
        url: z.string().optional(),
        selector: z.string().optional(),
        value: z.string().optional(),
        timeout: z.number().optional(),
      })
    )
    .describe('Ordered steps: navigate, click, type, screenshot, wait'),
});

export type BrowserRunScriptInput = z.infer<typeof browserRunScriptInputSchema>;

export const browserRunScriptTool: Anthropic.Tool = {
  name: 'browser_run_script',
  description:
    'Run a short browser script (navigate, click, type, screenshot, wait). Requires Playwright. Use for E2E-style checks.',
  input_schema: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        description: 'Ordered steps',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['navigate', 'click', 'type', 'screenshot', 'wait'] },
            url: { type: 'string' },
            selector: { type: 'string' },
            value: { type: 'string' },
            timeout: { type: 'number' },
          },
          required: ['action'],
        },
      },
    },
    required: ['steps'],
  } as unknown as Anthropic.Tool['input_schema'],
};

// ============================================================================
// ALL TOOLS ARRAY (base tools; MCP/dynamic tools can be added via getTools())
// ============================================================================

const BASE_TOOLS: Anthropic.Tool[] = [
  bashExecuteTool,
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  listDirectoryTool,
  codebaseSearchTool,
  generateDbSchemaTool,
  generateMigrationsTool,
  screenshotUrlTool,
  browserRunScriptTool,
];

/** Tools that can be extended by MCP or dynamic registration. */
export const AVAILABLE_TOOLS: Anthropic.Tool[] = [...BASE_TOOLS];

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

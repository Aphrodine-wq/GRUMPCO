/**
 * File operation tool definitions
 */

import { z } from "zod";
import type { Tool } from "../types.js";

// ============================================================================
// FILE READ TOOL
// ============================================================================

export const fileReadInputSchema = z.object({
  path: z.string().describe("Absolute file path to read from"),
  encoding: z
    .enum(["utf8", "base64"])
    .optional()
    .default("utf8")
    .describe("File encoding"),
  startLine: z
    .number()
    .optional()
    .describe("Start line number (1-indexed) to read from. Omit to read from beginning."),
  endLine: z
    .number()
    .optional()
    .describe("End line number (1-indexed, inclusive) to read to. Omit to read to end."),
});

export type FileReadInput = z.infer<typeof fileReadInputSchema>;

export const fileReadTool: Tool = {
  name: "file_read",
  description:
    "Read the contents of a file. Supports reading a specific line range with startLine/endLine to avoid reading large files entirely. Line numbers are 1-indexed.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute file path to read from" },
      encoding: {
        type: "string",
        enum: ["utf8", "base64"],
        description: "File encoding",
      },
      startLine: {
        type: "number",
        description: "Start line number (1-indexed). Omit to read from beginning.",
      },
      endLine: {
        type: "number",
        description: "End line number (1-indexed, inclusive). Omit to read to end.",
      },
    },
    required: ["path"],
  },
};

// ============================================================================
// FILE WRITE TOOL
// ============================================================================

export const fileWriteInputSchema = z.object({
  path: z.string().describe("Absolute file path to write to"),
  content: z.string().describe("File content to write"),
  createDirectories: z
    .boolean()
    .optional()
    .default(true)
    .describe("Create parent directories"),
});

export type FileWriteInput = z.infer<typeof fileWriteInputSchema>;

export const fileWriteTool: Tool = {
  name: "file_write",
  description:
    "Write content to a file. If the file does not exist, it will be created. Parent directories are created automatically.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute file path to write to" },
      content: { type: "string", description: "File content to write" },
      createDirectories: {
        type: "boolean",
        description: "Create parent directories",
      },
    },
    required: ["path", "content"],
  },
};

// ============================================================================
// FILE EDIT TOOL
// ============================================================================

export const fileEditOperationSchema = z.object({
  type: z.enum(["insert", "replace", "delete"]).describe("Operation type"),
  lineStart: z.number().describe("Starting line number (1-indexed)"),
  lineEnd: z
    .number()
    .optional()
    .describe("Ending line number (1-indexed), inclusive"),
  content: z.string().optional().describe("Content to insert or replace with"),
});

export const fileEditInputSchema = z.object({
  path: z.string().describe("Absolute file path to edit"),
  operations: z
    .array(fileEditOperationSchema)
    .describe("Array of edit operations to apply"),
});

export type FileEditInput = z.infer<typeof fileEditInputSchema>;

export const fileEditTool: Tool = {
  name: "file_edit",
  description:
    "Edit specific lines in an existing file. Supports insert, replace, and delete operations. Line numbers are 1-indexed.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute file path to edit" },
      operations: {
        type: "array",
        description: "Array of edit operations",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["insert", "replace", "delete"],
              description: "Operation type",
            },
            lineStart: { type: "number", description: "Starting line number" },
            lineEnd: { type: "number", description: "Ending line number" },
            content: {
              type: "string",
              description: "Content to insert or replace",
            },
          },
          required: ["type", "lineStart"],
        },
      },
    },
    required: ["path", "operations"],
  },
};

// ============================================================================
// LIST DIRECTORY TOOL
// ============================================================================

export const listDirectoryInputSchema = z.object({
  path: z.string().describe("Directory path to list"),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Recursively list all files"),
});

export type ListDirectoryInput = z.infer<typeof listDirectoryInputSchema>;

export const listDirectoryTool: Tool = {
  name: "list_directory",
  description:
    "List files and directories in a directory. Can be recursive to show the full directory tree.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path to list" },
      recursive: { type: "boolean", description: "Recursively list all files" },
    },
    required: ["path"],
  },
};

// ============================================================================
// SEARCH AND REPLACE TOOL
// ============================================================================

export const searchAndReplaceInputSchema = z.object({
  path: z.string().describe("Absolute file path to edit"),
  search: z
    .string()
    .describe(
      "Exact text to find in the file. Must match precisely including whitespace and indentation.",
    ),
  replace: z.string().describe("Replacement text"),
  allowMultiple: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Replace all occurrences. Default: false (replace first occurrence only, error if multiple found).",
    ),
});

export type SearchAndReplaceInput = z.infer<typeof searchAndReplaceInputSchema>;

export const searchAndReplaceTool: Tool = {
  name: "search_and_replace",
  description:
    "Find an exact text match in a file and replace it. More reliable than line-number-based editing because it does not break when lines shift. The search text must match precisely.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute file path to edit" },
      search: {
        type: "string",
        description:
          "Exact text to find (must match precisely including whitespace)",
      },
      replace: { type: "string", description: "Replacement text" },
      allowMultiple: {
        type: "boolean",
        description:
          "Replace all occurrences (default: false — errors if multiple found)",
      },
    },
    required: ["path", "search", "replace"],
  },
};

// ============================================================================
// EXPORT ALL FILE TOOLS
// ============================================================================

export const FILE_TOOLS: Tool[] = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  searchAndReplaceTool,
  listDirectoryTool,
];

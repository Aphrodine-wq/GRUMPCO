/**
 * Codebase search and analysis tool definitions
 */

import { z } from "zod";
import type { Tool } from "../types.js";

// ============================================================================
// CODEBASE SEARCH TOOL
// ============================================================================

export const codebaseSearchInputSchema = z.object({
  query: z
    .string()
    .describe('Search query or path pattern (e.g. "auth", "*.ts")'),
  workingDirectory: z.string().optional().describe("Directory to search"),
  maxResults: z.number().optional().default(20).describe("Maximum results"),
});

export type CodebaseSearchInput = z.infer<typeof codebaseSearchInputSchema>;

export const codebaseSearchTool: Tool = {
  name: "codebase_search",
  description:
    "Search the codebase for files or content. Use for finding relevant files before reading.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query or path pattern" },
      workingDirectory: { type: "string", description: "Directory to search" },
      maxResults: { type: "number", description: "Maximum results" },
    },
    required: ["query"],
  },
};

// ============================================================================
// GREP SEARCH TOOL (ripgrep-style content search)
// ============================================================================

export const grepSearchInputSchema = z.object({
  pattern: z.string().describe("Search pattern (literal string or regex)"),
  path: z
    .string()
    .optional()
    .describe("Directory or file to search (default: workspace root)"),
  isRegex: z
    .boolean()
    .optional()
    .default(false)
    .describe("Treat pattern as regex"),
  includes: z
    .array(z.string())
    .optional()
    .describe("Glob patterns to include (e.g. '*.ts')"),
  maxResults: z
    .number()
    .optional()
    .default(50)
    .describe("Maximum matching lines to return"),
  caseSensitive: z
    .boolean()
    .optional()
    .default(true)
    .describe("Case-sensitive search"),
});

export type GrepSearchInput = z.infer<typeof grepSearchInputSchema>;

export const grepSearchTool: Tool = {
  name: "grep_search",
  description:
    "Search file contents for a pattern (like ripgrep/grep). Returns matching lines with file path and line numbers. Use for finding function definitions, imports, usages, TODOs, or any text pattern across the codebase. Prefer this over codebase_search when looking for specific code content.",
  input_schema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Search pattern (literal string or regex)",
      },
      path: {
        type: "string",
        description: "Directory or file to search (default: workspace root)",
      },
      isRegex: {
        type: "boolean",
        description: "Treat pattern as regex (default: false)",
      },
      includes: {
        type: "array",
        items: { type: "string" },
        description: "Glob patterns to include (e.g. '*.ts')",
      },
      maxResults: {
        type: "number",
        description: "Maximum matching lines (default: 50)",
      },
      caseSensitive: {
        type: "boolean",
        description: "Case-sensitive search (default: true)",
      },
    },
    required: ["pattern"],
  },
};

// ============================================================================
// EXPORT ALL CODEBASE TOOLS
// ============================================================================

export const CODEBASE_TOOLS: Tool[] = [codebaseSearchTool, grepSearchTool];

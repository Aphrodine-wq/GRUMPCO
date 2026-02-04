/**
 * Codebase search and analysis tool definitions
 */

import { z } from 'zod';
import type { Tool } from '../types.js';

// ============================================================================
// CODEBASE SEARCH TOOL
// ============================================================================

export const codebaseSearchInputSchema = z.object({
  query: z.string().describe('Search query or path pattern (e.g. "auth", "*.ts")'),
  workingDirectory: z.string().optional().describe('Directory to search'),
  maxResults: z.number().optional().default(20).describe('Maximum results'),
});

export type CodebaseSearchInput = z.infer<typeof codebaseSearchInputSchema>;

export const codebaseSearchTool: Tool = {
  name: 'codebase_search',
  description:
    'Search the codebase for files or content. Use for finding relevant files before reading.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query or path pattern' },
      workingDirectory: { type: 'string', description: 'Directory to search' },
      maxResults: { type: 'number', description: 'Maximum results' },
    },
    required: ['query'],
  },
};

// ============================================================================
// EXPORT ALL CODEBASE TOOLS
// ============================================================================

export const CODEBASE_TOOLS: Tool[] = [codebaseSearchTool];

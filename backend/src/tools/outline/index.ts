/**
 * File outline tool definition — AST-free structural code navigation.
 * Returns function/class/method signatures with line numbers.
 *
 * @module tools/outline
 */

import { z } from 'zod';
import type { Tool } from '../types.js';

// ============================================================================
// FILE OUTLINE TOOL
// ============================================================================

export const fileOutlineInputSchema = z.object({
  path: z.string().describe('Absolute file path to analyze'),
  maxItems: z.number().optional().default(100).describe('Maximum outline items to return'),
});

export type FileOutlineInput = z.infer<typeof fileOutlineInputSchema>;

export const fileOutlineTool: Tool = {
  name: 'file_outline',
  description:
    'Get the structural outline of a source file: functions, classes, methods, interfaces, and their line numbers. Use this BEFORE reading a large file to understand its structure and locate the specific section you need. Much faster and cheaper than reading the entire file.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute file path to analyze' },
      maxItems: {
        type: 'number',
        description: 'Maximum outline items to return (default: 100)',
      },
    },
    required: ['path'],
  },
};

// ============================================================================
// EXPORT ALL OUTLINE TOOLS
// ============================================================================

export const OUTLINE_TOOLS: Tool[] = [fileOutlineTool];

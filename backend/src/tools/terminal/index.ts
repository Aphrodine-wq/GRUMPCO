/**
 * Terminal and execution tool definitions
 */

import { z } from 'zod';
import type { Tool } from '../types.js';

// ============================================================================
// BASH EXECUTION TOOL
// ============================================================================

export const bashExecuteInputSchema = z.object({
  command: z.string().describe('Bash command to execute'),
  workingDirectory: z.string().optional().describe('Working directory'),
  timeout: z.number().optional().default(30000).describe('Timeout in ms'),
});

export type BashExecuteInput = z.infer<typeof bashExecuteInputSchema>;

export const bashExecuteTool: Tool = {
  name: 'bash_execute',
  description:
    'Execute shell commands in the workspace. On Windows, commands run via cmd.exe — use Windows commands (dir, type, where, etc.) not Unix commands (ls, cat, find, etc.). On Linux/macOS, commands run via bash.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Bash command' },
      workingDirectory: { type: 'string', description: 'Working directory' },
      timeout: { type: 'number', description: 'Timeout in ms' },
    },
    required: ['command'],
  },
};

// ============================================================================
// TERMINAL EXECUTION TOOL
// ============================================================================

export const terminalExecuteInputSchema = z.object({
  command: z.string().describe('Shell command to run'),
  workingDirectory: z.string().optional().describe('Working directory'),
  timeout: z.number().optional().default(60000).describe('Timeout in ms'),
});

export type TerminalExecuteInput = z.infer<typeof terminalExecuteInputSchema>;

export const terminalExecuteTool: Tool = {
  name: 'terminal_execute',
  description: 'Run a shell command and get output.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command' },
      workingDirectory: { type: 'string', description: 'Working directory' },
      timeout: { type: 'number', description: 'Timeout in ms' },
    },
    required: ['command'],
  },
};

// ============================================================================
// EXPORT ALL TERMINAL TOOLS
// ============================================================================

export const TERMINAL_TOOLS: Tool[] = [bashExecuteTool, terminalExecuteTool];

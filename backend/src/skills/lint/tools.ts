/**
 * Lint Skill - Tool Definitions
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { SkillContext, ToolExecutionResult } from '../types.js';

export const lintFileTool: Anthropic.Tool = {
  name: 'lint_file',
  description: 'Lint a file to identify and fix issues. Analyzes code and provides actionable feedback.',
  input_schema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file to lint (relative to workspace root)',
      },
      fix: {
        type: 'boolean',
        description: 'Automatically fix linting issues if possible',
        default: false,
      },
    },
    required: ['filePath'],
  },
};

export const definitions: Anthropic.Tool[] = [
  lintFileTool,
];

// Tool handlers will be implemented in the skill's index.ts
export const handlers: Record<
  string,
  (input: Record<string, unknown>, context: SkillContext) => Promise<ToolExecutionResult>
> = {};

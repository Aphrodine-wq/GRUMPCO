/**
 * Code Review Skill - Tool Definitions
 */

import type { ToolDefinition } from '../types.js';

export const reviewCodeTool: ToolDefinition = {
  name: 'review_code',
  description: 'Review code for quality, patterns, security, and improvements. Analyzes code and provides actionable feedback.',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to review',
      },
      language: {
        type: 'string',
        description: 'Programming language of the code (e.g., typescript, python, go)',
      },
      reviewType: {
        type: 'string',
        enum: ['quick', 'deep', 'security', 'performance'],
        description: 'Type of review to perform. quick=fast overview, deep=thorough analysis, security=security focused, performance=performance focused',
        default: 'quick',
      },
      context: {
        type: 'string',
        description: 'Additional context about the code (e.g., what it does, known issues)',
      },
    },
    required: ['code'],
  },
};

export const analyzeFileTool: ToolDefinition = {
  name: 'analyze_file',
  description: 'Read and analyze a file from the workspace for code review',
  input_schema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file to analyze (relative to workspace root)',
      },
      reviewType: {
        type: 'string',
        enum: ['quick', 'deep', 'security', 'performance'],
        description: 'Type of review to perform',
        default: 'deep',
      },
    },
    required: ['filePath'],
  },
};

export const suggestImprovementsTool: ToolDefinition = {
  name: 'suggest_improvements',
  description: 'Generate specific improvement suggestions for code with before/after examples',
  input_schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to improve',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
      focusArea: {
        type: 'string',
        enum: ['readability', 'performance', 'security', 'testing', 'all'],
        description: 'Area to focus improvements on',
        default: 'all',
      },
    },
    required: ['code'],
  },
};

export const definitions: ToolDefinition[] = [
  reviewCodeTool,
  analyzeFileTool,
  suggestImprovementsTool,
];

// Tool handlers will be implemented in the skill's index.ts
export const handlers: Record<
  string,
  (input: Record<string, unknown>, context: import('../types.js').SkillContext) => Promise<import('../types.js').ToolExecutionResult>
> = {};

/**
 * Git operation tool definitions
 */

import { z } from 'zod';
import type { Tool } from '../types.js';

// ============================================================================
// GIT STATUS TOOL
// ============================================================================

export const gitStatusInputSchema = z.object({
  workingDirectory: z.string().optional().describe('Working directory'),
});

export type GitStatusInput = z.infer<typeof gitStatusInputSchema>;

export const gitStatusTool: Tool = {
  name: 'git_status',
  description: 'Get git status for the workspace.',
  input_schema: {
    type: 'object',
    properties: {
      workingDirectory: { type: 'string', description: 'Working directory' },
    },
  },
};

// ============================================================================
// GIT DIFF TOOL
// ============================================================================

export const gitDiffInputSchema = z.object({
  workingDirectory: z.string().optional().describe('Working directory'),
  staged: z.boolean().optional().default(false).describe('Show staged changes'),
  file: z.string().optional().describe('Limit to single file'),
});

export type GitDiffInput = z.infer<typeof gitDiffInputSchema>;

export const gitDiffTool: Tool = {
  name: 'git_diff',
  description: 'Show git diff.',
  input_schema: {
    type: 'object',
    properties: {
      workingDirectory: { type: 'string', description: 'Working directory' },
      staged: { type: 'boolean', description: 'Show staged changes' },
      file: { type: 'string', description: 'Limit to single file' },
    },
  },
};

// ============================================================================
// GIT LOG TOOL
// ============================================================================

export const gitLogInputSchema = z.object({
  workingDirectory: z.string().optional().describe('Working directory'),
  maxCount: z.number().optional().default(20).describe('Max commits'),
  oneline: z.boolean().optional().default(true).describe('One line per commit'),
});

export type GitLogInput = z.infer<typeof gitLogInputSchema>;

export const gitLogTool: Tool = {
  name: 'git_log',
  description: 'Show git log.',
  input_schema: {
    type: 'object',
    properties: {
      workingDirectory: { type: 'string', description: 'Working directory' },
      maxCount: { type: 'number', description: 'Max commits' },
      oneline: { type: 'boolean', description: 'One line per commit' },
    },
  },
};

// ============================================================================
// GIT COMMIT TOOL
// ============================================================================

export const gitCommitInputSchema = z.object({
  message: z.string().describe('Commit message'),
  workingDirectory: z.string().optional().describe('Working directory'),
  addAll: z.boolean().optional().default(false).describe('Stage all changes'),
});

export type GitCommitInput = z.infer<typeof gitCommitInputSchema>;

export const gitCommitTool: Tool = {
  name: 'git_commit',
  description: 'Create a git commit.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      workingDirectory: { type: 'string', description: 'Working directory' },
      addAll: { type: 'boolean', description: 'Stage all changes' },
    },
    required: ['message'],
  },
};

// ============================================================================
// GIT BRANCH TOOL
// ============================================================================

export const gitBranchInputSchema = z.object({
  workingDirectory: z.string().optional().describe('Working directory'),
  list: z.boolean().optional().default(true).describe('List branches'),
  create: z.string().optional().describe('Create branch'),
});

export type GitBranchInput = z.infer<typeof gitBranchInputSchema>;

export const gitBranchTool: Tool = {
  name: 'git_branch',
  description: 'List or create git branches.',
  input_schema: {
    type: 'object',
    properties: {
      workingDirectory: { type: 'string', description: 'Working directory' },
      list: { type: 'boolean', description: 'List branches' },
      create: { type: 'string', description: 'Create branch' },
    },
  },
};

// ============================================================================
// GIT PUSH TOOL (conditional)
// ============================================================================

export const gitPushInputSchema = z.object({
  workingDirectory: z.string().optional().describe('Working directory'),
  remote: z.string().optional().default('origin').describe('Remote name'),
  branch: z.string().optional().describe('Branch to push'),
});

export type GitPushInput = z.infer<typeof gitPushInputSchema>;

export const gitPushTool: Tool = {
  name: 'git_push',
  description: 'Push commits to remote.',
  input_schema: {
    type: 'object',
    properties: {
      workingDirectory: { type: 'string', description: 'Working directory' },
      remote: { type: 'string', description: 'Remote name' },
      branch: { type: 'string', description: 'Branch to push' },
    },
  },
};

// ============================================================================
// EXPORT ALL GIT TOOLS
// ============================================================================

export const GIT_TOOLS: Tool[] = [
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  gitCommitTool,
  gitBranchTool,
  ...(process.env.ENABLE_GIT_PUSH === 'true' ? [gitPushTool] : []),
];

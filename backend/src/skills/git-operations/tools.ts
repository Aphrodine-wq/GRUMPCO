/**
 * Git Operations Skill - Tool Definitions
 */

import type Anthropic from '@anthropic-ai/sdk';

export const generateCommitMessageTool: Anthropic.Tool = {
  name: 'generate_commit_message',
  description: 'Generate a conventional commit message based on staged changes',
  input_schema: {
    type: 'object',
    properties: {
      includeBody: {
        type: 'boolean',
        description: 'Include a detailed body in the commit message',
        default: false,
      },
      type: {
        type: 'string',
        enum: ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore'],
        description: 'Override the commit type (auto-detected if not provided)',
      },
      scope: {
        type: 'string',
        description: 'Scope of the commit (e.g., component name)',
      },
    },
  },
};

export const gitStatusTool: Anthropic.Tool = {
  name: 'git_status',
  description: 'Get the current git status including staged, unstaged, and untracked files',
  input_schema: {
    type: 'object',
    properties: {},
  },
};

export const gitDiffTool: Anthropic.Tool = {
  name: 'git_diff',
  description: 'Get the diff of changes (staged or unstaged)',
  input_schema: {
    type: 'object',
    properties: {
      staged: {
        type: 'boolean',
        description: 'Show staged changes only',
        default: false,
      },
      file: {
        type: 'string',
        description: 'Show diff for a specific file',
      },
    },
  },
};

export const gitLogTool: Anthropic.Tool = {
  name: 'git_log',
  description: 'Get recent commit history',
  input_schema: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Number of commits to show',
        default: 10,
      },
      oneline: {
        type: 'boolean',
        description: 'Show one line per commit',
        default: true,
      },
    },
  },
};

export const suggestBranchNameTool: Anthropic.Tool = {
  name: 'suggest_branch_name',
  description: 'Suggest a branch name based on a task description',
  input_schema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Description of the task or feature',
      },
      type: {
        type: 'string',
        enum: ['feature', 'fix', 'refactor', 'docs', 'test', 'chore'],
        description: 'Type of branch',
        default: 'feature',
      },
    },
    required: ['task'],
  },
};

export const generatePRDescriptionTool: Anthropic.Tool = {
  name: 'generate_pr_description',
  description: 'Generate a pull request description based on branch changes',
  input_schema: {
    type: 'object',
    properties: {
      baseBranch: {
        type: 'string',
        description: 'Target branch for the PR (default: main)',
        default: 'main',
      },
      template: {
        type: 'string',
        enum: ['default', 'detailed', 'minimal'],
        description: 'Template style for the description',
        default: 'default',
      },
    },
  },
};

export const createCommitTool: Anthropic.Tool = {
  name: 'create_commit',
  description: 'Create a git commit with the specified message',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The commit message',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific files to include (stages all if not provided)',
      },
    },
    required: ['message'],
  },
};

export const definitions: Anthropic.Tool[] = [
  generateCommitMessageTool,
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  suggestBranchNameTool,
  generatePRDescriptionTool,
  createCommitTool,
];

/**
 * Git Operations Skill - Type Definitions
 */

export type CommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'build'
  | 'ci'
  | 'chore'
  | 'revert';

export interface CommitMessageRequest {
  diff?: string;
  stagedFiles?: string[];
  type?: CommitType;
  scope?: string;
  includeBody?: boolean;
  breaking?: boolean;
}

export interface CommitMessage {
  type: CommitType;
  scope?: string;
  subject: string;
  body?: string;
  footer?: string;
  breaking: boolean;
  full: string;
}

export interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  conflicts: string[];
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  oldPath?: string;
}

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  refs?: string[];
}

export interface BranchSuggestion {
  name: string;
  type: 'feature' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore';
  description: string;
}

export interface PRDescription {
  title: string;
  body: string;
  labels?: string[];
  reviewers?: string[];
}

export interface ConflictInfo {
  file: string;
  ours: string;
  theirs: string;
  base?: string;
  resolution?: 'ours' | 'theirs' | 'both' | 'custom';
}

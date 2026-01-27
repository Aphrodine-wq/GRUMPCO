/**
 * Diff Utilities
 * Functions for computing and formatting code diffs
 */

import { diffLines, diffWords, Change } from 'diff';

export interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface FileDiff {
  filePath: string;
  beforeContent: string;
  afterContent: string;
  changeType: 'created' | 'modified' | 'deleted';
  operations?: Array<{ type: string; lineStart: number; lineEnd?: number }>;
}

/**
 * Compute line-by-line diff between two code strings
 */
export function computeLineDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const changes = diffLines(before, after);

  const result: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const change of changes) {
    const lines = change.value.split('\n');
    // Remove the last empty line if it exists (from split)
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (change.added) {
      // Added lines
      for (const line of lines) {
        result.push({
          lineNumber: newLineNum,
          content: line,
          type: 'added',
          newLineNumber: newLineNum,
        });
        newLineNum++;
      }
    } else if (change.removed) {
      // Removed lines
      for (const line of lines) {
        result.push({
          lineNumber: oldLineNum,
          content: line,
          type: 'removed',
          oldLineNumber: oldLineNum,
        });
        oldLineNum++;
      }
    } else {
      // Unchanged lines
      for (const line of lines) {
        result.push({
          lineNumber: newLineNum,
          content: line,
          type: 'unchanged',
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        });
        oldLineNum++;
        newLineNum++;
      }
    }
  }

  return result;
}

/**
 * Compute word-level diff for inline highlighting
 */
export function computeWordDiff(before: string, after: string): Change[] {
  return diffWords(before, after);
}

/**
 * Get summary statistics for a diff
 */
export function getDiffSummary(diff: FileDiff): {
  added: number;
  removed: number;
  modified: number;
  total: number;
} {
  const lines = computeLineDiff(diff.beforeContent, diff.afterContent);
  const added = lines.filter((l) => l.type === 'added').length;
  const removed = lines.filter((l) => l.type === 'removed').length;
  const modified = lines.filter((l) => l.type === 'modified').length;

  return {
    added,
    removed,
    modified,
    total: lines.length,
  };
}

/**
 * Format diff summary as human-readable string
 */
export function formatDiffSummary(diff: FileDiff): string {
  const stats = getDiffSummary(diff);
  const parts: string[] = [];

  if (diff.changeType === 'created') {
    parts.push(`Created file with ${stats.added} line${stats.added !== 1 ? 's' : ''}`);
  } else if (diff.changeType === 'deleted') {
    parts.push(`Deleted file (${stats.removed} line${stats.removed !== 1 ? 's' : ''} removed)`);
  } else {
    if (stats.added > 0) parts.push(`+${stats.added}`);
    if (stats.removed > 0) parts.push(`-${stats.removed}`);
    if (stats.modified > 0) parts.push(`~${stats.modified}`);
    if (parts.length === 0) parts.push('No changes');
  }

  return parts.join(', ');
}

/**
 * Detect language from file path
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    md: 'markdown',
    vue: 'vue',
    svelte: 'svelte',
  };

  return langMap[ext] || 'plaintext';
}

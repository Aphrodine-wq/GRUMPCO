
/**
 * Diff Utilities
 */

import * as Diff from 'diff';

export type Change = Diff.Change;

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

export function computeLineDiff(before: string, after: string): DiffLine[] {
  const changes = Diff.diffLines(before, after);

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
  return Diff.diffWords(before, after);
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
  let added = 0;
  let removed = 0;
  let modified = 0;

  lines.forEach((line) => {
    if (line.type === 'added') added++;
    if (line.type === 'removed') removed++;
    // Modified is not strictly a line type in basic diffLines, but we keep the structure
  });

  return {
    added,
    removed,
    modified,
    total: added + removed, // Rough estimate
  };
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    svelte: 'svelte',
    html: 'html',
    css: 'css',
    json: 'json',
    py: 'python',
    rs: 'rust',
    sh: 'bash',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml'
  };
  return map[ext] || 'plaintext';
}

export function formatDiffSummary(diff: FileDiff): string {
  const { added, removed } = getDiffSummary(diff);
  const parts = [];
  if (added > 0) parts.push(`+${added}`);
  if (removed > 0) parts.push(`-${removed}`);
  return parts.length > 0 ? parts.join(' ') : 'No changes';
}

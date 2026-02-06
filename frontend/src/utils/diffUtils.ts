/**
 * Diff Utilities - Optimized for lazy loading
 */

// Type definitions for diff library
interface DiffChange {
  value: string | string[];
  added?: boolean;
  removed?: boolean;
}

export type Change = DiffChange;

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

// Lazy-loaded diff module
let diffModule: any = null;

/**
 * Gets or loads the diff module lazily
 */
async function getDiffModule(): Promise<any> {
  if (!diffModule) {
    diffModule = await import('diff');
  }
  return diffModule;
}

export async function computeLineDiff(before: string, after: string): Promise<DiffLine[]> {
  const Diff = await getDiffModule();
  
  // Use diffArrays on split lines for newline-insensitive line comparison.
  // diffLines includes newlines in tokens, causing line2 vs line2\n to differ.
  const oldLines = before.split(/\r?\n/);
  const newLines = after.split(/\r?\n/);
  const changes = Diff.diffArrays(oldLines, newLines);

  const result: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const change of changes) {
    const lines = change.value as string[];

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
export async function computeWordDiff(before: string, after: string): Promise<Change[]> {
  const Diff = await getDiffModule();
  return Diff.diffWords(before, after);
}

/**
 * Get summary statistics for a diff
 */
export async function getDiffSummary(diff: FileDiff): Promise<{
  added: number;
  removed: number;
  modified: number;
  total: number;
}> {
  const lines = await computeLineDiff(diff.beforeContent, diff.afterContent);
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
    yaml: 'yaml',
  };
  return map[ext] || 'plaintext';
}

export async function formatDiffSummary(diff: FileDiff): Promise<string> {
  const { added, removed } = await getDiffSummary(diff);
  const parts = [];
  if (added > 0) parts.push(`+${added}`);
  if (removed > 0) parts.push(`-${removed}`);
  return parts.length > 0 ? parts.join(' ') : 'No changes';
}

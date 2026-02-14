/**
 * File Activity Tracker
 *
 * Claude Code-style file tracking for streaming tool calls
 */

import type { ContentBlock } from '../../types';

export type FileAction = 'writing' | 'reading' | 'editing' | 'searching' | 'executing' | 'tool';

export interface ActiveFile {
  path: string;
  shortPath: string;
  action: FileAction;
}

// Tool sets for file activity detection
export const FILE_WRITE_TOOLS = new Set([
  'file_write',
  'file_edit',
  'write_file',
  'edit_file',
  'replace_file_content',
  'multi_replace_file_content',
  'write_to_file',
]);

export const FILE_READ_TOOLS = new Set([
  'read_file',
  'view_file',
  'view_file_outline',
  'view_code_item',
]);

export const SEARCH_TOOLS_SET = new Set([
  'grep_search',
  'find_by_name',
  'codebase_search',
  'search_web',
]);

export const EXEC_TOOLS_SET = new Set([
  'bash_execute',
  'run_command',
  'execute_command',
  'terminal',
]);

export function getShortFilePath(fullPath: string): string {
  const segments = fullPath.replace(/\\/g, '/').split('/');
  if (segments.length <= 3) return segments.join('/');
  return '…/' + segments.slice(-3).join('/');
}

export function getFileAction(toolName: string): FileAction {
  if (
    toolName === 'file_edit' ||
    toolName === 'edit_file' ||
    toolName === 'replace_file_content' ||
    toolName === 'multi_replace_file_content'
  )
    return 'editing';
  if (FILE_WRITE_TOOLS.has(toolName)) return 'writing';
  if (FILE_READ_TOOLS.has(toolName)) return 'reading';
  if (SEARCH_TOOLS_SET.has(toolName)) return 'searching';
  if (EXEC_TOOLS_SET.has(toolName)) return 'executing';
  return 'tool';
}

/**
 * Extract active file paths from streaming tool call blocks
 * for Claude Code-style display
 */
export function extractActiveFiles(streamingBlocks: ContentBlock[]): ActiveFile[] {
  const files: ActiveFile[] = [];
  const seen = new Set<string>();

  // Walk streaming blocks in reverse to get the most recent tools first
  for (let i = streamingBlocks.length - 1; i >= 0; i--) {
    const block = streamingBlocks[i] as any;
    if (block?.type !== 'tool_call') continue;

    const name = block.name || '';
    const input = block.input || {};

    // Try to extract file path
    const pathCandidates = [
      'path',
      'TargetFile',
      'AbsolutePath',
      'file_path',
      'filePath',
      'File',
      'SearchPath',
    ];

    let filePath: string | null = null;
    for (const key of pathCandidates) {
      if (typeof input[key] === 'string' && input[key].trim()) {
        filePath = input[key].trim();
        break;
      }
    }

    // For exec tools, show the command instead
    if (!filePath && EXEC_TOOLS_SET.has(name)) {
      const cmd = input.command ?? input.CommandLine ?? input.cmd;
      if (typeof cmd === 'string' && cmd.trim()) {
        filePath = cmd.trim().length > 50 ? cmd.trim().slice(0, 47) + '…' : cmd.trim();
      }
    }

    // For search tools, show the query
    if (!filePath && SEARCH_TOOLS_SET.has(name)) {
      const query = input.Query ?? input.query ?? input.Pattern;
      if (typeof query === 'string' && query.trim()) {
        filePath = `"${query.trim()}"`;
      }
    }

    if (filePath && !seen.has(filePath)) {
      seen.add(filePath);
      files.push({
        path: filePath,
        shortPath: getShortFilePath(filePath),
        action: getFileAction(name),
      });
    }

    // Only show the last 5 files max
    if (files.length >= 5) break;
  }

  return files.reverse(); // chronological order
}

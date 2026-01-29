/**
 * Tool Execution Service
 * Handles execution of all available tools with security validation.
 * Uses pathPolicyService for guard rails (blocklist/allowlist).
 */

import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { ToolExecutionResult } from '../tools/definitions.js';
import { logger } from '../utils/logger.js';
import { resolvePath, type PathOperation } from './pathPolicyService.js';

// ============================================================================
// DANGEROUS COMMANDS - BLOCKED
// ============================================================================

const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'dd',
  'mkfs',
  'fdisk',
  'wget',
  'curl http',
  'nc',
  'telnet',
  'reboot',
  'shutdown',
  'init',
  'halt',
  'poweroff',
];

/** When STRICT_COMMAND_ALLOWLIST=true, only these basenames are allowed for bash_execute. */
const STRICT_ALLOWLIST = process.env.STRICT_COMMAND_ALLOWLIST === 'true';
const ALLOWED_COMMANDS = new Set(['npm', 'npx', 'node', 'git', 'pnpm', 'yarn', 'tsx', 'ts-node']);

// ============================================================================
// TOOL EXECUTION SERVICE
// ============================================================================

export class ToolExecutionService {
  private workspaceRoot: string;
  private allowedDirs: string[];

  constructor(
    workspaceRoot: string = process.env.WORKSPACE_ROOT || '/tmp/workspace',
    options?: { allowedDirs?: string[] }
  ) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.allowedDirs = options?.allowedDirs ?? [];
  }

  /**
   * Validate a file path using path policy (blocklist, allowlist, traversal).
   * Returns resolved path when valid so callers use a single canonical path.
   */
  private validatePath(
    requestedPath: string,
    operation: PathOperation = 'read'
  ): { valid: boolean; error?: string; resolvedPath?: string } {
    const result = resolvePath(requestedPath, operation, {
      workspaceRoot: this.workspaceRoot,
      allowedDirs: this.allowedDirs,
      allowlistOnly: true,
    });
    if (result.ok) {
      return { valid: true, resolvedPath: result.resolved };
    }
    return { valid: false, error: (result as { reason?: string }).reason };
  }

  /**
   * Validate a bash command for dangerous operations.
   * When STRICT_COMMAND_ALLOWLIST=true, only ALLOWED_COMMANDS (npm, npx, git, etc.) are allowed.
   */
  private validateCommand(command: string): { valid: boolean; error?: string } {
    for (const dangerous of DANGEROUS_COMMANDS) {
      if (command.toLowerCase().includes(dangerous.toLowerCase())) {
        return { valid: false, error: `Dangerous command blocked: ${dangerous}` };
      }
    }

    if (STRICT_ALLOWLIST) {
      const trimmed = command.trim();
      const first = trimmed.split(/\s+/)[0] ?? '';
      const base = path.basename(first.replace(/^[\s"']+|["']$/g, ''));
      const name = base.toLowerCase();
      if (!ALLOWED_COMMANDS.has(name)) {
        return {
          valid: false,
          error: `Command not in allowlist (STRICT_COMMAND_ALLOWLIST): ${base}. Allowed: ${[...ALLOWED_COMMANDS].join(', ')}.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Execute a bash command with timeout and security checks
   */
  async executeBash(
    command: string,
    workingDirectory?: string,
    timeout: number = 30000
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate command
      const validation = this.validateCommand(command);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'bash_execute',
          executionTime: Date.now() - startTime,
        };
      }

      // Validate working directory if provided
      let cwd = this.workspaceRoot;
      if (workingDirectory) {
        const dirValidation = this.validatePath(workingDirectory, 'list');
        if (!dirValidation.valid) {
          return {
            success: false,
            error: dirValidation.error,
            toolName: 'bash_execute',
            executionTime: Date.now() - startTime,
          };
        }
        cwd = dirValidation.resolvedPath ?? path.resolve(this.workspaceRoot, workingDirectory);
      }

      // Execute command with timeout
      const output = execSync(command, {
        cwd,
        encoding: 'utf8',
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        success: true,
        output,
        toolName: 'bash_execute',
        executionTime: Date.now() - startTime,
      };
    } catch (error: unknown) {
      logger.error({ error, command }, 'Bash execution failed');
      const err = error as { code?: string; status?: number; stdout?: unknown; stderr?: unknown; message?: string };
      // Handle timeout
      if (err.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: `Command timed out after ${timeout}ms`,
          exitCode: -1,
          toolName: 'bash_execute',
          executionTime: Date.now() - startTime,
        };
      }

      // Handle command execution errors
      if (err.status) {
        return {
          success: false,
          output: err.stdout != null ? String(err.stdout) : '',
          error: err.stderr != null ? String(err.stderr) : (err.message ?? 'Unknown error'),
          exitCode: err.status,
          toolName: 'bash_execute',
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: 'bash_execute',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Read a file with optional encoding
   */
  async readFile(
    filePath: string,
    encoding: 'utf8' | 'base64' = 'utf8'
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const validation = this.validatePath(filePath, 'read');
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'file_read',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = validation.resolvedPath;
      if (!resolvedPath) {
        return { success: false, error: 'Path validation did not return resolved path', toolName: 'file_read', executionTime: Date.now() - startTime };
      }
      const content = await fs.readFile(resolvedPath, encoding);

      return {
        success: true,
        output: encoding === 'base64' ? content : content,
        toolName: 'file_read',
        executionTime: Date.now() - startTime,
      };
    } catch (error: unknown) {
      logger.error({ error, filePath }, 'File read failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: 'file_read',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(
    filePath: string,
    content: string,
    createDirectories: boolean = true
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const validation = this.validatePath(filePath, 'write');
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'file_write',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = validation.resolvedPath;
      if (!resolvedPath) {
        return { success: false, error: 'Path validation did not return resolved path', toolName: 'file_write', executionTime: Date.now() - startTime };
      }

      // Check if file exists to determine change type
      let beforeContent = '';
      let changeType: 'created' | 'modified' = 'created';
      try {
        beforeContent = await fs.readFile(resolvedPath, 'utf8');
        changeType = 'modified';
      } catch {
        changeType = 'created';
      }

      if (createDirectories) {
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      await fs.writeFile(resolvedPath, content, 'utf8');

      const displayPath = path.relative(this.workspaceRoot, resolvedPath) || filePath;
      return {
        success: true,
        output: `File ${changeType === 'created' ? 'created' : 'modified'} successfully: ${displayPath}`,
        toolName: 'file_write',
        executionTime: Date.now() - startTime,
        diff: {
          filePath: displayPath,
          beforeContent,
          afterContent: content,
          changeType,
        },
      };
    } catch (error: unknown) {
      logger.error({ error, filePath }, 'File write failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: 'file_write',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Edit specific lines in a file
   */
  async editFile(
    filePath: string,
    operations: Array<{
      type: 'insert' | 'replace' | 'delete';
      lineStart: number;
      lineEnd?: number;
      content?: string;
    }>
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const validation = this.validatePath(filePath, 'write');
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'file_edit',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = validation.resolvedPath;
      if (!resolvedPath) {
        return { success: false, error: 'Path validation did not return resolved path', toolName: 'file_edit', executionTime: Date.now() - startTime };
      }

      // Read file - capture before content
      const beforeContent = await fs.readFile(resolvedPath, 'utf8');
      const lines = beforeContent.split('\n');

      // Store operation details for diff
      const operationDetails = operations.map(op => ({
        type: op.type,
        lineStart: op.lineStart,
        lineEnd: op.lineEnd,
      }));

      // Apply operations in reverse order to avoid line number shifts
      const sortedOps = [...operations].sort((a, b) => b.lineStart - a.lineStart);

      for (const op of sortedOps) {
        const lineStart = op.lineStart - 1; // Convert to 0-indexed
        const lineEnd = op.lineEnd ? op.lineEnd - 1 : lineStart;

        switch (op.type) {
          case 'insert':
            lines.splice(lineStart, 0, op.content || '');
            break;
          case 'replace':
            lines.splice(lineStart, lineEnd - lineStart + 1, op.content || '');
            break;
          case 'delete':
            lines.splice(lineStart, lineEnd - lineStart + 1);
            break;
        }
      }

      // Capture after content
      const afterContent = lines.join('\n');

      // Write file back
      await fs.writeFile(resolvedPath, afterContent, 'utf8');

      return {
        success: true,
        output: `File edited successfully: ${operations.length} operation(s) applied`,
        toolName: 'file_edit',
        executionTime: Date.now() - startTime,
        diff: {
          filePath,
          beforeContent,
          afterContent,
          changeType: 'modified',
          operations: operationDetails,
        },
      };
    } catch (error: unknown) {
      logger.error({ error, filePath }, 'File edit failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: 'file_edit',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * List files in a directory
   */
  async listDirectory(dirPath: string, recursive: boolean = false): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const validation = this.validatePath(dirPath, 'list');
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'list_directory',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = validation.resolvedPath;
      if (!resolvedPath) {
        return { success: false, error: 'Path validation did not return resolved path', toolName: 'list_directory', executionTime: Date.now() - startTime };
      }
      const files = await this._listDir(resolvedPath, recursive, '');

      return {
        success: true,
        output: files.join('\n'),
        toolName: 'list_directory',
        executionTime: Date.now() - startTime,
      };
    } catch (error: unknown) {
      logger.error({ error, dirPath }, 'Directory listing failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: 'list_directory',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Search codebase for paths matching query (substring or simple pattern).
   * Returns up to maxResults paths as newline-separated list.
   */
  async searchCodebase(
    query: string,
    workingDirectory?: string,
    maxResults: number = 20
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const dir = workingDirectory ?? '.';
    const validation = this.validatePath(dir, 'list');
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        toolName: 'codebase_search',
        executionTime: Date.now() - startTime,
      };
    }
    try {
      const basePath = validation.resolvedPath;
      if (!basePath) {
        return { success: false, error: 'Path validation did not return resolved path', toolName: 'codebase_search', executionTime: Date.now() - startTime };
      }
      const q = query.toLowerCase().replace(/\*\./g, '.').replace(/\*\*/g, '');
      const collected: string[] = [];
      const walk = async (p: string): Promise<void> => {
        if (collected.length >= maxResults) return;
        const entries = await fs.readdir(p, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
          const full = path.join(p, e.name);
          const rel = full.replace(this.workspaceRoot, '').replace(/^[/\\]/, '');
          if (e.isDirectory()) {
            if (e.name !== 'node_modules' && e.name !== '.git') {
              await walk(full);
            }
          } else {
            if (collected.length >= maxResults) return;
            const match = rel.toLowerCase().includes(q) || e.name.toLowerCase().includes(query.toLowerCase());
            if (match) collected.push(rel);
          }
        }
      };
      await walk(basePath);
      return {
        success: true,
        output: collected.length ? collected.join('\n') : `No paths matching "${query}" in ${dir}.`,
        toolName: 'codebase_search',
        executionTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: (err as Error).message,
        toolName: 'codebase_search',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Recursively list directory contents
   */
  private async _listDir(dirPath: string, recursive: boolean, indent: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const displayPath = fullPath.replace(this.workspaceRoot, '');

      if (entry.isDirectory()) {
        files.push(`${indent}📁 ${displayPath}/`);
        if (recursive) {
          const subFiles = await this._listDir(fullPath, recursive, indent + '  ');
          files.push(...subFiles);
        }
      } else {
        files.push(`${indent}📄 ${displayPath}`);
      }
    }

    return files;
  }
}

// Export singleton instance
export const toolExecutionService = new ToolExecutionService();

/**
 * Tool Execution Service
 * Handles execution of all available tools with security validation
 */

import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { ToolExecutionResult } from '../tools/definitions.js';
import { logger } from '../utils/logger.js';

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

// ============================================================================
// TOOL EXECUTION SERVICE
// ============================================================================

export class ToolExecutionService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.env.WORKSPACE_ROOT || '/tmp/workspace') {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Validate a file path to prevent directory traversal
   */
  private validatePath(requestedPath: string): { valid: boolean; error?: string } {
    // Normalize the path
    const normalized = path.normalize(requestedPath);
    const resolved = path.resolve(this.workspaceRoot, normalized);

    // Check if the resolved path is within the workspace
    if (!resolved.startsWith(this.workspaceRoot)) {
      return {
        valid: false,
        error: `Path traversal detected: requested path is outside workspace root`,
      };
    }

    // Check for suspicious patterns
    if (normalized.includes('..')) {
      return {
        valid: false,
        error: `Invalid path pattern: cannot use .. in paths`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate a bash command for dangerous operations
   */
  private validateCommand(command: string): { valid: boolean; error?: string } {
    // Check for dangerous commands
    for (const dangerous of DANGEROUS_COMMANDS) {
      if (command.toLowerCase().includes(dangerous.toLowerCase())) {
        return {
          valid: false,
          error: `Dangerous command blocked: ${dangerous}`,
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
      if (workingDirectory) {
        const dirValidation = this.validatePath(workingDirectory);
        if (!dirValidation.valid) {
          return {
            success: false,
            error: dirValidation.error,
            toolName: 'bash_execute',
            executionTime: Date.now() - startTime,
          };
        }
      }

      // Use workspace root or provided directory
      const cwd = workingDirectory ? path.resolve(this.workspaceRoot, workingDirectory) : this.workspaceRoot;

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
    } catch (error: any) {
      logger.error({ error, command }, 'Bash execution failed');

      // Handle timeout
      if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: `Command timed out after ${timeout}ms`,
          exitCode: -1,
          toolName: 'bash_execute',
          executionTime: Date.now() - startTime,
        };
      }

      // Handle command execution errors
      if (error.status) {
        return {
          success: false,
          output: error.stdout?.toString() || '',
          error: error.stderr?.toString() || error.message,
          exitCode: error.status,
          toolName: 'bash_execute',
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: false,
        error: error.message,
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
      // Validate path
      const validation = this.validatePath(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'file_read',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = path.resolve(this.workspaceRoot, filePath);
      const content = await fs.readFile(resolvedPath, encoding);

      return {
        success: true,
        output: encoding === 'base64' ? content : content,
        toolName: 'file_read',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error({ error, filePath }, 'File read failed');

      return {
        success: false,
        error: error.message,
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
      // Validate path
      const validation = this.validatePath(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'file_write',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = path.resolve(this.workspaceRoot, filePath);

      // Check if file exists to determine change type
      let beforeContent = '';
      let changeType: 'created' | 'modified' = 'created';
      try {
        beforeContent = await fs.readFile(resolvedPath, 'utf8');
        changeType = 'modified';
      } catch {
        // File doesn't exist, will be created
        changeType = 'created';
      }

      // Create directories if needed
      if (createDirectories) {
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      // Write file
      await fs.writeFile(resolvedPath, content, 'utf8');

      return {
        success: true,
        output: `File ${changeType === 'created' ? 'created' : 'modified'} successfully: ${filePath}`,
        toolName: 'file_write',
        executionTime: Date.now() - startTime,
        diff: {
          filePath,
          beforeContent,
          afterContent: content,
          changeType,
        },
      };
    } catch (error: any) {
      logger.error({ error, filePath }, 'File write failed');

      return {
        success: false,
        error: error.message,
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
      // Validate path
      const validation = this.validatePath(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'file_edit',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = path.resolve(this.workspaceRoot, filePath);

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
    } catch (error: any) {
      logger.error({ error, filePath }, 'File edit failed');

      return {
        success: false,
        error: error.message,
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
      // Validate path
      const validation = this.validatePath(dirPath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'list_directory',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = path.resolve(this.workspaceRoot, dirPath);
      const files = await this._listDir(resolvedPath, recursive, '');

      return {
        success: true,
        output: files.join('\n'),
        toolName: 'list_directory',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error({ error, dirPath }, 'Directory listing failed');

      return {
        success: false,
        error: error.message,
        toolName: 'list_directory',
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

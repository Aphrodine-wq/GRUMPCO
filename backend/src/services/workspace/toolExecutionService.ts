/**
 * Tool Execution Service
 *
 * Provides secure, sandboxed execution of file system and shell operations
 * for AI-assisted development. All operations are validated against security
 * policies including path traversal prevention, command blocklisting, and
 * optional strict allowlists.
 *
 * @module services/toolExecutionService
 *
 * @security
 * - All file paths are validated against workspace boundaries
 * - Dangerous commands (rm -rf /, dd, mkfs, etc.) are blocked
 * - Optional STRICT_COMMAND_ALLOWLIST mode limits commands to npm, git, etc.
 * - Git push is disabled by default (requires ENABLE_GIT_PUSH=true)
 * - Integrated with guardrails enforcement for additional security checks
 *
 * @example
 * ```typescript
 * import { toolExecutionService } from './toolExecutionService.js';
 *
 * // Execute a safe command
 * const result = await toolExecutionService.executeBash('npm test');
 * if (result.success) {
 *   console.log(result.output);
 * }
 *
 * // Read a file
 * const file = await toolExecutionService.readFile('src/index.ts');
 *
 * // List directory
 * const files = await toolExecutionService.listDirectory('.', true);
 * ```
 */

import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import type { ToolExecutionResult } from '../../tools/types.js';
import { logger } from '../../utils/logger.js';
import { resolvePath, type PathOperation } from '../security/pathPolicyService.js';
import { getGuardrailsConfig, isHighRiskCommand } from '../../config/guardrailsConfig.js';
import {
  enforceToolGuardrails,
  type ToolExecutionRequest,
  type EnforcementResult,
} from '../security/guardrailsEnforcementService.js';
import {
  classifyCommand,
  classifyFileOperation,
  classifyGitOperation,
  checkApprovalGate,
  type ApprovalContext,
} from '../security/approvalService.js';

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

/**
 * Service class for executing file system and shell operations securely.
 *
 * Provides methods for:
 * - Bash/terminal command execution
 * - File read/write/edit operations
 * - Directory listing and codebase search
 * - Git operations (status, diff, log, commit, branch, push)
 *
 * All operations are sandboxed to the configured workspace root and
 * validated against security policies.
 *
 * @class ToolExecutionService
 *
 * @example
 * ```typescript
 * const service = new ToolExecutionService('/path/to/workspace');
 * const result = await service.readFile('package.json');
 * ```
 */
export class ToolExecutionService {
  /** Absolute path to the workspace root directory */
  private workspaceRoot: string;
  /** Additional directories allowed for operations outside workspace */
  private allowedDirs: string[];
  /** User ID for guardrails context */
  private userId?: string;
  /** Session ID for guardrails context */
  private sessionId?: string;
  /** Whether guardrails are enabled for this instance */
  private guardrailsEnabled: boolean;

  /**
   * Creates a new ToolExecutionService instance.
   *
   * @param {string} [workspaceRoot='/tmp/workspace'] - Root directory for all operations
   * @param {Object} [options] - Configuration options
   * @param {string[]} [options.allowedDirs] - Additional directories to allow access
   * @param {string} [options.userId] - User ID for guardrails/audit logging
   * @param {string} [options.sessionId] - Session ID for guardrails/audit logging
   * @param {boolean} [options.enableGuardrails] - Enable guardrails enforcement (default: true)
   *
   * @example
   * ```typescript
   * // Default workspace
   * const service = new ToolExecutionService();
   *
   * // Custom workspace with additional allowed dirs
   * const service = new ToolExecutionService('/my/project', {
   *   allowedDirs: ['/shared/libs']
   * });
   *
   * // With guardrails context
   * const service = new ToolExecutionService('/my/project', {
   *   userId: 'user-123',
   *   sessionId: 'session-456',
   *   enableGuardrails: true
   * });
   * ```
   */
  constructor(
    workspaceRoot: string = process.env.WORKSPACE_ROOT || process.cwd(),
    options?: {
      allowedDirs?: string[];
      userId?: string;
      sessionId?: string;
      enableGuardrails?: boolean;
    }
  ) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.allowedDirs = options?.allowedDirs ?? [];
    this.userId = options?.userId;
    this.sessionId = options?.sessionId;
    this.guardrailsEnabled = options?.enableGuardrails ?? getGuardrailsConfig().enabled;
  }

  /**
   * Set the user and session context for guardrails
   */
  setContext(userId: string, sessionId?: string): void {
    this.userId = userId;
    this.sessionId = sessionId;
  }

  /**
   * Check guardrails enforcement for a tool operation.
   * Returns an error result if the operation is blocked.
   */
  private async checkGuardrails(
    tool: string,
    parameters: Record<string, unknown>,
    toolName: string,
    startTime: number
  ): Promise<ToolExecutionResult | null> {
    if (!this.guardrailsEnabled) {
      return null; // Guardrails disabled, allow operation
    }

    const request: ToolExecutionRequest = {
      tool,
      parameters,
      context: {
        userId: this.userId ?? 'anonymous',
        sessionId: this.sessionId ?? '',
        workspaceRoot: this.workspaceRoot,
      },
    };

    try {
      const result: EnforcementResult = await enforceToolGuardrails(request);

      if (!result.allowed) {
        const requiresApproval = result.action === 'require_approval';
        const approvalId = result.approvalRequired?.approvalId;

        logger.warn(
          {
            tool,
            parameters,
            reason: result.reason,
            requiresApproval,
          },
          'Guardrails blocked tool execution'
        );

        return {
          success: false,
          error: result.reason ?? 'Operation blocked by guardrails',
          toolName,
          executionTime: Date.now() - startTime,
          metadata: {
            blockedByGuardrails: true,
            requiresApproval,
            approvalId,
          },
        };
      }
    } catch (err) {
      logger.error({ err, tool }, 'Guardrails check failed');
      // In case of guardrails error, we fail closed (block the operation)
      if (getGuardrailsConfig().strictMode === 'enforce') {
        return {
          success: false,
          error: 'Guardrails check failed - operation blocked for safety',
          toolName,
          executionTime: Date.now() - startTime,
        };
      }
    }

    return null; // Guardrails passed, continue with operation
  }

  /**
   * Check approval gate for an action.
   * Returns true if approved or no approval needed.
   */
  private checkApprovalRequired(
    action: string,
    parameters?: Record<string, unknown>
  ): { required: boolean; riskLevel: string; reason: string } {
    if (!this.guardrailsEnabled || !this.userId) {
      return {
        required: false,
        riskLevel: 'low',
        reason: 'Guardrails disabled or no user context',
      };
    }

    const approvalContext: ApprovalContext = {
      userId: this.userId,
      sessionId: this.sessionId,
      action,
      parameters,
      workspaceRoot: this.workspaceRoot,
    };

    const gate = checkApprovalGate(approvalContext);
    return {
      required: gate.required && !gate.autoApprove,
      riskLevel: gate.riskLevel,
      reason: gate.reason,
    };
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
        return {
          valid: false,
          error: `Dangerous command blocked: ${dangerous}`,
        };
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
   * Execute a terminal command (run and return output). Same security as bash_execute; toolName is terminal_execute.
   */
  async executeTerminal(
    command: string,
    workingDirectory?: string,
    timeout: number = 60000
  ): Promise<ToolExecutionResult> {
    const result = await this.executeBash(command, workingDirectory, Math.min(timeout, 60000));
    result.toolName = 'terminal_execute';
    return result;
  }

  /**
   * Execute a bash command with security validation and timeout.
   *
   * Commands are validated against a blocklist of dangerous operations
   * (rm -rf /, dd, mkfs, etc.). When STRICT_COMMAND_ALLOWLIST is enabled,
   * only whitelisted commands (npm, git, node, etc.) are permitted.
   *
   * @param {string} command - The bash command to execute
   * @param {string} [workingDirectory] - Working directory (relative to workspace)
   * @param {number} [timeout=30000] - Timeout in milliseconds
   * @returns {Promise<ToolExecutionResult>} Execution result with output or error
   *
   * @throws Never throws; errors are returned in the result object
   *
   * @example
   * ```typescript
   * const result = await service.executeBash('npm test', './frontend');
   * if (result.success) {
   *   console.log('Tests passed:', result.output);
   * } else {
   *   console.error('Tests failed:', result.error);
   * }
   * ```
   *
   * @security Dangerous commands are blocked; see DANGEROUS_COMMANDS constant
   */
  async executeBash(
    command: string,
    workingDirectory?: string,
    timeout: number = 30000
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Check guardrails first
      const guardrailResult = await this.checkGuardrails(
        'bash',
        { command, workingDirectory },
        'bash_execute',
        startTime
      );
      if (guardrailResult) {
        return guardrailResult;
      }

      // Check if command is high-risk and requires approval
      const classification = classifyCommand(command);
      if (classification.riskLevel === 'high' || isHighRiskCommand(command)) {
        const approval = this.checkApprovalRequired(classification.action, {
          command,
        });
        if (approval.required) {
          return {
            success: false,
            error: `High-risk command requires approval: ${approval.reason}`,
            toolName: 'bash_execute',
            executionTime: Date.now() - startTime,
            metadata: {
              requiresApproval: true,
              riskLevel: approval.riskLevel,
              action: classification.action,
            },
          };
        }
      }

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
      // On Windows, explicitly use cmd.exe; on Unix, use default shell (bash/sh)
      const shellOpt = process.platform === 'win32' ? { shell: 'cmd.exe' as const } : {};
      const output = execSync(command, {
        cwd,
        encoding: 'utf8',
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        ...shellOpt,
      });

      return {
        success: true,
        output,
        toolName: 'bash_execute',
        executionTime: Date.now() - startTime,
      };
    } catch (error: unknown) {
      logger.error({ error, command }, 'Bash execution failed');
      const err = error as {
        code?: string;
        status?: number;
        stdout?: unknown;
        stderr?: unknown;
        message?: string;
      };
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
   * Read a file from the workspace with optional encoding.
   *
   * The file path is validated against workspace boundaries and
   * security policies before reading.
   *
   * @param {string} filePath - Path to the file (relative or absolute)
   * @param {'utf8' | 'base64'} [encoding='utf8'] - File encoding
   * @returns {Promise<ToolExecutionResult>} Result with file content or error
   *
   * @throws Never throws; errors are returned in the result object
   *
   * @example
   * ```typescript
   * // Read as text
   * const result = await service.readFile('src/index.ts');
   *
   * // Read as base64 (for binary files)
   * const image = await service.readFile('assets/logo.png', 'base64');
   * ```
   */
  async readFile(
    filePath: string,
    encoding: 'utf8' | 'base64' = 'utf8',
    startLine?: number,
    endLine?: number
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
        return {
          success: false,
          error: 'Path validation did not return resolved path',
          toolName: 'file_read',
          executionTime: Date.now() - startTime,
        };
      }
      const content = await fs.readFile(resolvedPath, encoding);

      // If line range requested and encoding is utf8, return only the requested slice
      if (encoding === 'utf8' && (startLine !== undefined || endLine !== undefined)) {
        const allLines = content.split('\n');
        const totalLines = allLines.length;
        const start = Math.max(1, startLine ?? 1);
        const end = Math.min(totalLines, endLine ?? totalLines);

        if (start > totalLines) {
          return {
            success: false,
            error: `startLine ${start} exceeds file length (${totalLines} lines)`,
            toolName: 'file_read',
            executionTime: Date.now() - startTime,
          };
        }

        const slicedLines = allLines.slice(start - 1, end);
        const numbered = slicedLines.map((line, i) => `${start + i}: ${line}`);
        const header = `Showing lines ${start}-${end} of ${totalLines} total`;

        return {
          success: true,
          output: `${header}\n${numbered.join('\n')}`,
          toolName: 'file_read',
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: true,
        output: content,
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
   * Write content to a file in the workspace.
   *
   * Creates parent directories if they don't exist (when createDirectories=true).
   * Returns diff information for version control and undo operations.
   *
   * @param {string} filePath - Path to the file (relative or absolute)
   * @param {string} content - Content to write
   * @param {boolean} [createDirectories=true] - Create parent directories if missing
   * @returns {Promise<ToolExecutionResult>} Result with success status and diff
   *
   * @throws Never throws; errors are returned in the result object
   *
   * @example
   * ```typescript
   * const result = await service.writeFile('src/new-file.ts', 'export const x = 1;');
   * if (result.success) {
   *   console.log('Created:', result.diff?.changeType); // 'created' or 'modified'
   * }
   * ```
   */
  async writeFile(
    filePath: string,
    content: string,
    createDirectories: boolean = true
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Check guardrails first
      const guardrailResult = await this.checkGuardrails(
        'file_write',
        { filePath, contentLength: content.length },
        'file_write',
        startTime
      );
      if (guardrailResult) {
        return guardrailResult;
      }

      // Check if writing to sensitive file requires approval
      const classification = classifyFileOperation('write', filePath);
      if (classification.riskLevel === 'high' || classification.riskLevel === 'medium') {
        const approval = this.checkApprovalRequired(classification.action, {
          filePath,
        });
        if (approval.required) {
          return {
            success: false,
            error: `Writing to this file requires approval: ${approval.reason}`,
            toolName: 'file_write',
            executionTime: Date.now() - startTime,
            metadata: {
              requiresApproval: true,
              riskLevel: approval.riskLevel,
              action: classification.action,
            },
          };
        }
      }

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
        return {
          success: false,
          error: 'Path validation did not return resolved path',
          toolName: 'file_write',
          executionTime: Date.now() - startTime,
        };
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
   * Edit specific lines in a file.
   *
   * Supports three operation types:
   * - `insert`: Insert content at a line number
   * - `replace`: Replace lines between lineStart and lineEnd
   * - `delete`: Delete lines between lineStart and lineEnd
   *
   * Operations are applied in reverse order to avoid line number shifts.
   *
   * @param {string} filePath - Path to the file
   * @param {Array<Object>} operations - Array of edit operations
   * @param {'insert' | 'replace' | 'delete'} operations[].type - Operation type
   * @param {number} operations[].lineStart - Starting line (1-indexed)
   * @param {number} [operations[].lineEnd] - Ending line for replace/delete
   * @param {string} [operations[].content] - Content for insert/replace
   * @returns {Promise<ToolExecutionResult>} Result with diff information
   *
   * @example
   * ```typescript
   * const result = await service.editFile('src/index.ts', [
   *   { type: 'replace', lineStart: 5, lineEnd: 7, content: 'new code' },
   *   { type: 'insert', lineStart: 10, content: '// comment' },
   *   { type: 'delete', lineStart: 15, lineEnd: 20 },
   * ]);
   * ```
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
        return {
          success: false,
          error: 'Path validation did not return resolved path',
          toolName: 'file_edit',
          executionTime: Date.now() - startTime,
        };
      }

      // Read file - capture before content
      const beforeContent = await fs.readFile(resolvedPath, 'utf8');
      const lines = beforeContent.split('\n');

      // Store operation details for diff
      const operationDetails = operations.map((op) => ({
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
   * List files in a directory.
   *
   * Returns a formatted list with emoji indicators for files and directories.
   * When recursive=true, traverses all subdirectories.
   *
   * @param {string} dirPath - Path to the directory
   * @param {boolean} [recursive=false] - Include subdirectories recursively
   * @returns {Promise<ToolExecutionResult>} Result with file listing
   *
   * @example
   * ```typescript
   * const result = await service.listDirectory('src', true);
   * // Output:
   * // 📁 /src/
   * //   📄 /src/index.ts
   * //   📁 /src/utils/
   * //     📄 /src/utils/helper.ts
   * ```
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
        return {
          success: false,
          error: 'Path validation did not return resolved path',
          toolName: 'list_directory',
          executionTime: Date.now() - startTime,
        };
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
        return {
          success: false,
          error: 'Path validation did not return resolved path',
          toolName: 'codebase_search',
          executionTime: Date.now() - startTime,
        };
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
            const match =
              rel.toLowerCase().includes(q) || e.name.toLowerCase().includes(query.toLowerCase());
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
   * Search file contents for a pattern (like ripgrep/grep).
   * Returns matching lines with file:line: content format.
   *
   * @param {string} pattern - Search pattern (literal or regex)
   * @param {string} [searchPath] - Directory or file to search
   * @param {boolean} [isRegex=false] - Treat pattern as regex
   * @param {string[]} [includes] - Glob patterns to filter files
   * @param {number} [maxResults=50] - Max matching lines
   * @param {boolean} [caseSensitive=true] - Case-sensitive search
   * @returns {Promise<ToolExecutionResult>} Matching lines
   */
  async grepSearch(
    pattern: string,
    searchPath?: string,
    isRegex: boolean = false,
    includes?: string[],
    maxResults: number = 50,
    caseSensitive: boolean = true
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const dir = searchPath ?? '.';
    const validation = this.validatePath(dir, 'list');
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        toolName: 'grep_search',
        executionTime: Date.now() - startTime,
      };
    }
    try {
      const basePath = validation.resolvedPath;
      if (!basePath) {
        return {
          success: false,
          error: 'Path validation did not return resolved path',
          toolName: 'grep_search',
          executionTime: Date.now() - startTime,
        };
      }

      // Build the matcher
      let regex: RegExp;
      try {
        const flags = caseSensitive ? '' : 'i';
        regex = isRegex
          ? new RegExp(pattern, flags)
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      } catch (e) {
        return {
          success: false,
          error: `Invalid regex pattern: ${(e as Error).message}`,
          toolName: 'grep_search',
          executionTime: Date.now() - startTime,
        };
      }

      // Build include globs matcher (simple extension matching)
      const includeExts: string[] | null = includes?.length
        ? includes.map((g) => g.replace(/^\*\.?/, '.').toLowerCase())
        : null;

      const matches: string[] = [];
      const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__']);
      const BINARY_EXTS = new Set([
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.ico',
        '.woff',
        '.woff2',
        '.ttf',
        '.eot',
        '.zip',
        '.tar',
        '.gz',
        '.pdf',
        '.exe',
        '.dll',
        '.so',
        '.dylib',
      ]);

      // Check if basePath is a file (not a directory)
      const baseStat = await fs.stat(basePath).catch(() => null);
      if (!baseStat) {
        return {
          success: false,
          error: `Path not found: ${dir}`,
          toolName: 'grep_search',
          executionTime: Date.now() - startTime,
        };
      }

      const searchFile = async (filePath: string): Promise<void> => {
        if (matches.length >= maxResults) return;
        const ext = path.extname(filePath).toLowerCase();
        if (BINARY_EXTS.has(ext)) return;
        if (includeExts && !includeExts.includes(ext)) return;

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');
          const rel = filePath.replace(this.workspaceRoot, '').replace(/^[/\\]/, '');
          for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
            if (regex.test(lines[i])) {
              matches.push(`${rel}:${i + 1}: ${lines[i].trimEnd()}`);
            }
          }
        } catch {
          // Skip files we can't read (binary, permission, etc.)
        }
      };

      if (baseStat.isFile()) {
        await searchFile(basePath);
      } else {
        const walk = async (p: string): Promise<void> => {
          if (matches.length >= maxResults) return;
          const entries = await fs.readdir(p, { withFileTypes: true }).catch(() => []);
          for (const e of entries) {
            if (matches.length >= maxResults) return;
            const full = path.join(p, e.name);
            if (e.isDirectory()) {
              if (!SKIP_DIRS.has(e.name)) {
                await walk(full);
              }
            } else {
              await searchFile(full);
            }
          }
        };
        await walk(basePath);
      }

      return {
        success: true,
        output: matches.length
          ? `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}:\n${matches.join('\n')}`
          : `No matches for "${pattern}" in ${dir}.`,
        toolName: 'grep_search',
        executionTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: (err as Error).message,
        toolName: 'grep_search',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Find exact text in a file and replace it.
   * More reliable than line-number-based editing because it doesn't break
   * when lines shift.
   *
   * @param {string} filePath - Path to the file
   * @param {string} search - Exact text to find
   * @param {string} replace - Replacement text
   * @param {boolean} [allowMultiple=false] - Replace all occurrences
   * @returns {Promise<ToolExecutionResult>} Result with diff
   */
  async searchAndReplace(
    filePath: string,
    search: string,
    replace: string,
    allowMultiple: boolean = false
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const validation = this.validatePath(filePath, 'write');
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'search_and_replace',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = validation.resolvedPath;
      if (!resolvedPath) {
        return {
          success: false,
          error: 'Path validation did not return resolved path',
          toolName: 'search_and_replace',
          executionTime: Date.now() - startTime,
        };
      }

      const beforeContent = await fs.readFile(resolvedPath, 'utf8');

      // Count occurrences
      let count = 0;
      let idx = 0;
      while ((idx = beforeContent.indexOf(search, idx)) !== -1) {
        count++;
        idx += search.length;
      }

      if (count === 0) {
        return {
          success: false,
          error: `Search text not found in file. Make sure the search text matches exactly, including whitespace and indentation.`,
          toolName: 'search_and_replace',
          executionTime: Date.now() - startTime,
        };
      }

      if (count > 1 && !allowMultiple) {
        return {
          success: false,
          error: `Found ${count} occurrences of the search text. Set allowMultiple: true to replace all, or make the search text more specific to match only one occurrence.`,
          toolName: 'search_and_replace',
          executionTime: Date.now() - startTime,
        };
      }

      // Perform replacement
      const afterContent = allowMultiple
        ? beforeContent.split(search).join(replace)
        : beforeContent.replace(search, replace);

      await fs.writeFile(resolvedPath, afterContent, 'utf8');

      const displayPath = path.relative(this.workspaceRoot, resolvedPath) || filePath;
      return {
        success: true,
        output: `Replaced ${allowMultiple ? count : 1} occurrence(s) in ${displayPath}`,
        toolName: 'search_and_replace',
        executionTime: Date.now() - startTime,
        diff: {
          filePath: displayPath,
          beforeContent,
          afterContent,
          changeType: 'modified',
        },
      };
    } catch (error: unknown) {
      logger.error({ error, filePath }, 'Search and replace failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: 'search_and_replace',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get the structural outline of a source file.
   * Returns functions, classes, methods, interfaces, and their line numbers.
   * Uses lightweight regex-based parsing — no external AST dependency.
   *
   * @param {string} filePath - Path to the file
   * @param {number} [maxItems=100] - Maximum items to return
   * @returns {Promise<ToolExecutionResult>} Outline with line numbers
   */
  async fileOutline(filePath: string, maxItems: number = 100): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const validation = this.validatePath(filePath, 'read');
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          toolName: 'file_outline',
          executionTime: Date.now() - startTime,
        };
      }

      const resolvedPath = validation.resolvedPath;
      if (!resolvedPath) {
        return {
          success: false,
          error: 'Path validation did not return resolved path',
          toolName: 'file_outline',
          executionTime: Date.now() - startTime,
        };
      }

      const content = await fs.readFile(resolvedPath, 'utf8');
      const lines = content.split('\n');
      const ext = path.extname(resolvedPath).toLowerCase();

      // Language-specific regex patterns for structural elements
      const patterns: Array<{ label: string; regex: RegExp }> = [];

      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        // TypeScript / JavaScript
        patterns.push(
          { label: 'class', regex: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/ },
          { label: 'interface', regex: /^(?:export\s+)?interface\s+(\w+)/ },
          { label: 'type', regex: /^(?:export\s+)?type\s+(\w+)\s*[=<]/ },
          { label: 'enum', regex: /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/ },
          { label: 'function', regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
          {
            label: 'const fn',
            regex:
              /^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*(?:=>|:\s*\()/,
          },
          {
            label: 'method',
            regex:
              /^\s+(?:(?:public|private|protected|static|async|readonly|abstract|override|get|set)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(/,
          }
        );
      } else if (['.py'].includes(ext)) {
        // Python
        patterns.push(
          { label: 'class', regex: /^class\s+(\w+)/ },
          { label: 'function', regex: /^(?:async\s+)?def\s+(\w+)/ },
          { label: 'method', regex: /^\s+(?:async\s+)?def\s+(\w+)/ }
        );
      } else if (['.rs'].includes(ext)) {
        // Rust
        patterns.push(
          { label: 'struct', regex: /^(?:pub\s+)?struct\s+(\w+)/ },
          { label: 'enum', regex: /^(?:pub\s+)?enum\s+(\w+)/ },
          { label: 'trait', regex: /^(?:pub\s+)?trait\s+(\w+)/ },
          { label: 'impl', regex: /^impl(?:<[^>]*>)?\s+(\w+)/ },
          { label: 'function', regex: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/ },
          { label: 'method', regex: /^\s+(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/ }
        );
      } else if (['.go'].includes(ext)) {
        // Go
        patterns.push(
          { label: 'struct', regex: /^type\s+(\w+)\s+struct/ },
          { label: 'interface', regex: /^type\s+(\w+)\s+interface/ },
          { label: 'function', regex: /^func\s+(\w+)\s*\(/ },
          { label: 'method', regex: /^func\s+\([^)]+\)\s+(\w+)\s*\(/ }
        );
      } else if (['.java', '.kt', '.scala'].includes(ext)) {
        // JVM languages
        patterns.push(
          {
            label: 'class',
            regex:
              /^(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?(?:data\s+)?class\s+(\w+)/,
          },
          { label: 'interface', regex: /^(?:public\s+)?interface\s+(\w+)/ },
          {
            label: 'function',
            regex:
              /^(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:suspend\s+)?(?:fun|void|\w+)\s+(\w+)\s*\(/,
          }
        );
      } else if (['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'].includes(ext)) {
        // C/C++
        patterns.push(
          { label: 'class', regex: /^(?:template\s*<[^>]*>\s*)?class\s+(\w+)/ },
          { label: 'struct', regex: /^(?:typedef\s+)?struct\s+(\w+)/ },
          {
            label: 'function',
            regex: /^(?:(?:static|inline|virtual|extern)\s+)*(?:\w+(?:::\w+)*\s+)+(\w+)\s*\(/,
          }
        );
      } else if (['.svelte', '.vue'].includes(ext)) {
        // Svelte/Vue — pick up script block functions
        patterns.push(
          { label: 'function', regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
          {
            label: 'const fn',
            regex:
              /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*(?:=>|:\s*\()/,
          }
        );
      } else {
        // Generic: try to find function-like patterns
        patterns.push({
          label: 'function',
          regex: /^(?:(?:export|public|private|def|fn|func|function)\s+)+(\w+)/,
        });
      }

      const items: string[] = [];
      for (let i = 0; i < lines.length && items.length < maxItems; i++) {
        const line = lines[i];
        for (const { label, regex } of patterns) {
          const match = regex.exec(line);
          if (match) {
            const name = match[1];
            // Include trimmed line for context (cap at 120 chars)
            const preview = line.trimStart().slice(0, 120);
            items.push(`L${i + 1} [${label}] ${name}: ${preview}`);
            break; // Only match first pattern per line
          }
        }
      }

      const totalLines = lines.length;
      const displayPath = path.relative(this.workspaceRoot, resolvedPath) || filePath;

      if (items.length === 0) {
        return {
          success: true,
          output: `${displayPath} (${totalLines} lines) — no structural elements found. Try file_read instead.`,
          toolName: 'file_outline',
          executionTime: Date.now() - startTime,
        };
      }

      return {
        success: true,
        output: `${displayPath} (${totalLines} lines, ${items.length} items):\n${items.join('\n')}`,
        toolName: 'file_outline',
        executionTime: Date.now() - startTime,
      };
    } catch (error: unknown) {
      logger.error({ error, filePath }, 'File outline failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: 'file_outline',
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

  /**
   * Resolve working directory for git (must be under workspace). Returns cwd string.
   */
  private resolveGitCwd(workingDirectory?: string): {
    valid: boolean;
    error?: string;
    cwd?: string;
  } {
    const dir = workingDirectory ?? '.';
    const validation = this.validatePath(dir, 'list');
    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }
    const cwd = validation.resolvedPath ?? path.resolve(this.workspaceRoot, dir);
    return { valid: true, cwd };
  }

  /**
   * Run git command in workspace; returns output or error.
   */
  private runGit(args: string[], cwd: string, timeout: number = 10000): ToolExecutionResult {
    const startTime = Date.now();
    const cmd = `git ${args.join(' ')}`;
    try {
      const output = execSync(cmd, {
        cwd,
        encoding: 'utf8',
        timeout,
        maxBuffer: 2 * 1024 * 1024,
      });
      return {
        success: true,
        output: output?.trim() ?? '',
        toolName: 'git',
        executionTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const e = err as {
        status?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      const stderr = e.stderr ?? e.message ?? String(err);
      return {
        success: false,
        error: stderr,
        output: e.stdout?.trim(),
        exitCode: e.status ?? -1,
        toolName: 'git',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get git status for the workspace.
   *
   * Returns short-format status with branch information.
   *
   * @param {string} [workingDirectory] - Working directory for git command
   * @returns {Promise<ToolExecutionResult>} Git status output
   *
   * @example
   * ```typescript
   * const result = await service.gitStatus();
   * // Output: "## main...origin/main\n M src/index.ts\n?? new-file.ts"
   * ```
   */
  async gitStatus(workingDirectory?: string): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const resolved = this.resolveGitCwd(workingDirectory);
    if (!resolved.valid || !resolved.cwd) {
      return {
        success: false,
        error: resolved.error,
        toolName: 'git_status',
        executionTime: Date.now() - startTime,
      };
    }
    const result = this.runGit(['status', '--short', '-b'], resolved.cwd);
    result.toolName = 'git_status';
    return result;
  }

  /**
   * Get git diff for staged or unstaged changes.
   *
   * @param {string} [workingDirectory] - Working directory for git command
   * @param {boolean} [staged=false] - Show staged changes only
   * @param {string} [file] - Limit diff to specific file
   * @returns {Promise<ToolExecutionResult>} Git diff output
   *
   * @example
   * ```typescript
   * // All unstaged changes
   * const diff = await service.gitDiff();
   *
   * // Staged changes only
   * const staged = await service.gitDiff(undefined, true);
   *
   * // Specific file
   * const fileDiff = await service.gitDiff(undefined, false, 'src/index.ts');
   * ```
   */
  async gitDiff(
    workingDirectory?: string,
    staged?: boolean,
    file?: string
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const resolved = this.resolveGitCwd(workingDirectory);
    if (!resolved.valid || !resolved.cwd) {
      return {
        success: false,
        error: resolved.error,
        toolName: 'git_diff',
        executionTime: Date.now() - startTime,
      };
    }
    const args = ['diff'];
    if (staged) args.push('--staged');
    if (file) args.push('--', file);
    const result = this.runGit(args, resolved.cwd);
    result.toolName = 'git_diff';
    return result;
  }

  /**
   * Get git log with recent commits.
   *
   * @param {string} [workingDirectory] - Working directory for git command
   * @param {number} [maxCount=20] - Maximum number of commits to show
   * @param {boolean} [oneline=true] - Use compact one-line format
   * @returns {Promise<ToolExecutionResult>} Git log output
   *
   * @example
   * ```typescript
   * const log = await service.gitLog(undefined, 10, true);
   * // Output: "abc1234 feat: add new feature\ndef5678 fix: bug fix"
   * ```
   */
  async gitLog(
    workingDirectory?: string,
    maxCount: number = 20,
    oneline: boolean = true
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const resolved = this.resolveGitCwd(workingDirectory);
    if (!resolved.valid || !resolved.cwd) {
      return {
        success: false,
        error: resolved.error,
        toolName: 'git_log',
        executionTime: Date.now() - startTime,
      };
    }
    const args = ['log', `-n`, String(maxCount)];
    if (oneline) args.push('--oneline');
    const result = this.runGit(args, resolved.cwd);
    result.toolName = 'git_log';
    return result;
  }

  /**
   * Create a git commit with optional auto-staging.
   *
   * @param {string} message - Commit message
   * @param {string} [workingDirectory] - Working directory for git command
   * @param {boolean} [addAll=false] - Run `git add -A` before commit
   * @returns {Promise<ToolExecutionResult>} Git commit result
   *
   * @example
   * ```typescript
   * // Commit staged changes
   * const result = await service.gitCommit('feat: add new feature');
   *
   * // Stage all and commit
   * const result = await service.gitCommit('chore: cleanup', undefined, true);
   * ```
   */
  async gitCommit(
    message: string,
    workingDirectory?: string,
    addAll: boolean = false
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const resolved = this.resolveGitCwd(workingDirectory);
    if (!resolved.valid || !resolved.cwd) {
      return {
        success: false,
        error: resolved.error,
        toolName: 'git_commit',
        executionTime: Date.now() - startTime,
      };
    }
    if (addAll) {
      const addResult = this.runGit(['add', '-A'], resolved.cwd);
      if (!addResult.success) {
        addResult.toolName = 'git_commit';
        return addResult;
      }
    }
    const result = this.runGit(['commit', '-m', message], resolved.cwd);
    result.toolName = 'git_commit';
    return result;
  }

  /**
   * List branches or create a new branch.
   *
   * @param {string} [workingDirectory] - Working directory for git command
   * @param {boolean} [_list=true] - List branches (ignored if create is provided)
   * @param {string} [create] - Name of new branch to create and checkout
   * @returns {Promise<ToolExecutionResult>} Branch list or creation result
   *
   * @example
   * ```typescript
   * // List all branches
   * const branches = await service.gitBranch();
   *
   * // Create and checkout new branch
   * const result = await service.gitBranch(undefined, true, 'feature/new-feature');
   * ```
   */
  async gitBranch(
    workingDirectory?: string,
    _list: boolean = true,
    create?: string
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const resolved = this.resolveGitCwd(workingDirectory);
    if (!resolved.valid || !resolved.cwd) {
      return {
        success: false,
        error: resolved.error,
        toolName: 'git_branch',
        executionTime: Date.now() - startTime,
      };
    }
    if (create) {
      const result = this.runGit(['checkout', '-b', create], resolved.cwd);
      result.toolName = 'git_branch';
      return result;
    }
    const result = this.runGit(['branch', '-a'], resolved.cwd);
    result.toolName = 'git_branch';
    return result;
  }

  /**
   * Push commits to remote repository.
   *
   * **Disabled by default for security.** Set ENABLE_GIT_PUSH=true to enable.
   *
   * @param {string} [workingDirectory] - Working directory for git command
   * @param {string} [remote='origin'] - Remote name
   * @param {string} [branch] - Branch to push (defaults to current)
   * @returns {Promise<ToolExecutionResult>} Push result
   *
   * @security Requires ENABLE_GIT_PUSH=true environment variable
   *
   * @example
   * ```typescript
   * // Push to origin (current branch)
   * const result = await service.gitPush();
   *
   * // Push specific branch to upstream
   * const result = await service.gitPush(undefined, 'upstream', 'main');
   * ```
   */
  async gitPush(
    workingDirectory?: string,
    remote: string = 'origin',
    branch?: string,
    force: boolean = false
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Check guardrails first
    const guardrailResult = await this.checkGuardrails(
      'git',
      { operation: 'push', remote, branch, force },
      'git_push',
      startTime
    );
    if (guardrailResult) {
      return guardrailResult;
    }

    // Check if this requires approval (especially force push)
    const forceArgs = force ? ['--force'] : [];
    const classification = classifyGitOperation('push', [remote, branch ?? '', ...forceArgs]);
    if (classification.riskLevel === 'high') {
      const approval = this.checkApprovalRequired(classification.action, {
        remote,
        branch,
        force,
      });
      if (approval.required) {
        return {
          success: false,
          error: `Git push requires approval: ${approval.reason}`,
          toolName: 'git_push',
          executionTime: Date.now() - startTime,
          metadata: {
            requiresApproval: true,
            riskLevel: approval.riskLevel,
            action: classification.action,
          },
        };
      }
    }

    if (process.env.ENABLE_GIT_PUSH !== 'true') {
      return {
        success: false,
        error: 'git_push is disabled. Set ENABLE_GIT_PUSH=true to enable.',
        toolName: 'git_push',
        executionTime: Date.now() - startTime,
      };
    }
    const resolved = this.resolveGitCwd(workingDirectory);
    if (!resolved.valid || !resolved.cwd) {
      return {
        success: false,
        error: resolved.error,
        toolName: 'git_push',
        executionTime: Date.now() - startTime,
      };
    }
    const args = ['push', remote];
    if (branch) args.push(branch);
    const result = this.runGit(args, resolved.cwd, 60000);
    result.toolName = 'git_push';
    return result;
  }
}

// Export singleton instance
export const toolExecutionService = new ToolExecutionService();

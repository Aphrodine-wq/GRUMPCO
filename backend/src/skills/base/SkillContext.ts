/**
 * G-Rump Skills System - Skill Context Factory
 * Creates execution contexts for skills
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../middleware/logger.js';
import type {
  SkillContext,
  SkillEvent,
  ClaudeService,
  FileSystemService,
  GitService,
  LoggerService,
  GitStatus,
  GitLogEntry,
} from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Create a skill execution context
 */
export function createSkillContext(options: {
  sessionId?: string;
  workspacePath?: string;
  config?: Record<string, unknown>;
  source?: 'chat' | 'api' | 'command';
  onEvent?: (event: SkillEvent) => void;
}): SkillContext {
  const sessionId = options.sessionId || uuidv4();
  const workspacePath = options.workspacePath;
  let cancelled = false;

  // Create services
  const claudeService = createClaudeService();
  const fileSystemService = createFileSystemService(workspacePath);
  const gitService = workspacePath ? createGitService(workspacePath) : undefined;
  const loggerService = createLoggerService(sessionId);

  return {
    sessionId,
    workspacePath,
    config: options.config || {},
    request: {
      id: uuidv4(),
      timestamp: new Date(),
      source: options.source || 'api',
    },
    services: {
      claude: claudeService,
      fileSystem: fileSystemService,
      git: gitService,
      logger: loggerService,
    },
    emit: (event: SkillEvent) => {
      if (options.onEvent) {
        options.onEvent(event);
      }
    },
    isCancelled: () => cancelled,
  };
}

/**
 * Create Claude service wrapper
 */
function createClaudeService(): ClaudeService {
  const client = new Anthropic();

  return {
    async createMessage(params) {
      return client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: params.maxTokens || 4096,
        system: params.system,
        messages: params.messages,
        tools: params.tools,
      });
    },

    async *streamMessage(params) {
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: params.maxTokens || 4096,
        system: params.system,
        messages: params.messages,
        tools: params.tools,
      });

      for await (const event of stream) {
        yield event;
      }
    },
  };
}

/**
 * Create file system service wrapper
 */
function createFileSystemService(workspacePath?: string): FileSystemService {
  const resolvePath = (filePath: string): string => {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    if (workspacePath) {
      return path.join(workspacePath, filePath);
    }
    return filePath;
  };

  const isWithinWorkspace = (filePath: string): boolean => {
    if (!workspacePath) return true; // No workspace restriction

    const resolved = resolvePath(filePath);
    const normalizedWorkspace = path.normalize(workspacePath);
    const normalizedPath = path.normalize(resolved);

    return normalizedPath.startsWith(normalizedWorkspace);
  };

  return {
    async readFile(filePath: string): Promise<string> {
      const resolved = resolvePath(filePath);
      return fs.readFile(resolved, 'utf-8');
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      const resolved = resolvePath(filePath);
      const dir = path.dirname(resolved);

      // Ensure directory exists
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }

      await fs.writeFile(resolved, content, 'utf-8');
    },

    async exists(filePath: string): Promise<boolean> {
      const resolved = resolvePath(filePath);
      return existsSync(resolved);
    },

    async listDirectory(dirPath: string): Promise<string[]> {
      const resolved = resolvePath(dirPath);
      const entries = await fs.readdir(resolved, { withFileTypes: true });

      return entries.map((entry) =>
        entry.isDirectory() ? `${entry.name}/` : entry.name
      );
    },

    async deleteFile(filePath: string): Promise<void> {
      const resolved = resolvePath(filePath);
      await fs.unlink(resolved);
    },

    isWithinWorkspace,
  };
}

/**
 * Create Git service wrapper
 */
function createGitService(workspacePath: string): GitService {
  const runGit = async (args: string): Promise<string> => {
    const { stdout } = await execAsync(`git ${args}`, {
      cwd: workspacePath,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    return stdout.trim();
  };

  return {
    async status(): Promise<GitStatus> {
      const branch = await runGit('branch --show-current');
      const statusOutput = await runGit('status --porcelain');

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      for (const line of statusOutput.split('\n').filter(Boolean)) {
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const fileName = line.slice(3);

        if (indexStatus === '?') {
          untracked.push(fileName);
        } else {
          if (indexStatus !== ' ') {
            staged.push(fileName);
          }
          if (workTreeStatus !== ' ') {
            unstaged.push(fileName);
          }
        }
      }

      return { branch, staged, unstaged, untracked };
    },

    async diff(options?: { staged?: boolean }): Promise<string> {
      const args = options?.staged ? 'diff --cached' : 'diff';
      return runGit(args);
    },

    async commit(message: string, files?: string[]): Promise<string> {
      if (files && files.length > 0) {
        await runGit(`add ${files.map((f) => `"${f}"`).join(' ')}`);
      }

      // Use heredoc-style commit message
      const escapedMessage = message.replace(/"/g, '\\"');
      return runGit(`commit -m "${escapedMessage}"`);
    },

    async log(count: number = 10): Promise<GitLogEntry[]> {
      const format = '%H|%s|%an|%aI';
      const output = await runGit(`log -${count} --format="${format}"`);

      return output.split('\n').filter(Boolean).map((line) => {
        const [hash, message, author, date] = line.split('|');
        return {
          hash,
          message,
          author,
          date: new Date(date),
        };
      });
    },

    async branch(): Promise<string> {
      return runGit('branch --show-current');
    },

    async branches(): Promise<string[]> {
      const output = await runGit('branch -a');
      return output
        .split('\n')
        .map((line) => line.trim().replace(/^\* /, ''))
        .filter(Boolean);
    },
  };
}

/**
 * Create logger service wrapper
 */
function createLoggerService(sessionId: string): LoggerService {
  const addContext = (meta?: Record<string, unknown>) => ({
    ...meta,
    sessionId,
    component: 'skill',
  });

  return {
    info(message: string, meta?: Record<string, unknown>): void {
      logger.info(addContext(meta), message);
    },
    warn(message: string, meta?: Record<string, unknown>): void {
      logger.warn(addContext(meta), message);
    },
    error(message: string, meta?: Record<string, unknown>): void {
      logger.error(addContext(meta), message);
    },
    debug(message: string, meta?: Record<string, unknown>): void {
      logger.debug(addContext(meta), message);
    },
  };
}

/**
 * Create a cancellable context
 */
export function createCancellableContext(
  baseContext: SkillContext
): { context: SkillContext; cancel: () => void } {
  let cancelled = false;

  const context: SkillContext = {
    ...baseContext,
    isCancelled: () => cancelled,
  };

  return {
    context,
    cancel: () => {
      cancelled = true;
    },
  };
}

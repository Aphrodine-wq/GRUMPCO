/**
 * Tool Execution Service Unit Tests
 * Tests bash execution, file operations, and git commands with security validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import path from 'path';

// Store original env
const originalEnv = { ...process.env };

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock pathPolicyService
vi.mock('../../src/services/pathPolicyService.js', () => ({
  resolvePath: vi.fn(),
}));

describe('toolExecutionService', () => {
  let execSync: Mock;
  let fsReadFile: Mock;
  let fsWriteFile: Mock;
  let fsMkdir: Mock;
  let fsReaddir: Mock;
  let resolvePath: Mock;
  
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Get the mocked functions
    const childProcess = await import('child_process');
    const fs = await import('fs/promises');
    const pathPolicy = await import('../../src/services/pathPolicyService.js');
    
    execSync = childProcess.execSync as Mock;
    // The source uses `import fs from 'fs/promises'` so we need the default export
    const fsDefault = fs.default as unknown as { readFile: Mock; writeFile: Mock; mkdir: Mock; readdir: Mock };
    fsReadFile = fsDefault.readFile;
    fsWriteFile = fsDefault.writeFile;
    fsMkdir = fsDefault.mkdir;
    fsReaddir = fsDefault.readdir;
    resolvePath = pathPolicy.resolvePath as Mock;
    
    // Default path validation to succeed
    resolvePath.mockImplementation((requestedPath: string) => ({
      ok: true,
      resolved: path.resolve('/tmp/workspace', requestedPath),
    }));
    
    // Clear strict allowlist
    delete process.env.STRICT_COMMAND_ALLOWLIST;
    delete process.env.ENABLE_GIT_PUSH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('should use default workspace root', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService();
      expect(service).toBeDefined();
    });

    it('should accept custom workspace root', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/custom/workspace');
      expect(service).toBeDefined();
    });

    it('should accept allowed directories option', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/workspace', {
        allowedDirs: ['/extra/dir'],
      });
      expect(service).toBeDefined();
    });
  });

  describe('executeBash', () => {
    it('should execute valid command successfully', async () => {
      execSync.mockReturnValue('command output');

      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('echo hello');

      expect(result.success).toBe(true);
      expect(result.output).toBe('command output');
      expect(result.toolName).toBe('bash_execute');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should block dangerous rm -rf / command', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('rm -rf /');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command blocked');
    });

    it('should block dangerous rm -rf /* command', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('rm -rf /*');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command blocked');
    });

    it('should block dd command', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('dd if=/dev/zero of=/dev/sda');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command blocked');
    });

    it('should block wget command', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('wget http://malicious.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command blocked');
    });

    it('should block reboot command', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('reboot');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command blocked');
    });

    it('should block shutdown command', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('shutdown now');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command blocked');
    });

    it('should validate working directory', async () => {
      resolvePath.mockReturnValue({ ok: false, reason: 'Path blocked' });
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('ls', '/etc');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Path blocked');
    });

    it('should handle command timeout', async () => {
      execSync.mockImplementation(() => {
        const err = new Error('timeout') as NodeJS.ErrnoException;
        err.code = 'ETIMEDOUT';
        throw err;
      });
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('sleep 100', undefined, 1000);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.exitCode).toBe(-1);
    });

    it('should handle command failure with exit code', async () => {
      execSync.mockImplementation(() => {
        const err = { status: 1, stdout: '', stderr: 'Command failed' };
        throw err;
      });
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeBash('false');
      
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain('Command failed');
    });
  });

  describe('executeTerminal', () => {
    it('should execute terminal command', async () => {
      execSync.mockReturnValue('terminal output');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.executeTerminal('echo test');
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('terminal_execute');
    });

    it('should limit timeout to 60 seconds', async () => {
      execSync.mockReturnValue('output');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      await service.executeTerminal('echo test', undefined, 120000);
      
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 60000 })
      );
    });
  });

  describe('readFile', () => {
    it('should read file successfully', async () => {
      fsReadFile.mockResolvedValue('file content');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.readFile('test.txt');
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('file content');
      expect(result.toolName).toBe('file_read');
    });

    it('should fail when path validation fails', async () => {
      resolvePath.mockReturnValue({ ok: false, reason: 'Path not allowed' });
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.readFile('/etc/passwd');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Path not allowed');
    });

    it('should handle file not found error', async () => {
      fsReadFile.mockRejectedValue(new Error('ENOENT: no such file'));
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.readFile('nonexistent.txt');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });
  });

  describe('writeFile', () => {
    it('should write new file successfully', async () => {
      fsReadFile.mockRejectedValue(new Error('ENOENT'));
      fsMkdir.mockResolvedValue(undefined);
      fsWriteFile.mockResolvedValue(undefined);
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.writeFile('new.txt', 'content');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('created');
      expect(result.toolName).toBe('file_write');
    });

    it('should modify existing file successfully', async () => {
      fsReadFile.mockResolvedValue('old content');
      fsMkdir.mockResolvedValue(undefined);
      fsWriteFile.mockResolvedValue(undefined);
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.writeFile('existing.txt', 'new content');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('modified');
    });

    it('should fail when path validation fails', async () => {
      resolvePath.mockReturnValue({ ok: false, reason: 'Access to blocked directory' });

      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.writeFile('/etc/hosts', 'content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access to blocked directory');
    });
  });

  describe('editFile', () => {
    it('should insert line successfully', async () => {
      fsReadFile.mockResolvedValue('line1\nline2\nline3');
      fsWriteFile.mockResolvedValue(undefined);
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.editFile('file.txt', [
        { type: 'insert', lineStart: 2, content: 'inserted' },
      ]);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('1 operation(s)');
    });

    it('should replace lines successfully', async () => {
      fsReadFile.mockResolvedValue('line1\nline2\nline3\nline4');
      fsWriteFile.mockResolvedValue(undefined);
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.editFile('file.txt', [
        { type: 'replace', lineStart: 2, lineEnd: 3, content: 'replaced' },
      ]);
      
      expect(result.success).toBe(true);
    });

    it('should delete lines successfully', async () => {
      fsReadFile.mockResolvedValue('line1\nline2\nline3');
      fsWriteFile.mockResolvedValue(undefined);
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.editFile('file.txt', [
        { type: 'delete', lineStart: 2 },
      ]);
      
      expect(result.success).toBe(true);
    });

    it('should fail when path validation fails', async () => {
      resolvePath.mockReturnValue({ ok: false, reason: 'Edit not allowed' });
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.editFile('/etc/passwd', [
        { type: 'delete', lineStart: 1 },
      ]);
      
      expect(result.success).toBe(false);
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      fsReaddir.mockResolvedValue([
        { name: 'file.txt', isDirectory: () => false },
        { name: 'subdir', isDirectory: () => true },
      ]);
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.listDirectory('.');
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('list_directory');
    });

    it('should fail when path validation fails', async () => {
      resolvePath.mockReturnValue({ ok: false, reason: 'List not allowed' });
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.listDirectory('/etc');
      
      expect(result.success).toBe(false);
    });
  });

  describe('searchCodebase', () => {
    it('should search for files matching query', async () => {
      fsReaddir.mockResolvedValue([
        { name: 'test.ts', isDirectory: () => false },
        { name: 'app.ts', isDirectory: () => false },
      ]);
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.searchCodebase('test');
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('codebase_search');
    });

    it('should fail when path validation fails', async () => {
      resolvePath.mockReturnValue({ ok: false, reason: 'Search not allowed' });
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.searchCodebase('test', '/etc');
      
      expect(result.success).toBe(false);
    });
  });

  describe('gitStatus', () => {
    it('should return git status', async () => {
      execSync.mockReturnValue('## main\n M file.txt');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.gitStatus();
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('main');
      expect(result.toolName).toBe('git_status');
    });

    it('should handle working directory validation failure', async () => {
      resolvePath.mockReturnValue({ ok: false, reason: 'Invalid dir' });
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.gitStatus('/outside/workspace');
      
      expect(result.success).toBe(false);
    });
  });

  describe('gitDiff', () => {
    it('should return git diff', async () => {
      execSync.mockReturnValue('diff output');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.gitDiff();
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('git_diff');
    });

    it('should support staged diff', async () => {
      execSync.mockReturnValue('staged diff');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      await service.gitDiff(undefined, true);
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('--staged'),
        expect.any(Object)
      );
    });

    it('should support file-specific diff', async () => {
      execSync.mockReturnValue('file diff');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      await service.gitDiff(undefined, false, 'specific.txt');
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('-- specific.txt'),
        expect.any(Object)
      );
    });
  });

  describe('gitLog', () => {
    it('should return git log', async () => {
      execSync.mockReturnValue('abc123 commit message');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.gitLog();
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('git_log');
    });

    it('should support maxCount parameter', async () => {
      execSync.mockReturnValue('logs');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      await service.gitLog(undefined, 10);
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('-n 10'),
        expect.any(Object)
      );
    });
  });

  describe('gitCommit', () => {
    it('should create git commit', async () => {
      execSync.mockReturnValue('[main abc123] commit message');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.gitCommit('test commit');
      
      expect(result.success).toBe(true);
      expect(result.toolName).toBe('git_commit');
    });

    it('should add all files when addAll is true', async () => {
      execSync.mockReturnValue('[main] committed');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      await service.gitCommit('commit with add', undefined, true);
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git add -A'),
        expect.any(Object)
      );
    });
  });

  describe('gitBranch', () => {
    it('should list branches', async () => {
      execSync.mockReturnValue('* main\n  feature');
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.gitBranch();
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('main');
      expect(result.toolName).toBe('git_branch');
    });

    it('should create new branch', async () => {
      execSync.mockReturnValue("Switched to a new branch 'new-feature'");
      
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      await service.gitBranch(undefined, true, 'new-feature');
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('checkout -b new-feature'),
        expect.any(Object)
      );
    });
  });

  describe('gitPush', () => {
    it('should be disabled by default', async () => {
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.gitPush();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
      expect(result.toolName).toBe('git_push');
    });

    it('should work when enabled', async () => {
      process.env.ENABLE_GIT_PUSH = 'true';
      execSync.mockReturnValue('Pushed to origin');
      
      vi.resetModules();
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      const result = await service.gitPush();
      
      expect(result.success).toBe(true);
    });

    it('should push to specified remote and branch', async () => {
      process.env.ENABLE_GIT_PUSH = 'true';
      execSync.mockReturnValue('Pushed');
      
      vi.resetModules();
      const { ToolExecutionService } = await import('../../src/services/toolExecutionService.js');
      const service = new ToolExecutionService('/tmp/workspace', { enableGuardrails: false });
      await service.gitPush(undefined, 'upstream', 'feature');
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git push upstream feature'),
        expect.any(Object)
      );
    });
  });

  describe('singleton export', () => {
    it('should export toolExecutionService singleton', async () => {
      const { toolExecutionService } = await import('../../src/services/toolExecutionService.js');
      expect(toolExecutionService).toBeDefined();
    });
  });
});

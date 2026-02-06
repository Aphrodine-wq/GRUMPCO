import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadRemoteWorkspace } from '../../src/services/remoteWorkspaceService';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock logger
vi.mock('../../src/middleware/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('remoteWorkspaceService', () => {
  const repoUrl = 'https://github.com/test/repo.git';
  const safeName = repoUrl.replace(/[^a-zA-Z0-9-]/g, "_");
  const workspaceCacheDir = join(tmpdir(), "grump-workspaces");
  const targetDir = join(workspaceCacheDir, safeName);

  beforeEach(() => {
    vi.resetAllMocks();
    if (fs.existsSync(workspaceCacheDir)) {
      fs.rmSync(workspaceCacheDir, { recursive: true, force: true });
    }
    fs.mkdirSync(workspaceCacheDir, { recursive: true });

    // Mock spawn implementation
    vi.mocked(child_process.spawn).mockImplementation((() => {
       const mockProcess = new EventEmitter() as any;
       mockProcess.stdout = new EventEmitter();
       mockProcess.stderr = new EventEmitter();

       // Emit close asynchronously
       setTimeout(() => {
         mockProcess.emit('close', 0);
       }, 10);

       return mockProcess;
    }) as any);
  });

  it('should clone a new repository using spawn', async () => {
    await loadRemoteWorkspace(repoUrl);

    expect(child_process.spawn).toHaveBeenCalledWith(
      "git",
      ["clone", "--depth", "1", repoUrl, targetDir],
      expect.objectContaining({ stdio: "inherit" })
    );
  });

  it('should pull if repository already exists', async () => {
    fs.mkdirSync(targetDir, { recursive: true });

    await loadRemoteWorkspace(repoUrl);

    expect(child_process.spawn).toHaveBeenCalledWith(
      "git",
      ["pull"],
      expect.objectContaining({ cwd: targetDir, stdio: "inherit" })
    );
  });

  it('should throw error if clone fails', async () => {
    vi.mocked(child_process.spawn).mockImplementation((() => {
       const mockProcess = new EventEmitter() as any;
       setTimeout(() => {
         mockProcess.emit('close', 1); // Non-zero exit code
       }, 10);
       return mockProcess;
    }) as any);

    await expect(loadRemoteWorkspace(repoUrl)).rejects.toThrow("Failed to clone repository");
  });
});

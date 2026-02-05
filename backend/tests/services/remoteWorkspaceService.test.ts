import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadRemoteWorkspace } from '../../src/services/remoteWorkspaceService';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock child_process
vi.mock('child_process', () => ({
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

    // Mock exec implementation to call callback (success)
    // util.promisify wraps exec. It calls exec(command, options, callback) or exec(command, callback)
    vi.mocked(child_process.exec).mockImplementation(((cmd: string, options: any, callback: any) => {
       let cb = callback;
       if (typeof options === 'function') {
         cb = options;
       }
       // Simulate success async (use setTimeout to be real async if needed, but synchronous callback is fine for promisify usually, though promisify guarantees async resolution)
       if (cb) {
         cb(null, { stdout: '', stderr: '' });
       }
       return {} as any;
    }) as any);
  });

  it('should clone a new repository using exec', async () => {
    await loadRemoteWorkspace(repoUrl);

    // expect exec to be called
    expect(child_process.exec).toHaveBeenCalledWith(
      `git clone --depth 1 ${repoUrl} ${targetDir}`,
      expect.any(Function)
    );
  });

  it('should pull if repository already exists', async () => {
    fs.mkdirSync(targetDir, { recursive: true });

    await loadRemoteWorkspace(repoUrl);

    expect(child_process.exec).toHaveBeenCalledWith(
      "git pull",
      expect.objectContaining({ cwd: targetDir }),
      expect.any(Function)
    );
  });

  it('should throw error if clone fails', async () => {
    vi.mocked(child_process.exec).mockImplementation(((cmd: string, options: any, callback: any) => {
       let cb = callback;
       if (typeof options === 'function') cb = options;
       // Simulate error
       if (cb) cb(new Error("Clone failed"), { stdout: '', stderr: '' });
       return {} as any;
    }) as any);

    await expect(loadRemoteWorkspace(repoUrl)).rejects.toThrow("Failed to clone repository");
  });
});

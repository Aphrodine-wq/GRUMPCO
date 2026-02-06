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

    // Default mock implementation: success
    vi.mocked(child_process.spawn).mockImplementation(() => {
      const cp: any = new EventEmitter();
      cp.stdout = new EventEmitter();
      cp.stderr = new EventEmitter();
      // Simulate async close
      setTimeout(() => cp.emit('close', 0), 10);
      return cp;
    });
  });

  it('should clone a new repository using spawn', async () => {
    await loadRemoteWorkspace(repoUrl);

    // expect spawn to be called with correct args
    expect(child_process.spawn).toHaveBeenCalledWith(
      'git',
      ['clone', '--depth', '1', '--', repoUrl, targetDir],
      expect.anything()
    );
  });

  it('should pull if repository already exists', async () => {
    fs.mkdirSync(targetDir, { recursive: true });

    await loadRemoteWorkspace(repoUrl);

    expect(child_process.spawn).toHaveBeenCalledWith(
      'git',
      ['pull'],
      expect.objectContaining({ cwd: targetDir })
    );
  });

  it('should throw error if clone fails', async () => {
    vi.mocked(child_process.spawn).mockImplementation(() => {
      const cp: any = new EventEmitter();
      cp.stdout = new EventEmitter();
      cp.stderr = new EventEmitter();
      setTimeout(() => {
         // Emit some error data
         if (cp.stderr.listenerCount('data') > 0) {
            cp.stderr.emit('data', Buffer.from('fatal: repository not found'));
         }
         cp.emit('close', 128);
      }, 10);
      return cp;
    });

    await expect(loadRemoteWorkspace(repoUrl)).rejects.toThrow("Failed to clone repository");
  });
});

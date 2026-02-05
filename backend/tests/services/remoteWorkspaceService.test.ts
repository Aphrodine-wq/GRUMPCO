import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRemoteWorkspace } from '../../src/services/remoteWorkspaceService';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
    // Ensure clean state
    if (fs.existsSync(workspaceCacheDir)) {
      fs.rmSync(workspaceCacheDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(workspaceCacheDir)) {
      fs.rmSync(workspaceCacheDir, { recursive: true, force: true });
    }
  });

  function mockSpawn(shouldFail = false, code = 0) {
    const cp = new EventEmitter() as any;
    cp.stdout = new EventEmitter();
    cp.stdout.resume = vi.fn();
    cp.stderr = new EventEmitter();

    vi.mocked(child_process.spawn).mockReturnValue(cp);

    // Simulate execution events
    setTimeout(() => {
        if (shouldFail) {
            cp.emit('error', new Error('Spawn failed'));
        } else {
            cp.emit('close', code);
        }
    }, 5);

    return cp;
  }

  it('should clone a new repository using spawn', async () => {
    mockSpawn();

    await loadRemoteWorkspace(repoUrl);

    expect(child_process.spawn).toHaveBeenCalledWith(
      'git',
      ['clone', '--depth', '1', repoUrl, targetDir],
      { cwd: undefined }
    );
  });

  it('should pull if repository already exists', async () => {
    fs.mkdirSync(targetDir, { recursive: true });
    mockSpawn();

    await loadRemoteWorkspace(repoUrl);

    expect(child_process.spawn).toHaveBeenCalledWith(
      'git',
      ['pull'],
      { cwd: targetDir }
    );
  });

  it('should throw error if clone fails (non-zero exit code)', async () => {
    const cp = mockSpawn(false, 1); // Exit code 1
    // Simulate stderr output before close
    setTimeout(() => {
         cp.stderr.emit('data', Buffer.from("Clone error message"));
    }, 1);

    await expect(loadRemoteWorkspace(repoUrl)).rejects.toThrow("Failed to clone repository");
  });

  it('should throw error if spawn fails (error event)', async () => {
    mockSpawn(true); // Emits 'error' event

    await expect(loadRemoteWorkspace(repoUrl)).rejects.toThrow("Failed to clone repository");
  });
});

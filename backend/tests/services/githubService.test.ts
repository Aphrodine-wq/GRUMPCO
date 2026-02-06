import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const mocks = {
  spawn: vi.fn(),
  // Async FS
  fsPromises: {
    mkdir: vi.fn(),
    mkdtemp: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn(),
  },
  // Sync FS
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),

  getSession: vi.fn(),
  fetch: vi.fn(),
};

// Mock child_process
vi.mock('child_process', () => ({
  spawn: (...args: any[]) => mocks.spawn(...args),
}));

// Mock fs
vi.mock('fs', () => ({
  promises: mocks.fsPromises,
  existsSync: (...args: any[]) => mocks.existsSync(...args),
  readFileSync: (...args: any[]) => mocks.readFileSync(...args),
  writeFileSync: (...args: any[]) => mocks.writeFileSync(...args),
}));

// Mock logger
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  getRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock agentOrchestrator
vi.mock('../../src/services/agentOrchestrator.js', () => ({
  getSession: (...args: any[]) => mocks.getSession(...args),
}));

// Global fetch
global.fetch = mocks.fetch;

describe('GitHub Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Important to re-import service

    // Default spawn success
    mocks.spawn.mockImplementation(() => {
       const p = new EventEmitter() as any;
       setTimeout(() => p.emit('close', 0), 1);
       return p;
    });

    // Default FS
    mocks.fsPromises.mkdtemp.mockResolvedValue('/tmp/grump-test');
    mocks.fsPromises.mkdir.mockResolvedValue(undefined);
    mocks.fsPromises.writeFile.mockResolvedValue(undefined);
    mocks.fsPromises.rm.mockResolvedValue(undefined);

    mocks.existsSync.mockReturnValue(true);
    mocks.readFileSync.mockReturnValue('gho_token');
    mocks.writeFileSync.mockReturnValue(undefined);

    // Default Session
    mocks.getSession.mockResolvedValue({
      sessionId: 'session-123',
      status: 'completed',
      architecture: { projectName: 'test-project' },
      generatedFiles: [
        { path: 'index.ts', content: 'console.log("hello");' },
        { path: 'src/utils.ts', content: 'export const x = 1;' },
      ],
    });

    // Default Fetch
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clone_url: 'https://github.com/user/new-repo.git', access_token: 'access_token' }),
    });
  });

  it('should exchange code for token', async () => {
    const { exchangeCodeForToken } = await import('../../src/services/githubService.js');
    process.env.GITHUB_CLIENT_ID = 'id';
    process.env.GITHUB_CLIENT_SECRET = 'secret';

    const token = await exchangeCodeForToken('code123');

    expect(token).toBe('access_token');
    expect(mocks.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.github-token'),
      'access_token',
      'utf8'
    );
  });

  it('should create repo and push code', async () => {
    const { createAndPush } = await import('../../src/services/githubService.js');

    const result = await createAndPush('session-123', 'new-repo');

    expect(result.pushed).toBe(true);
    expect(result.repoUrl).toBe('https://github.com/user/new-repo');

    // Verify files written (async)
    expect(mocks.fsPromises.writeFile).toHaveBeenCalledTimes(2);

    // Verify git commands (async spawn)
    const calls = mocks.spawn.mock.calls.map(c => `${c[0]} ${c[1].join(' ')}`);
    expect(calls).toEqual([
        'git init',
        'git config user.email grump@local',
        'git config user.name G-Rump',
        'git add -A',
        'git commit -m Initial commit from G-Rump',
        expect.stringContaining('git remote add origin https://gho_token@'),
        'git branch -M main',
        'git push -u origin main',
    ]);
  });

  it('should include token in remote URL for push', async () => {
    const { createAndPush } = await import('../../src/services/githubService.js');
    await createAndPush('session-123', 'new-repo');

    const remoteCall = mocks.spawn.mock.calls.find(c => c[1][0] === 'remote');
    expect(remoteCall[1][3]).toContain('gho_token@github.com');
  });

  it('should clean up temp directory', async () => {
    const { createAndPush } = await import('../../src/services/githubService.js');
    await createAndPush('session-123', 'new-repo');
    expect(mocks.fsPromises.rm).toHaveBeenCalledWith('/tmp/grump-test', { recursive: true, force: true });
  });

  it('should clean up even if push fails', async () => {
    mocks.spawn.mockImplementation((cmd, args) => {
       const p = new EventEmitter() as any;
       setTimeout(() => {
           if (args[0] === 'push') p.emit('close', 1); // Fail on push
           else p.emit('close', 0);
       }, 1);
       return p;
    });

    const { createAndPush } = await import('../../src/services/githubService.js');

    await expect(createAndPush('session-123', 'new-repo')).rejects.toThrow('git push -u origin main failed with code 1');
    expect(mocks.fsPromises.rm).toHaveBeenCalled();
  });
});

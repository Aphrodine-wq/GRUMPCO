/**
 * GitHub Service unit tests.
 * Run: npm test -- githubService.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store references to mocks that need to survive module resets
const mocks = {
  execSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  mkdtempSync: vi.fn(),
  rmSync: vi.fn(),
  getSession: vi.fn(),
  fetch: vi.fn(),
};

// Mock child_process
vi.mock('child_process', () => ({
  execSync: (...args: any[]) => mocks.execSync(...args),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mocks.existsSync(...args),
  readFileSync: (...args: any[]) => mocks.readFileSync(...args),
  writeFileSync: (...args: any[]) => mocks.writeFileSync(...args),
  mkdirSync: (...args: any[]) => mocks.mkdirSync(...args),
  mkdtempSync: (...args: any[]) => mocks.mkdtempSync(...args),
  rmSync: (...args: any[]) => mocks.rmSync(...args),
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

// Replace global fetch before any imports
globalThis.fetch = ((...args: any[]) => mocks.fetch(...args)) as typeof fetch;

describe('githubService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Reset all mocks
    Object.values(mocks).forEach(m => m.mockReset());
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getCallbackRedirectSuccess', () => {
    it('should return success redirect URL with default frontend redirect', async () => {
      delete process.env.GITHUB_FRONTEND_REDIRECT;
      vi.resetModules();
      
      const { getCallbackRedirectSuccess } = await import('../../src/services/githubService.js');
      
      const result = getCallbackRedirectSuccess();
      
      expect(result).toBe('http://localhost:5178/?github=ok');
    });

    it('should use custom frontend redirect from env', async () => {
      process.env.GITHUB_FRONTEND_REDIRECT = 'https://my-app.com';
      vi.resetModules();
      
      const { getCallbackRedirectSuccess } = await import('../../src/services/githubService.js');
      
      const result = getCallbackRedirectSuccess();
      
      expect(result).toBe('https://my-app.com/?github=ok');
    });
  });

  describe('getCallbackRedirectError', () => {
    it('should return error redirect URL with encoded message', async () => {
      delete process.env.GITHUB_FRONTEND_REDIRECT;
      vi.resetModules();
      
      const { getCallbackRedirectError } = await import('../../src/services/githubService.js');
      
      const result = getCallbackRedirectError('Token exchange failed');
      
      expect(result).toBe('http://localhost:5178/?github=error&message=Token%20exchange%20failed');
    });

    it('should encode special characters in error message', async () => {
      delete process.env.GITHUB_FRONTEND_REDIRECT;
      vi.resetModules();
      
      const { getCallbackRedirectError } = await import('../../src/services/githubService.js');
      
      const result = getCallbackRedirectError('Error with & special=chars');
      
      expect(result).toBe('http://localhost:5178/?github=error&message=Error%20with%20%26%20special%3Dchars');
    });

    it('should use custom frontend redirect from env', async () => {
      process.env.GITHUB_FRONTEND_REDIRECT = 'https://custom-domain.com';
      vi.resetModules();
      
      const { getCallbackRedirectError } = await import('../../src/services/githubService.js');
      
      const result = getCallbackRedirectError('Failed');
      
      expect(result).toBe('https://custom-domain.com/?github=error&message=Failed');
    });
  });

  describe('getAuthUrl', () => {
    it('should throw when GITHUB_CLIENT_ID is not set', async () => {
      delete process.env.GITHUB_CLIENT_ID;
      vi.resetModules();
      
      const { getAuthUrl } = await import('../../src/services/githubService.js');
      
      expect(() => getAuthUrl()).toThrow('GITHUB_CLIENT_ID not set');
    });

    it('should return valid OAuth URL with client ID', async () => {
      process.env.GITHUB_CLIENT_ID = 'test_client_id';
      vi.resetModules();
      
      const { getAuthUrl } = await import('../../src/services/githubService.js');
      
      const result = getAuthUrl();
      
      expect(result).toContain('https://github.com/login/oauth/authorize');
      expect(result).toContain('client_id=test_client_id');
      expect(result).toContain('scope=repo');
    });

    it('should include default redirect URI', async () => {
      process.env.GITHUB_CLIENT_ID = 'test_client_id';
      delete process.env.GITHUB_REDIRECT_URI;
      vi.resetModules();
      
      const { getAuthUrl } = await import('../../src/services/githubService.js');
      
      const result = getAuthUrl();
      
      expect(result).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fgithub%2Fcallback');
    });

    it('should use custom redirect URI from env', async () => {
      process.env.GITHUB_CLIENT_ID = 'test_client_id';
      process.env.GITHUB_REDIRECT_URI = 'https://my-app.com/callback';
      vi.resetModules();
      
      const { getAuthUrl } = await import('../../src/services/githubService.js');
      
      const result = getAuthUrl();
      
      expect(result).toContain('redirect_uri=https%3A%2F%2Fmy-app.com%2Fcallback');
    });
  });

  describe('exchangeCodeForToken', () => {
    beforeEach(() => {
      process.env.GITHUB_CLIENT_ID = 'test_client_id';
      process.env.GITHUB_CLIENT_SECRET = 'test_client_secret';
    });

    it('should throw when GITHUB_CLIENT_ID is not set', async () => {
      delete process.env.GITHUB_CLIENT_ID;
      vi.resetModules();
      
      const { exchangeCodeForToken } = await import('../../src/services/githubService.js');
      
      await expect(exchangeCodeForToken('auth_code')).rejects.toThrow(
        'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set'
      );
    });

    it('should throw when GITHUB_CLIENT_SECRET is not set', async () => {
      delete process.env.GITHUB_CLIENT_SECRET;
      vi.resetModules();
      
      const { exchangeCodeForToken } = await import('../../src/services/githubService.js');
      
      await expect(exchangeCodeForToken('auth_code')).rejects.toThrow(
        'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set'
      );
    });

    it('should exchange code for token successfully', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'gho_new_access_token' }),
      });
      
      const { exchangeCodeForToken } = await import('../../src/services/githubService.js');
      
      const result = await exchangeCodeForToken('valid_auth_code');
      
      expect(result).toBe('gho_new_access_token');
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('valid_auth_code'),
        })
      );
    });

    it('should store the token after exchange', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'gho_stored_token' }),
      });
      
      const { exchangeCodeForToken } = await import('../../src/services/githubService.js');
      
      await exchangeCodeForToken('code');
      
      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.github-token'),
        'gho_stored_token',
        'utf8'
      );
    });

    it('should throw when GitHub API returns error status', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: false,
        status: 401,
      });
      
      const { exchangeCodeForToken } = await import('../../src/services/githubService.js');
      
      await expect(exchangeCodeForToken('invalid_code')).rejects.toThrow(
        'GitHub token exchange failed: 401'
      );
    });

    it('should throw when response contains error', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: 'bad_verification_code' }),
      });
      
      const { exchangeCodeForToken } = await import('../../src/services/githubService.js');
      
      await expect(exchangeCodeForToken('expired_code')).rejects.toThrow(
        'bad_verification_code'
      );
    });

    it('should throw when no access_token in response', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      
      const { exchangeCodeForToken } = await import('../../src/services/githubService.js');
      
      await expect(exchangeCodeForToken('code')).rejects.toThrow(
        'No access_token in response'
      );
    });
  });

  describe('getToken', () => {
    it('should return stored token when token file exists', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue('gho_stored_token\n');
      vi.resetModules();
      
      const { getToken } = await import('../../src/services/githubService.js');
      
      const result = getToken();
      
      expect(result).toBe('gho_stored_token');
    });

    it('should return null when token file does not exist', async () => {
      mocks.existsSync.mockReturnValue(false);
      vi.resetModules();
      
      const { getToken } = await import('../../src/services/githubService.js');
      
      const result = getToken();
      
      expect(result).toBeNull();
    });

    it('should return null when reading file throws error', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      vi.resetModules();
      
      const { getToken } = await import('../../src/services/githubService.js');
      
      const result = getToken();
      
      expect(result).toBeNull();
    });

    it('should trim whitespace from token', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue('  gho_token_with_whitespace  \n');
      vi.resetModules();
      
      const { getToken } = await import('../../src/services/githubService.js');
      
      const result = getToken();
      
      expect(result).toBe('gho_token_with_whitespace');
    });
  });

  describe('createRepo', () => {
    it('should create repository and return clone URL', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          clone_url: 'https://github.com/user/my-repo.git',
          html_url: 'https://github.com/user/my-repo',
        }),
      });
      
      const { createRepo } = await import('../../src/services/githubService.js');
      
      const result = await createRepo('my-repo', 'gho_valid_token');
      
      expect(result).toBe('https://github.com/user/my-repo.git');
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user/repos',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer gho_valid_token',
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            name: 'my-repo',
            private: false,
            auto_init: false,
          }),
        })
      );
    });

    it('should throw with error message when API returns error', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ message: 'Repository already exists' }),
      });
      
      const { createRepo } = await import('../../src/services/githubService.js');
      
      await expect(createRepo('existing-repo', 'gho_token')).rejects.toThrow(
        'Repository already exists'
      );
    });

    it('should throw with status code when no error message', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });
      
      const { createRepo } = await import('../../src/services/githubService.js');
      
      await expect(createRepo('repo', 'gho_token')).rejects.toThrow(
        'Create repo failed: 500'
      );
    });

    it('should throw when unauthorized', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });
      
      const { createRepo } = await import('../../src/services/githubService.js');
      
      await expect(createRepo('repo', 'invalid_token')).rejects.toThrow(
        'Bad credentials'
      );
    });
  });

  describe('createAndPush', () => {
    const mockSession = {
      sessionId: 'session-123',
      status: 'completed' as const,
      architecture: { projectName: 'test-project' },
      generatedFiles: [
        { path: 'src/index.ts', content: 'console.log("hello");' },
        { path: 'package.json', content: '{"name": "test"}' },
        { path: 'src/utils/helper.ts', content: 'export const helper = () => {};' },
      ],
    };

    beforeEach(() => {
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue('gho_stored_token');
      mocks.mkdtempSync.mockReturnValue('/tmp/grump-abc123');
      mocks.getSession.mockResolvedValue(mockSession);
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          clone_url: 'https://github.com/user/new-repo.git',
        }),
      });
    });

    it('should throw when no token available', async () => {
      mocks.existsSync.mockReturnValue(false);
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await expect(createAndPush('session-123', 'new-repo')).rejects.toThrow(
        'No GitHub token. Complete OAuth first.'
      );
    });

    it('should use provided token override instead of stored token', async () => {
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'new-repo', 'gho_override_token');
      
      // Should use the override token in fetch call
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user/repos',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer gho_override_token',
          }),
        })
      );
    });

    it('should throw when session not found', async () => {
      mocks.getSession.mockResolvedValue(null);
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await expect(createAndPush('nonexistent-session', 'repo')).rejects.toThrow(
        'Session not found'
      );
    });

    it('should throw when session status is not completed', async () => {
      mocks.getSession.mockResolvedValue({
        ...mockSession,
        status: 'running',
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await expect(createAndPush('session-123', 'repo')).rejects.toThrow(
        'Code generation not complete or no files'
      );
    });

    it('should throw when session has no generated files', async () => {
      mocks.getSession.mockResolvedValue({
        ...mockSession,
        generatedFiles: [],
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await expect(createAndPush('session-123', 'repo')).rejects.toThrow(
        'Code generation not complete or no files'
      );
    });

    it('should throw when generatedFiles is undefined', async () => {
      mocks.getSession.mockResolvedValue({
        ...mockSession,
        generatedFiles: undefined,
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await expect(createAndPush('session-123', 'repo')).rejects.toThrow(
        'Code generation not complete or no files'
      );
    });

    it('should create repo, write files, and push to GitHub', async () => {
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      const result = await createAndPush('session-123', 'new-repo');
      
      expect(result).toEqual({
        repoUrl: 'https://github.com/user/new-repo',
        pushed: true,
      });
    });

    it('should write generated files to temp directory', async () => {
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'new-repo');
      
      // Should create directories for files
      expect(mocks.mkdirSync).toHaveBeenCalled();
      
      // Should write files
      expect(mocks.writeFileSync).toHaveBeenCalledTimes(3);
      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('index.ts'),
        'console.log("hello");',
        'utf8'
      );
    });

    it('should execute git commands in correct order', async () => {
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'new-repo');
      
      // Verify git commands were executed
      const calls = mocks.execSync.mock.calls.map((c) => c[0]);
      expect(calls).toEqual([
        'git init',
        'git config user.email "grump@local"',
        'git config user.name "G-Rump"',
        'git add -A',
        'git commit -m "Initial commit from G-Rump"',
        expect.stringContaining('git remote add origin https://gho_stored_token@github.com'),
        'git branch -M main',
        'git push -u origin main',
      ]);
    });

    it('should include token in remote URL for push', async () => {
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'new-repo');
      
      // Find the remote add call
      const remoteAddCall = mocks.execSync.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('git remote add origin')
      );
      expect(remoteAddCall).toBeDefined();
      expect(remoteAddCall![0]).toContain('gho_stored_token@github.com');
    });

    it('should use prdId as project name when architecture.projectName is undefined', async () => {
      mocks.getSession.mockResolvedValue({
        ...mockSession,
        architecture: {},
        prdId: 'prd-fallback-name',
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'new-repo');
      
      // Files should be written to project directory with prdId as name
      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('prd-fallback-name'),
        expect.any(String),
        'utf8'
      );
    });

    it('should use default project name when both are undefined', async () => {
      mocks.getSession.mockResolvedValue({
        ...mockSession,
        architecture: undefined,
        prdId: undefined,
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'new-repo');
      
      // Files should be written to project directory with default name
      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('generated-project'),
        expect.any(String),
        'utf8'
      );
    });

    it('should clean up temp directory after successful push', async () => {
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'new-repo');
      
      expect(mocks.rmSync).toHaveBeenCalledWith('/tmp/grump-abc123', { recursive: true });
    });

    it('should clean up temp directory even when push fails', async () => {
      mocks.execSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git push')) {
          throw new Error('Push failed');
        }
        return Buffer.from('');
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await expect(createAndPush('session-123', 'new-repo')).rejects.toThrow('Push failed');
      
      // Cleanup should still happen
      expect(mocks.rmSync).toHaveBeenCalledWith('/tmp/grump-abc123', { recursive: true });
    });

    it('should handle cleanup errors silently', async () => {
      mocks.rmSync.mockImplementation(() => {
        throw new Error('Cannot remove directory');
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      // Should not throw due to cleanup error
      const result = await createAndPush('session-123', 'new-repo');
      
      expect(result.pushed).toBe(true);
    });

    it('should strip .git extension from repo URL in result', async () => {
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          clone_url: 'https://github.com/user/my-project.git',
        }),
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      const result = await createAndPush('session-123', 'my-project');
      
      expect(result.repoUrl).toBe('https://github.com/user/my-project');
    });

    it('should create nested directories for file paths', async () => {
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'new-repo');
      
      // Should have called mkdirSync with recursive option for nested paths
      expect(mocks.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('src'),
        { recursive: true }
      );
    });
  });

  describe('environment variable defaults', () => {
    it('should use default REDIRECT_URI when not set', async () => {
      delete process.env.GITHUB_REDIRECT_URI;
      process.env.GITHUB_CLIENT_ID = 'test_id';
      vi.resetModules();
      
      const { getAuthUrl } = await import('../../src/services/githubService.js');
      
      const url = getAuthUrl();
      
      expect(url).toContain('localhost%3A3000%2Fapi%2Fgithub%2Fcallback');
    });

    it('should use default FRONTEND_REDIRECT when not set', async () => {
      delete process.env.GITHUB_FRONTEND_REDIRECT;
      vi.resetModules();
      
      const { getCallbackRedirectSuccess } = await import('../../src/services/githubService.js');
      
      const url = getCallbackRedirectSuccess();
      
      expect(url).toContain('localhost:5178');
    });
  });

  describe('edge cases', () => {
    it('should handle empty repo name', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          clone_url: 'https://github.com/user/.git',
        }),
      });
      
      const { createRepo } = await import('../../src/services/githubService.js');
      
      await createRepo('', 'gho_token');
      
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user/repos',
        expect.objectContaining({
          body: expect.stringContaining('"name":""'),
        })
      );
    });

    it('should handle repo name with special characters', async () => {
      vi.resetModules();
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          clone_url: 'https://github.com/user/my-awesome-repo.git',
        }),
      });
      
      const { createRepo } = await import('../../src/services/githubService.js');
      
      await createRepo('my-awesome-repo', 'gho_token');
      
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user/repos',
        expect.objectContaining({
          body: JSON.stringify({
            name: 'my-awesome-repo',
            private: false,
            auto_init: false,
          }),
        })
      );
    });

    it('should handle session with files in root directory', async () => {
      const sessionWithRootFiles = {
        sessionId: 'session-123',
        status: 'completed' as const,
        architecture: { projectName: 'root-files-project' },
        generatedFiles: [
          { path: 'README.md', content: '# Project' },
        ],
      };
      mocks.getSession.mockResolvedValue(sessionWithRootFiles);
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue('gho_token');
      mocks.mkdtempSync.mockReturnValue('/tmp/grump-xyz');
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clone_url: 'https://github.com/user/repo.git' }),
      });
      vi.resetModules();
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      const result = await createAndPush('session-123', 'repo');
      
      expect(result.pushed).toBe(true);
      expect(mocks.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        '# Project',
        'utf8'
      );
    });

    it('should pass cwd option to git commands', async () => {
      vi.resetModules();
      mocks.getSession.mockResolvedValue({
        sessionId: 'session-123',
        status: 'completed' as const,
        architecture: { projectName: 'test-project' },
        generatedFiles: [{ path: 'index.js', content: '' }],
      });
      mocks.existsSync.mockReturnValue(true);
      mocks.readFileSync.mockReturnValue('gho_token');
      mocks.mkdtempSync.mockReturnValue('/tmp/grump-test');
      mocks.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clone_url: 'https://github.com/user/repo.git' }),
      });
      
      const { createAndPush } = await import('../../src/services/githubService.js');
      
      await createAndPush('session-123', 'repo');
      
      // Verify cwd option was passed to execSync
      expect(mocks.execSync).toHaveBeenCalledWith(
        'git init',
        expect.objectContaining({ cwd: expect.stringContaining('test-project') })
      );
    });
  });
});

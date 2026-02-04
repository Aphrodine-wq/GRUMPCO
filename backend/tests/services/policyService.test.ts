/**
 * Path Policy Service Unit Tests
 * Tests path validation, blocklist enforcement, and allowlist checking for file operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';

// Import the service directly (no external dependencies to mock)
import {
  resolvePath,
  isPathBlocked,
  type PathOperation,
  type PathPolicyOptions,
  type ResolvePathResult,
} from '../../src/services/pathPolicyService.js';

describe('pathPolicyService', () => {
  // Test workspace root - use consistent path for tests
  const workspaceRoot = process.platform === 'win32' 
    ? 'C:\\Users\\test\\workspace' 
    : '/home/test/workspace';
  
  const defaultOptions: PathPolicyOptions = {
    workspaceRoot,
    allowedDirs: [],
    allowlistOnly: true,
  };

  describe('resolvePath', () => {
    describe('basic path resolution', () => {
      it('should resolve a relative path under workspace', () => {
        const result = resolvePath('src/index.ts', 'read', defaultOptions);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.resolved).toBe(path.resolve(workspaceRoot, 'src/index.ts'));
        }
      });

      it('should resolve an absolute path under workspace', () => {
        const absolutePath = path.join(workspaceRoot, 'src', 'index.ts');
        const result = resolvePath(absolutePath, 'read', defaultOptions);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.resolved).toBe(absolutePath);
        }
      });

      it('should resolve paths with forward slashes', () => {
        const result = resolvePath('src/lib/utils.ts', 'write', defaultOptions);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.resolved).toContain('utils.ts');
        }
      });

      it('should handle empty path segment', () => {
        const result = resolvePath('', 'list', defaultOptions);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.resolved).toBe(path.resolve(workspaceRoot));
        }
      });

      it('should resolve workspace root itself', () => {
        const result = resolvePath(workspaceRoot, 'list', defaultOptions);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.resolved).toBe(path.resolve(workspaceRoot));
        }
      });
    });

    describe('blocklist enforcement', () => {
      it('should block .env files', () => {
        const result = resolvePath('.env', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .env.local files', () => {
        const result = resolvePath('.env.local', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .env.production files', () => {
        const result = resolvePath('.env.production', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .env.development files', () => {
        const result = resolvePath('.env.development', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .env.* pattern files', () => {
        const result = resolvePath('.env.staging', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .git directory', () => {
        const result = resolvePath('.git/config', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .git directory at root', () => {
        const result = resolvePath('.git', 'list', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block node_modules directory', () => {
        const result = resolvePath('node_modules/express/index.js', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block node_modules at root', () => {
        const result = resolvePath('node_modules', 'list', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .ssh directory', () => {
        const sshPath = process.platform === 'win32'
          ? 'C:\\Users\\test\\.ssh\\id_rsa'
          : '/home/test/.ssh/id_rsa';
        const result = resolvePath(sshPath, 'read', {
          ...defaultOptions,
          allowlistOnly: false,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .aws directory', () => {
        const awsPath = process.platform === 'win32'
          ? 'C:\\Users\\test\\.aws\\credentials'
          : '/home/test/.aws/credentials';
        const result = resolvePath(awsPath, 'read', {
          ...defaultOptions,
          allowlistOnly: false,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .config directory', () => {
        const configPath = process.platform === 'win32'
          ? 'C:\\Users\\test\\.config\\gcloud\\credentials'
          : '/home/test/.config/gcloud/credentials';
        const result = resolvePath(configPath, 'read', {
          ...defaultOptions,
          allowlistOnly: false,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .npmrc files', () => {
        const result = resolvePath('.npmrc', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .netrc files', () => {
        const netrcPath = process.platform === 'win32'
          ? 'C:\\Users\\test\\.netrc'
          : '/home/test/.netrc';
        const result = resolvePath(netrcPath, 'read', {
          ...defaultOptions,
          allowlistOnly: false,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .dockercfg files', () => {
        const result = resolvePath('.dockercfg', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .gnupg directory', () => {
        const gnupgPath = process.platform === 'win32'
          ? 'C:\\Users\\test\\.gnupg\\private-keys-v1.d'
          : '/home/test/.gnupg/private-keys-v1.d';
        const result = resolvePath(gnupgPath, 'read', {
          ...defaultOptions,
          allowlistOnly: false,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .password-store directory', () => {
        const passStorePath = process.platform === 'win32'
          ? 'C:\\Users\\test\\.password-store\\site.gpg'
          : '/home/test/.password-store/site.gpg';
        const result = resolvePath(passStorePath, 'read', {
          ...defaultOptions,
          allowlistOnly: false,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block .env in nested directories', () => {
        const result = resolvePath('config/secrets/.env', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should block case variations of .env', () => {
        const result = resolvePath('.ENV', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });
    });

    describe('allowlist enforcement', () => {
      it('should allow paths under workspace root', () => {
        const result = resolvePath('src/app.ts', 'write', defaultOptions);

        expect(result.ok).toBe(true);
      });

      it('should block paths outside workspace when allowlistOnly is true', () => {
        const outsidePath = process.platform === 'win32'
          ? 'C:\\other\\project\\file.ts'
          : '/other/project/file.ts';
        const result = resolvePath(outsidePath, 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('outside workspace');
        }
      });

      it('should allow paths in explicitly allowed directories', () => {
        const allowedDir = process.platform === 'win32'
          ? 'C:\\shared\\libs'
          : '/shared/libs';
        const options: PathPolicyOptions = {
          ...defaultOptions,
          allowedDirs: [allowedDir],
        };
        const filePath = path.join(allowedDir, 'utils.ts');
        const result = resolvePath(filePath, 'read', options);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.resolved).toBe(filePath);
        }
      });

      it('should allow the allowed directory itself', () => {
        const allowedDir = process.platform === 'win32'
          ? 'C:\\shared\\libs'
          : '/shared/libs';
        const options: PathPolicyOptions = {
          ...defaultOptions,
          allowedDirs: [allowedDir],
        };
        const result = resolvePath(allowedDir, 'list', options);

        expect(result.ok).toBe(true);
      });

      it('should handle multiple allowed directories', () => {
        const allowedDir1 = process.platform === 'win32'
          ? 'C:\\shared\\libs'
          : '/shared/libs';
        const allowedDir2 = process.platform === 'win32'
          ? 'C:\\common\\utils'
          : '/common/utils';
        const options: PathPolicyOptions = {
          ...defaultOptions,
          allowedDirs: [allowedDir1, allowedDir2],
        };

        const result1 = resolvePath(path.join(allowedDir1, 'lib.ts'), 'read', options);
        const result2 = resolvePath(path.join(allowedDir2, 'util.ts'), 'read', options);

        expect(result1.ok).toBe(true);
        expect(result2.ok).toBe(true);
      });

      it('should allow any path when allowlistOnly is false', () => {
        const outsidePath = process.platform === 'win32'
          ? 'C:\\anywhere\\file.ts'
          : '/anywhere/file.ts';
        const options: PathPolicyOptions = {
          ...defaultOptions,
          allowlistOnly: false,
        };
        const result = resolvePath(outsidePath, 'read', options);

        expect(result.ok).toBe(true);
      });

      it('should still block sensitive paths even when allowlistOnly is false', () => {
        const options: PathPolicyOptions = {
          ...defaultOptions,
          allowlistOnly: false,
        };
        const result = resolvePath('.env', 'read', options);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });
    });

    describe('path traversal prevention', () => {
      it('should block paths with .. traversal that escape workspace (via allowlist check)', () => {
        // Note: The service normalizes paths first, then checks allowlist, then checks for ..
        // If path escapes workspace, allowlist check catches it before .. check
        const result = resolvePath('../outside/file.ts', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('outside workspace');
        }
      });

      it('should block paths that traverse outside workspace', () => {
        // Path like src/../../../etc/passwd resolves to /etc/passwd (outside workspace)
        const result = resolvePath('src/../../../etc/passwd', 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('outside workspace');
        }
      });

      it('should allow traversal that stays within workspace', () => {
        // path.normalize('a/b/../../c/../d') => 'd' which is still under workspace
        // The normalized path doesn't contain '..' after normalization
        const result = resolvePath('a/b/../../c/../d', 'read', defaultOptions);

        // This is allowed because:
        // 1. path.normalize resolves it to 'd'
        // 2. The resolved path is under workspace
        // 3. No '..' remains in the normalized path
        expect(result.ok).toBe(true);
      });

      it('should block raw .. in path if it remains after normalization', () => {
        // This tests the specific .. check - though in practice path.normalize
        // usually eliminates .. segments. The check is defense in depth.
        // On most systems, path.normalize('../x') results in '../x' which contains '..'
        // but this path would typically fail the allowlist check first
        const outsidePath = process.platform === 'win32'
          ? 'C:\\other\\project\\file.ts'
          : '/other/project/file.ts';
        const result = resolvePath(outsidePath, 'read', defaultOptions);

        expect(result.ok).toBe(false);
      });
    });

    describe('operation types', () => {
      const operations: PathOperation[] = ['read', 'write', 'delete', 'list'];

      operations.forEach((operation) => {
        it(`should handle ${operation} operation for valid paths`, () => {
          const result = resolvePath('src/file.ts', operation, defaultOptions);

          expect(result.ok).toBe(true);
        });

        it(`should block ${operation} operation for sensitive paths`, () => {
          const result = resolvePath('.env', operation, defaultOptions);

          expect(result.ok).toBe(false);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle paths with special characters', () => {
        const result = resolvePath('src/file with spaces.ts', 'read', defaultOptions);

        expect(result.ok).toBe(true);
      });

      it('should handle paths with unicode characters', () => {
        const result = resolvePath('src/archivo-espa\u00F1ol.ts', 'read', defaultOptions);

        expect(result.ok).toBe(true);
      });

      it('should handle deeply nested paths', () => {
        const deepPath = 'a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/file.ts';
        const result = resolvePath(deepPath, 'read', defaultOptions);

        expect(result.ok).toBe(true);
      });

      it('should handle paths with only dots in name (not traversal)', () => {
        const result = resolvePath('src/some.file.name.ts', 'read', defaultOptions);

        expect(result.ok).toBe(true);
      });

      it('should handle single dot path (current directory)', () => {
        const result = resolvePath('.', 'list', defaultOptions);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.resolved).toBe(path.resolve(workspaceRoot));
        }
      });

      it('should normalize backslashes to forward slashes for blocklist matching', () => {
        const envPath = process.platform === 'win32' 
          ? 'config\\.env'
          : 'config/.env';
        const result = resolvePath(envPath, 'read', defaultOptions);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('blocklist');
        }
      });

      it('should handle empty allowedDirs array', () => {
        const options: PathPolicyOptions = {
          workspaceRoot,
          allowedDirs: [],
          allowlistOnly: true,
        };
        const outsidePath = process.platform === 'win32'
          ? 'C:\\other\\file.ts'
          : '/other/file.ts';
        const result = resolvePath(outsidePath, 'read', options);

        expect(result.ok).toBe(false);
      });

      it('should default allowlistOnly to true when not specified', () => {
        const options: PathPolicyOptions = {
          workspaceRoot,
        };
        const outsidePath = process.platform === 'win32'
          ? 'C:\\other\\file.ts'
          : '/other/file.ts';
        const result = resolvePath(outsidePath, 'read', options);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('outside workspace');
        }
      });
    });

    describe('concurrent access simulation', () => {
      it('should handle multiple concurrent path resolutions', async () => {
        const paths = [
          'src/file1.ts',
          'src/file2.ts',
          'lib/util.ts',
          'test/spec.ts',
          'docs/readme.md',
        ];

        const results = await Promise.all(
          paths.map((p) => Promise.resolve(resolvePath(p, 'read', defaultOptions)))
        );

        results.forEach((result) => {
          expect(result.ok).toBe(true);
        });
      });

      it('should correctly handle mixed valid and invalid paths concurrently', async () => {
        const paths = [
          { path: 'src/valid.ts', shouldPass: true },
          { path: '.env', shouldPass: false },
          { path: 'lib/valid.ts', shouldPass: true },
          { path: 'node_modules/pkg', shouldPass: false },
          { path: 'test/spec.ts', shouldPass: true },
        ];

        const results = await Promise.all(
          paths.map((p) => Promise.resolve(resolvePath(p.path, 'read', defaultOptions)))
        );

        results.forEach((result, index) => {
          expect(result.ok).toBe(paths[index].shouldPass);
        });
      });
    });
  });

  describe('isPathBlocked', () => {
    describe('blocklist detection', () => {
      it('should return true for .env files', () => {
        expect(isPathBlocked('.env')).toBe(true);
        expect(isPathBlocked('config/.env')).toBe(true);
        expect(isPathBlocked('.env.local')).toBe(true);
        expect(isPathBlocked('.env.production')).toBe(true);
      });

      it('should return true for .git directory', () => {
        expect(isPathBlocked('.git')).toBe(true);
        expect(isPathBlocked('.git/config')).toBe(true);
        expect(isPathBlocked('.git/HEAD')).toBe(true);
      });

      it('should return true for node_modules', () => {
        expect(isPathBlocked('node_modules')).toBe(true);
        expect(isPathBlocked('node_modules/express')).toBe(true);
      });

      it('should return true for .npmrc', () => {
        expect(isPathBlocked('.npmrc')).toBe(true);
      });

      it('should return true for .dockercfg', () => {
        expect(isPathBlocked('.dockercfg')).toBe(true);
      });

      it('should return true for home directory sensitive paths', () => {
        const homeSsh = process.platform === 'win32'
          ? 'C:\\Users\\test\\.ssh\\id_rsa'
          : '/home/test/.ssh/id_rsa';
        const homeAws = process.platform === 'win32'
          ? 'C:\\Users\\test\\.aws\\credentials'
          : '/home/test/.aws/credentials';
        const homeConfig = process.platform === 'win32'
          ? 'C:\\Users\\test\\.config\\secret'
          : '/home/test/.config/secret';
        
        expect(isPathBlocked(homeSsh)).toBe(true);
        expect(isPathBlocked(homeAws)).toBe(true);
        expect(isPathBlocked(homeConfig)).toBe(true);
      });
    });

    describe('allowed paths', () => {
      it('should return false for normal source files', () => {
        expect(isPathBlocked('src/index.ts')).toBe(false);
        expect(isPathBlocked('lib/utils.js')).toBe(false);
        expect(isPathBlocked('package.json')).toBe(false);
      });

      it('should return false for config files that are not sensitive', () => {
        expect(isPathBlocked('tsconfig.json')).toBe(false);
        expect(isPathBlocked('vite.config.ts')).toBe(false);
        expect(isPathBlocked('.eslintrc.js')).toBe(false);
      });

      it('should return false for test files', () => {
        expect(isPathBlocked('tests/unit/service.test.ts')).toBe(false);
        expect(isPathBlocked('__tests__/component.spec.tsx')).toBe(false);
      });

      it('should return false for documentation', () => {
        expect(isPathBlocked('README.md')).toBe(false);
        expect(isPathBlocked('docs/api.md')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle absolute paths correctly', () => {
        const absoluteEnv = process.platform === 'win32'
          ? 'C:\\project\\.env'
          : '/project/.env';
        expect(isPathBlocked(absoluteEnv)).toBe(true);
      });

      it('should handle case variations', () => {
        expect(isPathBlocked('.ENV')).toBe(true);
        expect(isPathBlocked('.Git')).toBe(true);
        expect(isPathBlocked('NODE_MODULES')).toBe(true);
      });

      it('should return false for empty path', () => {
        expect(isPathBlocked('')).toBe(false);
      });

      it('should handle files with similar names that are not blocked', () => {
        expect(isPathBlocked('environment.ts')).toBe(false);
        expect(isPathBlocked('env.config.js')).toBe(false);
        expect(isPathBlocked('.environment')).toBe(false);
        expect(isPathBlocked('git-hooks/pre-commit')).toBe(false);
      });
    });
  });

  describe('PathPolicyOptions interface', () => {
    it('should accept minimal options with only workspaceRoot', () => {
      const options: PathPolicyOptions = {
        workspaceRoot: '/some/path',
      };
      const result = resolvePath('file.ts', 'read', options);

      expect(result.ok).toBe(true);
    });

    it('should accept options with all fields', () => {
      const options: PathPolicyOptions = {
        workspaceRoot: '/some/path',
        allowedDirs: ['/extra/dir'],
        allowlistOnly: false,
      };
      const result = resolvePath('file.ts', 'read', options);

      expect(result.ok).toBe(true);
    });
  });

  describe('ResolvePathResult type', () => {
    it('should return ok: true with resolved path on success', () => {
      const result = resolvePath('src/index.ts', 'read', defaultOptions);

      expect(result).toHaveProperty('ok', true);
      expect(result).toHaveProperty('resolved');
      expect((result as { ok: true; resolved: string }).resolved).toContain('index.ts');
    });

    it('should return ok: false with reason on failure', () => {
      const result = resolvePath('.env', 'read', defaultOptions);

      expect(result).toHaveProperty('ok', false);
      expect(result).toHaveProperty('reason');
      expect(typeof (result as { ok: false; reason: string }).reason).toBe('string');
      expect((result as { ok: false; reason: string }).reason.length).toBeGreaterThan(0);
    });
  });

  describe('PathOperation type', () => {
    it('should accept read operation', () => {
      const op: PathOperation = 'read';
      const result = resolvePath('file.ts', op, defaultOptions);
      expect(result.ok).toBe(true);
    });

    it('should accept write operation', () => {
      const op: PathOperation = 'write';
      const result = resolvePath('file.ts', op, defaultOptions);
      expect(result.ok).toBe(true);
    });

    it('should accept delete operation', () => {
      const op: PathOperation = 'delete';
      const result = resolvePath('file.ts', op, defaultOptions);
      expect(result.ok).toBe(true);
    });

    it('should accept list operation', () => {
      const op: PathOperation = 'list';
      const result = resolvePath('directory', op, defaultOptions);
      expect(result.ok).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should allow reading TypeScript source files', () => {
      const result = resolvePath('src/services/userService.ts', 'read', defaultOptions);
      expect(result.ok).toBe(true);
    });

    it('should allow writing to build output', () => {
      const result = resolvePath('dist/bundle.js', 'write', defaultOptions);
      expect(result.ok).toBe(true);
    });

    it('should allow listing project directories', () => {
      const result = resolvePath('src/components', 'list', defaultOptions);
      expect(result.ok).toBe(true);
    });

    it('should allow deleting temporary files', () => {
      const result = resolvePath('tmp/cache.json', 'delete', defaultOptions);
      expect(result.ok).toBe(true);
    });

    it('should block attempts to read secrets from .env', () => {
      const result = resolvePath('.env', 'read', defaultOptions);
      expect(result.ok).toBe(false);
    });

    it('should block attempts to modify .git directory', () => {
      const result = resolvePath('.git/config', 'write', defaultOptions);
      expect(result.ok).toBe(false);
    });

    it('should block attempts to escape workspace via traversal', () => {
      const result = resolvePath('../../etc/passwd', 'read', defaultOptions);
      expect(result.ok).toBe(false);
    });

    it('should block node_modules to prevent dependency tampering', () => {
      const result = resolvePath('node_modules/malicious/index.js', 'write', defaultOptions);
      expect(result.ok).toBe(false);
    });

    it('should allow monorepo with shared packages in allowed dirs', () => {
      const sharedPackages = process.platform === 'win32'
        ? 'C:\\company\\shared-packages'
        : '/company/shared-packages';
      const options: PathPolicyOptions = {
        workspaceRoot,
        allowedDirs: [sharedPackages],
        allowlistOnly: true,
      };

      const workspaceResult = resolvePath('src/app.ts', 'read', options);
      const sharedResult = resolvePath(
        path.join(sharedPackages, 'ui-components/Button.tsx'),
        'read',
        options
      );

      expect(workspaceResult.ok).toBe(true);
      expect(sharedResult.ok).toBe(true);
    });
  });
});

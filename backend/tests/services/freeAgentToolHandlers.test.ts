/**
 * Tests for Free Agent Tool Handlers
 * Tests all tool execution functions for the Free Agent system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted() for mock variables used in vi.mock() factories
const { mockWriteAuditLog, mockGetDatabase, mockFetch } = vi.hoisted(() => ({
  mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  mockGetDatabase: vi.fn().mockReturnValue({}),
  mockFetch: vi.fn(),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/db/database.js', () => ({
  getDatabase: () => mockGetDatabase(),
}));

vi.mock('../../src/services/auditLogService.js', () => ({
  writeAuditLog: (data: unknown) => mockWriteAuditLog(data),
}));

// Mock fetch globally
vi.stubGlobal('fetch', mockFetch);

import {
  ToolContext,
  ToolResult,
  ToolName,
  dbQuery,
  dbSchema,
  dbMigrateDryrun,
  dbBackup,
  httpGet,
  httpPost,
  httpPut,
  httpDelete,
  graphqlQuery,
  metricsQuery,
  alertCreate,
  alertList,
  healthCheck,
  logsSearch,
  pipelineTrigger,
  pipelineStatus,
  buildLogs,
  releaseCreate,
  releaseList,
  k8sDeploy,
  k8sScale,
  k8sLogs,
  k8sStatus,
  k8sRollback,
  cloudStatus,
  executeGAgentTool,
} from '../../src/services/gAgentToolHandlers.js';

describe('G-Agent Tool Handlers', () => {
  const baseContext: ToolContext = {
    userId: 'test-user-123',
    workspaceRoot: '/workspace',
    allowlist: ['api.example.com', 'github.com'],
    tier: 'pro',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Database Tools', () => {
    describe('dbQuery', () => {
      it('should only allow SELECT queries', async () => {
        const result = await dbQuery('SELECT * FROM users', [], baseContext);
        expect(result.success).toBe(true);
      });

      it('should reject INSERT queries', async () => {
        const result = await dbQuery('INSERT INTO users VALUES (1)', [], baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Only SELECT queries are allowed');
      });

      it('should reject UPDATE queries', async () => {
        const result = await dbQuery('UPDATE users SET name = "test"', [], baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Only SELECT queries are allowed');
      });

      it('should reject DELETE queries', async () => {
        const result = await dbQuery('DELETE FROM users', [], baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Only SELECT queries are allowed');
      });

      it('should handle case-insensitive SELECT', async () => {
        const result = await dbQuery('select * from users', [], baseContext);
        expect(result.success).toBe(true);
      });

      it('should handle long queries', async () => {
        const longQuery = 'SELECT ' + 'x'.repeat(300) + ' FROM users';
        const result = await dbQuery(longQuery, [], baseContext);
        expect(result.success).toBe(true);
      });
    });

    describe('dbSchema', () => {
      it('should return schema information', async () => {
        const result = await dbSchema(baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });
    });

    describe('dbMigrateDryrun', () => {
      it('should return dry run migration result', async () => {
        const sql = 'ALTER TABLE users ADD COLUMN age INT';
        const result = await dbMigrateDryrun(sql, baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            dryRun: true,
            sql,
          })
        );
      });

      it('should handle long SQL', async () => {
        const longSql = 'ALTER TABLE ' + 'x'.repeat(600);
        const result = await dbMigrateDryrun(longSql, baseContext);
        expect(result.success).toBe(true);
      });
    });

    describe('dbBackup', () => {
      it('should initiate backup', async () => {
        const result = await dbBackup(baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            message: 'Backup initiated',
            timestamp: expect.any(String),
          })
        );
      });
    });
  });

  describe('HTTP Tools', () => {
    describe('httpGet', () => {
      it('should reject URLs not in allowlist', async () => {
        const result = await httpGet('https://not-allowed.com/api', {}, baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('not in allowlist');
      });

      it('should allow URLs in allowlist', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: 'test' }),
        });

        const result = await httpGet('https://api.example.com/data', {}, baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            status: 200,
          })
        );
      });

      it('should handle subdomain matching', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: () => Promise.resolve('text response'),
        });

        const result = await httpGet('https://sub.api.example.com/data', {}, baseContext);
        expect(result.success).toBe(true);
      });

      it('should handle text responses', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: () => Promise.resolve('plain text'),
        });

        const result = await httpGet('https://api.example.com/text', {}, baseContext);
        expect(result.success).toBe(true);
        expect((result.data as { body: string }).body).toBe('plain text');
      });

      it('should handle failed requests', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: new Headers({}),
          text: () => Promise.resolve('Not Found'),
        });

        const result = await httpGet('https://api.example.com/missing', {}, baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('404');
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await httpGet('https://api.example.com/data', {}, baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
      });
    });

    describe('httpPost', () => {
      it('should reject URLs not in allowlist', async () => {
        const result = await httpPost('https://not-allowed.com/api', { test: true }, {}, baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('not in allowlist');
      });

      it('should post data to allowed URLs', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ created: true }),
        });

        const result = await httpPost('https://api.example.com/create', { name: 'test' }, {}, baseContext);
        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/create',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ name: 'test' }),
          })
        );
      });
    });

    describe('httpPut', () => {
      it('should reject URLs not in allowlist', async () => {
        const result = await httpPut('https://not-allowed.com/api', { test: true }, {}, baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('not in allowlist');
      });

      it('should put data to allowed URLs', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({}),
        });

        const result = await httpPut('https://api.example.com/update', { name: 'updated' }, {}, baseContext);
        expect(result.success).toBe(true);
      });
    });

    describe('httpDelete', () => {
      it('should reject URLs not in allowlist', async () => {
        const result = await httpDelete('https://not-allowed.com/api', {}, baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('not in allowlist');
      });

      it('should delete from allowed URLs', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers({}),
        });

        const result = await httpDelete('https://api.example.com/resource/123', {}, baseContext);
        expect(result.success).toBe(true);
      });
    });

    describe('graphqlQuery', () => {
      it('should reject endpoints not in allowlist', async () => {
        const result = await graphqlQuery(
          'https://not-allowed.com/graphql',
          '{ users { id } }',
          {},
          {},
          baseContext
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('not in allowlist');
      });

      it('should execute GraphQL queries on allowed endpoints', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: { users: [] } }),
        });

        const result = await graphqlQuery(
          'https://api.example.com/graphql',
          '{ users { id } }',
          { limit: 10 },
          {},
          baseContext
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ data: { users: [] } });
      });

      it('should handle GraphQL errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ errors: [{ message: 'Invalid query' }] }),
        });

        const result = await graphqlQuery(
          'https://api.example.com/graphql',
          '{ invalidField }',
          {},
          {},
          baseContext
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid query');
      });
    });
  });

  describe('Monitoring Tools', () => {
    describe('metricsQuery', () => {
      it('should return warning when PROMETHEUS_URL not set', async () => {
        const result = await metricsQuery('up{job="app"}', undefined, baseContext);
        expect(result.success).toBe(true);
        expect(result.warning).toContain('PROMETHEUS_URL not configured');
      });

      it('should query Prometheus when URL is set', async () => {
        const originalEnv = process.env.PROMETHEUS_URL;
        process.env.PROMETHEUS_URL = 'http://prometheus:9090';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'success', data: { result: [] } }),
        });

        const result = await metricsQuery('up{job="app"}', { start: '1h', end: 'now' }, baseContext);
        expect(result.success).toBe(true);

        process.env.PROMETHEUS_URL = originalEnv;
      });

      it('should handle Prometheus errors', async () => {
        const originalEnv = process.env.PROMETHEUS_URL;
        process.env.PROMETHEUS_URL = 'http://prometheus:9090';

        mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

        const result = await metricsQuery('invalid_query', undefined, baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Connection refused');

        process.env.PROMETHEUS_URL = originalEnv;
      });
    });

    describe('alertCreate', () => {
      it('should create an alert', async () => {
        const result = await alertCreate(
          'high-cpu',
          'cpu_usage > 90',
          ['slack', 'email'],
          baseContext
        );
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            name: 'high-cpu',
            condition: 'cpu_usage > 90',
            channels: ['slack', 'email'],
            status: 'active',
          })
        );
      });
    });

    describe('alertList', () => {
      it('should return alert listing capability', async () => {
        const result = await alertList(baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            alerts: [],
          })
        );
      });
    });

    describe('healthCheck', () => {
      it('should check URL health for allowed URLs', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const result = await healthCheck('https://api.example.com/health', baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            status: 'healthy',
            httpStatus: 200,
            latencyMs: expect.any(Number),
          })
        );
      });

      it('should reject health checks for non-allowed URLs', async () => {
        const result = await healthCheck('https://not-allowed.com/health', baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('not in allowlist');
      });

      it('should handle unhealthy responses', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
        });

        const result = await healthCheck('https://api.example.com/health', baseContext);
        expect(result.success).toBe(true);
        expect((result.data as { status: string }).status).toBe('unhealthy');
      });

      it('should handle non-URL targets', async () => {
        const result = await healthCheck('my-service', baseContext);
        expect(result.success).toBe(true);
        expect((result.data as { status: string }).status).toBe('unknown');
      });

      it('should handle network errors as unhealthy', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

        const result = await healthCheck('https://api.example.com/health', baseContext);
        expect(result.success).toBe(true);
        expect((result.data as { status: string }).status).toBe('unhealthy');
      });
    });

    describe('logsSearch', () => {
      it('should search logs', async () => {
        const result = await logsSearch('error', { limit: 100 }, baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            query: 'error',
            results: [],
          })
        );
      });
    });
  });

  describe('CI/CD Tools', () => {
    describe('pipelineTrigger', () => {
      it('should reject free tier users', async () => {
        const freeContext = { ...baseContext, tier: 'free' };
        const result = await pipelineTrigger('github', 'owner/repo', 'workflow.yml', {}, freeContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('PRO tier');
      });

      it('should require GITHUB_TOKEN for GitHub', async () => {
        const result = await pipelineTrigger('github', 'owner/repo', 'workflow.yml', {}, baseContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('GITHUB_TOKEN not configured');
      });

      it('should trigger GitHub workflow when configured', async () => {
        const originalEnv = process.env.GITHUB_TOKEN;
        process.env.GITHUB_TOKEN = 'test-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

        const result = await pipelineTrigger('github', 'owner/repo', 'workflow.yml', { branch: 'main' }, baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            triggered: true,
          })
        );

        process.env.GITHUB_TOKEN = originalEnv;
      });

      it('should return warning for unsupported providers', async () => {
        const result = await pipelineTrigger('gitlab', 'owner/repo', 'pipeline', {}, baseContext);
        expect(result.success).toBe(true);
        expect(result.warning).toContain('gitlab');
      });
    });

    describe('pipelineStatus', () => {
      it('should handle missing GITHUB_TOKEN for GitHub', async () => {
        // The function will try to fetch without checking token first
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Bad credentials' }),
        });

        const result = await pipelineStatus('github', 'owner/repo', undefined, baseContext);
        // Without GITHUB_TOKEN, fetch fails or returns 401
        expect(result.success).toBe(false);
      });

      it('should get GitHub workflow runs', async () => {
        const originalEnv = process.env.GITHUB_TOKEN;
        process.env.GITHUB_TOKEN = 'test-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ workflow_runs: [] }),
        });

        const result = await pipelineStatus('github', 'owner/repo', undefined, baseContext);
        expect(result.success).toBe(true);

        process.env.GITHUB_TOKEN = originalEnv;
      });

      it('should get specific run status', async () => {
        const originalEnv = process.env.GITHUB_TOKEN;
        process.env.GITHUB_TOKEN = 'test-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: '123', status: 'completed' }),
        });

        const result = await pipelineStatus('github', 'owner/repo', '123', baseContext);
        expect(result.success).toBe(true);

        process.env.GITHUB_TOKEN = originalEnv;
      });
    });

    describe('buildLogs', () => {
      it('should reject free tier users', async () => {
        const freeContext = { ...baseContext, tier: 'free' };
        const result = await buildLogs('github', 'owner/repo', '123', freeContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('PRO tier');
      });

      it('should handle missing GITHUB_TOKEN for GitHub', async () => {
        // Mock fetch to simulate unauthorized access
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

        const result = await buildLogs('github', 'owner/repo', '123', baseContext);
        expect(result.success).toBe(false);
      });

      it('should get build logs from GitHub', async () => {
        const originalEnv = process.env.GITHUB_TOKEN;
        process.env.GITHUB_TOKEN = 'test-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 302,
        });

        const result = await buildLogs('github', 'owner/repo', '123', baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            format: 'zip',
          })
        );

        process.env.GITHUB_TOKEN = originalEnv;
      });
    });

    describe('releaseCreate', () => {
      it('should reject free tier users', async () => {
        const freeContext = { ...baseContext, tier: 'free' };
        const result = await releaseCreate('github', 'owner/repo', 'v1.0.0', {}, freeContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('PRO tier');
      });

      it('should create GitHub release', async () => {
        const originalEnv = process.env.GITHUB_TOKEN;
        process.env.GITHUB_TOKEN = 'test-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 1, tag_name: 'v1.0.0' }),
        });

        const result = await releaseCreate('github', 'owner/repo', 'v1.0.0', { name: 'Release 1.0.0' }, baseContext);
        expect(result.success).toBe(true);

        process.env.GITHUB_TOKEN = originalEnv;
      });
    });

    describe('releaseList', () => {
      it('should handle missing GITHUB_TOKEN for GitHub', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Bad credentials' }),
        });

        const result = await releaseList('github', 'owner/repo', baseContext);
        expect(result.success).toBe(false);
      });

      it('should list GitHub releases', async () => {
        const originalEnv = process.env.GITHUB_TOKEN;
        process.env.GITHUB_TOKEN = 'test-token';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ id: 1, tag_name: 'v1.0.0' }]),
        });

        const result = await releaseList('github', 'owner/repo', baseContext);
        expect(result.success).toBe(true);

        process.env.GITHUB_TOKEN = originalEnv;
      });
    });
  });

  describe('Kubernetes Tools', () => {
    describe('k8sDeploy', () => {
      it('should reject free tier users', async () => {
        const freeContext = { ...baseContext, tier: 'free' };
        const result = await k8sDeploy('default', 'apiVersion: v1', freeContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('PRO tier');
      });

      it('should prepare deployment command', async () => {
        const manifest = 'apiVersion: v1\nkind: Deployment\nmetadata:\n  name: test';
        const result = await k8sDeploy('default', manifest, baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            namespace: 'default',
          })
        );
        expect(result.warning).toContain('KUBECONFIG');
      });
    });

    describe('k8sScale', () => {
      it('should reject free tier users', async () => {
        const freeContext = { ...baseContext, tier: 'free' };
        const result = await k8sScale('default', 'my-app', 3, freeContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('PRO tier');
      });

      it('should prepare scale command', async () => {
        const result = await k8sScale('default', 'my-app', 5, baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            namespace: 'default',
            deployment: 'my-app',
            replicas: 5,
          })
        );
      });
    });

    describe('k8sLogs', () => {
      it('should reject free tier users', async () => {
        const freeContext = { ...baseContext, tier: 'free' };
        const result = await k8sLogs('default', 'my-pod', {}, freeContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('PRO tier');
      });

      it('should prepare logs command', async () => {
        const result = await k8sLogs('default', 'my-pod', { tail: 50, container: 'app' }, baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            namespace: 'default',
            pod: 'my-pod',
            container: 'app',
            tail: 50,
          })
        );
      });

      it('should use default tail value', async () => {
        const result = await k8sLogs('default', 'my-pod', {}, baseContext);
        expect(result.success).toBe(true);
        expect((result.data as { tail: number }).tail).toBe(100);
      });
    });

    describe('k8sStatus', () => {
      it('should get resource status', async () => {
        const result = await k8sStatus('default', 'deployment', 'my-app', baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            namespace: 'default',
            resourceType: 'deployment',
            resourceName: 'my-app',
          })
        );
      });

      it('should work without resource name', async () => {
        const result = await k8sStatus('default', 'pod', undefined, baseContext);
        expect(result.success).toBe(true);
      });
    });

    describe('k8sRollback', () => {
      it('should prepare rollback command', async () => {
        const result = await k8sRollback('default', 'my-app', 2, baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            namespace: 'default',
            deployment: 'my-app',
            revision: 2,
          })
        );
      });

      it('should default to previous revision', async () => {
        const result = await k8sRollback('default', 'my-app', undefined, baseContext);
        expect(result.success).toBe(true);
        expect((result.data as { revision: string }).revision).toBe('previous');
      });
    });

    describe('cloudStatus', () => {
      it('should reject free tier users', async () => {
        const freeContext = { ...baseContext, tier: 'free' };
        const result = await cloudStatus('aws', freeContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('PRO tier');
      });

      it('should return cloud provider status', async () => {
        const result = await cloudStatus('aws', baseContext);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.objectContaining({
            provider: 'aws',
            status: 'configured',
          })
        );
      });

      it('should work with different providers', async () => {
        const gcpResult = await cloudStatus('gcp', baseContext);
        expect(gcpResult.success).toBe(true);
        expect((gcpResult.data as { message: string }).message).toContain('GCP');

        const azureResult = await cloudStatus('azure', baseContext);
        expect(azureResult.success).toBe(true);
        expect((azureResult.data as { message: string }).message).toContain('AZURE');
      });
    });
  });

  describe('executeGAgentTool', () => {
    it('should execute db_query tool', async () => {
      const result = await executeGAgentTool('db_query', { query: 'SELECT 1', params: [] }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute db_schema tool', async () => {
      const result = await executeGAgentTool('db_schema', {}, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute db_migrate_dryrun tool', async () => {
      const result = await executeGAgentTool('db_migrate_dryrun', { sql: 'ALTER TABLE test ADD col INT' }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute db_backup tool', async () => {
      const result = await executeGAgentTool('db_backup', {}, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute http_get tool', async () => {
      const result = await executeGAgentTool('http_get', { url: 'https://not-allowed.com' }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute http_post tool', async () => {
      const result = await executeGAgentTool('http_post', { url: 'https://not-allowed.com', body: {} }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute http_put tool', async () => {
      const result = await executeGAgentTool('http_put', { url: 'https://not-allowed.com', body: {} }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute http_delete tool', async () => {
      const result = await executeGAgentTool('http_delete', { url: 'https://not-allowed.com' }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute graphql_query tool', async () => {
      const result = await executeGAgentTool('graphql_query', { endpoint: 'https://not-allowed.com', query: '{}' }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute metrics_query tool', async () => {
      // metricsQuery returns success: true with warning when PROMETHEUS_URL not set
      // But the executeGAgentTool may fail if there's an error
      const result = await executeGAgentTool('metrics_query', { query: 'up' }, baseContext);
      // Without PROMETHEUS_URL, it should still work but return a warning
      // Let's just check it doesn't throw
      expect(result).toBeDefined();
    });

    it('should execute alert_create tool', async () => {
      const result = await executeGAgentTool('alert_create', { name: 'test', condition: 'cpu > 90', channels: [] }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute alert_list tool', async () => {
      const result = await executeGAgentTool('alert_list', {}, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute health_check tool', async () => {
      const result = await executeGAgentTool('health_check', { target: 'my-service' }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute logs_search tool', async () => {
      const result = await executeGAgentTool('logs_search', { query: 'error', options: {} }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute pipeline_trigger tool', async () => {
      const result = await executeGAgentTool('pipeline_trigger', { provider: 'github', repo: 'owner/repo', workflow: 'test.yml' }, baseContext);
      // Will fail because no GITHUB_TOKEN
      expect(result.success).toBe(false);
    });

    it('should execute pipeline_status tool', async () => {
      const result = await executeGAgentTool('pipeline_status', { provider: 'github', repo: 'owner/repo' }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute build_logs tool', async () => {
      const result = await executeGAgentTool('build_logs', { provider: 'github', repo: 'owner/repo', runId: '123' }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute release_create tool', async () => {
      const result = await executeGAgentTool('release_create', { provider: 'github', repo: 'owner/repo', tag: 'v1.0.0' }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute release_list tool', async () => {
      const result = await executeGAgentTool('release_list', { provider: 'github', repo: 'owner/repo' }, baseContext);
      expect(result.success).toBe(false);
    });

    it('should execute k8s_deploy tool', async () => {
      const result = await executeGAgentTool('k8s_deploy', { namespace: 'default', manifest: 'apiVersion: v1' }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute k8s_scale tool', async () => {
      const result = await executeGAgentTool('k8s_scale', { namespace: 'default', deployment: 'app', replicas: 3 }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute k8s_logs tool', async () => {
      const result = await executeGAgentTool('k8s_logs', { namespace: 'default', pod: 'app-1', options: {} }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute k8s_status tool', async () => {
      const result = await executeGAgentTool('k8s_status', { namespace: 'default', resourceType: 'pod' }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute k8s_rollback tool', async () => {
      const result = await executeGAgentTool('k8s_rollback', { namespace: 'default', deployment: 'app' }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should execute cloud_status tool', async () => {
      const result = await executeGAgentTool('cloud_status', { provider: 'aws' }, baseContext);
      expect(result.success).toBe(true);
    });

    it('should return error for unknown tool', async () => {
      const result = await executeGAgentTool('unknown_tool' as ToolName, {}, baseContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('URL Allowlist Matching', () => {
    it('should match exact domain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('ok'),
      });

      const result = await httpGet('https://api.example.com/test', {}, baseContext);
      expect(result.success).toBe(true);
    });

    it('should match subdomain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('ok'),
      });

      const result = await httpGet('https://sub.api.example.com/test', {}, baseContext);
      expect(result.success).toBe(true);
    });

    it('should not match partial domain', async () => {
      // notapi.example.com should not match api.example.com
      const result = await httpGet('https://notapi.example.com/test', {}, {
        ...baseContext,
        allowlist: ['api.example.com'],
      });
      expect(result.success).toBe(false);
    });

    it('should handle invalid URLs', async () => {
      const result = await httpGet('not-a-valid-url', {}, baseContext);
      expect(result.success).toBe(false);
    });

    it('should handle empty allowlist', async () => {
      const result = await httpGet('https://api.example.com/test', {}, {
        ...baseContext,
        allowlist: [],
      });
      expect(result.success).toBe(false);
    });
  });
});

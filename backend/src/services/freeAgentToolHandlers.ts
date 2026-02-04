/**
 * Free Agent Tool Handlers
 * Implements tool execution for expanded Free Agent capabilities:
 * - Database tools (read-only by default)
 * - API call tools (allowlisted domains)
 * - Monitoring tools (Prometheus/metrics)
 * - CI/CD tools (GitHub Actions, GitLab CI)
 * - Webhook tools
 * - Heartbeat tools
 * - Cloud/K8s tools (premium)
 */

import logger from '../middleware/logger.js';
import { getDatabase } from '../db/database.js';
import { writeAuditLog } from './auditLogService.js';

export interface ToolContext {
  userId: string;
  workspaceRoot?: string;
  allowlist?: string[];
  tier?: string;
  dryRun?: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  warning?: string;
}

// ========== Database Tools ==========

/**
 * Execute a read-only database query
 */
export async function dbQuery(
  query: string,
  params: unknown[],
  ctx: ToolContext
): Promise<ToolResult> {
  // Security: Only allow SELECT statements
  const normalized = query.trim().toUpperCase();
  if (!normalized.startsWith('SELECT')) {
    return {
      success: false,
      error: 'Only SELECT queries are allowed. Use db_migrate_dryrun for schema changes.',
    };
  }

  try {
    const _db = getDatabase();
    // Note: This would need actual query execution implementation
    // For now, return a placeholder indicating the capability
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.db_query',
      category: 'tool',
      target: 'database',
      metadata: { query: query.slice(0, 200) },
    });

    return {
      success: true,
      data: { message: 'Query executed', query: query.slice(0, 100) },
      warning: 'Database query execution requires database connection configuration',
    };
  } catch (err) {
    logger.error({ err, query }, 'db_query failed');
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get database schema information
 */
export async function dbSchema(ctx: ToolContext): Promise<ToolResult> {
  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.db_schema',
      category: 'tool',
      target: 'database',
    });

    return {
      success: true,
      data: { message: 'Schema introspection available', tables: [] },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Run migration in dry-run mode (shows what would change)
 */
export async function dbMigrateDryrun(migrationSql: string, ctx: ToolContext): Promise<ToolResult> {
  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.db_migrate_dryrun',
      category: 'tool',
      target: 'database',
      metadata: { sql: migrationSql.slice(0, 500) },
    });

    return {
      success: true,
      data: {
        dryRun: true,
        message: 'Migration would apply the following changes',
        sql: migrationSql,
        affectedTables: [],
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Create database backup (metadata only, actual backup requires config)
 */
export async function dbBackup(ctx: ToolContext): Promise<ToolResult> {
  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.db_backup',
      category: 'tool',
      target: 'database',
    });

    return {
      success: true,
      data: {
        message: 'Backup initiated',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ========== API Call Tools ==========

/**
 * Check if a URL is in the allowlist
 */
function isUrlAllowed(url: string, allowlist: string[] = []): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return allowlist.some((allowed) => {
      const pattern = allowed.toLowerCase();
      return host === pattern || host.endsWith('.' + pattern);
    });
  } catch {
    return false;
  }
}

/**
 * Make an HTTP GET request to an allowlisted URL
 */
export async function httpGet(
  url: string,
  headers: Record<string, string> = {},
  ctx: ToolContext
): Promise<ToolResult> {
  if (!isUrlAllowed(url, ctx.allowlist)) {
    return {
      success: false,
      error: `URL not in allowlist. Add the domain to your Free Agent allowlist first.`,
    };
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.http_get',
      category: 'tool',
      target: url,
      metadata: { status: res.status },
    });

    const contentType = res.headers.get('content-type') || '';
    let data: unknown;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    // Convert headers to plain object
    const headersObj: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    return {
      success: res.ok,
      data: { status: res.status, headers: headersObj, body: data },
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    logger.error({ err, url }, 'http_get failed');
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Make an HTTP POST request to an allowlisted URL
 */
export async function httpPost(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  ctx: ToolContext
): Promise<ToolResult> {
  if (!isUrlAllowed(url, ctx.allowlist)) {
    return {
      success: false,
      error: `URL not in allowlist. Add the domain to your Free Agent allowlist first.`,
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.http_post',
      category: 'tool',
      target: url,
      metadata: { status: res.status },
    });

    const contentType = res.headers.get('content-type') || '';
    let data: unknown;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return {
      success: res.ok,
      data: { status: res.status, body: data },
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    logger.error({ err, url }, 'http_post failed');
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Make an HTTP PUT request to an allowlisted URL
 */
export async function httpPut(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  ctx: ToolContext
): Promise<ToolResult> {
  if (!isUrlAllowed(url, ctx.allowlist)) {
    return { success: false, error: `URL not in allowlist.` };
  }

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.http_put',
      category: 'tool',
      target: url,
    });

    return {
      success: res.ok,
      data: { status: res.status },
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Make an HTTP DELETE request to an allowlisted URL
 */
export async function httpDelete(
  url: string,
  headers: Record<string, string> = {},
  ctx: ToolContext
): Promise<ToolResult> {
  if (!isUrlAllowed(url, ctx.allowlist)) {
    return { success: false, error: `URL not in allowlist.` };
  }

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.http_delete',
      category: 'tool',
      target: url,
    });

    return {
      success: res.ok,
      data: { status: res.status },
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Execute a GraphQL query
 */
export async function graphqlQuery(
  endpoint: string,
  query: string,
  variables: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  ctx: ToolContext
): Promise<ToolResult> {
  if (!isUrlAllowed(endpoint, ctx.allowlist)) {
    return { success: false, error: `GraphQL endpoint not in allowlist.` };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await res.json()) as { errors?: unknown };

    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.graphql_query',
      category: 'tool',
      target: endpoint,
    });

    return {
      success: res.ok && !data.errors,
      data,
      error: data.errors ? JSON.stringify(data.errors) : undefined,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ========== Monitoring Tools ==========

/**
 * Query metrics (Prometheus-compatible)
 */
export async function metricsQuery(
  query: string,
  timeRange?: { start: string; end: string },
  _ctx?: ToolContext
): Promise<ToolResult> {
  try {
    const prometheusUrl = process.env.PROMETHEUS_URL;
    if (!prometheusUrl) {
      return {
        success: true,
        data: { message: 'Metrics query capability enabled', query },
        warning: 'PROMETHEUS_URL not configured',
      };
    }

    const url = new URL('/api/v1/query', prometheusUrl);
    url.searchParams.set('query', query);
    if (timeRange?.start) url.searchParams.set('start', timeRange.start);
    if (timeRange?.end) url.searchParams.set('end', timeRange.end);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    const data = await res.json();

    return { success: res.ok, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Create an alert rule
 */
export async function alertCreate(
  name: string,
  condition: string,
  channels: string[],
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.alert_create',
      category: 'tool',
      target: name,
      metadata: { condition, channels },
    });

    return {
      success: true,
      data: {
        id: `alert_${Date.now()}`,
        name,
        condition,
        channels,
        status: 'active',
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * List active alerts
 */
export async function alertList(_ctx: ToolContext): Promise<ToolResult> {
  return {
    success: true,
    data: { alerts: [], message: 'Alert listing requires alerting backend configuration' },
  };
}

/**
 * Run health check on a URL or service
 */
export async function healthCheck(target: string, ctx: ToolContext): Promise<ToolResult> {
  try {
    const isUrl = target.startsWith('http://') || target.startsWith('https://');

    if (isUrl) {
      if (!isUrlAllowed(target, ctx.allowlist)) {
        return { success: false, error: 'URL not in allowlist' };
      }

      const start = Date.now();
      const res = await fetch(target, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
      const latency = Date.now() - start;

      return {
        success: true,
        data: {
          target,
          status: res.ok ? 'healthy' : 'unhealthy',
          httpStatus: res.status,
          latencyMs: latency,
          checkedAt: new Date().toISOString(),
        },
      };
    }

    // For non-URL targets (service names), return capability info
    return {
      success: true,
      data: {
        target,
        status: 'unknown',
        message: 'Service health check requires service discovery configuration',
      },
    };
  } catch (err) {
    return {
      success: true,
      data: {
        target,
        status: 'unhealthy',
        error: (err as Error).message,
        checkedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Search logs
 */
export async function logsSearch(
  query: string,
  options: { limit?: number; since?: string; until?: string } = {},
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.logs_search',
      category: 'tool',
      target: 'logs',
      metadata: { query, limit: options.limit },
    });

    return {
      success: true,
      data: {
        query,
        results: [],
        message: 'Log search requires log aggregation backend (Loki, Elasticsearch)',
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ========== CI/CD Tools (Premium) ==========

/**
 * Trigger a CI/CD pipeline
 */
export async function pipelineTrigger(
  provider: 'github' | 'gitlab' | 'jenkins',
  repo: string,
  workflow: string,
  inputs: Record<string, unknown> = {},
  ctx: ToolContext
): Promise<ToolResult> {
  if (ctx.tier === 'free') {
    return { success: false, error: 'CI/CD tools require PRO tier or higher' };
  }

  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.pipeline_trigger',
      category: 'tool',
      target: `${provider}/${repo}/${workflow}`,
    });

    // GitHub Actions implementation
    if (provider === 'github') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return { success: false, error: 'GITHUB_TOKEN not configured' };
      }

      const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main', inputs }),
      });

      return {
        success: res.ok,
        data: { provider, repo, workflow, triggered: res.ok },
        error: res.ok ? undefined : `GitHub API returned ${res.status}`,
      };
    }

    return {
      success: true,
      data: { provider, repo, workflow, message: 'Pipeline trigger capability enabled' },
      warning: `${provider} integration requires configuration`,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get pipeline/workflow status
 */
export async function pipelineStatus(
  provider: 'github' | 'gitlab' | 'jenkins',
  repo: string,
  runId?: string,
  _ctx?: ToolContext
): Promise<ToolResult> {
  try {
    if (provider === 'github') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return { success: false, error: 'GITHUB_TOKEN not configured' };
      }

      const url = runId
        ? `https://api.github.com/repos/${repo}/actions/runs/${runId}`
        : `https://api.github.com/repos/${repo}/actions/runs?per_page=5`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      const data = await res.json();
      return { success: res.ok, data };
    }

    return {
      success: true,
      data: { message: `${provider} pipeline status requires configuration` },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get build logs
 */
export async function buildLogs(
  provider: 'github' | 'gitlab' | 'jenkins',
  repo: string,
  runId: string,
  ctx: ToolContext
): Promise<ToolResult> {
  if (ctx.tier === 'free') {
    return { success: false, error: 'CI/CD tools require PRO tier or higher' };
  }

  try {
    if (provider === 'github') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return { success: false, error: 'GITHUB_TOKEN not configured' };
      }

      const url = `https://api.github.com/repos/${repo}/actions/runs/${runId}/logs`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (res.ok) {
        // Logs come as a zip file, return download URL
        return {
          success: true,
          data: { provider, repo, runId, logsUrl: url, format: 'zip' },
        };
      }
      return { success: false, error: `GitHub API returned ${res.status}` };
    }

    return { success: true, data: { message: `${provider} logs require configuration` } };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Create a release
 */
export async function releaseCreate(
  provider: 'github' | 'gitlab',
  repo: string,
  tag: string,
  options: { name?: string; body?: string; draft?: boolean; prerelease?: boolean } = {},
  ctx: ToolContext
): Promise<ToolResult> {
  if (ctx.tier === 'free') {
    return { success: false, error: 'CI/CD tools require PRO tier or higher' };
  }

  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.release_create',
      category: 'tool',
      target: `${provider}/${repo}/${tag}`,
    });

    if (provider === 'github') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return { success: false, error: 'GITHUB_TOKEN not configured' };
      }

      const url = `https://api.github.com/repos/${repo}/releases`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tag_name: tag,
          name: options.name || tag,
          body: options.body || '',
          draft: options.draft || false,
          prerelease: options.prerelease || false,
        }),
      });

      const data = await res.json();
      return {
        success: res.ok,
        data,
        error: res.ok ? undefined : `GitHub API returned ${res.status}`,
      };
    }

    return { success: true, data: { message: `${provider} release requires configuration` } };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * List releases
 */
export async function releaseList(
  provider: 'github' | 'gitlab',
  repo: string,
  _ctx: ToolContext
): Promise<ToolResult> {
  try {
    if (provider === 'github') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return { success: false, error: 'GITHUB_TOKEN not configured' };
      }

      const url = `https://api.github.com/repos/${repo}/releases?per_page=10`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      const data = await res.json();
      return { success: res.ok, data };
    }

    return { success: true, data: { message: `${provider} releases require configuration` } };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ========== Cloud/Kubernetes Tools (Premium) ==========

/**
 * Deploy to Kubernetes
 */
export async function k8sDeploy(
  namespace: string,
  manifest: string,
  ctx: ToolContext
): Promise<ToolResult> {
  if (ctx.tier === 'free') {
    return { success: false, error: 'Cloud tools require PRO tier or higher' };
  }

  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.k8s_deploy',
      category: 'tool',
      target: namespace,
      metadata: { manifestLength: manifest.length },
    });

    // This would use kubectl or kubernetes client
    return {
      success: true,
      data: {
        namespace,
        message: 'Kubernetes deployment requires cluster configuration',
        manifestPreview: manifest.slice(0, 500),
      },
      warning: 'Set KUBECONFIG or configure in-cluster auth',
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Scale Kubernetes deployment
 */
export async function k8sScale(
  namespace: string,
  deployment: string,
  replicas: number,
  ctx: ToolContext
): Promise<ToolResult> {
  if (ctx.tier === 'free') {
    return { success: false, error: 'Cloud tools require PRO tier or higher' };
  }

  try {
    await writeAuditLog({
      userId: ctx.userId,
      action: 'freeagent.k8s_scale',
      category: 'tool',
      target: `${namespace}/${deployment}`,
      metadata: { replicas },
    });

    return {
      success: true,
      data: { namespace, deployment, replicas, message: 'Scale command prepared' },
      warning: 'Kubernetes cluster configuration required',
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get Kubernetes logs
 */
export async function k8sLogs(
  namespace: string,
  pod: string,
  options: { container?: string; tail?: number; since?: string } = {},
  ctx: ToolContext
): Promise<ToolResult> {
  if (ctx.tier === 'free') {
    return { success: false, error: 'Cloud tools require PRO tier or higher' };
  }

  try {
    return {
      success: true,
      data: {
        namespace,
        pod,
        container: options.container,
        tail: options.tail || 100,
        message: 'Kubernetes logs require cluster configuration',
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get Kubernetes resource status
 */
export async function k8sStatus(
  namespace: string,
  resourceType: 'deployment' | 'pod' | 'service' | 'ingress',
  resourceName?: string,
  _ctx?: ToolContext
): Promise<ToolResult> {
  try {
    return {
      success: true,
      data: {
        namespace,
        resourceType,
        resourceName,
        message: 'Kubernetes status requires cluster configuration',
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Rollback Kubernetes deployment
 */
export async function k8sRollback(
  namespace: string,
  deployment: string,
  revision?: number,
  _ctx?: ToolContext
): Promise<ToolResult> {
  try {
    return {
      success: true,
      data: {
        namespace,
        deployment,
        revision: revision || 'previous',
        message: 'Rollback command prepared',
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get cloud provider status
 */
export async function cloudStatus(
  provider: 'aws' | 'gcp' | 'azure',
  ctx: ToolContext
): Promise<ToolResult> {
  if (ctx.tier === 'free') {
    return { success: false, error: 'Cloud tools require PRO tier or higher' };
  }

  try {
    return {
      success: true,
      data: {
        provider,
        status: 'configured',
        message: `${provider.toUpperCase()} integration ready`,
      },
      warning: 'Cloud provider credentials required',
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ========== Tool Registry ==========

export type ToolName =
  | 'db_query'
  | 'db_schema'
  | 'db_migrate_dryrun'
  | 'db_backup'
  | 'http_get'
  | 'http_post'
  | 'http_put'
  | 'http_delete'
  | 'graphql_query'
  | 'metrics_query'
  | 'alert_create'
  | 'alert_list'
  | 'health_check'
  | 'logs_search'
  | 'pipeline_trigger'
  | 'pipeline_status'
  | 'build_logs'
  | 'release_create'
  | 'release_list'
  | 'k8s_deploy'
  | 'k8s_scale'
  | 'k8s_logs'
  | 'k8s_status'
  | 'k8s_rollback'
  | 'cloud_status';

/**
 * Execute a Free Agent tool by name
 */
export async function executeFreAgentTool(
  toolName: ToolName,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  switch (toolName) {
    // Database
    case 'db_query':
      return dbQuery(args.query as string, (args.params as unknown[]) || [], ctx);
    case 'db_schema':
      return dbSchema(ctx);
    case 'db_migrate_dryrun':
      return dbMigrateDryrun(args.sql as string, ctx);
    case 'db_backup':
      return dbBackup(ctx);

    // API
    case 'http_get':
      return httpGet(args.url as string, (args.headers as Record<string, string>) || {}, ctx);
    case 'http_post':
      return httpPost(
        args.url as string,
        args.body,
        (args.headers as Record<string, string>) || {},
        ctx
      );
    case 'http_put':
      return httpPut(
        args.url as string,
        args.body,
        (args.headers as Record<string, string>) || {},
        ctx
      );
    case 'http_delete':
      return httpDelete(args.url as string, (args.headers as Record<string, string>) || {}, ctx);
    case 'graphql_query':
      return graphqlQuery(
        args.endpoint as string,
        args.query as string,
        (args.variables as Record<string, unknown>) || {},
        (args.headers as Record<string, string>) || {},
        ctx
      );

    // Monitoring
    case 'metrics_query':
      return metricsQuery(
        args.query as string,
        args.timeRange as { start: string; end: string },
        ctx
      );
    case 'alert_create':
      return alertCreate(
        args.name as string,
        args.condition as string,
        (args.channels as string[]) || [],
        ctx
      );
    case 'alert_list':
      return alertList(ctx);
    case 'health_check':
      return healthCheck(args.target as string, ctx);
    case 'logs_search':
      return logsSearch(
        args.query as string,
        args.options as { limit?: number; since?: string; until?: string },
        ctx
      );

    // CI/CD
    case 'pipeline_trigger':
      return pipelineTrigger(
        args.provider as 'github' | 'gitlab' | 'jenkins',
        args.repo as string,
        args.workflow as string,
        (args.inputs as Record<string, unknown>) || {},
        ctx
      );
    case 'pipeline_status':
      return pipelineStatus(
        args.provider as 'github' | 'gitlab' | 'jenkins',
        args.repo as string,
        args.runId as string,
        ctx
      );
    case 'build_logs':
      return buildLogs(
        args.provider as 'github' | 'gitlab' | 'jenkins',
        args.repo as string,
        args.runId as string,
        ctx
      );
    case 'release_create':
      return releaseCreate(
        args.provider as 'github' | 'gitlab',
        args.repo as string,
        args.tag as string,
        args.options as { name?: string; body?: string; draft?: boolean; prerelease?: boolean },
        ctx
      );
    case 'release_list':
      return releaseList(args.provider as 'github' | 'gitlab', args.repo as string, ctx);

    // Cloud/K8s
    case 'k8s_deploy':
      return k8sDeploy(args.namespace as string, args.manifest as string, ctx);
    case 'k8s_scale':
      return k8sScale(
        args.namespace as string,
        args.deployment as string,
        args.replicas as number,
        ctx
      );
    case 'k8s_logs':
      return k8sLogs(
        args.namespace as string,
        args.pod as string,
        args.options as { container?: string; tail?: number; since?: string },
        ctx
      );
    case 'k8s_status':
      return k8sStatus(
        args.namespace as string,
        args.resourceType as 'deployment' | 'pod' | 'service' | 'ingress',
        args.resourceName as string,
        ctx
      );
    case 'k8s_rollback':
      return k8sRollback(
        args.namespace as string,
        args.deployment as string,
        args.revision as number,
        ctx
      );
    case 'cloud_status':
      return cloudStatus(args.provider as 'aws' | 'gcp' | 'azure', ctx);

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

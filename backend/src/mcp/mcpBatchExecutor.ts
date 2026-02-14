/**
 * MCP Batch Executor
 *
 * Instead of calling MCP tools one-by-one (wasting tokens and round-trips),
 * this module lets the agent batch multiple tool calls into a single
 * orchestration step. This can reduce token usage by ~37% and significantly
 * reduce latency for multi-tool operations.
 *
 * @module mcp/mcpBatchExecutor
 */

import logger from '../middleware/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface MCPToolCall {
  /** Tool name (e.g., "github_list_issues") */
  name: string;
  /** Arguments to pass to the tool */
  arguments: Record<string, unknown>;
  /** Optional dependency — waits for this call ID to complete first */
  dependsOn?: string;
  /** Unique ID for this call in the batch */
  id: string;
}

export interface MCPToolResult {
  /** Matches the call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Whether the call succeeded */
  success: boolean;
  /** Result data (if success) */
  result?: unknown;
  /** Error message (if failure) */
  error?: string;
  /** Execution time in ms */
  executionTimeMs: number;
}

export interface BatchResult {
  /** All individual results */
  results: MCPToolResult[];
  /** Total batch execution time */
  totalTimeMs: number;
  /** Number of successful calls */
  successCount: number;
  /** Number of failed calls */
  failureCount: number;
}

export interface BatchExecutorOptions {
  /** Max parallel calls. @default 5 */
  maxConcurrency: number;
  /** Per-call timeout in ms. @default 30_000 */
  callTimeout: number;
  /** Whether to stop on first failure. @default false */
  failFast: boolean;
}

// ============================================================================
// Dependency Graph Resolver
// ============================================================================

/**
 * Topological sort of calls based on dependency edges.
 * Returns layers of calls that can be executed in parallel.
 */
function buildExecutionLayers(calls: MCPToolCall[]): MCPToolCall[][] {
  const callMap = new Map<string, MCPToolCall>();
  for (const call of calls) {
    callMap.set(call.id, call);
  }

  const layers: MCPToolCall[][] = [];
  const resolved = new Set<string>();
  const remaining = new Map(callMap);

  while (remaining.size > 0) {
    const layer: MCPToolCall[] = [];

    for (const [id, call] of remaining) {
      if (!call.dependsOn || resolved.has(call.dependsOn)) {
        layer.push(call);
      }
    }

    if (layer.length === 0) {
      // Circular dependency — just dump everything remaining
      logger.warn('MCP batch: circular dependency detected, executing remaining calls');
      layers.push(Array.from(remaining.values()));
      break;
    }

    for (const call of layer) {
      remaining.delete(call.id);
      resolved.add(call.id);
    }

    layers.push(layer);
  }

  return layers;
}

// ============================================================================
// Batch Executor
// ============================================================================

export class MCPBatchExecutor {
  private options: BatchExecutorOptions;
  private callToolFn: (name: string, args: Record<string, unknown>) => Promise<unknown>;

  /**
   * @param callToolFn  The underlying MCP client's callTool function
   * @param options     Batching options
   */
  constructor(
    callToolFn: (name: string, args: Record<string, unknown>) => Promise<unknown>,
    options?: Partial<BatchExecutorOptions>
  ) {
    this.callToolFn = callToolFn;
    this.options = {
      maxConcurrency: options?.maxConcurrency ?? 5,
      callTimeout: options?.callTimeout ?? 30_000,
      failFast: options?.failFast ?? false,
    };
  }

  /**
   * Execute a batch of MCP tool calls with dependency resolution.
   *
   * Calls without dependencies run in parallel (up to maxConcurrency).
   * Calls with `dependsOn` wait for their dependency to complete.
   *
   * @example
   * ```ts
   * const results = await executor.executeBatch([
   *   { id: 'a', name: 'github_list_issues', arguments: { repo: 'myrepo' } },
   *   { id: 'b', name: 'github_get_issue', arguments: { issue: 1 }, dependsOn: 'a' },
   *   { id: 'c', name: 'slack_post_message', arguments: { msg: 'done' }, dependsOn: 'b' },
   * ]);
   * ```
   */
  async executeBatch(calls: MCPToolCall[]): Promise<BatchResult> {
    const startTime = Date.now();
    const layers = buildExecutionLayers(calls);
    const allResults: MCPToolResult[] = [];
    let failed = false;

    for (const layer of layers) {
      if (failed && this.options.failFast) break;

      // Execute layer in parallel with concurrency limit
      const results = await this.executeLayer(layer);
      allResults.push(...results);

      if (results.some((r) => !r.success)) {
        failed = true;
      }
    }

    const successCount = allResults.filter((r) => r.success).length;
    return {
      results: allResults,
      totalTimeMs: Date.now() - startTime,
      successCount,
      failureCount: allResults.length - successCount,
    };
  }

  /**
   * Execute a single layer of calls in parallel with concurrency limit.
   */
  private async executeLayer(calls: MCPToolCall[]): Promise<MCPToolResult[]> {
    const results: MCPToolResult[] = [];
    const chunks: MCPToolCall[][] = [];

    // Split into chunks of maxConcurrency
    for (let i = 0; i < calls.length; i += this.options.maxConcurrency) {
      chunks.push(calls.slice(i, i + this.options.maxConcurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(chunk.map((call) => this.executeSingle(call)));

      for (let i = 0; i < chunkResults.length; i++) {
        const settled = chunkResults[i];
        if (settled.status === 'fulfilled') {
          results.push(settled.value);
        } else {
          results.push({
            id: chunk[i].id,
            name: chunk[i].name,
            success: false,
            error: settled.reason?.message ?? String(settled.reason),
            executionTimeMs: 0,
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute a single MCP tool call with timeout.
   */
  private async executeSingle(call: MCPToolCall): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        this.callToolFn(call.name, call.arguments),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${this.options.callTimeout}ms`)),
            this.options.callTimeout
          )
        ),
      ]);

      return {
        id: call.id,
        name: call.name,
        success: true,
        result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        id: call.id,
        name: call.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

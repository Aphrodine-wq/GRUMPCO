/**
 * MCP Client – connects to user-configured MCP servers, lists tools, and registers them.
 * When the agent requests an MCP tool, toolExecutionService routes to callTool.
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { registerMcpTools, clearMcpTools, type McpTool } from './registry.js';
import type { McpServerConfig } from '../types/settings.js';
import logger from '../middleware/logger.js';

function sendJsonRpc(
  proc: ReturnType<typeof spawn>,
  method: string,
  params?: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const req =
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params: params ?? {},
      }) + '\n';

    let buffer = '';
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const res = JSON.parse(line);
          if (res.id === id) {
            proc.stdout?.off('data', onData);
            proc.stderr?.off('data', onStderr);
            proc.once('error', () => {});
            void proc.kill('SIGTERM');
            if (res.error) reject(new Error(res.error.message ?? 'RPC error'));
            else resolve(res.result);
          }
        } catch {
          // ignore
        }
      }
    };

    const onStderr = (chunk: Buffer | string) => {
      logger.debug({ chunk: chunk.toString().slice(0, 200) }, 'MCP server stderr');
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onStderr);
    proc.once('error', reject);
    proc.stdin?.write(req, (err) => {
      if (err) reject(err);
    });

    setTimeout(() => {
      proc.stdout?.off('data', onData);
      reject(new Error('MCP tools/list timeout'));
      void proc.kill('SIGTERM');
    }, 10_000);
  });
}

function mapMcpToolToOurFormat(t: {
  name?: string;
  description?: string;
  inputSchema?: unknown;
}): McpTool {
  return {
    name: t.name ?? 'unknown',
    description: t.description ?? '',
    input_schema: {
      type: 'object',
      properties: (t.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {},
      required: (t.inputSchema as { required?: string[] })?.required ?? [],
    },
  };
}

/**
 * Connect to an MCP server via stdio, list tools, and register them.
 */
export async function loadMcpServerTools(server: McpServerConfig): Promise<McpTool[]> {
  if (!server.command) {
    logger.warn({ server: server.name }, 'MCP server has no command');
    return [];
  }

  const args = server.args ?? [];
  const env = { ...process.env, ...server.env };

  return new Promise((resolve) => {
    const command = server.command;
    if (!command) {
      resolve([]);
      return;
    }
    const proc = spawn(command, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.on('error', (err) => {
      logger.warn({ server: server.name, err: err.message }, 'MCP server spawn failed');
      resolve([]);
    });

    sendJsonRpc(proc, 'tools/list', {})
      .then((result) => {
        const tools =
          (
            result as {
              tools?: Array<{ name?: string; description?: string; inputSchema?: unknown }>;
            }
          )?.tools ?? [];
        const mapped = tools.map(mapMcpToolToOurFormat);
        logger.info({ server: server.name, count: mapped.length }, 'MCP tools loaded');
        void proc.kill('SIGTERM');
        resolve(mapped);
      })
      .catch((err) => {
        logger.warn({ server: server.name, err: err.message }, 'MCP tools/list failed');
        void proc.kill('SIGTERM');
        resolve([]);
      });
  });
}

/** Map tool name -> server config for MCP tool execution */
const toolToServer = new Map<string, McpServerConfig>();

/**
 * Load all enabled MCP servers from settings and register their tools.
 */
export async function loadAllMcpTools(servers: McpServerConfig[]): Promise<void> {
  clearMcpTools();
  toolToServer.clear();

  const enabled = (servers ?? []).filter((s) => s.enabled !== false && s.command);
  if (enabled.length === 0) return;

  const allTools: McpTool[] = [];
  for (const server of enabled) {
    const tools = await loadMcpServerTools(server);
    for (const t of tools) {
      toolToServer.set(t.name, server);
    }
    allTools.push(...tools);
  }

  if (allTools.length > 0) {
    registerMcpTools(allTools);
    logger.info(
      { count: allTools.length, servers: enabled.map((s) => s.name) },
      'MCP tools registered'
    );
  }
}

/**
 * Execute an MCP tool by spawning the server and calling tools/call.
 */
export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; output?: string; error?: string }> {
  const server = toolToServer.get(toolName);
  if (!server?.command) {
    return { success: false, error: `MCP tool ${toolName} not found or server not configured` };
  }

  const procArgs = server.args ?? [];
  const env = { ...process.env, ...server.env };

  return new Promise((resolve) => {
    const command = server.command;
    if (!command) {
      resolve({ success: false, error: `MCP server ${toolName} has no command` });
      return;
    }
    const proc = spawn(command, procArgs, { env, stdio: ['pipe', 'pipe', 'pipe'] });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    sendJsonRpc(proc, 'tools/call', { name: toolName, arguments: args } as Record<string, unknown>)
      .then((result) => {
        const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content;
        const text = content?.find((c) => c?.type === 'text')?.text ?? JSON.stringify(result);
        void proc.kill('SIGTERM');
        resolve({ success: true, output: text });
      })
      .catch((err) => {
        void proc.kill('SIGTERM');
        resolve({ success: false, error: (err as Error).message });
      });
  });
}

/** Check if a tool is an MCP tool */
export function isMcpTool(toolName: string): boolean {
  return toolToServer.has(toolName);
}

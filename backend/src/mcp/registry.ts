/**
 * MCP tool registry – extension point for tools from MCP servers.
 * Agents can call tools registered here when an MCP client is configured.
 * To add tools: call registerMcpTools() with tool definitions from an MCP server.
 */

import type Anthropic from '@anthropic-ai/sdk';

const mcpTools: Anthropic.Tool[] = [];

/**
 * Register tools from an MCP server. Used when connecting to cursor-ide-browser, DB MCP, etc.
 */
export function registerMcpTools(tools: Anthropic.Tool[]): void {
  mcpTools.push(...tools);
}

/**
 * Clear all MCP tools (e.g. on disconnect).
 */
export function clearMcpTools(): void {
  mcpTools.length = 0;
}

/**
 * Return currently registered MCP tools for inclusion in the agent tool list.
 */
export function getMcpTools(): Anthropic.Tool[] {
  return [...mcpTools];
}

/**
 * MCP tool registry – extension point for tools from MCP servers.
 * Agents can call tools registered here when an MCP client is configured.
 * To add tools: call registerMcpTools() with tool definitions from an MCP server.
 */

/** Generic tool definition compatible with LLM gateway */
export interface McpTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

const mcpTools: McpTool[] = [];

/**
 * Register tools from an MCP server. Used when connecting to cursor-ide-browser, DB MCP, etc.
 */
export function registerMcpTools(tools: McpTool[]): void {
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
export function getMcpTools(): McpTool[] {
  return [...mcpTools];
}

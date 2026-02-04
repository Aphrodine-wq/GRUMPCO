/**
 * MCP Client Unit Tests
 * Tests MCP server connection, tool loading, and tool execution functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import type { McpServerConfig } from '../../src/types/settings.js';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock crypto
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234'),
}));

// Mock registry
vi.mock('../../src/mcp/registry.js', () => ({
  registerMcpTools: vi.fn(),
  clearMcpTools: vi.fn(),
}));

// Mock logger - note: client.ts imports from '../middleware/logger.js'
vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MCP Client', () => {
  let spawn: Mock;
  let registerMcpTools: Mock;
  let clearMcpTools: Mock;
  let mockProc: {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: Mock };
    kill: Mock;
    on: Mock;
    once: Mock;
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    const childProcess = await import('child_process');
    const registry = await import('../../src/mcp/registry.js');

    spawn = childProcess.spawn as Mock;
    registerMcpTools = registry.registerMcpTools as Mock;
    clearMcpTools = registry.clearMcpTools as Mock;

    // Create mock process
    mockProc = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: { write: vi.fn((data, cb) => cb && cb()) },
      kill: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
    };

    spawn.mockReturnValue(mockProc);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loadMcpServerTools', () => {
    it('should return empty array when server has no command', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        enabled: true,
        // no command
      };

      const tools = await loadMcpServerTools(server);

      expect(tools).toEqual([]);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should spawn process with correct arguments', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'node',
        args: ['mcp-server.js', '--port', '3000'],
        env: { MCP_DEBUG: 'true' },
        enabled: true,
      };

      // Don't await yet - need to simulate response
      const toolsPromise = loadMcpServerTools(server);

      // Simulate JSON-RPC response
      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-uuid-1234',
        result: { tools: [] },
      }) + '\n';

      // Emit response after spawn
      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.emit('data', response);

      const tools = await toolsPromise;

      expect(spawn).toHaveBeenCalledWith('node', ['mcp-server.js', '--port', '3000'], {
        env: expect.objectContaining({ MCP_DEBUG: 'true' }),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(tools).toEqual([]);
    });

    it('should parse tools from server response', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'test-mcp',
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);

      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-uuid-1234',
        result: {
          tools: [
            {
              name: 'database_query',
              description: 'Query the database',
              inputSchema: {
                properties: { query: { type: 'string' } },
                required: ['query'],
              },
            },
            {
              name: 'file_read',
              description: 'Read a file',
              inputSchema: {
                properties: { path: { type: 'string' } },
                required: ['path'],
              },
            },
          ],
        },
      }) + '\n';

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.emit('data', response);

      const tools = await toolsPromise;

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('database_query');
      expect(tools[0].description).toBe('Query the database');
      expect(tools[0].input_schema.type).toBe('object');
      expect(tools[0].input_schema.properties).toHaveProperty('query');
      expect(tools[1].name).toBe('file_read');
    });

    it('should handle missing tool properties gracefully', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'test-mcp',
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);

      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-uuid-1234',
        result: {
          tools: [
            { /* no name or description */ },
            { name: 'partial_tool' /* no description or schema */ },
          ],
        },
      }) + '\n';

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.emit('data', response);

      const tools = await toolsPromise;

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('unknown');
      expect(tools[0].description).toBe('');
      expect(tools[1].name).toBe('partial_tool');
      expect(tools[1].description).toBe('');
    });

    it('should return empty array on spawn error', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      // Override mock to call error handler
      mockProc.on.mockImplementation((event: string, handler: (err: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('spawn failed')), 0);
        }
        return mockProc;
      });

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: '/nonexistent/command',
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);
      await vi.advanceTimersByTimeAsync(100);

      const tools = await toolsPromise;
      expect(tools).toEqual([]);
    });

    it('should return empty array on JSON-RPC error response', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'test-mcp',
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);

      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-uuid-1234',
        error: { code: -32600, message: 'Invalid request' },
      }) + '\n';

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.emit('data', response);

      const tools = await toolsPromise;
      expect(tools).toEqual([]);
    });

    it('should handle timeout and return empty array', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'test-mcp',
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);

      // Advance past the 10 second timeout
      await vi.advanceTimersByTimeAsync(11000);

      const tools = await toolsPromise;
      expect(tools).toEqual([]);
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle chunked response data', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'test-mcp',
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);

      const fullResponse = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-uuid-1234',
        result: { tools: [{ name: 'chunked_tool', description: 'Test' }] },
      });

      // Send in chunks
      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.emit('data', fullResponse.substring(0, 20));
      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.emit('data', fullResponse.substring(20) + '\n');

      const tools = await toolsPromise;
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('chunked_tool');
    });

    it('should handle stderr output', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');
      const logger = (await import('../../src/middleware/logger.js')).default;

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'test-mcp',
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stderr.emit('data', 'Warning: something happened');

      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-uuid-1234',
        result: { tools: [] },
      }) + '\n';
      mockProc.stdout.emit('data', response);

      await toolsPromise;

      expect(logger.debug).toHaveBeenCalled();
    });

    it('should use default empty args when not provided', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'test-mcp',
        // no args
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);

      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-uuid-1234',
        result: { tools: [] },
      }) + '\n';

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.emit('data', response);

      await toolsPromise;

      expect(spawn).toHaveBeenCalledWith('test-mcp', [], expect.any(Object));
    });

    it('should kill process after receiving response', async () => {
      const { loadMcpServerTools } = await import('../../src/mcp/client.js');

      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'test-mcp',
        enabled: true,
      };

      const toolsPromise = loadMcpServerTools(server);

      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-uuid-1234',
        result: { tools: [] },
      }) + '\n';

      await vi.advanceTimersByTimeAsync(10);
      mockProc.stdout.emit('data', response);

      await toolsPromise;

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('loadAllMcpTools', () => {
    it('should clear existing tools before loading', async () => {
      const { loadAllMcpTools } = await import('../../src/mcp/client.js');

      await loadAllMcpTools([]);

      expect(clearMcpTools).toHaveBeenCalled();
    });

    it('should skip disabled servers', async () => {
      const { loadAllMcpTools } = await import('../../src/mcp/client.js');

      const servers: McpServerConfig[] = [
        { id: '1', name: 'Disabled', command: 'cmd1', enabled: false },
        { id: '2', name: 'No Command', enabled: true },
      ];

      await loadAllMcpTools(servers);

      expect(spawn).not.toHaveBeenCalled();
      expect(registerMcpTools).not.toHaveBeenCalled();
    });

    it('should load tools from multiple enabled servers', async () => {
      const { loadAllMcpTools } = await import('../../src/mcp/client.js');

      const servers: McpServerConfig[] = [
        { id: '1', name: 'Server1', command: 'cmd1', enabled: true },
        { id: '2', name: 'Server2', command: 'cmd2', enabled: true },
      ];

      // Queue up responses for both servers
      let callCount = 0;
      spawn.mockImplementation(() => {
        callCount++;
        const proc = {
          stdout: new EventEmitter(),
          stderr: new EventEmitter(),
          stdin: { write: vi.fn((data, cb) => cb && cb()) },
          kill: vi.fn(),
          on: vi.fn(),
          once: vi.fn(),
        };

        // Emit response after a delay
        setTimeout(() => {
          const response = JSON.stringify({
            jsonrpc: '2.0',
            id: 'test-uuid-1234',
            result: { tools: [{ name: `tool_${callCount}`, description: `Tool ${callCount}` }] },
          }) + '\n';
          proc.stdout.emit('data', response);
        }, 50);

        return proc;
      });

      const loadPromise = loadAllMcpTools(servers);
      await vi.advanceTimersByTimeAsync(100);
      await loadPromise;

      expect(spawn).toHaveBeenCalledTimes(2);
      expect(registerMcpTools).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'tool_1' }),
        expect.objectContaining({ name: 'tool_2' }),
      ]));
    });

    it('should handle empty server list', async () => {
      const { loadAllMcpTools } = await import('../../src/mcp/client.js');

      await loadAllMcpTools([]);

      expect(clearMcpTools).toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
      expect(registerMcpTools).not.toHaveBeenCalled();
    });

    it('should handle null/undefined server list', async () => {
      const { loadAllMcpTools } = await import('../../src/mcp/client.js');

      await loadAllMcpTools(null as unknown as McpServerConfig[]);

      expect(clearMcpTools).toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should not register when no tools are loaded', async () => {
      const { loadAllMcpTools } = await import('../../src/mcp/client.js');

      const servers: McpServerConfig[] = [
        { id: '1', name: 'Server1', command: 'cmd1', enabled: true },
      ];

      spawn.mockImplementation(() => {
        const proc = {
          stdout: new EventEmitter(),
          stderr: new EventEmitter(),
          stdin: { write: vi.fn((data, cb) => cb && cb()) },
          kill: vi.fn(),
          on: vi.fn(),
          once: vi.fn(),
        };

        setTimeout(() => {
          const response = JSON.stringify({
            jsonrpc: '2.0',
            id: 'test-uuid-1234',
            result: { tools: [] },
          }) + '\n';
          proc.stdout.emit('data', response);
        }, 50);

        return proc;
      });

      const loadPromise = loadAllMcpTools(servers);
      await vi.advanceTimersByTimeAsync(100);
      await loadPromise;

      expect(registerMcpTools).not.toHaveBeenCalled();
    });
  });

  describe('executeMcpTool', () => {
    it('should return error for unknown tool', async () => {
      const { executeMcpTool, loadAllMcpTools } = await import('../../src/mcp/client.js');

      // Clear any registered tools
      await loadAllMcpTools([]);

      const result = await executeMcpTool('unknown_tool', { arg: 'value' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should execute a registered tool successfully', async () => {
      vi.resetModules();
      vi.clearAllMocks();

      const childProcess = await import('child_process');
      const registry = await import('../../src/mcp/registry.js');
      spawn = childProcess.spawn as Mock;
      registerMcpTools = registry.registerMcpTools as Mock;
      clearMcpTools = registry.clearMcpTools as Mock;

      const servers: McpServerConfig[] = [
        { id: '1', name: 'TestServer', command: 'test-cmd', enabled: true },
      ];

      // Create a new mock for each spawn
      let spawnCount = 0;
      spawn.mockImplementation(() => {
        spawnCount++;
        const proc = {
          stdout: new EventEmitter(),
          stderr: new EventEmitter(),
          stdin: { write: vi.fn((data, cb) => cb && cb()) },
          kill: vi.fn(),
          on: vi.fn(),
          once: vi.fn(),
        };

        setTimeout(() => {
          if (spawnCount === 1) {
            // First spawn: tools/list response
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: 'test-uuid-1234',
              result: { tools: [{ name: 'my_tool', description: 'My tool' }] },
            }) + '\n';
            proc.stdout.emit('data', response);
          } else {
            // Second spawn: tools/call response
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: 'test-uuid-1234',
              result: { content: [{ type: 'text', text: 'Tool executed successfully' }] },
            }) + '\n';
            proc.stdout.emit('data', response);
          }
        }, 50);

        return proc;
      });

      const { loadAllMcpTools, executeMcpTool } = await import('../../src/mcp/client.js');

      const loadPromise = loadAllMcpTools(servers);
      await vi.advanceTimersByTimeAsync(100);
      await loadPromise;

      const execPromise = executeMcpTool('my_tool', { input: 'test' });
      await vi.advanceTimersByTimeAsync(100);
      const result = await execPromise;

      expect(result.success).toBe(true);
      expect(result.output).toBe('Tool executed successfully');
    });

    it('should handle tool execution error', async () => {
      vi.resetModules();
      vi.clearAllMocks();

      const childProcess = await import('child_process');
      const registry = await import('../../src/mcp/registry.js');
      spawn = childProcess.spawn as Mock;
      registerMcpTools = registry.registerMcpTools as Mock;
      clearMcpTools = registry.clearMcpTools as Mock;

      const servers: McpServerConfig[] = [
        { id: '1', name: 'TestServer', command: 'test-cmd', enabled: true },
      ];

      let spawnCount = 0;
      spawn.mockImplementation(() => {
        spawnCount++;
        const proc = {
          stdout: new EventEmitter(),
          stderr: new EventEmitter(),
          stdin: { write: vi.fn((data, cb) => cb && cb()) },
          kill: vi.fn(),
          on: vi.fn(),
          once: vi.fn(),
        };

        setTimeout(() => {
          if (spawnCount === 1) {
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: 'test-uuid-1234',
              result: { tools: [{ name: 'error_tool', description: 'Error tool' }] },
            }) + '\n';
            proc.stdout.emit('data', response);
          } else {
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: 'test-uuid-1234',
              error: { code: -32000, message: 'Tool execution failed' },
            }) + '\n';
            proc.stdout.emit('data', response);
          }
        }, 50);

        return proc;
      });

      const { loadAllMcpTools, executeMcpTool } = await import('../../src/mcp/client.js');

      const loadPromise = loadAllMcpTools(servers);
      await vi.advanceTimersByTimeAsync(100);
      await loadPromise;

      const execPromise = executeMcpTool('error_tool', {});
      await vi.advanceTimersByTimeAsync(100);
      const result = await execPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool execution failed');
    });

    it('should return JSON stringified result when no text content', async () => {
      vi.resetModules();
      vi.clearAllMocks();

      const childProcess = await import('child_process');
      const registry = await import('../../src/mcp/registry.js');
      spawn = childProcess.spawn as Mock;
      registerMcpTools = registry.registerMcpTools as Mock;
      clearMcpTools = registry.clearMcpTools as Mock;

      const servers: McpServerConfig[] = [
        { id: '1', name: 'TestServer', command: 'test-cmd', enabled: true },
      ];

      let spawnCount = 0;
      spawn.mockImplementation(() => {
        spawnCount++;
        const proc = {
          stdout: new EventEmitter(),
          stderr: new EventEmitter(),
          stdin: { write: vi.fn((data, cb) => cb && cb()) },
          kill: vi.fn(),
          on: vi.fn(),
          once: vi.fn(),
        };

        setTimeout(() => {
          if (spawnCount === 1) {
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: 'test-uuid-1234',
              result: { tools: [{ name: 'json_tool', description: 'JSON tool' }] },
            }) + '\n';
            proc.stdout.emit('data', response);
          } else {
            // Return result without text content
            const response = JSON.stringify({
              jsonrpc: '2.0',
              id: 'test-uuid-1234',
              result: { data: { key: 'value' } },
            }) + '\n';
            proc.stdout.emit('data', response);
          }
        }, 50);

        return proc;
      });

      const { loadAllMcpTools, executeMcpTool } = await import('../../src/mcp/client.js');

      const loadPromise = loadAllMcpTools(servers);
      await vi.advanceTimersByTimeAsync(100);
      await loadPromise;

      const execPromise = executeMcpTool('json_tool', {});
      await vi.advanceTimersByTimeAsync(100);
      const result = await execPromise;

      expect(result.success).toBe(true);
      expect(result.output).toContain('data');
      expect(result.output).toContain('value');
    });
  });

  describe('isMcpTool', () => {
    it('should return false for unknown tools', async () => {
      const { isMcpTool, loadAllMcpTools } = await import('../../src/mcp/client.js');

      await loadAllMcpTools([]);

      expect(isMcpTool('unknown_tool')).toBe(false);
    });

    it('should return true for registered MCP tools', async () => {
      vi.resetModules();
      vi.clearAllMocks();

      const childProcess = await import('child_process');
      const registry = await import('../../src/mcp/registry.js');
      spawn = childProcess.spawn as Mock;
      registerMcpTools = registry.registerMcpTools as Mock;
      clearMcpTools = registry.clearMcpTools as Mock;

      spawn.mockImplementation(() => {
        const proc = {
          stdout: new EventEmitter(),
          stderr: new EventEmitter(),
          stdin: { write: vi.fn((data, cb) => cb && cb()) },
          kill: vi.fn(),
          on: vi.fn(),
          once: vi.fn(),
        };

        setTimeout(() => {
          const response = JSON.stringify({
            jsonrpc: '2.0',
            id: 'test-uuid-1234',
            result: { tools: [{ name: 'registered_tool', description: 'Registered' }] },
          }) + '\n';
          proc.stdout.emit('data', response);
        }, 50);

        return proc;
      });

      const { loadAllMcpTools, isMcpTool } = await import('../../src/mcp/client.js');

      const servers: McpServerConfig[] = [
        { id: '1', name: 'TestServer', command: 'test-cmd', enabled: true },
      ];

      const loadPromise = loadAllMcpTools(servers);
      await vi.advanceTimersByTimeAsync(100);
      await loadPromise;

      expect(isMcpTool('registered_tool')).toBe(true);
      expect(isMcpTool('nonexistent_tool')).toBe(false);
    });
  });
});

# G-Rump MCP (Model Context Protocol) System — Knowledge Reference

> **Last updated:** 2026-02-08
> **Source files:** `backend/src/mcp/client.ts`, `backend/src/mcp/grump-server.ts`, `backend/src/mcp/registry.ts`, `backend/src/types/settings.ts`, `docs/CURSOR_GRUMP_API.md`, `docs/INTEGRATIONS.md`

---

## 1. Overview

G-Rump implements MCP in **two directions**:

| Direction | Component | Purpose |
|-----------|-----------|---------|
| **Consumer** | `mcp/client.ts` + `mcp/registry.ts` | Connect to external MCP servers, import their tools, and make them available to G-Agent |
| **Provider** | `mcp/grump-server.ts` | Expose G-Rump capabilities (SHIP, architecture, codegen, intent, G-Agent) as MCP tools for Cursor, Claude Code, or any MCP client |

---

## 2. Architecture

```
backend/src/mcp/
├── client.ts        # MCP Client — spawns MCP servers (stdio), lists tools, executes tools
├── grump-server.ts  # MCP Server — exposes G-Rump as MCP tools (stdio JSON-RPC)
└── registry.ts      # MCP Tool Registry — stores imported tool definitions
```

### Data Flow (Consumer)

```
Settings (McpServerConfig[])
    → loadAllMcpTools()
        → for each server: loadMcpServerTools()
            → spawn process (stdio)
            → sendJsonRpc("tools/list")
            → map to McpTool format
            → registerMcpTools()
        → toolToServer map (for later execution)

Agent needs MCP tool →
    → executeMcpTool(toolName, args)
        → lookup server config from toolToServer
        → spawn process
        → sendJsonRpc("tools/call", { name, arguments })
        → return result
```

### Data Flow (Provider)

```
External client (Cursor, Claude Code) →
    → stdin JSON-RPC
        → "tools/list" → handleToolsList() (returns tool definitions)
        → "tools/call" → handleToolCall(name, args) → apiFetch to G-Rump backend
    → stdout JSON-RPC response
```

---

## 3. MCP Client (`backend/src/mcp/client.ts`)

### Core Functions

| Function | Description |
|----------|-------------|
| `loadMcpServerTools(server)` | Spawns an MCP server process via stdio, sends `tools/list` JSON-RPC, maps results to `McpTool[]` |
| `loadAllMcpTools(servers)` | Clears existing tools, loads all enabled MCP servers, registers tools, builds `toolToServer` map |
| `executeMcpTool(toolName, args)` | Spawns the corresponding MCP server, sends `tools/call`, returns `{ success, output?, error? }` |
| `isMcpTool(toolName)` | Checks if a tool name belongs to an MCP server |

### Communication Protocol

- **Transport:** `stdio` (stdin/stdout pipes)
- **Protocol:** JSON-RPC 2.0 (one message per line, `\n`-delimited)
- **Timeout:** 10 seconds for `tools/list`
- **Process lifecycle:** Each `tools/list` or `tools/call` spawns a new process and kills it (`SIGTERM`) after response

### Internal Helper

```typescript
function sendJsonRpc(
  proc: ChildProcess,
  method: string,
  params?: Record<string, unknown>
): Promise<unknown>
```
- Generates a `randomUUID()` as RPC ID
- Writes JSON-RPC request + `\n` to stdin
- Reads stdout line-by-line, parses JSON, resolves when `res.id === id`
- Logs stderr at debug level
- 10s timeout → reject + SIGTERM

---

## 4. MCP Registry (`backend/src/mcp/registry.ts`)

Simple in-memory registry for imported MCP tools.

### Types

```typescript
interface McpTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}
```

### Functions

| Function | Description |
|----------|-------------|
| `registerMcpTools(tools)` | Appends tools to the registry array |
| `clearMcpTools()` | Clears all tools (called on reload) |
| `getMcpTools()` | Returns a copy of all registered MCP tools |

### Integration with Agent

When building the agent's tool list, `getMcpTools()` is called to merge MCP tools alongside built-in tools and skill tools.

---

## 5. Settings Configuration (`backend/src/types/settings.ts`)

```typescript
interface McpServerConfig {
  id: string;                     // Unique server ID
  name: string;                   // Display name
  command?: string;               // Executable (e.g. "node", "npx")
  args?: string[];                // Command arguments
  url?: string;                   // For future HTTP transport
  env?: Record<string, string>;   // Environment variables for the process
  enabled?: boolean;              // Enable/disable (default: true)
}

interface McpSettings {
  servers?: McpServerConfig[];    // List of MCP servers to connect to
  requestTimeoutSeconds?: number; // Timeout override
  maxRetries?: number;            // Retry count
}

interface Settings {
  mcp?: McpSettings;              // MCP configuration block
  // ... other settings
}
```

### Example Configuration

```json
{
  "mcp": {
    "servers": [
      {
        "id": "supabase",
        "name": "Supabase MCP",
        "command": "npx",
        "args": ["-y", "@supabase/mcp-server"],
        "env": { "SUPABASE_ACCESS_TOKEN": "..." },
        "enabled": true
      },
      {
        "id": "custom-db",
        "name": "Database MCP",
        "command": "node",
        "args": ["/path/to/mcp-server.js"],
        "env": { "DB_URL": "postgresql://..." },
        "enabled": true
      }
    ],
    "requestTimeoutSeconds": 15,
    "maxRetries": 2
  }
}
```

---

## 6. G-Rump MCP Server (`backend/src/mcp/grump-server.ts`)

Exposes G-Rump as an MCP server that external tools (Cursor, Claude Code) can connect to via stdio.

### Running the Server

```bash
# From backend directory
export GRUMP_API_URL=http://localhost:3000
npm run mcp-server
# Or directly:
node dist/mcp/grump-server.js
```

### Exposed Tools

| Tool | Description | Input Args |
|------|-------------|------------|
| `grump_ship_start` | Start a SHIP session (design → spec → plan → code) | `projectDescription` |
| `grump_ship_execute` | Run SHIP workflow for a session | `sessionId` |
| `grump_ship_status` | Get SHIP session status and phase results | `sessionId` |
| `grump_architecture_generate` | Generate architecture (Mermaid) from description | `projectDescription` |
| `grump_intent_parse` | Parse natural language intent into structured features | `raw` |
| `grump_codegen_download` | Get download URL for generated code ZIP | `sessionId` |
| `grump_agent_start` | Start a G-Agent goal | `description`, `priority?` (low/normal/high/urgent) |
| `grump_agent_status` | Get G-Agent goal status and progress | `goalId` |
| `grump_agent_result` | Get G-Agent goal result and artifacts | `goalId` |

### How It Works

1. Reads JSON-RPC requests from **stdin** (one per line)
2. Handles `tools/list` → returns tool definitions
3. Handles `tools/call` → calls corresponding G-Rump backend API endpoint via HTTP (`apiFetch`)
4. Writes JSON-RPC response to **stdout**

### API Proxying

Each tool maps to a backend REST endpoint:

| Tool | Backend Endpoint | Method |
|------|-----------------|--------|
| `grump_ship_start` | `/api/ship/start` | POST |
| `grump_ship_execute` | `/api/ship/{sessionId}/execute` | POST |
| `grump_ship_status` | `/api/ship/{sessionId}` | GET |
| `grump_architecture_generate` | `/api/architecture/generate` | POST |
| `grump_intent_parse` | `/api/intent/parse` | POST |
| `grump_codegen_download` | `/api/codegen/download/{sessionId}` | GET (returns URL) |
| `grump_agent_start` | `/api/gagent/goals` | POST |
| `grump_agent_status` | `/api/gagent/goals/{goalId}` | GET |
| `grump_agent_result` | `/api/gagent/goals/{goalId}` | GET |

### Configuration for Cursor / Claude Code

Add an MCP server entry with:
- **Transport:** stdio
- **Command:** `node`
- **Args:** `path/to/backend/dist/mcp/grump-server.js`
- **Env:** `GRUMP_API_URL=http://localhost:3000`

---

## 7. Feature Flags & Rate Limiting

MCP-related entries in the backend:
- `backend/src/services/platform/featureFlagsService.ts` — may gate MCP features by tier
- `backend/src/middleware/rateLimiter.ts` — MCP tool calls go through the same rate limiting as other API calls
- `backend/src/routes/settings.ts` — MCP server configuration is saved/loaded with user settings

---

## 8. Testing (`backend/tests/mcp/`)

| Test File | Coverage |
|-----------|----------|
| `client.test.ts` (24KB) | Tests for `loadMcpServerTools`, `loadAllMcpTools`, `executeMcpTool`, `isMcpTool`, JSON-RPC communication, error handling, timeouts |
| `registry.test.ts` (23KB) | Tests for `registerMcpTools`, `clearMcpTools`, `getMcpTools`, tool format mapping |

---

## 9. Integration Points

### With Skills System
- MCP tools and skill tools are both registered in the agent's tool list but through **separate registries**
- MCP tools use `mcp/registry.ts` (`getMcpTools()`)
- Skill tools use `skills/index.ts` (`skillRegistry.getAllTools()`)
- Both are merged in `claudeServiceWithTools.ts` when building the tool list for the LLM

### With Tool Execution
- When the agent calls a tool, the execution service checks:
  1. Is it a built-in tool? → execute directly
  2. Is it an MCP tool? (`isMcpTool()`) → `executeMcpTool()`
  3. Is it a skill tool? (`skillRegistry.getToolHandler()`) → execute via skill handler
- `backend/src/services/ai-providers/tools/toolFiltering.ts` — filters available tools based on context

### Cursor Skill Integration
- `docs/cursor-grump-skill.md` — A Cursor skill/rule that wraps G-Rump API calls
- `docs/CURSOR_GRUMP_API.md` — Full API reference for using G-Rump from Cursor
- Can be added to `.cursor/rules` for agent-driven G-Rump invocation

---

## 10. Cross-References

- **Skills System**: See `docs/knowledge/SKILLS_SYSTEM.md` — complementary capability extension mechanism
- **G-Agent**: Uses MCP tools alongside built-in and skill tools for autonomous operation
- **CAPABILITIES.md**: Documents MCP server as a key G-Rump differentiator
- **INTEGRATIONS.md**: Lists MCP under integrations, references `MCP_SETUP.md` (not yet created)
- **Tool Definitions**: `backend/src/tools/definitions.ts` — where all tool types converge
- **LLM Gateway**: `backend/src/services/ai-providers/llmGateway.ts` — processes tool calls from LLM responses

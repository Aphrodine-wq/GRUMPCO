# G-Rump Knowledge Base

Distilled, comprehensive reference documentation for key subsystems. Each document consolidates scattered information from source code, docs, and types into a single authoritative reference.

## Documents

| Document | Description | Key Source Files |
|----------|-------------|-----------------|
| [SKILLS_SYSTEM.md](./SKILLS_SYSTEM.md) | Skills framework: registry, types, lifecycle, built-in skills catalog, user skill creation, Moltbot integration | `backend/src/skills/`, `backend/src/tools/skill/`, `integrations/moltbot-skill/` |
| [MCP_SYSTEM.md](./MCP_SYSTEM.md) | Model Context Protocol: MCP client (consume external tools), MCP server (expose G-Rump as tools), registry, Cursor/Claude Code integration | `backend/src/mcp/`, `docs/CURSOR_GRUMP_API.md` |

## When to Use

- **Starting work on Skills or MCP** — read the relevant document first
- **Debugging tool execution** — see integration points in both documents
- **Adding new skills or MCP servers** — follow the patterns documented here
- **Understanding how agent tools are assembled** — both documents explain how their tools merge into the agent's tool list

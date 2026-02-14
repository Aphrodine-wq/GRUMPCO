# G-Rump Skills System — Knowledge Reference

> **Last updated:** 2026-02-08
> **Source files:** `backend/src/skills/`, `backend/src/tools/skill/`, `backend/src/routes/skills.ts`, `backend/src/services/workspace/skillStoreService.ts`, `backend/src/services/workspace/userSkillsService.ts`, `backend/src/services/ai-providers/tools/skillExecutors.ts`, `integrations/moltbot-skill/`

---

## 1. Overview

The Skills system is a **modular, discoverable capability framework** for G-Rump. Skills extend the platform with tools (LLM function calling), HTTP routes, system prompts, and streaming execution. They are auto-discovered on startup from the `backend/src/skills/` directory and can also be **user-created at runtime** by G-Agent (stored in `backend/data/user-skills/`).

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Skill** | Self-contained module with a manifest, optional tools, prompts, routes, and lifecycle hooks |
| **SkillRegistry** | Singleton that discovers, loads, initializes, and manages all skills |
| **Skill Store** | Install/uninstall/enable/disable layer backed by SQLite user preferences |
| **User Skills** | Skills created by G-Agent at runtime via `skill_create` tool |
| **Skill Tools** | LLM tool definitions (`skill_create`, `skill_edit`, `skill_run_test`, `skill_list`) |
| **Moltbot Skill** | External integration in `integrations/moltbot-skill/` for messaging bots |

---

## 2. Architecture

```
backend/src/skills/
├── index.ts              # SkillRegistry (singleton) — discovery, loading, execution
├── types.ts              # All type definitions (Skill, SkillManifest, SkillContext, etc.)
├── userToolsRegistry.ts  # User-defined tools registry
├── base/                 # Base classes (SkillContext factory)
│   └── SkillContext.ts
├── code-review/          # Built-in skill
├── frontend-designer/    # Built-in skill
├── git-operations/       # Built-in skill
├── refactoring/          # Built-in skill
├── lint/                 # Built-in skill
├── accessibility-audit/  # Built-in skill
├── api-builder/          # Built-in skill
├── api-tester/           # Built-in skill
├── database-helper/      # Built-in skill
├── dependency-analyzer/  # Built-in skill
├── devops/               # Built-in skill
├── doc-writer/           # Built-in skill
├── documentation/        # Built-in skill
├── env-manager/          # Built-in skill
├── migration-generator/  # Built-in skill
├── perf-profiler/        # Built-in skill
├── performance/          # Built-in skill
├── security-audit/       # Built-in skill
└── testing/              # Built-in skill
```

Each built-in skill directory contains at minimum:
- `manifest.json` or `index.ts` — skill definition with manifest, tools, prompts
- Some complex skills (code-review, frontend-designer, git-operations, refactoring, lint) also have `types.ts` and additional modules

---

## 3. Core Types (`backend/src/skills/types.ts`)

### SkillManifest

```typescript
interface SkillManifest {
  id: string;               // Unique identifier
  name: string;             // Human-readable name
  version: string;          // Semver
  description: string;
  author?: string;
  category: SkillCategory;  // "code" | "git" | "docs" | "test" | "deploy" | "analyze" | "security" | "life" | "custom"
  capabilities: SkillCapabilities;
  dependencies?: string[];  // Other skill IDs
  permissions: SkillPermission[];  // "file_read" | "file_write" | "file_delete" | "bash_execute" | "network" | "git" | "env_read"
  triggers?: SkillTriggers;
  icon?: string;            // Emoji or icon name
  tags?: string[];
}
```

### SkillCapabilities

```typescript
interface SkillCapabilities {
  providesTools: boolean;       // LLM tools
  providesRoutes: boolean;      // HTTP routes
  providesPrompts: boolean;     // System prompts
  requiresWorkspace: boolean;   // Needs workspace path
  supportsStreaming: boolean;   // Streaming responses
  supportsBackground?: boolean; // Background execution
}
```

### SkillTriggers

```typescript
interface SkillTriggers {
  keywords?: string[];       // e.g. ["review", "refactor"]
  patterns?: string[];       // Regex patterns
  fileExtensions?: string[]; // e.g. [".ts", ".js"]
  commands?: string[];       // e.g. ["/review"]
}
```

### Skill Interface

```typescript
interface Skill {
  manifest: SkillManifest;
  tools?: SkillTools;       // { definitions: ToolDefinition[], handlers: Record<string, SkillToolHandler> }
  prompts?: SkillPrompts;   // { system: string, examples?: [...], templates?: {...} }
  routes?: Router;          // Express Router

  // Lifecycle
  initialize?(context: Partial<SkillContext>): Promise<void>;
  activate?(context: SkillContext): Promise<void>;
  deactivate?(context: SkillContext): Promise<void>;
  cleanup?(): Promise<void>;

  // Execution
  execute?(input: SkillExecutionInput, context: SkillContext): AsyncGenerator<SkillEvent, SkillExecutionResult>;
  run?(input: SkillExecutionInput, context: SkillContext): Promise<SkillExecutionResult>;
  shouldHandle?(input: string, context: SkillContext): boolean | Promise<boolean>;
}
```

### SkillContext (Execution Context)

```typescript
interface SkillContext {
  sessionId: string;
  workspacePath?: string;
  config?: Record<string, unknown>;
  request: { id: string; timestamp: Date; source: "chat" | "api" | "command" | "skill_test" };
  services: {
    llm: LLMService;        // complete(), stream()
    fileSystem: FileSystemService;  // readFile, writeFile, exists, listDirectory, deleteFile, isWithinWorkspace
    git?: GitService;        // status, diff, commit, log, branch, branches
    logger: LoggerService;
  };
  emit: (event: SkillEvent) => void;
  isCancelled: () => boolean;
}
```

### SkillEvent (Emitted during execution)

| Event Type | Payload |
|-----------|---------|
| `started` | `skillId`, `timestamp` |
| `progress` | `percent`, `message?` |
| `thinking` | `content` |
| `tool_call` | `toolName`, `input` |
| `tool_result` | `toolName`, `result` |
| `output` | `content` |
| `file_change` | `path`, `action: "created" | "modified" | "deleted"` |
| `error` | `error`, `recoverable` |
| `completed` | `summary?`, `duration` |

---

## 4. SkillRegistry (`backend/src/skills/index.ts`)

The `SkillRegistry` class is exported as a **singleton** (`skillRegistry`).

### Key Methods

| Method | Description |
|--------|-------------|
| `discoverSkills(customDir?)` | Scans `backend/src/skills/` (and optional custom dir) for skill directories, loads each |
| `loadSkill(skillPath)` | Loads a single skill from a directory (reads manifest, imports module) |
| `initialize()` | Calls `initialize()` on all loaded skills |
| `getSkill(id)` | Get skill by ID |
| `getAllSkills()` | Get all active skills |
| `getSkillsByCategory(cat)` | Filter by category |
| `getSkillsByTrigger(input)` | Match skills by keyword, pattern, or command triggers |
| `getSkillsByFileExtension(ext)` | Match skills by file extension trigger |
| `getAllTools()` | Collect all `ToolDefinition[]` from all skills |
| `getToolHandler(toolName)` | Find the skill + handler for a specific tool |
| `mountRoutes(app)` | Mount all skill HTTP routes to Express app under `/api/skills/{skillId}/...` |
| `executeSkill(skillId, input, context)` | Execute a skill's `execute()` or `run()` method |
| `cleanup()` | Call `cleanup()` on all skills |
| `count()` | Number of registered skills |
| `hasSkill(id)` | Check registration |

### Startup Integration

The registry is initialized during backend startup in `backend/src/server/lifecycle.ts`:
```
skillRegistry.discoverSkills() → skillRegistry.initialize() → skillRegistry.mountRoutes(app)
```

Additional routes from skills are mounted at runtime, which is why `CAPABILITIES.md` notes: *"Additional routes may be mounted by the skills system at runtime (`skillRegistry.mountRoutes(app)`)."*

---

## 5. Skill Store (`backend/src/services/workspace/skillStoreService.ts`)

Provides install/uninstall/enable/disable management persisted via SQLite user preferences.

| Function | Description |
|----------|-------------|
| `listSkillStore(userId?)` | Returns all skills with `installed`, `enabled`, `isUser`, `requiresPro?`, `requiresDocker?` flags |
| `installSkill(skillId, userId?)` | Installs and enables a skill; persists to user preferences |
| `uninstallSkill(skillId, userId?)` | Removes from installed and enabled lists |
| `setSkillEnabled(skillId, enabled, userId?)` | Toggle enable/disable |

Data shape in user preferences:
```json
{
  "installedSkills": ["code-review", "git-ops"],
  "enabledSkills": ["code-review"]
}
```

---

## 6. User Skills (`backend/src/services/workspace/userSkillsService.ts`)

G-Agent can create/edit skills at runtime. These live in `backend/data/user-skills/`.

| Function | Description |
|----------|-------------|
| `createSkill(name, description, tools?, prompts?, userId?)` | Creates skill directory with `manifest.json`, `index.ts`, and optional `prompts/system.md` |
| `editSkill(skillId, updates, userId?)` | Updates manifest and/or code |
| `runSkillTest(skillId, input, workspaceRoot?, userId?)` | Executes the skill with sample input and returns output + duration |
| `listSkills()` | Returns all skills (built-in + user) with `isUser` flag |

### Sanitization

Skill IDs are sanitized: `name → lowercase, spaces → hyphens, non-alphanumeric removed`.

---

## 7. LLM Skill Tools (`backend/src/tools/skill/index.ts`)

These are the tools exposed to the AI agent for skill management:

| Tool | Description | Required Args |
|------|-------------|---------------|
| `skill_create` | Create a new user skill | `name`, `description` |
| `skill_edit` | Edit an existing skill | `skillId`, `updates` |
| `skill_run_test` | Run a skill test | `skillId` |
| `skill_list` | List all available skills | *(none)* |

### Execution Pipeline (`backend/src/services/ai-providers/tools/skillExecutors.ts`)

When the AI agent calls a skill tool:
1. `executeSkillTool(toolName, input, workspaceRoot)` is the entry point
2. Routes to `executeSkillCreate`, `executeSkillEdit`, `executeSkillRunTest`, or `executeSkillList`
3. Each calls the corresponding `userSkillsService` function
4. Returns `ToolExecutionResult { success, output, error? }`

The same file also handles session tools (`sessions_list`, `sessions_history`, `sessions_send`).

---

## 8. API Routes (`backend/src/routes/skills.ts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List all skills (id, name, version, description, category, icon, tags, capabilities) |
| GET | `/api/skills/:id` | Get skill details (manifest + tools list, hasRoutes, hasPrompts) |

---

## 9. Settings Integration (`backend/src/types/settings.ts`)

```typescript
interface SkillsSettings {
  enabledIds?: string[];   // Which skills are enabled for this user
}

interface Settings {
  skills?: SkillsSettings;    // Skills configuration
  // ... other settings
}
```

The `skills_self_edit` capability key allows G-Agent to create/edit skills autonomously.

---

## 10. Built-in Skills Catalog

| Skill | Category | Description |
|-------|----------|-------------|
| `code-review` | code | Code review and analysis |
| `frontend-designer` | code | Frontend design and component generation |
| `git-operations` | git | Git operations (commit, branch, diff, etc.) |
| `refactoring` | code | Code refactoring patterns |
| `lint` | code | Linting and code quality |
| `accessibility-audit` | analyze | Accessibility auditing |
| `api-builder` | code | API endpoint generation |
| `api-tester` | test | API testing |
| `database-helper` | code | Database operations and migrations |
| `dependency-analyzer` | analyze | Dependency analysis |
| `devops` | deploy | DevOps and infrastructure |
| `doc-writer` | docs | Documentation generation |
| `documentation` | docs | Documentation management |
| `env-manager` | deploy | Environment configuration |
| `migration-generator` | code | Database migration generation |
| `perf-profiler` | analyze | Performance profiling |
| `performance` | analyze | Performance analysis |
| `security-audit` | security | Security scanning |
| `testing` | test | Test generation and execution |

---

## 11. Moltbot Skill Integration (`integrations/moltbot-skill/`)

An external skill for [Moltbot](https://molt.bot) (Clawdbot) that lets messaging bots (Telegram, WhatsApp, Discord) invoke G-Rump.

### Configuration
- `GRUMP_API_URL` (default: `http://localhost:3000`)
- `GRUMP_API_KEY` (optional)

### Actions
- **SHIP**: Start → Execute → Poll status → Download ZIP
- **Chat**: `POST /api/chat/stream` with messages
- **Codegen**: Start → Status → Download
- **Intent**: `POST /api/intent/parse`
- **Architecture**: `POST /api/architecture/generate`

### Webhooks
- **Inbound**: `POST /api/webhooks/trigger` (auth via `X-Webhook-Secret`)
- **Outbound**: Events `ship.completed`, `ship.failed`, `codegen.ready`, `codegen.failed` sent to registered URLs

### Setup (moltbot.json)
```json
{
  "skills": {
    "grump": {
      "path": "/path/to/integrations/moltbot-skill",
      "env": {
        "GRUMP_API_URL": "http://localhost:3000",
        "GRUMP_API_KEY": ""
      }
    }
  }
}
```

---

## 12. Cross-References

- **MCP System**: See `docs/knowledge/MCP_SYSTEM.md` — MCP tools are separate from skill tools but both feed into the agent's available tool list
- **G-Agent**: Skills are a core G-Agent capability (`skills_self_edit` in `GAgentCapabilityKey`)
- **Feature Flags**: `backend/src/services/platform/featureFlagsService.ts` manages tier-gated capabilities
- **Tool Execution Service**: `backend/src/services/ai-providers/claudeServiceWithTools.ts` routes tool calls to skill executors
- **Types**: `backend/src/types/integrations.ts` has `SkillRecord`, `SkillLanguage`, `SkillStatus`, `CreateSkillInput`

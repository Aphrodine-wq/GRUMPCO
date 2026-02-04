# G-Rump CLI Reference

> **Version:** 2.1.0 | **Last Updated:** January 2026

The G-Rump CLI brings the power of AI-assisted development to your terminal. Whether you're automating workflows, integrating with CI/CD, or just prefer the command line, the CLI has you covered.

## Installation

```bash
# Install globally
npm install -g grump-cli

# Or run without installing
npx grump-cli
```

For local development:

```bash
cd packages/cli
npm install
npm run build
npm link
```

---

## Quick Start

Get up and running in three commands:

```bash
# 1. Point to your server
grump config set apiUrl http://localhost:3000

# 2. Authenticate (if required)
grump auth login

# 3. Ship your first project
grump ship "Build a todo app with user authentication"
```

---

## Core Commands

### `grump ship <description>`

Start a SHIP (Structured Human-In-the-Loop Process) workflow. This is the main command for generating complete projects from natural language.

```bash
# Basic usage
grump ship "Build a todo app with React and Node.js"

# Stream output in real-time
grump ship --stream "Create a REST API with authentication"

# Use a custom API endpoint
grump ship --url https://api.myserver.com "Build an e-commerce platform"
```

**Options:**
- `--stream, -s` — Stream output in real-time
- `--url, -u` — Custom API endpoint

---

### `grump codegen <session-id>`

Run code generation on an existing SHIP session.

```bash
# Generate code from a session
grump codegen abc123

# Specify output directory
grump codegen abc123 --output ./my-project

# Choose output format
grump codegen abc123 --format zip
```

**Options:**
- `--output, -o` — Output directory (default: current directory)
- `--format` — Output format: `zip`, `json`, or `files`

---

### `grump architecture <description>`

Generate system architecture diagrams and documentation.

```bash
# Generate architecture
grump architecture "Microservices e-commerce platform"

# Output as Mermaid
grump architecture "Serverless API gateway" --format mermaid

# Analyze existing workspace
grump architecture --workspace ./my-project
```

**Options:**
- `--format` — Output format: `mermaid`, `dot`, or `json`
- `--output, -o` — Output file path
- `--workspace, -w` — Workspace path to analyze

---

### `grump prd <description>`

Generate a Product Requirements Document.

```bash
# Generate PRD
grump prd "AI-powered code review tool"

# Save to file
grump prd "Mobile fitness tracker app" --output ./docs/prd.md

# Use a template
grump prd "SaaS dashboard" --template enterprise
```

**Options:**
- `--output, -o` — Output file path
- `--template` — PRD template to use

---

## Session Management

### `grump status <session-id>`

Check the status of a SHIP session.

```bash
# Check status once
grump status abc123

# Watch mode (continuously poll)
grump status abc123 --watch

# Output as JSON
grump status abc123 --json
```

**Options:**
- `--watch, -w` — Watch mode (continuously poll)
- `--json` — Output as JSON

---

### `grump list`

List all SHIP sessions.

```bash
# List active sessions
grump list

# Include completed sessions
grump list --all

# Output as JSON
grump list --format json

# Compact view
grump list --format compact
```

**Options:**
- `--all, -a` — Show all sessions (including completed)
- `--format` — Output format: `table`, `json`, or `compact`

---

## Utility Commands

### `grump chat <message>`

Quick chat with the AI assistant.

```bash
# Ask a question
grump chat "How do I implement OAuth2?"

# Interactive mode
grump chat --interactive

# Add context from a file
grump chat "Review this code" --context ./src/main.ts
```

**Options:**
- `--interactive, -i` — Interactive chat mode
- `--context, -c` — Add context from a file

---

### `grump init`

Initialize project configuration.

```bash
# Create local config
grump init

# Overwrite existing config
grump init --force

# Create global config
grump init --global
```

**Options:**
- `--force, -f` — Overwrite existing config
- `--global, -g` — Create global config in home directory

---

## Configuration

### `grump config [action]`

Manage G-Rump configuration.

```bash
# Get a value
grump config get apiUrl

# Set a value
grump config set apiUrl https://api.example.com

# List all settings
grump config list

# Reset to defaults
grump config reset
```

---

### `grump auth [action]`

Manage API authentication.

```bash
# Log in (opens browser or prompts for credentials)
grump auth login

# Log out
grump auth logout

# Check auth status
grump auth status

# Set API key directly
grump auth set-key <api-key>
```

---

## Configuration Files

The CLI looks for configuration in this order (highest priority first):

1. **Command-line flags**
2. **Environment variables** (`GRUMP_*`)
3. **Local config** (`.grumprc` or `grump.config.js` in project root)
4. **Global config** (`~/.config/grump/config.json`)

### Example `.grumprc` (JSON)

```json
{
  "apiUrl": "http://localhost:3000",
  "apiKey": "your-api-key-here",
  "theme": "dark",
  "defaultOutputDir": "./output",
  "features": {
    "autoStream": false,
    "cacheEnabled": true,
    "progressIndicators": true
  }
}
```

### Example `grump.config.js`

```javascript
module.exports = {
  apiUrl: process.env.GRUMP_API_URL || 'http://localhost:3000',
  apiKey: process.env.GRUMP_API_KEY,
  theme: 'dark',
  retries: 3,
  timeout: 30000,
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    directory: './.grump-cache'
  }
};
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GRUMP_API_URL` | Backend API URL | `http://localhost:3000` |
| `GRUMP_API_KEY` | API authentication key | — |
| `GRUMP_CONFIG_PATH` | Custom config file path | — |
| `GRUMP_THEME` | Color theme | `dark` |
| `GRUMP_CACHE_DIR` | Cache directory | `~/.grump-cache` |

---

## Themes

The CLI supports several color themes:

- **dark** (default) — Red/orange gradients on dark background
- **light** — Warm colors on light background
- **minimal** — No colors, text only
- **grumpy** — Extra red, extra frowny

Set your theme:

```bash
grump config set theme dark
# or
export GRUMP_THEME=grumpy
```

---

## Progress Indicators

Long-running operations show progress:

```
☹️  G-Rump CLI v2.1.0

⠼ Analyzing your request... (35%)
✓ Architecture generated
⠼ Writing code... (67%)
✓ Code complete
```

Disable with `--no-progress` or in config:

```json
{ "features": { "progressIndicators": false } }
```

---

## Streaming Output

Watch real-time progress with the `--stream` flag:

```bash
grump ship "Build an API" --stream
```

Output:

```
[INIT] Starting SHIP workflow...
[ANALYSIS] Analyzing requirements...
[PLANNING] Creating implementation plan...
[CODING] Generating code...
[DONE] Complete! Session ID: abc123
```

---

## CI/CD Integration

The CLI works well in automated pipelines:

```bash
# Generate architecture diagram for docs
grump architecture --format json --output arch.json

# Generate PRD from feature description
grump prd "New feature" --output prd.md

# Non-interactive: set API key via environment
export GRUMP_API_KEY=your-key
grump ship "Build component" --no-progress
```

---

## Complete Workflow Example

```bash
# 1. Initialize project config
grump init

# 2. Verify authentication
grump auth status

# 3. Start a SHIP session
grump ship "E-commerce platform with Stripe integration"
# → Session ID: session-abc-123

# 4. Check progress
grump status session-abc-123

# 5. Generate code when ready
grump codegen session-abc-123 --output ./generated

# 6. Generate documentation
grump architecture "E-commerce platform" --output ./docs/arch.mmd
grump prd "E-commerce platform" --output ./docs/prd.md
```

---

## Troubleshooting

### Can't connect to API

```
☹️  Oh no! Something went wrong.
Error: Failed to connect to API
```

**Fix:** Check that your server is running and `apiUrl` is correct:

```bash
grump config get apiUrl
curl http://localhost:3000/health/quick
```

### Authentication failed

```
Error: 401 Unauthorized
```

**Fix:** Re-authenticate or check your API key:

```bash
grump auth login
# or
grump auth set-key your-new-key
```

### Command not found

**Fix:** Ensure the CLI is installed globally:

```bash
npm install -g grump-cli
which grump  # should show the path
```

---

## Related Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** — Installation and setup
- **[API.md](./API.md)** — Full API reference
- **[packages/cli/README.md](../packages/cli/README.md)** — CLI package details

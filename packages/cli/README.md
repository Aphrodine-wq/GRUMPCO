# G-Rump CLI

**The grumpiest AI-powered CLI you'll ever love to hate.** ☹️

A comprehensive command-line interface for G-Rump with frowny face branding, colorful output, and powerful AI-assisted workflows.

![Version](https://img.shields.io/badge/version-3.0.0-red)
![License](https://img.shields.io/badge/license-MIT-orange)
![Node](https://img.shields.io/badge/node-%3E%3D20-red)

---

## ☹️ Features

- **Frowny Face Branding** - Every command starts with a delightfully grumpy ASCII face
- **8 Core Commands** - Ship, codegen, architecture, PRD, status, list, chat, and init
- **Beautiful CLI** - Chalk colors, ora spinners, and interactive prompts
- **Configuration Support** - `.grumprc` or `grump.config.js` support
- **Progress Indicators** - Know exactly what's happening with visual feedback
- **Error Handling** - Helpful error messages (with extra frowns)
- **API Key Management** - Built-in commands for managing credentials

---

## 🚀 Installation

```bash
npm install -g grump-cli
# or
npx grump-cli
```

### Local Development

```bash
cd packages/cli
npm install
npm run build
npm link
```

---

## 📋 Commands

### Core Workflows

#### `grump ship <description>`
Start a SHIP (Structured Human-In-the-Loop Process) workflow.

```bash
grump ship "Build a todo app with React and Node.js"
grump ship --stream "Create a REST API with authentication"
```

**Options:**
- `--stream, -s` - Stream output in real-time
- `--url, -u` - Custom API endpoint

---

#### `grump codegen <session-id>`
Run code generation on an existing SHIP session.

```bash
grump codegen abc123
grump codegen abc123 --output ./generated
```

**Options:**
- `--output, -o` - Output directory (default: current directory)
- `--format` - Output format (zip, json, files)

---

#### `grump architecture <description>`
Generate system architecture diagrams and documentation.

```bash
grump architecture "Microservices e-commerce platform"
grump architecture "Serverless API gateway" --format mermaid
```

**Options:**
- `--format` - Output format (mermaid, dot, json)
- `--output, -o` - Output file path
- `--workspace, -w` - Workspace path to analyze

---

#### `grump prd <description>`
Generate a Product Requirements Document.

```bash
grump prd "AI-powered code review tool"
grump prd "Mobile fitness tracker app" --output ./docs/prd.md
```

**Options:**
- `--output, -o` - Output file path
- `--template` - PRD template to use

---

### Session Management

#### `grump status <session-id>`
Check the status of a SHIP session.

```bash
grump status abc123
grump status abc123 --watch
```

**Options:**
- `--watch, -w` - Watch mode (continuously poll)
- `--json` - Output as JSON

---

#### `grump list`
List all active SHIP sessions.

```bash
grump list
grump list --all
grump list --format json
```

**Options:**
- `--all, -a` - Show all sessions (including completed)
- `--format` - Output format (table, json, compact)

---

### Utilities

#### `grump chat <message>`
Quick chat with the AI assistant.

```bash
grump chat "How do I implement OAuth2?"
grump chat --interactive
```

**Options:**
- `--interactive, -i` - Interactive chat mode
- `--context, -c` - Add context from a file

---

#### `grump init`
Initialize project configuration.

```bash
grump init
grump init --force
```

**Options:**
- `--force, -f` - Overwrite existing config
- `--global, -g` - Create global config in home directory

---

### Configuration & Management

#### `grump config [action]`
Manage G-Rump configuration.

```bash
grump config get apiUrl
grump config set apiUrl https://api.example.com
grump config list
grump config reset
```

---

#### `grump auth [action]`
Manage API authentication.

```bash
grump auth login
grump auth logout
grump auth status
grump auth set-key <api-key>
```

---

## ⚙️ Configuration

### Configuration Files

G-Rump CLI supports multiple configuration methods (in order of precedence):

1. **Command-line flags** - Highest priority
2. **Environment variables** - `GRUMP_*` variables
3. **Local config** - `.grumprc` or `grump.config.js` in project root
4. **Global config** - `~/.grumprc` or `~/.config/grump/config.json`

### `.grumprc` (JSON)

```json
{
  "apiUrl": "http://localhost:3000",
  "apiKey": "your-api-key-here",
  "theme": "dark",
  "defaultOutputDir": "./output",
  "colors": {
    "primary": "#FF6B35",
    "secondary": "#F7931E",
    "error": "#FF4136"
  },
  "features": {
    "autoStream": false,
    "cacheEnabled": true,
    "progressIndicators": true
  }
}
```

### `grump.config.js`

```javascript
module.exports = {
  apiUrl: process.env.GRUMP_API_URL || 'http://localhost:3000',
  apiKey: process.env.GRUMP_API_KEY,
  theme: 'dark',
  
  // Advanced configuration
  retries: 3,
  timeout: 30000,
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    directory: './.grump-cache'
  },
  
  // Hooks
  onStart: (command) => {
    console.log(`Starting ${command}...`);
  },
  onComplete: (result) => {
    console.log('Done!');
  }
};
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GRUMP_API_URL` | Backend API URL | `http://localhost:3000` |
| `GRUMP_API_KEY` | API authentication key | - |
| `GRUMP_CONFIG_PATH` | Custom config file path | - |
| `GRUMP_THEME` | Color theme (dark, light, minimal) | `dark` |
| `GRUMP_CACHE_DIR` | Cache directory | `~/.grump-cache` |

---

## 🎨 Themes & Colors

G-Rump CLI features a distinctive red/orange frowny face theme:

### Available Themes

- **dark** (default) - Red/orange gradients on dark background
- **light** - Warm colors on light background
- **minimal** - No colors, text only
- **grumpy** - Extra red, extra frowny

### Set Theme

```bash
grump config set theme dark
export GRUMP_THEME=grumpy
```

---

## 📊 Progress Indicators

G-Rump shows beautiful progress indicators for long-running operations:

```
☹️  G-Rump CLI v3.0.0

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

## 🐛 Error Handling

G-Rump provides helpful error messages with extra frowns:

```
☹️  Oh no! Something went wrong.

Error: Failed to connect to API
Suggestion: Check that your server is running on http://localhost:3000

Run with --verbose for more details.
```

---

## 🔧 Advanced Usage

### Streaming Output

```bash
grump ship "Build an API" --stream
```

Watch real-time progress as G-Rump works through phases:
```
[INIT] Starting SHIP workflow...
[ANALYSIS] Analyzing requirements...
[PLANNING] Creating implementation plan...
[CODING] Generating code...
[DONE] Complete! Session ID: abc123
```

### Batch Operations

```bash
# Process multiple requests
grump ship-parallel "App 1" "App 2" "App 3"

# With file input
cat projects.txt | xargs -I {} grump ship "{}"
```

### Integration with CI/CD

```bash
# In your CI pipeline
grump architecture --format json --output arch.json
grump prd "New feature" --output prd.md
```

---

## 📝 Examples

### Complete Workflow Example

```bash
# 1. Initialize project
grump init

# 2. Check auth status
grump auth status

# 3. Start a SHIP session
grump ship "E-commerce platform with Stripe integration"
# → Session ID: session-abc-123

# 4. Check status
grump status session-abc-123

# 5. Generate code when ready
grump codegen session-abc-123 --output ./generated

# 6. Generate documentation
grump architecture "E-commerce platform" --output ./docs/arch.mmd
grump prd "E-commerce platform" --output ./docs/prd.md
```

### Interactive Chat Session

```bash
grump chat --interactive

☹️  G-Rump: What would you like to know?
> How do I handle errors in async functions?

G-Rump: Here are some best practices for error handling...

> Can you show me an example?

G-Rump: Sure! Here's a code example...

> exit

☹️  G-Rump: Fine, leaving. Goodbye.
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

---

## 📄 License

MIT License - see [LICENSE](../../LICENSE) file for details.

---

## ☹️ Support

Having issues? We're grumpy but helpful:

- 📖 [Documentation](https://g-rump.dev/docs)
- 🐛 [Issue Tracker](https://github.com/g-rump/cli/issues)
- 💬 [Discussions](https://github.com/g-rump/cli/discussions)

---

**Remember: G-Rump cares, it just has a hard time showing it.** ☹️

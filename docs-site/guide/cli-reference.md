# CLI Reference

G-Rump CLI (`grump`) is a powerful command-line interface that provides both productivity features for AI-assisted development and fun commands for developer morale. This reference covers all 40+ commands available in the CLI.

## Installation

```bash
# Install globally via npm
npm install -g grump-cli

# Or use npx (no installation)
npx grump-cli <command>

# Native binary downloads available for Windows, macOS, and Linux
```

## Global Options

Every command supports these global options:

| Option | Description | Default |
|--------|-------------|---------|
| `-v, --version` | Display version number | - |
| `-u, --url <url>` | API base URL | From config |
| `--no-color` | Disable colored output | false |
| `--no-progress` | Disable progress indicators | false |
| `--verbose` | Enable verbose output | false |

## Core Development Commands

These commands form the foundation of the G-Rump development workflow.

### `ship` - SHIP Workflow

Start a complete SHIP (Scope → Hypothesis → Implementation → Production) workflow session.

```bash
grump ship "Build a React e-commerce app with Stripe payments"
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --stream` | Stream output in real-time | false |
| `-w, --workspace <path>` | Workspace path | Current directory |
| `-o, --output <path>` | Output directory | Auto-generated |

**Example:**

```bash
# Start SHIP with streaming output
grump ship "Create a REST API for a blog" --stream

# Specify custom workspace
grump ship "Build a mobile app" --workspace ./my-project
```

### `codegen` - Code Generation

Generate code from a completed SHIP session.

```bash
grump codegen <session-id>
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output directory | Current directory |
| `-f, --format <format>` | Output format (zip, json, files) | zip |

**Example:**

```bash
# Generate code from session and output as files
grump codegen session_abc123 --format files --output ./generated
```

### `architecture` (alias: `arch`)

Generate system architecture diagrams and specifications.

```bash
grump architecture "Design a microservices architecture for a fintech app"
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --format <format>` | Output format (mermaid, dot, json) | mermaid |
| `-o, --output <path>` | Output file path | stdout |
| `-w, --workspace <path>` | Workspace to analyze | Current directory |

**Example:**

```bash
# Generate Mermaid diagram
grump architecture "E-commerce system" --format mermaid --output arch.mmd

# Analyze existing codebase
grump architecture "Analyze current project" --workspace ./src
```

### `prd` - Product Requirements Document

Generate a comprehensive PRD from a product description.

```bash
grump prd "A mobile app for tracking daily water intake with reminders"
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output file path | ./prd.md |
| `-t, --template <name>` | PRD template to use | default |

### `status` - Check Session Status

Monitor the status of a SHIP session.

```bash
grump status <session-id>
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-w, --watch` | Watch mode (continuously poll) | false |
| `--json` | Output as JSON | false |
| `-i, --interval <ms>` | Poll interval in milliseconds | 5000 |

**Example:**

```bash
# Watch session progress
grump status session_abc123 --watch --interval 3000
```

### `list` - List Sessions

View all active and completed SHIP sessions.

```bash
grump list
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-a, --all` | Show all sessions including completed | false |
| `-f, --format <format>` | Output format (table, json, compact) | table |
| `-l, --limit <number>` | Limit number of results | 50 |

### `chat` - Quick Chat

Have a quick conversation with the AI assistant.

```bash
grump chat "How do I implement JWT authentication?"
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --interactive` | Interactive chat mode | false |
| `-c, --context <path>` | Context file path | - |
| `-s, --session <id>` | Continue existing chat session | - |

**Example:**

```bash
# Start interactive chat
grump chat --interactive

# Chat with context from a file
grump chat "Explain this code" --context ./src/auth.ts
```

## Project Management Commands

### `init` - Initialize Project

Set up G-Rump configuration for a new or existing project.

```bash
grump init
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --force` | Overwrite existing config | false |
| `-g, --global` | Create global config | false |
| `-i, --interactive` | Interactive setup | true |

**Example:**

```bash
# Interactive setup for current project
grump init

# Create global configuration
grump init --global
```

### `config` - Manage Configuration

View or modify G-Rump configuration settings.

```bash
grump config [action] [key] [value]
```

**Actions:**
- `get <key>` - Get a configuration value
- `set <key> <value>` - Set a configuration value
- `list` - List all configuration values (default)
- `reset` - Reset configuration to defaults

**Example:**

```bash
# List all settings
grump config

# Set API URL
grump config set apiUrl https://api.grump.dev

# Get current model preference
grump config get defaultModel
```

### `auth` - Authentication Management

Manage your G-Rump API authentication.

```bash
grump auth [action] [key]
```

**Actions:**
- `login` - Authenticate with browser OAuth
- `logout` - Remove authentication
- `status` - Check authentication status (default)
- `set-key <key>` - Set API key directly

**Example:**

```bash
# Check auth status
grump auth

# Login via browser
grump auth login

# Set API key directly
grump auth set-key grump_api_xxxxxxxx
```

### `compile` - Intent Compiler

Compile intent files into structured output.

```bash
grump compile [files...]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-w, --watch` | Enable watch mode | false |
| `-a, --analyze` | Run bundle analyzer | false |
| `-p, --parallel` | Use parallel processing | false |
| `-i, --incremental` | Use incremental compilation | false |
| `--dce` | Enable dead code elimination | false |
| `--source-maps` | Generate source maps | false |
| `--hot-reload` | Start hot reload server | false |
| `--config <path>` | Use custom config file | - |
| `-o, --output <dir>` | Output directory | ./dist |
| `-f, --format <format>` | Output format (json, yaml, typescript) | json |
| `--verbose` | Enable verbose output | false |

**Example:**

```bash
# Compile all .intent files in current directory
grump compile

# Watch mode with hot reload
grump compile --watch --hot-reload

# Compile specific files
grump compile ./features/*.intent --output ./compiled
```

## Developer Morale Commands

These commands are designed to boost developer morale with humor and personality.

### `rant` - AI Complaints

Get the AI to complain about your code with varying levels of sarcasm.

```bash
grump rant
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-l, --level <level>` | Rant level: gentle, harsh, brutal | harsh |
| `-t, --topic <topic>` | Specific topic to rant about | Random |
| `-c, --count <number>` | Number of rants | 3 |

**Example:**

```bash
# Brutal rant about documentation
grump rant --level brutal --topic "missing comments"

# Multiple gentle rants
grump rant --level gentle --count 5
```

### `roast` - Code Roast

Get a brutal but funny code review.

```bash
grump roast <file>
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-b, --brutal` | Maximum roast mode | false |
| `-s, --stats` | Show code statistics | false |

**Example:**

```bash
# Roast a specific file
grump roast ./src/components/Button.tsx

# Maximum brutal roast with stats
grump roast ./src/index.ts --brutal --stats
```

### `excuse` - Deadline Excuses

Generate creative excuses for missed deadlines.

```bash
grump excuse
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --category <category>` | Category: classic, technical, creative, relatable, absurd, professional, random | random |
| `-n, --count <number>` | Number of excuses | 1 |
| `-t, --context <context>` | Context for the excuse | - |

**Categories:**

| Category | Description |
|----------|-------------|
| `classic` | Time-tested favorites |
| `technical` | Blame the technology |
| `creative` | Outside-the-box thinking |
| `relatable` | Every dev's nightmare |
| `absurd` | Ridiculous but funny |
| `professional` | Corporate-friendly |

**Example:**

```bash
# Generate a technical excuse
grump excuse --category technical --context "deployment failed"

# Multiple creative excuses
grump excuse --category creative --count 3
```

### `blame` - Git Blame with Personality

Analyze who wrote that questionable code with humorous commentary.

```bash
grump blame [file]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-l, --line <number>` | Specific line number | - |
| `-f, --funny` | Maximum humor mode | false |

**Example:**

```bash
# Blame specific line
grump blame ./src/utils.ts --line 42 --funny

# Blame entire file
grump blame ./legacy-code.ts
```

### `coffee` - Coffee Readiness Check

Check if your code (or developer) is ready for the day.

```bash
grump coffee [file]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-a, --all` | Check all files | false |

**Example:**

```bash
# Check specific file
grump coffee ./src/main.ts

# Check entire codebase
grump coffee --all
```

### `vibes` - Emotional Analysis

Analyze the emotional state of your codebase.

```bash
grump vibes
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --path <path>` | Path to analyze | Current directory |
| `-d, --deep` | Deep analysis mode | false |

**Example:**

```bash
# Quick vibes check
grump vibes

# Deep analysis of specific directory
grump vibes --path ./src --deep
```

### `panic` - Emergency Mode

Emergency fix mode with dramatic output for those "everything is on fire" moments.

```bash
grump panic
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --reason <reason>` | Reason for panic | - |
| `-f, --fix` | Attempt emergency fix | false |

**Example:**

```bash
# Panic with reason
grump panic --reason "Production is down!"

# Attempt automatic fix
grump panic --reason "Database corrupted" --fix
```

### `shipit` - YOLO Deploy

Force deploy with funny warnings (use with caution!).

```bash
grump shipit
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --force` | Skip all warnings | false |
| `-m, --message <message>` | Deployment message | - |
| `-y, --yolo` | Maximum YOLO mode | false |

### `docs` - Sassy Documentation

Generate documentation with personality and snarky comments.

```bash
grump docs [file]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output path | - |
| `-s, --style <style>` | Documentation style: sassy, professional, brutal | sassy |

### `refactor` - Aggressive Refactoring

Get aggressive refactoring suggestions with attitude.

```bash
grump refactor [file]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-a, --aggressive` | Aggressive mode | false |

### `why` - Existential Crisis

Question why code exists with deep philosophical analysis.

```bash
grump why [target]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --deep` | Deep philosophical mode | false |

### `fortune` - Programming Fortunes

Random programming fortunes with sass.

```bash
grump fortune
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --category <category>` | Category: lucky, caution, doom, wisdom, comedy, sarcastic, random | random |
| `-s, --sign <sign>` | Zodiac sign for horoscope | - |

### `overtime` - Overtime Calculator

Calculate how much unpaid overtime you've worked.

```bash
grump overtime
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-h, --hours <number>` | Weekly hours worked | 45 |
| `-r, --rate <number>` | Hourly rate | 50 |
| `-w, --weeks <number>` | Weeks per year | 52 |

### `meeting` - Meeting Survival Guide

Meeting survival guide and excuse generator.

```bash
grump meeting
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --excuse` | Generate meeting excuse | false |
| `-t, --tip` | Get survival tip | false |
| `--type <type>` | Meeting type: standup, planning, retro, allhands, oneOnOne, brainstorm | - |

### `stackoverflow` (alias: `so`)

Simulate the StackOverflow experience.

```bash
grump stackoverflow
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-q, --question <question>` | Simulate asking a question | - |
| `-e, --experience` | Full SO experience | false |

### `fml` - Fix My Life

FML mode for when everything is broken.

```bash
grump fml
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-v, --vent` | Venting mode | false |
| `-h, --help-me` | Show survival kit | false |

### `intern` - Intern Simulator

Intern simulator and code pattern analysis.

```bash
grump intern
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --excuse` | Generate intern excuse | false |
| `-a, --achievement` | Show achievements | false |

### `legacy` - Legacy Code Therapy

Legacy code archaeology and therapy.

```bash
grump legacy
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-h, --horror` | Show legacy horrors | false |
| `-e, --excuse` | Excuse for not refactoring | false |
| `-t, --tips` | Code archaeology tips | false |
| `-a, --age <years>` | Estimated code age | - |

### `yeet` - Delete Code

Dramatically delete code or ideas into the void.

```bash
grump yeet [target]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --dramatic` | Dramatic yeet sequence | false |
| `-w, --wisdom` | Show yeet wisdom | false |

### `techdebt` (alias: `debt`)

Measure and lament your technical debt.

```bash
grump techdebt
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --excuses` | Excuses for not fixing debt | false |
| `-s, --strategies` | Debt payoff strategies | false |

### `friday` - Friday Deploy Checker

Check if it's safe to deploy on Friday.

```bash
grump friday
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --excuse` | Generate emergency excuse | false |
| `-g, --guide` | Show survival guide | false |
| `-f, --force` | Force deploy anyway | false |

### `imposter` - Imposter Syndrome Therapy

Imposter syndrome therapy and validation.

```bash
grump imposter
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --truth` | Show uncomfortable truths | false |
| `-a, --affirm` | Developer affirmations | false |
| `-s, --stats` | Industry imposter stats | false |

## Environment Variables

The CLI respects these environment variables:

| Variable | Description |
|----------|-------------|
| `GRUMP_API_KEY` | Your G-Rump API key |
| `GRUMP_API_URL` | Custom API endpoint |
| `GRUMP_NO_BRANDING` | Set to `true` to disable header branding |
| `GRUMP_DEBUG` | Enable debug logging |

## Configuration File

G-Rump stores configuration in:

- **Global**: `~/.grump/config.json`
- **Project**: `./.grumprc.json`

Example `.grumprc.json`:

```json
{
  "apiUrl": "https://api.grump.dev",
  "defaultModel": "moonshotai/kimi-k2.5",
  "agents": {
    "architect": true,
    "coder": true,
    "reviewer": true,
    "security": true,
    "devops": false,
    "docs": true
  },
  "style": {
    "typescript": true,
    "strict": true,
    "testCoverage": "high"
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
| `3` | Authentication error |
| `4` | API error |
| `5` | Network error |

## Getting Help

```bash
# Show general help
grump --help

# Show help for specific command
grump ship --help
grump rant --help
```

## Next Steps

- [Getting Started](/guide/getting-started) - Set up G-Rump for the first time
- [Configuration](/guide/configuration) - Learn about all configuration options
- [SHIP Workflow](/guide/ship-workflow) - Understand the development workflow

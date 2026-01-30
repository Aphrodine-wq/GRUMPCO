# Configuration

Complete guide to configuring G-Rump for your development environment.

## Configuration Files

G-Rump uses multiple configuration files:

| File | Location | Purpose |
|------|----------|---------|
| `.grumprc.json` | Project root | Project-specific settings |
| `config.json` | User data dir | Global user settings |
| `.env` | Project root | Environment variables |

## Project Configuration (`.grumprc.json`)

### Basic Structure

```json
{
  "$schema": "https://grump.dev/schema/grumprc.json",
  "projectName": "my-app",
  "version": "1.0.0",
  
  "language": "typescript",
  "framework": "react",
  
  "llm": {},
  "agents": {},
  "codeStyle": {},
  "paths": {}
}
```

### LLM Configuration

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4-turbo",
    "temperature": 0.7,
    "maxTokens": 4096,
    
    "fallback": {
      "provider": "anthropic",
      "model": "claude-3-sonnet"
    }
  }
}
```

**Supported Providers:**

| Provider | Models | Notes |
|----------|--------|-------|
| `openai` | gpt-4, gpt-4-turbo, gpt-3.5-turbo | Recommended |
| `anthropic` | claude-3-opus, claude-3-sonnet | Great for complex tasks |
| `ollama` | llama2, codellama, mistral | Local, private |
| `azure` | Azure OpenAI models | Enterprise |

### Agent Configuration

```json
{
  "agents": {
    "architect": {
      "enabled": true,
      "model": "gpt-4-turbo",
      "temperature": 0.3
    },
    "coder": {
      "enabled": true,
      "model": "gpt-4-turbo",
      "style": "functional",
      "verbosity": "concise"
    },
    "reviewer": {
      "enabled": true,
      "strictness": "high",
      "focusAreas": ["security", "performance", "types"]
    },
    "security": {
      "enabled": true,
      "scanDependencies": true,
      "checkSecrets": true
    },
    "devops": {
      "enabled": false
    },
    "docs": {
      "enabled": true,
      "format": "jsdoc"
    }
  }
}
```

### Code Style

```json
{
  "codeStyle": {
    "language": "typescript",
    "strict": true,
    
    "formatting": {
      "quotes": "single",
      "semicolons": true,
      "tabWidth": 2,
      "useTabs": false,
      "trailingComma": "es5",
      "printWidth": 100
    },
    
    "patterns": {
      "preferFunctional": true,
      "useAsyncAwait": true,
      "preferConst": true,
      "noAny": true
    },
    
    "naming": {
      "components": "PascalCase",
      "functions": "camelCase",
      "constants": "UPPER_SNAKE_CASE",
      "files": "kebab-case"
    },
    
    "imports": {
      "sortImports": true,
      "grouping": ["builtin", "external", "internal", "relative"]
    }
  }
}
```

### Path Configuration

```json
{
  "paths": {
    "src": "src",
    "tests": "tests",
    "docs": "docs",
    "generated": ".grump/generated",
    
    "aliases": {
      "@": "src",
      "@components": "src/components",
      "@services": "src/services",
      "@utils": "src/utils"
    }
  }
}
```

### Context Configuration

```json
{
  "context": {
    "include": [
      "src/**/*.ts",
      "src/**/*.tsx",
      "package.json",
      "tsconfig.json"
    ],
    "exclude": [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/node_modules/**",
      "**/dist/**",
      "**/.git/**"
    ],
    "maxFiles": 50,
    "maxFileSize": 100000
  }
}
```

## Global Configuration

Located in the user data directory:

- **Windows**: `%APPDATA%/g-rump/config.json`
- **macOS**: `~/Library/Application Support/g-rump/config.json`
- **Linux**: `~/.config/g-rump/config.json`

```json
{
  "api": {
    "openai": {
      "apiKey": "sk-...",
      "organization": "org-..."
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  },
  
  "appearance": {
    "theme": "dark",
    "accentColor": "#7C3AED",
    "fontSize": 14,
    "fontFamily": "JetBrains Mono"
  },
  
  "editor": {
    "wordWrap": true,
    "lineNumbers": true,
    "minimap": false,
    "bracketPairColorization": true
  },
  
  "terminal": {
    "shell": "auto",
    "fontSize": 13
  },
  
  "telemetry": {
    "enabled": false
  },
  
  "updates": {
    "autoCheck": true,
    "autoDownload": false,
    "channel": "stable"
  }
}
```

## Environment Variables

### `.env` File

```bash
# LLM Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AZURE_OPENAI_KEY=...
AZURE_OPENAI_ENDPOINT=https://....openai.azure.com

# Local Models
OLLAMA_HOST=http://localhost:11434

# Backend Configuration
GRUMP_PORT=3000
GRUMP_HOST=localhost
DATABASE_URL=postgresql://user:pass@localhost:5432/grump

# Feature Flags
GRUMP_DEBUG=false
GRUMP_TELEMETRY=false

# Security
GRUMP_ENCRYPTION_KEY=...
```

### Environment Precedence

1. Shell environment variables
2. `.env.local` (git-ignored)
3. `.env.{environment}` (.env.development, .env.production)
4. `.env`

## Framework-Specific Presets

### React

```bash
grump init my-app --preset react
```

```json
{
  "framework": "react",
  "codeStyle": {
    "patterns": {
      "componentStyle": "functional",
      "stateManagement": "hooks",
      "styling": "tailwind"
    }
  },
  "agents": {
    "coder": {
      "templates": ["react-component", "react-hook", "react-context"]
    }
  }
}
```

### Next.js

```json
{
  "framework": "nextjs",
  "codeStyle": {
    "patterns": {
      "routing": "app-router",
      "dataFetching": "server-components",
      "apiRoutes": "route-handlers"
    }
  }
}
```

### Express

```json
{
  "framework": "express",
  "codeStyle": {
    "patterns": {
      "architecture": "layered",
      "validation": "zod",
      "errorHandling": "middleware"
    }
  }
}
```

## Configuration Commands

### View Current Config

```bash
# Show all configuration
grump config list

# Show specific section
grump config get llm
grump config get agents.coder
```

### Modify Configuration

```bash
# Set a value
grump config set llm.model gpt-4-turbo
grump config set codeStyle.formatting.tabWidth 4

# Reset to defaults
grump config reset

# Open config in editor
grump config edit
```

### Validate Configuration

```bash
grump config validate
```

## Configuration Schema

Full JSON Schema available at:
- https://grump.dev/schema/grumprc.json

Use in your `.grumprc.json`:

```json
{
  "$schema": "https://grump.dev/schema/grumprc.json"
}
```

This enables autocompletion and validation in VS Code and other editors.

## Best Practices

1. **Version control `.grumprc.json`** - Share project settings with team
2. **Don't commit API keys** - Use `.env.local` for secrets
3. **Use presets** - Start with framework presets, customize from there
4. **Document custom settings** - Add comments explaining non-obvious choices

## Next Steps

- [Building from Source](/guide/building) - Development setup
- [Security](/guide/security) - Secure configuration
- [CLI Reference](/cli/configuration) - CLI config commands

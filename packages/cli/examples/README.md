# G-Rump CLI Examples

This directory contains example configuration files and usage examples for the G-Rump CLI.

## Configuration Files

### .grumprc (JSON format)

Simple JSON configuration file. Place this in your project root or home directory.

```json
{
  "apiUrl": "http://localhost:3000",
  "apiKey": "your-api-key-here",
  "theme": "dark",
  "defaultOutputDir": "./output"
}
```

### grump.config.js (JavaScript format)

Advanced JavaScript configuration with logic and environment variables.

```javascript
module.exports = {
  apiUrl: process.env.GRUMP_API_URL || 'http://localhost:3000',
  apiKey: process.env.GRUMP_API_KEY,
  theme: 'dark'
};
```

## Usage Examples

### Basic SHIP Workflow

```bash
# Initialize project
grump init

# Start a SHIP session
grump ship "Build a todo app with React"

# Check status
grump status <session-id>

# Generate code
grump codegen <session-id> --output ./generated
```

### Interactive Mode

```bash
# Chat with AI
grump chat "How do I implement OAuth?"

# Interactive chat
grump chat --interactive
```

### Architecture Generation

```bash
# Generate architecture diagram
grump architecture "Microservices e-commerce platform" --output arch.mmd

# Different formats
grump architecture "API Gateway" --format dot --output arch.dot
```

### PRD Generation

```bash
# Generate PRD
grump prd "AI-powered code review tool" --output docs/prd.md
```

### Session Management

```bash
# List all sessions
grump list

# Watch session progress
grump status <session-id> --watch
```

## CI/CD Integration

```yaml
# .github/workflows/grump.yml
name: Generate Architecture

on:
  push:
    branches: [ main ]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup G-Rump
        run: npm install -g grump-cli
      - name: Generate Architecture
        run: grump architecture "Current codebase" --output docs/arch.mmd
      - name: Upload
        uses: actions/upload-artifact@v2
        with:
          name: architecture
          path: docs/arch.mmd
```

## Environment Variables

```bash
export GRUMP_API_URL=https://api.g-rump.dev
export GRUMP_API_KEY=your-secret-key
export GRUMP_THEME=grumpy
export GRUMP_CONFIG_PATH=/path/to/custom/config
```

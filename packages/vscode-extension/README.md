# G-Rump AI for Visual Studio Code

> **Version 2.1.0** | Updated January 31, 2026

AI-powered development assistant with architecture diagrams, PRDs, and code generation - right inside VS Code.

## Features

### Chat Sidebar
- Ask G-Rump anything about your code
- Get instant explanations and suggestions
- Stream responses in real-time

### SHIP Workflow
Start a complete development workflow with a single command:
1. **S**pec - Generate specifications from your description
2. **H**ierarchy - Create project structure
3. **I**mplement - Generate code
4. **P**olish - Refine and optimize

### Code Intelligence
- **Explain Code** - Select code and get detailed explanations
- **Refactor** - AI-powered code refactoring with instructions
- **Generate Tests** - Automatic test generation for your functions
- **Generate Docs** - Create documentation from your code

### Architecture & PRD Generation
- Generate system architecture diagrams in Mermaid format
- Create comprehensive Product Requirements Documents
- Export diagrams and specs to files

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `G-Rump: Open Chat` | `Ctrl+Shift+G` | Open the chat sidebar |
| `G-Rump: Start SHIP Workflow` | `Ctrl+Shift+S` | Start a new SHIP session |
| `G-Rump: Generate Architecture` | - | Generate architecture diagram |
| `G-Rump: Generate PRD` | - | Generate Product Requirements Document |
| `G-Rump: Explain Selected Code` | - | Explain the selected code |
| `G-Rump: Refactor Selected Code` | - | Refactor with AI assistance |
| `G-Rump: Generate Tests` | - | Generate unit tests |
| `G-Rump: Generate Documentation` | - | Generate docs for code |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `grump.backendUrl` | `http://localhost:3000` | URL of the G-Rump backend server |
| `grump.apiKey` | - | API key for G-Rump services |
| `grump.model` | `moonshotai/kimi-k2.5` | AI model to use |
| `grump.autoConnect` | `true` | Auto-connect to backend on startup |
| `grump.showInlineHints` | `true` | Show inline code lens hints |

## Requirements

- G-Rump backend server running locally or remotely
- API key (optional, for cloud features)

## Getting Started

1. Install the extension
2. Start the G-Rump backend: `docker-compose up`
3. Open the G-Rump sidebar (click the icon in the Activity Bar)
4. Start chatting or run `G-Rump: Start SHIP Workflow`

## Code Lens

When enabled, G-Rump adds inline actions above functions:
- **Explain** - Get a detailed explanation
- **Tests** - Generate unit tests
- **Refactor** - AI-powered refactoring

## Context Menu

Right-click on selected code to access G-Rump features:
- Explain Selected Code
- Refactor Selected Code
- Generate Tests for Selection
- Generate Documentation

## Supported Languages

- TypeScript / JavaScript
- Python
- Go
- Rust
- Java
- C#

## Troubleshooting

### Extension not connecting
1. Ensure the G-Rump backend is running
2. Check the `grump.backendUrl` setting
3. Run `G-Rump: Connect to Backend` command

### API key issues
1. Run `G-Rump: Set API Key` command
2. Enter your API key
3. Restart VS Code

## License

MIT License - See [LICENSE](LICENSE) for details.

## Links

- [G-Rump Website](https://g-rump.com)
- [Documentation](https://g-rump.com/docs)
- [GitHub Repository](https://github.com/Aphrodine-wq/G-rump.com)

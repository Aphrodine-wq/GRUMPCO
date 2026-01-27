# G-Rump

G-Rump is an AI-powered development assistant that helps you design architectures, generate PRDs, and create full-stack applications from natural language descriptions.

## Features

- **Architecture Generation**: Create comprehensive system architecture diagrams using Mermaid
- **PRD Generation**: Automatically generate Product Requirements Documents
- **Multi-Agent Code Generation**: Generate full-stack applications with specialized AI agents
- **Intent Compiler**: Parse natural language into structured, code-optimized project requirements
- **Design Mode**: Automatic work report generation for each agent
- **WRunner Quality Assurance**: Automatic issue detection and auto-fix capabilities
- **Claude Code Optimization**: All prompts optimized for Claude Code best practices
- **Windows Desktop App**: Native Tauri application with bundled backend

## Quick Start

### Prerequisites

- Node.js 20+
- Rust (for building intent-compiler and Tauri app)
- Windows 10/11 (for production builds)

### Development Setup

1. **Install dependencies:**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   
   # Intent Compiler (Rust)
   cd ../intent-compiler
   cargo build --release
   ```

2. **Configure environment:**
   ```bash
   # Create backend/.env
   cd backend
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY
   ```

3. **Start development:**
   ```bash
   # From project root
   start-app.bat
   ```
   Backend runs on port 3000, frontend on 5173. To verify both are up, run `scripts\smoke-check.bat` or open `systems-dashboard.html` in your browser. See [SETUP.md](SETUP.md) for the full smoke-test flow.

### Building for Windows

Run the build script:
```bash
build-windows.bat
```

This will:
1. Build the intent-compiler Rust binary
2. Bundle the backend with embedded Node.js
3. Build the Svelte frontend
4. Create Windows MSI/NSIS installers

Output will be in `frontend/src-tauri/target/release/bundle/`

## Architecture

- **Frontend**: Svelte 5 + Tauri (Windows desktop app)
- **Backend**: Node.js/Express (bundled as executable)
- **Intent Compiler**: Rust CLI (bundled as executable)

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup instructions
- [BUILD.md](BUILD.md) - Windows build guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [MIGRATION.md](MIGRATION.md) - Vue to Svelte migration notes
- [docs/AGENT_SYSTEM.md](docs/AGENT_SYSTEM.md) - Complete agent system documentation
- [docs/INTENT_COMPILER.md](docs/INTENT_COMPILER.md) - Intent compiler documentation
- [docs/AI_WORKFLOWS.md](docs/AI_WORKFLOWS.md) - AI workflow patterns and best practices

## License

[Your License Here]

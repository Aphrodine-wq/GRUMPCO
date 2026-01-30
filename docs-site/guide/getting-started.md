# Getting Started

This guide will help you set up G-Rump and start building your first AI-assisted project.

## Prerequisites

Before installing G-Rump, ensure you have:

- **Node.js** 20.0 or higher ([Download](https://nodejs.org/))
- **npm** package manager
- An **NVIDIA NIM API key** ([Get free key](https://build.nvidia.com/)) OR **OpenRouter API key** ([Get key](https://openrouter.ai/))

## Installation Options

### Option 1: Desktop Application (Recommended)

The easiest way to use G-Rump is with our Electron desktop app:

```bash
# Clone the repository
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# Install dependencies
cd frontend && npm install
cd ../backend && npm install && npm run build

# Run the desktop app
cd ../frontend
npm run electron:dev
```

**Or build a portable executable:**
```bash
cd frontend
npm run electron:build
# Output: frontend/electron-dist/G-Rump.exe
```

### Option 2: CLI

Install the G-Rump CLI globally:

```bash
npm install -g grump-cli

# Configure
grump config set apiUrl http://localhost:3000
grump auth login

# Run your first command
grump ship "Build a todo app with auth"
```

### Option 3: Docker

Run G-Rump in a container:

```bash
# Ensure backend/.env has your API key
docker-compose up --build

# Access at http://localhost:8080
```

### Option 4: From Source

Clone and build locally:

```bash
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend
cd backend && npm run dev

# Start frontend (new terminal)
cd frontend && npm run dev
```

## Configuration

### API Keys

G-Rump requires an AI provider API key:

**Desktop App**: Set in `backend/.env` file

**CLI/Environment**:

```bash
# NVIDIA NIM (Recommended - Kimi K2.5)
export NVIDIA_NIM_API_KEY=nvapi-your-key

# Or OpenRouter (multi-model)
export OPENROUTER_API_KEY=sk-or-v1-your-key
```

### Backend Configuration

Create `backend/.env`:

```env
# Required - at least one
NVIDIA_NIM_API_KEY=nvapi-your-key-here
# OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Server
PORT=3000
NODE_ENV=development

# Optional - for production
REQUIRE_AUTH_FOR_API=true
CORS_ORIGINS=http://localhost:5173
```

### Frontend Configuration (Optional)

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

## First Project

Let's create a simple project to verify everything works:

### Using Desktop App

1. Launch G-Rump (via `npm run electron:dev` or the built executable)
2. Enter your project description: "Build a todo app with user authentication"
3. Click "Generate Architecture" to see system diagrams
4. Click "Generate PRD" for detailed requirements
5. Select tech stack preferences and click "Generate Code"
6. Download your complete project

### Using CLI

```bash
# Run SHIP workflow
grump ship "Build a todo app with React frontend and Node.js backend"

# G-Rump will:
# 1. Parse your intent
# 2. Generate architecture diagrams
# 3. Create a PRD
# 4. Generate code
# 5. Provide download link
```

## Desktop App Overview

When you launch the G-Rump desktop app, you'll see:

- **Chat Panel** - Main interaction area for both modes:
  - *Architecture Mode*: Design-first with diagrams and specs
  - *Code Mode*: Tool-enabled chat with file/bash operations
- **Architecture View** - Visual system diagrams (Mermaid)
- **Workflow Bar** - Track progress through Spec → Code phases
- **Settings** - API configuration, cost dashboard, preferences

## Verification

Check that everything is working:

```bash
# Backend health
curl http://localhost:3000/health/quick

# Expected response:
{"status":"healthy","checks":{"api_key_configured":true,"server_responsive":true}}
```

## Next Steps

- [Quick Start Guide](/guide/quick-start) - Build a complete project step-by-step
- [SHIP Workflow](/guide/ship-workflow) - Learn the SHIP methodology
- [Configuration](/guide/configuration) - Advanced settings and options
- [Architecture Mode](/guide/architecture-mode) - Design-first development
- [Code Mode](/guide/code-mode) - Tool-enabled chat development

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "AI provider required" | Add NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY to backend/.env |
| Port already in use | Backend auto-finds next port; check console output |
| Frontend disconnected | Ensure backend is running (`npm run dev` in backend/) |
| CORS errors | Add your origin to CORS_ORIGINS in backend/.env |

For more help, see the [troubleshooting section in our setup guide](https://github.com/Aphrodine-wq/G-rump.com/blob/main/docs/SETUP.md#troubleshooting).

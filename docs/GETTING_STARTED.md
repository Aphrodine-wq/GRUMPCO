# Getting Started with G-Rump

> **Last Updated:** February 2026 | **Version:** 2.1.0

Welcome! This guide will take you from zero to a running G-Rump installation in under 10 minutes.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation Options](#installation-options)
- [Configuration](#configuration)
- [Your First Project](#your-first-project)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 20+ | Runtime environment |
| **Git** | 2.30+ | Version control |
| **Docker** | Latest | Containerized deployment (optional) |
| **Rust** | 1.77+ | Intent compiler (optional) |

### Check Prerequisites

```bash
node --version    # Should be v20.x.x or higher
git --version     # Should be 2.30+
docker --version  # Optional
cargo --version   # Optional (for Rust compiler)
```

---

## Quick Start

Get up and running in **60 seconds**:

```bash
# 1. Clone the repository
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# 2. Install dependencies
npm install

# 3. Build shared packages (required)
npm run build:packages

# 4. Start in Mock Mode (no API key needed)
echo "MOCK_AI_MODE=true" > backend/.env
cd frontend && npm run electron:dev
```

That's it! The desktop app will open with realistic placeholder responses.

---

## Installation Options

### Option 1: Desktop App (Recommended)

Best for local development with system tray integration.

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Build backend
cd ../backend && npm run build

# Launch desktop app
cd ../frontend
npm run electron:dev
```

**Desktop Features:**
- 🖥️ **System tray** - Minimize to tray, quick access menu
- ⌨️ **Global shortcut** - Press `Ctrl+Shift+G` from anywhere
- 🔄 **Auto-start backend** - Backend bundled with app
- 📱 **Cross-platform** - Windows, macOS, Linux

#### Build Portable Executable

```bash
cd frontend
npm run electron:build

# Output locations:
# Windows: frontend/electron-dist/G-Rump.exe
# Linux:   frontend/electron-dist/G-Rump.AppImage
# macOS:   frontend/electron-dist/G-Rump.dmg
```

---

### Option 2: Web (Self-Hosted)

Best for teams sharing access through a browser.

```bash
# Start both frontend and backend
npm run dev

# Or individually:
npm run dev:backend   # Terminal 1
npm run dev:frontend  # Terminal 2
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

---

### Option 3: Docker

Best for isolated, consistent environments.

```bash
# Using docker compose
docker compose -f deploy/docker-compose.yml up --build -d

# Or use convenience scripts:
./scripts/run-docker.sh      # Linux/macOS
scripts\run-docker.bat       # Windows
```

**Services:**
| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Web UI |
| Backend | http://localhost:3000 | API server |
| Redis | localhost:6379 | Cache & queue |

---

### Option 4: CLI

Best for automation and terminal-first workflows.

```bash
# Install globally
npm install -g @g-rump/cli

# Configure
grump config set apiUrl http://localhost:3000

# Authenticate (if required)
grump auth login

# Ship your first project!
grump ship "Build a todo app with authentication"
```

See [CLI.md](./CLI.md) for full CLI reference.

---

## Configuration

### AI Provider Setup

G-Rump supports multiple AI providers. Choose **ONE** of the following:

#### NVIDIA NIM (Recommended)

NVIDIA NIM provides GPU-accelerated inference with Nemotron and other models.

1. Visit [build.nvidia.com](https://build.nvidia.com/)
2. Create an account or sign in
3. Generate an API key (starts with `nvapi-`)

```bash
# Add to backend/.env
echo "NVIDIA_NIM_API_KEY=nvapi-your-key" >> backend/.env
```

#### OpenRouter

Multi-model access with pay-as-you-go pricing.

1. Visit [openrouter.ai](https://openrouter.ai/)
2. Sign up and create a key (starts with `sk-or-v1-`)

```bash
echo "OPENROUTER_API_KEY=sk-or-v1-your-key" >> backend/.env
```

#### Groq

Ultra-fast inference.

```bash
echo "GROQ_API_KEY=gsk-your-key" >> backend/.env
```

#### Ollama (Local)

Run models locally for offline use.

```bash
# Install Ollama: https://ollama.com
ollama pull llama3.1

# Configure G-Rump
echo "OLLAMA_URL=http://localhost:11434" >> backend/.env
```

### Environment Variables

Key configuration options in `backend/.env`:

```env
# AI Provider (choose ONE)
NVIDIA_NIM_API_KEY=nvapi-your-key
# OPENROUTER_API_KEY=sk-or-v1-your-key
# GROQ_API_KEY=gsk-your-key

# Server Configuration
NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Database (SQLite for dev)
DB_TYPE=sqlite
DB_PATH=./data/grump.db

# Redis (optional, enables caching & queues)
REDIS_HOST=localhost
REDIS_PORT=6379

# Security (enable in production)
# REQUIRE_AUTH_FOR_API=true
# BLOCK_SUSPICIOUS_PROMPTS=true
```

See `.env.example` for complete configuration options.

---

## Your First Project

### Step 1: Launch G-Rump

Start the desktop app or open the web interface at http://localhost:5173

### Step 2: Describe Your Project

Enter a natural language description:

> "Build a todo app with user authentication, real-time sync between devices, and a clean dashboard with progress charts"

### Step 3: Generate Architecture

Click **Generate Architecture** to create a system diagram.

G-Rump will generate:
- **C4 Diagram** - Component-level architecture
- **Tech Stack** - Recommended technologies
- **Data Flow** - How components interact

### Step 4: Generate PRD

Click **Generate PRD** to create a Product Requirements Document including:
- Feature specifications
- User stories
- API endpoints
- Data models
- Acceptance criteria

### Step 5: Generate Code

Select your tech stack and click **Generate Code**.

G-Rump orchestrates multiple agents:

| Agent | Responsibility |
|-------|---------------|
| **Architect** | Validates PRD and creates generation plan |
| **Frontend** | Generates UI components, routing, state |
| **Backend** | Creates APIs, database models, business logic |
| **DevOps** | Produces Docker, CI/CD configs |
| **Test** | Writes unit, integration, E2E tests |
| **Docs** | Creates README and setup guides |

### Step 6: Download

When complete, download your project as a ZIP file with everything needed to run.

---

## Next Steps

Now that you're up and running:

### Learn More

- **[HOW_IT_WORKS.md](./HOW_IT_WORKS.md)** - Understand the request pipeline
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Deep dive into system design
- **[API.md](./API.md)** - Full API reference
- **[AGENT_SYSTEM.md](./AGENT_SYSTEM.md)** - G-Agent capabilities

### Advanced Features

#### Intent-RAG Fusion

Enable intelligent document retrieval:

```bash
# Index your documents
curl -X POST http://localhost:3000/api/rag/index \
  -d '{"documents": [...], "namespace": "my-project"}'

# Query with intent-guided retrieval
curl -X POST http://localhost:3000/api/rag/query \
  -d '{"query": "How does auth work?", "intentGuided": true}'
```

See [INTENT_RAG_FUSION.md](./INTENT_RAG_FUSION.md).

#### Synthetic Data (NeMo Curator)

Generate training data for fine-tuning:

```bash
export NVIDIA_NIM_API_KEY=your_key
npm run data:synth
```

Output: `services/nemo-curator/data/synthetic_qa.jsonl`

---

## Troubleshooting

### "AI provider required" error

**Cause:** No API key configured

**Fix:** Add an API key to `backend/.env` and restart

### 401 Unauthorized

**Cause:** Authentication required or invalid credentials

**Fix:**
1. Check your API key is correct
2. If using `REQUIRE_AUTH_FOR_API=true`, sign in via the frontend

### Port already in use

**Fix:** The backend auto-finds the next available port. Check console output.

### "Disconnected" in frontend

**Cause:** Backend not running

**Fix:**
```bash
cd backend && npm run dev
```

### CORS errors

**Fix:** Add your origin to `CORS_ORIGINS` in `backend/.env`:

```env
CORS_ORIGINS=http://localhost:5173,https://your-domain.com
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/.env` | API keys and server configuration |
| `frontend/.env` | Optional custom API URL |
| `deploy/docker-compose.yml` | Docker deployment config |
| `scripts/run-docker.sh` | Quick Docker start (Unix) |
| `scripts/run-docker.bat` | Quick Docker start (Windows) |

---

## Getting Help

- 📖 [Documentation](./README.md)
- 🐛 [Issue Tracker](https://github.com/Aphrodine-wq/G-rump.com/issues)
- 💬 [Discussions](https://github.com/Aphrodine-wq/G-rump.com/discussions)

---

**Welcome to G-Rump! Happy building.** 🚀

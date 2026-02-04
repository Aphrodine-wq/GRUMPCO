# G-Rump

<p align="center">
  <img src="docs/assets/grump-logo.png" width="120" alt="G-Rump Logo" />
</p>

<p align="center">
  <strong>The AI Product Operating System</strong><br>
  Transform natural language into production-ready code with 18x faster builds and 60-70% cost savings
</p>

<p align="center">
  <a href="https://github.com/Aphrodine-wq/GRUMPCO/releases/tag/v1.0.0">
    <img src="https://img.shields.io/badge/version-2.1.0-blue.svg" alt="Version" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
  </a>
  <a href="https://github.com/Aphrodine-wq/GRUMPCO/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Aphrodine-wq/GRUMPCO/ci.yml?branch=main" alt="Build Status" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.3-blue.svg" alt="TypeScript" />
  </a>
  <a href="https://www.rust-lang.org/">
    <img src="https://img.shields.io/badge/Rust-1.77+-orange.svg" alt="Rust" />
  </a>
  <a href="https://svelte.dev/">
    <img src="https://img.shields.io/badge/Svelte-5-ff3e00.svg" alt="Svelte" />
  </a>
  <a href="https://www.electronjs.org/">
    <img src="https://img.shields.io/badge/Electron-28-47848F.svg" alt="Electron" />
  </a>
  <a href="https://build.nvidia.com/">
    <img src="https://img.shields.io/badge/NVIDIA-NIM-76B900.svg" alt="NVIDIA NIM" />
  </a>
</p>

<p align="center">
  <a href="#-quick-install">Quick Install</a> •
  <a href="#-features">Features</a> •
  <a href="#-demo-video">Demo</a> •
  <a href="#-documentation">Docs</a> •
  <a href="#-api-reference">API</a>
</p>

<p align="center">
  <a href="https://g-rump.com">
    <img src="https://img.shields.io/badge/🚀_Try_Live_Demo-g--rump.com-6366F1?style=for-the-badge" alt="Live Demo" />
  </a>
  &nbsp;
  <a href="https://github.com/Aphrodine-wq/GRUMPCO">
    <img src="https://img.shields.io/badge/⭐_Star_on_GitHub-181717?style=for-the-badge&logo=github" alt="Star on GitHub" />
  </a>
</p>

---

## 📸 Screenshots

<p align="center">
  <img src="docs/assets/screenshot-dashboard.png" width="800" alt="G-Rump Dashboard" />
  <br>
  <em>G-Rump Desktop App - Main Dashboard</em>
</p>

<p align="center">
  <img src="docs/assets/screenshot-architecture.png" width="800" alt="Architecture Generation" />
  <br>
  <em>AI-Generated Architecture Diagrams</em>
</p>

<p align="center">
  <img src="docs/assets/screenshot-code.png" width="800" alt="Code Generation" />
  <br>
  <em>Full-Stack Code Generation with Syntax Highlighting</em>
</p>

---

## 🎥 Demo Video

<p align="center">
  <a href="https://www.youtube.com/watch?v=YOUR_VIDEO_ID">
    <img src="docs/assets/video-thumbnail.png" width="800" alt="G-Rump Demo Video - Install in 30 Seconds" />
  </a>
  <br>
  <strong>🎬 Watch: "Install G-Rump in 30 Seconds"</strong>
</p>

---

## ⚡ Quick Install

Get started in under a minute:

```bash
# 1. Clone the repository
git clone https://github.com/Aphrodine-wq/GRUMPCO.git
cd GRUMPCO

# 2. Install dependencies
npm install

# 3. Build packages
npm run build:packages

# 4. Configure environment (optional - for real AI)
cp backend/.env.example backend/.env
# Get free API key at https://build.nvidia.com/

# 5. Launch! 🚀
cd backend && npm run dev &
cd ../frontend && npm run electron:dev
```

> 💡 **Mock Mode**: Run without any API keys for realistic placeholder responses!

### Alternative Installation Methods

**CLI (Global):**
```bash
npm install -g @g-rump/cli
grump ship "Create a React dashboard with real-time charts"
```

**Docker:**
```bash
docker run -it grump/cli:latest ship "Build a REST API with authentication"
```

---

## 🤔 What is G-Rump?

**G-Rump** is an AI-powered development platform that bridges the gap between business requirements and production-ready applications. Describe what you want to build in natural language, and G-Rump automatically generates:

- 🏗️ **Architecture diagrams** (Mermaid, C4, ERD)
- 📋 **Technical specifications** (PRDs)
- 💻 **Full-stack code** (frontend, backend, DevOps)
- 🧪 **Tests and documentation**

Think of it as **"Terraform for application development"** — Architecture-as-Code where your diagram and spec are the source of truth.

### 🏆 NVIDIA Golden Developer

G-Rump targets full NVIDIA ecosystem compliance:
- **NVIDIA NIM** inference (Nemotron, Llama, Mistral)
- **NGC-ready** cloud deployment (GCP/AWS)
- **NeMo Curator** synthetic data pipeline
- **NeMo Framework** fine-tuning
- **NIM-aligned** observability with OpenTelemetry

---

## ✨ Features

| Feature | Description | Impact |
|---------|-------------|--------|
| **🚀 18x Faster Builds** | SWC compiler + Rust intent parser | 45s → 2.5s |
| **💰 60-70% Cost Savings** | Intelligent LLM routing & 3-tier caching | Slash AI costs |
| **🤖 Multi-Agent System** | G-Agent orchestrates specialized agents | End-to-end automation |
| **🏗️ Architecture-First** | Design diagrams before code | Better planning |
| **🔒 Enterprise Security** | Built-in guardrails & compliance | Production-ready |
| **📊 Real-time Observability** | Prometheus + OpenTelemetry | Full visibility |

### Two Primary Modes

#### 1. Architecture Mode (Design-First)
```
Describe → Architecture (Mermaid) → Spec (PRD) → (optional) Code
```
Lead with the diagram; code is optional.

#### 2. Code Mode (Tool-Enabled)
AI-powered chat with workspace-aware tools:
- `bash_execute` - Run commands in sandboxed environment
- `file_read` / `file_write` / `file_edit` - File operations
- `list_directory` - Explore workspace
- `git_*` - Version control operations

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Clients
        CLI[CLI Tool]
        Desktop[Desktop App]
        VSCode[VS Code Extension]
        Docker[Docker]
        Bots[Telegram/Discord/SMS]
    end
    
    subgraph API
        Ship[/api/ship]
        Chat[/api/chat/stream]
        Codegen[/api/codegen]
        Agents[/api/agents]
        MCP[MCP Server]
    end
    
    subgraph Core
        Compiler[SWC/Rust Compiler]
        Cache[3-Tier Cache<br/>L1→L2→L3]
        Router[Smart Router]
        RAG[RAG Engine]
        Memory[Memory System]
    end
    
    subgraph Providers
        NIM[NVIDIA NIM]
        Kimi[Kimi K2.5]
        OpenRouter[OpenRouter]
        Groq[Groq]
        Ollama[Ollama Local]
    end
    
    Clients --> API
    API --> Core
    Router --> Providers
```

### Performance Optimizations

| Operation | Traditional | G-Rump | Improvement |
|-----------|-------------|--------|-------------|
| Backend Build | 45s | 2.5s | **18x faster** |
| Intent Parsing | 120ms | 8ms | **15x faster** |
| CLI Startup | 850ms | 45ms | **19x faster** |
| Docker Build | 180s | 25s | **7x faster** |

---

## 📖 Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](./docs/GETTING_STARTED.md) | Fastest path to first use |
| [Architecture](./docs/ARCHITECTURE.md) | System design deep dive |
| [API Reference](./docs/API.md) | Complete API documentation |
| [Agent System](./docs/AGENT_SYSTEM.md) | G-Agent orchestration |
| [Production](./docs/PRODUCTION.md) | Deployment guide |
| [Security](./docs/SECURITY.md) | Security configuration |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Common issues & fixes |
| [Contributing](./docs/legal/CONTRIBUTING.md) | Contribution guidelines |
| [Changelog](./CHANGELOG.md) | Version history |
| [Launch Materials](./docs/launch/) | Launch checklists and progress |
| [Reports](./docs/reports/) | Test reports and release notes |
| [Project Planning](./docs/project/) | Roadmaps and optimization plans |

---

## 🔌 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ship/start` | Start SHIP workflow |
| `POST` | `/api/chat/stream` | Streaming chat with tools |
| `POST` | `/api/codegen/start` | Start code generation |
| `POST` | `/api/architecture/generate` | Generate architecture diagram |
| `POST` | `/api/prd/generate` | Generate PRD document |
| `POST` | `/api/rag/query` | RAG-enhanced query |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

### Example: Start SHIP Workflow

```bash
curl -X POST http://localhost:3000/api/ship/start \
  -H "Content-Type: application/json" \
  -d '{
    "projectDescription": "Build a todo app with user authentication",
    "preferences": {
      "techStack": ["React", "Node.js", "PostgreSQL"]
    }
  }'
```

**Response:**
```json
{
  "sessionId": "ship-abc123",
  "phase": "design",
  "status": "pending",
  "createdAt": "2026-01-31T12:00:00Z"
}
```

See [docs/API.md](./docs/API.md) for complete reference.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Desktop** | Electron 28, Svelte 5, Vite 5, TailwindCSS 3.4 |
| **Frontend** | TypeScript 5.3, Mermaid.js, Shiki |
| **Backend** | Node.js 20+, Express 5, TypeScript, SWC, Pino |
| **Compiler** | Rust 1.77+, rayon, SIMD (AVX2/AVX-512), WASM |
| **AI/ML** | NVIDIA NIM, Kimi K2.5, OpenRouter, Groq, Ollama |
| **Database** | SQLite (dev), PostgreSQL/Supabase (prod) |
| **Queue** | BullMQ, Redis |
| **Infrastructure** | Docker, Kubernetes, NGC (GCP/AWS) |
| **Observability** | Prometheus, OpenTelemetry, Grafana, Pino |

---

## 🏁 Monorepo Structure

```
grump/
├── frontend/              # Svelte 5 + Electron desktop
├── backend/               # Express 5 API server
├── packages/
│   ├── ai-core/          # Model router & registry
│   ├── cli/              # @g-rump/cli
│   ├── shared-types/     # Shared TypeScript types
│   ├── rag/              # RAG engine
│   ├── voice/            # Voice ASR/TTS
│   ├── memory/           # Conversation memory
│   ├── kimi/             # Kimi K2.5 optimizations
│   └── vscode-extension/ # VS Code extension
├── intent-compiler/       # Rust NL→JSON parser
├── services/
│   ├── nemo-curator/     # Synthetic data pipeline
│   └── nemo-training/    # Fine-tuning service
├── deploy/                # Docker, K8s, NGC configs
├── docs/                  # Documentation
└── marketing/             # Launch materials
```

---

## 🧪 Development

```bash
# Run all checks
npm run check-all

# Run tests
npm test

# Run benchmarks
cd intent-compiler && cargo bench
cd backend && npm run load-test
```

---

## 🚀 Deployment

### Docker

```bash
docker compose -f deploy/docker-compose.yml up -d
```

### NGC-Ready Cloud (GCP/AWS)

```bash
# GCP
cd deploy/ngc/gcp && ./provision.sh && ./deploy.sh

# AWS
cd deploy/ngc/aws && ./provision.sh && ./deploy.sh
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./docs/legal/CONTRIBUTING.md) for guidelines.

```bash
git checkout -b feature/amazing-feature
npm run check-all
npm test
# Submit PR
```

---

## 📄 License

[MIT](./LICENSE)

---

## 💬 Support

- 🐛 [Report Issues](https://github.com/Aphrodine-wq/GRUMPCO/issues)
- 💡 [Request Features](https://github.com/Aphrodine-wq/GRUMPCO/discussions)
- 📧 Email: support@g-rump.com
- 💬 Discord: [Join Community](https://discord.gg/grump)

---

<div align="center">

**[⬆ Back to Top](#g-rump)**

Made with ❤️ by the G-Rump Team

[![GitHub Stars](https://img.shields.io/github/stars/Aphrodine-wq/GRUMPCO?style=social)](https://github.com/Aphrodine-wq/GRUMPCO)

</div>

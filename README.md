<p align="center">
  <img src="docs/assets/grump-logo.svg" width="120" alt="G-Rump AI Development Platform Logo - AI-powered code generation and architecture design" />
</p>

<h1 align="center">G-Rump - Enterprise AI Development Platform</h1>

<p align="center">
  <strong>NVIDIA-optimized AI platform delivering 18x faster builds, 60-70% LLM cost reduction, and enterprise-grade performance</strong>
</p>

<p align="center">
  <a href="https://g-rump.com">🌐 Website</a> •
  <a href="https://github.com/Aphrodine-wq/G-rump.com/releases">⬇️ Download</a> •
  <a href="https://docs.g-rump.com">📚 Documentation</a> •
  <a href="https://www.npmjs.com/package/@g-rump/cli">📦 NPM</a> •
  <a href="https://hub.docker.com/r/grump/cli">🐳 Docker</a>
</p>

## 🚀 Overview

**G-Rump** is an AI-powered development platform that transforms natural language into production-ready applications. Built with enterprise-grade architecture and optimized by NVIDIA-level engineering practices, G-Rump delivers unprecedented speed and cost efficiency for modern software development teams.

### Key Benefits
- ⚡ **18x Faster Compilation** via SWC compiler (45s → 2.5s build times)
- 💰 **60-70% Cost Savings** through intelligent LLM routing and caching
- 🚀 **NVIDIA GPU Acceleration** for inference and embeddings
- 🛡️ **Enterprise Security** with built-in guardrails and monitoring
- 🔧 **Multi-Platform Support**: Windows, macOS, Linux, Docker, Web

## ✨ Features

- **Lightning-Fast Builds**: SWC compiler (18x faster than TypeScript)
- **GPU Acceleration**: NVIDIA NIM integration for embeddings and inference
- **Cost Optimization**: Smart model routing saves 60-70% on LLM costs
- **Multi-Tier Caching**: L1/L2/L3 cache hierarchy with 50%+ hit rate
- **Parallel Processing**: Worker threads and Rust with rayon
- **SIMD Optimizations**: AVX2/AVX-512 accelerated text processing
- **Real-Time Analytics**: Comprehensive cost tracking and performance monitoring

## 📦 Installation Options

Choose the deployment method that fits your workflow:

### 🖥️ Desktop Application (Recommended)
**Best for**: Individual developers, offline work, maximum performance
```bash
# Windows - Download portable .exe
# Linux - AppImage or package manager
# macOS - Universal binary (Coming Q1 2026)
```
[Download Latest Release](https://github.com/Aphrodine-wq/G-rump.com/releases)

### 🐳 Docker Container
**Best for**: CI/CD pipelines, server deployment, isolated environments
```bash
docker run -it grump/cli:latest ship "Build a REST API with authentication"
```
[View on Docker Hub](https://hub.docker.com/r/grump/cli)

### 📟 Command Line Interface (CLI)
**Best for**: Terminal workflows, automation, scripting
```bash
npm install -g @g-rump/cli
grump ship "Create a React component library"
```
[View on NPM](https://www.npmjs.com/package/@g-rump/cli)

### 🌐 Web Platform
**Best for**: Browser-based development, collaboration, quick access
Visit [app.g-rump.com](https://app.g-rump.com) to get started instantly.

<details>
<summary>📖 Need detailed setup instructions?</summary>

See our comprehensive guides:
- [Getting Started Guide](docs/GETTING_STARTED.md) - Step-by-step setup
- [Linux Setup](docs/LINUX_SETUP.md) - WSL2 and native Linux optimization
- [macOS Setup](docs/MACOS_APP.md) - macOS-specific configuration
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md) - Enterprise deployment
</details>

## 🚀 Quick Start Guide

Get G-Rump running locally in under 5 minutes:

### Prerequisites

| Requirement | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | Runtime environment |
| Rust | 1.77+ | Intent compiler (optional) |
| Docker | Latest | Containerized deployment (optional) |

### Installation from Source

```bash
# 1. Clone the monorepo
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# 2. Install dependencies
npm install

# 3. Build backend with SWC (18x faster compilation)
cd backend
npm run build

# 4. Build Windows desktop app (Electron)
cd ../frontend
npm run build
npm run electron:build

# 5. Build Rust intent compiler (optional, for maximum performance)
cd ../intent-compiler
cargo build --release
```

### Running G-Rump

**Development Mode:**
```bash
# Backend API server
cd backend && npm run dev

# Desktop application
cd frontend && npm run electron:dev

# Web platform
cd web && npm run dev
```

**Production Mode:**
```bash
# Backend
cd backend && npm start

# Docker (recommended for servers)
docker-compose up -d
```

**Quick Test:**
```bash
# Verify installation
grump ship "Create a hello world Express API"
```

## 📊 Performance Benchmarks & ROI

### Compilation Speed Comparison

| Operation | Traditional | G-Rump | Improvement |
|-----------|-------------|--------|-------------|
| **Backend Build** | 45s | 2.5s | **18x faster** |
| **Intent Parsing** | 120ms | 8ms | **15x faster** |
| **CLI Startup** | 850ms | 45ms | **19x faster** |
| **Docker Build** | 180s | 25s | **7x faster** |

### AI Cost Optimization

**How G-Rump Reduces Your AI Infrastructure Costs:**

- 🗄️ **Intelligent Caching** - 40% cost reduction via L1/L2/L3 cache hierarchy (50%+ hit rate)
- 🧠 **Smart Model Routing** - 30% savings through automatic LLM selection (Kimi, NVIDIA NIM, OpenRouter)
- ⚙️ **Infrastructure Optimization** - 25% reduction via parallel processing and SIMD optimizations

**💰 Total Cost Savings: 60-70%**

### Real-World ROI Example

```
Monthly AI Infrastructure Costs:
├─ Before G-Rump:    $3,600/month
├─ After G-Rump:     $1,625/month
└─ Annual Savings:   $23,700/year

Payback Period: Immediate (free tier available)
Break-even: Day 1
```

**[View detailed performance guide →](docs/PERFORMANCE_GUIDE.md)**

## Architecture

```mermaid
graph TB
    subgraph clients [Client Layer]
        CLI[CLI Tool<br/>Windows/Linux/macOS]
        Desktop[Desktop App<br/>Electron]
        Docker[Docker Container<br/>Linux Primary]
    end
    
    subgraph api [API Layer - Express]
        Ship[/ship]
        Chat[/chat]
        Plan[/plan]
        Codegen[/codegen]
        RAG[/rag]
        Agents[/agents]
    end
    
    subgraph agentlightning [AgentLightning Core]
        LitAgent[LitAgent<br/>Base Agent]
        Runner[AgentRunner<br/>Execution]
        Store[LightningStore<br/>SQLite/MongoDB]
        
        subgraph guardrails [Safety Guardrails]
            ContentFilter[Content Filter]
            PromptGuard[Prompt Guard]
            RateLimiter[Rate Limiter]
            UserMonitor[User Monitor]
        end
        
        subgraph eval [Evaluation System]
            Evaluator[Evaluator]
            Benchmarks[Benchmarks]
            Scorers[Scorers]
        end
    end
    
    subgraph ship [SHIP Workflow]
        Spec[Spec] --> Hypothesis[Hypothesis]
        Hypothesis --> Implement[Implement]
        Implement --> Prove[Prove]
    end
    
    subgraph compiler [Compiler Layer]
        SWC[SWC Compiler<br/>18x faster]
        Rust[Rust Parser<br/>15x faster]
        WASM[WASM Module<br/>19x faster]
    end
    
    subgraph runtime [Runtime Layer]
        Workers[Worker Threads]
        Cache[3-Tier Cache<br/>50% hit rate]
        SmartRouter[Smart Router<br/>48% savings]
    end
    
    subgraph infra [Infrastructure]
        NIM[NVIDIA NIM GPU]
        Kimi[Kimi K2.5]
        OpenRouter[OpenRouter]
        Redis[Redis Cluster]
        Metrics[Cost Tracking]
    end
    
    CLI --> api
    Desktop --> api
    Docker --> api
    
    api --> agentlightning
    agentlightning --> ship
    
    Runner --> guardrails
    Runner --> eval
    
    ship --> compiler
    compiler --> runtime
    
    SmartRouter --> NIM
    SmartRouter --> Kimi
    SmartRouter --> OpenRouter
    runtime --> Redis
    runtime --> Metrics
```

## Key Technologies

- **Desktop App**: Electron, Svelte 5, Vite, TailwindCSS (Windows primary, macOS coming)
- **Backend**: Express, TypeScript (compiled with SWC)
- **AgentLightning**: Python agent framework with guardrails and eval
- **Compiler**: Rust with rayon, LTO, SIMD
- **Runtime**: Worker threads, multi-tier caching
- **LLM**: NVIDIA NIM, Kimi K2.5, OpenRouter (multi-model routing)
- **Infrastructure**: Docker (Linux), Redis, SQLite/MongoDB
- **Monitoring**: Prometheus, OpenTelemetry, AgentOps

## Security

For production deployments, see [Production Checklist](./docs/PRODUCTION_CHECKLIST.md) and the [Security Baseline](./docs/SECURITY_BASELINE.md). When the API is reachable by untrusted users you **must** set `BLOCK_SUSPICIOUS_PROMPTS=true`, `REQUIRE_AUTH_FOR_API=true`, and enable `SECURITY_STRICT_PROD=true` so the required security gates are enforced. Webhook secrets (`GRUMP_WEBHOOK_SECRET`, `TWILIO_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`) are required in production for the features that use them. Security scan endpoints (`/api/security/*`) validate `workspacePath` against an allowed root (`SECURITY_SCAN_ROOT`).

## Documentation

- **[Docs Index](./docs/README.md)** - Central documentation hub
- **[Getting Started](./docs/GETTING_STARTED.md)** - Fastest path to first use
- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture and design
- **[Codebase Map](./docs/CODEBASE.md)** - Repository structure and entry points
- **[API Reference](./docs/API.md)** - Complete API documentation
- **[Quick Reference](./docs/QUICK_REFERENCE.md)** - Command cheat sheet
- **[Performance Guide](./docs/PERFORMANCE_GUIDE.md)** - Optimization details
- **[Production Checklist](./docs/PRODUCTION_CHECKLIST.md)** - Deployment readiness
- **[Roadmap](./docs/ROADMAP.md)** - Future plans and enhancements

## CLI Usage

```bash
# Install CLI globally
npm install -g grump-cli

# Or use from source
cd packages/cli
npm run build
npm link

# Commands
grump ship --message "Build a todo app"
grump ship-parallel --messages "App 1,App 2,App 3"
grump plan --message "Add authentication"
grump analyze --workspace . --output arch.mmd
grump cache-clear
```

## Cost Dashboard

Access real-time cost analytics at `http://localhost:5173/cost-dashboard`

**Features:**
- Real-time cost tracking
- Budget alerts
- Cost breakdown by model/operation
- Optimization recommendations
- Savings visualization

## API Endpoints

### Core
- `POST /api/chat/stream` - Chat with AI
- `POST /api/ship/start` - Start SHIP workflow
- `POST /api/plan/generate` - Generate plan
- `POST /api/analyze/architecture` - Analyze codebase

### Cost & Analytics
- `GET /api/cost/summary` - Cost summary
- `GET /api/cost/budget` - Budget status
- `POST /api/cost/budget` - Set budget
- `GET /api/cost/recommendations` - Optimization tips
- `GET /api/cost/stats` - System statistics

### Monitoring
- `GET /metrics` - Prometheus metrics
- `GET /health` - Health check

## Development

```bash
# Run tests
npm test

# Run benchmarks
cd intent-compiler && cargo bench
cd backend && npm run load-test

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format
```

## Deployment

### Docker

```bash
# Build optimized images
bash scripts/build-docker-optimized.sh

# Deploy with compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### Linux (Systemd)

See [Linux Setup Guide](./docs/LINUX_SETUP.md) for systemd service configuration.

### Vercel

```bash
cd backend
vercel deploy --prod
```

## Performance Monitoring

### Real-Time Metrics

```bash
# Cost metrics
curl http://localhost:3000/api/cost/realtime

# Performance snapshot
curl http://localhost:3000/api/cost/stats

# Prometheus metrics
curl http://localhost:3000/metrics
```

### Grafana Dashboard

Import the included Grafana dashboard for visualization:
- Cost over time
- Cache hit rates
- API latency (p50, p95, p99)
- Worker pool utilization
- GPU utilization (if available)

### Agent Overwatch (AgentLightning)

Run the local AgentLightning store and set `OTLP_ENDPOINT` to collect OpenTelemetry traces for agent runs. See `docs/AGENTLIGHTNING.md` for setup.

## License

MIT

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help makes G-Rump better for everyone.

**Quick Contribution Guide:**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and run quality checks: `npm run check-all`
4. Run tests: `npm test`
5. Submit a pull request

**📖 Detailed guidelines:** [CONTRIBUTING.md](./CONTRIBUTING.md)

## ❓ Frequently Asked Questions

**Q: What makes G-Rump different from other AI coding assistants?**
A: G-Rump focuses on enterprise-grade performance with 18x faster builds, 60-70% cost savings through intelligent caching and model routing, and comprehensive safety guardrails for production deployments.

**Q: Can I use G-Rump for commercial projects?**
A: Yes! G-Rump is open-source (MIT license) and offers both free and paid tiers for commercial use.

**Q: Does G-Rump require an internet connection?**
A: The desktop app can work offline for code generation. Cloud features like advanced model inference require connectivity.

**Q: What programming languages does G-Rump support?**
A: G-Rump generates code in TypeScript, JavaScript, Python, Rust, Go, and more. The platform is language-agnostic.

**Q: How does G-Rump ensure code quality?**
A: Through multi-agent coordination, automated testing generation, architecture validation, and built-in evaluation systems.

## 🏆 Acknowledgments & Tech Stack

G-Rump is built with enterprise-grade engineering practices inspired by NVIDIA's optimization methodologies:

| Layer | Technologies |
|-------|-------------|
| **Compiler** | SWC (Rust-based), 18x faster than TypeScript |
| **Runtime** | Node.js 20+, Worker Threads, SIMD (AVX2/AVX-512) |
| **AI/ML** | NVIDIA NIM, Kimi K2.5, OpenRouter, Multi-model routing |
| **Storage** | Redis Cluster, SQLite, MongoDB |
| **Monitoring** | Prometheus, Grafana, OpenTelemetry, AgentOps |
| **Desktop** | Electron, Svelte 5, Vite |
| **Container** | Docker, Docker Compose |

---

<div align="center">

**[⬆ Back to Top](#g-rump---enterprise-ai-development-platform)**

Made with ❤️ by the G-Rump Team

[![GitHub stars](https://img.shields.io/github/stars/Aphrodine-wq/G-rump.com?style=social)](https://github.com/Aphrodine-wq/G-rump.com/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Aphrodine-wq/G-rump.com?style=social)](https://github.com/Aphrodine-wq/G-rump.com/network/members)

</div>

<!-- SEO Keywords: AI development platform, code generation, SWC compiler, GPU acceleration, NVIDIA NIM, LLM optimization, full-stack development, natural language programming, enterprise AI tools, automated coding, developer productivity, AI programming assistant -->

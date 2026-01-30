<div align="center">

<img src="docs/assets/grump-logo.svg" width="160" alt="G-Rump Logo - Grumpy AI Development Platform" />

# G-Rump

### Enterprise AI Development Platform

**Transform natural language into production-ready code with 18x faster builds and 60-70% cost savings**

[![GitHub Stars](https://img.shields.io/github/stars/Aphrodine-wq/G-rump.com?style=for-the-badge&logo=github)](https://github.com/Aphrodine-wq/G-rump.com/stargazers)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)
[![NPM](https://img.shields.io/npm/v/@g-rump/cli?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@g-rump/cli)

---

[Website](https://g-rump.com) | [Download](https://github.com/Aphrodine-wq/G-rump.com/releases) | [Documentation](https://docs.g-rump.com) | [NPM](https://www.npmjs.com/package/@g-rump/cli) | [Docker](https://hub.docker.com/r/grump/cli)

</div>

---

## Overview

**G-Rump** is an AI-powered development platform that transforms natural language into production-ready applications. Built with enterprise-grade architecture and optimized by NVIDIA-level engineering practices.

<div align="center">

| Feature | Benefit |
|:-------:|:-------:|
| **18x Faster Builds** | SWC compiler (45s → 2.5s) |
| **60-70% Cost Savings** | Intelligent LLM routing & caching |
| **GPU Acceleration** | NVIDIA NIM integration |
| **Enterprise Security** | Built-in guardrails & monitoring |
| **Multi-Platform** | Windows, macOS, Linux, Docker, Web |

</div>

---

## Quick Start

### Desktop Application (Recommended)

Download the latest release for your platform:

```bash
# Windows - Portable executable available
# Linux - AppImage or package manager
# macOS - Universal binary (Coming Q1 2026)
```

[**Download Latest Release**](https://github.com/Aphrodine-wq/G-rump.com/releases)

### Command Line Interface

```bash
npm install -g @g-rump/cli
grump ship "Create a React component library"
```

### Docker

```bash
docker run -it grump/cli:latest ship "Build a REST API with authentication"
```

### Web Platform

Visit [**app.g-rump.com**](https://app.g-rump.com) to get started instantly.

---

## Installation from Source

```bash
# Clone the repository
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# Install dependencies
npm install

# Build and run
cd backend && npm run build && npm start

# Or run the desktop app
cd frontend && npm run electron:dev
```

### Prerequisites

| Requirement | Version | Purpose |
|:-----------:|:-------:|:-------:|
| Node.js | 20+ | Runtime |
| Rust | 1.77+ | Intent compiler (optional) |
| Docker | Latest | Containerized deployment |

---

## Performance

<div align="center">

| Operation | Traditional | G-Rump | Improvement |
|:---------:|:-----------:|:------:|:-----------:|
| Backend Build | 45s | 2.5s | **18x faster** |
| Intent Parsing | 120ms | 8ms | **15x faster** |
| CLI Startup | 850ms | 45ms | **19x faster** |
| Docker Build | 180s | 25s | **7x faster** |

</div>

### Cost Optimization

- **Intelligent Caching**: 40% cost reduction via L1/L2/L3 cache (50%+ hit rate)
- **Smart Model Routing**: 30% savings through automatic LLM selection
- **Infrastructure Optimization**: 25% reduction via parallel processing & SIMD

**Total Savings: 60-70%**

---

## Architecture

```mermaid
graph TB
    subgraph Clients
        CLI[CLI Tool]
        Desktop[Desktop App]
        Docker[Docker]
    end
    
    subgraph API
        Ship[/ship]
        Chat[/chat]
        Codegen[/codegen]
    end
    
    subgraph Core
        Compiler[SWC/Rust Compiler]
        Cache[3-Tier Cache]
        Router[Smart Router]
    end
    
    subgraph Providers
        NIM[NVIDIA NIM]
        Kimi[Kimi K2.5]
        OpenRouter[OpenRouter]
    end
    
    Clients --> API
    API --> Core
    Router --> Providers
```

---

## Key Technologies

<div align="center">

| Layer | Technologies |
|:-----:|:------------:|
| **Desktop** | Electron, Svelte 5, Vite, TailwindCSS |
| **Backend** | Express, TypeScript, SWC |
| **Compiler** | Rust, rayon, SIMD (AVX2/AVX-512) |
| **AI/ML** | NVIDIA NIM, Kimi K2.5, OpenRouter |
| **Infrastructure** | Docker, Redis, SQLite/MongoDB |
| **Monitoring** | Prometheus, OpenTelemetry, Grafana |

</div>

---

## Documentation

<div align="center">

| Guide | Description |
|:-----:|:-----------:|
| [Getting Started](./docs/GETTING_STARTED.md) | Fastest path to first use |
| [Architecture](./docs/ARCHITECTURE.md) | System design |
| [API Reference](./docs/API.md) | Complete API docs |
| [Performance Guide](./docs/PERFORMANCE_GUIDE.md) | Optimization details |
| [Production Checklist](./docs/PRODUCTION_CHECKLIST.md) | Deployment readiness |

</div>

---

## Security

For production deployments, see [Production Checklist](./docs/PRODUCTION_CHECKLIST.md) and [Security Baseline](./docs/SECURITY_BASELINE.md).

Required environment variables for production:
- `BLOCK_SUSPICIOUS_PROMPTS=true`
- `REQUIRE_AUTH_FOR_API=true`
- `SECURITY_STRICT_PROD=true`

---

## CLI Usage

```bash
grump ship --message "Build a todo app"
grump ship-parallel --messages "App 1,App 2,App 3"
grump plan --message "Add authentication"
grump analyze --workspace . --output arch.mmd
grump cache-clear
```

---

## Development

```bash
# Run tests
npm test

# Run benchmarks
cd intent-compiler && cargo bench
cd backend && npm run load-test

# Type checking & linting
npm run type-check
npm run lint
```

---

## Deployment

### Docker

```bash
bash scripts/build-docker-optimized.sh
docker-compose up -d
```

### Vercel

```bash
cd backend && vercel deploy --prod
```

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Quick contribution guide
git checkout -b feature/amazing-feature
npm run check-all
npm test
# Submit PR
```

---

## FAQ

**Q: What makes G-Rump different?**
A: Enterprise-grade performance with 18x faster builds, 60-70% cost savings, and comprehensive safety guardrails.

**Q: Can I use it commercially?**
A: Yes! MIT license with free and paid tiers.

**Q: Does it work offline?**
A: Desktop app works offline for code generation. Cloud features require connectivity.

**Q: What languages are supported?**
A: TypeScript, JavaScript, Python, Rust, Go, and more.

---

## License

MIT

---

<div align="center">

**[Back to Top](#g-rump)**

Made with care by the G-Rump Team

[![GitHub Stars](https://img.shields.io/github/stars/Aphrodine-wq/G-rump.com?style=social)](https://github.com/Aphrodine-wq/G-rump.com/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Aphrodine-wq/G-rump.com?style=social)](https://github.com/Aphrodine-wq/G-rump.com/network/members)

</div>

# Documentation Index

> **Version:** 2.1.0 | **Complete documentation for the G-Rump platform**

Welcome to the G-Rump documentation! This index will help you find what you need.

---

## 🚀 Quick Start

New to G-Rump? Start here:

| Document | Description | Time |
|----------|-------------|------|
| [README.md](../README.md) | Project overview and quick start | 5 min |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Detailed setup instructions | 10 min |
| [FAQ.md](./FAQ.md) | Common questions and answers | 15 min |

---

## 📚 Core Documentation

### For Users

| Document | Description |
|----------|-------------|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Installation and first steps |
| [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) | Understanding the platform |
| [CLI.md](./CLI.md) | Command-line interface reference |
| [FAQ.md](./FAQ.md) | Frequently asked questions |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |

### For Developers

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design and architecture |
| [API.md](./API.md) | Complete API reference |
| [AGENT_SYSTEM.md](./AGENT_SYSTEM.md) | G-Agent orchestration |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Development workflow |
| [CONTRIBUTING.md](./legal/CONTRIBUTING.md) | Contribution guidelines |

### For Operators

| Document | Description |
|----------|-------------|
| [PRODUCTION.md](./PRODUCTION.md) | Production deployment guide |
| [SECURITY.md](./SECURITY.md) | Security configuration |
| [GPU_DEPLOYMENT.md](./GPU_DEPLOYMENT.md) | GPU deployment guide |
| [NVIDIA_GOLDEN_DEVELOPER.md](./NVIDIA_GOLDEN_DEVELOPER.md) | NVIDIA ecosystem setup |
| [NVIDIA_OBSERVABILITY.md](./NVIDIA_OBSERVABILITY.md) | Observability configuration |

---

## 📖 Documentation by Topic

### Architecture & Design

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) - Request pipeline and flows
- [AGENT_SYSTEM.md](./AGENT_SYSTEM.md) - Multi-agent orchestration
- [INTENT_RAG_FUSION.md](./INTENT_RAG_FUSION.md) - Intent-guided RAG
- [adr/](./adr/) - Architecture Decision Records

### API & Integration

- [API.md](./API.md) - Complete API reference
- [CLI.md](./CLI.md) - CLI documentation
- [INTEGRATIONS.md](./INTEGRATIONS.md) - Third-party integrations
- [BACKENDS.md](./BACKENDS.md) - Backend configuration

### Deployment & Operations

- [PRODUCTION.md](./PRODUCTION.md) - Production readiness
- [SECURITY.md](./SECURITY.md) - Security hardening
- [GPU_DEPLOYMENT.md](./GPU_DEPLOYMENT.md) - GPU deployment
- [deploy/ngc/](../deploy/ngc/) - NGC cloud deployment

### Development & Contributing

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Developer guide
- [CONTRIBUTING.md](./legal/CONTRIBUTING.md) - Contribution guidelines
- [CODE_OF_CONDUCT.md](./legal/CODE_OF_CONDUCT.md) - Community standards
- [TESTING.md](./TESTING.md) - Testing guide

### NVIDIA Ecosystem

- [NVIDIA_GOLDEN_DEVELOPER.md](./NVIDIA_GOLDEN_DEVELOPER.md) - Award submission
- [NVIDIA_OBSERVABILITY.md](./NVIDIA_OBSERVABILITY.md) - OTEL configuration
- [services/nemo-curator/](../services/nemo-curator/) - Synthetic data pipeline
- [services/nemo-training/](../services/nemo-training/) - Fine-tuning service

### Support & Troubleshooting

- [FAQ.md](./FAQ.md) - Frequently asked questions
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Troubleshooting guide
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) - Known limitations

### 📦 Launch & Releases

- [launch/](./launch/) - Launch checklists, progress, and readiness reports
- [reports/](./reports/) - Test reports and release notes
- [CHANGELOG.md](../CHANGELOG.md) - Version history and changes

### 📊 Project Planning

- [project/](./project/) - Roadmaps, optimization plans, and project documentation
- [ROADMAP.md](./ROADMAP.md) - Future development roadmap

---

## 🔗 Quick Reference

### Environment Variables

Key configuration files:
- `backend/.env.example` - Backend configuration template
- `frontend/.env.example` - Frontend configuration template

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start development servers |
| `npm run build` | Build for production |
| `npm test` | Run all tests |
| `npm run check-all` | Type-check and lint |

### Docker Commands

```bash
# Development
docker compose -f deploy/docker-compose.yml up -d

# Production
docker compose -f deploy/docker-compose.prod.yml up -d
```

---

## 📋 Documentation Standards

All documentation follows these conventions:

- **Markdown format** - All docs are Markdown files
- **Front matter** - Version and last updated at top
- **Table of contents** - Every doc has a TOC
- **Code examples** - Runnable code snippets where possible
- **Cross-references** - Links to related docs

---

## 🆘 Getting Help

Can't find what you're looking for?

- 📖 Check the [FAQ](./FAQ.md)
- 🐛 Search [GitHub Issues](https://github.com/Aphrodine-wq/G-rump.com/issues)
- 💬 Ask in [GitHub Discussions](https://github.com/Aphrodine-wq/G-rump.com/discussions)

---

## 📝 Contributing to Docs

Found an error or want to improve documentation?

1. Edit the relevant `.md` file
2. Follow existing formatting conventions
3. Submit a PR with `[docs]` prefix

See [CONTRIBUTING.md](./legal/CONTRIBUTING.md) for details.

---

**Last Updated:** February 2026

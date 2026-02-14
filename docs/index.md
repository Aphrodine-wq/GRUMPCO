# Welcome to the G-Rump Documentation

> **Version:** 2.1.0 | **Last Updated:** February 11, 2026

G-Rump is an AI-powered development platform that bridges the gap between business requirements and production-ready applications. Describe what you want to build in natural language, and G-Rump automatically generates:

- 🏗️ **Architecture diagrams** (Mermaid, C4, ERD)
- 📋 **Technical specifications** (PRDs)
- 💻 **Full-stack code** (frontend, backend, DevOps)
- 🧪 **Tests and documentation**

---

## 🚀 Getting Started

| Document | Description | Time |
|----------|-------------|------|
| [README.md](../README.md) | Project overview and quick start | 5 min |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Detailed setup instructions | 10 min |
| [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) | End-to-end flow | 5 min |
| [FAQ.md](./FAQ.md) | Common questions and answers | 15 min |

---

## 📚 Documentation by Audience

### For Users

| Document | Description |
|----------|-------------|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Installation and first steps |
| [OVERVIEW.md](./OVERVIEW.md) | Understanding the platform |
| [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) | Request pipeline and flows |
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
| [TESTING.md](./TESTING.md) | Testing guide |
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | Known limitations |

### For Operators

| Document | Description |
|----------|-------------|
| [PRODUCTION.md](./PRODUCTION.md) | Production deployment guide |
| [SECURITY.md](./SECURITY.md) | Security configuration |
| [SECURITY_BASELINE.md](./SECURITY_BASELINE.md) | Security baseline checks |
| [GPU_DEPLOYMENT.md](./GPU_DEPLOYMENT.md) | GPU and NVIDIA deployment |
| [RUNBOOK.md](./RUNBOOK.md) | Operational runbooks |

---

## 📖 By Topic

### Architecture & Design
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture overview
- [OVERVIEW.md](./OVERVIEW.md) — Request pipeline and flows
- [AGENT_SYSTEM.md](./AGENT_SYSTEM.md) — Multi-agent orchestration
- [INTENT_COMPILER.md](./INTENT_COMPILER.md) — Rust NL→JSON parser
- [INTENT_RAG_FUSION.md](./INTENT_RAG_FUSION.md) — Intent-guided RAG
- [adr/](./adr/) — Architecture Decision Records

### API & Integration
- [API.md](./API.md) — Complete API reference
- [CLI.md](./CLI.md) — CLI documentation
- [INTEGRATIONS.md](./INTEGRATIONS.md) — Third-party integrations
- [BACKENDS.md](./BACKENDS.md) — Backend configuration

### Deployment & Operations
- [PRODUCTION.md](./PRODUCTION.md) — Production readiness
- [SECURITY.md](./SECURITY.md) — Security hardening
- [GPU_DEPLOYMENT.md](./GPU_DEPLOYMENT.md) — GPU deployment
- [deploy/ngc/](../deploy/ngc/) — NGC cloud deployment
- [RUNBOOK.md](./RUNBOOK.md) — Operational recovery steps
- [RUNBOOK_REDIS.md](./RUNBOOK_REDIS.md) — Redis-specific runbook

### Development & Quality
- [DEVELOPMENT.md](./DEVELOPMENT.md) — Developer guide
- [TESTING.md](./TESTING.md) — Testing guide
- [TYPE_SCRIPT_BEST_PRACTICES.md](./TYPE_SCRIPT_BEST_PRACTICES.md) — TypeScript conventions
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — Known limitations
- [CHANGELOG.md](./CHANGELOG.md) — Version history

### Performance & Optimization
- [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md) — Performance tuning
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — Quick reference card

### NVIDIA Ecosystem
- [GPU_DEPLOYMENT.md](./GPU_DEPLOYMENT.md) — GPU deployment and NVIDIA NIM
- [services/nemo-curator/](../services/nemo-curator/) — Synthetic data pipeline
- [services/nemo-training/](../services/nemo-training/) — Fine-tuning service

---

## 📋 Releases

- [CHANGELOG.md](./CHANGELOG.md) — Version history and changes
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — Release readiness checklist
- [ROADMAP.md](./ROADMAP.md) — Future development roadmap

---

## 🔗 Quick Reference

### Environment Variables

Key configuration files:
- `backend/.env.example` — Backend configuration template (241 variables)
- `frontend/.env.example` — Frontend configuration template

### Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all dependencies |
| `npm run build:packages` | Build shared packages |
| `npm run dev` | Start development servers |
| `npm test` | Run all tests |
| `npm run check-all` | Type-check and lint |

---

## 🆘 Getting Help

- 📖 Check the [FAQ](./FAQ.md)
- 🔧 Check [TROUBLESHOOTING](./TROUBLESHOOTING.md)
- 🐛 Search [GitHub Issues](https://github.com/Aphrodine-wq/GRUMPCO/issues)
- 💬 Ask in [GitHub Discussions](https://github.com/Aphrodine-wq/GRUMPCO/discussions)

---

## 📁 Archives

Historical documentation that has been superseded or merged can be found in [archive/](archive/).

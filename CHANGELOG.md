# Changelog

All notable changes to G-Rump will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-01-31

### Added

#### NVIDIA Golden Developer Award Pivot (February 2026)
- **NGC-ready cloud deployment**: GCP and AWS provision/deploy scripts in `deploy/ngc/` (CPU and GPU T4 options)
- **NeMo Curator synthetic data**: Python pipeline in `services/nemo-curator/` for Q&A generation via Nemotron/NIM; `npm run data:synth`
- **NeMo Framework fine-tuning**: Example SFT/LoRA script in `services/nemo-training/` for NGC GPU
- **NVIDIA observability**: NIM-aligned metrics (TTFB, tokens/sec), OpenTelemetry span attributes (`nvidia.nim.*`), [NVIDIA_OBSERVABILITY.md](docs/NVIDIA_OBSERVABILITY.md)
- **Documentation**: [NVIDIA_GOLDEN_DEVELOPER.md](docs/NVIDIA_GOLDEN_DEVELOPER.md) with checklist compliance and demo script
- **RAG Integration**: Ask docs screen with types filter, hybrid search, workspace namespace, document upload/reindex
- **Chat RAG Context**: Optional RAG context injection in main chat for tailored results
- RAG onboarding slide and discoverability improvements
- VS Code extension package with chat, SHIP workflow, and code intelligence
- Compiler-enhanced package with incremental compilation
- Infrastructure directory for Terraform and cloud configs
- API directory for OpenAPI specs and schemas
- Extended AI provider support (Groq, Ollama)
- Free Agent mode for autonomous AI task execution
- Google OAuth authentication flow
- Slack and Discord bot integrations
- MCP (Model Context Protocol) client support
- Messaging service with credit system
- Model picker UI component with provider icons
- Docker setup wizard for local deployment
- Troubleshooting wizard component
- Skills screen for managing AI capabilities
- Observability stack (Prometheus, Grafana dashboards)
- HAProxy configuration for load balancing
- ROCm Docker compose for AMD GPU support
- k6 load testing integration in CI
- Kubernetes manifests for production-scale deployments
- CSP reporting endpoint for security monitoring
- WAF configuration documentation
- G-Agent evaluation suite with LLM-as-judge

### Changed
- Upgraded to Express 5 with TypeScript improvements
- Updated monorepo version to 2.1.0
- Reorganized `web/` directory to `app-dashboard/`
- Upgraded backend test coverage thresholds to 50%
- ESLint now errors on `@typescript-eslint/no-explicit-any`
- Format check is now blocking in CI pipeline
- Refactored backend index.ts with grouped route modules
- Enhanced cookie security with explicit httpOnly, secure, sameSite settings
- Improved architecture diagrams to include all providers and features
- Updated documentation to sync with current codebase structure
- Streamlined documentation with clear navigation

### Removed
- Obsolete electron package files (consolidated into frontend/electron)
- Legacy monitoring folder (moved to observability/)
- Duplicate frontend/frontend directory

### Fixed
- Cookie security settings now explicitly configured
- CSP reporting now enabled for violation monitoring
- Workspace configuration includes packages/cli

### Security
- Added SECURITY.md with vulnerability reporting guidelines
- Enhanced cookie security (httpOnly, secure, sameSite=strict)
- Added CSP report-uri for violation collection
- Documented WAF configuration for production

## [2.0.0] - 2026-01-15

### Added
- G-Agent system with autonomous code generation capabilities
- G-Agent quality assurance and auto-fixes
- G-Agent work reports generation
- 3-tier caching system (L1 LRU, L2 Redis, L3 Disk)
- Cost-aware model routing via `@grump/ai-core`
- BullMQ job queue integration
- Redis support for rate limiting and caching
- Supabase authentication integration
- Stripe billing integration
- Webhook system (inbound triggers and outbound events)
- SSE event streaming for real-time updates
- Code mode with tool-enabled chat (bash, file ops, git)
- Workspace-scoped tool execution
- Plan mode for code generation planning
- G-Agent profiles (General, Router, Frontend, Backend, DevOps, Test)
- Session save/load for Code mode
- NVIDIA NIM acceleration and batching

### Changed
- Upgraded to Express 5
- Backend version bumped to 2.0.0
- Frontend version bumped to 2.0.0
- Improved architecture with separated concerns
- Enhanced error handling and logging
- Better TypeScript strict mode compliance

### Security
- Path policy service for workspace security
- HTTPS-only webhook URLs in production
- JWT-based authentication with Supabase
- Webhook secret validation

## [1.0.0] - 2026-01-01

### Added
- Initial release of G-Rump AI development platform
- Architecture-as-Code philosophy (diagram + spec as source of truth)
- Two primary modes: Architecture Mode and Code Mode
- Three flows to production: Chat-first, Phase bar, SHIP
- Multi-provider AI support (NVIDIA NIM, OpenRouter)
- Svelte 5 frontend with TailwindCSS
- Express.js backend with TypeScript
- Rust intent compiler with WASM support
- Electron 28 desktop app for Windows
- Mermaid diagram generation
- PRD (Product Requirements Document) generation
- Comprehensive documentation
- CI/CD pipeline with security scanning
- Docker support with GPU acceleration

### Desktop Features (Windows)
- OS notifications for ship/codegen completion
- System tray with quick actions
- Global shortcut (Ctrl+Shift+G)
- Always-on-top toggle
- Protocol handler (grump://)

---

[2.1.0]: https://github.com/Aphrodine-wq/G-rump.com/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Aphrodine-wq/G-rump.com/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Aphrodine-wq/G-rump.com/releases/tag/v1.0.0

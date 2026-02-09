# G-Rump Backend

Express 5 API for G-Rump: chat, ship, plan, spec, codegen, agents, intent, architecture, PRD, RAG, voice, memory, vision, security, webhooks, events, auth, billing, MCP, and more.

**Version:** 2.1.0

## Environment

Copy `.env.example` to `.env` and set at least one AI provider key:
- `NVIDIA_NIM_API_KEY` (recommended for Kimi K2.5)
- `OPENROUTER_API_KEY` (multi-model access)

See [.env.example](.env.example) for all variables. For production, see [docs/PRODUCTION.md](../docs/PRODUCTION.md).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (tsx watch). |
| `npm run build` | Build with SWC (fast). |
| `npm run build:tsc` | Build with TypeScript compiler. |
| `npm run start` | Run from source (tsx). |
| `npm run start:prod` | Run built `dist/index.js`. |
| `npm run bundle` | Bundle with esbuild. |
| `npm run bundle:windows` / `linux` / `macos` | Platform-specific bundle. |
| `npm run type-check` | TypeScript check. |
| `npm run lint` / `npm run lint:fix` | ESLint. |
| `npm run format` / `npm run format:check` | Prettier formatting. |
| `npm run test` | Run tests (Vitest). |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run test:coverage` | Run tests with coverage. |
| `npm run load-test` | K6 load test. |
| `npm run evals` | Run AI agent evaluations. |
| `npm run mcp-server` | Start MCP server. |
| `npm run rag:index` | Index codebase for RAG. |

## Key routes

- `/api/chat/stream` – Streaming chat with tools
- `/api/ship/*` – SHIP workflow
- `/api/plan/*`, `/api/spec/*` – Plan and spec
- `/api/codegen/*` – Multi-agent code generation
- `/api/agents/*` – Agent endpoints (swarm, specialists)
- `/api/rag/*`, `/api/voice/*`, `/api/memory/*`, `/api/vision/*` – AI capabilities
- `/api/security/*` – Security scan, SBOM, compliance
- `/api/webhooks/*` – Inbound/outbound webhooks
- `/api/events/stream` – SSE events
- `/health`, `/metrics` – Health and Prometheus (NIM-aligned metrics: TTFB, tokens/sec)

Full API: [docs/API.md](../docs/API.md).

## Key Dependencies

- **Express 5** – Web framework
- **TypeScript** – Type safety
- **SWC** – Fast compilation
- **Pino** – Logging
- **BullMQ** – Job queue
- **Zod** – Validation
- **Helmet** – Security headers
- **OpenTelemetry** – Tracing (NIM-aligned span attributes). See [NVIDIA_OBSERVABILITY.md](../docs/NVIDIA_OBSERVABILITY.md).

## Deployment

- **NGC (GCP/AWS)**: See [deploy/ngc/](../deploy/ngc/) for NVIDIA Golden Developer compliance.
- **Docker**: Use repo root `docker-compose` and [scripts/build-docker-optimized.sh](../scripts/build-docker-optimized.sh).
- **Kubernetes**: See [deploy/k8s/](../deploy/k8s/).
- **Linux**: See [docs/LINUX_SETUP.md](../docs/LINUX_SETUP.md).

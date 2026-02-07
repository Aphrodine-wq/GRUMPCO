# Quick Start Guide

> **Note:** For the full getting started experience, see [GETTING_STARTED.md](./GETTING_STARTED.md).
> This page is a quick reference card for experienced users.

## TL;DR

```bash
# 1. Install
cd frontend && npm install
cd ../backend && npm install && npm run build

# 2. Configure (create backend/.env)
echo "NVIDIA_NIM_API_KEY=nvapi-your-key" > backend/.env

# 3. Run
cd frontend && npm run electron:dev
```

## Paths

| Use Case | Command |
|----------|---------|
| **Desktop App** | `cd frontend && npm run electron:dev` |
| **Web Dev** | `cd backend && npm run dev` + `cd frontend && npm run dev` |
| **Docker** | `docker-compose up --build` (from deploy/) |
| **CLI** | `npm i -g grump-cli && grump ship "your idea"` |
| **Production Build** | `cd frontend && npm run electron:build` |

## Required Environment

Create `backend/.env` with ONE of:
```env
NVIDIA_NIM_API_KEY=nvapi-your-key-here
# OR
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

## First Project

1. Open G-Rump
2. Type: *"Build a todo app with user authentication"*
3. Click **Generate Architecture** → **Generate PRD** → **Generate Code**
4. Download your project as ZIP

## Workflow

```
Describe → Architecture → PRD → Code → Download
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/.env` | API keys and config |
| `frontend/.env` | Optional: custom API URL |
| `deploy/docker-compose.yml` | Docker deployment |
| `deploy/vercel.json` | Vercel deployment |

## Help

- [Getting Started](./GETTING_STARTED.md) - Full setup guide
- [Setup Guide](./SETUP.md) - Detailed configuration & troubleshooting
- [Architecture](./ARCHITECTURE.md) - How G-Rump works
- [API Reference](./API.md) - All endpoints

---

*Last updated: January 2026*

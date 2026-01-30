# G-Rump Quick Reference

Essential commands, configuration, and troubleshooting for G-Rump developers and users.

## 🚀 Quick Start Commands

```bash
# Desktop app (recommended for local development)
cd frontend && npm run electron:dev

# Or build portable executable
cd frontend && npm run electron:build

# Backend only
cd backend && npm run dev

# Full stack (Windows batch script)
start-app.bat

# Docker (Linux, containerized)
docker-compose up

# CLI install and use
npm install -g grump-cli
grump ship "Build a todo app with React and Node.js"
```

## ⚙️ Environment Variables

### Backend (`backend/.env`) - Required

```env
# AI Provider (at least one required)
NVIDIA_NIM_API_KEY=nvapi-your-key-here
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Basic server config
PORT=3000
NODE_ENV=development
```

### Backend (`backend/.env`) - Production Security

```env
# Required for production when API is public
NODE_ENV=production
REQUIRE_AUTH_FOR_API=true
BLOCK_SUSPICIOUS_PROMPTS=true
SECURITY_STRICT_PROD=true
CORS_ORIGINS=https://yourdomain.com
METRICS_AUTH=username:password
GRUMP_WEBHOOK_SECRET=your-secret
```

### Backend (`backend/.env`) - Optional

```env
# Redis (for shared rate limiting and caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional

# Supabase (for auth)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Cost tracking
COST_DASHBOARD_ENABLED=true
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000/api
```

## 🌐 Common API Endpoints

```bash
# Chat with AI (streaming)
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# Start SHIP workflow
curl -X POST http://localhost:3000/api/ship/start \
  -H "Content-Type: application/json" \
  -d '{"message":"Build a todo app"}'

# Health checks
curl http://localhost:3000/health
curl http://localhost:3000/health/quick

# Cost dashboard data
curl http://localhost:3000/api/cost/summary
curl http://localhost:3000/api/cost/stats

# Prometheus metrics
curl http://localhost:3000/metrics
```

## 🛠️ CLI Commands

```bash
# Core workflow commands
grump ship "Your project description"           # Full SHIP workflow
grump ship-parallel "App 1,App 2,App 3"         # Multiple parallel ships
grump plan "Feature description"                # Generate implementation plan
grump analyze --workspace . --output arch.mmd   # Analyze codebase

# Cache and maintenance
grump cache-clear                               # Clear all caches
grump cache-stats                               # Show cache statistics

# Configuration
grump config set apiUrl http://localhost:3000   # Set API URL
grump config get apiUrl                         # Get current API URL
grump auth login                                # Authenticate
grump auth status                               # Check auth status

# Help
grump --help                                    # Show all commands
grump ship --help                               # Ship command help
```

## 📦 NPM Scripts by Component

### Backend (`cd backend`)

```bash
npm run dev              # Development with hot reload (tsx watch)
npm run build            # Build with SWC (18x faster than tsc)
npm run start            # Run from source (tsx)
npm run start:prod       # Run built dist/index.js
npm run test             # Run Vitest tests
npm run test:watch       # Run tests in watch mode
npm run type-check       # TypeScript type checking
npm run lint             # ESLint check
npm run lint:fix         # ESLint fix
npm run load-test        # K6 load testing
```

### Frontend (`cd frontend`)

```bash
npm run dev              # Vite dev server (port 5173)
npm run build            # Production build
npm run preview          # Preview production build
npm run electron:dev     # Electron desktop dev mode
npm run electron:build   # Build portable EXE (output: electron-dist/)
npm run electron:pack    # Pack without installer
npm run test:run         # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run type-check       # Svelte/TypeScript check
npm run lint             # ESLint
```

### Intent Compiler (`cd intent-compiler`)

```bash
cargo build --release    # Build optimized binary
cargo test               # Run Rust tests
cargo bench              # Run benchmarks
./build-wasm.sh          # Build WASM module
```

### Root (`/`)

```bash
npm run check-all        # Run all checks (lint, type-check, test)
npm run format           # Format all code
```

## 🐳 Docker Commands

```bash
# Build and start all services
docker-compose up --build

# Start in background (detached)
docker-compose up -d

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild specific service
docker-compose build --no-cache backend
docker-compose build --no-cache frontend

# Stop and remove
docker-compose down

# Remove volumes (careful - deletes data)
docker-compose down -v
```

## 🗄️ Database & Cache

### SQLite (Default)

```bash
# Database location
backend/data/grump.db

# Migrations run automatically on startup
```

### Redis (Optional)

```bash
# Check Redis connection
curl http://localhost:3000/health/quick

# Clear Redis cache
redis-cli FLUSHALL

# View Redis stats (if connected)
redis-cli INFO
```

### Clear All Caches

```bash
# Via CLI
grump cache-clear

# Manual - file cache
rm -rf backend/data/cache/

# Manual - Redis
redis-cli FLUSHALL
```

## ✅ Testing & Quality

```bash
# Backend tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm run test:run

# Frontend E2E tests (requires backend running)
cd frontend && npm run test:e2e

# Type checking
cd backend && npm run type-check
cd frontend && npm run type-check

# Linting
cd backend && npm run lint
cd frontend && npm run lint

# All checks (from root)
npm run check-all
```

## 📊 Monitoring & Debugging

### URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Frontend Dev | http://localhost:5173 |
| Cost Dashboard | http://localhost:5173/cost-dashboard |
| Health Check | http://localhost:3000/health |
| Quick Health | http://localhost:3000/health/quick |
| Prometheus Metrics | http://localhost:3000/metrics |
| Stats API | http://localhost:3000/api/cost/stats |

### Debugging

```bash
# Check if backend is running
curl http://localhost:3000/health/quick

# Test API key configuration
curl http://localhost:3000/health/quick | grep api_key_configured

# View recent backend logs
cd backend && cat logs/app.log | tail -50

# Check port usage
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```

## 🚨 Troubleshooting

### Common Issues & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| "At least one AI provider required" | Missing API key | Add NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY to backend/.env |
| "Port 3000 already in use" | Port conflict | Backend auto-finds next port; check console output |
| "Cannot connect to backend" | Backend not running | Run `cd backend && npm run dev` |
| CORS errors in browser | Origin not allowed | Add your origin to CORS_ORIGINS in backend/.env |
| Frontend shows "Disconnected" | Wrong API URL | Check VITE_API_URL in frontend/.env matches backend port |
| Redis connection failed | Redis not running | App uses in-memory fallback; optional for local dev |
| Docker containers won't start | Missing .env | Ensure backend/.env exists with API key |
| Build fails | TypeScript errors | Run `npm run type-check` to identify issues |
| Tests fail | Dependencies missing | Run `npm install` in backend and frontend |

### Reset Everything

```bash
# Kill all Node processes
taskkill /F /IM node.exe  # Windows
pkill -f node             # Linux/Mac

# Clear all caches and data
rm -rf backend/data/cache/
rm -rf backend/dist/
rm -rf frontend/dist/
redis-cli FLUSHALL  # If using Redis

# Reinstall dependencies
cd backend && rm -rf node_modules && npm install
cd frontend && rm -rf node_modules && npm install

# Restart
start-app.bat  # Windows
# Or manually start backend and frontend
```

## 🔐 Production Checklist (Quick)

Before deploying to production:

```bash
# Environment
NODE_ENV=production

# Security (required when API is public)
REQUIRE_AUTH_FOR_API=true
BLOCK_SUSPICIOUS_PROMPTS=true
SECURITY_STRICT_PROD=true

# CORS (exact origins, no wildcards)
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Secrets (set these)
GRUMP_WEBHOOK_SECRET=...
METRICS_AUTH=username:password

# Full checklist: see docs/PRODUCTION_CHECKLIST.md
```

## 📖 Session Types

| Type | Storage | Use Case |
|------|---------|----------|
| **Chat** | localStorage | Frontend-only conversations |
| **Ship** | Backend DB | SHIP workflow runs |
| **Codegen** | Backend DB | Code generation jobs |

## 🔗 Quick Links

- [Full Documentation Index](./README.md)
- [Getting Started Guide](./GETTING_STARTED.md)
- [Setup Guide](./SETUP.md)
- [API Reference](./API.md)
- [Production Checklist](./PRODUCTION_CHECKLIST.md)
- [Performance Guide](./PERFORMANCE_GUIDE.md)
- [Troubleshooting](./SETUP.md#troubleshooting)

## 💡 Tips

1. **Use the Desktop App** - Easiest way to get started locally
2. **Start with Docker** - If you want isolation or are on Linux
3. **Enable Redis** - For better performance with caching and rate limiting
4. **Set Cost Budgets** - Use the cost dashboard to track spending
5. **Check Health First** - Always verify `/health/quick` before debugging

---

**Last Updated:** 2026-01-30 | **Version:** 3.0.0

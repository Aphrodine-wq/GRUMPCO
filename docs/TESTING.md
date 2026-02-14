# G-Rump Testing & Setup Guide

## Quick Start

### Prerequisites

1. **Node.js 20+** - Required for all packages
2. **npm** - Package manager
3. **Docker** (optional) - For Docker panel functionality
4. **Rust toolchain** (optional) - For intent-compiler

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/Aphrodine-wq/GRUMPCO.git
cd GRUMPCO

# Install all dependencies (monorepo)
npm install

# Copy environment files
cp backend/.env.example backend/.env

# Start development servers
npm run dev
```

---

## Required API Keys

### Minimum Required (pick one):

| Provider | Key Variable | Get From | Purpose |
|----------|--------------|----------|---------|
| **NVIDIA NIM** | `NVIDIA_NIM_API_KEY` | https://build.nvidia.com/ | Primary AI (Kimi K2.5) |
| **OpenRouter** | `OPENROUTER_API_KEY` | https://openrouter.ai/ | Multi-model fallback |

### Optional (for full functionality):

| Provider | Key Variable | Get From | Purpose |
|----------|--------------|----------|---------|
| Together AI | `TOGETHER_API_KEY` | https://together.ai/ | Open source models |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | https://supabase.com/ | Database (prod) |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | https://stripe.com/ | Billing |
| Twilio | `TWILIO_*` vars | https://twilio.com/ | SMS/Voice |
| NVIDIA Build | `NVIDIA_BUILD_API_KEY` | https://build.nvidia.com/ | Voice ASR/TTS |

---

## Environment Configuration

### backend/.env (minimum):

```env
# Required: At least one AI provider
NVIDIA_NIM_API_KEY=nvapi-your_key_here

# Server
NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Database (SQLite for local dev)
DB_TYPE=sqlite
DB_PATH=./data/grump.db
```

### For Vercel Deployment:

Add these secrets in Vercel dashboard:
- `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY`
- `NODE_ENV=production`
- `DB_TYPE=supabase`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

---

## Running Tests

### Backend Tests
```bash
cd backend
npm test                    # Run all tests
npm run test:coverage       # With coverage report
npm run type-check          # TypeScript validation
npm run lint                # Linting
```

### Frontend Tests
```bash
cd frontend
npm run test:run            # Run Vitest tests
npm run test:e2e            # Playwright E2E tests
npm run type-check          # Svelte/TS validation
npm run build               # Production build test
```

### E2E Tests (requires backend running)
```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Run E2E
cd frontend && npm run test:e2e
```

---

## Feature Testing Checklist

### Core Chat Features
- [ ] Send a message and receive AI response
- [ ] Message history persists across page reloads
- [ ] Code blocks render with syntax highlighting
- [ ] Copy code button works
- [ ] Session management (create, rename, delete)

### SHIP Mode (Spec → Hardcode → Integrate → Push)
- [ ] Enter SHIP mode from chat
- [ ] Generate project specification
- [ ] Generate code from spec
- [ ] View generated files in file tree
- [ ] Push to GitHub (requires GitHub auth)

### Architecture Diagrams
- [ ] Generate diagram from description
- [ ] Mermaid diagram renders correctly
- [ ] Export diagram as PNG/SVG
- [ ] Edit diagram code manually

### Cloud Dashboard
- [ ] View connected integrations
- [ ] View deployments list
- [ ] View cloud resources
- [ ] View cost summary
- [ ] API fallback to mock data works

### Docker Panel (Electron/Desktop only)
- [ ] View running containers
- [ ] Start/stop containers
- [ ] View container logs
- [ ] Docker Compose up/down

### Integrations Hub
- [ ] Connect GitHub
- [ ] View integration status
- [ ] Disconnect integration

### Settings
- [ ] Theme toggle (light/dark)
- [ ] Model selection
- [ ] API key configuration

---

## Electron Desktop App

### Build & Run
```bash
cd frontend

# Install dependencies
npm install

# Development
npm run electron:dev

# Build for distribution
npm run electron:build
```

### Test Checklist
- [ ] App launches without errors
- [ ] Icon displays correctly in dock/taskbar
- [ ] All web features work
- [ ] Docker integration works (requires Docker running)
- [ ] Window controls work (minimize, maximize, close)

---

## VSCode Extension

### Build & Test
```bash
cd packages/vscode-extension

# Install dependencies
npm install

# Compile
npm run compile

# Package
npm run package
# Creates grump-vscode-0.1.0.vsix

# Install in VSCode
code --install-extension grump-vscode-0.1.0.vsix
```

### Test Checklist
- [ ] Extension activates
- [ ] Sidebar panel appears
- [ ] Chat works
- [ ] Code context menu items work
- [ ] Keyboard shortcuts work (Ctrl+Shift+G)

---

## API Endpoints to Test

### Health Checks
```bash
# Quick health
curl http://localhost:3000/health/quick

# Full health (checks all services)
curl http://localhost:3000/health/ready
```

### Core APIs
```bash
# Chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "sessionId": "test-123"}'

# Architecture
curl -X POST http://localhost:3000/api/architecture/generate \
  -H "Content-Type: application/json" \
  -d '{"description": "A simple REST API"}'

# Cloud Dashboard
curl http://localhost:3000/api/cloud/dashboard

# Cloud Regions
curl http://localhost:3000/api/cloud/regions?provider=aws
```

---

## Vercel Deployment

### Auto-Deploy Setup

1. **Connect GitHub repo to Vercel** (if not already):
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will auto-detect `vercel.json`

2. **Add Environment Variables** in Vercel Dashboard:
   - `NVIDIA_NIM_API_KEY` (required)
   - `DB_TYPE=supabase`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `NODE_ENV=production`

3. **Optional: GitHub Actions Deploy** (for more control):
   Add these secrets to GitHub:
   - `VERCEL_TOKEN` - From https://vercel.com/account/tokens
   - `VERCEL_ORG_ID` - From `.vercel/project.json`
   - `VERCEL_PROJECT_ID` - From `.vercel/project.json`

### Verify Deployment
```bash
# Check marketing site
curl https://your-app.vercel.app/

# Check API
curl https://your-app.vercel.app/health/quick

# Check API endpoint
curl https://your-app.vercel.app/api/cloud/dashboard
```

---

## Troubleshooting

### "Cannot find module" errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Backend won't start
```bash
# Check for port conflicts
lsof -i :3000

# Verify .env exists
cat backend/.env

# Check logs
cd backend && npm run dev 2>&1 | head -50
```

### Frontend build fails
```bash
# Clear Vite cache
cd frontend
rm -rf node_modules/.vite
npm run build
```

### Docker panel shows "not available"
- Ensure Docker Desktop is running
- Check Docker socket: `docker ps`
- In browser mode, Docker features are disabled (Electron only)

### LSP errors but builds pass
- These are stale TypeScript cache issues
- Restart your editor/IDE
- Run `npm run type-check` to verify

---

## Production Checklist

Before deploying to production:

- [ ] All API keys are set in environment
- [ ] `DB_TYPE=supabase` with valid credentials
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGINS` set to your domain
- [ ] `SECURITY_STRICT_PROD=true`
- [ ] `ALLOWED_HOSTS` set to your domains
- [ ] Stripe webhooks configured (if using billing)
- [ ] Health check endpoint responds: `/health/ready`
- [ ] HTTPS configured (Vercel handles this)

---

## Support

- **Issues**: https://github.com/Aphrodine-wq/GRUMPCO/issues
- **Docs**: See `/docs` folder in repository


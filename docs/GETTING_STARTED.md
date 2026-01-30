# Getting Started with G-Rump

> **Last Updated:** January 2026

Welcome! This guide will get you from zero to running G-Rump in under 10 minutes.

## Prerequisites

- **Node.js 20+** ([Download](https://nodejs.org/))
- **NVIDIA NIM API key** ([Get free key](https://build.nvidia.com/)) OR **OpenRouter API key** ([Get key](https://openrouter.ai/))
- (Optional) **Docker** for containerized deployment

## Choose Your Path

### Option 1: Desktop App (Recommended for Beginners)

The easiest way to run G-Rump locally with a native app experience.

```bash
# 1. Clone and install
cd frontend && npm install
cd ../backend && npm install && npm run build

# 2. Run the desktop app
cd ../frontend
npm run electron:dev
```

**Or build a portable executable:**
```bash
cd frontend
npm run electron:build
# Output: frontend/electron-dist/G-Rump.exe (Windows)
```

### Option 2: Web (Self-Hosted)

For teams or shared access.

```bash
# 1. Deploy backend
cd backend
# See backend/DEPLOY_VERCEL.md for detailed instructions

# 2. Deploy frontend
npm run build
# Serve the dist/ folder with any static host

# 3. Configure production security
# See docs/SECURITY_BASELINE.md and docs/PRODUCTION_CHECKLIST.md
```

### Option 3: CLI

For scripts, automation, and terminal workflows.

```bash
# Install globally
npm install -g grump-cli

# Configure and use
grump config set apiUrl http://localhost:3000
grump auth login
grump ship "Build a todo app with auth"
```

### Option 4: Docker (Linux Recommended)

Full isolation with all dependencies included.

```bash
# Build and run (from project root)
docker-compose -f deploy/docker-compose.yml up --build

# Access the app at http://localhost:8080
```

## First-Time Setup

### 1. Get Your API Key

**NVIDIA NIM** (Recommended for Kimi K2.5):
1. Visit [build.nvidia.com](https://build.nvidia.com/)
2. Create an account or sign in
3. Go to API Keys section
4. Create a new key (starts with `nvapi-`)

**OpenRouter** (Multi-model access):
1. Visit [openrouter.ai](https://openrouter.ai/)
2. Sign up and go to Keys
3. Create a key (starts with `sk-or-v1-`)

### 2. Configure Environment

Create `backend/.env`:
```env
# Required - use your actual key
NVIDIA_NIM_API_KEY=nvapi-your-key-here
# or OPENROUTER_API_KEY=sk-or-v1-your-key-here

PORT=3000
NODE_ENV=development
```

### 3. Verify Installation

```bash
# Check backend health
curl http://localhost:3000/health/quick

# Should return:
# {"status":"healthy","checks":{"api_key_configured":true,...}}
```

## Your First Project

1. **Open G-Rump** (desktop app or browser at http://localhost:5173)
2. **Describe your project**: "Build a todo app with user authentication"
3. **Generate Architecture**: Click "Generate Architecture" to see system diagrams
4. **Generate PRD**: Click "Generate PRD" for a detailed requirements document
5. **Generate Code**: Select your tech stack and click "Generate Code"
6. **Download**: Get your complete project as a ZIP file

## Next Steps

- **Detailed Setup**: See [SETUP.md](./SETUP.md) for comprehensive configuration
- **Architecture**: Learn how G-Rump works in [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Reference**: Explore all endpoints in [API.md](./API.md)
- **Quick Reference**: Commands and shortcuts in [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Production**: Deployment checklist in [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "AI provider required" error | Add NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY to backend/.env |
| Port already in use | Backend auto-finds next port; check console for actual port |
| "Disconnected" in frontend | Ensure backend is running (`npm run dev` in backend/) |
| CORS errors | Add your origin to CORS_ORIGINS in backend/.env |

For more help, see [SETUP.md](./SETUP.md#troubleshooting).

## Help & Support

- 📚 [Documentation Index](./README.md)
- 🔧 [Setup Guide](./SETUP.md)
- 🐛 [Known Issues](./KNOWN_ISSUES.md)
- 🚨 [Runbook](./RUNBOOK.md)

---

**Welcome to G-Rump!** 🚀

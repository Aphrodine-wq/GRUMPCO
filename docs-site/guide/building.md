# Building from Source

Complete guide to building G-Rump from source code for development or custom deployments.

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.0+ | Runtime |
| npm | 9.0+ | Package manager |
| Git | 2.0+ | Source control |
| Python | 3.8+ | Native module builds |

### Platform-Specific

**Windows:**
- Visual Studio Build Tools 2019+
- Windows SDK

```powershell
# Install build tools
npm install -g windows-build-tools
```

**macOS:**
- Xcode Command Line Tools

```bash
xcode-select --install
```

**Linux:**
```bash
# Debian/Ubuntu
sudo apt install build-essential python3

# Fedora
sudo dnf install gcc-c++ make python3
```

## Getting the Source

```bash
# Clone the repository
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# View available branches
git branch -a

# Switch to a specific version
git checkout v1.0.0
```

## Project Structure

```
G-rump.com/
├── backend/           # Node.js API server
│   ├── src/
│   ├── tests/
│   └── package.json
├── frontend/          # Svelte + Electron app
│   ├── src/
│   ├── electron/
│   └── package.json
├── docs/              # Documentation source
├── docs-site/         # VitePress documentation
├── marketing-site/    # Marketing website
└── package.json       # Root workspace
```

## Building the Backend

```bash
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Start development server
npm run dev

# Start production server
npm start
```

### Backend Configuration

Create `backend/.env`:

```bash
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/grump

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379

# LLM Provider
OPENAI_API_KEY=sk-...

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

### Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Reset database
npm run db:reset
```

## Building the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server (web only)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Frontend Environment

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

## Building the Desktop App

```bash
cd frontend

# Development mode with hot reload
npm run electron:dev

# Build for current platform
npm run electron:build

# Build for specific platforms
npm run electron:build -- --win
npm run electron:build -- --mac
npm run electron:build -- --linux

# Build all platforms (CI environment)
npm run electron:build -- -mwl
```

### Build Output

```
frontend/release/
├── G-Rump-Setup-1.0.0.exe       # Windows installer
├── G-Rump-1.0.0-portable.exe    # Windows portable
├── G-Rump-1.0.0.dmg             # macOS DMG
├── G-Rump-1.0.0-arm64.dmg       # macOS ARM
├── G-Rump-1.0.0.AppImage        # Linux AppImage
├── g-rump_1.0.0_amd64.deb       # Debian package
└── g-rump-1.0.0.x86_64.rpm      # RPM package
```

### Code Signing

**Windows:**
```bash
# Set certificate path
export WIN_CSC_LINK=/path/to/certificate.pfx
export WIN_CSC_KEY_PASSWORD=your-password

npm run electron:build -- --win
```

**macOS:**
```bash
# Set signing identity
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your-password
export APPLE_ID=your@apple.id
export APPLE_ID_PASSWORD=app-specific-password

npm run electron:build -- --mac
```

## Building Documentation

### Docs Site (VitePress)

```bash
cd docs-site

# Install dependencies
npm install

# Development server
npm run dev

# Build static site
npm run build

# Preview build
npm run preview
```

Output: `docs-site/.vitepress/dist/`

### Marketing Site

The marketing site is static HTML and doesn't require building.

## Full Build Script

Build everything at once:

```bash
#!/bin/bash
# build-all.sh

set -e

echo "Building G-Rump..."

# Backend
echo "Building backend..."
cd backend
npm ci
npm run build
npm test
cd ..

# Frontend
echo "Building frontend..."
cd frontend
npm ci
npm run build
cd ..

# Desktop app
echo "Building desktop app..."
cd frontend
npm run electron:build
cd ..

# Documentation
echo "Building documentation..."
cd docs-site
npm ci
npm run build
cd ..

echo "Build complete!"
```

## Development Workflow

### Running Everything

Open 3 terminals:

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Desktop (optional)
cd frontend && npm run electron:dev
```

### Using Workspaces

From the root directory:

```bash
# Install all dependencies
npm install

# Run all in development
npm run dev

# Build all
npm run build

# Test all
npm test
```

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/build.yml
name: Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build backend
        run: npm run build --workspace=backend
      
      - name: Test backend
        run: npm test --workspace=backend
      
      - name: Build frontend
        run: npm run build --workspace=frontend
      
      - name: Build desktop app
        run: npm run electron:build --workspace=frontend
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: desktop-${{ matrix.os }}
          path: frontend/release/*
```

## Troubleshooting

### Native Module Errors

```bash
# Rebuild native modules
npm rebuild

# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Electron Build Failures

```bash
# Clear electron-builder cache
rm -rf ~/Library/Caches/electron-builder  # macOS
rm -rf ~/.cache/electron-builder           # Linux
rm -rf %LOCALAPPDATA%\electron-builder     # Windows

# Rebuild
npm run electron:build
```

### Memory Issues

```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

## Next Steps

- [Production Checklist](/guide/production) - Deployment preparation
- [Docker Deployment](/guide/docker) - Container deployment
- [Configuration](/guide/configuration) - Build configuration

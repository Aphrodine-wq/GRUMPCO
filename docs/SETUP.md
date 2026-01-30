# Setup Guide - G-Rump

This guide will help you get G-Rump running in local development or as a bundled Windows application.

## Prerequisites

- Node.js 20+ installed
- npm installed
- NVIDIA NIM API key ([Get one here](https://build.nvidia.com/)) or OpenRouter API key ([Get one here](https://openrouter.ai/))
- (Optional) Docker and Docker Compose for containerized deployment

## Quick Start

### 1. Get Your AI Provider API Key

**Option A: NVIDIA NIM (Recommended - for Kimi K2.5)**
1. Sign up or log in at [NVIDIA Build](https://build.nvidia.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key (starts with `nvapi-`)

**Option B: OpenRouter (Multi-model access)**
1. Sign up or log in at [OpenRouter](https://openrouter.ai/)
2. Go to Keys section
3. Create a new API key
4. Copy the key (starts with `sk-or-v1-`)

### 2. Configure Environment

#### For Local Development

Create `backend/.env` file:
```env
# At least one of these is required:
NVIDIA_NIM_API_KEY=nvapi-your-actual-key-here
# OPENROUTER_API_KEY=sk-or-v1-your-key-here

PORT=3000
NODE_ENV=development
```

(Optional) Create `frontend/.env` file for custom API URL:
```env
VITE_API_URL=http://localhost:3000/api
```

#### For Docker

The Docker setup uses `backend/.env` automatically. Ensure the file exists with your API key.

## Local Development Setup

### Step 1: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2: Start Backend

```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:3000`. Verify it's running:
```bash
curl http://localhost:3000/health/quick
```

You should see:
```json
{"status":"healthy","checks":{"api_key_configured":true,"server_responsive":true},"timestamp":"..."}
```

### Step 3: Start Frontend

In a new terminal:
```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173`. 

**For Tauri Desktop App:**
```bash
cd frontend
npm run tauri:dev
```

This starts the Tauri desktop application with hot-reload.

### Step 4: Verify Connection

1. Open `http://localhost:5173` in your browser
2. You should see the splash screen, then the auth screen
3. The connection status indicator should show "Connected" (green)
4. If you see "Disconnected", check that:
   - Backend is running on port 3000
   - No firewall is blocking the connection
   - Check browser console for errors

## Docker Setup

### Step 1: Ensure Environment File Exists

Make sure `backend/.env` exists with your API key (see above).

### Step 2: Build and Start Containers

From the project root:
```bash
docker-compose up --build
```

This will:
- Build both backend and frontend containers
- Start the backend on port 3000 (internal)
- Start the frontend on port 8080 (exposed)
- Set up networking between containers

### Step 3: Access the Application

Open `http://localhost:8080` in your browser.

The frontend container proxies API requests to the backend automatically via nginx.

### Step 4: Verify Health

```bash
curl http://localhost:8080/health/quick
```

## Using the Start Script (Windows)

On Windows, you can use the provided batch script:

```bash
start-app.bat
```

This starts the G-Rump backend and frontend dev server in separate windows. To run the Tauri desktop app, open a new terminal, run `cd frontend && npm run tauri:dev`, or uncomment the Tauri line in `start-app.bat`.

## Smoke test after boot

After starting services (via `start-app.bat` or manually), verify everything is up:

**Local (backend + frontend dev)**  
1. Open [systems-dashboard.html](systems-dashboard.html) in your browser (or run `boot-all.bat`, which opens it after starting services).  
2. Confirm "Backend API" and "Frontend dev server" show **Up**.  
3. Open `http://localhost:5173`, confirm the app loads and the connection status is "Connected".

**Docker**  
1. From the project root: `docker-compose up --build`.  
2. Wait until containers are healthy, then run:
   - `curl -s -o NUL -w "%{http_code}" http://localhost:8080/` — expect 200.  
   - `curl -s http://localhost:8080/health/quick` — expect JSON with `"status":"healthy"` (if your compose exposes health via the frontend proxy).  
3. Open `http://localhost:8080` in your browser and confirm the app loads.

**Optional script**  
From the project root, run `scripts\smoke-check.bat` (Windows). It checks backend and frontend dev endpoints and exits 0 only if both respond. Use after starting services with `start-app.bat`.

## Troubleshooting

### Backend Won't Start

**Error: "At least one AI provider API key is required"**
- Ensure `backend/.env` exists
- Set either `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY`
- Check that the API key is on a single line with no extra spaces

**Error: "Port 3000 already in use"**
- The backend automatically finds an available port
- Check the console output for the actual port
- Update `frontend/.env` with the correct port if needed

**Error: "Cannot connect to AI API"**
- Verify your API key is valid and active
- Check your internet connection
- Verify you have API credits/quota

### Frontend Won't Connect to Backend

**Connection Status Shows "Disconnected"**
- Verify G-Rump backend is running: `curl http://localhost:3000/health/quick`
- Check `frontend/.env` has correct `VITE_API_URL`
- Check browser console for CORS errors
- Ensure both services are running

**CORS Errors in Browser Console**
- Backend allows `http://localhost:5173` and `http://localhost:5178` by default in development
- For custom ports, set `CORS_ORIGINS` in `backend/.env`:
  ```env
  CORS_ORIGINS=http://localhost:5173,http://localhost:5178,http://localhost:3001
  ```

### Docker Issues

**Containers Won't Start**
- Ensure Docker is running
- Check `docker-compose logs` for errors
- Verify `backend/.env` exists with API key

**Frontend Can't Reach Backend in Docker**
- Check nginx configuration in `frontend/nginx.conf`
- Verify both containers are on the same network
- Check backend health: `docker-compose exec backend wget -q -O- http://localhost:3000/health`

**Build Fails**
- Clear Docker cache: `docker-compose build --no-cache`
- Check for TypeScript errors: `cd backend && npm run build`
- Check for frontend build errors: `cd frontend && npm run build`

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NVIDIA_NIM_API_KEY` | One of these | - | NVIDIA NIM API key (for Kimi K2.5) |
| `OPENROUTER_API_KEY` | One of these | - | OpenRouter API key (multi-model) |
| `PORT` | No | 3000 | Backend server port |
| `NODE_ENV` | No | development | Environment mode |
| `CORS_ORIGINS` | No | localhost:5173 | Comma-separated allowed origins |
| `LOG_LEVEL` | No | info | Logging level (debug, info, warn, error) |
| `SUPABASE_URL` | No | - | Supabase URL (optional, uses mock mode if not set) |
| `SUPABASE_SERVICE_KEY` | No | - | Supabase service key (optional) |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | http://localhost:3000 | Backend API URL |

## Development Workflow

### Making Changes

1. **Backend Changes**: 
   - Edit TypeScript files in `backend/src/`
   - The dev server (`npm run dev`) uses `tsx watch` for hot reload
   - Restart if you change environment variables

2. **Frontend Changes**:
   - Edit Svelte/TypeScript files in `frontend/src/`
   - Vite dev server hot-reloads automatically
   - Tauri app hot-reloads in dev mode
   - Restart if you change environment variables

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm run test:run
```

### Building for Production

**Windows Bundle:**
```bash
# From project root
build-windows.bat
```

This creates a Windows installer with:
- Bundled backend (embedded Node.js)
- Bundled intent compiler
- Svelte frontend

**Manual Build:**
```bash
# Backend bundle
cd backend
npm run bundle
# Output: backend/dist-bundle/grump-backend.exe

# Frontend
cd frontend
npm run build
# Output: frontend/dist/

# Tauri app
cd frontend
npm run tauri:build
# Output: frontend/src-tauri/target/release/bundle/
```

## Next Steps

Once G-Rump is running:

1. **Test Intent Parsing**: Enter natural language intent and optional constraints
2. **Test Diagram Generation**: Confirm architecture diagram, then PRD generation
3. **Explore Codegen**: Run agent orchestration, download ZIP, GitHub push
4. **Read Architecture**: See `docs/OVERVIEW.md` and `docs/CAPABILITIES.md`

## Getting Help

- Review `docs/OVERVIEW.md` for system architecture
- Check backend logs for detailed error messages
- Check browser console for frontend errors

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in `backend/.env`
2. Configure proper `CORS_ORIGINS` for your domain
3. Set up proper authentication (Supabase or custom)
4. Configure metrics endpoint authentication (`METRICS_AUTH`)
5. Use environment variables, never commit `.env` files
6. Set up proper logging and monitoring
7. Configure reverse proxy (nginx) with SSL/TLS

See `docker-compose.yml` for production-ready Docker configuration.

## Security

- **CORS**: Set `CORS_ORIGINS` to the exact origins your app uses. In production the backend uses a minimal default when unset. See `BUILD.md` for production defaults.
- **Binding**: With `NODE_ENV=production`, the backend listens on `127.0.0.1` by default (override with `HOST`). Keeps the API off the network when run as the packaged app.
- **Metrics**: Set `METRICS_AUTH` in production so `/metrics` requires basic auth.
- **Tauri**: CSP and capabilities are in `frontend/src-tauri/tauri.conf.json` and `frontend/src-tauri/capabilities/`. Only the `main` and `splashscreen` windows use the default capability set.
- **Code signing**: For Windows distribution trust, see the "Code Signing (Windows)" section in `BUILD.md`.

# Troubleshooting Guide

> **Version:** 2.1.0 | **Last Updated:** February 2026

Comprehensive troubleshooting guide for G-Rump. Can't find your issue? Check [GitHub Issues](https://github.com/Aphrodine-wq/GRUMPCO/issues) or [Discussions](https://github.com/Aphrodine-wq/GRUMPCO/discussions).

---

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [API Key Issues](#api-key-issues)
- [Connection Issues](#connection-issues)
- [Generation Issues](#generation-issues)
- [Desktop App Issues](#desktop-app-issues)
- [Performance Issues](#performance-issues)
- [Docker Issues](#docker-issues)
- [Database Issues](#database-issues)
- [Redis Issues](#redis-issues)
- [Error Reference](#error-reference)

---

## Quick Diagnostics

Run these checks to quickly identify issues:

```bash
# Check backend health
curl http://localhost:3000/health/quick

# Check detailed status
curl http://localhost:3000/health/detailed

# Check frontend accessibility
curl http://localhost:5173

# Check version
curl http://localhost:3000/health | jq '.version'
```

**Expected health response:**
```json
{
  "status": "healthy",
  "checks": {
    "api_key_configured": true,
    "server_responsive": true,
    "database_connected": true
  },
  "version": "2.1.0"
}
```

---

## Installation Issues

### Node.js version mismatch

**Symptoms:**
```
Error: The engine "node" is incompatible with this module
```

**Fix:**
```bash
# Check version
node --version  # Should be v20.x.x or higher

# Install/update Node.js
# Using nvm:
nvm install 20
nvm use 20

# Or download from nodejs.org
```

### npm install fails

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Fix:**
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# If using pnpm
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Backend won't start

**Symptoms:**
```
Error: Cannot find module './dist/index.js'
```

**Fix:**
```bash
# Build the backend first
cd backend && npm run build

# Then start
cd backend && npm start
```

---

## API Key Issues

### "AI provider required" error

**Symptoms:**
```
Error: AI provider required. Set NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY
```

**Fix:**
```bash
# Option 1: Use Mock Mode (no key needed)
echo "MOCK_AI_MODE=true" > backend/.env

# Option 2: Add real API key
# Get key from https://build.nvidia.com/
echo "NVIDIA_NIM_API_KEY=nvapi-your-key" > backend/.env

# Restart backend after changes
cd backend && npm run dev
```

### 401 Unauthorized

**Symptoms:**
```json
{ "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }
```

**Fix:**

1. **API key invalid:**
   ```bash
   # Verify key format
   # NVIDIA: starts with nvapi-
   # OpenRouter: starts with sk-or-v1-
   ```

2. **Authentication required:**
   ```bash
   # If REQUIRE_AUTH_FOR_API=true, sign in via frontend
   # Or include token in requests:
   curl -H "Authorization: Bearer <token>" http://localhost:3000/api/ship/start
   ```

### 403 Forbidden

**Symptoms:**
```json
{ "error": { "code": "FORBIDDEN", "message": "Access denied" } }
```

**Possible causes:**

1. **CORS issue:**
   ```bash
   # Add your origin to backend/.env
   echo 'CORS_ORIGINS=http://localhost:5173,https://your-domain.com' >> backend/.env
   ```

2. **Rate limited:**
   ```bash
   # Check rate limit headers
   curl -I http://localhost:3000/api/chat/stream
   # Look for: X-RateLimit-Remaining: 0
   
   # Wait before retrying
   ```

3. **Agent blocked:**
   ```bash
   # Check agent governance settings
   # Set in backend/.env:
   AGENT_ACCESS_POLICY=allowlist
   AGENT_ALLOWLIST=your-agent-id
   ```

---

## Connection Issues

### "Disconnected" in frontend

**Symptoms:** Frontend shows "Disconnected" or can't reach backend

**Fix:**
```bash
# 1. Ensure backend is running
cd backend && npm run dev

# 2. Check backend port
# Look for: Server running on port 3000

# 3. If using custom port, update frontend
# Create frontend/.env:
echo "VITE_API_URL=http://localhost:3001" > frontend/.env
```

### CORS errors in browser console

**Symptoms:**
```
Access to fetch at 'http://localhost:3000/api/...' from origin 
'http://localhost:5173' has been blocked by CORS policy
```

**Fix:**
```bash
# Add frontend origin to backend/.env
echo 'CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173' >> backend/.env

# Restart backend
cd backend && npm run dev
```

### WebSocket/SSE connection failed

**Symptoms:** Streaming responses don't work

**Fix:**
```bash
# 1. Check firewall isn't blocking
# 2. If behind proxy, ensure it supports long-lived connections
# 3. Check CSP headers include backend URL

# Add to backend/.env for development:
echo 'CORS_ORIGINS=http://localhost:5173' >> backend/.env
```

---

## Generation Issues

### Architecture/PRD generation hangs

**Symptoms:** Request hangs, no response after 60+ seconds

**Debug:**
```bash
# Check backend logs
cd backend && npm run dev  # Watch for errors

# Test API directly
curl -X POST http://localhost:3000/api/architecture/generate \
  -H "Content-Type: application/json" \
  -d '{"intent": "Simple todo app"}' \
  -v  # Verbose output
```

**Common fixes:**

1. **API provider issue:**
   ```bash
   # Check provider status:
   # NVIDIA: https://status.nvidia.com/
   # OpenRouter: https://status.openrouter.ai/
   ```

2. **Rate limited by provider:**
   ```bash
   # Wait a few minutes and retry
   # Or switch to different provider in backend/.env
   ```

3. **Timeout too short:**
   ```bash
   # Increase timeout in backend/.env
   echo 'REQUEST_TIMEOUT_MS=300000' >> backend/.env
   ```

### Code generation fails

**Symptoms:** Starts but fails partway through

**Fix:**
```bash
# Check session status
curl http://localhost:3000/api/codegen/<sessionId>

# Common issues:
# 1. API quota exceeded - check provider dashboard
# 2. Complex project - try simpler description
# 3. Session timeout - start new session
```

### Empty or incomplete output

**Symptoms:** LLM returns truncated or empty response

**Fix:**
1. Retry the request
2. Try different model (via ModelPicker)
3. Simplify input description
4. Check for rate limiting

---

## Desktop App Issues

### Electron app won't start

**Symptoms:** Window doesn't appear or crashes immediately

**Fix:**
```bash
# 1. Ensure backend is built
cd backend && npm run build

# 2. Check frontend dependencies
cd frontend && npm install

# 3. Run with debug
cd frontend && npm run electron:dev -- --enable-logging

# 4. Check Electron logs
# Linux/macOS: ~/.config/G-Rump/logs/
# Windows: %APPDATA%\G-Rump\logs\
```

### System tray icon missing

**Symptoms:** Tray icon not visible on Linux

**Fix:**
```bash
# Some Linux desktop environments don't support system trays
# Check if your DE supports AppIndicator

# Workaround: Use web version
npm run dev:frontend
```

### Global shortcut not working

**Symptoms:** Ctrl+Shift+G doesn't open app

**Fix:**
```bash
# Check if another app registered the shortcut
# Common conflicts: GitHub Desktop, other Electron apps

# Modify shortcut in frontend/electron/main.cjs:
globalShortcut.register('CommandOrControl+Shift+H', () => {
  mainWindow.show();
});
```

---

## Performance Issues

### Slow response times

**Symptoms:** Responses take 10+ seconds

**Diagnose:**
```bash
# Check cache hit rate
curl http://localhost:3000/metrics | grep cache_hit

# Enable debug logging
echo 'LOG_LEVEL=debug' >> backend/.env
```

**Fix:**
```bash
# 1. Enable tiered caching
echo 'TIERED_CACHE_ENABLED=true' >> backend/.env
echo 'REDIS_HOST=localhost' >> backend/.env

# 2. Use faster model preset
curl -X POST http://localhost:3000/api/chat/stream \
  -d '{"messages": [...], "modelPreset": "fast"}'

# 3. Reduce context size
# Clear conversation history periodically
```

### High memory usage

**Symptoms:** Backend using >2GB RAM

**Fix:**
```bash
# 1. Restart backend to clear memory
# 2. Configure memory limits
echo 'NODE_OPTIONS=--max-old-space-size=2048' >> backend/.env

# 3. Enable Redis for distributed caching
# Reduces per-instance memory usage
```

### Backend CPU spikes

**Symptoms:** CPU usage 100% during operations

**Fix:**
```bash
# 1. Enable worker pool
echo 'WORKER_POOL_SIZE=4' >> backend/.env

# 2. Use Rust intent compiler (faster parsing)
echo 'GRUMP_INTENT_PATH=./intent-compiler/target/release/grump-intent' >> backend/.env

# 3. Enable caching to avoid repeat work
echo 'TIERED_CACHE_ENABLED=true' >> backend/.env
```

---

## Docker Issues

### Container won't start

**Symptoms:** Container exits immediately

**Debug:**
```bash
# Check logs
docker compose logs backend
docker compose logs frontend

# Check for port conflicts
docker compose ps
```

**Fix:**
```bash
# 1. Rebuild containers
docker compose down
docker compose up --build

# 2. Check environment variables
cat deploy/.env

# 3. Ensure volumes exist
docker volume ls | grep grump
```

### Can't connect to containerized backend

**Symptoms:** Frontend can't reach backend in Docker

**Fix:**
```yaml
# In docker-compose.yml, ensure proper networking
services:
  backend:
    networks:
      - grump-network
    environment:
      - CORS_ORIGINS=http://localhost:5173
      
  frontend:
    networks:
      - grump-network
    environment:
      - VITE_API_URL=http://backend:3000

networks:
  grump-network:
    driver: bridge
```

### Volume permission errors

**Symptoms:** Permission denied writing to volumes

**Fix:**
```yaml
# docker-compose.yml
services:
  backend:
    user: "${UID}:${GID}"  # Run as current user
    volumes:
      - ./data:/app/data
```

Or fix permissions:
```bash
sudo chown -R $USER:$USER ./data
```

---

## Database Issues

### SQLite locked

**Symptoms:**
```
SQLITE_BUSY: database is locked
```

**Fix:**
```bash
# 1. Use PostgreSQL for multi-process setups
# 2. Enable WAL mode (should be default)
echo 'PRAGMA journal_mode=WAL;' | sqlite3 backend/data/grump.db

# 3. Reduce concurrent connections
```

### Migration failures

**Symptoms:**
```
Migration failed: table users already exists
```

**Fix:**
```bash
cd backend

# Check migration status
npm run db:migrate:status

# Rollback and retry
npm run db:migrate:rollback
npm run db:migrate

# Or reset (WARNING: loses data)
npm run db:reset
```

---

## Redis Issues

### Redis connection refused

**Symptoms:**
```
ECONNREFUSED 127.0.0.1:6379
```

**Fix:**
```bash
# 1. Check Redis is running
redis-cli ping  # Should return PONG

# 2. Start Redis if needed
redis-server --daemonize yes

# 3. Check configuration
echo 'REDIS_HOST=localhost' >> backend/.env
echo 'REDIS_PORT=6379' >> backend/.env

# Note: System continues in degraded mode (in-memory caching) without Redis
```

### Redis memory full

**Symptoms:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Fix:**
```bash
# Increase Redis memory
redis-cli CONFIG SET maxmemory 2gb

# Or configure eviction
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## Error Reference

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `AI provider required` | No API key configured | Set NVIDIA_NIM_API_KEY or MOCK_AI_MODE |
| `UNAUTHORIZED` | Invalid or missing auth | Check token or sign in |
| `VALIDATION_ERROR` | Invalid request body | Check request schema |
| `RATE_LIMITED` | Too many requests | Wait and retry |
| `NOT_FOUND` | Resource doesn't exist | Check ID/path |
| `TIMEOUT` | Request took too long | Increase timeout or simplify |
| `CORS_ERROR` | Origin not allowed | Add to CORS_ORIGINS |

### Debug Mode

Enable verbose logging:

```bash
# backend/.env
LOG_LEVEL=debug
DEBUG=true

# Then restart backend
cd backend && npm run dev 2>&1 | tee backend.log
```

### Correlation IDs

Every request has a correlation ID for tracing:

```bash
# Check response headers
curl -I http://localhost:3000/api/ship/start
# X-Correlation-Id: abc-123-def

# Search logs for the ID
grep "abc-123-def" backend.log
```

---

## Getting Help

### Enable Debug Logging

```bash
# backend/.env
LOG_LEVEL=debug
SENTRY_DEBUG=true
```

### Useful Commands

```bash
# Full system check
npm run check-all

# Run tests
cd backend && npm test
cd frontend && npm run test:run

# Check for issues
npm run check-all

# View metrics
curl http://localhost:3000/metrics
```

### Reporting Issues

When reporting issues, include:

1. **G-Rump version:**
   ```bash
   cat package.json | grep version
   ```

2. **Node.js version:**
   ```bash
   node --version
   ```

3. **Operating system:**
   ```bash
   uname -a  # Linux/macOS
   ver       # Windows
   ```

4. **Error messages and stack traces**

5. **Correlation ID** (from response headers)

6. **Steps to reproduce**

### Support Channels

- 📖 [Documentation](./README.md)
- 🐛 [Issue Tracker](https://github.com/Aphrodine-wq/GRUMPCO/issues)
- 💬 [Discussions](https://github.com/Aphrodine-wq/GRUMPCO/discussions)

---

## Related Documentation

- [GETTING_STARTED.md](./GETTING_STARTED.md) - Installation and setup
- [PRODUCTION.md](./PRODUCTION.md) - Production deployment
- [SECURITY.md](./SECURITY.md) - Security configuration
- [TESTING.md](./TESTING.md) - Running tests


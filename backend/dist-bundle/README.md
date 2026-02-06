# G-Rump Backend Bundle

This is a bundled version of the G-Rump backend server.

## Quick Start

### Prerequisites
- Node.js 18 or higher

### Installation

1. Install native dependencies (required):
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure your settings

3. Start the server:
   ```bash
   # Windows
   start.bat
   
   # macOS/Linux
   ./start.sh
   
   # Or directly
   node server.mjs
   ```

## Environment Variables

See `.env.example` for all available configuration options.

## Native Dependencies

Some dependencies require native binaries and are not bundled:
- better-sqlite3 (for local caching)
- ioredis (for Redis connection)

These are installed when you run `npm install`.

## Production Deployment

For production, consider:
- Using a process manager like PM2
- Setting up proper logging
- Configuring health checks
- Using a reverse proxy (nginx, caddy)

```bash
# With PM2
pm2 start server.mjs --name grump-backend
```

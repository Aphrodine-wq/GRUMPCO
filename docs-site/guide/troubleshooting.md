# Troubleshooting

This guide helps you diagnose and resolve common issues with G-Rump. If you can't find a solution here, check our [GitHub Issues](https://github.com/Aphrodine-wq/G-rump.com/issues) or join our [Discord community](https://discord.gg/grump).

## Quick Diagnostics

Before diving into specific issues, run these diagnostic commands:

```bash
# Check CLI version
grump --version

# Verify API connectivity
grump auth status

# Check configuration
grump config list

# Test basic functionality
grump chat "Hello" --verbose
```

## Installation Issues

### CLI Installation Fails

**Problem:** npm install fails or permissions errors

**Solutions:**

```bash
# Use npx instead (no installation needed)
npx grump-cli <command>

# Or fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Or use a node version manager
nvm use 20
npm install -g grump-cli
```

### Desktop App Won't Install

**Problem:** Installation fails on Windows/macOS/Linux

**Solutions:**

**Windows:**
```powershell
# Run as Administrator
# Check Windows Defender isn't blocking
Add-MpPreference -ExclusionPath "C:\Program Files\G-Rump"

# Or use portable version
# Download G-Rump-1.0.0-win.zip from releases
```

**macOS:**
```bash
# Fix "App is damaged" error
xattr -cr /Applications/G-Rump.app

# Or allow in System Preferences
# System Preferences → Security & Privacy → Open Anyway
```

**Linux:**
```bash
# Make AppImage executable
chmod +x G-Rump-1.0.0.AppImage

# Install FUSE if needed
sudo apt-get install libfuse2

# Or use --appimage-extract
./G-Rump-1.0.0.AppImage --appimage-extract
```

## Authentication Issues

### API Key Not Working

**Problem:** "Unauthorized" or "Invalid API key" errors

**Solutions:**

```bash
# Check current auth status
grump auth status

# Re-authenticate
grump auth login

# Or set API key directly
grump auth set-key grump_api_your_key_here

# Verify key is saved
grump config get apiKey
```

### Browser Auth Hangs

**Problem:** Browser authentication never completes

**Solutions:**

```bash
# Use API key method instead
grump auth set-key <your-api-key>

# Check firewall isn't blocking localhost:3000
# Try different browser
# Clear browser cache
```

## Connection Issues

### Cannot Connect to API

**Problem:** "Network error" or timeout

**Diagnostic Steps:**

```bash
# Test connectivity
curl -I https://api.grump.dev/health

# Check DNS resolution
nslookup api.grump.dev

# Test with verbose mode
grump chat "test" --verbose
```

**Solutions:**

```bash
# Check proxy settings
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Or configure in G-Rump
grump config set httpProxy http://proxy.company.com:8080

# Check if API is down
# Visit https://status.grump.dev
```

### Self-Hosted Connection Issues

**Problem:** Cannot connect to self-hosted instance

**Solutions:**

```bash
# Verify backend is running
curl http://localhost:3000/health

# Check if port is available
lsof -i :3000

# Update API URL in config
grump config set apiUrl http://localhost:3000

# Check firewall
sudo ufw allow 3000
```

## SHIP Workflow Issues

### Session Stuck or Failing

**Problem:** SHIP session stuck at "design" or "spec" phase

**Solutions:**

```bash
# Check session status
grump status <session-id> --verbose

# Cancel and restart
curl -X POST https://api.grump.dev/api/jobs/<job-id>/cancel \
  -H "Authorization: Bearer <token>"

# Start new session with simpler description
grump ship "Create a simple TODO app with React"

# Check server logs for errors
docker logs grump-backend
```

### Code Generation Fails

**Problem:** "Failed to generate code" or incomplete output

**Solutions:**

```bash
# Regenerate from specific phase
grump codegen <session-id> --phase code

# Check if session completed all phases
grump status <session-id>

# Generate with different format
grump codegen <session-id> --format files

# Check output directory permissions
ls -la ./output
```

### Streaming Disconnects

**Problem:** Stream stops unexpectedly during SHIP execution

**Solutions:**

```bash
# Use non-streaming mode
grump ship "description" --no-stream

# Then poll for status
grump status <session-id> --watch

# Increase timeout
GRUMP_TIMEOUT=300000 grump ship "description"

# Check network stability
ping api.grump.dev
```

## Performance Issues

### Slow Response Times

**Problem:** API calls taking too long

**Solutions:**

```bash
# Use faster model preset
grump chat "question" --model-preset fast

# Or specify Kimi directly
grump chat "question" --provider nim --model-id moonshotai/kimi-k2.5

# Enable response caching
grump config set cacheEnabled true

# Check if using closest region
grump config set apiUrl https://api-us.grump.dev  # or api-eu, api-asia
```

### High Memory Usage

**Problem:** CLI or backend using excessive memory

**Solutions:**

```bash
# Limit Node.js heap size
export NODE_OPTIONS="--max-old-space-size=2048"

# For backend - restart with memory limits
docker update --memory=2g --memory-swap=2g grump-backend

# Clear local cache
grump config reset cache
```

### Rate Limiting

**Problem:** "Rate limit exceeded" errors

**Solutions:**

```bash
# Check current usage
grump config get usage

# Wait and retry (exponential backoff)
# Or upgrade your tier
# Visit https://grump.dev/dashboard/billing

# Check rate limit headers
curl -I https://api.grump.dev/api/chat \
  -H "Authorization: Bearer <token>"
```

## Code Quality Issues

### Generated Code Has Errors

**Problem:** Code doesn't compile or has bugs

**Solutions:**

```bash
# Enable stricter review
grump config set agents.reviewer true
grump config set agents.security true

# Regenerate with more context
grump ship "description" --workspace ./existing-code

# Use specific agent profile
grump chat "fix this code" --agent-profile backend

# Manual review with roast command
grump roast ./generated-file.ts --brutal
```

### Architecture Not As Expected

**Problem:** Generated architecture doesn't match requirements

**Solutions:**

```bash
# Be more specific in description
grump ship "Build a Next.js 14 app using App Router, ..."

# Add tech stack preferences
grump ship "description" --preferences techStack=nextjs,postgres

# Generate architecture first
grump architecture "description" --format mermaid
# Review, then proceed with ship
```

## Docker Issues

### Container Won't Start

**Problem:** `docker-compose up` fails

**Solutions:**

```bash
# Check logs
docker-compose logs backend

# Rebuild without cache
docker-compose build --no-cache

# Check port conflicts
lsof -i :3000
lsof -i :5432

# Reset everything
docker-compose down -v
docker-compose up -d
```

### Database Connection Failed

**Problem:** "Cannot connect to database" in container logs

**Solutions:**

```bash
# Check if database is healthy
docker-compose ps
docker-compose logs postgres

# Verify environment variables
cat .env | grep DATABASE_URL

# Test connection from container
docker-compose exec backend psql $DATABASE_URL -c "SELECT 1"

# Reset database
docker-compose down -v
docker-compose up -d postgres
docker-compose exec postgres psql -U grump -c "CREATE DATABASE grump;"
```

### Redis Connection Issues

**Problem:** Cannot connect to Redis cache

**Solutions:**

```bash
# Check Redis is running
docker-compose ps redis
docker-compose exec redis redis-cli ping

# Without Redis (fallback to memory)
# Set REDIS_HOST= in .env

# Or use external Redis
REDIS_HOST=redis.external.com REDIS_PORT=6379 docker-compose up
```

## NVIDIA NIM Issues

### NIM Not Responding

**Problem:** "NIM API error" or timeout

**Solutions:**

```bash
# Test NIM connectivity
curl $NVIDIA_NIM_URL/v1/models \
  -H "Authorization: Bearer $NVIDIA_API_KEY"

# Check quota at https://build.nvidia.com
# Verify API key is valid
# Check if model is available in your region

# Fallback to alternative provider
grump config set defaultProvider openrouter
```

### GPU Out of Memory

**Problem:** "CUDA out of memory" errors

**Solutions:**

```bash
# Use smaller context window
# Split requests into smaller chunks
# Enable request batching
# Upgrade GPU tier

# Or route to CPU fallback
export NIM_FALLBACK_ENABLED=true
```

## Desktop App Issues

### App Won't Launch

**Problem:** Desktop application crashes on startup

**Solutions:**

**Windows:**
```powershell
# Check Event Viewer
eventvwr.msc

# Run as administrator
# Disable antivirus temporarily
# Check Visual C++ Redistributables
```

**macOS:**
```bash
# Check Console app for crash logs
# Reset app preferences
rm -rf ~/Library/Application\ Support/G-Rump

# Reinstall
brew uninstall --cask g-rump
brew install --cask g-rump
```

**Linux:**
```bash
# Check logs
journalctl -u g-rump

# Run from terminal to see errors
./G-Rump-1.0.0.AppImage --no-sandbox

# Check dependencies
ldd ./G-Rump-1.0.0.AppImage
```

### Auto-Update Fails

**Problem:** Desktop app won't update

**Solutions:**

```bash
# Manually download latest version
# Check disk space
df -h

# Reset update cache
# Windows: %LOCALAPPDATA%\G-Rump\Cache
# macOS: ~/Library/Caches/G-Rump
# Linux: ~/.cache/G-Rump
```

## Configuration Issues

### Config Not Saving

**Problem:** Settings reset after restart

**Solutions:**

```bash
# Check config file permissions
ls -la ~/.grump/
chmod 644 ~/.grump/config.json

# Verify JSON syntax
grump config list

# Reset to defaults
grump config reset
```

### Wrong Default Model

**Problem:** Using wrong AI model

**Solutions:**

```bash
# Check current default
grump config get defaultModel

# Set to Kimi K2.5
grump config set defaultModel moonshotai/kimi-k2.5

# Or use per-command override
grump ship "description" --model-id openrouter/google/gemini-2.5-pro
```

## Error Reference

### Common Error Codes

| Error | Meaning | Solution |
|-------|---------|----------|
| `E001` | Authentication failed | Check API key |
| `E002` | Rate limit exceeded | Wait or upgrade |
| `E003` | Invalid request | Check parameters |
| `E004` | Resource not found | Check IDs |
| `E005` | Server error | Retry later |
| `E006` | Timeout | Increase timeout |
| `E007` | Network error | Check connection |
| `E008` | Parse error | Check input format |

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad request | Check request body |
| 401 | Unauthorized | Renew API key |
| 403 | Forbidden | Check permissions |
| 404 | Not found | Verify resource ID |
| 429 | Rate limited | Implement backoff |
| 500 | Server error | Report to support |
| 502 | Bad gateway | Check backend status |
| 503 | Service unavailable | Wait and retry |
| 504 | Gateway timeout | Increase timeout |

## Debugging Mode

Enable verbose logging to diagnose issues:

```bash
# CLI verbose mode
grump <command> --verbose

# Set environment variable
export GRUMP_DEBUG=true

# Backend debug logs
DEBUG=grump:* npm start

# Enable request tracing
grump config set tracingEnabled true
```

## Getting Help

If you can't resolve the issue:

1. **Check documentation:**
   - [API Reference](/guide/api-reference)
   - [CLI Reference](/guide/cli-reference)
   - [Configuration](/guide/configuration)

2. **Community support:**
   - [GitHub Discussions](https://github.com/Aphrodine-wq/G-rump.com/discussions)
   - [Discord](https://discord.gg/grump)
   - [Stack Overflow](https://stackoverflow.com/questions/tagged/grump)

3. **Report bugs:**
   - [GitHub Issues](https://github.com/Aphrodine-wq/G-rump.com/issues)
   - Include: error message, command used, OS version, CLI version

4. **Contact support:**
   - Email: support@grump.dev
   - Include diagnostic output from `grump --verbose`

## Next Steps

- [CLI Reference](/guide/cli-reference) - Full command documentation
- [Configuration](/guide/configuration) - Configuration options
- [Deployment](/guide/deployment) - Deployment guides

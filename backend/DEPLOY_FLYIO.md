# Deploying to Fly.io

This guide covers deploying the Grump backend to [Fly.io](https://fly.io).

## Prerequisites

1. Install the Fly.io CLI:
   ```bash
   # Windows (PowerShell)
   pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
   
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. Authenticate with Fly.io:
   ```bash
   fly auth login
   ```

## Initial Deployment

### 1. Launch the App

From the `backend` directory:

```bash
cd backend

# Register app with Fly.io (use existing fly.toml)
fly launch --no-deploy

# If app name is taken, choose a new one when prompted
```

### 2. Create Persistent Volume

SQLite requires a persistent volume:

```bash
fly volumes create grump_data --size 1 --region dfw
```

### 3. Set Secrets

Set required environment variables as secrets:

```bash
# Required
fly secrets set ANTHROPIC_API_KEY="your-api-key"

# Optional (for Supabase auth)
fly secrets set SUPABASE_URL="your-supabase-url"
fly secrets set SUPABASE_ANON_KEY="your-anon-key"
fly secrets set SUPABASE_SERVICE_KEY="your-service-key"

# Optional (for Stripe billing)
fly secrets set STRIPE_SECRET_KEY="sk_..."
fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..."

# Optional (for Redis - use Fly's Upstash Redis)
fly secrets set REDIS_HOST="your-redis-host"
fly secrets set REDIS_PORT="6379"
fly secrets set REDIS_PASSWORD="your-redis-password"
```

### 4. Deploy

```bash
fly deploy
```

## Monitoring

```bash
# Check app status
fly status

# View logs
fly logs

# Open dashboard
fly dashboard

# SSH into running machine
fly ssh console
```

## Scaling

```bash
# Scale memory
fly scale memory 1024

# Scale to multiple regions
fly regions add ord sea

# Set minimum machines (prevents cold starts)
fly scale count 1
```

## Redis (Optional)

To add managed Redis:

```bash
fly redis create
# Follow prompts, then set the connection details as secrets
```

## Troubleshooting

- **Health check failures**: Check logs with `fly logs` - ensure `/health/quick` endpoint is responding
- **Database errors**: Volume may not be attached - run `fly volumes list` to verify
- **Cold starts**: Set `min_machines_running = 1` in `fly.toml` or use `fly scale count 1`

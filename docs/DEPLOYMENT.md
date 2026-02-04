# G-Rump Deployment Guide

Complete step-by-step guide for deploying G-Rump to production.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Local Docker Testing](#local-docker-testing)
4. [Environment Variables](#environment-variables)
5. [Deployment Options](#deployment-options)
   - [Railway (Easiest)](#railway-easiest)
   - [Fly.io (Best Free Tier)](#flyio-best-free-tier)
   - [DigitalOcean (Most Control)](#digitalocean-most-control)
   - [Self-Hosted VPS](#self-hosted-vps)
6. [SSL/HTTPS Setup](#sslhttps-setup)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# Clone and setup
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com
cp .env.example .env
# Edit .env with your API keys

# Deploy locally with Docker Compose
docker-compose up --build -d

# Access the application
# Backend: http://localhost:3000
# Frontend: http://localhost:5173
```

---

## Prerequisites

- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Git**
- At least one **AI Provider API Key** (NVIDIA NIM recommended)
- **4GB RAM minimum** (8GB recommended for production)

### Install Prerequisites

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

**macOS:**
```bash
brew install docker docker-compose
```

---

## Local Docker Testing

### 1. Clone and Prepare

```bash
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# Copy environment file
cp .env.example .env

# Edit with your API keys
nano .env
```

### 2. Required Environment Variables

Edit `.env` and add at least one AI provider:

```bash
# Required - Get from https://build.nvidia.com/
NVIDIA_NIM_API_KEY=nvapi-your_key_here

# Optional alternatives
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# Server
NODE_ENV=production
PORT=3000

# Database (SQLite for local, PostgreSQL for production)
DB_TYPE=sqlite
DB_PATH=/app/data/grump.db
```

### 3. Start Services

```bash
# Start all services
docker-compose up --build -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down
```

### 4. Verify Deployment

```bash
# Health check
curl http://localhost:3000/health/live

# Test API
curl http://localhost:3000/api/status

# Open frontend
open http://localhost:5173
```

### 5. Production Mode (with PostgreSQL)

```bash
# Use PostgreSQL instead of SQLite
export DB_TYPE=postgres

docker-compose -f docker-compose.yml up --build -d
```

---

## Environment Variables

### Required Variables

| Variable | Description | Get From |
|----------|-------------|----------|
| `NVIDIA_NIM_API_KEY` | Primary AI provider | https://build.nvidia.com/ |
| `NODE_ENV` | production or development | - |
| `PORT` | Backend port (default: 3000) | - |

### AI Provider Keys (at least one required)

| Variable | Provider |
|----------|----------|
| `NVIDIA_NIM_API_KEY` | NVIDIA NIM (recommended) |
| `OPENROUTER_API_KEY` | OpenRouter |
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `GOOGLE_API_KEY` | Google Gemini |
| `GROQ_API_KEY` | Groq |

### Database Configuration

| Variable | SQLite | PostgreSQL |
|----------|--------|------------|
| `DB_TYPE` | `sqlite` | `postgres` |
| `DB_PATH` | `/app/data/grump.db` | - |
| `DATABASE_URL` | - | `postgresql://user:pass@host/db` |

### Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password (optional) |

### Security Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `BLOCK_SUSPICIOUS_PROMPTS` | `true` | Block prompt injection attempts |
| `REQUIRE_AUTH_FOR_API` | `true` | Require authentication |
| `MASTER_KEY` | - | Encryption key for sensitive data |

---

## Deployment Options

### Railway (Easiest)

**Best for:** Quick deployment, automatic SSL, free tier available

#### Setup

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
railway login
```

2. **Create Project:**
```bash
railway init
```

3. **Add Environment Variables:**
```bash
railway variables set NVIDIA_NIM_API_KEY=your_key_here
railway variables set NODE_ENV=production
```

4. **Deploy:**
```bash
# Using the deploy script
./scripts/deploy.sh railway

# Or manually
railway up
```

#### Railway Configuration

Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.backend"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health/live",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

### Fly.io (Best Free Tier)

**Best for:** Global CDN, generous free tier, easy scaling

#### Setup

1. **Install Fly CLI:**
```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
fly auth login
```

2. **Create App:**
```bash
fly apps create grump-backend
```

3. **Set Secrets:**
```bash
fly secrets set NVIDIA_NIM_API_KEY=your_key_here
fly secrets set NODE_ENV=production
```

4. **Deploy:**
```bash
# Using the deploy script
./scripts/deploy.sh fly

# Or manually
fly deploy
```

#### Fly Configuration

Create `fly.toml`:
```toml
app = 'grump-backend'
primary_region = 'iad'

[build]
  dockerfile = "Dockerfile.backend"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0

[mounts]
  source = "grump_data"
  destination = "/app/data"

[[vm]]
  memory = '2gb'
  cpus = 2
```

#### Create Volume for Persistent Data

```bash
fly volumes create grump_data --size 10 --region iad
```

---

### DigitalOcean (Most Control)

**Best for:** Full control, predictable pricing ($5/mo droplet)

#### Option A: App Platform (Easier)

1. **Create App Spec** (`.do/app.yaml`):
```yaml
name: grump
region: nyc
services:
  - name: backend
    source_dir: /
    dockerfile_path: Dockerfile.backend
    http_port: 3000
    instance_count: 1
    instance_size_slug: basic-xs
    envs:
      - key: NODE_ENV
        value: production
      - key: NVIDIA_NIM_API_KEY
        value: ${NVIDIA_NIM_API_KEY}
        type: SECRET
```

2. **Deploy:**
```bash
# Using the deploy script
./scripts/deploy.sh digitalocean

# Or manually with doctl
doctl apps create --spec .do/app.yaml
```

#### Option B: Droplet (More Control)

1. **Create Droplet** (Ubuntu 22.04, 2GB RAM minimum)

2. **SSH into Droplet:**
```bash
ssh root@your-droplet-ip
```

3. **Install Docker:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

4. **Clone and Deploy:**
```bash
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com
cp .env.example .env
# Edit .env with your keys
nano .env

# Start services
docker-compose up -d
```

5. **Setup Nginx Reverse Proxy:**
```bash
sudo apt install nginx certbot python3-certbot-nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/grump
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/grump /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Self-Hosted VPS

Any VPS provider works: Linode, Vultr, Hetzner, AWS EC2, etc.

#### Quick Deploy Script

```bash
# On your VPS
curl -fsSL https://raw.githubusercontent.com/Aphrodine-wq/G-rump.com/main/scripts/deploy.sh | bash -s local-prod
```

#### Manual Setup

1. **Update System:**
```bash
sudo apt update && sudo apt upgrade -y
```

2. **Install Docker & Docker Compose:**
```bash
curl -fsSL https://get.docker.com | sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. **Deploy:**
```bash
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# Create environment file
cp .env.example .env
nano .env  # Add your API keys

# Start production deployment
docker-compose -f docker-compose.yml up -d
```

---

## SSL/HTTPS Setup

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

### Using Cloudflare (Free SSL)

1. Add your domain to Cloudflare
2. Set DNS records to point to your server
3. Enable "Full (Strict)" SSL mode
4. No server configuration needed!

### Using Caddy (Automatic HTTPS)

Create `Caddyfile`:
```
your-domain.com {
    reverse_proxy localhost:5173
}

api.your-domain.com {
    reverse_proxy localhost:3000
}
```

Run:
```bash
docker run -d -p 80:80 -p 443:443 \
  -v $PWD/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  -v caddy_config:/config \
  caddy:2
```

---

## Monitoring

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health/live` | Liveness probe (quick) |
| `GET /health/ready` | Readiness probe |
| `GET /metrics` | Prometheus metrics |

### Docker Monitoring

```bash
# View container stats
docker stats

# View logs
docker-compose logs -f --tail 100 backend

# Resource usage
docker system df
```

### Setup Uptime Monitoring

**UptimeRobot** (Free):
1. Create account at https://uptimerobot.com/
2. Add monitor: `https://your-domain.com/health/live`
3. Set interval to 5 minutes

### Prometheus + Grafana (Advanced)

```bash
docker-compose -f docker-compose.yml -f deploy/docker-compose.observability.yml up -d
```

Access Grafana at `http://localhost:3001` (default credentials: admin/admin)

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check exit code
docker-compose ps

# Run interactively for debugging
docker-compose run --rm backend sh
```

### Database Connection Issues

```bash
# Reset database (WARNING: data loss)
docker-compose down -v
docker-compose up -d

# Check SQLite permissions
docker-compose exec backend ls -la /app/data/
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats --no-stream

# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### API Key Issues

```bash
# Verify API key is set
docker-compose exec backend env | grep API_KEY

# Test API key manually
curl -H "Authorization: Bearer YOUR_KEY" https://api.provider.com/v1/models
```

### Reset Everything

```bash
# Stop and remove everything
docker-compose down -v --remove-orphans

# Remove images
docker rmi $(docker images | grep grump | awk '{print $3}')

# Clean up Docker
docker system prune -af

# Rebuild and start
docker-compose up --build -d
```

---

## Performance Tuning

### For High Traffic

1. **Increase Worker Pool:**
```bash
WORKER_POOL_MIN=4
WORKER_POOL_MAX=16
```

2. **Enable Caching:**
```bash
TIERED_CACHE_L1_MAX=1000
TIERED_CACHE_L1_TTL_MS=600000
```

3. **Use PostgreSQL:**
```bash
DB_TYPE=postgres
DATABASE_URL=postgresql://user:pass@postgres:5432/grump
```

4. **Scale with Docker Compose:**
```bash
docker-compose -f docker-compose.yml -f deploy/docker-compose.scale.yml up -d
```

---

## Security Checklist

- [ ] Change default passwords
- [ ] Enable `BLOCK_SUSPICIOUS_PROMPTS`
- [ ] Set `REQUIRE_AUTH_FOR_API=true`
- [ ] Generate strong `MASTER_KEY`
- [ ] Configure firewall (allow only 80, 443, 22)
- [ ] Enable automatic security updates
- [ ] Set up log rotation
- [ ] Use secrets management (not env files in production)

---

## Support

- **Documentation:** https://docs.g-rump.com
- **GitHub Issues:** https://github.com/Aphrodine-wq/G-rump.com/issues
- **Discord:** https://discord.gg/grump

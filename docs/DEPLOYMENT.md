# G-Rump Installation & Deployment Guide

This comprehensive guide covers all deployment options for G-Rump, from local development to production Kubernetes clusters.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Local Development)](#quick-start)
3. [Desktop Application](#desktop-application)
4. [CLI Installation](#cli-installation)
5. [Docker Deployment](#docker-deployment)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Cloud Deployments](#cloud-deployments)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- **Node.js**: >= 20.x LTS ([Download](https://nodejs.org/))
- **pnpm**: >= 8.15.4 (`npm install -g pnpm`)
- **Git**: Latest version

### Optional (Deployment)
- **Docker**: >= 20.x ([Download](https://www.docker.com/))
- **kubectl**: For Kubernetes deployments
- **Helm**: >= 3.13.0 for Kubernetes package management

### API Keys
At minimum, you need **one** of these:
- **NVIDIA NIM API Key** (Recommended) - [Get it here](https://build.nvidia.com/)
- **Anthropic API Key** - [Get it here](https://console.anthropic.com/)
- **OpenRouter API Key** - [Get it here](https://openrouter.ai/)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Aphrodine-wq/GRUMPCO.git
cd GRUMPCO
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build Packages

```bash
pnpm run build:packages
```

### 4. Configure Environment (Backend)

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your API key:
```env
NVIDIA_NIM_API_KEY=your_key_here
```

### 5. Start Backend

```bash
# In backend directory
pnpm run dev
```

Backend will start on `http://localhost:3000`

### 6. Start Frontend (New Terminal)

```bash
cd frontend
pnpm run dev
```

Frontend will start on `http://localhost:5173`

### 7. Verify Installation

Open browser to `http://localhost:5173` and you should see the G-Rump interface.

---

## Desktop Application

### Build Executable

#### Windows
```bash
cd frontend
pnpm run electron:build
```

Output: `frontend/electron-dist/grump.exe`

#### macOS
```bash
cd frontend
pnpm run electron:build
```

Output: `frontend/electron-dist/G-Rump.dmg`

#### Linux
```bash
cd frontend
pnpm run electron:build
```

Output: `frontend/electron-dist/grump.AppImage`

### Run Desktop App (Dev Mode)

```bash
cd frontend
pnpm run electron:dev
```

---

## CLI Installation

### Global Installation (npm)

```bash
npm install -g @g-rump/cli
```

### Usage

```bash
# Ship a project
grump ship "Build a todo app with React and Node.js"

# Interactive chat
grump chat -i

# Generate architecture
grump architect "E-commerce platform with microservices"

# Check system health
grump doctor

# Get shell completion
grump completion --shell bash >> ~/.bashrc
```

---

## Docker Deployment

### Single Container (Backend Only)

```bash
cd backend
docker build -t g-rump-backend .
docker run -p 3000:3000 \
  -e NVIDIA_NIM_API_KEY=your_key \
  g-rump-backend
```

### Docker Compose (Full Stack)

```bash
# From project root
docker-compose up -d
```

Services included:
- Backend API (port 3000)
- Frontend (port 5173)
- PostgreSQL database
- Redis cache
- Prometheus metrics
- Grafana dashboards

**Access:**
- API: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- Grafana: `http://localhost:3100` (admin/admin)
- Prometheus: `http://localhost:9090`

---

## Kubernetes Deployment

### Using Helm (Recommended)

#### 1. Add Helm Repository (if published)

```bash
helm repo add g-rump oci://ghcr.io/aphrodine-wq/helm
helm repo update
```

#### 2. Create Values File

```bash
cat > my-values.yaml <<EOF
secrets:
  nvidiaNimApiKey: "your_nvidia_key"
  anthropicApiKey: "your_anthropic_key"  # optional
  databaseUrl: "postgresql://user:pass@postgres:5432/grump"
  sessionSecret: "$(openssl rand -hex 32)"

ingress:
  enabled: true
  hosts:
    - host: api.your-domain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: g-rump-tls
      hosts:
        - api.your-domain.com

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20

postgresql:
  enabled: true
  auth:
    password: "your_secure_password"

redis:
  enabled: true
  auth:
    password: "your_redis_password"
EOF
```

#### 3. Install Helm Chart

```bash
helm install g-rump ./deploy/kubernetes/helm \
  -f my-values.yaml \
  --namespace g-rump \
  --create-namespace
```

#### 4. Verify Deployment

```bash
kubectl get pods -n g-rump
kubectl get svc -n g-rump
```

#### 5. Port Forward (Testing)

```bash
kubectl port-forward -n g-rump svc/g-rump 3000:80
```

Access at `http://localhost:3000`

### Using Raw Manifests

```bash
# Apply all manifests
kubectl apply -f deploy/kubernetes/helm/templates/

# Or apply individually
kubectl apply -f deploy/kubernetes/helm/templates/deployment.yaml
kubectl apply -f deploy/kubernetes/helm/templates/service.yaml
kubectl apply -f deploy/kubernetes/helm/templates/ingress.yaml
```

---

## Cloud Deployments

### Google Cloud Platform (GKE)

#### 1. Create GKE Cluster

```bash
gcloud container clusters create g-rump-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-4 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10
```

#### 2. Get Credentials

```bash
gcloud container clusters get-credentials g-rump-cluster \
  --zone us-central1-a
```

#### 3. Install with Helm

```bash
helm install g-rump ./deploy/kubernetes/helm \
  -f my-values.yaml \
  -n g-rump \
  --create-namespace
```

### Amazon Web Services (EKS)

#### 1. Create EKS Cluster

```bash
eksctl create cluster \
  --name g-rump-cluster \
  --region us-west-2 \
  --nodes 3 \
  --node-type t3.xlarge \
  --managed
```

#### 2. Install with Helm

```bash
helm install g-rump ./deploy/kubernetes/helm \
  -f my-values.yaml \
  -n g-rump \
  --create-namespace
```

### NVIDIA NGC (GPU Optimized)

For GPU-accelerated AI inference:

```bash
cd deploy/ngc
./provision.sh
./deploy.sh
```

---

## Configuration

### Environment Variables

#### Backend (.env)

```env
# Required
NVIDIA_NIM_API_KEY=your_nvidia_key
DATABASE_URL=postgresql://user:pass@localhost:5432/grump
SESSION_SECRET=random_secret_string

# Optional AI Providers
ANTHROPIC_API_KEY=your_anthropic_key
OPENROUTER_API_KEY=your_openrouter_key
GITHUB_COPILOT_TOKEN=your_github_token
KIMI_API_KEY=your_kimi_key
MISTRAL_API_KEY=your_mistral_key

# Optional Services
REDIS_URL=redis://localhost:6379
SENTRY_DSN=your_sentry_dsn
PINECONE_API_KEY=your_pinecone_key

# Server Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000
VITE_POSTHOG_KEY=your_posthog_key
```

---

## Troubleshooting

### Common Issues

#### "Cannot find module '@g-rump/shared-types'"

```bash
pnpm run build:packages
```

#### Backend won't start

1. Check Node version: `node --version` (should be >= 20.x)
2. Check environment variables: `cat backend/.env`
3. Check logs: `cd backend && pnpm run dev`

#### Frontend won't connect to backend

1. Verify backend is running: `curl http://localhost:3000/health/live`
2. Check CORS settings in `backend/src/server.ts`
3. Check `frontend/.env` has correct `VITE_API_URL`

#### Docker compose fails

```bash
# Clean and rebuild
docker-compose down -v
docker-compose up --build
```

#### Kubernetes pod won't start

```bash
# Check pod status
kubectl describe pod <pod-name> -n g-rump

# Check logs
kubectl logs <pod-name> -n g-rump

# Common fixes:
# - Verify secrets are created
# - Check resource limits
# - Verify image pull secrets
```

### Health Checks

```bash
# Backend health
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready

# Check metrics
curl http://localhost:3000/metrics

# Check available models
curl http://localhost:3000/api/models
```

### Getting Help

- 🐛 [Report Issues](https://github.com/Aphrodine-wq/GRUMPCO/issues)
- 💬 [Discord Community](https://discord.gg/grump)
- 📧 Email: support@g-rump.com

---

## Next Steps

- [API Documentation](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Contributing Guide](./legal/CONTRIBUTING.md)
- [Security Best Practices](../SECURITY.md)

---

**Last Updated:** 2026-02-05
**Version:** 2.1.0

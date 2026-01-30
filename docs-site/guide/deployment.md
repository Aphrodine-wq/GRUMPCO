# Deployment Guide

G-Rump supports multiple deployment strategies to fit your infrastructure needs. This guide covers deployment options from local development to production-scale environments.

## Deployment Options Overview

| Method | Best For | Complexity | Scaling |
|--------|----------|------------|---------|
| [Docker](#docker-deployment) | Most use cases | Easy | Horizontal |
| [Vercel](#vercel-deployment) | Serverless/JAMstack | Very Easy | Auto |
| [AWS](#aws-deployment) | Enterprise | Medium | Unlimited |
| [GCP](#google-cloud-platform) | Enterprise | Medium | Unlimited |
| [Kubernetes](#kubernetes-deployment) | Microservices | Complex | Auto |
| [Self-Hosted](#self-hosted-deployment) | On-premise | Medium | Manual |
| [Railway](#railway-deployment) | Quick deploy | Very Easy | Auto |
| [Render](#render-deployment) | Full-stack apps | Easy | Auto |

## Docker Deployment

Docker is the recommended deployment method for most use cases.

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com

# Create environment file
cp backend/.env.example backend/.env

# Start with Docker Compose
docker-compose up -d
```

### Production Docker Setup

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=redis
      - NVIDIA_NIM_URL=${NVIDIA_NIM_URL}
      - API_KEY=${API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=grump
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=grump_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 2G
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 512M
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Dockerfile (Backend)

```dockerfile
# Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

# Security: Run as non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_HOST` | No | Redis host (for caching) |
| `NVIDIA_NIM_URL` | Yes | NVIDIA NIM API endpoint |
| `API_KEY` | Yes | Master API key |
| `JWT_SECRET` | Yes | JWT signing secret |
| `CORS_ORIGINS` | Yes | Allowed CORS origins |
| `RATE_LIMIT_ENABLED` | No | Enable rate limiting |

## Vercel Deployment

Deploy the frontend to Vercel for serverless hosting.

### Prerequisites

- Vercel account
- Vercel CLI: `npm i -g vercel`

### Deployment Steps

```bash
# Login to Vercel
vercel login

# Navigate to frontend
cd frontend

# Deploy
vercel --prod
```

### `vercel.json` Configuration

```json
{
  "version": 2,
  "name": "grump-frontend",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "VITE_API_URL": "@grump-api-url"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

### Serverless Functions

For API routes as serverless functions:

```json
{
  "functions": {
    "api/*.ts": {
      "maxDuration": 30
    }
  }
}
```

## AWS Deployment

Deploy to AWS using multiple services.

### Option 1: ECS with Fargate

```yaml
# cloudformation/ecs-cluster.yml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  GrumpCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: grump-production
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT

  GrumpService:
    Type: AWS::ECS::Service
    Properties:
      ServiceName: grump-api
      Cluster: !Ref GrumpCluster
      TaskDefinition: !Ref GrumpTaskDefinition
      DesiredCount: 3
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref GrumpSecurityGroup
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2
      LoadBalancers:
        - ContainerName: grump
          ContainerPort: 3000
          TargetGroupArn: !Ref GrumpTargetGroup
```

### Option 2: Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p docker grump-production

# Create environment
eb create grump-production-env \
  --single \
  --envvars DATABASE_URL=postgres://...,API_KEY=...

# Deploy
eb deploy
```

### Option 3: Lambda (Serverless)

```yaml
# serverless.yml
service: grump-api

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    API_KEY: ${env:API_KEY}

functions:
  api:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

plugins:
  - serverless-offline
```

## Google Cloud Platform

### Cloud Run Deployment

```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/grump-backend

# Deploy to Cloud Run
gcloud run deploy grump-backend \
  --image gcr.io/PROJECT_ID/grump-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=...,API_KEY=... \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10
```

### GKE (Google Kubernetes Engine)

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grump-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: grump-backend
  template:
    metadata:
      labels:
        app: grump-backend
    spec:
      containers:
      - name: grump
        image: gcr.io/PROJECT_ID/grump-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: grump-secrets
              key: database-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Kubernetes Deployment

For microservices or large-scale deployments.

### Basic Deployment

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grump-backend
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: grump-backend
  template:
    metadata:
      labels:
        app: grump-backend
    spec:
      containers:
      - name: grump
        image: grump/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: grump-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: grump-backend
  namespace: production
spec:
  selector:
    app: grump-backend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: grump-backend
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: grump-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grump-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.grump.dev
    secretName: grump-tls
  rules:
  - host: api.grump.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: grump-backend
            port:
              number: 80
```

## Self-Hosted Deployment

### Bare Metal / VM

```bash
# System requirements check
node --version  # Requires Node.js 20+
npm --version

# Clone and setup
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com/backend

# Install dependencies
npm install

# Build application
npm run build

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start with PM2 (production process manager)
npm install -g pm2
pm2 start dist/index.js --name grump-api
pm2 save
pm2 startup
```

### Process Manager Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'grump-api',
    script: './dist/index.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    restart_delay: 3000,
    max_restarts: 5,
    min_uptime: '10s',
    listen_timeout: 10000,
    kill_timeout: 5000,
    wait_ready: true
  }]
};
```

## Railway Deployment

The easiest way to deploy for small to medium projects.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add --database postgres

# Add Redis
railway add --database redis

# Deploy
railway up

# Open in browser
railway open
```

### Railway Configuration

Create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Render Deployment

```bash
# Create render.yaml for infrastructure as code
```

```yaml
# render.yaml
services:
  - type: web
    name: grump-backend
    env: docker
    dockerfilePath: ./backend/Dockerfile
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: grump-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: grump-cache
          property: connectionString
    healthCheckPath: /health
    autoDeploy: true

  - type: redis
    name: grump-cache
    plan: standard
    maxmemoryPolicy: allkeys-lru

  - type: worker
    name: grump-jobs
    env: docker
    dockerfilePath: ./backend/Dockerfile.worker
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: grump-db
          property: connectionString

databases:
  - name: grump-db
    plan: standard
```

## Security Checklist

Before deploying to production:

- [ ] Use HTTPS with valid SSL certificates
- [ ] Set strong `JWT_SECRET` (min 256 bits)
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Enable request logging
- [ ] Set up monitoring and alerting
- [ ] Configure database backups
- [ ] Enable DDoS protection (Cloudflare)
- [ ] Use non-root Docker user
- [ ] Enable security headers (Helmet)
- [ ] Set up log aggregation

## Monitoring & Logging

### Recommended Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| APM | Datadog / New Relic | Performance monitoring |
| Logging | ELK Stack / Loki | Log aggregation |
| Metrics | Prometheus + Grafana | Custom metrics |
| Errors | Sentry | Error tracking |
| Uptime | UptimeRobot / Pingdom | Health checks |

### Health Checks

Configure these endpoints for monitoring:

```
GET /health          # Basic health check
GET /health/detailed # Detailed system status
GET /metrics         # Prometheus metrics
```

## Performance Optimization

### Database

- Enable connection pooling (PgBouncer)
- Use read replicas for queries
- Enable query caching (Redis)
- Set up database indexing

### Application

- Enable gzip/Brotli compression
- Use CDN for static assets
- Implement caching strategies
- Enable HTTP/2

### AI/LLM

- Use NVIDIA NIM for GPU acceleration
- Enable response caching
- Implement request batching
- Set up model fallback

## Troubleshooting

### Common Issues

**Database connection failures:**
```bash
# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Verify firewall rules
telnet <db-host> 5432
```

**Out of memory:**
```bash
# Check memory usage
docker stats

# Increase Node.js heap
NODE_OPTIONS="--max-old-space-size=4096" node dist/index.js
```

**High CPU usage:**
```bash
# Profile the application
node --prof dist/index.js
```

## Next Steps

- [Production Checklist](/guide/production) - Pre-deployment checklist
- [Security Guide](/guide/security) - Security best practices
- [Docker Guide](/guide/docker) - Detailed Docker setup
- [Troubleshooting](/guide/troubleshooting) - Common issues

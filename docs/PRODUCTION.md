# Production Deployment Guide

> **Version:** 2.1.0 | **Last Updated:** January 2026

This guide covers deploying G-Rump to production, including configuration, deployment options, observability, and operational procedures.

## Pre-Deployment Checklist

Before going live, verify:

### Environment
- [ ] `NODE_ENV=production`
- [ ] All required environment variables are set (see below)
- [ ] Secrets are not in code (use env vars or secret manager)
- [ ] `.env` files are not in version control

### Security
- [ ] HTTPS enabled with valid certificates
- [ ] `REQUIRE_AUTH_FOR_API=true`
- [ ] `CORS_ORIGINS` restricted to your domains
- [ ] Rate limiting configured
- [ ] Webhook secrets set
- [ ] Metrics endpoint protected

### Infrastructure
- [ ] Database provisioned (PostgreSQL for production)
- [ ] Redis configured for caching and rate limiting
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place
- [ ] SSL certificates configured

### Testing
- [ ] All tests passing
- [ ] Load testing completed
- [ ] Security scan completed
- [ ] Staging environment validated

---

## Required Environment Variables

### Core

```env
NODE_ENV=production
PORT=3000

# AI Provider (at least one required)
NVIDIA_NIM_API_KEY=nvapi-xxx
# or
OPENROUTER_API_KEY=sk-or-v1-xxx
```

### Database

```env
# PostgreSQL (production)
DATABASE_URL=postgresql://user:pass@host:5432/grump

# Or Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Redis

```env
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your-password
# Optional
REDIS_TLS=true
```

### Security

```env
REQUIRE_AUTH_FOR_API=true
CORS_ORIGINS=https://your-domain.com,https://app.your-domain.com
GRUMP_WEBHOOK_SECRET=your-webhook-secret
STRIPE_WEBHOOK_SECRET=whsec_xxx
METRICS_AUTH=admin:secure-password
```

### Optional

```env
# Sentry error tracking
SENTRY_DSN=https://xxx@sentry.io/xxx

# Feature flags
ENABLE_VOICE=true
ENABLE_RAG=true

# Performance
TIERED_CACHE_ENABLED=true
WORKER_POOL_SIZE=4
```

---

## Deployment Options

### Docker Compose

The simplest production deployment:

```bash
# Build and start
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

**docker-compose.prod.yml overlay:**
```yaml
version: '3.8'
services:
  backend:
    environment:
      - NODE_ENV=production
    restart: always
    
  frontend:
    environment:
      - VITE_API_URL=https://api.your-domain.com
    restart: always
```

### NGC-Ready Cloud Deployment

For NVIDIA Golden Developer Award compliance, deploy on NGC-certified clouds (GCP, AWS, Azure, Oracle):

**GCP:**
```bash
cd deploy/ngc/gcp
./provision.sh          # CPU-only (uses NIM cloud API)
./provision.sh --gpu    # With T4 GPU (for NeMo Curator/training)
./deploy.sh             # Deploy via Docker Compose
```

**AWS:**
```bash
cd deploy/ngc/aws
./provision.sh          # CPU-only
./provision.sh --gpu    # With T4 GPU (g4dn.xlarge)
./deploy.sh             # Deploy via Docker Compose
```

See [deploy/ngc/README.md](../deploy/ngc/README.md) for full NGC deployment guide.

### Kubernetes

For scalable deployments:

```bash
# Apply configurations
kubectl apply -f deploy/k8s/

# Check status
kubectl get pods -n grump

# View logs
kubectl logs -f deployment/grump-backend -n grump
```

Key manifests in `deploy/k8s/`:
- `deployment.yaml` — Pod specifications
- `service.yaml` — Internal services
- `ingress.yaml` — External access
- `configmap.yaml` — Configuration
- `secrets.yaml` — Sensitive data (use sealed-secrets or external-secrets)

---

## Database Setup

### PostgreSQL

Create the database:

```sql
CREATE DATABASE grump;
CREATE USER grump_user WITH ENCRYPTED PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE grump TO grump_user;
```

Run migrations:

```bash
cd backend
npm run db:migrate
```

### Connection Pooling

For production, use connection pooling:

```env
# PgBouncer or Supabase pooler
DATABASE_URL=postgresql://user:pass@pooler.host:6543/grump?pgbouncer=true
```

### Backups

Set up automated backups:

```bash
# Example: Daily backup to S3
pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://backups/grump-$(date +%Y%m%d).sql.gz
```

---

## Redis Setup

### Configuration

```env
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_TLS=true
```

### Cluster Mode

For high availability:

```env
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

### Fallback Behavior

If Redis is unavailable:
- Rate limiting falls back to in-memory (not shared across instances)
- L2 cache is disabled
- `/health/detailed` shows `redis: degraded`

---

## Observability

### Metrics (Prometheus)

G-Rump exposes Prometheus metrics at `/metrics`:

```env
# Protect with basic auth
METRICS_AUTH=admin:secure-password
```

Key metrics:
- `http_requests_total` — Request count by endpoint and status
- `http_request_duration_seconds` — Request latency histogram
- `llm_stream_duration_seconds` — LLM stream duration by provider/model
- `llm_time_to_first_token_seconds` — NVIDIA NIM-aligned TTFB
- `llm_tokens_per_second` — NVIDIA NIM-aligned throughput
- `llm_tokens_total` — Token usage by provider/model
- `tiered_cache_hits_total` — Cache hit rate

### Logging (Pino)

Structured JSON logging:

```json
{
  "level": 30,
  "time": 1706745600000,
  "correlationId": "abc-123",
  "requestId": "req-456",
  "msg": "Request completed",
  "statusCode": 200,
  "responseTime": 150
}
```

Configure log level:

```env
LOG_LEVEL=info  # debug, info, warn, error
```

### Tracing (OpenTelemetry)

Enable distributed tracing (NVIDIA NIM-compatible):

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector:4318
OTEL_SERVICE_NAME=grump-backend
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp
```

Traces include:
- HTTP requests
- LLM API calls (with `nvidia.nim.model` and `nvidia.nim.provider` span attributes)
- Database queries
- Cache operations

See [NVIDIA_OBSERVABILITY.md](./NVIDIA_OBSERVABILITY.md) for full NVIDIA observability setup.

### NVIDIA Observability (NIM-Aligned)

G-Rump emits NIM-aligned metrics for MLOps monitoring:

- `llm_time_to_first_token_seconds` – Time to first token (TTFB)
- `llm_tokens_per_second` – Generation throughput
- `llm_tokens_total` – Token usage by provider/model

See [NVIDIA_OBSERVABILITY.md](./NVIDIA_OBSERVABILITY.md) for configuration and integration with Datadog, Grafana, Zipkin, and Jaeger.

### Grafana Dashboard

Import the dashboard from `deploy/grafana/grump-dashboard.json`:

1. Open Grafana
2. Import dashboard
3. Select Prometheus data source
4. Configure alerts

### Alerting

Recommended alerts:

| Metric | Condition | Severity |
|--------|-----------|----------|
| Error rate | > 5% for 5 min | Critical |
| Response time p95 | > 5s for 5 min | Warning |
| Redis connection | Down for 1 min | Critical |
| Job queue depth | > 100 for 10 min | Warning |
| Memory usage | > 90% for 5 min | Warning |

---

## Scaling

### Horizontal Scaling

G-Rump backend is stateless and can be horizontally scaled:

```yaml
# Kubernetes
spec:
  replicas: 3
```

Requirements:
- Redis for shared rate limiting and caching
- PostgreSQL for persistent data
- Sticky sessions not required

### Vertical Scaling

Increase resources for intensive operations:

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Backend | 512MB RAM, 0.5 CPU | 2GB RAM, 2 CPU |
| Redis | 256MB RAM | 1GB RAM |
| PostgreSQL | 512MB RAM | 2GB RAM |

### Worker Pool

Configure worker pool size for parallel operations:

```env
WORKER_POOL_SIZE=4  # Default: CPU cores
```

---

## Health Checks

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health/quick` | Fast liveness check |
| `GET /health/detailed` | Full readiness check |

### Quick Check Response

```json
{
  "status": "healthy",
  "checks": {
    "api_key_configured": true,
    "server_responsive": true
  }
}
```

### Detailed Check Response

```json
{
  "status": "healthy",
  "checks": {
    "database": "connected",
    "redis": "connected",
    "llm_provider": "available"
  },
  "version": "2.1.0",
  "uptime": 86400
}
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health/quick
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/detailed
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## Incident Response Runbook

### High Error Rate

**Symptoms:** Error rate > 5%, users reporting failures

**Investigation:**
1. Check logs for error patterns: `grep "error" logs | head -50`
2. Check LLM provider status
3. Check database connectivity
4. Check Redis connectivity

**Resolution:**
- If LLM provider down: Enable fallback provider
- If database issue: Check connection pool, restart if needed
- If Redis issue: System degrades gracefully; fix when possible

### High Latency

**Symptoms:** Response times > 5s, users reporting slowness

**Investigation:**
1. Check metrics for bottleneck (LLM calls, DB queries, cache)
2. Check cache hit rate
3. Check job queue depth
4. Check resource usage (CPU, memory)

**Resolution:**
- If cache miss rate high: Warm cache, increase TTL
- If job queue backed up: Scale workers
- If resource constrained: Scale up/out

### Redis Unavailable

**Symptoms:** `/health/detailed` shows `redis: degraded`

**Impact:**
- Rate limiting falls back to in-memory (not shared)
- L2 cache disabled
- Job queue may be affected

**Resolution:**
1. Check Redis connectivity
2. Check Redis memory usage
3. Restart Redis if needed
4. System continues with degraded performance

### Database Unavailable

**Symptoms:** 500 errors on database operations

**Investigation:**
1. Check database connectivity
2. Check connection pool exhaustion
3. Check database resource usage

**Resolution:**
1. Check database server status
2. Restart connection pool
3. Scale database if needed
4. Restore from backup if data loss

---

## Maintenance

### Zero-Downtime Deployments

With Kubernetes:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

With Docker Compose:

```bash
# Build new image
docker compose build

# Rolling restart
docker compose up -d --no-deps --build backend
```

### Database Migrations

Run migrations before deploying new code:

```bash
# Run migration
npm run db:migrate

# Rollback if needed
npm run db:migrate:rollback
```

### Cache Invalidation

Clear cache when deploying breaking changes:

```bash
# Redis
redis-cli FLUSHDB

# Or via API (if implemented)
curl -X POST http://localhost:3000/api/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Cost Management

### LLM Cost Tracking

G-Rump tracks token usage and costs:

```bash
# View cost summary
curl http://localhost:3000/api/cost/summary
```

### Budget Alerts

Set spending limits:

```bash
curl -X POST http://localhost:3000/api/cost/budget \
  -H "Content-Type: application/json" \
  -d '{"daily": 50, "monthly": 1000}'
```

### Cost Optimization

- Enable tiered caching to reduce LLM calls
- Use cost-aware model routing
- Monitor and optimize high-usage patterns

---

## Related Documentation

- **[SECURITY.md](./SECURITY.md)** — Security requirements and controls
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System architecture
- **[TESTING.md](./TESTING.md)** — Testing strategy including load tests
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — Common issues and solutions

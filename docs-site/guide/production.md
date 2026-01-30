# Production Checklist

Essential steps to prepare G-Rump for production deployment.

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing
- [ ] Code coverage > 80%
- [ ] No linting errors
- [ ] TypeScript strict mode enabled
- [ ] No console.log statements in production code

```bash
# Run all quality checks
npm run lint
npm run typecheck
npm test -- --coverage
```

### Security

- [ ] Dependencies scanned for vulnerabilities
- [ ] No hardcoded secrets
- [ ] API keys in environment variables
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled

```bash
# Scan dependencies
npm audit

# Check for secrets
npx secretlint "**/*"

# Security scan
npm run security:scan
```

### Performance

- [ ] Database queries optimized
- [ ] Indexes added for frequent queries
- [ ] Caching implemented
- [ ] Static assets compressed
- [ ] Bundle size analyzed
- [ ] Load testing completed

```bash
# Analyze bundle
npm run build -- --analyze

# Load test
npm run test:load
```

### Infrastructure

- [ ] Health check endpoint working
- [ ] Structured logging configured
- [ ] Error tracking set up (Sentry, etc.)
- [ ] Monitoring dashboards created
- [ ] Backup strategy in place
- [ ] Disaster recovery plan documented

## Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/grump
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://host:6379

# LLM Provider
OPENAI_API_KEY=sk-...

# Security
JWT_SECRET=<long-random-string>
ENCRYPTION_KEY=<32-byte-hex>
SESSION_SECRET=<long-random-string>

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info

# Feature Flags
ENABLE_TELEMETRY=false
```

### Secrets Management

**Never commit secrets to version control.**

Options:
1. **Environment variables** - Set in deployment platform
2. **Secrets manager** - AWS Secrets Manager, HashiCorp Vault
3. **Encrypted config** - Sealed secrets in Kubernetes

```bash
# Example: AWS Secrets Manager
aws secretsmanager create-secret \
  --name grump/production \
  --secret-string '{"OPENAI_API_KEY":"sk-..."}'
```

## Database

### Migrations

```bash
# Run pending migrations
npm run db:migrate:prod

# Verify migration status
npm run db:migrate:status
```

### Backups

```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Automated backups (cron)
0 2 * * * /usr/local/bin/backup-db.sh
```

### Connection Pooling

Use PgBouncer or similar for connection pooling:

```ini
# pgbouncer.ini
[databases]
grump = host=localhost dbname=grump

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

## API Security

### Rate Limiting

```typescript
// Configure rate limits
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,              // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false
}));

// Stricter limits for auth endpoints
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10                     // 10 attempts
}));
```

### CORS Configuration

```typescript
app.use(cors({
  origin: [
    'https://app.grump.dev',
    'https://grump.dev'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.openai.com']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Logging

### Structured Logging

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  redact: ['req.headers.authorization', 'password', 'apiKey']
});

// Usage
logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ err, requestId }, 'Request failed');
```

### Log Aggregation

Send logs to a centralized service:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Datadog**
- **Papertrail**
- **CloudWatch Logs**

## Monitoring

### Health Check Endpoint

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      llm: await checkLLMProvider()
    }
  };
  
  const isHealthy = Object.values(checks.services)
    .every(s => s.status === 'up');
  
  res.status(isHealthy ? 200 : 503).json(checks);
});
```

### Metrics

Export Prometheus metrics:

```typescript
import { collectDefaultMetrics, Registry } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Alerting

Set up alerts for:

- Error rate > 1%
- Response time p95 > 500ms
- CPU usage > 80%
- Memory usage > 80%
- Disk usage > 90%
- Failed health checks

## Deployment

### Blue-Green Deployment

```yaml
# kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grump-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: grump
      version: green
```

### Rolling Updates

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### Rollback Plan

```bash
# Quick rollback
kubectl rollout undo deployment/grump

# Rollback to specific version
kubectl rollout undo deployment/grump --to-revision=2
```

## Post-Deployment

### Verify Deployment

```bash
# Check health
curl https://api.grump.dev/health

# Verify version
curl https://api.grump.dev/version

# Run smoke tests
npm run test:smoke:prod
```

### Monitor

- Watch error rates for 30 minutes
- Check response times
- Verify all integrations working
- Monitor resource usage

## Checklist Template

```markdown
## Release: v1.0.0
Date: 2025-01-30

### Pre-Deploy
- [ ] All tests passing
- [ ] Security scan clean
- [ ] Changelog updated
- [ ] Database migrations ready
- [ ] Team notified

### Deploy
- [ ] Backup database
- [ ] Run migrations
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Verify health checks

### Post-Deploy
- [ ] Smoke tests passing
- [ ] Error rate normal
- [ ] Response times normal
- [ ] Notify team of completion

### Rollback (if needed)
- [ ] Revert deployment
- [ ] Rollback migrations
- [ ] Restore database
- [ ] Notify team
```

## Next Steps

- [Docker Deployment](/guide/docker) - Container deployment
- [Security](/guide/security) - Security deep dive
- [API Reference](/api/overview) - API documentation

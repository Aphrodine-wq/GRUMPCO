# Docker Deployment

Deploy G-Rump using Docker containers for consistent, reproducible environments.

## Quick Start

```bash
# Run G-Rump with Docker
docker run -d \
  --name grump \
  -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  grump/grump:latest
```

Access at `http://localhost:3000`

## Docker Images

### Official Images

| Image | Description | Size |
|-------|-------------|------|
| `grump/grump:latest` | Full application | ~500MB |
| `grump/grump:backend` | API server only | ~200MB |
| `grump/grump:slim` | Minimal, no dev tools | ~150MB |

### Tags

- `latest` - Latest stable release
- `1.0.0` - Specific version
- `1.0` - Latest patch of minor version
- `edge` - Latest development build

## Dockerfile

### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build application
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S grump && adduser -S grump -G grump

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set permissions
RUN chown -R grump:grump /app
USER grump

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Multi-stage Frontend Build

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## Docker Compose

### Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://grump:grump@db:5432/grump
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - db
      - redis
    volumes:
      - ./backend/src:/app/src  # Hot reload

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000
    volumes:
      - ./frontend/src:/app/src  # Hot reload

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=grump
      - POSTGRES_PASSWORD=grump
      - POSTGRES_DB=grump
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

### Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    image: grump/grump:backend
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  frontend:
    image: grump/grump:frontend
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend

  db:
    image: postgres:15-alpine
    restart: always
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=grump
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backups:/backups

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### Run Production

```bash
# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@db:5432/grump
REDIS_URL=redis://redis:6379
OPENAI_API_KEY=sk-...
JWT_SECRET=$(openssl rand -hex 32)
DB_USER=grump
DB_PASSWORD=$(openssl rand -hex 16)
EOF

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale backend
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

## Building Images

### Build Locally

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend

# Build with no cache
docker-compose build --no-cache
```

### Push to Registry

```bash
# Tag images
docker tag grump-backend:latest grump/grump:backend
docker tag grump-backend:latest grump/grump:1.0.0

# Push to Docker Hub
docker push grump/grump:backend
docker push grump/grump:1.0.0
```

## Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | Server port (default: 3000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | No | Redis connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `JWT_SECRET` | Yes | JWT signing secret |
| `LOG_LEVEL` | No | Logging level (default: info) |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL |
| `VITE_WS_URL` | No | WebSocket URL |

## Networking

### Docker Network

```yaml
networks:
  grump-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Expose Services

```yaml
services:
  backend:
    networks:
      - grump-network
    # Internal only
    expose:
      - "3000"

  nginx:
    networks:
      - grump-network
    # External access
    ports:
      - "80:80"
      - "443:443"
```

## Volumes

### Persistent Data

```yaml
volumes:
  # Database
  pgdata:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/postgres

  # Redis
  redisdata:
    driver: local

  # Uploads
  uploads:
    driver: local
```

### Backup Volumes

```bash
# Backup database volume
docker run --rm \
  -v grump_pgdata:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/pgdata-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm \
  -v grump_pgdata:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/pgdata-20250130.tar.gz -C /
```

## Health Checks

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Logging

### JSON Logging

```yaml
services:
  backend:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### Centralized Logging

```yaml
services:
  backend:
    logging:
      driver: fluentd
      options:
        fluentd-address: localhost:24224
        tag: grump.backend
```

## Security

### Non-Root User

```dockerfile
RUN addgroup -S grump && adduser -S grump -G grump
USER grump
```

### Read-Only Filesystem

```yaml
services:
  backend:
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - uploads:/app/uploads
```

### Resource Limits

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Troubleshooting

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Shell Access

```bash
# Access running container
docker-compose exec backend sh

# Access stopped container
docker run -it grump/grump:backend sh
```

### Debug Container

```bash
# Run with shell
docker run -it --entrypoint sh grump/grump:backend

# Check environment
docker-compose exec backend env

# Check network
docker-compose exec backend wget -qO- http://db:5432
```

## Next Steps

- [Production Checklist](/guide/production) - Production preparation
- [Security](/guide/security) - Security configuration
- [Configuration](/guide/configuration) - Detailed configuration

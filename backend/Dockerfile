# syntax=docker/dockerfile:1.4

# =============================================================================
# G-Rump Backend Dockerfile
# Multi-stage build for security and minimal image size
# =============================================================================

# Build stage
FROM node:20-alpine AS builder

# Add labels for traceability
LABEL stage="builder"

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Copy source code and build configuration
COPY tsconfig.json .swcrc ./
COPY src ./src
COPY scripts ./scripts

# Build with SWC (much faster than tsc)
RUN --mount=type=cache,target=/app/.swc \
    npm run build

# =============================================================================
# Production stage
# =============================================================================
FROM node:20-alpine

# OCI/Docker labels for metadata
LABEL org.opencontainers.image.title="G-Rump Backend" \
      org.opencontainers.image.description="AI-powered development platform backend" \
      org.opencontainers.image.version="2.1.0" \
      org.opencontainers.image.vendor="G-Rump" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/Aphrodine-wq/G-rump.com" \
      org.opencontainers.image.documentation="https://docs.g-rump.com"

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Security: Create non-root user
RUN addgroup -g 1001 -S grump && \
    adduser -S grump -u 1001 -G grump

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --prefer-offline --no-audit && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=grump:grump /app/dist ./dist

# Create data directory for SQLite with correct permissions
RUN mkdir -p /app/data /app/logs && \
    chown -R grump:grump /app/data /app/logs

# Security: Remove unnecessary files and set restrictive permissions
RUN chmod -R 755 /app && \
    chmod -R 700 /app/data

# Set environment
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048 --enable-source-maps" \
    # Security: Disable npm update check
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    # Performance: Optimize garbage collection
    UV_THREADPOOL_SIZE=16

# Switch to non-root user
USER grump

# Expose port
EXPOSE 3000

# Health check with proper intervals
# - interval: Check every 30s
# - timeout: Fail if no response in 10s
# - start-period: Grace period for container startup
# - retries: Mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health/live || exit 1

# Use tini for proper signal handling (PID 1 reaping, signal forwarding)
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]

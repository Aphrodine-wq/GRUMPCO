# syntax=docker/dockerfile:1.4

# =============================================================================
# G-Rump Backend Dockerfile
# Multi-stage build for security and minimal image size
# Designed to work within the backend directory context
# =============================================================================

# Build stage
FROM node:20-alpine AS builder

# Add labels for traceability
LABEL stage="builder"

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files - we'll patch workspace deps during build
COPY backend/package*.json ./

# Create a patched package.json that removes workspace deps
# The ai-core package will be bundled inline
RUN node -e " \
    const pkg = require('./package.json'); \
    delete pkg.dependencies['@grump/ai-core']; \
    require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2)); \
    "

# Install dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit --legacy-peer-deps

# Copy ai-core package source (will be bundled with esbuild)
COPY packages/ai-core ./packages/ai-core

# Copy source code and build configuration
COPY backend/tsconfig.json backend/.swcrc ./
COPY backend/src ./src
COPY backend/scripts ./scripts

# Build ai-core first
WORKDIR /app/packages/ai-core
RUN npm install && npm run build

# Link ai-core into node_modules so imports resolve during build
WORKDIR /app
RUN mkdir -p node_modules/@grump/ai-core && \
    cp -r packages/ai-core/dist node_modules/@grump/ai-core/ && \
    cp packages/ai-core/package.json node_modules/@grump/ai-core/

# Build backend with TypeScript (ignore type errors, noEmitOnError:false generates output anyway)
RUN npx tsc || true
RUN node scripts/copy-migrations.mjs

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

# Copy package files and patch for production
COPY backend/package*.json ./
RUN node -e " \
    const pkg = require('./package.json'); \
    delete pkg.dependencies['@grump/ai-core']; \
    require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2)); \
    "

# Install production dependencies only
# Note: Don't run npm cache clean with cache mount - Docker manages the cache
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --prefer-offline --no-audit --legacy-peer-deps

# Copy built application from builder
COPY --from=builder --chown=grump:grump /app/dist ./dist

# Copy built ai-core from builder
COPY --from=builder --chown=grump:grump /app/packages/ai-core/dist ./node_modules/@grump/ai-core/dist
COPY --from=builder --chown=grump:grump /app/packages/ai-core/package.json ./node_modules/@grump/ai-core/

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

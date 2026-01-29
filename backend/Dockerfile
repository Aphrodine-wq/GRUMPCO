# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (needed for TypeScript compilation)
RUN npm ci

# Copy source code and build scripts
COPY src ./src
COPY scripts ./scripts

# Build TypeScript and copy migrations into dist
RUN npm run build

# Production stage
FROM node:20-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Create data directory for SQLite (not used in serverless Vercel deployment)
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check (align with Vercel deployment workflow)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/quick || exit 1

# Start the application
CMD ["node", "dist/index.js"]

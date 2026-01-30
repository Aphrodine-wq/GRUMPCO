#!/bin/bash
# Optimized Docker build script with BuildKit

set -e

echo "Building optimized Docker images with BuildKit..."

# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build backend with cache
echo "Building backend..."
docker build \
  --file backend/Dockerfile \
  --tag grump-backend:latest \
  --cache-from ghcr.io/your-org/grump-backend:latest \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --progress=plain \
  backend/

# Build frontend with cache
echo "Building frontend..."
docker build \
  --file frontend/Dockerfile \
  --tag grump-frontend:latest \
  --cache-from ghcr.io/your-org/grump-frontend:latest \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --progress=plain \
  frontend/

# Show image sizes
echo ""
echo "Image sizes:"
docker images | grep grump

echo ""
echo "Build complete!"
echo "Run 'docker-compose up' to start the application"

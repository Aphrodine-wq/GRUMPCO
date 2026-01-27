#!/bin/bash
set -e

VERSION=${1:-latest}

echo "Deploying to production environment (version: $VERSION)..."

# Load environment variables
source .env.production

# Build and push Docker images
docker build -t grump-backend:$VERSION ./backend
docker build -t grump-backend:latest ./backend
docker build -t grump-frontend:$VERSION ./frontend
docker build -t grump-frontend:latest ./frontend

# Tag and push to registry (if using container registry)
# docker tag grump-backend:$VERSION $REGISTRY/grump-backend:$VERSION
# docker tag grump-backend:latest $REGISTRY/grump-backend:latest
# docker tag grump-frontend:$VERSION $REGISTRY/grump-frontend:$VERSION
# docker tag grump-frontend:latest $REGISTRY/grump-frontend:latest
# docker push $REGISTRY/grump-backend:$VERSION
# docker push $REGISTRY/grump-backend:latest
# docker push $REGISTRY/grump-frontend:$VERSION
# docker push $REGISTRY/grump-frontend:latest

# Deploy using docker-compose or Kubernetes
if [ -f docker-compose.production.yml ]; then
  docker-compose -f docker-compose.production.yml up -d
else
  docker-compose up -d
fi

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 60

# Health checks
if curl -f https://grump.app/health/quick && curl -f https://grump.app/health/ready; then
  echo "Production deployment successful (version: $VERSION)!"
else
  echo "Health check failed, rolling back..."
  docker-compose down
  exit 1
fi

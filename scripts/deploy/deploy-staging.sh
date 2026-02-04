#!/bin/bash
set -e

echo "Deploying to staging environment..."

# Load environment variables
source .env.staging

# Build and push Docker images
docker build -t grump-backend:staging ./backend
docker build -t grump-frontend:staging ./frontend

# Tag and push to registry (if using container registry)
# docker tag grump-backend:staging $REGISTRY/grump-backend:staging
# docker tag grump-frontend:staging $REGISTRY/grump-frontend:staging
# docker push $REGISTRY/grump-backend:staging
# docker push $REGISTRY/grump-frontend:staging

# Deploy using docker-compose or Kubernetes
if [ -f docker-compose.staging.yml ]; then
  docker-compose -f docker-compose.staging.yml up -d
else
  docker-compose up -d
fi

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 30

# Health check
if curl -f http://localhost:3000/health/quick; then
  echo "Staging deployment successful!"
else
  echo "Health check failed, rolling back..."
  docker-compose down
  exit 1
fi

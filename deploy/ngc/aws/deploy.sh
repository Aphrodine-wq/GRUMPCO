#!/bin/bash
# Deploy G-Rump on AWS NGC instance via Docker Compose
# Run from project root or from deploy/ngc/aws/ with REPO_ROOT set
#
# Usage: ./deploy.sh [REPO_ROOT]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${1:-${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}}"

if [[ ! -f "$REPO_ROOT/deploy/docker-compose.yml" ]]; then
  echo "Error: G-Rump repo not found at $REPO_ROOT"
  echo "Usage: ./deploy.sh [REPO_ROOT]"
  exit 1
fi

cd "$REPO_ROOT"

echo "Deploying G-Rump from $REPO_ROOT"

# Ensure .env exists (copy from example if needed)
if [[ ! -f backend/.env ]]; then
  if [[ -f backend/.env.example ]]; then
    cp backend/.env.example backend/.env
    echo "Created backend/.env from example. Edit it and set NVIDIA_NIM_API_KEY."
  else
    echo "Warning: backend/.env not found. Create it with NVIDIA_NIM_API_KEY."
  fi
fi

# Build and start
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d

echo ""
echo "G-Rump is running."
echo "  Backend: http://localhost:3000"
echo "  Frontend: http://localhost:5173"
echo "  Health: curl http://localhost:3000/health/quick"

#!/usr/bin/env bash
# Run G-Rump with Docker Compose
set -e
cd "$(dirname "$0")/.."
echo "Starting G-Rump with Docker..."
docker compose -f deploy/docker-compose.yml up --build -d
echo ""
echo "G-Rump is running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3000"
echo ""
echo "Stop with: docker compose -f deploy/docker-compose.yml down"
